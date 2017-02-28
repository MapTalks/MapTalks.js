/**
 * @classdesc
 * Painter class for all geometry types except the collection types.
 * @class
 * @protected
 * @param {maptalks.Geometry} geometry - geometry to paint
 */
maptalks.Painter = maptalks.Class.extend(/** @lends maptalks.Painter.prototype */{


    initialize:function (geometry) {
        this.geometry = geometry;
        this.symbolizers = this._createSymbolizers();
    },

    getMap:function () {
        return this.geometry.getMap();
    },

    /**
     * 构造symbolizers
     * @return {*} [description]
     */
    _createSymbolizers:function () {
        var geoSymbol = this.getSymbol(),
            symbolizers = [],
            regSymbolizers = maptalks.Painter.registerSymbolizers,
            symbols = geoSymbol;
        if (!maptalks.Util.isArray(geoSymbol)) {
            symbols = [geoSymbol];
        }
        var symbol, symbolizer;
        for (var ii = symbols.length - 1; ii >= 0; ii--) {
            symbol = symbols[ii];
            for (var i = regSymbolizers.length - 1; i >= 0; i--) {
                if (regSymbolizers[i].test(symbol, this.geometry)) {
                    symbolizer = new regSymbolizers[i](symbol, this.geometry, this);
                    symbolizers.push(symbolizer);
                    if (symbolizer instanceof maptalks.symbolizer.PointSymbolizer) {
                        this._hasPointSymbolizer = true;
                    }
                }
            }
        }
        if (symbolizers.length === 0) {
            if (console) {
                console.warn('invalid symbol for geometry(' + (this.geometry ? this.geometry.getType() + (this.geometry.getId() ? ':' + this.geometry.getId() : '') : '') + ') to draw : ' + JSON.stringify(geoSymbol));
            }
            // throw new Error('no symbolizers can be created to draw, check the validity of the symbol.');
        }
        this._debugSymbolizer = new maptalks.symbolizer.DebugSymbolizer(symbol, this.geometry, this);
        this._hasShadow = this.geometry.options['shadowBlur'] > 0;
        return symbolizers;
    },

    hasPointSymbolizer:function () {
        return this._hasPointSymbolizer;
    },

    /**
     * for point symbolizers
     * @return {maptalks.Point[]} points to render
     */
    getRenderPoints:function (placement) {
        if (!this._renderPoints) {
            this._renderPoints = {};
        }
        if (!placement) {
            placement = 'point';
        }
        if (!this._renderPoints[placement]) {
            this._renderPoints[placement] = this.geometry._getRenderPoints(placement);
        }
        return this._renderPoints[placement];
    },

    /**
     * for strokeAndFillSymbolizer
     * @return {Object[]} resources to render vector
     */
    getPaintParams:function () {
        if (!this._paintParams) {
            //render resources geometry returned are based on 2d points.
            this._paintParams = this.geometry._getPaintParams();
        }
        if (!this._paintParams) {
            return null;
        }
        var map = this.getMap();
        var maxZoom = map.getMaxZoom();
        var zoomScale = map.getScale();
        var layerNorthWest = this.geometry.getLayer()._getRenderer()._northWest;
        var layerPoint = map._pointToContainerPoint(layerNorthWest),
            paintParams = this._paintParams,
            tPaintParams = [], // transformed params
        //refer to Geometry.Canvas
            points = paintParams[0],
            containerPoints;
        //convert view points to container points needed by canvas
        if (maptalks.Util.isArray(points)) {
            containerPoints = maptalks.Util.mapArrayRecursively(points, function (point) {
                return map._pointToContainerPoint(point, maxZoom)._substract(layerPoint);
            });
        } else if (points instanceof maptalks.Point) {
            // containerPoints = points.substract(layerPoint);
            containerPoints = map._pointToContainerPoint(points, maxZoom)._substract(layerPoint);
        }
        tPaintParams.push(containerPoints);
        for (var i = 1, len = paintParams.length; i < len; i++) {
            if (maptalks.Util.isNumber(paintParams[i]) || (paintParams[i] instanceof maptalks.Size)) {
                if (maptalks.Util.isNumber(paintParams[i])) {
                    tPaintParams.push(paintParams[i] / zoomScale);
                } else {
                    tPaintParams.push(paintParams[i].multi(1 / zoomScale));
                }
            } else {
                tPaintParams.push(paintParams[i]);
            }
        }
        return tPaintParams;
    },

    getSymbol:function () {
        return this.geometry._getInternalSymbol();
    },

    /**
     * 绘制图形
     */
    paint: function () {
        var contexts = this.geometry.getLayer()._getRenderer().getPaintContext();
        if (!contexts || !this.symbolizers) {
            return;
        }

        this.symbolize(contexts);
    },

    symbolize: function (contexts) {
        this._prepareShadow(contexts[0]);
        for (var i = this.symbolizers.length - 1; i >= 0; i--) {
            this.symbolizers[i].symbolize.apply(this.symbolizers[i], contexts);
        }
        this._painted = true;
        this._debugSymbolizer.symbolize.apply(this._debugSymbolizer, contexts);
    },

    getSprite: function (resources) {
        if (!(this.geometry instanceof maptalks.Marker)) {
            return null;
        }
        this._genSprite = true;
        if (!this._sprite && this.symbolizers.length > 0) {
            var extent = new maptalks.PointExtent();
            this.symbolizers.forEach(function (s) {
                var markerExtent = s.getMarkerExtent(resources);
                extent._combine(markerExtent);
            });
            var origin = extent.getMin().multi(-1);
            var canvas = maptalks.Canvas.createCanvas(extent.getWidth(), extent.getHeight(), this.getMap() ? this.getMap().CanvasClass : null);
            var bak;
            if (this._renderPoints) {
                bak = this._renderPoints;
            }
            var contexts = [canvas.getContext('2d'), resources];
            this._prepareShadow(canvas.getContext('2d'));
            for (var i = this.symbolizers.length - 1; i >= 0; i--) {
                var dxdy = this.symbolizers[i].getDxDy();
                this._renderPoints = {'point' : [[origin.add(dxdy)]]};
                this.symbolizers[i].symbolize.apply(this.symbolizers[i], contexts);
            }
            if (bak) {
                this._renderPoints = bak;
            }
            this._sprite = {
                'canvas' : canvas,
                'offset' : extent.getCenter()
            };
        }
        this._genSprite = false;
        return this._sprite;
    },

    isSpriting: function () {
        return this._genSprite;
    },

    _prepareShadow: function (ctx) {
        if (this._hasShadow) {
            ctx.shadowBlur = this.geometry.options['shadowBlur'];
            ctx.shadowColor = this.geometry.options['shadowColor'];
        } else if (ctx.shadowBlur) {
            ctx.shadowBlur = null;
            ctx.shadowColor = null;
        }
    },

    _eachSymbolizer:function (fn, context) {
        if (!this.symbolizers) {
            return;
        }
        if (!context) {
            context = this;
        }
        for (var i = this.symbolizers.length - 1; i >= 0; i--) {
            fn.apply(context, [this.symbolizers[i]]);
        }
    },

    //需要实现的接口方法
    get2DExtent:function (resources) {
        if (!this._extent2D) {
            if (this.symbolizers) {
                var _extent2D = new maptalks.PointExtent();
                var len = this.symbolizers.length - 1;
                for (var i = len; i >= 0; i--) {
                    _extent2D._combine(this.symbolizers[i].get2DExtent(resources));
                }
                this._extent2D = _extent2D;
            }
        }
        return this._extent2D;
    },

    getContainerExtent : function () {
        var map = this.getMap(),
            extent2D = this.get2DExtent(this.resources);
        var containerExtent = new maptalks.PointExtent(map._pointToContainerPoint(extent2D.getMin()), map._pointToContainerPoint(extent2D.getMax()));
        return containerExtent;
    },

    setZIndex:function (change) {
        this._eachSymbolizer(function (symbolizer) {
            symbolizer.setZIndex(change);
        });
    },

    show:function () {
        if (!this._painted) {
            var layer = this.geometry.getLayer();
            if (!layer.isCanvasRender()) {
                this.paint();
            }
        } else {
            this.removeCache();
            this._eachSymbolizer(function (symbolizer) {
                symbolizer.show();
            });
        }
    },

    hide:function () {
        this._eachSymbolizer(function (symbolizer) {
            symbolizer.hide();
        });
    },

    repaint:function () {
        this.removeCache();
    },

    /**
     * symbol发生变化后, 刷新symbol
     */
    refreshSymbol:function () {
        this.removeCache();
        this._removeSymbolizers();
        this.symbolizers = this._createSymbolizers();
        if (!this.getMap()) {
            return;
        }
        var layer = this.geometry.getLayer();
        if (this.geometry.isVisible() && (layer instanceof maptalks.VectorLayer)) {
            if (!layer.isCanvasRender()) {
                this.paint();
            }
        }
    },

    remove:function () {
        this.removeCache();
        this._removeSymbolizers();
    },

    _removeSymbolizers:function () {
        this._eachSymbolizer(function (symbolizer) {
            delete symbolizer.painter;
            symbolizer.remove();
        });
        delete this.symbolizers;
    },

    /**
     * delete painter's caches
     */
    removeCache:function () {
        delete this._renderPoints;
        delete this._paintParams;
        delete this._sprite;
        this.removeZoomCache();
    },

    removeZoomCache: function () {
        if (this.geometry._simplified) {
            // remove cached points if the geometry is simplified on the zoom.
            delete this._paintParams;
        }
        delete this._extent2D;
    }
});

//注册的symbolizer
maptalks.Painter.registerSymbolizers = [
    maptalks.symbolizer.StrokeAndFillSymbolizer,
    maptalks.symbolizer.ImageMarkerSymbolizer,
    maptalks.symbolizer.VectorPathMarkerSymbolizer,
    maptalks.symbolizer.VectorMarkerSymbolizer,
    maptalks.symbolizer.TextMarkerSymbolizer
];
