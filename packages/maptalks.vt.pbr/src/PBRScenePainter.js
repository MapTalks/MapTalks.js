import { reshader } from '@maptalks/gl';
import { mat4 } from '@maptalks/gl';
import { extend } from './Util';
import VSMShadowPass from './VSMShadowPass.js';
import StencilShadowPass from './StencilShadowPass.js';

class PBRScenePainter {
    constructor(regl, layer, sceneConfig) {
        this.layer = layer;
        this.regl = regl;
        this.sceneConfig = sceneConfig || {};
        if (!this.sceneConfig.lights) {
            this.sceneConfig.lights = {};
        }
        this._redraw = false;
        this.meshCache = {};
        this.loader = new reshader.ResourceLoader(regl.texture(2));
        this.hdr = null;
        this.loader.on('complete', () => {
            if (this.hdr && this.hdr.isReady() && !this._isIBLRecreated) {
                //环境光纹理载入，重新生成ibl纹理
                this.iblMaps = this._createIBLMaps(this.hdr);
                this._isIBLRecreated = true;
            }
            this._redraw = true;
        });
        this._init();
    }

    needToRedraw() {
        return this._redraw;
    }

    createGeometry(glData, features) {
        const data = {
            aPosition : glData.vertices,
            aTexCoord : glData.uvs,
            aNormal : glData.normals,
            aColor : glData.colors,
            aPickingId : glData.featureIndexes
        };
        const geometry = new reshader.Geometry(data, glData.indices);
        geometry._pbrFeatures = features;
        geometry.generateBuffers(this.regl);

        if (glData.shadowVolume && this.shadowPass && this.shadowPass.createShadowVolume) {
            const shadowGeos = this.shadowPass.createShadowVolume(glData.shadowVolume);
            geometry.shadow = shadowGeos;
        }

        return geometry;
    }

    addMesh(key, geometry, transform) {
        const mesh = new reshader.Mesh(geometry, this.material);
        mesh.setLocalTransform(transform);
        this.meshCache[key] = mesh;
        this.scene.addMesh(mesh);
        if (this.shadowScene) {
            // 如果shadow mesh已经存在， 则优先用它
            const shadowMesh = geometry.shadow || mesh;
            if (shadowMesh !== mesh) {
                shadowMesh.forEach(m => m.setLocalTransform(transform));
            }
            this.shadowScene.addMesh(shadowMesh);
        }
        return mesh;
    }

    paint() {
        this._redraw = false;
        const layer = this.layer;
        const map = layer.getMap();
        if (!map) {
            return {
                redraw : false
            };
        }

        const uniforms = this._getUniformValues(map);

        if (this.shadowPass) {
            this._transformGround(layer);
            const { fbo } = this.shadowPass.pass1({
                layer,
                uniforms,
                scene : this.shadowScene,
                groundScene : this.groundScene
            });
            if (this.sceneConfig.shadow.debug) {
                // this.debugFBO(shadowConfig.debug[0], depthFBO);
                this.debugFBO(this.sceneConfig.shadow.debug[1], fbo);
            }
        }

        this.renderer.render(this.shader, uniforms, this.scene);

        if (this.shadowPass) {
            this.shadowPass.pass2();
        }

        this._pickingRendered = false;

        return {
            redraw : false
        };
    }

