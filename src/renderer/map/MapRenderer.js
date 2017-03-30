import { offsetDom } from 'core/util/dom';
import Class from 'core/Class';
import { Animation } from 'core/Animation';
import Point from 'geo/Point';

/**
 * @classdesc
 * Base class for all the map renderers.
 * @class
 * @abstract
 * @protected
 * @memberOf renderer.map
 * @name Renderer
 * @extends {Class}
 */
export default class MapRenderer extends Class {

    panAnimation(distance, t, onFinish) {
        distance = new Point(distance);
        var map = this.map;
        if (map.options['panAnimation']) {
            var duration;
            if (!t) {
                duration = map.options['panAnimationDuration'];
            } else {
                duration = t;
            }
            map._enablePanAnimation = true;
            map._panAnimating = true;
            var preDist = null;
            const player = Animation.animate({
                'distance': distance
            }, {
                'easing': 'out',
                'duration': duration
            }, function (frame) {
                if (map.isRemoved()) {
                    player.finish();
                    return;
                }
                if (!map._enablePanAnimation) {
                    player.finish();
                    map._panAnimating = false;
                    map.onMoveEnd();
                    return;
                }

                if (player.playState === 'running' && frame.styles['distance']) {
                    var dist = frame.styles['distance'];
                    if (!preDist) {
                        preDist = dist;
                    }
                    var offset = dist.sub(preDist);
                    map.offsetPlatform(offset);
                    map._offsetCenterByPixel(offset);
                    preDist = dist;
                    map.onMoving();
                } else if (player.playState === 'finished') {
                    map._panAnimating = false;
                    if (onFinish) {
                        onFinish();
                    }
                    map.onMoveEnd();
                }
            });
            player.play();
        } else {
            map.onMoveEnd();
        }
    }

    /**
     * 获取地图容器偏移量或更新地图容器偏移量
     * @param  {Point} offset 偏移量
     * @return {this | Point}
     */
    offsetPlatform(offset) {
        if (!this.map._panels.front) {
            return this;
        }
        var pos = this.map.offsetPlatform().add(offset)._round();
        offsetDom(this.map._panels.back, pos);
        offsetDom(this.map._panels.front, pos);
        return this;
    }

    resetContainer() {
        if (!this.map) {
            return;
        }
        this.map._resetMapViewPoint();
        if (this.map._panels.front) {
            var pos = new Point(0, 0);
            offsetDom(this.map._panels.back, pos);
            offsetDom(this.map._panels.front, pos);
        }
    }

    onZoomEnd() {
        this.resetContainer();
    }

    onLoad() {
        this.render();
    }
}
