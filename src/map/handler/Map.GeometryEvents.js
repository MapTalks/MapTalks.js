Z.Map.mergeOptions({
    'geometryEvents': true
});

Z.Map.GeometryEvents = Z.Handler.extend({
    EVENTS: 'mousedown mouseup mousemove click dblclick contextmenu touchstart touchmove touchend',

    addHooks: function() {
        var map = this.target;
        var dom = map._panels.mapMask;
        if (Z.Browser.ie9 || Z.Browser.ie10) {
            dom = map._panels.canvasContainer;
        }
        if(dom) {
            Z.DomUtil.on(dom,this.EVENTS, this._identifyGeometryEvents, this);
        }

    },

    removeHooks: function() {
        var map = this.target;
        var dom = map._panels.mapMask;
        if (Z.Browser.ie9 || Z.Browser.ie10) {
            dom = map._panels.canvasContainer;
        }
        if(dom) {
            Z.DomUtil.off(dom, this.EVENTS, this._identifyGeometryEvents, this);
        }
    },

    _identifyGeometryEvents: function(domEvent) {
        var map = this.target;
        var vectorLayers = map._getLayers(function(layer) {
            if (layer instanceof Z.VectorLayer) {
                return true;
            }
            return false;
        });
        if (map._isBusy() || !vectorLayers || vectorLayers.length === 0) {
            return;
        }
        var layers = [];
        for (var i = 0; i < vectorLayers.length; i++) {
            if (vectorLayers[i].options['geometryEvents']) {
                layers.push(vectorLayers[i]);
            }
        };
        if (layers.length === 0) {
            return;
        }
        var eventType = domEvent.type,
            containerPoint = Z.DomUtil.getEventContainerPoint(domEvent, map._containerDOM),
            coordinate = map.containerPointToCoordinate(containerPoint);
        var geometryCursorStyle = null;
        var identifyOptions = {
            'includeInternals' : true,
            //return only one geometry on top,
            'filter':function(geometry) {
                var eventToFire = geometry._getEventTypeToFire(domEvent);
                if (eventType === 'mousemove') {
                    if (!geometryCursorStyle && geometry.options['cursor']) {
                        geometryCursorStyle = geometry.options['cursor'];
                    }
                    if (!geometry.listens('mousemove') && !(geometry.listens('mouseover'))) {
                        return false;
                    }
                } else {
                    if (!geometry.listens(eventToFire)) {
                        return false;
                    }
                }

                return true;
            },
            'count' : 1,
            'coordinate' : coordinate,
            'layers': layers
        };
        var callback = Z.Util.bind(fireGeometryEvent, this);
        var me = this;
        if (this._queryIdentifyTimeout) {
                Z.Util.cancelAnimFrame(this._queryIdentifyTimeout);
            }
        if ('mousemove' === eventType  || eventType === 'touchmove') {
            this._queryIdentifyTimeout = Z.Util.requestAnimFrame(function() {
                map.identify(identifyOptions, callback);
            });
        } else {
            map.identify(identifyOptions, callback);
        }

        function fireGeometryEvent(geometries) {
            var i;
            if(eventType === 'mousemove') {
                var geoMap = {};
                if (Z.Util.isArrayHasData(geometries)) {
                    for (i = geometries.length - 1; i >= 0; i--) {
                        geoMap[geometries[i]._getInternalId()] = geometries[i];
                        geometries[i]._onEvent(domEvent);
                        //the first geometry is on the top, so ignore the latter cursors.
                        geometries[i]._onMouseOver(domEvent);
                    }
                }

                map._setPriorityCursor(geometryCursorStyle);

                var oldTargets = me._prevMouseOverTargets;
                me._prevMouseOverTargets = geometries;
                if (Z.Util.isArrayHasData(oldTargets)) {
                    for (i = oldTargets.length - 1; i >= 0; i--) {
                        var oldTarget = oldTargets[i];
                        var oldTargetId = oldTargets[i]._getInternalId();
                        if(geometries && geometries.length>0) {
                            var mouseout = true;
                            /**
                            * 鼠标经过的新位置中不包含老的目标geometry
                            */
                            if (geoMap[oldTargetId]) {
                                mouseout = false;
                            }
                            if(mouseout) {
                                oldTarget._onMouseOut(domEvent);
                            }
                        } else {//鼠标新的位置不包含任何geometry，将触发之前target的mouseOut事件
                            oldTarget._onMouseOut(domEvent);
                        }
                    }
                }

            } else {
                if(!geometries || geometries.length === 0) {return;}
                // for (i = geometries.length - 1; i >= 0; i--) {
                geometries[geometries.length - 1]._onEvent(domEvent);
                // }
            }
        }

    }
});

Z.Map.addInitHook('addHandler', 'geometryEvents', Z.Map.GeometryEvents);
