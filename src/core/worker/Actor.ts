/* eslint-disable @typescript-eslint/ban-types */
import { getGlobalWorkerPool } from './WorkerPool';
import WorkerPool from './WorkerPool';
import { UID, isNumber } from '../util';
import { createAdapter } from './Worker';
import { adapterHasCreated, pushAdapterCreated, workersHasCreated } from './CoreWorkers';
import { startTasks, pushLoopHook } from '../MicroTask';
import { CHECK_FPS_WORKER_KEY } from './FPSCheckWorker';
import GlobalConfig from '../../GlobalConfig';

export type Message<T = any> = {
    command: "broadcast" | 'send'
    data: T
    buffers: ArrayBuffer[]
    cb: Function
    workerId?: number
}

let dedicatedWorker = 0;

const EMPTY_BUFFERS = [];

/**
 * An actor to exchange data from main-thread to workers
 * contains code from [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js)
 * @category core
 * @memberof worker
 * @example
 *  const workerKey = 'test_worker_key';
    maptalks.registerWorkerAdapter(workerKey, function (exports, global) {
      //will be called only for once when loaded in worker thread
      exports.initialize = function () {
        console.log('[worker] initialized');
      };
      //to receive message from main thread sent by maptalks.worker.Actor
      exports.onmessage = function (message, postResponse) {
        const data = message.data;
        console.log(`[worker] received data : ` + data);
        //send message back to main thread
        //the parameters:
        //error, data, buffers (arraybuffers in data)
        postResponse(null, 'message from worker thread', null);
      };
    });

    const MyActor = class extends maptalks.worker.Actor {
      test(info, cb) {
        //send data to worker thread
        this.send(info, null, cb);
      }
    }

    //must be same with workerKey for maptalks.registerWorkerAdapter
    const actor = new MyActor(workerKey);
    actor.test('hi', (err, data) => {
      //received data from worker thread
      console.log(data);
    });
 */
class Actor {
    _delayMessages: Message[]
    initializing: boolean
    workerKey: string
    workerPool: WorkerPool
    currentActor: number
    actorId: number
    workers: Worker[]
    callbacks: {
        [key: string]: Function
    }
    callbackID: number
    receiveFn: any
    constructor(workerKey: string) {
        startTasks();
        this._delayMessages = [];
        this.initializing = false;
        const hasCreated = adapterHasCreated(workerKey);
        //当同一个workerKey多例时初始化会有问题吗？不会，因为第一个Actor会将workerpool占满，后续的Actor worker通信处于排队状态
        //当第一个Actor初始化完成释放了worker pool里的每个worker资源,后续的Actor的消息通信才会被执行
        //当且仅当worker线程池启动且第一次创建改Actor时才走这个逻辑,后续改workerKey的Actor都是同步的
        if (workersHasCreated() && !hasCreated) {
            this.initializing = true;
            console.log(`Injecting codes in worker with worker key: :${workerKey}`);
            createAdapter(workerKey, () => {
                this.initializing = false;
                this.created();
            });
        }
        this.workerKey = workerKey;
        this.workerPool = getGlobalWorkerPool();
        this.currentActor = 0;
        this.actorId = UID();
        this.workers = this.workerPool.acquire(this.actorId);
        this.callbacks = {};
        this.callbackID = 0;
        this.receiveFn = this.receive.bind(this);
        this.workers.forEach(w => {
            w.addEventListener('message', this.receiveFn, false);
        });
        pushAdapterCreated(workerKey);
    }

    created() {
        // handler delay messages
        this._delayMessages.forEach(message => {
            const { command, data, buffers, cb, workerId } = message;
            this[command](data, buffers, cb, workerId);
        });
        this._delayMessages = [];
    }

    /**
     * If the actor is active
     * @returns
     */
    isActive() {
        return !!this.workers;
    }