    pick(x, y) {
        const map = this.layer.getMap();
        const uniforms = this._getUniformValues(map);
        if (!this._pickingRendered) {
            this._raypicking.render(this.scene.getMeshes().opaques, uniforms);
            this._pickingRendered = true;
        }
        const { meshId, pickingId, point } = this._raypicking.pick(x, y, uniforms, {
            viewMatrix : map.viewMatrix,
            projMatrix : map.projMatrix,
            returnPoint : true
        });
        if (meshId === null) {
            return {
                feature : null,
                point
            };
        }
        return {
            feature : this._raypicking.getMeshAt(meshId).geometry._pbrFeatures[pickingId],
            point
        };

        // const lookat = map.cameraLookAt;
        // console.log('lookat', lookat);
        // let h = [];
        // console.log(vec4.transformMat4(h, lookat.concat(1), map.projViewMatrix));

        // const w2 = map.width / 2 || 1, h2 = map.height / 2 || 1;
        // x = w2;
        // y = h2;
        // const cp0 = [], cp1 = [];
        // vec4.set(cp0, (x - w2) / w2, (h2 - y) / h2, 0, 1);
        // vec4.set(cp1, (x - w2) / w2, (h2 - y) / h2, 1, 1);
        // const inverseProjMatrix = mat4.invert([], map.projMatrix);
        // const vcp0 = [], vcp1 = [];
        // applyMatrix(vcp0, cp0, inverseProjMatrix);
        // applyMatrix(vcp1, cp1, inverseProjMatrix);
        // const n = -vcp0[2], f = -vcp1[2];
        // const t = (h[3] - n) / (f - n);

        // const inverseProjViewMatrix = mat4.invert([], map.projViewMatrix);
        // const near = applyMatrix(cp0, cp0, inverseProjViewMatrix),
        //     far = applyMatrix(cp1, cp1, inverseProjViewMatrix);
        // const result = [interpolate(near[0], far[0], t), interpolate(near[1], far[1], t), interpolate(near[2], far[2], t)];
        // console.log(result);
        // this.debugFBO('shadow', this.layer.getRenderer().pickingFBO);
    }

    updateSceneConfig(config) {
        const keys = Object.keys(config);
        if (keys.length === 1 && keys[0] === 'material') {
            this.sceneConfig.material = config.material;
            this._updateMaterial();
        } else {
            extend(this.sceneConfig, config);
            this._init();
            this._redraw = true;
        }
    }

    getMesh(key) {
        return this.meshCache[key];
    }

    delete(key) {
        const mesh = this.meshCache[key];
        if (mesh) {
            const geometry = mesh.geometry;
            geometry.dispose();
            mesh.dispose();
            delete this.meshCache[key];
        }
    }

    clear() {
        this.meshCache = {};
        this.scene.clear();
        if (this.shadowScene) {
            this.shadowScene.clear();
            this.shadowScene.addMesh(this.ground);
        }
    }

    remove() {
        delete this.meshCache;
        this.material.dispose();
        this.shader.dispose();
        if (this.ground) {
            this.ground.geometry.dispose();
            this.ground.dispose();
        }
        if (this.shadowPass) {
            this.shadowPass.remove();
        }
    }

    _transformGround() {
        const layer = this.layer;
        const map = layer.getMap();
        // console.log(layer.getRenderer()._getMeterScale());
        const extent = map['_get2DExtent'](map.getGLZoom());
        const scaleX = extent.getWidth() * 2, scaleY = extent.getHeight() * 2;
        const localTransform = this.ground.localTransform;
        mat4.identity(localTransform);
        mat4.translate(localTransform, localTransform, map.cameraLookAt);
        mat4.scale(localTransform, localTransform, [scaleX, scaleY, 1]);
    }

    _init() {
        const regl = this.regl;

        this.scene = new reshader.Scene();

        const shadowEnabled = this.sceneConfig.shadow && this.sceneConfig.shadow.enable;

        this.renderer = new reshader.Renderer(regl);

        if (shadowEnabled && this.sceneConfig.lights && this.sceneConfig.lights.dirLights) {
            const planeGeo = new reshader.Plane();
            planeGeo.generateBuffers(regl);
            this.ground = new reshader.Mesh(planeGeo);
            this.groundScene = new reshader.Scene([this.ground]);

            this.shadowScene = new reshader.Scene();
            this.shadowScene.addMesh(this.ground);
            if (this.sceneConfig.shadow.type === 'vsm') {
                this.shadowPass = new VSMShadowPass(this.sceneConfig, this.renderer);
            } else {
                this.shadowPass = new StencilShadowPass(this.sceneConfig, this.renderer);
            }
        }

        const viewport = {
            x : 0,
            y : 0,
            width : () => {
                return this.layer ? this.layer.getMap().width : 1;
            },
            height : () => {
                return this.layer ? this.layer.getMap().height : 1;
            }
        };
        const scissor = {
            enable: true,
            box: {
                x : 0,
                y : 0,
                width : () => {
                    return this.layer ? this.layer.getMap().width : 1;
                },
                height : () => {
                    return this.layer ? this.layer.getMap().height : 1;
                }
            }
        };

        const config = {
            vert : reshader.pbr.StandardVert,
            frag : reshader.pbr.StandardFrag,
            uniforms : this._getUniforms(),
            defines : this._getDefines(),
            extraCommandProps : {
                //enable cullFace
                cull : {
                    enable: true,
                    face: 'back'
                },
                stencil: {
                    enable: false
                },
                viewport, scissor
                // polygonOffset: {
                //     enable: true,
                //     offset: {
                //         factor: -100,
                //         units: -100
                //     }
                // }
            }
        };

        this.shader = new reshader.MeshShader(config);

        this._updateMaterial();

        this._initCubeLight();

        const pickingConfig = extend({}, config);
        pickingConfig.vert = `
            attribute vec3 aPosition;
            uniform mat4 projectionViewModel;
            #include <fbo_picking_vert>
            void main() {
                vec4 pos = vec4(aPosition, 1.0);
                gl_Position = projectionViewModel * pos;
                fbo_picking_setData(gl_Position.w);
            }
        `;
        let u;
        for (let i = 0; i < config.uniforms.length; i++) {
            if (config.uniforms[i] === 'projectionViewModel' || config.uniforms[i].name === 'projectionViewModel') {
                u = config.uniforms[i];
                break;
            }
        }
        pickingConfig.uniforms = [u];
        this._raypicking = new reshader.FBORayPicking(this.renderer, pickingConfig, this.layer.getRenderer().pickingFBO);

    }

