/**
 * @classdesc
 * Base class for all the geometries, it is not intended to be instantiated but extended. <br/>
 * It defines common methods that all the geometry classes share.
 *
 * @class
 * @category geometry
 * @abstract
 * @extends maptalks.Class
 * @mixins maptalks.Eventable
 * @mixins maptalks.Handlerable
 * @mixins maptalks.ui.Menu.Mixin
 */
Z.Geometry = Z.Class.extend(/** @lends maptalks.Geometry.prototype */{
    includes: [Z.Eventable, Z.Handlerable],

    exceptionDefs:{
        'en-US':{
            'DUPLICATE_LAYER':'Geometry cannot be added to two or more layers at the same time.',
            'INVALID_GEOMETRY_IN_COLLECTION':'Geometry is not valid for collection,index:',
            'NOT_ADD_TO_LAYER':'This operation needs geometry to be on a layer.'
        },
        'zh-CN':{
            'DUPLICATE_LAYER':'Geometry���ܱ��ظ���ӵ����ͼ����.',
            'INVALID_GEOMETRY_IN_COLLECTION':'��ӵ������е�Geometry�ǲ��Ϸ���, index:',
            'NOT_ADD_TO_LAYER':'Geometry������ӵ�ĳ��ͼ���ϲ������˲���.'
        }
    },
    /** @lends maptalks.Geometry */
    statics:{
        /**
         * Type of [Point]{@link http://geojson.org/geojson-spec.html#point}
         * @constant
         */
        'TYPE_POINT' : 'Point',
        /**
         * Type of [LineString]{@link http://geojson.org/geojson-spec.html#linestring}
         * @constant
         */
        'TYPE_LINESTRING' : 'LineString',
        /**
         * Type of [Polygon]{@link http://geojson.org/geojson-spec.html#polygon}
         * @constant
         */
        'TYPE_POLYGON' : 'Polygon',
        /**
         * Type of [MultiPoint]{@link http://geojson.org/geojson-spec.html#multipoint}
         * @constant
         */
        'TYPE_MULTIPOINT' : 'MultiPoint',
        /**
         * Type of [MultiLineString]{@link http://geojson.org/geojson-spec.html#multilinestring}
         * @constant
         */
        'TYPE_MULTILINESTRING' : 'MultiLineString',
        /**
         * Type of [MultiPolygon]{@link http://geojson.org/geojson-spec.html#multipolygon}
         * @constant
         */
        'TYPE_MULTIPOLYGON' : 'MultiPolygon',
        /**
         * Type of [GeometryCollection]{@link http://geojson.org/geojson-spec.html#geometrycollection}
         * @constant
         */
        'TYPE_GEOMETRYCOLLECTION' : 'GeometryCollection'
    },

    /**
     * @property {Object} options                       - geometry options
     * @property {Boolean} [options.id=null]           - id of the geometry
     * @property {Boolean} [options.visible=true]       - whether the geometry is visible.
     * @property {Boolean} [options.editable=true]       - whether the geometry can be edited.
     * @property {String} [options.cursor=null]       - cursor style when mouseover the geometry, same as the definition in CSS.
     * @property {Number} [options.shadowBlue=0]       - level of the shadow around the geometry, see [MDN's explanation]{@link https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/shadowBlur}
     * @property {String} [options.shadowColor=black]       - color of the shadow around the geometry, a CSS style color
     * @property {String} [options.measure=EPSG:4326]       - the measure code for the geometry, defines {@tutorial measureGeometry how it can be measured}.
     * @property {Boolean} [options.draggable=false]    - whether the geometry can be dragged.
     * @property {Boolean} [options.dragShadow=false]   - if true, during geometry dragging, a shadow will be dragged before geometry was moved.
     * @property {Boolean} [options.draggableAxis=null] - if set, geometry can only be dragged along the specified axis, possible values: x, y
     */
    options:{
        'id'        : null,
        'visible'   : true,
        'editable'  : true,
        'cursor'    : null,
        'shadowBlur' : 0,
        'shadowColor' : 'black',
        'measure' : 'EPSG:4326' // BAIDU, IDENTITY
    },

    /**
     * Adds the geometry to a layer
     * @param {maptalks.Layer} layer    - layer add to
     * @param {Boolean} fitview         - automatically set the map to a fit center and zoom for the geometry
     * @return {maptalks.Geometry} this
     */
    addTo:function (layer, fitview) {
        layer.addGeometry(this, fitview);
        return this;
    },

    /**
     * Get the layer which this geometry added to.
     * @returns {maptalks.Layer} - layer added to
     */
    getLayer:function () {
        if (!this._layer) { return null; }
        return this._layer;
    },

    /**
     * Get the map which this geometry added to
     * @returns {maptalks.Map} - map added to
     */
    getMap:function () {
        if (!this._layer) { return null; }
        return this._layer.getMap();
    },

    /**
     * Gets geometry's id. Id is set by setId or constructor options.
     * @returns {String|Number} geometry��id
     */
    getId:function () {
        return this._id;
    },

    /**
     * Set geometry's id.
     * @param {String} id - new id
     * @returns {maptalks.Geometry} this
     * @fires maptalks.Geometry#idchange
     */
    setId:function (id) {
        var oldId = this.getId();
        this._id = id;
        //FIXME _idchangedû�б�ͼ�����, layer.getGeometryById�����bug
        /**
         * idchange event.
         *
         * @event maptalks.Geometry#idchange
         * @type {Object}
         * @property {String} type - idchange
         * @property {maptalks.Geometry} target - the geometry fires the event
         * @property {String|Number} old        - value of the old id
         * @property {String|Number} new        - value of the new id
         */
        this._fireEvent('idchange', {'old':oldId, 'new':id});
        return this;
    },

    /**
     * Get geometry's properties. Defined by GeoJSON as [feature's properties]{@link http://geojson.org/geojson-spec.html#feature-objects}.
     *
     * @returns {Object} properties
     */
    getProperties:function () {
        if (!this.properties) {
            if (this._getParent()) {
                return this._getParent().getProperties();
            }
            return null;
        }
        return this.properties;
    },

    /**
     * Set a new properties to geometry.
     * @param {Object} properties - new properties
     * @returns {maptalks.Geometry} this
     * @fires maptalks.Geometry#propertieschange
     */
    setProperties:function (properties) {
        var old = this.properties;
        this.properties = Z.Util.isObject(properties) ? Z.Util.extend({}, properties) : properties;
        /**
         * propertieschange event, thrown when geometry's properties is changed.
         *
         * @event maptalks.Geometry#propertieschange
         * @type {Object}
         * @property {String} type - propertieschange
         * @property {maptalks.Geometry} target - the geometry fires the event
         * @property {String|Number} old        - value of the old properties
         * @property {String|Number} new        - value of the new properties
         */
        this._fireEvent('propertieschange', {'old':old, 'new':properties});
        return this;
    },

    /**
     * Get type of the geometry, e.g. "Point", "LineString"
     * @returns {String} type of the geometry
     */
    getType:function () {
        return this.type;
    },


    /**
     * Get symbol of the geometry
     * @returns {Object} geometry's symbol
     */
    getSymbol:function () {
        var s = this._symbol;
        if (s) {
            if (!Z.Util.isArray(s)) {
                return Z.Util.extend({}, s);
            } else {
                return Z.Util.extendSymbol(s);
            }
        }
        return null;
    },

    /**
     * Set a new symbol to style the geometry.
     * @param {Object} symbol - new symbol
     * @see {@tutorial symbol Style a geometry with symbols}
     * @return {maptalks.Geometry} this
     * @fires maptalks.Geometry#symbolchange
     */
    setSymbol:function (symbol) {
        this._symbol = this._prepareSymbol(symbol);
        this._onSymbolChanged();
        return this;
    },

    /**
     * Returns the first coordinate of the geometry.
     * @return {maptalks.Coordinate} First Coordinate
     */
    getFirstCoordinate:function () {
        if (this instanceof Z.GeometryCollection) {
            var geometries = this.getGeometries();
            if (!geometries || !Z.Util.isArrayHasData(geometries)) {
                return null;
            }
            return geometries[0].getFirstCoordinate();
        }
        var coordinates = this.getCoordinates();
        if (!Z.Util.isArray(coordinates)) {
            return coordinates;
        }
        var first = coordinates;
        do {
            first = first[0];
        } while (Z.Util.isArray(first));
        return first;
    },

    /**
     * Returns the last coordinate of the geometry.
     * @return {maptalks.Coordinate} Last Coordinate
     */
    getLastCoordinate:function () {
        if (this instanceof Z.GeometryCollection) {
            var geometries = this.getGeometries();
            if (!geometries || !Z.Util.isArrayHasData(geometries)) {
                return null;
            }
            return geometries[geometries.length - 1].getLastCoordinate();
        }
        var coordinates = this.getCoordinates();
        if (!Z.Util.isArray(coordinates)) {
            return coordinates;
        }
        var last = coordinates;
        do {
            last = last[last.length - 1];
        } while (Z.Util.isArray(last));
        return last;
    },

    /**
     * Get the geometry's extent
     * @returns {maptalksExtent} geometry's extent
     */
    getExtent:function () {
        var prjExt = this._getPrjExtent();
        if (prjExt) {
            var p = this._getProjection();
            return new Z.Extent(p.unproject(new Z.Coordinate(prjExt['xmin'], prjExt['ymin'])), p.unproject(new Z.Coordinate(prjExt['xmax'], prjExt['ymax'])));
        } else {
            return this._computeExtent(this._getMeasurer());
        }

    },

    /**
     * Whehter the geometry contains the input container point.
     * @param  {maptalks.Point} point - input container point
     * @param  {Number} t - tolerance in pixel
     * @return {Boolean}
     */
    containsPoint: function (containerPoint, t) {
        if (!this.getMap()) {
            throw new Error('The geometry is required to be on a map to perform "containsPoint".');
        }
        return this._containsPoint(this.getMap().containerPointToViewPoint(containerPoint), t);
    },

    /**
     * Get size in pixel of the geometry, size may vary in different zoom levels.
     * @returns {maptalks.Size}
     */
    getSize: function () {
        var map = this.getMap();
        if (!map) {
            return null;
        }
        var pxExtent = this._getPainter().getViewExtent();
        return new Z.Size(Math.round(Math.abs(pxExtent['xmax'] - pxExtent['xmin'])),
            Math.round(Math.abs(pxExtent['ymax'] - pxExtent['ymin'])));
    },

    /**
     * Get the geographical center of the geometry.
     * @returns {maptalks.Coordinate}
     */
    getCenter:function () {
        return this._computeCenter(this._getMeasurer()).copy();
    },

    /**
     * Show the geometry.
     * @return {maptalks.Geometry} this
     * @fires maptalks.Geometry#show
     */
    show:function () {
        this.options['visible'] = true;
        if (this.getMap()) {
            var painter = this._getPainter();
            if (painter) {
                painter.show();
            }
            /**
             * show event
             *
             * @event maptalks.Geometry#show
             * @type {Object}
             * @property {String} type - show
             * @property {maptalks.Geometry} target - the geometry fires the event
             */
            this._fireEvent('show');
        }
        return this;
    },

    /**
     * Hide the geometry
     * @return {maptalks.Geometry} this
     * @fires maptalks.Geometry#hide
     */
    hide:function () {
        this.options['visible'] = false;
        if (this.getMap()) {
            var painter = this._getPainter();
            if (painter) {
                painter.hide();
            }
            /**
             * hide event
             *
             * @event maptalks.Geometry#hide
             * @type {Object}
             * @property {String} type - hide
             * @property {maptalks.Geometry} target - the geometry fires the event
             */
            this._fireEvent('hide');
        }
        return this;
    },

    /**
     * Whether the geometry is visible
     * @returns {Boolean}
     */
    isVisible:function () {
        if (!this.options['visible']) {
            return false;
        }
        var symbol = this._getInternalSymbol();
        if (!symbol) {
            return true;
        }
        if (Z.Util.isArray(symbol)) {
            if (symbol.length === 0) {
                return true;
            }
            for (var i = 0, len = symbol.length; i < len; i++) {
                if (Z.Util.isNil(symbol[i]['opacity']) || symbol[i]['opacity'] > 0) {
                    return true;
                }
            }
            return false;
        } else {
            return (Z.Util.isNil(symbol['opacity']) || (Z.Util.isNumber(symbol['opacity']) && symbol['opacity'] > 0));
        }
    },

    /**
     * Translate or move the geometry by the given offset.
     * @param  {maptalks.Coordinate} offset - translate offset
     * @return {maptalks.Geometry} this
     */
    translate:function (offset) {
        if (!offset) {
            return this;
        }
        offset = new Z.Coordinate(offset);
        if (offset.x === 0 && offset.y === 0) {
            return this;
        }
        var coordinates = this.getCoordinates();
        if (coordinates) {
            if (Z.Util.isArray(coordinates)) {
                var translated = Z.Util.mapArrayRecursively(coordinates, function (coord) {
                    return coord.add(offset);
                });
                this.setCoordinates(translated);
            } else {
                this.setCoordinates(coordinates.add(offset));
            }
        }
        return this;
    },

    /**
     * flash the geometry, show and hide by certain internal for times of count.
     *
     * @param {Number} [interval=100]     - interval of flash, in millisecond (ms)
     * @param {Number} [count=4]          - flash times
     * @param {Function} [cb=null]        - callback function when flash ended
     * @param {*} [context=null]          - callback context
     * @return {maptalks.Geometry} this
     */
    flash: function (interval, count, cb, context) {
        if (!interval) {
            interval = 100;
        }
        if (!count) {
            count = 4;
        }
        var me = this;
        count *= 2;
        if (this._flashTimeout) {
            clearTimeout(this._flashTimeout);
        }
        function flashGeo() {
            if (count === 0) {
                me.show();
                if (cb) {
                    if (context) {
                        cb.call(context);
                    } else {
                        cb();
                    }
                }
                return;
            }

            if (count % 2 === 0) {
                me.hide();
            } else {
                me.show();
            }
            count--;
            me._flashTimeout = setTimeout(flashGeo, interval);
        }
        this._flashTimeout = setTimeout(flashGeo, interval);
        return this;
    },

    /**
     * Returns a copy of the geometry without the event listeners.
     * @returns {maptalks.Geometry} copy
     */
    copy:function () {
        var json = this.toJSON();
        //FIXME symbol��Ϣû�б���������
        var ret = Z.Geometry.fromJSON(json);
        //restore visibility
        ret.options['visible'] = true;
        return ret;
    },


    /**
     * remove itself from the layer if any.
     * @returns {maptalks.Geometry} this
     * @fires maptalks.Geometry#removestart
     * @fires maptalks.Geometry#remove
     */
    remove:function () {
        var layer = this.getLayer();
        if (!layer) {
            return this;
        }
        /**
         * removestart event.
         *
         * @event maptalks.Geometry#removestart
         * @type {Object}
         * @property {String} type - removestart
         * @property {maptalks.Geometry} target - the geometry fires the event
         */
        this._fireEvent('removestart');

        this._unbind();
        /**
         * remove event.
         *
         * @event maptalks.Geometry#remove
         * @type {Object}
         * @property {String} type - remove
         * @property {maptalks.Geometry} target - the geometry fires the event
         */
        this._fireEvent('remove');
        return this;
    },

    /**
     * Exports a GeoJSON [geometry]{@link http://geojson.org/geojson-spec.html#feature-objects} (part of a feature) out of the geometry.
     * @return {Object} GeoJSON Geometry
     */
    toGeoJSONGeometry:function () {
        var gJson = this._exportGeoJSONGeometry();
        return gJson;
    },

    /**
     * Exports a GeoJSON feature out of the geometry.
     * @param {Object} [opts=null]              - export options
     * @param {Boolean} [opts.geometry=true]    - whether export geometry
     * @param {Boolean} [opts.properties=true]  - whether export properties
     * @returns {Object} GeoJSON Feature
     */
    toGeoJSON:function (opts) {
        if (!opts) {
            opts = {};
        }
        var feature = {
            'type':'Feature',
            'geometry':null
        };
        if (Z.Util.isNil(opts['geometry']) || opts['geometry']) {
            var geoJSON = this._exportGeoJSONGeometry();
            feature['geometry'] = geoJSON;
        }
        var id = this.getId();
        if (!Z.Util.isNil(id)) {
            feature['id'] = id;
        }
        var properties;
        if (Z.Util.isNil(opts['properties']) || opts['properties']) {
            properties = this._exportProperties();
        }
        feature['properties'] = properties;
        return feature;
    },

    /**
     * Export a profile json out of the geometry. <br>
     * Besides exporting the feature object, a profile json also contains symbol, construct options and infowindow info.<br>
     * The profile json can be stored somewhere else and be used to reproduce the geometry later.<br>
     * Due to the problem of serialization for functions, event listeners and contextmenu are not included in profile json.
     * @example
     *     // an example of a profile json.
     * var profile = {
            "feature": {
                  "type": "Feature",
                  "id" : "point1",
                  "geometry": {"type": "Point", "coordinates": [102.0, 0.5]},
                  "properties": {"prop0": "value0"}
            },
            //construct options.
            "options":{
                "draggable" : true
            },
            //symbol
            "symbol":{
                "markerFile"  : "http://foo.com/icon.png",
                "markerWidth" : 20,
                "markerHeight": 20
            },
            //infowindow info
            "infowindow" : {
                "options" : {
                    "style" : "black"
                },
                "title" : "this is a infowindow title",
                "content" : "this is a infowindow content"
            }
        };
     * @param {Object}  [options=null]          - export options
     * @param {Boolean} [opts.geometry=true]    - whether export feature's geometry
     * @param {Boolean} [opts.properties=true]  - whether export feature's properties
     * @param {Boolean} [opts.options=true]     - whether export construct options
     * @param {Boolean} [opts.symbol=true]      - whether export symbol
     * @param {Boolean} [opts.infoWindow=true]  - whether export infowindow
     * @return {Object} profile json object
     */
    toJSON:function (options) {
        //һ��Graphic��profile
        /*
            //��Ϊ��Ӧ�����޷������л�, ����menu, �¼�listener���޷���������graphic��
        }*/
        if (!options) {
            options = {};
        }
        var json = this._toJSON(options);
        var other = this._exportGraphicOptions(options);
        Z.Util.extend(json, other);
        return json;
    },

    /**
     * Get the geographic length of the geometry.
     * @returns {Number} geographic length
     */
    getLength:function () {
        return this._computeGeodesicLength(this._getMeasurer());
    },

    /**
     * Get the geographic area of the geometry.
     * @returns {Number} geographic area
     * @expose
     */
    getArea:function () {
        return this._computeGeodesicArea(this._getMeasurer());
    },

    /**
     * Get the connect points for [ConnectorLine]{@link maptalks.ConnectorLine}
     * @return {maptalks.Coordinate[]} connect points
     * @private
     */
    _getConnectPoints: function () {
        return [this.getCenter()];
    },

    //options initializing
    _initOptions:function (opts) {
        if (!opts) {
            opts = {};
        }
        var symbol = opts['symbol'];
        var properties = opts['properties'];
        var id = opts['id'];
        Z.Util.setOptions(this, opts);
        delete this.options['symbol'];
        delete this.options['id'];
        delete this.options['properties'];
        if (symbol) {
            this.setSymbol(symbol);
        }
        if (properties) {
            this.setProperties(properties);
        }
        if (!Z.Util.isNil(id)) {
            this.setId(id);
        }
    },

    //����prepareʱ,layer�Ѿ�ע�ᵽmap��
    _bindLayer:function (layer) {
         //Geometry�������ظ���ӵ����ͼ����
        if (this.getLayer()) {
            throw new Error(this.exceptions['DUPLICATE_LAYER']);
        }
        this._layer = layer;
        //���ͶӰ�����ı�,����������е�ͶӰ��������
        this._clearProjection();
        this.callInitHooks();
    },

    _prepareSymbol:function (symbol) {
        if (Z.Util.isArray(symbol)) {
            var cookedSymbols = [];
            for (var i = 0; i < symbol.length; i++) {
                cookedSymbols.push(Z.Util.convertResourceUrl(symbol[i]));
            }
            return cookedSymbols;
        } else {
            return Z.Util.convertResourceUrl(symbol);
        }
    },

    /**
     * Sets a external symbol to the geometry, e.g. style from VectorLayer's setStyle
     * @private
     * @param {Object} symbol - external symbol
     */
    _setExternSymbol: function (symbol) {
        this._externSymbol = this._prepareSymbol(symbol);
        this._onSymbolChanged();
        return this;
    },

    _getInternalSymbol:function () {
        if (this._symbol) {
            return this._symbol;
        } else if (this._externSymbol) {
            return this._externSymbol;
        } else if (this.options['symbol']) {
            return this.options['symbol'];
        }
        return null;
    },


    _getPrjExtent:function () {
        var p = this._getProjection();
        if (!this._extent && p) {
            var ext = this._computeExtent(p);
            if (ext) {
                var isAntiMeridian = this.options['antiMeridian'];
                if (isAntiMeridian && isAntiMeridian !== 'default') {
                    var firstCoordinate = this.getFirstCoordinate();
                    if (isAntiMeridian === 'continuous') {
                        if (ext['xmax'] - ext['xmin'] > 180) {
                            if (firstCoordinate.x > 0) {
                                ext['xmin'] += 360;
                            } else {
                                ext['xmax'] -= 360;
                            }
                        }
                    }
                    if (ext['xmax'] < ext['xmin']) {
                        var tmp = ext['xmax'];
                        ext['xmax'] = ext['xmin'];
                        ext['xmin'] = tmp;
                    }
                }
                this._extent = new Z.Extent(p.project(new Z.Coordinate(ext['xmin'], ext['ymin'])),
                    p.project(new Z.Coordinate(ext['xmax'], ext['ymax'])));
            }

        }
        return this._extent;
    },

    _unbind:function () {
        var layer = this.getLayer();
        if (!layer) {
            return;
        }
        //contextmenu
        this._unbindMenu();
        //infowindow
        this._unbindInfoWindow();
        if (this.isEditing()) {
            this.endEdit();
        }
        this._removePainter();
        if (this._onRemove) {
            this._onRemove();
        }
        layer._onGeometryRemove(this);
        delete this._layer;
        delete this._internalId;
        delete this._extent;
    },

    _getInternalId:function () {
        return this._internalId;
    },

    //ֻ�ܱ�ͼ�����
    _setInternalId:function (id) {
        this._internalId = id;
    },

    _getMeasurer:function () {
        if (this._getProjection()) {
            return this._getProjection();
        }
        return Z.MeasurerUtil.getInstance(this.options['measure']);
    },

    _getProjection:function () {
        var map = this.getMap();
        if (map && map.getProjection()) {
            return map.getProjection();
        }
        return null;
    },

    //��ȡgeometry��ʽ���������ⲿͼƬ��Դ
    _getExternalResources:function () {
        var geometry = this;
        var symbol = geometry._getInternalSymbol();
        var resources = Z.Util.getExternalResources(this._interpolateSymbol(symbol));
        return resources;
    },

    _interpolateSymbol: function (symbol) {
        var result;
        if (Z.Util.isArray(symbol)) {
            result = [];
            for (var i = 0; i < symbol.length; i++) {
                result.push(this._interpolateSymbol(symbol[i]));
            }
            return result;
        }
        result = {};
        for (var p in symbol) {
            if (symbol.hasOwnProperty(p)) {
                if (Z.Util.isFunctionDefinition(symbol[p])) {
                    if (!this.getMap()) {
                        result[p] = null;
                    } else {
                        result[p] = Z.Util.interpolated(symbol[p])(this.getMap().getZoom(), this.getProperties());
                    }
                } else {
                    result[p] = symbol[p];
                }
            }
        }
        return result;
    },

    _getPainter:function () {
        if (this.getMap() && !this._painter) {
            if (this instanceof Z.GeometryCollection) {
                this._painter = new Z.CollectionPainter(this);
            } else {
                this._painter = new Z.Painter(this);
            }
        }
        return this._painter;
    },

    _removePainter:function () {
        if (this._painter) {
            this._painter.remove();
        }
        delete this._painter;
    },

    _onZoomEnd:function () {
        if (this._painter) {
            this._painter.onZoomEnd();
        }
    },

    _isEditingOrDragging:function () {
        return ((this.isEditing && this.isEditing()) || (this.isDragging && this.isDragging()));
    },

    _onShapeChanged:function () {
        this._extent = null;
        var painter = this._getPainter();
        if (painter) {
            painter.repaint();
        }
        /**
         * shapechange event.
         *
         * @event maptalks.Geometry#shapechange
         * @type {Object}
         * @property {String} type - shapechange
         * @property {maptalks.Geometry} target - the geometry fires the event
         */
        this._fireEvent('shapechange');
    },

    _onPositionChanged:function () {
        this._extent = null;
        var painter = this._getPainter();
        if (painter) {
            painter.repaint();
        }
        /**
         * positionchange event.
         *
         * @event maptalks.Geometry#positionchange
         * @type {Object}
         * @property {String} type - positionchange
         * @property {maptalks.Geometry} target - the geometry fires the event
         */
        this._fireEvent('positionchange');
    },

    _onSymbolChanged:function () {
        var painter = this._getPainter();
        if (painter) {
            painter.refreshSymbol();
        }
        /**
         * symbolchange event.
         *
         * @event maptalks.Geometry#symbolchange
         * @type {Object}
         * @property {String} type - symbolchange
         * @property {maptalks.Geometry} target - the geometry fires the event
         */
        this._fireEvent('symbolchange');
    },
    /**
     * Set a parent to the geometry, which is usually a MultiPolygon, GeometryCollection, etc
     * @param {maptalks.GeometryCollection} geometry - parent geometry
     * @private
     */
    _setParent:function (geometry) {
        if (geometry) {
            this._parent = geometry;
        }
    },

    _getParent:function () {
        return this._parent;
    },

    _fireEvent:function (eventName, param) {
        this.fire(eventName, param);
    },

    _toJSON: function (options) {
        return {
            'feature' : this.toGeoJSON(options)
        };
    },

    _exportGraphicOptions:function (options) {
        var json = {};
        if (Z.Util.isNil(options['options']) || options['options']) {
            json['options'] = this.config();
        }
        if (Z.Util.isNil(options['symbol']) || options['symbol']) {
            json['symbol'] = this.getSymbol();
        }
        if (Z.Util.isNil(options['infoWindow']) || options['infoWindow']) {
            if (this._infoWinOptions) {
                json['infoWindow'] = this._infoWinOptions;
            }
        }
        return json;
    },

    _exportGeoJSONGeometry:function () {
        var points = this.getCoordinates();
        var coordinates = Z.GeoJSON.toNumberArrays(points);
        return {
            'type'        : this.getType(),
            'coordinates' : coordinates
        };
    },

    _exportProperties: function () {
        var properties = null;
        var geoProperties = this.getProperties();
        if (geoProperties) {
            if (Z.Util.isObject(geoProperties)) {
                properties = Z.Util.extend({}, geoProperties);
            } else {
                geoProperties = properties;
            }
        }
        return properties;
    }

});

