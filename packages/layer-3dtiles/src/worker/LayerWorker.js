import { Ajax, GLTFLoader } from '@maptalks/gltf-loader';
import { vec3, mat3, mat4 } from 'gl-matrix';
import B3DMLoader from '../loaders/B3DMLoader';
import I3DMLoader from '../loaders/I3DMLoader';
import CMPTLoader from '../loaders/CMPTLoader';
import PNTSLoader from '../loaders/PNTSLoader';
import { stringFromUTF8Array } from '../common/Util';
import { readMagic } from '../common/TileHelper';
import { cartesian3ToDegree } from '../common/Transform';
import { eastNorthUpToFixedFrame } from '../common/TileHelper';
import { iterateMesh, iterateBufferData } from '../common/GLTFHelpers';
/*import { I3SLoader } from '@loaders.gl/i3s';*/
// import { convertS3MJSON } from './parsers/s3m/S3MHelper';
// import parseS3M from './parsers/s3m/S3MParser';
import { isI3SURL, loadI3STile } from './parsers/i3s/I3SWorkerHelper';
import { project } from './Projection';

const Y_TO_Z = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
const X_TO_Z = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1];

const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

let supportOffscreenLoad = false;
let canvas, ctx;
if (typeof OffscreenCanvas !== 'undefined') {
    try {
        ctx = new OffscreenCanvas(2, 2).getContext('2d', { willReadFrequently: true });
    } catch (err) {
        // nothing need to do
    }
    if (ctx && typeof createImageBitmap !== 'undefined') {
        supportOffscreenLoad = true;
    }
}

const IDENTITY_MATRIX = mat4.identity([]);

const EMPTY_RTCCENTER = [0 ,0, 0];
const TMP_NODE_MATRIX = [];
const TMP_INV_MATRIX = [];

const TEMP_DEGREE = [];
const TEMP_PROJ = [];


export default class BaseLayerWorker {

    constructor(id, options, uploader, cb) {
        this.id = id;
        this.options = options;
        this._bindedRequestImage = this.requestImage.bind(this);
        this._uploader = uploader;
        this._requests = {};
        cb(null, {}, []);
    }

    _createLoaders(supportedFormats) {
        if (this._b3dmLoader) {
            return;
        }
        this._supportedFormats = supportedFormats;
        this._pntsLoader = new PNTSLoader();
        this._b3dmLoader = new B3DMLoader(this._bindedRequestImage, GLTFLoader, supportedFormats);
        this._i3dmLoader = new I3DMLoader(this._bindedRequestImage, GLTFLoader, supportedFormats);
    }