    _createIBLMaps(hdr) {
        const regl = this.regl;
        return reshader.pbr.PBRHelper.createIBLMaps(regl, {
            envTexture : hdr.getREGLTexture(regl),
            // prefilterCubeSize : 256
        });
    }

    _updateMaterial() {
        if (this.material) {
            this.material.dispose();
        }
        const materialConfig = this.sceneConfig.material;
        const material = {};
        for (const p in materialConfig) {
            if (materialConfig.hasOwnProperty(p)) {
                if (p.indexOf('Map') > 0) {
                    //a texture image
                    material[p] = new reshader.Texture2D({
                        url : materialConfig[p],
                        wrapS : 'repeat', wrapT : 'repeat'
                    }, this.loader);
                } else {
                    material[p] = materialConfig[p];
                }
            }
        }
        this.material = new reshader.pbr.StandardMaterial(material);
    }

    _initCubeLight() {
        const cubeLightConfig = this.sceneConfig.lights && this.sceneConfig.lights.ambientCubeLight;
        if (cubeLightConfig) {
            if (!cubeLightConfig.url && !cubeLightConfig.data) {
                throw new Error('Must provide url or data(ArrayBuffer) for ambientCubeLight');
            }
            const props = {
                url : cubeLightConfig.url,
                arrayBuffer : true,
                hdr : true,
                type : 'float',
                format : 'rgba',
                flipY : true
            };
            this._isIBLRecreated = !!cubeLightConfig.data;
            if (cubeLightConfig.data) {
                let data = cubeLightConfig.data;
                if (cubeLightConfig.data instanceof ArrayBuffer) {
                    // HDR raw data
                    data = reshader.HDR.parseHDR(cubeLightConfig.data);
                    props.data = data.pixels;
                    props.width = data.width;
                    props.height = data.height;
                } else {
                    props.data = data;
                }
            }
            this.hdr = new reshader.Texture2D(
                props,
                this.loader
            );

            //生成ibl纹理
            this.iblMaps = this._createIBLMaps(this.hdr);
        }
    }

    _getUniforms() {
        const uniforms = [
            'model',
            'camPos',
            'ambientIntensity',
            'ambientColor',
            {
                name : 'projectionViewModel',
                type : 'function',
                fn : function (context, props) {
                    const projectionViewModel = [];
                    mat4.multiply(projectionViewModel, props['view'], props['model']);
                    mat4.multiply(projectionViewModel, props['projection'], projectionViewModel);
                    return projectionViewModel;
                }
            },
            {
                name : 'viewModel',
                type : 'function',
                fn : function (context, props) {
                    const viewModel = [];
                    mat4.multiply(viewModel, props['view'], props['model']);
                    return viewModel;
                }
            }
        ];

        const lightConfig = this.sceneConfig.lights;

        if (lightConfig.dirLights) {
            const numOfDirLights = lightConfig.dirLights.length;
            uniforms.push(`dirLightDirections[${numOfDirLights}]`);
            uniforms.push(`dirLightColors[${numOfDirLights}]`);
            if (this.shadowPass) {
                const shadowUniforms = this.shadowPass.getUniforms(numOfDirLights);
                shadowUniforms.forEach(u => uniforms.push(u));
            }
        }
        if (lightConfig.spotLights) {
            uniforms.push(`spotLightPositions[${lightConfig.spotLights.length}]`);
            uniforms.push(`spotLightColors[${lightConfig.spotLights.length}]`);
        }
        if (lightConfig.ambientCubeLight) {
            uniforms.push('irradianceMap', 'prefilterMap', 'brdfLUT');
        }

        return uniforms;
    }