/**
 * Produce a geometry from one or more [profile json]{@link maptalks.Geometry#toJSON} or GeoJSON.
 * @static
 * @param  {Object} json - a geometry's profile json or a geojson
 * @return {maptalks.Geometry} geometry
 * @example
 * var profile = {
        "feature": {
              "type": "Feature",
              "id" : "point1",
              "geometry": {"type": "Point", "coordinates": [102.0, 0.5]},
              "properties": {"prop0": "value0"}
        },
        //construct options.
        "options":{
            "draggable" : true
        },
        //symbol
        "symbol":{
            "markerFile"  : "http://foo.com/icon.png",
            "markerWidth" : 20,
            "markerHeight": 20
        }
    };
    var marker = maptalks.Geometry.fromJSON(profile);
 */
Z.Geometry.fromJSON = function (json) {
    if (Z.Util.isArray(json)) {
        var result = [], c;
        for (var i = 0, len = json.length; i < len; i++) {
            c = Z.Geometry.fromJSON(json[i]);
            if (Z.Util.isArray(json)) {
                result = result.concat(c);
            } else {
                result.push(c);
            }
        }
        return result;
    }

    if (json && !json['feature']) {
        return Z.GeoJSON.toGeometry(json);
    }
    var geometry;
    if (json['subType']) {
        geometry = Z[json['subType']]._fromJSON(json);
        if (!Z.Util.isNil(json['feature']['id'])) {
            geometry.setId(json['feature']['id']);
        }
    } else {
        var feature = json['feature'];
        geometry = Z.GeoJSON.toGeometry(feature);
        if (json['options']) {
            geometry.config(json['options']);
        }
    }
    if (json['symbol']) {
        geometry.setSymbol(json['symbol']);
    }
    if (json['infoWindow']) {
        geometry.setInfoWindow(json['infoWindow']);
    }
    return geometry;
};


