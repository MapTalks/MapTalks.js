/**
 * CanvasLayer provides some interface methods for canvas context operations. <br>
 * You can use it directly, but can't ser/dser a CanvasLayer with json in this way. <br>
 * It is more recommended to extend it with a subclass and implement canvas paintings inside the subclass.
 * @classdesc
 * A layer with a HTML5 2D canvas context.
 * @example
 *  var layer = new maptalks.CanvasLayer('canvas');
 *
 *  layer.prepareToDraw = function (context) {
 *      var size = map.getSize();
 *      return [size.width, size.height]
 *  };
 *
 *  layer.draw = function (context, width, height) {
 *      context.fillStyle = "#f00";
 *      context.fillRect(0, 0, w, h);
 *  };
 *  layer.addTo(map);
 * @class
 * @category layer
 * @extends {maptalks.Layer}
 * @param {String|Number} id - layer's id
 * @param {Object} options - options defined in [options]{@link maptalks.CanvasLayer#options}
 */
maptalks.CanvasLayer = maptalks.Layer.extend(/** @lends maptalks.CanvasLayer.prototype */{

    options: {
        'animation' : false,
        'fps'    : 70
    },

    /**
     * An optional interface function called only once before the first draw, useful for preparing your canvas operations.
     * @param  {CanvasRenderingContext2D } context - CanvasRenderingContext2D of the layer canvas.
     * @return {Object[]} objects that will be passed to function draw(context, ..) as parameters.
     */
    prepareToDraw: function () {},

    /**
     * The required interface function to draw things on the layer canvas.
     * @param  {CanvasRenderingContext2D} context - CanvasRenderingContext2D of the layer canvas.
     * @param  {*} params.. - parameters returned by function prepareToDraw(context).
     */
    draw: function () {},

    play: function () {
        if (this._getRenderer()) {
            this._getRenderer().startAnim();
        }
        return this;
    },

    pause: function () {
        if (this._getRenderer()) {
            this._getRenderer().pauseAnim();
        }
        return this;
    },

    isPlaying : function () {
        if (this._getRenderer()) {
            return this._getRenderer().isPlaying();
        }
        return false;
    },

    clearCanvas: function () {
        if (this._getRenderer()) {
            this._getRenderer().clearCanvas();
        }
        return this;
    },

    /**
     * Ask the map to redraw the layer canvas without firing any event.
     * @return {maptalks.CanvasLayer} this
     */
    requestMapToRender: function () {
        if (this._getRenderer()) {
            this._getRenderer().requestMapToRender();
        }
        return this;
    },

    /**
     * Ask the map to redraw the layer canvas and fire layerload event
     * @return {maptalks.CanvasLayer} this
     */
    completeRender: function () {
        if (this._getRenderer()) {
            this._getRenderer().completeRender();
        }
        return this;
    },

    /**
     * The event callback for map's zoomstart event.
     * @param  {Object} param - event parameter
     */
    onZoomStart: function () {},

    /**
     * The event callback for map's zoomend event.
     * @param  {Object} param - event parameter
     */
    onZoomEnd: function () {},

    /**
     * The event callback for map's movestart event.
     * @param  {Object} param - event parameter
     */
    onMoveStart: function () {},

    /**
     * The event callback for map's moveend event.
     * @param  {Object} param - event parameter
     */
    onMoveEnd: function () {},

    /**
     * The event callback for map's resize event.
     * @param  {Object} param - event parameter
     */
    onResize: function () {}

});

maptalks.CanvasLayer.registerRenderer('canvas', maptalks.renderer.Canvas.extend({

    draw: function () {
        if (!this._predrawed) {
            this._drawContext = this.layer.prepareToDraw(this.context);
            if (!this._drawContext) {
                this._drawContext = [];
            }
            if (!Array.isArray(this._drawContext)) {
                this._drawContext = [this._drawContext];
            }
            this._predrawed = true;
        }
        this.prepareCanvas();
        this._drawLayer();
    },

    _drawLayer: function () {
        this.layer.draw.apply(this.layer, [this.context].concat(this._drawContext));
        this.completeRender();
        this._play();
    },

    startAnim: function () {
        this._paused = false;
        this._play();
    },

    pauseAnim: function () {
        this._pause();
        this._paused = true;
    },

    isPlaying : function () {
        return !maptalks.Util.isNil(this._frame);
    },

    hide: function () {
        this._pause();
        return maptalks.renderer.Canvas.prototype.hide.call(this);
    },

    show: function () {
        return maptalks.renderer.Canvas.prototype.show.call(this);
    },

    remove: function () {
        this._pause();
        delete this._drawContext;
        return maptalks.renderer.Canvas.prototype.remove.call(this);
    },

    onZoomStart: function (param) {
        this._pause();
        this.layer.onZoomStart(param);
        maptalks.renderer.Canvas.prototype.onZoomStart.call(this);
    },

    onZoomEnd: function (param) {
        this.layer.onZoomEnd(param);
        maptalks.renderer.Canvas.prototype.onZoomEnd.call(this);
    },

    onMoveStart: function (param) {
        this._pause();
        this.layer.onMoveStart(param);
        maptalks.renderer.Canvas.prototype.onMoveStart.call(this);
    },

    onMoveEnd: function (param) {
        this.layer.onMoveEnd(param);
        maptalks.renderer.Canvas.prototype.onMoveEnd.call(this);
    },

    onResize: function (param) {
        this.layer.onResize(param);
        maptalks.renderer.Canvas.prototype.onResize.call(this);
    },

    _pause : function () {
        if (this._frame) {
            maptalks.Util.cancelAnimFrame(this._frame);
            delete this._frame;
        }
        if (this._animTimeout) {
            clearTimeout(this._animTimeout);
            delete this._animTimeout;
        }
    },

    _play : function () {
        if (this._paused || !this.layer || !this.layer.options['animation']) {
            return;
        }
        var frameFn = maptalks.Util.bind(this._drawLayer, this);
        this._pause();
        var fps = this.layer.options['fps'];
        if (fps >= 1000 / 16) {
            this._frame = maptalks.Util.requestAnimFrame(frameFn);
        } else {
            this._animTimeout = setTimeout(function () {
                if (maptalks.Browser.ie9) {
                    // ie9 doesn't support RAF
                    frameFn();
                    this._frame = 1;
                } else {
                    this._frame = maptalks.Util.requestAnimFrame(frameFn);
                }
            }.bind(this), 1000 / this.layer.options['fps']);
        }
    }
}));