    requestImage(url, cb) {
        if (supportOffscreenLoad) {
            // cb(null, { width : 2, height : 2, data : new Uint8Array(4) });
            fetch(url)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    const blob = new self.Blob([new Uint8Array(buffer)]);
                    return createImageBitmap(blob);
                })
                .then(bitmap => {
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    ctx.drawImage(bitmap, 0, 0);
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    bitmap.close();
                    // debugger
                    cb(null, { width : bitmap.width, height : bitmap.height, data : new Uint8Array(imgData.data) });
                });
        } else {
            this._uploader('requestImage', { url }, null, cb);
        }
    }

    /**
     * Load content of a 3d tile, maybe a tileset json or a b3dm binary
     * @param {Object} params  - mapid, layerid, url, arraybuffer
     * @param {Function} cb - callback function when finished
     */
    loadTile(params, cb) {
        this._createLoaders(params.supportedFormats);
        const url = params.url,
            arraybuffer = params.arraybuffer;
        if (isI3SURL(url)) {
            const i3sInfo = params.i3sInfo;
            const maxTextureSize = this.options.services[params.rootIdx].maxTextureSize || 1024;
            const promise = loadI3STile(i3sInfo, params.supportedFormats, this.options.projection, maxTextureSize);
            promise.then(i3sData => {
                delete this._requests[url];
                if (!i3sData) {
                    cb({ status: 404, url, i3sInfo });
                    return;
                }
                if (!Object.keys(i3sData.gltf.meshes).length) {
                    // gltf中的mesh不存在
                    cb({ status: 404, url, i3sInfo });
                    return;
                }
                i3sData.gltf.url = url;
                const { transferables } = i3sData;
                i3sData.magic = 'b3dm';
                cb(null, i3sData, transferables);
            });
            this._requests[url] = promise.xhr;
            return;
        }
        if (arraybuffer) {
            delete this._requests[url];
            const view = new DataView(arraybuffer);
            const magic = readMagic(view, 0);
            if (magic[0] === '{' || magic[0] === ' ' || magic[0] === '<') {
                // '{' 或空格 ' ', 表明是个json文件
                const str = readString(arraybuffer, 0, arraybuffer.byteLength);
                const json = JSON.parse(str);
                this._checkAndConvert(params.rootIdx, json, arraybuffer, url, cb);
                // if (magic[0] === '<') {
                //     try {
                //         const json = this._checkAndConvertS3MXML(str);
                //         cb(null, json);
                //     } catch (err) {
                //         cb(url + '\nEror when parsing xml:\n' + err);
                //     }

                // } else {
                //     let json = JSON.parse(str);
                //     json = this._checkAndConvert(json);
                //     cb(null, json);
                // }

            } else {
                // if (url.indexOf('Tile_-12985_43517_0000.s3mb') < 0) {
                //     cb('ignore');
                //     return;
                // }
                // const s3mVersion = view.getFloat32(0, true);
                // if (s3mVersion === 1 || s3mVersion === 2 || s3mVersion === 3) {
                //     this._readS3M(arraybuffer, url, params, cb);
                // } else {
                //     this._read3DTile(arraybuffer, url, params, magic, cb);
                // }
                this._read3DTile(arraybuffer, url, params, magic, cb);
            }
        } else {
            const service = this.options.services[params.rootIdx];
            let urlParams = service['urlParams'];
            if (urlParams) {
                urlParams = (url.indexOf('?') > 0 ? '&' : '?') + urlParams;
            }
            const requrl = url.replace(/\+/g, '%2B');
            let promise = Ajax.getArrayBuffer(requrl + (urlParams || ''), service['fetchOptions']);
            const xhr = promise.xhr;
            promise = promise.then(data => {
                delete this._requests[url];
                if (data && data.status) {
                    cb(data)
                    return;
                }
                params.arraybuffer = data && data.data;
                this.loadTile(params, cb);
            }).catch(err => {
                delete this._requests[url];
                cb(err);
            });
            this._requests[url] = xhr;
        }
    }


    _read3DTile(arraybuffer, url, params, magic, cb) {
        const service = this.options.services[params.rootIdx];
        if (magic === 'b3dm') {
            const promise = this._b3dmLoader.load(url, arraybuffer, 0, 0, { maxTextureSize: service.maxTextureSize || 1024 });
            promise.then(tile => {
                if (tile.error) {
                    cb(tile);
                    return;
                }
                const { content, transferables } = this._processB3DM(tile, params);
                cb(null, content, transferables);
            }).catch(err => {
                cb(err);
            });
        } else if (magic === 'pnts') {
            const transform = params.transform;
            const promise = this._pntsLoader.load(url, arraybuffer);
            promise.then(tile => {
                const { content:pnts, transferables } = this._loadI3DMAndPNTS(tile, transform, params.rootIdx);
                cb(null, pnts, transferables);
            });
        } else if (magic === 'i3dm') {
            const transform = params.transform;
            const promise =  this._i3dmLoader.load(url, arraybuffer, 0, 0, { maxTextureSize: service.maxTextureSize || 1024 });
            promise.then(tile => {
                const { content:i3dm, transferables } = this._loadI3DMAndPNTS(tile, transform, params.rootIdx);
                cb(null, i3dm, transferables);
            });
        } else if (magic === 'cmpt') {
            const promise = new CMPTLoader(this._bindedRequestImage, GLTFLoader, this._supportedFormats, service.maxTextureSize || 1024).load(url, arraybuffer, 0, 0, { maxTextureSize: service.maxTextureSize || 1024 });
            promise.then(tile => {
                const { content: cmpt, transferables } = this._processCMPT(tile, params);
                cb(null, cmpt, transferables);
            }).catch(err => {
                cb(err);
            });
        }
    }

    // _readS3M(arraybuffer, url, params, cb) {
    //     // const view = new DataView(arraybuffer);
    //     // let bytesOffset = 0;
    //     // const version = view.getFloat32(bytesOffset, true);
    //     // bytesOffset += Float32Array.BYTES_PER_ELEMENT;
    //     // if(version >= 2.0) {
    //     //     // const unzipSize = view.getUint32(bytesOffset, true);
    //     //     bytesOffset += Uint32Array.BYTES_PER_ELEMENT;
    //     // }

    //     // // const byteSize = view.getUint32(bytesOffset, true);
    //     // bytesOffset += Uint32Array.BYTES_PER_ELEMENT;
    //     // const unzipBuffer = unZip(arraybuffer, bytesOffset);
    //     const service = this.options.services[params.rootIdx];
    //     parseS3M({ buffer: arraybuffer, bytesOffset: 0 }, service.maxTextureSize || 1024).then(s3mData => {
    //         s3mData.gltf.url = url;
    //         const { content, transferables } = this._processB3DM(s3mData, params);
    //         content.magic = 'b3dm';
    //         if (s3mData.pageLods) {
    //             const children = this._convertPageLoads(s3mData.pageLods);
    //             if (children.length) {
    //                 content.children = children;
    //             }
    //         }
    //         cb(null, content, transferables);
    //     });

    // }

    _convertPageLoads(pageLods) {
        const children = [];
        for (let i = 0; i < pageLods.length; i++) {
            const pageLod = pageLods[i];
            if(!pageLod.childTile) {
                continue;
            }
            // var childResource = resource.getDerivedResource({
            //     url: pageLod.childTile
            // });

            const childTileJson = {
                boundingVolume: {
                    sphere: [pageLod.boundingSphere.center.x, pageLod.boundingSphere.center.y, pageLod.boundingSphere.center.z, pageLod.boundingSphere.radius]
                },
                content: {
                    uri: pageLod.childTile
                },
                geometricError: pageLod.boundingSphere.radius / pageLod.rangeList * 16,
                refine: "REPLACE"
            };
            children.push(childTileJson);
            // var childTile = new Cesium3DTile(tile.tileset, childResource, childTileJson, tile);
        }
        return children;
    }

    _checkAndConvert(rootIdx, json, arraybuffer, url, cb) {
        /*if (json.dataType && json.position) {
            // S3M
            cb(null, convertS3MJSON(json));
            return;
        } else */
        if (json.capabilities) {
            cb(null, json);
            // parseI3SJSON(json, url, rootIdx, this._i3sNodeCache[rootIdx], this._fnFetchNodepages).then(tileset => {
            //     cb(null, tileset);
            // });
            return;
        } else {
            cb(null, json);
            return;
        }
    }


    // _checkAndConvertS3MXML(xmlSource) {
    //     return convertS3MXML(xmlSource);
    // }


    _processCMPT(tile, params) {
        const { tiles } = tile;
        const cmpt = { magic: 'cmpt', content: [] };
        const tileTransferables = [];
        for (let i = 0; i < tiles.length; i++) {
            const { magic } = tiles[i];
            if (magic === 'b3dm') {
                const { content, transferables } = this._processB3DM(tiles[i], params);
                pushTransferables(tileTransferables, transferables);
                cmpt.content.push(content);
            } else if (magic === 'i3dm' || magic === 'pnts') {
                const { transform, rootIdx } = params;
                const { content, transferables } = this._loadI3DMAndPNTS(tiles[i], transform, rootIdx);
                pushTransferables(tileTransferables, transferables);
                cmpt.content.push(content);
            } else if (magic === 'cmpt') {
                const { content, transferables } = this._processCMPT(tiles[i], params);
                pushTransferables(tileTransferables, transferables);
                cmpt.content.push(content);
            }
        }
        return {
            content: cmpt,
            transferables: tileTransferables
        };
    }

    _processB3DM(b3dm, params) {
        const { gltf, transferables, featureTable } = b3dm;
        const isSharePosition = ifSharingPosition(gltf);
        this._markTextures(b3dm.gltf);
        if (!b3dm.gltf.asset) {
            b3dm.gltf.asset = {};
        }
        if (!isSharePosition) {
            this._projectCoordinates(gltf, featureTable, params.upAxis, params.transform);
        } else {
            // 如果position是共享的，不能用把坐标转为投影坐标的方式载入，还是只能用basisTo2D的方式载入
            b3dm.gltf.asset.sharePosition = true;
            this._convertCoordinates(gltf, featureTable, params.upAxis, params.transform);
        }

        delete b3dm.transferables;
        return {
            content: b3dm, transferables
        };
    }

    _loadI3DMAndPNTS(content, transform, rootIdx) {
        const { featureTable } = content;
        const data = content.pnts || content.i3dm;
        const rtcCenter = featureTable && featureTable['RTC_CENTER'] || [0, 0, 0];

        if (featureTable['EAST_NORTH_UP'] && !data['NORMAL_UP'] && !data['NORMAL_UP_OCT32P']) {
            // 3 * 3 rotation matrix
            const instanceRotation = new Float32Array(data.POSITION.array.length * 3);
            const vertexRotMat = [];
            const vertexRotMa3 = [];
            const v = [];
            // create east north up normals
            iterateBufferData(data.POSITION, (vertex, idx) => {
                vec3.add(v, vertex, rtcCenter);
                eastNorthUpToFixedFrame(
                    v,
                    null,
                    vertexRotMat
                );
                mat3.fromMat4(vertexRotMa3, vertexRotMat);
                const vertexMat3 = instanceRotation.subarray(idx * 9, (idx + 1) * 9);
                mat3.copy(vertexMat3, vertexRotMa3);
            });
            data['INSTANCE_ROTATION'] = {
                byteStride: 0,
                byteOffset: 0,
                itemSize: 9,
                componentType: 5126,
                array: instanceRotation
            };
            content.transferables.push(instanceRotation.buffer);
        }

        const minmax = {
            xmin: Infinity,
            xmax: -Infinity,
            ymin: Infinity,
            ymax: -Infinity,
            hmin: Infinity,
            hmax: -Infinity
        };
        findMinMaxOfPosition(data.POSITION.array, 3, rtcCenter, IDENTITY_MATRIX, minmax);
        const modelCenter = getCenterOfMinMax(minmax);
        const newRtcCenter = vec3.copy([], modelCenter);
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        iterateBufferData(data.POSITION, (vertex) => {
            vertex[0] = vertex[0] + rtcCenter[0] - newRtcCenter[0];
            vertex[1] = vertex[1] + rtcCenter[1] - newRtcCenter[1];
            vertex[2] = vertex[2] + rtcCenter[2] - newRtcCenter[2];
            if (vertex[0] < min[0]) min[0] = vertex[0];
            if (vertex[1] < min[1]) min[1] = vertex[1];
            if (vertex[2] < min[2]) min[2] = vertex[2];
            if (vertex[0] > max[0]) max[0] = vertex[0];
            if (vertex[1] > max[1]) max[1] = vertex[1];
            if (vertex[2] > max[2]) max[2] = vertex[2];
        });
        data.POSITION.min = min;
        data.POSITION.max = max;

        if (transform) {
            vec3.transformMat4(modelCenter, modelCenter, transform);
        }

        const rtcCoord = this._getCoordiate(modelCenter);

        content.rtcCenter = newRtcCenter;
        // content.instanceCenter = modelCenter;
        content.rtcCoord = rtcCoord;
        content.rootIdx = rootIdx;
        const transferables = content.transferables;
        delete content.transferables;
        return {
            content,
            transferables
        };
    }

    // 把纯色的纹理转换成color值，减少纹理读取
    _markTextures(gltf) {
        if (!Array.isArray(gltf.textures)) {
            return;
        }
        const textures = gltf.textures;
        for (let i = 0; i < textures.length; i++) {
            const arr = textures[i].image && textures[i].image.array;
            // arr有可能是ImageBitmap
            if (arr && arr.length) {
                const r = arr[0];
                const g = arr[1];
                const b = arr[2];
                const a = arr[3];
                let isColor = true;
                for (let j = 4; j < arr.length; j += 4) {
                    if (arr[j] !== r || arr[j + 1] !== g || arr[j + 2] !== b || arr[j + 3] !== a) {
                        isColor = false;
                        break;
                    }
                }
                if (isColor) {
                    textures[i].image.color = [r / 255, g / 255, b / 255, a / 255];
                    delete textures[i].image.array;
                }
            }
        }
    }

    abortTileLoading(params, cb) {
        const xhr = this._requests[params.url];
        if (Array.isArray(xhr)) {
            for (let i = 0; i < xhr.length; i++) {
                xhr[i].abort();
            }
        } else if (xhr && xhr.abort) {
            xhr.abort();
        }
        delete this._requests[params.url];
        cb(null);
    }

    _getModelCenter(gltf, featureTable, upAxis, transform) {
        const rtcCenter = featureTable && featureTable['RTC_CENTER'] || gltf.extensions && gltf.extensions['CESIUM_RTC'] && gltf.extensions['CESIUM_RTC'].center;
        let upAxisTransform = Y_TO_Z;
        upAxis = upAxis && upAxis.toUpperCase();
        if (upAxis === 'X') {
            upAxisTransform = X_TO_Z;
        } else if (upAxis === 'Z') {
            upAxisTransform = IDENTITY_MATRIX;
        }
        gltf.extensions = gltf.extensions || {};
        if (!gltf.extensions['CESIUM_RTC']) {
            gltf.extensions['CESIUM_RTC'] = {};
        }
        if (rtcCenter) {
            gltf.extensions['CESIUM_RTC'].center = rtcCenter;
        }
        gltf.extensions['MAPTALKS_RTC'] = {};
        const minmax = {
            xmin: Infinity,
            xmax: -Infinity,
            ymin: Infinity,
            ymax: -Infinity,
            hmin: Infinity,
            hmax: -Infinity
        };
        // 因为一些模型的 rtcCenter 距离真正的中心点距离很远，不能用来计算二维偏转矩阵，故仍需遍历模型，计算中心点坐标
        iterateMesh(gltf, mesh => {
            const position = mesh.attributes && mesh.attributes['POSITION'];
            if (!position) {
                return;
            }
            const nodeMatrix = mat4.identity(TMP_NODE_MATRIX);
            if (mesh.matrices) {
                getNodeMatrix(nodeMatrix, mesh.matrices);
            }
            const arr = mesh.attributes['POSITION'].array;
            const itemSize = mesh.attributes['POSITION'].itemSize;
            mat4.multiply(nodeMatrix, upAxisTransform, nodeMatrix);
            if (transform) {
                mat4.multiply(nodeMatrix, transform, nodeMatrix);
            }
            findMinMaxOfPosition(arr, itemSize, rtcCenter || EMPTY_RTCCENTER, nodeMatrix, minmax, mesh.compressUniforms);
        });
        const modelCenter = getCenterOfMinMax(minmax);
        return {
            rtcCenter,
            modelCenter,
            upAxisTransform
        };
    }

    /**
     * Convert coordinates from Cesium ECEF to maptalks world 2d
     * @param {Object} gltf
     */
    _convertCoordinates(gltf, featureTable, upAxis, transform) {
        const { modelCenter, upAxisTransform, rtcCenter } = this._getModelCenter(gltf, featureTable, upAxis);
        const newRtcCenter = vec3.copy([], modelCenter);

        if (transform) {
            vec3.transformMat4(modelCenter, modelCenter, transform);
        }

        gltf.extensions['CESIUM_RTC'].rtcCoord = this._getCoordiate(modelCenter);

        if (!rtcCenter) {
            // 没有 rtcCenter 时，需要自己计算一个rtcCenter，否则模型无法正确绘制
            iterateMesh(gltf, primitive => {
                if (primitive.attributes && primitive.attributes['POSITION']) {
                    const vertices = primitive.attributes['POSITION'];
                    if (vertices.array.buffer.projected && vertices.array.buffer.projected[vertices.byteOffset]) {
                        return;
                    }
                    const nodeMatrix = mat4.identity(TMP_NODE_MATRIX);
                    if (primitive.matrices) {
                        getNodeMatrix(nodeMatrix, primitive.matrices);
                    }
                    mat4.multiply(nodeMatrix, upAxisTransform, nodeMatrix);
                    const invNodeMat = mat4.invert(TMP_INV_MATRIX, nodeMatrix);

                    // 根据规范定义：
                    // 新的端点值等于 (vertex * nodeMatrix + rtcCenter - newRtcCenter) * invNodeMatrix
                    // https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/Batched3DModel#coordinate-system
                    const min = [Infinity, Infinity, Infinity];
                    const max = [-Infinity, -Infinity, -Infinity];
                    iterateBufferData(vertices, (vertex) => {
                        vec3.transformMat4(vertex, vertex, nodeMatrix);
                        vertex[0] = vertex[0] - newRtcCenter[0];
                        vertex[1] = vertex[1] - newRtcCenter[1];
                        vertex[2] = vertex[2] - newRtcCenter[2];
                        vec3.transformMat4(vertex, vertex, invNodeMat);
                        if (vertex[0] < min[0]) min[0] = vertex[0];
                        if (vertex[1] < min[1]) min[1] = vertex[1];
                        if (vertex[2] < min[2]) min[2] = vertex[2];
                        if (vertex[0] > max[0]) max[0] = vertex[0];
                        if (vertex[1] > max[1]) max[1] = vertex[1];
                        if (vertex[2] > max[2]) max[2] = vertex[2];
                    });
                    vertices.min = min;
                    vertices.max = max;
                    if (!vertices.array.buffer.projected) {
                        vertices.array.buffer.projected = {};
                    }
                    vertices.array.buffer.projected[vertices.byteOffset] = 1;
                }
            });
            gltf.extensions['CESIUM_RTC'].center = newRtcCenter;
        }
    }

    /**
     * Convert coordinates from Cesium ECEF to maptalks world 2d
     * @param {Object} gltf
     */
    _projectCoordinates(gltf, featureTable, upAxis, transform) {
        const { modelCenter: center, rtcCenter } = this._getModelCenter(gltf, featureTable, upAxis, transform);
        const projCenter = this._getProjCenter(center);
        // gltf.extensions['CESIUM_RTC'] = { center, projCenter };
        gltf.extensions['MAPTALKS_RTC'].projCenter = projCenter;
        gltf.extensions['CESIUM_RTC'].rtcCoord = this._getCoordiate(center);

        iterateMesh(gltf, primitive => {
            if (primitive.attributes && primitive.attributes['POSITION']) {
                if (primitive.attributes['NORMAL']) {
                    this._transformNormalOrTangent(primitive.attributes['NORMAL'], primitive.matrices, upAxis);
                }
                if (primitive.attributes['TANGENT']) {
                    this._transformNormalOrTangent(primitive.attributes['TANGENT'], primitive.matrices, upAxis);
                }
                // debugger
                const { newPositions } = this._projVertices(primitive.attributes['POSITION'], primitive.matrices, rtcCenter, gltf.extensions['MAPTALKS_RTC'], upAxis, transform, primitive.compressUniforms);
                const { componentType } = primitive.attributes['POSITION'];
                if (componentType !== 5126) {
                    primitive.attributes['POSITION'].array = new Float32Array(newPositions);
                }
            }
        });

        // node的matrix已经在projVertices时都计算到新的端点值中了
        // 所以这里都重置为identity matrix
        for (const p in gltf.nodes) {
            const node = gltf.nodes[p];
            node.matrix = IDENTITY_MATRIX;
        }
    }

    _getProjCenter(center) {

        if (vec3.len(center) === 0) {
            vec3.set(TEMP_DEGREE, 0, 0, -6378137);
        } else {
            cartesian3ToDegree(TEMP_DEGREE, center);
        }
        const projection = this.options['projection'];
        project(TEMP_PROJ, TEMP_DEGREE, projection);
        // const height = center.length > 2 ? projMeter(TEMP_DEGREE, TEMP_PROJ, TEMP_DEGREE[2], projection) : 0;
        const height = TEMP_DEGREE[2];
        const projCenter = [];
        projCenter[0] = TEMP_PROJ[0];
        projCenter[1] = TEMP_PROJ[1];
        projCenter[2] = height;
        return projCenter;
    }

    _transformNormalOrTangent(datas, matrices, upAxis) {
        let matrix;
        if (upAxis === 'Y') {
            matrix = Y_TO_Z;
        } else if (upAxis === 'X') {
            matrix = X_TO_Z;
        } else {
            matrix = IDENTITY_MATRIX;
        }
        const m = mat4.copy([], matrix);
        getNodeMatrix(m, matrices);
        if (mat4.exactEquals(m, IDENTITY_MATRIX)) {
            return;
        }
        const normalMatrix = mat3.fromMat4([], m);
        const n = [];
        iterateBufferData(datas, (item) => {
            vec3.transformMat3(n, item, normalMatrix);
            vec3.normalize(n, n);
            vec3.copy(item, n);
            return n;
        });
    }

    _projVertices(vertices, matrices, rtcCenter, maptalksRTC, upAxis, transform, compressUniforms) {
        // 多个primitive可能共享同一个POSITION，此时只需要遍历一次
        // 例子: Batched/BatchedColors
        if (vertices.array.buffer.projected && vertices.array.buffer.projected[vertices.byteOffset]) {
            return null;
        }
        const nodeMatrix = mat4.identity([]);
        getNodeMatrix(nodeMatrix, matrices);
        const projection = this.options['projection'];
        upAxis = upAxis && upAxis.toUpperCase();
        const cesiumCenter = rtcCenter;
        // const maptalksCenter = maptalksRTC && maptalksRTC.center;
        let upAxisTransform = null;
        if (upAxis === 'Y') {
            upAxisTransform = Y_TO_Z;
        } else if (upAxis === 'X') {
            upAxisTransform = X_TO_Z;
        }
        // upAxisTransform = Y_UP_TO_Z_UP;

        let cartesian = [0, 0, 0, 1];
        const degree = [0, 0, 0],
            proj = [0, 0];
        const projCenter = maptalksRTC.projCenter;

        const isTransformIdentity = transform && mat4.exactEquals(IDENTITY_MATRIX, transform);
        // debugger
        // let projPosition = new Array(array.length);
        // let max = 0;
        const min = vertices.min = vertices.min || [];
        const max = vertices.max = vertices.max || [];
        vec3.set(min, Infinity, Infinity, Infinity);
        vec3.set(max, -Infinity, -Infinity, -Infinity);
        const uniforms = compressUniforms || {};
        const { decode_position_min, decode_position_normConstant } = uniforms;
        let pos_min = [0, 0, 0, 0], pos_normConstant = 1;
        if (decode_position_min) {
            pos_min = decode_position_min;
        }
        if (decode_position_normConstant) {
            pos_normConstant = decode_position_normConstant;
        }
        const newPositions = [];
        iterateBufferData(vertices, (vertex) => {
            cartesian[0] = vertex[0] * pos_normConstant + pos_min[0];
            cartesian[1] = vertex[1] * pos_normConstant + pos_min[1];
            cartesian[2] = vertex[2] * pos_normConstant + pos_min[2];

            cartesian = vec3.transformMat4(cartesian, cartesian, nodeMatrix);

            if (upAxisTransform) {
                cartesian = vec3.transformMat4(cartesian, cartesian, upAxisTransform);
            }

            if (cesiumCenter) {
                vec3.add(cartesian, cartesian, cesiumCenter);
            }

            if (transform && !isTransformIdentity) {
                cartesian = vec3.transformMat4(cartesian, cartesian, transform);
            }

            if (vec3.len(cartesian) === 0) {
                vec3.set(degree, 0, 0, -6378137);
            } else {
                cartesian3ToDegree(degree, cartesian);
            }
            project(proj, degree, projection);
            // height = cartesian[2] ? projMeter(degree, proj, degree[2], projection) : 0;

            if (vertex instanceof Float32Array) {
                vertex[0] = proj[0] - projCenter[0];
                vertex[1] = proj[1] - projCenter[1];
                vertex[2] = degree[2] - projCenter[2];
            } else {
                const x = proj[0] - projCenter[0];
                const y = proj[1] - projCenter[1];
                const z = degree[2] - projCenter[2];
                newPositions.push(x);
                newPositions.push(y);
                newPositions.push(z);
                newPositions.push(vertex[3]);
            }
            // array[i] = proj[0];
            // array[i + 1] = proj[1];
            // if (itemSize > 2) {
            //     array[i + 2] = height;
            // }
            if (vertex[0] < min[0]) {
                min[0] = vertex[0];
            }
            if (vertex[1] < min[1]) {
                min[1] = vertex[1];
            }
            if (vertex[2] < min[2]) {
                min[2] = vertex[2];
            }

            if (vertex[0] > max[0]) {
                max[0] = vertex[0];
            }
            if (vertex[1] > max[1]) {
                max[1] = vertex[1];
            }
            if (vertex[2] > max[2]) {
                max[2] = vertex[2];
            }
            return vertex;
        });
        if (!vertices.array.buffer.projected) {
            vertices.array.buffer.projected = {};
        }
        vertices.array.buffer.projected[vertices.byteOffset] = 1;
        //TODO 100适用于3857和baidu投影，4326投影需要选用别的值
        // const ArrayType = getPosArrayType(max * 100);
        // projPosition = new ArrayType(projPosition);
        return {
            projCenter,
            newPositions
        };
    }

    _getCoordiate(cart3) {
        if (vec3.len(cart3) === 0) {
            return vec3.set([], 0, 0, -6378137);
        } else {
            return cartesian3ToDegree([], cart3);
        }
    }

    onRemove() {
        //nothing need to do now
    }
}

