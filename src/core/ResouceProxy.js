import {
    extend, getAbsoluteURL, isNumber, isObject,
    isString, isURL, parseSVG
} from './util';
import { createEl } from './util/dom';
import Browser from './Browser';
import Ajax from './Ajax';

const EMPTY_STRING = '';
const BASE64_REG = /data:image\/.*;base64,/;


function createCanvas() {
    let canvas;
    if (Browser.IS_NODE) {
        console.error('Current environment does not support canvas dom');
    } else {
        canvas = createEl('canvas');
    }
    return canvas;
}

function createOffscreenCanvas() {
    let offscreenCanvas;
    if (Browser.decodeImageInWorker) {
        offscreenCanvas = new OffscreenCanvas(2, 2);
    }
    return offscreenCanvas;
}



function isBase64URL(path) {
    return BASE64_REG.test(path);
}

function isBlobURL(path) {
    return path.indexOf('blob:') === 0;
}

function strContains(str1, str2) {
    if (isNumber(str1)) {
        str1 += EMPTY_STRING;
    }
    if (isNumber(str2)) {
        str2 += EMPTY_STRING;
    }
    if (!str1 || !str2) {
        return false;
    }
    if (str1.includes) {
        return str1.includes(str2);
    }
    return str1.indexOf(str2) > -1;
}

function handlerURL(path, configs = {}) {
    for (const local in configs) {
        const obj = configs[local];
        if (!obj || !obj.target) {
            continue;
        }
        if (strContains(path, local)) {
            const { target } = obj;
            return path.replace(local, target);
        }
    }
    return EMPTY_STRING;
}

function loadSprite(options = {}) {
    return new Promise((resolve, reject) => {
        const { imgUrl, jsonUrl } = options;
        if (!imgUrl || !jsonUrl) {
            reject(new Error('not find imgUrl/jsonUrl from options'));
            console.error(options);
            return;
        }

        function getCtx(canvas, width, height) {
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            return ctx;
        }

        function parseSprite(json = {}, image) {
            const canvas = createCanvas();
            if (!canvas) {
                reject(new Error('can not create canvas'));
                return;
            }
            const icons = [];
            for (const name in json) {
                const spriteItem = json[name];
                icons.push({
                    name,
                    spriteItem
                });
            }
            const offscreenCanvas = createOffscreenCanvas();
            icons.forEach(icon => {
                const { name, spriteItem } = icon;
                const { x, y, width, height } = spriteItem;
                let resource;
                if (offscreenCanvas) {
                    const ctx = getCtx(offscreenCanvas, width, height);
                    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
                    resource = offscreenCanvas.transferToImageBitmap();
                } else {
                    const ctx = getCtx(canvas, width, height);
                    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
                    resource = canvas.toDataURL();
                }
                icon.resource = resource;
                ResouceProxy.addResource(name, resource);
            });
            resolve(icons);
        }

        Ajax.getJSON(jsonUrl, {}, (err, json) => {
            if (err) {
                reject(err);
                return;
            }
            const img = new Image();
            img.onload = () => {
                parseSprite(json, img);
            };
            img.onerror = (err) => {
                reject(err);
                return;
            };
            Ajax.getImage(img, imgUrl, {});
        });
    });
}

function loadSvgs(svgs) {
    return new Promise((resolve, reject) => {
        if (!svgs || svgs.length === 0) {
            reject(new Error('not find svgs'));
            return;
        }
        const result = [];

        const addToCache = (name, body) => {
            const paths = parseSVG(body);
            if (paths) {
                ResouceProxy.addResource(name, paths);
            }
            const data={
                name,
                paths,
                body: body
            }
            result.push(data);
        };
        //svg json collection
        if (isString(svgs)) {
            fetch(svgs).then(res => res.json()).then(json => {
                json.forEach(svg => {
                    const { name, body } = svg;
                    addToCache(name, body);
                });
                resolve(result);
            }).catch(err => {
                console.log(err);
                reject(err);
            });
            return;
        }
        //support svg symbols
        // https://developer.mozilla.org/en-US/docs/web/svg/element/symbol
        if (svgs instanceof NodeList) {
            for (let i = 0, len = svgs.length; i < len; i++) {
                const symbolNode = svgs[i];
                const name = symbolNode.id;
                const html = symbolNode.innerHTML;
                const body = `<xml><svg>${html}</svg></xml>`;
                if (name) {
                    addToCache(name, body);
                }
            }
            resolve(result);
        }
    });
}
/**
 * simple Resouce Proxy implementation
 *
 * https://www.webpackjs.com/configuration/dev-server/#devserverproxy
 */