    /**
     * Broadcast a message to all Workers.
     * @param {Object} data - data to send to worker thread
     * @param {ArrayBuffer[]} buffers - arraybuffers in data as transferables
     * @param {Function} cb - callback function when received message from worker thread
     */
    broadcast<T = any>(data: T, buffers: ArrayBuffer[], cb: Function) {
        if (this.initializing) {
            this._delayMessages.push({ command: 'broadcast', data, buffers, cb });
            return this;
        }
        cb = cb || function () { };
        asyncAll(this.workers, (worker: Worker, done: Function) => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            this.send(data, buffers, done, worker.id);
        }, cb);
        return this;
    }

    /**
     * Sends a message from a main-thread to a Worker and call callback when response received.
     *
     * @param {Object} data - data to send to worker thread
     * @param {ArrayBuffer[]} buffers - arraybuffers in data as transferables
     * @param {Function} cb - callback function when received message from worker thread
     * @param {Number} [workerId=undefined] - Optional, a particular worker id to which to send this message.
     */
    send<T = any>(data: T, buffers: ArrayBuffer[], cb: Function, workerId?: number) {
        if (this.initializing) {
            this._delayMessages.push({ command: 'send', data, buffers, cb, workerId });
            return this;
        }
        const id = cb ? `${this.actorId}:${this.callbackID++}` : null;
        if (cb) this.callbacks[id] = cb;
        this.post({
            data: data,
            callback: String(id)
        }, buffers, workerId);
        return this;
    }

    /**
     * A listener callback for incoming message from worker thread.
     * SHOULD NOT BE OVERRIDED only if you know what you are doing.
     * @param {Object} message - response message from worker thread
     */
    receive(message: Message) {
        const data = message.data,
            id = data.callback;
        const callback = this.callbacks[id];
        delete this.callbacks[id];
        if (data.type === '<request>') {
            if (this.actorId === data.actorId) {
                //request from worker to main thread
                this[data.command](data.params, (err, cbData, buffers) => {
                    const message: any = {
                        type: '<response>',
                        callback: data.callback
                    };
                    if (err) {
                        message.error = err.message;
                    } else {
                        message.data = cbData;
                    }
                    this.post(message, buffers || EMPTY_BUFFERS, data.workerId);
                });
            }
        } else if (callback && data.error) {
            callback(data.error);
        } else if (callback) {
            callback(null, data.data);
        }
    }

    /**
     * Remove the actor
     */
    remove() {
        this.workers.forEach(w => {
            w.removeEventListener('message', this.receiveFn, false);
        });
        // this.workerPool.release(this.actorId);
        delete this.receiveFn;
        delete this.workers;
        delete this.callbacks;
        delete this.workerPool;
    }

    /**
     * Send a message to a Worker.
     * @param {Object} data - data to send
     * @param {ArrayBuffer[]} buffers   - arraybuffers in data
     * @param {Number} targetID The ID of the Worker to which to send this message. Omit to allow the dispatcher to choose.
     * @returns {Number} The ID of the worker to which the message was sent.
     */
    post(data: any, buffers: ArrayBuffer[], targetID: number): number {
        if (typeof targetID !== 'number' || isNaN(targetID)) {
            // Use round robin to send requests to web workers.
            targetID = this.currentActor = (this.currentActor + 1) % this.workerPool.workerCount;
        }
        data.workerId = targetID;
        data.workerKey = this.workerKey;
        data.actorId = this.actorId;
        // this.workers[targetID].postMessage(data, buffers || EMPTY_BUFFERS);
        this.workerPool.addMessage(targetID, data, buffers || EMPTY_BUFFERS);

        return targetID;
    }

    /**
     * Get a dedicated worker in a round-robin fashion
     */
    getDedicatedWorker() {
        dedicatedWorker = (dedicatedWorker + 1) % this.workerPool.workerCount;
        return dedicatedWorker;
    }

}

function asyncAll(array: any[], fn: Function, callback: Function) {
    if (!array.length) { callback(null, []); }
    let remaining = array.length;
    const results = new Array(array.length);
    let error = null;
    array.forEach((item, i) => {
        fn(item, (err, result) => {
            if (err) error = err;
            results[i] = result;
            if (--remaining === 0) callback(error, results);
        });
    });
}

export default Actor;


let actor: Actor;

class FPSCheckActor extends Actor {

    constructor() {
        super(CHECK_FPS_WORKER_KEY);
    }
}

function checkFPS(cb: Function) {
    if (!actor) {
        actor = new FPSCheckActor();
    }
    actor.send({}, [], (err, data) => {
        if (err) {
            console.error(err);
            cb();
        } else {
            cb(data.fps as number);
        }
    })
}


let checkFPSing = false;
function checkBrowserMaxFPS() {
    if (checkFPSing) {
        return;
    }
    if (GlobalConfig.maxFPS <= 0) {
        checkFPSing = true;
        checkFPS((fps) => {
            if (isNumber(fps) && fps > 0 && GlobalConfig.maxFPS <= 0) {
                GlobalConfig.maxFPS = fps;
            }
            checkFPSing = false;
        })
    }
}

pushLoopHook(checkBrowserMaxFPS);