function readString(buffer, offset, length) {
    if (textDecoder) {
        const arr = new Uint8Array(buffer, offset, length);
        return textDecoder.decode(arr);
    } else {
        const arr = new Uint8Array(buffer, offset, length);
        return stringFromUTF8Array(arr);
    }
}

// function convertStrideArr(buffer, byteOffset, stride, itemSize, count, componentType) {
//     const ctor = GLTFLoader.getTypedArrayCtor(componentType);
//     const newArr = new ctor(count * itemSize);
//     return GLTFLoader.readInterleavedArray(newArr, buffer, count, itemSize, stride, byteOffset, componentType);
// }

const vertex = [];
function findMinMaxOfPosition(arr, itemSize, rtcCenter, nodeMatrix, minmax, compressUniforms) {
    const uniforms = compressUniforms || {};
    const { decode_position_min, decode_position_normConstant } = uniforms;
    let pos_min = [0, 0, 0, 0], pos_normConstant = 1;
    if (decode_position_min) {
        pos_min = decode_position_min;
    }
    if (decode_position_normConstant) {
        pos_normConstant = decode_position_normConstant;
    }
    for (let i = 0, l = arr.length; i < l; i += itemSize) {
        const { xmin, ymin, xmax, ymax, hmin, hmax } = minmax;

        vec3.set(vertex, arr[i] * pos_normConstant + pos_min[0], arr[i + 1] * pos_normConstant + pos_min[1], arr[i + 2] * pos_normConstant + pos_min[2]);

        vec3.transformMat4(vertex, vertex, nodeMatrix);
        const array = vec3.add(vertex, rtcCenter, vertex);
        if (array[0] < xmin) {
            minmax.xmin = array[0];
        }
        if (array[0] > xmax) {
            minmax.xmax = array[0];
        }
        if (array[1] < ymin) {
            minmax.ymin = array[1];
        }
        if (array[1] > ymax) {
            minmax.ymax = array[1];
        }
        if (itemSize > 2) {
            if (array[2] < hmin) {
                minmax.hmin = array[2];
            }
            if (array[2] > hmax) {
                minmax.hmax = array[2];
            }
        }
    }
}