    _getUniformValues(map) {
        const view = map.viewMatrix,
            projection = map.projMatrix,
            camPos = map.cameraPosition;
        const lightUniforms = this._getLightUniforms();
        return extend({
            view, projection, camPos
        }, lightUniforms);
    }

    _getLightUniforms() {
        const lightConfig = this.sceneConfig.lights;

        const ambientColor = lightConfig.ambientColor || [0.08, 0.08, 0.08];
        const aoIntensity = lightConfig.ambientIntensity;
        const uniforms = {
            ambientColor,
            ambientIntensity : aoIntensity === 0 ? 0 : (aoIntensity || 1)
        };

        if (lightConfig.dirLights) {
            uniforms['dirLightDirections'] = lightConfig.dirLights.map(light => light.direction);
            uniforms['dirLightColors'] = lightConfig.dirLights.map(light => light.color);
        }
        if (lightConfig.spotLights) {
            uniforms['spotLightPositions'] = lightConfig.spotLights.map(light => light.position);
            uniforms['spotLightColors'] = lightConfig.spotLights.map(light => light.color);
        }
        if (lightConfig.ambientCubeLight) {
            uniforms['irradianceMap'] = this.iblMaps.irradianceMap;
            uniforms['prefilterMap'] = this.iblMaps.prefilterMap;
            uniforms['brdfLUT'] = this.iblMaps.brdfLUT;
        }

        return uniforms;
    }

    _getDefines() {
        const defines =  {
            'USE_COLOR' : 1
        };

        const lightConfig = this.sceneConfig.lights;

        if (lightConfig.dirLights) {
            defines['USE_DIR_LIGHT'] = 1;
            defines['NUM_OF_DIR_LIGHTS'] = `(${lightConfig.dirLights.length})`;
        }
        if (lightConfig.spotLights) {
            defines['USE_SPOT_LIGHT'] = 1;
            defines['NUM_OF_SPOT_LIGHTS'] = `(${lightConfig.spotLights.length})`;
        }
        if (lightConfig.ambientCubeLight) {
            defines['USE_AMBIENT_CUBEMAP'] = 1;
        }
        if (this.shadowPass) {
            const shadowDefines = this.shadowPass.getDefines();
            extend(defines, shadowDefines);
        }
        return defines;
    }

    debugFBO(id, fbo) {
        const canvas = document.getElementById(id);
        const width = fbo.width, height = fbo.height;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const pixels = this.regl.read({
            framebuffer : fbo
        });

        const halfHeight = height / 2 | 0;  // the | 0 keeps the result an int
        const bytesPerRow = width * 4;

        for (let i = 0; i < pixels.length; i++) {
            pixels[i] *= 255;
        }

        // make a temp buffer to hold one row
        const temp = new Uint8Array(width * 4);
        for (let y = 0; y < halfHeight; ++y) {
            const topOffset = y * bytesPerRow;
            const bottomOffset = (height - y - 1) * bytesPerRow;

            // make copy of a row on the top half
            temp.set(pixels.subarray(topOffset, topOffset + bytesPerRow));

            // copy a row from the bottom half to the top
            pixels.copyWithin(topOffset, bottomOffset, bottomOffset + bytesPerRow);

            // copy the copy of the top half row to the bottom half
            pixels.set(temp, bottomOffset);
        }

        // This part is not part of the answer. It's only here
        // to show the code above worked
        // copy the pixels in a 2d canvas to show it worked
        const imgdata = new ImageData(width, height);
        imgdata.data.set(pixels);
        ctx.putImageData(imgdata, 0, 0);
    }
}

export default PBRScenePainter;