// const { ResouceProxy, formatResouceUrl } = maptalks;
// function test1() {
//     ResouceProxy.proxy = {
//         '/geojson/': {
//             target: 'https://geo.datav.aliyun.com/areas_v3/bound/'
//         }
//     }
//     const url = formatResouceUrl('/geojson/350000_full.json');
//     console.log(url);
// }

// function test2() {
//     ResouceProxy.origin = {
//         'https://www.maptalks.com/': {
//             target: 'https://geo.datav.aliyun.com/areas_v3/'
//         }
//     }
//     const url = formatResouceUrl('https://www.maptalks.com/bound/350000_full.json');
//     console.log(url);
// }

// function test3() {
//     ResouceProxy.host = 'https://geo.datav.aliyun.com/areas_v3/bound'
//     const url = formatResouceUrl('/350000_full.json');
//     console.log(url);
// }

// function test4() {
//     const url = formatResouceUrl('./苏州.geojson');
//     console.log(url);
// }

export const ResouceProxy = {

    host: EMPTY_STRING,
    resources: {},
    proxy: {
        // '/api/': {
        //     target: 'https://www.maptalks.com/api/'
        // },
        // '/doc/': {
        //     target: 'https://www.maptalks.com/doc/'
        // }
    },
    origin: {
        // 'https://www.maptalks.com/api/': {
        //     target: 'https://www.deyihu.com/api/'
        // },
        // 'https://www.maptalks.com/doc/': {
        //     target: 'https://www.deyihu.com/doc/'
        // }
    },

    fromJSON(json) {
        try {
            if (isString(json)) {
                json = JSON.parse(json);
            }
            if (isObject(json)) {
                extend(ResouceProxy, json);
            }
        } catch (error) {
            console.error(error);
        }
    },
    toJSON() {
        return {
            host: ResouceProxy.host,
            proxy: extend({}, ResouceProxy.proxy || {}),
            origin: extend({}, ResouceProxy.origin || {})
        };
    },
    getResource(name) {

        return ResouceProxy.resources[name];

    },

    /**
     * remove resource
     * @param {String} name
     */
    removeResource(name) {
        delete ResouceProxy.resources[name];
    },

    /**
     * add resource
     * @param {String} name
     * @param {Object} res
     */
    addResource(name, res) {
        if (ResouceProxy.resources[name]) {
            console.warn(`${name} resource Already exists,the ${name} Cannot be added,the resource name Cannot repeat `);
            return;
        }
        ResouceProxy.resources[name] = res;
    },

    /**
    * update  resource (remove and add)
     * @param {String} name
     * @param {Object} res
     */
    updateResource(name, res) {
        ResouceProxy.resources[name] = res;
    },

    /**
     * get all resource [key,value]
     * @returns {Object} source
     */
    allResource() {
        return ResouceProxy.resources;
    },
    loadSprite,
    loadSvgs
};

export function formatResouceUrl(path) {
    if (isNumber(path)) {
        path += EMPTY_STRING;
    }
    if (!path) {
        console.error('resouce path is null,path:', path);
        return path;
    }
    if (!isString(path)) {
        return path;
    }
    if (isBase64URL(path) || isBlobURL(path)) {
        return path;
    }
    if (path[0] === '$') {
        return ResouceProxy.getResource(path.substring(1, Infinity)) || '';
    }
    const origin = ResouceProxy.origin || {};
    //is isAbsoluteURL
    const isAbsoluteURL = isURL(path);
    if (isAbsoluteURL && isObject(origin)) {
        const url = handlerURL(path, origin);
        if (url) {
            return url;
        }
        return path;
    }
    //relative URL
    const proxys = ResouceProxy.proxy || {};
    if (isObject(proxys)) {
        const url = handlerURL(path, proxys);
        if (url) {
            return url;
        }
    }
    const { host } = ResouceProxy;
    if (!isAbsoluteURL && host && isString(host)) {
        return `${host}${path}`;
    }
    return getAbsoluteURL(path);
}