function getCenterOfMinMax(minmax) {
    const { xmax, ymax, xmin, ymin, hmin, hmax} = minmax;
    const center = [(xmin + xmax) / 2, (ymin + ymax) / 2, (hmin + hmax) / 2];
    if (xmax === -Infinity) {
        center[0] = 0;
    }
    if (ymax === -Infinity) {
        center[1] = 0;
    }
    if (hmax === -Infinity) {
        center[2] = 0;
    }
    // console.log(xmin, xmax, ymin, ymax, hmin, hmax);
    // const pos = gltf.meshes[0].primitives[0].attributes['POSITION'];
    // console.log(pos.min, pos.max);
    if (isNaN(center[2])) {
        center[2] = 0;
    }
    return center;
}

function pushTransferables(target, src) {
    for (let i = 0; i < src.length; i++) {
        if (target.indexOf(src[i]) < 0) {
            target.push(src[i]);
        }
    }
}

function ifSharingPosition(gltf) {
    if (!gltf || !gltf.meshes) {
        return false;
    }
    const visitStamp = 'visited';
    let visitId = 1;
    const buffers = [];
    for (const i in gltf.meshes) {
        const mesh = gltf.meshes[i];
        const { primitives } = mesh;
        if (!primitives) {
            continue;
        }
        for (let j = 0; j < primitives.length; j++) {
            const position = primitives[j].attributes && primitives[j].attributes['POSITION'];
            if (!position || !position.array) {
                continue;
            }
            if (!position.array.buffer[visitStamp]) {
                position.array.buffer[visitStamp] = visitId++;
            }
            const key = (visitId - 1) + '-' + (position.byteOffset || 0);
            if (buffers.indexOf(key) >= 0) {
                return true;
            }
            buffers.push(key);
        }
    }
    return false;
}

function getNodeMatrix(out, matrices) {
    // const nodeMatrix = mat4.identity(out);
    const nodeMatrix = out;
    // for (let i = 0; i < matrices.length; i++) {
    for (let i = matrices.length - 1; i >= 0; i--) {
        mat4.multiply(nodeMatrix, matrices[i], nodeMatrix);
    }
    return nodeMatrix;
}