Z.Geometry._getMarkerPathURL = function (symbol) {
    if (!symbol['markerPath']) {
        return null;
    }
    var op, styles =  Z.symbolizer.VectorMarkerSymbolizer.translateToSVGStyles(symbol);
    //context.globalAlpha doesn't take effect with drawing SVG in IE9/10/11 and EGDE, so set opacity in SVG element.
    if (Z.Util.isNumber(symbol['markerOpacity'])) {
        op = symbol['markerOpacity'];
    }
    if (Z.Util.isNumber(symbol['opacity'])) {
        op *= symbol['opacity'];
    }
    var p, svgStyles = {};
    if (styles) {
        for (p in styles['stroke']) {
            if (styles['stroke'].hasOwnProperty(p)) {
                if (!Z.Util.isNil(styles['stroke'][p])) {
                    svgStyles[p] = styles['stroke'][p];
                }
            }
        }
        for (p in styles['fill']) {
            if (styles['fill'].hasOwnProperty(p)) {
                if (!Z.Util.isNil(styles['fill'][p])) {
                    svgStyles[p] = styles['fill'][p];
                }
            }
        }
    }

    var pathes = Z.Util.isArray(symbol['markerPath']) ? symbol['markerPath'] : [symbol['markerPath']];
    var i, path, pathesToRender = [];
    for (i = 0; i < pathes.length; i++) {
        path = Z.Util.isString(pathes[i]) ? {'path' : pathes[i]} : pathes[i];
        path = Z.Util.extend({}, path, svgStyles);
        path['d'] = path['path'];
        delete path['path'];
        pathesToRender.push(path);
    }
    var svg = ['<svg version="1.1"', 'xmlns="http://www.w3.org/2000/svg"'];
    if (op < 1) {
        svg.push('opacity="' + op + '"');
    }
    if (symbol['markerWidth'] && symbol['markerHeight']) {
        svg.push('height="' + symbol['markerHeight'] + '" width="' + symbol['markerWidth'] + '"');
    }
    if (symbol['markerPathWidth'] && symbol['markerPathHeight']) {
        svg.push('viewBox="0 0 ' + symbol['markerPathWidth'] + ' ' + symbol['markerPathHeight'] + '"');
    }
    svg.push('preserveAspectRatio="none"');
    svg.push('><defs></defs>');

    for (i = 0; i < pathesToRender.length; i++) {
        var strPath = '<path ';
        for (p in pathesToRender[i]) {
            if (pathesToRender[i].hasOwnProperty(p)) {
                strPath += ' ' + p + '="' + pathesToRender[i][p] + '"';
            }
        }
        strPath += '></path>';
        svg.push(strPath);
    }
    svg.push('</svg>');
    var b64 = 'data:image/svg+xml;base64,' + Z.Util.btoa(svg.join(' '));
    return b64;
};
