/**
 * @classdesc
 * Renderer class based on HTML5 Canvas2D for VectorLayers
 * @class
 * @protected
 * @memberOf maptalks.renderer.vectorlayer
 * @name Canvas
 * @extends {maptalks.renderer.Canvas}
 * @param {maptalks.VectorLayer} layer - layer of the renderer
 */
Z.renderer.vectorlayer.Canvas = Z.renderer.Canvas.extend(/** @lends Z.renderer.vectorlayer.Canvas.prototype */{

    initialize:function (layer) {
        this.layer = layer;
        this._painted = false;
    },

    /**
     * render layer
     * @param  {maptalks.Geometry[]} geometries   geometries to render
     * @param  {Boolean} ignorePromise   whether escape step of promise
     */
    draw:function () {
        if (!this.getMap()) {
            return;
        }
        var map = this.getMap();
        if (!this.layer.isVisible() || this.layer.isEmpty()) {
            this.clearCanvas();
            this.completeRender();
            return;
        }
        var zoom = this.getMap().getZoom();
        if (this.layer.options['drawOnce']) {
            if (!this._canvasCache) {
                this._canvasCache = {};
            }
            if (this._extent2D) {
                this.completeRender();
                return;
            } else if (this._canvasCache[zoom]) {
                this.canvas = this._canvasCache[zoom].canvas;
                var center = map._prjToPoint(map._getPrjCenter());
                this._extent2D = this._canvasCache[zoom].extent2D.add(this._canvasCache[zoom].center.substract(center));
                this.completeRender();
                return;
            } else {
                delete this.canvas;
            }
        }
        this._drawGeos();
        if (this.layer.options['drawOnce']) {
            if (!this._canvasCache[zoom]) {
                this._canvasCache[zoom] = {
                    'canvas'       : this.canvas,
                    'extent2D'   : this._extent2D,
                    'center'       : map._prjToPoint(map._getPrjCenter())
                };
            }
        }
        this.completeRender();
    },

    //redraw all the geometries with transform matrix
    //this may bring low performance if number of geometries is large.
    transform: function (matrix) {
        if (Z.Browser.mobile || this.layer.options['drawOnce'] || this.layer.getMask()) {
            return false;
        }
        //determin whether this layer should be transformed.
        //if all the geometries to render are vectors including polygons and linestrings,
        //disable transforming won't reduce user experience.
        if (!this._hasPointSymbolizer ||
            this.getMap()._getRenderer()._getCountOfGeosToDraw() > this.layer.options['thresholdOfTransforming']) {
            return false;
        }
        this._drawGeos(matrix);
        return true;
    },

    checkResources:function (geometries) {
        if (!this._painted && !Z.Util.isArray(geometries)) {
            geometries = this.layer._geoList;
        }
        if (!geometries || !Z.Util.isArrayHasData(geometries)) {
            return null;
        }
        var me = this,
            resources = [];
        var res, ii;
        function checkGeo(geo) {
            res = geo._getExternalResources();
            if (!Z.Util.isArrayHasData(res)) {
                return;
            }
            if (!me.resources) {
                resources = resources.concat(res);
            } else {
                for (ii = 0; ii < res.length; ii++) {
                    if (!me.resources.isResourceLoaded(res[ii])) {
                        resources.push(res[ii]);
                    }
                }
            }
        }

        for (var i = geometries.length - 1; i >= 0; i--) {
            checkGeo(geometries[i]);
        }
        return resources;
    },


    isBlank: function () {
        return this._isBlank;
    },

    /**
     * Show and render
     * @override
     */
    show: function () {
        this.layer.forEach(function (geo) {
            geo.onZoomEnd();
        });
        Z.renderer.Canvas.prototype.show.apply(this, arguments);
    },

    _drawGeos:function (matrix) {
        var map = this.getMap();
        if (!map) {
            return;
        }
        var layer = this.layer;
        if (layer.isEmpty()) {
            this.resources = new Z.renderer.Canvas.Resources();
            this.fireLoadedEvent();
            return;
        }
        if (!layer.isVisible()) {
            this.fireLoadedEvent();
            return;
        }
        this._prepareToDraw();
        var extent2D = this._extent2D,
            maskExtent2D = this.prepareCanvas();
        if (maskExtent2D) {
            if (!maskExtent2D.intersects(extent2D)) {
                this.fireLoadedEvent();
                return;
            }
            extent2D = extent2D.intersection(maskExtent2D);
        }
        this._displayExtent = extent2D;
        this._forEachGeo(this._checkGeo, this);
        for (var i = 0, len = this._geosToDraw.length; i < len; i++) {
            this._geosToDraw[i]._getPainter().paint(matrix);
        }
    },

    _prepareToDraw: function () {
        this._isBlank = true;
        this._painted = true;
        this._hasPointSymbolizer = false;
        this._geosToDraw = [];
    },

    _checkGeo: function (geo) {
        if (!geo || !geo.isVisible() || !geo.getMap() ||
            !geo.getLayer() || (!geo.getLayer().isCanvasRender())) {
            return;
        }
        var painter = geo._getPainter(),
            extent2D = painter.get2DExtent();
        if (!extent2D || !extent2D.intersects(this._displayExtent)) {
            return;
        }
        this._isBlank = false;
        if (painter.hasPointSymbolizer()) {
            this._hasPointSymbolizer = true;
        }
        this._geosToDraw.push(geo);
    },


    _forEachGeo: function (fn, context) {
        this.layer.forEach(fn, context);
    },

    onZoomEnd: function () {
        delete this._extent2D;
        if (this.layer.isVisible()) {
            this.layer.forEach(function (geo) {
                geo.onZoomEnd();
            });
        }
        if (!this._painted) {
            this.render(true);
        } else {
            //prepareRender is called in render not in draw.
            //Thus prepareRender needs to be called here
            this.prepareRender();
            this.draw();
        }
    },

    onMoveEnd: function () {
        if (!this._painted) {
            this.render(true);
        } else {
            this.prepareRender();
            this.draw();
        }
    },

    onResize: function () {
        this.resizeCanvas();
        if (!this._painted) {
            this.render(true);
        } else {
            delete this._canvasCache;
            delete this._extent2D;
            this.prepareRender();
            this.draw();
        }
    },

    onRemove:function () {
        delete this._canvasCache;
        delete this._geosToDraw;
    }
});


Z.VectorLayer.registerRenderer('canvas', Z.renderer.vectorlayer.Canvas);

if (Z.GeoJSONLayer) {
    Z.GeoJSONLayer.registerRenderer('canvas', Z.renderer.vectorlayer.Canvas);
}
