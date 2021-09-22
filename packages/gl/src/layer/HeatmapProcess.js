//参考:
//  * https://blog.mapbox.com/introducing-heatmaps-in-mapbox-gl-js-71355ada9e6c
//  * https://codepen.io/fuzhenn/pen/vYOgQwX
// import { mat4, vec3 } from 'gl-matrix';
import * as reshader from '@maptalks/reshader.gl';
import GroundPainter from './GroundPainter';
import { extend } from './util/util';

export default class HeatmapProcess {

    constructor(regl, sceneConfig, layer, colorStops, stencil, polygonOffset) {
        this.renderer = new reshader.Renderer(regl);
        this.sceneConfig = sceneConfig;
        this._layer = layer;
        this._colorStops = colorStops;
        this._stencil = stencil;
        this._polygonOffset = polygonOffset || { factor: 0, units: 0 };
        this._init();
    }

    render(scene, uniforms, fbo) {
        this._check();
        const map = this._layer.getMap();
        this.renderer.regl.clear({
            color: [0, 0, 0, 0],
            depth: 1,
            stencil: 0xFF,
            framebuffer: this._heatmapFBO
        });
        this.renderer.render(this._heatmapShader, uniforms, scene, this._heatmapFBO);
        const displayUniforms = extend({
            colorRamp: this._colorRampTex,
            inputTexture: this._heatmapFBO,
            projViewMatrix: map.projViewMatrix
        }, uniforms);
        this._transformGround();
        this.renderer.render(this._displayShader, displayUniforms, this._groundScene, fbo);
    }

    dispose() {
        if (this._heatmapShader) {
            this._heatmapShader.dispose();
            delete this._heatmapShader;
        }
        if (this._displayShader) {
            this._displayShader.dispose();
            delete this._displayShader;
        }
        if (this._ground) {
            this._ground.geometry.dispose();
            this._ground.dispose();
            delete this._ground;
            delete this._groundScene;
        }
        if (this._heatmapFBO) {
            this._heatmapFBO.destroy();
            delete this._heatmapFBO;
        }
    }

    _createColorRamp() {
        const colorStops = this._colorStops;
        let canvas = this._rampCanvas;
        let ctx = this._rampCtx;
        if (!ctx) {
            canvas = this._rampCanvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 1;
            ctx = this._rampCtx = canvas.getContext('2d');
        } else {
            ctx.clearRect(0, 0, 256, 1);
        }
        const gradient = ctx.createLinearGradient(0, 0, 256, 1);
        for (let i = 0; i < colorStops.length; i++) {
            gradient.addColorStop(colorStops[i][0], colorStops[i][1]);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 1);
        if (this._colorRampTex) {
            this._colorRampTex.destroy();
        }
        const regl = this.renderer.regl;
        this._colorRampTex = regl.texture({
            width: 256,
            height: 1,
            data: canvas,
            min: 'linear',
            mag: 'linear',
            premultiplyAlpha: true
        });
    }

    _check() {
        const canvas = this._layer.getRenderer().canvas;
        const width = Math.ceil(canvas.width / 4);
        const height = Math.ceil(canvas.height / 4);
        const fbo = this._heatmapFBO;
        if (fbo.width !== width || fbo.height !== height) {
            fbo.resize(width, height);
        }
    }

    _init() {
        this._createColorRamp();
        this._createShader();
        this._createHeatmapTex();
        this._createGround();
    }

    _createGround() {
        const planeGeo = new reshader.Plane();
        planeGeo.generateBuffers(this.renderer.regl);
        this._ground = new reshader.Mesh(planeGeo);
        this._groundScene = new reshader.Scene([this._ground]);
    }

    _transformGround() {
        const map = this._layer.getMap();
        const localTransform = GroundPainter.getGroundTransform(this._ground.localTransform, map);
        this._ground.setLocalTransform(localTransform);
    }

    _createHeatmapTex() {
        const canvas = this._layer.getRenderer().canvas;
        const regl = this.renderer.regl;
        const colorType = regl.hasExtension('OES_texture_half_float') ? 'half float' : 'float';
        const width = Math.ceil(canvas.width / 4);
        const height = Math.ceil(canvas.height / 4);
        const tex = regl.texture({
            width, height,
            type: colorType,
            min: 'linear',
            mag: 'linear',
            format: 'rgba'
        });
        this._heatmapFBO = regl.framebuffer({
            width,
            height,
            color: [tex]
        });
    }

    _createShader() {
        const layer = this._layer;
        const canvas = layer.getRenderer().canvas;
        const depthRange = this.sceneConfig.depthRange;
        const extraCommandProps = {
            viewport: {
                x: 0,
                y: 0,
                width: () => {
                    return canvas ? Math.ceil(canvas.width / 4) : 1;
                },
                height: () => {
                    return canvas ? Math.ceil(canvas.height / 4) : 1;
                }
            },
            depth: {
                enable: true,
                func: 'always'
            }
        };
        if (this._stencil) {
            extraCommandProps.stencil = this._stencil;
        }
        this._heatmapShader = new reshader.HeatmapShader({
            extraCommandProps
        });

        this._displayShader = new reshader.HeatmapDisplayShader({
            extraCommandProps: {
                stencil: {
                    enable: false
                },
                depth: {
                    enable: true,
                    range: depthRange || [0, 1],
                    func: '<='
                },
                polygonOffset: {
                    enable: true,
                    offset: this._polygonOffset
                }
            }
        });
    }
}