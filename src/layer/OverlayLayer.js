/**
 * @classdesc
 * Base class of all the layers that can add/remove geometries. <br>
 * It is abstract and not intended to be instantiated.
 * @class
 * @category layer
 * @abstract
 * @extends {maptalks.Layer}
 */
maptalks.OverlayLayer = maptalks.Layer.extend(/** @lends maptalks.OverlayLayer.prototype */{

    /**
     * Get a geometry by its id
     * @param  {String|Number} id   - id of the geometry
     * @return {maptalks.Geometry}
     */
    getGeometryById:function (id) {
        if (maptalks.Util.isNil(id) || id === '') {
            return null;
        }
        if (!this._geoMap[id]) {
            return null;
        }
        return this._geoMap[id];
    },

    /**
     * Get all the geometries or the ones filtered if a filter function is provided.
     * @param {Function} [filter=undefined]  - a function to filter the geometries
     * @param {Object} [context=undefined]   - context of the filter function, value to use as this when executing filter.
     * @return {maptalks.Geometry[]}
     */
    getGeometries:function (filter, context) {
        if (!filter) {
            return this._geoList.slice(0);
        }
        var result = [],
            geometry, filtered;
        for (var i = 0, l = this._geoList.length; i < l; i++) {
            geometry = this._geoList[i];
            if (context) {
                filtered = filter.call(context, geometry);
            } else {
                filtered = filter(geometry);
            }
            if (filtered) {
                result.push(geometry);
            }
        }
        return result;
    },

    /**
     * Get the first geometry, the geometry at the bottom.
     * @return {maptalks.Geometry} first geometry
     */
    getFirstGeometry: function () {
        if (this._geoList.length === 0) {
            return null;
        }
        return this._geoList[0];
    },

    /**
     * Get the last geometry, the geometry on the top
     * @return {maptalks.Geometry} last geometry
     */
    getLastGeometry: function () {
        var len = this._geoList.length;
        if (len === 0) {
            return null;
        }
        return this._geoList[len - 1];
    },

    /**
     * Get count of the geometries
     * @return {Number} count
     */
    getCount: function () {
        return this._geoList.length;
    },

    /**
     * Get extent of all the geometries in the layer, return null if the layer is empty.
     * @return {maptalks.Extent} - extent of the layer
     */
    getExtent: function () {
        if (this.getCount() === 0) {
            return null;
        }
        var extent = new maptalks.Extent();
        this.forEach(function (g) {
            extent._combine(g.getExtent());
        });
        return extent;
    },

    /**
     * Executes the provided callback once for each geometry present in the layer in order.
     * @param  {Function} fn - a callback function
     * @param  {*} [context=undefined]   - callback's context, value to use as this when executing callback.
     * @return {maptalks.OverlayLayer} this
     */
    forEach:function (fn, context) {
        var copyOnWrite = this._geoList.slice(0);
        for (var i = 0, l = copyOnWrite.length; i < l; i++) {
            if (!context) {
                fn(copyOnWrite[i], i);
            } else {
                fn.call(context, copyOnWrite[i], i);
            }
        }
        return this;
    },

    /**
     * Creates a GeometryCollection with all the geometries that pass the test implemented by the provided function.
     * @param  {Function} fn      - Function to test each geometry
     * @param  {*} [context=undefined]  - Function's context, value to use as this when executing function.
     * @return {maptalks.GeometryCollection} A GeometryCollection with all the geometries that pass the test
     */
    filter: function (fn, context) {
        var selected = [];
        if (maptalks.Util.isFunction(fn)) {
            if (fn) {
                this.forEach(function (geometry) {
                    if (context ? fn.call(context, geometry) : fn(geometry)) {
                        selected.push(geometry);
                    }
                });
            }
        } else {
            var filter = maptalks.Util.createFilter(fn);
            this.forEach(function (geometry) {
                var g = maptalks.Util.getFilterFeature(geometry);
                if (filter(g)) {
                    selected.push(geometry);
                }
            }, this);
        }
        return selected.length > 0 ? new maptalks.GeometryCollection(selected) : null;
    },

    /**
     * Whether the layer is empty.
     * @return {Boolean}
     */
    isEmpty:function () {
        return this._geoList.length === 0;
    },

    /**
     * Adds one or more geometries to the layer
     * @param {maptalks.Geometry|maptalks.Geometry[]} geometries - one or more geometries
     * @param {Boolean} [fitView=false]  - automatically set the map to a fit center and zoom for the geometries
     * @return {maptalks.OverlayLayer} this
     */
    addGeometry:function (geometries, fitView) {
        if (!geometries) { return this; }
        if (!maptalks.Util.isArray(geometries)) {
            var count = arguments.length;
            var last = arguments[count - 1];
            geometries = Array.prototype.slice.call(arguments, 0, count - 1);
            fitView = last;
            if (last instanceof maptalks.Geometry) {
                geometries.push(last);
                fitView = false;
            }
            return this.addGeometry(geometries, fitView);
        } else if (!maptalks.Util.isArrayHasData(geometries)) {
            return this;
        }
        this._initCache();
        var fitCounter = 0;
        var centerSum = new maptalks.Coordinate(0, 0);
        var extent = null,
            geo, geoId, internalId, geoCenter, geoExtent;
        for (var i = 0, len = geometries.length; i < len; i++) {
            geo = geometries[i];
            if (!geo) {
                throw new Error('Invalid geometry to add to layer(' + this.getId() + ') at index:' + i);
            }
            if (!(geo instanceof maptalks.Geometry)) {
                geo = maptalks.Geometry.fromJSON(geo);
            }
            geoId = geo.getId();
            if (!maptalks.Util.isNil(geoId)) {
                if (!maptalks.Util.isNil(this._geoMap[geoId])) {
                    throw new Error('Duplicate geometry id in layer(' + this.getId() + '):' + geoId + ', at index:' + i);
                }
                this._geoMap[geoId] = geo;
            }
            internalId = maptalks.Util.UID();
            //内部全局唯一的id
            geo._setInternalId(internalId);
            this._geoList.push(geo);


            if (fitView === true) {
                geoCenter = geo.getCenter();
                geoExtent = geo.getExtent();
                if (geoCenter && geoExtent) {
                    centerSum._add(geoCenter);
                    if (extent == null) {
                        extent = geoExtent;
                    } else {
                        extent = extent._combine(geoExtent);
                    }
                    fitCounter++;
                }
            }
            if (this.onAddGeometry) {
                this.onAddGeometry(geo);
            }
            geo._bindLayer(this);
            /**
             * add event.
             *
             * @event maptalks.Geometry#add
             * @type {Object}
             * @property {String} type - add
             * @property {maptalks.Geometry} target - geometry
             * @property {maptalks.Layer} layer - the layer added to.
             */
            geo._fireEvent('add', {'layer':this});
        }
        this._sortGeometries();
        var map = this.getMap();
        if (map) {
            this._getRenderer().onGeometryAdd(geometries);
            if (fitView && extent) {
                var z = map.getFitZoom(extent);
                var center = centerSum._multi(1 / fitCounter);
                map.setCenterAndZoom(center, z);
            }
        }
        /**
         * addgeo event.
         *
         * @event maptalks.OverlayLayer#addgeo
         * @type {Object}
         * @property {String} type - addgeo
         * @property {maptalks.OverlayLayer} target - layer
         * @property {maptalks.Geometry[]} geometries - the geometries to add
         */
        this.fire('addgeo', {'geometries':geometries});
        return this;
    },

    /**
     * Removes one or more geometries from the layer
     * @param  {String|String[]|maptalks.Geometry|maptalks.Geometry[]} geometries - geometry ids or geometries to remove
     * @returns {maptalks.OverlayLayer} this
     */
    removeGeometry:function (geometries) {
        if (!maptalks.Util.isArray(geometries)) {
            return this.removeGeometry([geometries]);
        }
        for (var i = geometries.length - 1; i >= 0; i--) {
            if (!(geometries[i] instanceof maptalks.Geometry)) {
                geometries[i] = this.getGeometryById(geometries[i]);
            }
            if (!geometries[i] || this !== geometries[i].getLayer()) continue;
            geometries[i].remove();
        }
        /**
         * removegeo event.
         *
         * @event maptalks.OverlayLayer#removegeo
         * @type {Object}
         * @property {String} type - removegeo
         * @property {maptalks.OverlayLayer} target - layer
         * @property {maptalks.Geometry[]} geometries - the geometries to remove
         */
        this.fire('removegeo', {'geometries':geometries});
        return this;
    },

    /**
     * Clear all geometries in this layer
     * @returns {maptalks.OverlayLayer} this
     */
    clear:function () {
        this._clearing = true;
        this.forEach(function (geo) {
            geo.remove();
        });
        this._geoMap = {};
        var old = this._geoList;
        this._geoList = [];
        if (this._getRenderer()) {
            this._getRenderer().onGeometryRemove(old);
        }
        this._clearing = false;
        /**
         * clear event.
         *
         * @event maptalks.OverlayLayer#clear
         * @type {Object}
         * @property {String} type - clear
         * @property {maptalks.OverlayLayer} target - layer
         */
        this.fire('clear');
        return this;
    },

    /**
     * Called when geometry is being removed to clear the context concerned.
     * @param  {maptalks.Geometry} geometry - the geometry instance to remove
     * @protected
     */
    onRemoveGeometry:function (geometry) {
        if (!geometry || this._clearing) { return; }
        //考察geometry是否属于该图层
        if (this !== geometry.getLayer()) {
            return;
        }
        var internalId = geometry._getInternalId();
        if (maptalks.Util.isNil(internalId)) {
            return;
        }
        var geoId = geometry.getId();
        if (!maptalks.Util.isNil(geoId)) {
            delete this._geoMap[geoId];
        }
        var idx = this._findInList(geometry);
        if (idx >= 0) {
            this._geoList.splice(idx, 1);
        }
        if (this._getRenderer()) {
            this._getRenderer().onGeometryRemove([geometry]);
        }
    },

    hide: function () {
        for (var i = 0, l = this._geoList.length; i < l; i++) {
            this._geoList[i].onHide();
        }
        return maptalks.Layer.prototype.hide.call(this);
    },

    /**
     * Identify the geometries on the given container point
     * @param  {maptalks.Point} point   - container point
     * @param  {Object} [options=null]  - options
     * @param  {Object} [options.count=null] - result count
     * @return {maptalks.Geometry[]} geometries identified
     */
    identify: function (point, options) {
        options = options || {};
        var geometries = this._geoList,
            filter = options ? options.filter : null,
            extent2d,
            hits = [];
        for (var i = geometries.length - 1; i >= 0; i--) {
            var geo = geometries[i];
            if (!geo || !geo.isVisible() || !geo._getPainter()) {
                continue;
            }
            if (!(geo instanceof maptalks.LineString) || !geo._getArrowStyle()) {
                // Except for LineString with arrows
                extent2d = geo._getPainter().get2DExtent();
                if (!extent2d || !extent2d.contains(point)) {
                    continue;
                }
            }
            if (geo._containsPoint(point) && (!filter || filter(geo))) {
                hits.push(geo);
                if (options['count']) {
                    if (hits.length >= options['count']) {
                        break;
                    }
                }
            }
        }
        return hits;
    },

    _initCache: function () {
        if (!this._geoList) {
            this._geoList = [];
            this._geoMap = {};
        }
    },

    _sortGeometries: function () {
        var me = this;
        this._geoList.sort(function (a, b) {
            return me._compare(a, b);
        });
    },

    _compare: function (a, b) {
        if (a.getZIndex() === b.getZIndex()) {
            return a._getInternalId() - b._getInternalId();
        }
        return a.getZIndex() - b.getZIndex();
    },

    //binarySearch
    _findInList: function (geo) {
        var len = this._geoList.length;
        if (len === 0) {
            return -1;
        }
        var low = 0, high = len - 1, middle;
        while (low <= high) {
            middle = Math.floor((low + high) / 2);
            if (this._geoList[middle] === geo) {
                return middle;
            } else if (this._compare(this._geoList[middle], geo) > 0) {
                high = middle - 1;
            } else {
                low = middle + 1;
            }
        }
        return -1;
    },

    _onGeometryEvent: function (param) {
        if (!param || !param['target']) {
            return;
        }
        var type = param['type'];
        if (type === 'idchange') {
            this._onGeometryIdChange(param);
        } else if (type === 'zindexchange') {
            this._onGeometryZIndexChange(param);
        } else if (type === 'positionchange') {
            this._onGeometryPositionChange(param);
        } else if (type === 'shapechange') {
            this._onGeometryShapeChange(param);
        } else if (type === 'symbolchange') {
            this._onGeometrySymbolChange(param);
        } else if (type === 'show') {
            this._onGeometryShow(param);
        } else if (type === 'hide') {
            this._onGeometryHide(param);
        } else if (type === 'propertieschange') {
            this._onGeometryPropertiesChange(param);
        }
    },

    _onGeometryIdChange: function (param) {
        if (param['new'] === param['old']) {
            if (this._geoMap[param['old']] && this._geoMap[param['old']] === param['target']) {
                return;
            }
        }
        if (!maptalks.Util.isNil(param['new'])) {
            if (this._geoMap[param['new']]) {
                throw new Error('Duplicate geometry id in layer(' + this.getId() + '):' + param['new']);
            }
            this._geoMap[param['new']] = param['target'];
        }
        if (!maptalks.Util.isNil(param['old']) && param['new'] !== param['old']) {
            delete this._geoMap[param['old']];
        }

    },

    _onGeometryZIndexChange: function (param) {
        if (param['old'] !== param['new']) {
            this._sortGeometries();
            if (this._getRenderer()) {
                this._getRenderer().onGeometryZIndexChange(param);
            }
        }
    },

    _onGeometryPositionChange: function (param) {
        if (this._getRenderer()) {
            this._getRenderer().onGeometryPositionChange(param);
        }
    },

    _onGeometryShapeChange: function (param) {
        if (this._getRenderer()) {
            this._getRenderer().onGeometryShapeChange(param);
        }
    },

    _onGeometrySymbolChange: function (param) {
        if (this._getRenderer()) {
            this._getRenderer().onGeometrySymbolChange(param);
        }
    },

    _onGeometryShow: function (param) {
        if (this._getRenderer()) {
            this._getRenderer().onGeometryShow(param);
        }
    },

    _onGeometryHide: function (param) {
        if (this._getRenderer()) {
            this._getRenderer().onGeometryHide(param);
        }
    },

    _onGeometryPropertiesChange: function (param) {
        if (this._getRenderer()) {
            this._getRenderer().onGeometryPropertiesChange(param);
        }
    }
});

maptalks.OverlayLayer.addInitHook(function () {
    this._initCache();
});
