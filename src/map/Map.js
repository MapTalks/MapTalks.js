/**
 *
 * @class
 * @category map
 * @extends {maptalks.Class}
 *
 * @param {(string|HTMLElement|object)} container - The container to create the map on, can be:<br>
 *                                          1. A HTMLElement container.<br/>
 *                                          2. ID of a HTMLElement container.<br/>
 *                                          3. A canvas compatible container in node,
 *                                          e.g. [node-canvas]{@link https://github.com/Automattic/node-canvas},
 *                                              [canvas2svg]{@link https://github.com/gliffy/canvas2svg}
 * @param {Object} options - construct options
 * @param {(Number[]|maptalks.Coordinate)} options.center - initial center of the map.
 * @param {Number} options.zoom - initial zoom of the map.
 * @param {Object} [options.view=null] - map's view config, default is using projection EPSG:3857 with resolutions used by google map/osm.
 * @param {maptalks.Layer} [options.baseLayer=null] - base layer that will be set to map initially.
 * @param {maptalks.Layer[]} [options.layers=null] - layers that will be added to map initially.
 * @param {*} options.* - any other option defined in [Map.options]{@link maptalks.Map#options}
 *
 * @mixes maptalks.Eventable
 * @mixes maptalks.Handlerable
 * @mixes maptalks.ui.Menu.Mixin
 *
 * @classdesc
 * The central class of the library, to create a map on a container.
 * @example
 * var map = new maptalks.Map("map",{
        center:     [180,0],
        zoom:  4,
        baseLayer : new maptalks.TileLayer("base",{
            urlTemplate:'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            subdomains:['a','b','c']
        }),
        layers : [
            new VectorLayer('v')
            .addGeometry(new maptalks.Marker([180, 0]))
        ]
    });
 */
Z.Map = Z.Class.extend(/** @lends maptalks.Map.prototype */{

    includes: [Z.Eventable, Z.Handlerable],

    /**
     * @property {Object} options                                   - map's options, options must be updated by config method:<br> map.config('zoomAnimation', false);
     * @property {Boolean} [options.centerCross=false]              - Display a red cross in the center of map
     * @property {Boolean} [options.clipFullExtent=false]           - clip geometries outside map's full extent
     * @property {Boolean} [options.zoomAnimation=true]             - enable zooming animation
     * @property {Number}  [options.zoomAnimationDuration=330]      - zoom animation duration.
     * @property {Boolean} [options.zoomBackground=true]            - leaves a background after zooming.
     * @property {Boolean} [options.layerZoomAnimation=true]        - also animate layers when zooming.
     * @property {Boolean} [options.layerTransforming=true]         - update points when transforming (e.g. zoom animation), this may bring drastic low performance when rendering a large number of points.
     * @property {Boolean} [options.panAnimation=true]              - continue to animate panning when draging or touching ended.
     * @property {Boolean} [options.panAnimationDuration=600]       - duration of pan animation.
     * @property {Boolean} [options.zoomable=true]                  - whether to enable map zooming.
     * @property {Boolean} [options.enableInfoWindow=true]          - whether to enable infowindow on this map.
     * @property {Boolean} [options.hitDetect=true]                 - whether to enable hit detecting of layers for cursor style on this map, disable it to improve performance.
     * @property {Number}  [options.maxZoom=null]                   - the maximum zoom the map can be zooming to.
     * @property {Number}  [options.minZoom=null]                   - the minimum zoom the map can be zooming to.
     * @property {maptalks.Extent} [options.maxExtent=null]         - when maxExtent is set, map will be restricted to the give max extent and bouncing back when user trying to pan ouside the extent.
     *
     * @property {Boolean} [options.draggable=true]                         - disable the map dragging if set to false.
     * @property {Boolean} [options.doublClickZoom=true]                    - whether to allow map to zoom by double click events.
     * @property {Boolean} [options.scrollWheelZoom=true]                   - whether to allow map to zoom by scroll wheel events.
     * @property {Boolean} [options.touchZoom=true]                         - whether to allow map to zoom by touch events.
     * @property {Boolean} [options.autoBorderPanning=false]                - whether to pan the map automatically if mouse moves on the border of the map
     * @property {Boolean} [options.geometryEvents=true]                    - enable/disable firing geometry events
     *
     * @property {Boolean}        [options.control=true]                    - whether allow map to add controls.
     * @property {Boolean|Object} [options.attributionControl=false]        - display the attribution control on the map if set to true or a object as the control construct option.
     * @property {Boolean|Object} [options.zoomControl=false]               - display the zoom control on the map if set to true or a object as the control construct option.
     * @property {Boolean|Object} [options.scaleControl=false]              - display the scale control on the map if set to true or a object as the control construct option.
     * @property {Boolean|Object} [options.overviewControl=false]           - display the overview control on the map if set to true or a object as the control construct option.
     *
     * @property {String} [options.renderer=canvas]                 - renderer type. Don't change it if you are not sure about it. About renderer, see [TODO]{@link tutorial.renderer}.
     */
    options:{
        'centerCross' : false,

        'clipFullExtent' : false,

        'zoomAnimation' : true,
        'zoomAnimationDuration' : 330,
        //still leave background after zooming, set it to false if baseLayer is a transparent layer
        'zoomBackground' : true,
        //controls whether other layers than base tilelayer will show during zoom animation.
        'layerZoomAnimation' : true,

        //economically transform, whether point symbolizers transforms during transformation (e.g. zoom animation)
        //set to true can prevent drastic low performance when number of point symbolizers is large.
        'layerTransforming' : true,

        'panAnimation':true,
        //default pan animation duration
        'panAnimationDuration' : 600,

        'zoomable':true,
        'enableInfoWindow':true,

        'hitDetect' : (function () { return !Z.Browser.mobile; })(),

        'maxZoom' : null,
        'minZoom' : null,
        'maxExtent' : null,

        'checkSize' : true,

        'renderer' : 'canvas'
    },

    //Exception definitions in English and Chinese.
    exceptionDefs:{
        'en-US':{
            'INVALID_OPTION':'Invalid options provided.',
            'INVALID_CENTER':'Invalid Center',
            'INVALID_LAYER_ID':'Invalid id for the layer',
            'DUPLICATE_LAYER_ID':'the id of the layer is duplicate with another layer'
        },
        'zh-CN':{
            'INVALID_OPTION':'无效的option.',
            'INVALID_CENTER':'无效的中心点',
            'INVALID_LAYER_ID':'图层的id无效',
            'DUPLICATE_LAYER_ID':'重复的图层id'
        }
    },


    initialize:function (container, options) {

        if (!options) {
            throw new Error(this.exceptions['INVALID_OPTION']);
        }

        this._loaded = false;

        if (Z.Util.isString(container)) {
            this._containerDOM = document.getElementById(container);
            if (!this._containerDOM) {
                throw new Error('invalid container: \'' + container + '\'');
            }
        } else {
            this._containerDOM = container;
            if (Z.node) {
                //Reserve container's constructor in node for canvas creating.
                this.CanvasClass = this._containerDOM.constructor;
            }
        }

        if (!Z.node) {
            if (this._containerDOM.childNodes && this._containerDOM.childNodes.length > 0) {
                if (this._containerDOM.childNodes[0].className === 'maptalks-wrapper') {
                    throw new Error('Container is already loaded with another map instance, use map.remove() to clear it.');
                }
            }
        }

        if (!options['center']) {
            throw new Error(this.exceptions['INVALID_CENTER']);
        }

        this._panels = {};

        //Layers
        this._baseLayer = null;
        this._layers = [];

        //shallow copy options
        var opts = Z.Util.extend({}, options);

        this._zoomLevel = opts['zoom'];
        delete opts['zoom'];
        this._center = new Z.Coordinate(opts['center']);
        delete opts['center'];

        var baseLayer = opts['baseLayer'];
        delete opts['baseLayer'];
        var layers = opts['layers'];
        delete opts['layers'];

        Z.Util.setOptions(this, opts);
        this.setView(opts['view']);

        if (baseLayer) {
            this.setBaseLayer(baseLayer);
        }
        if (layers) {
            this.addLayer(layers);
        }

        this._mapViewPoint = new Z.Point(0, 0);

        this._initRenderer();
        this._getRenderer().initContainer();
        this._updateMapSize(this._getContainerDomSize());

        this._Load();
    },

    /**
     * Whether the map is loaded or not.
     * @return {Boolean}
     */
    isLoaded:function () {
        return this._loaded;
    },

    /**
     * Whether the map is rendered by canvas
     * @return {Boolean}
     * @protected
     * @example
     * var isCanvas = map.isCanvasRender();
     */
    isCanvasRender:function () {
        var renderer = this._getRenderer();
        if (renderer) {
            return renderer.isCanvasRender();
        }
        return false;
    },

    /**
     * Get the view of the Map.
     * @return {maptalks.View} map's view
     */
    getView: function () {
        if (!this._view) {
            return null;
        }
        return this._view;
    },

    /**
     * Change the view of the map. <br>
     * A view is a series of settings to decide the map presentation:<br>
     * 1. the projection.<br>
     * 2. zoom levels and resolutions. <br>
     * 3. full extent.<br>
     * There are some [predefined views]{@link http://www.foo.com}, and surely you can [define a custom one.]{@link http://www.foo.com}.<br>
     * View can also be set by map.config('view', view);
     * @param {maptalks.View} view - view settings
     * @returns {maptalks.Map} this
     * @fires maptalks.Map#viewchange
     * @example
     *  map.setView({
            projection:'EPSG:4326',
            resolutions: (function() {
                var resolutions = [];
                for (var i=0; i < 19; i++) {
                    resolutions[i] = 180/(Math.pow(2, i)*128);
                }
                return resolutions;
            })()
        });
     */
    setView:function (view) {
        var oldView = this.options['view'];
        if (oldView && !view) {
            return this;
        }
        this._center = this.getCenter();
        this.options['view'] =  view;
        this._view = new Z.View(view);
        if (this.options['view'] && Z.Util.isFunction(this.options['view']['projection'])) {
            var projection = this._view.getProjection();
            //save projection code for map profiling (toJSON/fromJSON)
            this.options['view']['projection'] = projection['code'];
        }
        this._resetMapStatus();
        /**
         * viewchange event, fired when map's view is updated.
         *
         * @event maptalks.Map#viewchange
         * @type {Object}
         * @property {String} type - viewchange
         * @property {maptalks.Map} target - map
         * @property {maptalks.Map} old - the old view
         * @property {maptalks.Map} new - the new view changed to
         */
        this._fireEvent('viewchange', {'old' : oldView, 'new' : Z.Util.extend({}, this.options['view'])});
        return this;
    },

    /**
     * Callback when any option is updated
     * @private
     * @param  {Object} conf - options to update
     * @return {maptalks.Map}   this
     */
    onConfig:function (conf) {
        if (!Z.Util.isNil(conf['view'])) {
            this.setView(conf['view']);
        }
        return this;
    },

    /**
     * Get the projection of the map. <br>
     * Projection is an algorithm for map projection, e.g. well-known [Mercator Projection]{@link https://en.wikipedia.org/wiki/Mercator_projection} <br>
     * A projection must have 2 methods: <br>
     * 1. project(coordinate) - project the input coordinate <br>
     * 2. unproject(coordinate) - unproject the input coordinate <br>
     * Projection also contains measuring method usually extended from a measurer: <br>
     * 1. measureLength(coord1, coord2) - compute length between 2 coordinates.  <br>
     * 2. measureArea(coords[]) - compute area of the input coordinates. <br>
     * 3. locate(coord, distx, disty) - compute the coordinate from the coord with xdist on axis x and ydist on axis y.
     * @return {Object}
     */
    getProjection:function () {
        return this._view.getProjection();
    },

    /**
     * Get map's full extent, which is defined in map's view. <br>
     * eg: {'left': -180, 'right' : 180, 'top' : 90, 'bottom' : -90}
     * @return {maptalks.Extent}
     */
    getFullExtent:function () {
        return this._view.getFullExtent();
    },

    /**
     * Set map's cursor style, cursor style is same with CSS.
     * @param {String} cursor - cursor style
     * @returns {maptalks.Map} this
     * @example
     * map.setCursor('url(cursor.png) 4 12, auto');
     */
    setCursor:function (cursor) {
        delete this._cursor;
        this._trySetCursor(cursor);
        this._cursor = cursor;
        return this;
    },

    /**
     * Get center of the map.
     * @return {maptalks.Coordinate}
     */
    getCenter:function () {
        if (!this._loaded || !this._prjCenter) { return this._center; }
        var projection = this.getProjection();
        return projection.unproject(this._prjCenter);
    },

    /**
     * Set a new center to the map.
     * @param {maptalks.Coordinate} center
     * @return {maptalks.Map} this
     */
    setCenter:function (center) {
        if (!center) {
            return this;
        }
        center = new Z.Coordinate(center);
        if (!this._verifyExtent(center)) {
            return this;
        }
        if (!this._loaded) {
            this._center = center;
            return this;
        }
        this.onMoveStart();
        var projection = this.getProjection();
        var _pcenter = projection.project(center);
        this._setPrjCenterAndMove(_pcenter);
        this.onMoveEnd();
        return this;
    },

    /**
     * Get map's size (width and height) in pixel.
     * @return {maptalks.Size}
     */
    getSize:function () {
        if (Z.Util.isNil(this.width) || Z.Util.isNil(this.height)) {
            return this._getContainerDomSize();
        }
        return new Z.Size(this.width, this.height);
    },

    /**
     * Get container extent of the map
     * @return {maptalks.PointExtent}
     */
    getContainerExtent: function () {
        return new Z.PointExtent(0, 0, this.width, this.height);
    },

    /**
     * Get the geographical extent of map's current view extent.
     *
     * @return {maptalks.Extent}
     */
    getExtent:function () {
        return this._pointToExtent(this._get2DExtent());
    },

    /**
     * Get the projected geographical extent of map's current view extent.
     *
     * @return {maptalks.Extent}
     */
    getProjExtent: function () {
        var extent2D = this._get2DExtent();
        return new Z.Extent(
            this._pointToPrj(extent2D.getMin()),
            this._pointToPrj(extent2D.getMax())
        );
    },

    /**
     * Get the max extent that the map is restricted to.
     * @return {maptalks.Extent}
     */
    getMaxExtent:function () {
        if (!this.options['maxExtent']) {
            return null;
        }
        return new Z.Extent(this.options['maxExtent']);
    },

    /**
     * Sets the max extent that the map is restricted to.
     * @param {maptalks.Extent}
     * @return {maptalks.Map} this
     * @example
     * map.setMaxExtent(map.getExtent());
     */
    setMaxExtent:function (extent) {
        if (extent) {
            var maxExt = new Z.Extent(extent);
            this.options['maxExtent'] = maxExt;
            var center = this.getCenter();
            if (!this._verifyExtent(center)) {
                this.panTo(maxExt.getCenter());
            }
        } else {
            delete this.options['maxExtent'];
        }
        return this;
    },

    /**
     * Get map's current zoom.
     * @return {Number}
     */
    getZoom:function () {
        return this._zoomLevel;
    },

    /**
     * Caculate the target zoom if scaling from "fromZoom" by "scale"
     * @param  {Number} scale
     * @param  {Number} fromZoom
     * @return {Number} zoom fit for scale starting from fromZoom
     */
    getZoomForScale:function (scale, fromZoom) {
        if (Z.Util.isNil(fromZoom)) {
            fromZoom = this.getZoom();
        }
        var res = this._getResolution(fromZoom),
            resolutions = this._getResolutions(),
            minZoom = this.getMinZoom(),
            maxZoom = this.getMaxZoom(),
            min = Number.MAX_VALUE,
            hit = -1;
        for (var i = resolutions.length - 1; i >= 0; i--) {
            var test = Math.abs(res / resolutions[i] - scale);
            if (test < min) {
                min = test;
                hit = i;
            }
        }
        if (Z.Util.isNumber(minZoom) && hit < minZoom) {
            hit = minZoom;
        }
        if (Z.Util.isNumber(maxZoom) && hit > maxZoom) {
            hit = maxZoom;
        }
        return hit;
    },

    /**
     * Sets zoom of the map
     * @param {Number} zoom
     * @returns {maptalks.Map} this
     */
    setZoom:function (zoom) {
        var me = this;
        Z.Util.executeWhen(function () {
            if (me.options['zoomAnimation']) {
                me._zoomAnimation(zoom);
            } else {
                me._zoom(zoom);
            }
        }, function () {
            return !me._zooming;
        });
        return this;
    },

    /**
     * Get the max zoom that the map can be zoom to.
     * @return {Number}
     */
    getMaxZoom:function () {
        if (!Z.Util.isNil(this.options['maxZoom'])) {
            return this.options['maxZoom'];
        }
        var view = this.getView();
        if (!view) {
            return null;
        }
        return view.getResolutions().length - 1;
    },

    /**
     * Sets the max zoom that the map can be zoom to.
     * @param {Number} maxZoom
     * @returns {maptalks.Map} this
     */
    setMaxZoom:function (maxZoom) {
        var viewMaxZoom = this._view.getMaxZoom();
        if (maxZoom > viewMaxZoom) {
            maxZoom = viewMaxZoom;
        }
        if (maxZoom < this._zoomLevel) {
            this.setZoom(maxZoom);
        }
        this.options['maxZoom'] = maxZoom;
        return this;
    },

    /**
     * Get the min zoom that the map can be zoom to.
     * @return {Number}
     */
    getMinZoom:function () {
        if (!Z.Util.isNil(this.options['minZoom'])) {
            return this.options['minZoom'];
        }
        return 0;
    },

    /**
     * Sets the min zoom that the map can be zoom to.
     * @param {Number} minZoom
     * @return {maptalks.Map} this
     */
    setMinZoom:function (minZoom) {
        var viewMinZoom = this._view.getMinZoom();
        if (minZoom < viewMinZoom) {
            minZoom = viewMinZoom;
        }
        this.options['minZoom'] = minZoom;
        return this;
    },

    /**
     * zoom in
     * @return {maptalks.Map} this
     */
    zoomIn: function () {
        var me = this;
        Z.Util.executeWhen(function () {
            me.setZoom(me.getZoom() + 1);
        }, function () {
            return !me._zooming;
        });
        return this;
    },

    /**
     * zoom out
     * @return {maptalks.Map} this
     */
    zoomOut: function () {
        var me = this;
        Z.Util.executeWhen(function () {
            me.setZoom(me.getZoom() - 1);
        }, function () {
            return !me._zooming;
        });
        return this;
    },

    /**
     * Sets the center and zoom at the same time.
     * @param {maptalks.Coordinate} center
     * @param {Number} zoom
     * @return {maptalks.Map} this
     */
    setCenterAndZoom:function (center, zoom) {
        if (this._zoomLevel !== zoom) {
            this.setCenter(center);
            if (!Z.Util.isNil(zoom)) {
                this.setZoom(zoom);
            }
        } else {
            this.setCenter(center);
        }
        return this;
    },


    /**
     * Caculate the zoom level that contains the given extent with the maximum zoom level possible.
     * @param {maptalks.Extent} extent
     * @return {Number} zoom fit for the extent
     */
    getFitZoom: function (extent) {
        if (!extent || !(extent instanceof Z.Extent)) {
            return this._zoomLevel;
        }
        //It's a point
        if (extent['xmin'] === extent['xmax'] && extent['ymin'] === extent['ymax']) {
            return this.getMaxZoom();
        }
        var projection = this.getProjection(),
            x = Math.abs(extent['xmin'] - extent['xmax']),
            y = Math.abs(extent['ymin'] - extent['ymax']),
            projectedExtent = projection.project({x:x, y:y}),
            resolutions = this._getResolutions(),
            xz = -1,
            yz = -1;
        for (var i = this.getMinZoom(), len = this.getMaxZoom(); i < len; i++) {
            if (Z.Util.round(projectedExtent.x / resolutions[i]) >= this.width) {
                if (xz === -1) {
                    xz = i;
                }
            }
            if (Z.Util.round(projectedExtent.y / resolutions[i]) >= this.height) {
                if (yz === -1) {
                    yz = i;
                }
            }
            if (xz > -1 && yz > -1) {
                break;
            }
        }
        var ret = xz < yz ? xz : yz;
        if (ret === -1) {
            ret = xz < yz ? yz : xz;
        }
        if (ret === -1) {
            return this.getMaxZoom();
        }
        return ret;
    },

    /**
     * Set the map to be fit for the given extent with the max zoom level possible.
     * @param  {maptalks.Extent} extent - extent
     * @param  {Number} zoomOffset - zoom offset
     * @return {maptalks.Map} - this
     */
    fitExtent: function (extent, zoomOffset) {
        if (!extent) {
            return this;
        }
        zoomOffset = zoomOffset || 0;
        var zoom = this.getFitZoom(extent);
        zoom += zoomOffset;
        var center = new Z.Extent(extent).getCenter();
        return this.setCenterAndZoom(center, zoom);
    },

    /**
     * Get the base layer of the map.
     * @return {maptalks.Layer}
     */
    getBaseLayer:function () {
        return this._baseLayer;
    },

    /**
     * Sets a new base layer to the map.<br>
     * Some events will be thrown such as baselayerchangestart, baselayerload, baselayerchangeend.
     * @param  {maptalks.Layer} baseLayer - new base layer
     * @return {maptalks.Map} this
     * @fires maptalks.Map#setbaselayer
     * @fires maptalks.Map#baselayerchangestart
     * @fires maptalks.Map#baselayerchangeend
     */
    setBaseLayer:function (baseLayer) {
        var isChange = false;
        if (this._baseLayer) {
            isChange = true;
            /**
             * baselayerchangestart event, fired when base layer is changed.
             *
             * @event maptalks.Map#baselayerchangestart
             * @type {Object}
             * @property {String} type - baselayerchangestart
             * @property {maptalks.Map} target - map
             */
            this._fireEvent('baselayerchangestart');
            this._baseLayer.remove();
        }
        if (!baseLayer) {
            delete this._baseLayer;
            /**
             * baselayerchangeend event, fired when base layer is changed.
             *
             * @event maptalks.Map#baselayerchangeend
             * @type {Object}
             * @property {String} type - baselayerchangeend
             * @property {maptalks.Map} target - map
             */
            this._fireEvent('baselayerchangeend');
            /**
             * setbaselayer event, fired when base layer is set.
             *
             * @event maptalks.Map#setbaselayer
             * @type {Object}
             * @property {String} type - setbaselayer
             * @property {maptalks.Map} target - map
             */
            this._fireEvent('setbaselayer');
            return this;
        }
        if (baseLayer instanceof Z.TileLayer) {
            baseLayer.config({
                'renderWhenPanning':true
            });
            if (!baseLayer.options['tileSystem']) {
                baseLayer.config('tileSystem', Z.TileSystem.getDefault(this.getProjection()));
            }
        }
        baseLayer._bindMap(this, -1);
        this._baseLayer = baseLayer;
        function onbaseLayerload() {
            /**
             * baselayerload event, fired when base layer is loaded.
             *
             * @event maptalks.Map#baselayerload
             * @type {Object}
             * @property {String} type - baselayerload
             * @property {maptalks.Map} target - map
             */
            this._fireEvent('baselayerload');
            if (isChange) {
                isChange = false;
                this._fireEvent('baselayerchangeend');
            }
        }
        this._baseLayer.on('layerload', onbaseLayerload, this);
        if (this._loaded) {
            this._baseLayer.load();
        }
        this._fireEvent('setbaselayer');
        return this;
    },

    /**
     * Remove the base layer from the map
     * @return {maptalks.Map} this
     * @fires maptalks.Map#baselayerremove
     */
    removeBaseLayer: function ()  {
        if (this._baseLayer) {
            this._baseLayer.remove();
            delete this._baseLayer;
            /**
             * baselayerremove event, fired when base layer is removed.
             *
             * @event maptalks.Map#baselayerremove
             * @type {Object}
             * @property {String} type - baselayerremove
             * @property {maptalks.Map} target - map
             */
            this._fireEvent('baselayerremove');
        }
        return this;
    },

    /**
     * Get the layers of the map, except base layer (which should be by getBaseLayer). <br>
     * A filter function can be given to filter layers, e.g. exclude all the VectorLayers.
     * @param {Function} [filter=undefined] - a filter function of layers, return false to exclude the given layer.
     * @return {maptalks.Layer[]}
     * @example
     * var vectorLayers = map.getLayers(function (layer) {
     *     return (layer instanceof maptalks.VectorLayer);
     * });
     */
    getLayers:function (filter) {
        return this._getLayers(function (layer) {
            if (layer === this._baseLayer || layer.getId().indexOf(Z.internalLayerPrefix) >= 0) {
                return false;
            }
            if (filter) {
                return filter(layer);
            }
            return true;
        });
    },

    /**
     * Get the layer with the given id.
     * @param  {String} id - layer id
     * @return {maptalks.Layer}
     */
    getLayer:function (id) {
        if (!id || !this._layerCache || !this._layerCache[id]) {
            return null;
        }
        return this._layerCache[id];
    },

    /**
     * Add a new layer on the top of the map.
     * @param  {maptalks.Layer|maptalks.Layer[]} layer - one or more layers to add
     * @return {maptalks.Map} this
     * @fires maptalks.Map#addlayer
     */
    addLayer:function (layers) {
        if (!layers) {
            return this;
        }
        if (!Z.Util.isArray(layers)) {
            return this.addLayer([layers]);
        }
        if (!this._layerCache) {
            this._layerCache = {};
        }
        for (var i = 0, len = layers.length; i < len; i++) {
            var layer = layers[i];
            var id = layer.getId();
            if (Z.Util.isNil(id)) {
                throw new Error(this.exceptions['INVALID_LAYER_ID'] + ':' + id);
            }
            if (this._layerCache[id]) {
                throw new Error(this.exceptions['DUPLICATE_LAYER_ID'] + ':' + id);
            }
            this._layerCache[id] = layer;
            layer._bindMap(this, this._layers.length);
            this._layers.push(layer);
            if (this._loaded) {
                layer.load();
            }
        }
        /**
         * addlayer event, fired when adding layers.
         *
         * @event maptalks.Map#addlayer
         * @type {Object}
         * @property {String} type - addlayer
         * @property {maptalks.Map} target - map
         * @property {maptalks.Layer[]} layers - layers to add
         */
        this._fireEvent('addlayer', {'layers' : layers});
        return this;
    },

    /**
     * Remove a layer from the map
     * @param  {String|String[]|maptalks.Layer|maptalks.Layer[]} layer - one or more layers or layer ids
     * @return {maptalks.Map} this
     * @fires maptalks.Map#removelayer
     */
    removeLayer: function (layers) {
        if (!layers) {
            return this;
        }
        if (!Z.Util.isArray(layers)) {
            return this.removeLayer([layers]);
        }
        for (var i = 0, len = layers.length; i < len; i++) {
            var layer = layers[i];
            if (!(layer instanceof Z.Layer)) {
                layer = this.getLayer(layer);
            }
            if (!layer) {
                continue;
            }
            var map = layer.getMap();
            if (!map || map !== this) {
                continue;
            }
            this._removeLayer(layer, this._layers);
            if (this._loaded) {
                layer._doRemove();
            }
            var id = layer.getId();
            if (this._layerCache) {
                delete this._layerCache[id];
            }
            layer.fire('remove');
        }
        /**
         * removelayer event, fired when removing layers.
         *
         * @event maptalks.Map#removelayer
         * @type {Object}
         * @property {String} type - removelayer
         * @property {maptalks.Map} target - map
         * @property {maptalks.Layer[]} layers - layers to remove
         */
        this._fireEvent('removelayer', {'layers' : layers});
        return this;
    },

    /**
     * Sort layers according to the order provided, the last will be on the top.
     * @param  {string[]|maptalks.Layer[]} layers - layers or layer ids to sort
     * @return {maptalks.Map} this
     * @example
     * map.addLayer([layer1, layer2, layer3]);
     * map.sortLayers([layer2, layer3, layer1]);
     * map.sortLayers(['3', '2', '1']); // sort by layer ids.
     */
    sortLayers:function (layers) {
        if (!layers || !Z.Util.isArray(layers)) {
            return this;
        }
        var layersToOrder = [];
        var minZ = Number.MAX_VALUE;
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (Z.Util.isString(layers[i])) {
                layer = this.getLayer(layer);
            }
            if (!(layer instanceof Z.Layer) || !layer.getMap() || layer.getMap() !== this) {
                throw new Error('It must be a layer added to this map to order.');
            }
            if (layer.getZIndex() < minZ) {
                minZ = layer.getZIndex();
            }
            layersToOrder.push(layer);
        }
        for (var ii = 0; ii < layersToOrder.length; ii++) {
            layersToOrder[ii].setZIndex(minZ + ii);
        }
        return this;
    },

    /**
     * Exports image from the map's canvas.
     * @param {Object} [options=undefined] - options
     * @param {String} [options.mimeType=image/png] - mime type of the image
     * @param {Boolean} [options.save=false] - whether pop a file save dialog to save the export image.
     * @param {String} [options.filename=export] - specify the file name, if options.save is true.
     * @return {String} image of base64 format.
     */
    toDataURL: function (options) {
        if (!options) {
            options = {};
        }
        var mimeType = options['mimeType'];
        if (!mimeType) {
            mimeType = 'image/png';
        }
        var save = options['save'];
        var renderer = this._getRenderer();
        if (renderer && renderer.toDataURL) {
            var file = options['filename'];
            if (!file) {
                file = 'export';
            }
            var dataURL =  renderer.toDataURL(mimeType);
            if (save && dataURL) {
                var imgURL = dataURL;

                var dlLink = document.createElement('a');
                dlLink.download = file;
                dlLink.href = imgURL;
                dlLink.dataset.downloadurl = [mimeType, dlLink.download, dlLink.href].join(':');

                document.body.appendChild(dlLink);
                dlLink.click();
                document.body.removeChild(dlLink);
            }
            return dataURL;
        }
        return null;
    },


    /**
     * Converts a coordinate to the 2D point in current zoom or in the specific zoom. <br>
     * The 2D point's coordinate system's origin is the same with map's origin.
     * @param  {maptalks.Coordinate} coordinate - coordinate
     * @param  {Number} [zoom=undefined]       - zoom level
     * @return {maptalks.Point}  2D point
     * @example
     * var point = map.coordinateToPoint(new maptalks.Coordinate(121.3, 29.1));
     */
    coordinateToPoint: function (coordinate, zoom) {
        var prjCoord = this.getProjection().project(coordinate);
        return this._prjToPoint(prjCoord, zoom);
    },

    /**
     * Converts a 2D point in current zoom or a specific zoom to a coordinate.
     * @param  {maptalks.Point} point - 2D point
     * @param  {Number} zoom  - zoom level
     * @return {maptalks.Coordinate} coordinate
     * @example
     * var coord = map.pointToCoordinate(new maptalks.Point(4E6, 3E4));
     */
    pointToCoordinate: function (point, zoom) {
        var prjCoord = this._pointToPrj(point, zoom);
        return this.getProjection().unproject(prjCoord);
    },

    /**
     * Converts a geographical coordinate to view point.<br>
     * A view point is a point relative to map's mapPlatform panel's position. <br>
     * @param {maptalks.Coordinate} coordinate
     * @return {maptalks.Point}
     */
    coordinateToViewPoint: function (coordinate) {
        return this._prjToViewPoint(this.getProjection().project(coordinate));
    },

    /**
     * Converts a view point to the geographical coordinate.
     * @param {maptalks.Point} viewPoint
     * @return {maptalks.Coordinate}
     */
    viewPointToCoordinate: function (viewPoint) {
        return this.getProjection().unproject(this._viewPointToPrj(viewPoint));
    },

    /**
     * Convert a geographical coordinate to the container point. <br>
     *  A container point is a point relative to map container's top-left corner. <br>
     * @param {maptalks.Coordinate}
     * @return {maptalks.Point}
     */
    coordinateToContainerPoint: function (coordinate) {
        var pCoordinate = this.getProjection().project(coordinate);
        return this._prjToContainerPoint(pCoordinate);
    },

    /**
     * Converts a container point to geographical coordinate.
     * @param {maptalks.Point}
     * @return {maptalks.Coordinate}
     */
    containerPointToCoordinate: function (containerPoint) {
        var pCoordinate = this._containerPointToPrj(containerPoint);
        return this.getProjection().unproject(pCoordinate);
    },

    /**
     * Converts a container point to the view point.
     *
     * @param {maptalks.Point}
     * @returns {maptalks.Point}
     */
    containerPointToViewPoint: function (containerPoint) {
        return containerPoint.substract(this.offsetPlatform());
    },

    /**
     * Converts a view point to the container point.
     *
     * @param {maptalks.Point}
     * @returns {maptalks.Point}
     */
    viewPointToContainerPoint: function (viewPoint) {
        return viewPoint.add(this.offsetPlatform());
    },

    /**
     * Converts a container point extent to the geographic extent.
     * @param  {maptalks.PointExtent} containerExtent - containeproints extent
     * @return {maptalks.Extent}  geographic extent
     */
    containerToExtent:function (containerExtent) {
        var extent2D = new Z.PointExtent(
                this._containerPointToPoint(containerExtent.getMin()),
                this._containerPointToPoint(containerExtent.getMax())
            );
        return this._pointToExtent(extent2D);
    },

    /**
     * Checks if the map container size changed and updates the map if so.
     * @return {maptalks.Map} this
     * @fires maptalks.Map#resize
     */
    checkSize:function () {
        var justStart = ((Z.Util.now() - this._initTime) < 1500) && this.width === 0 && this.height === 0;

        var watched = this._getContainerDomSize(),
            oldHeight = this.height,
            oldWidth = this.width;
        if (watched['width'] === oldWidth && watched['height'] === oldHeight) {
            return this;
        }
        var center = this.getCenter();
        this._updateMapSize(watched);
        var resizeOffset = new Z.Point((oldWidth - watched.width) / 2, (oldHeight - watched.height) / 2);
        this._offsetCenterByPixel(resizeOffset);
        if (justStart) {
            this.setCenter(center);
        }
        /**
         * resize event when map container's size changes
         * @event maptalks.Map#resize
         * @type {Object}
         * @property {String} type - resize
         * @property {maptalks.Map} target - map fires the event
         */
        this._fireEvent('resize');

        return this;
    },

    /**
     * Converts geographical distances to the pixel length.<br>
     * The value varis with difference zoom level.
     *
     * @param  {Number} xDist - distance on X axis.
     * @param  {Number} yDist - distance on Y axis.
     * @return {maptalks.Size} result.width: pixel length on X axis; result.height: pixel length on Y axis
     */
    distanceToPixel: function (xDist, yDist) {
        var projection = this.getProjection();
        if (!projection) {
            return null;
        }
        var center = this.getCenter(),
            target = projection.locate(center, xDist, yDist),
            res = this._getResolution();

        var width = !xDist ? 0 : (projection.project(new Z.Coordinate(target.x, center.y)).x - projection.project(center).x) / res;
        var height = !yDist ? 0 : (projection.project(new Z.Coordinate(center.x, target.y)).y - projection.project(center).y) / res;
        return new Z.Size(Math.abs(width), Math.abs(height));
    },

    /**
     * Converts pixel size to geographical distance.
     *
     * @param  {Number} width - pixel width
     * @param  {Number} height - pixel height
     * @return {Number}  distance - Geographical distance
     */
    pixelToDistance:function (width, height) {
        var projection = this.getProjection();
        if (!projection) {
            return null;
        }
        //计算前刷新scales
        var center = this.getCenter(),
            pcenter = this._getPrjCenter(),
            res = this._getResolution();
        var pTarget = new Z.Coordinate(pcenter.x + width * res, pcenter.y + height * res);
        var target = projection.unproject(pTarget);
        return projection.measureLength(target, center);
    },

    /**
     * Computes the coordinate from the given coordinate with xdist on axis x and ydist on axis y.
     * @param  {maptalks.Coordinate} coordinate - source coordinate
     * @param  {Number} dx           - distance on X axis from the source coordinate
     * @param  {Number} dy           - distance on Y axis from the source coordinate
     * @return {maptalks.Coordinate} Result coordinate
     */
    locate:function (coordinate, dx, dy) {
        return this.getProjection().locate(new Z.Coordinate(coordinate), dx, dy);
    },

    /**
    * Return map's main panel
    * @returns {HTMLElement}
    */
    getMainPanel: function () {
        return this._getRenderer().getMainPanel();
    },

    /**
     * Returns map panels.
     * @return {Object}
     */
    getPanels: function () {
        return this._panels;
    },

    remove: function () {
        this._registerDomEvents(true);
        this._clearHandlers();
        this.removeBaseLayer();
        var layers = this.getLayers();
        for (var i = 0; i < layers.length; i++) {
            layers[i].remove();
        }
        if (this._getRenderer()) {
            this._getRenderer().remove();
        }
        this._clearAllListeners();
        if (this._containerDOM && this._containerDOM.innerHTML) {
            this._containerDOM.innerHTML = '';
        }
        delete this._panels;
        delete this._containerDOM;
        return this;
    },

    /**
     * The callback function when move started
     * @private
     * @fires maptalks.Map#movestart
     */
    onMoveStart:function (param) {
        this._originCenter = this.getCenter();
        this._enablePanAnimation = false;
        this._moving = true;
        this._trySetCursor('move');
        /**
         * movestart event
         * @event maptalks.Map#movestart
         * @type {Object}
         * @property {String} type - movestart
         * @property {maptalks.Map} target - map fires the event
         * @property {maptalks.Coordinate} coordinate - coordinate of the event
         * @property {maptalks.Point} containerPoint  - container point of the event
         * @property {maptalks.Point} viewPoint       - view point of the event
         * @property {Event} domEvent                 - dom event
         */
        this._fireEvent('movestart', this._parseEvent(param ? param['domEvent'] : null, 'movestart'));
    },

    onMoving:function (param) {
        /**
         * moving event
         * @event maptalks.Map#moving
         * @type {Object}
         * @property {String} type - moving
         * @property {maptalks.Map} target - map fires the event
         * @property {maptalks.Coordinate} coordinate - coordinate of the event
         * @property {maptalks.Point} containerPoint  - container point of the event
         * @property {maptalks.Point} viewPoint       - view point of the event
         * @property {Event} domEvent                 - dom event
         */
        this._fireEvent('moving', this._parseEvent(param ? param['domEvent'] : null, 'moving'));
    },

    onMoveEnd:function (param) {
        this._moving = false;
        this._trySetCursor('default');
        /**
         * moveend event
         * @event maptalks.Map#moveend
         * @type {Object}
         * @property {String} type - moveend
         * @property {maptalks.Map} target - map fires the event
         * @property {maptalks.Coordinate} coordinate - coordinate of the event
         * @property {maptalks.Point} containerPoint  - container point of the event
         * @property {maptalks.Point} viewPoint       - view point of the event
         * @property {Event} domEvent                 - dom event
         */
        this._fireEvent('moveend', this._parseEvent(param ? param['domEvent'] : null, 'moveend'));
        if (!this._verifyExtent(this.getCenter())) {
            var moveTo = this._originCenter;
            if (!this._verifyExtent(moveTo)) {
                moveTo = this.getMaxExtent().getCenter();
            }
            this.panTo(moveTo);
        }
    },

//-----------------------------------------------------------

    /**
     * whether map is busy
     * @private
     * @return {Boolean}
     */
    _isBusy:function () {
        return this._zooming/* || this._moving*/;
    },

    /**
     * try to change cursor when map is not setCursored
     * @private
     * @param  {String} cursor css cursor
     */
    _trySetCursor:function (cursor) {
        if (!this._cursor && !this._priorityCursor) {
            if (!cursor) {
                cursor = 'default';
            }
            this._setCursorToPanel(cursor);
        }
        return this;
    },

    _setPriorityCursor:function (cursor) {
        if (!cursor) {
            var hasCursor = false;
            if (this._priorityCursor) {
                hasCursor = true;
            }
            delete this._priorityCursor;
            if (hasCursor) {
                this.setCursor(this._cursor);
            }
        } else {
            this._priorityCursor = cursor;
            this._setCursorToPanel(cursor);
        }
        return this;
    },

    _setCursorToPanel:function (cursor) {
        var panel = this.getMainPanel();
        if (panel && panel.style) {
            panel.style.cursor = cursor;
        }
    },

     /**
     * Get map's extent in view points.
     * @return {maptalks.PointExtent}
     * @private
     */
    _get2DExtent:function () {
        var c1 = this._containerPointToPoint(new Z.Point(0, 0)),
            c2 = this._containerPointToPoint(new Z.Point(this.width, 0)),
            c3 = this._containerPointToPoint(new Z.Point(this.width, this.height)),
            c4 = this._containerPointToPoint(new Z.Point(0, this.height));
        var xmin = Math.min(c1.x, c2.x, c3.x, c4.x),
            xmax = Math.max(c1.x, c2.x, c3.x, c4.x),
            ymin = Math.min(c1.y, c2.y, c3.y, c4.y),
            ymax = Math.max(c1.y, c2.y, c3.y, c4.y);
        return new Z.PointExtent(xmin, ymin, xmax, ymax);
    },

    /**
     * Converts a view point extent to the geographic extent.
     * @param  {maptalks.PointExtent} extent2D - view points extent
     * @return {maptalks.Extent}  geographic extent
     * @protected
     */
    _pointToExtent:function (extent2D) {
        return new Z.Extent(
            this.pointToCoordinate(extent2D.getMin()),
            this.pointToCoordinate(extent2D.getMax())
        );
    },

    _setPrjCenterAndMove:function (pcenter) {
        var offset = this._getPixelDistance(pcenter);
        this._setPrjCenter(pcenter);
        this.offsetPlatform(offset);
    },

    //remove a layer from the layerList
    _removeLayer:function (layer, layerList) {
        if (!layer || !layerList) { return; }
        var index = Z.Util.indexOfArray(layer, layerList);
        if (index > -1) {
            layerList.splice(index, 1);

            for (var j = 0, jlen = layerList.length; j < jlen; j++) {
                if (layerList[j].setZIndex) {
                    layerList[j].setZIndex(j);
                }
            }
        }
    },

    _sortLayersByZIndex:function (layerList) {
        layerList.sort(function (a, b) {
            return a.getZIndex() - b.getZIndex();
        });
    },


    _genViewMatrix : function (origin, scale, rotate) {
        if (!rotate) {
            rotate = 0;
        }
        this._generatingMatrix = true;
        if (origin instanceof Z.Coordinate) {
            origin = this.coordinateToContainerPoint(origin);
        }
        var point = this._containerPointToPoint(origin),
            viewPoint = this.containerPointToViewPoint(origin);

        var matrices = {
            '2dPoint' : point,
            'view' : new Z.Matrix().translate(viewPoint.x, viewPoint.y)
                    .scaleU(scale).rotate(rotate).translate(-viewPoint.x, -viewPoint.y),
            '2d' : new Z.Matrix().translate(point.x, point.y)
                    .scaleU(scale).rotate(rotate).translate(-point.x, -point.y)
        };
        matrices['inverse'] = {
            '2d' : matrices['2d'].inverse(),
            'view' : matrices['view'].inverse()
        };
        this._generatingMatrix = false;
        return matrices;
    },

    _fillMatrices: function (matrix, scale, rotate) {
        if (!rotate) {
            rotate = 0;
        }
        this._generatingMatrix = true;
        var origin = this._pointToContainerPoint(matrix['2dPoint']);
        //matrix for layers to transform
        // var view = origin.substract(mapViewPoint);
        matrix['container'] = new Z.Matrix().translate(origin.x, origin.y)
                        .scaleU(scale).rotate(rotate).translate(-origin.x, -origin.y);

        origin = origin.multi(2);
        matrix['retina'] = new Z.Matrix().translate(origin.x, origin.y)
                    .scaleU(scale).rotate(rotate).translate(-origin.x, -origin.y);
        matrix['inverse']['container'] = matrix['container'].inverse();
        matrix['inverse']['retina'] = matrix['retina'].inverse();
        // var scale = matrix['container'].decompose()['scale'];
        matrix['scale'] = {x:scale, y:scale};
        this._generatingMatrix = false;
    },

    /**
     * get Transform Matrix for zooming
     * @param  {Number} scale  scale
     * @param  {Point} origin Transform Origin
     * @private
     */
    _generateMatrices:function (origin, scale, rotate) {
        var viewMatrix = this._genViewMatrix(origin, scale, rotate);
        this._fillMatrices(viewMatrix, scale, rotate);
        return viewMatrix;
    },

    /**
     * Gets pixel lenth from pcenter to map's current center.
     * @param  {maptalks.Coordinate} pcenter - a projected coordinate
     * @return {maptalks.Point}
     * @private
     */
    _getPixelDistance:function (pCoord) {
        var center = this._getPrjCenter();
        var pxCenter = this._prjToContainerPoint(center);
        var pxCoord = this._prjToContainerPoint(pCoord);
        var dist = new Z.Point(-pxCoord.x + pxCenter.x, pxCenter.y - pxCoord.y);
        return dist;
    },

    _fireEvent:function (eventName, param) {
        //fire internal events at first
        this.fire('_' + eventName, param);
        this.fire(eventName, param);
    },

    _Load:function () {
        this._resetMapStatus();
        this._registerDomEvents();
        this._loadAllLayers();
        this._getRenderer().onLoad();
        this._loaded = true;
        this._callOnLoadHooks();
        this._initTime = Z.Util.now();
        /**
         * load event, fired when the map completes loading.
         *
         * @event maptalks.Map#load
         * @type {Object}
         * @property {String} type - load
         * @property {maptalks.Map} target - map
         */
        this._fireEvent('load');
    },

    _initRenderer:function () {
        var renderer = this.options['renderer'];
        var clazz = Z.Map.getRendererClass(renderer);
        this._renderer = new clazz(this);
    },

    _getRenderer:function () {
        return this._renderer;
    },

    _loadAllLayers:function () {
        function loadLayer(layer) {
            if (layer) {
                layer.load();
            }
        }
        if (this._baseLayer) { this._baseLayer.load(); }
        this._eachLayer(loadLayer, this.getLayers());
    },



    /**
     * Gets layers that fits for the filter
     * @param  {fn} filter - filter function
     * @return {maptalks.Layer[]}
     * @private
     */
    _getLayers:function (filter) {
        var layers = this._baseLayer ? [this._baseLayer].concat(this._layers) : this._layers;
        var result = [];
        for (var i = 0; i < layers.length; i++) {
            if (!filter || filter.call(this, layers[i])) {
                result.push(layers[i]);
            }
        }
        return result;
    },

    _eachLayer:function (fn) {
        if (arguments.length < 2) { return; }
        var layerLists = Array.prototype.slice.call(arguments, 1);
        if (layerLists && !Z.Util.isArray(layerLists)) {
            layerLists = [layerLists];
        }
        var layers = [];
        for (var i = 0, len = layerLists.length; i < len; i++) {
            layers = layers.concat(layerLists[i]);
        }
        for (var j = 0, jlen = layers.length; j < jlen; j++) {
            fn.call(fn, layers[j]);
        }
    },

    //Check and reset map's status when map'sview is changed.
    _resetMapStatus:function () {
        var maxZoom = this.getMaxZoom(),
            minZoom = this.getMinZoom();
        var viewMaxZoom = this._view.getMaxZoom(),
            viewMinZoom = this._view.getMinZoom();
        if (!maxZoom || maxZoom === -1 || maxZoom > viewMaxZoom) {
            this.setMaxZoom(viewMaxZoom);
        }
        if (!minZoom || minZoom === -1 || minZoom < viewMinZoom) {
            this.setMinZoom(viewMinZoom);
        }
        maxZoom = this.getMaxZoom();
        minZoom = this.getMinZoom();
        if (maxZoom < minZoom) {
            this.setMaxZoom(minZoom);
        }
        if (!this._zoomLevel || this._zoomLevel > maxZoom) {
            this._zoomLevel = maxZoom;
        }
        if (this._zoomLevel < minZoom) {
            this._zoomLevel = minZoom;
        }
        delete this._prjCenter;
        var projection = this.getProjection();
        this._prjCenter = projection.project(this._center);
    },

    _getContainerDomSize:function () {
        if (!this._containerDOM) { return null; }
        var containerDOM = this._containerDOM,
            width, height;
        if (!Z.Util.isNil(containerDOM.width) && !Z.Util.isNil(containerDOM.height)) {
            width = containerDOM.width;
            height = containerDOM.height;
            if (Z.Browser.retina && containerDOM[Z.renderer.tilelayer.Canvas.prototype.propertyOfTileId]) {
                //is a canvas tile of CanvasTileLayer
                width /= 2;
                height /= 2;
            }
        } else if (!Z.Util.isNil(containerDOM.clientWidth) && !Z.Util.isNil(containerDOM.clientHeight)) {
            width = parseInt(containerDOM.clientWidth, 0);
            height = parseInt(containerDOM.clientHeight, 0);
        } else {
            throw new Error('can not get size of container');
        }
        return new Z.Size(width, height);
    },

    _updateMapSize:function (mSize) {
        this.width = mSize['width'];
        this.height = mSize['height'];
        this._getRenderer().updateMapSize(mSize);
        return this;
    },

    /**
     * Gets projected center of the map
     * @return {maptalks.Coordinate}
     * @private
     */
    _getPrjCenter:function () {
        return this._prjCenter;
    },

    _setPrjCenter:function (pcenter) {
        this._prjCenter = pcenter;
    },

    _verifyExtent:function (center) {
        if (!center) {
            return false;
        }
        var maxExt = this.getMaxExtent();
        if (!maxExt) {
            return true;
        }
        return maxExt.contains(center);
    },

    /**
     * Move map's center by pixels.
     * @param  {maptalks.Point} pixel - pixels to move, the relation between value and direction is as:
     * -1,1 | 1,1
     * ------------
     *-1,-1 | 1,-1
     * @private
     * @returns {maptalks.Coordinate} the new projected center.
     */
    _offsetCenterByPixel:function (pixel) {
        var pos = new Z.Point(this.width / 2 - pixel.x, this.height / 2 - pixel.y);
        var pCenter = this._containerPointToPrj(pos);
        this._setPrjCenter(pCenter);
        return pCenter;
    },

    /**
     * offset map platform panel.
     *
     * @param  {maptalks.Point} offset - offset in pixel to move
     * @return {maptalks.Map} this
     */
    /**
     * Gets map platform panel's current view point.
     * @return {maptalks.Point}
     */
    offsetPlatform:function (offset) {
        if (!offset) {
            return this._mapViewPoint;
        } else {
            this._getRenderer().offsetPlatform(offset);
            this._mapViewPoint = this._mapViewPoint.add(offset);
            return this;
        }
    },

    _resetMapViewPoint:function () {
        this._mapViewPoint = new Z.Point(0, 0);
    },

    /**
     * Get map's current resolution
     * @return {Number} resolution
     * @private
     */
    _getResolution:function (zoom) {
        if (Z.Util.isNil(zoom)) {
            zoom = this.getZoom();
        }
        return this._view.getResolution(zoom);
    },

    _getResolutions:function () {
        return this._view.getResolutions();
    },

    /**
     * Converts the projected coordinate to a 2D point in the specific zoom
     * @param  {maptalks.Coordinate} pCoord - projected Coordinate
     * @param  {Number} zoom   - zoom level
     * @return {maptalks.Point} 2D point
     * @private
     */
    _prjToPoint:function (pCoord, zoom) {
        zoom = (zoom === undefined ? this.getZoom() : zoom);
        return this._view.getTransformation().transform(pCoord, this._getResolution(zoom));
    },

    /**
     * Converts the 2D point to projected coordinate
     * @param  {maptalks.Point} point - 2D point
     * @param  {Number} zoom   - zoom level
     * @return {maptalks.Coordinate} projected coordinate
     * @private
     */
    _pointToPrj:function (point, zoom) {
        zoom = (zoom === undefined ? this.getZoom() : zoom);
        return this._view.getTransformation().untransform(point, this._getResolution(zoom));
    },

    /**
     * transform container point to geographical projected coordinate
     *
     * @param  {maptalks.Point} containerPoint
     * @return {maptalks.Coordinate}
     * @private
     */
    _containerPointToPrj:function (containerPoint) {
        return this._pointToPrj(this._containerPointToPoint(containerPoint));
    },

    /**
     * transform view point to geographical projected coordinate
     * @param  {maptalks.Point} viewPoint
     * @return {maptalks.Coordinate}
     * @private
     */
    _viewPointToPrj:function (viewPoint) {
        return this._containerPointToPrj(this.viewPointToContainerPoint(viewPoint));
    },

    /**
     * transform geographical projected coordinate to container point
     * @param  {maptalks.Coordinate} pCoordinate
     * @return {maptalks.Point}
     * @private
     */
    _prjToContainerPoint:function (pCoordinate) {
        var centerPoint = this._prjToPoint(this._getPrjCenter()),
            point = this._prjToPoint(pCoordinate),
            centerContainerPoint = new Z.Point(this.width / 2, this.height / 2);
        var result = new Z.Point(
            centerContainerPoint.x + point.x - centerPoint.x,
            centerContainerPoint.y + point.y - centerPoint.y
            );

        return result;
    },

    /**
     * transform geographical projected coordinate to view point
     * @param  {maptalks.Coordinate} pCoordinate
     * @return {maptalks.Point}
     * @private
     */
    _prjToViewPoint:function (pCoordinate) {
        var containerPoint = this._prjToContainerPoint(pCoordinate);
        return this._containerPointToViewPoint(containerPoint);
    },

    //destructive containerPointToViewPoint
    _containerPointToViewPoint: function (containerPoint) {
        if (!containerPoint) { return null; }
        var platformOffset = this.offsetPlatform();
        return containerPoint._substract(platformOffset);
    },

    _pointToContainerPoint: function (point) {
        return this._prjToContainerPoint(this._pointToPrj(point));
    },

    _containerPointToPoint: function (containerPoint) {
        var centerPoint = this._prjToPoint(this._getPrjCenter()),
            centerContainerPoint = new Z.Point(this.width / 2, this.height / 2);
        //容器的像素坐标方向是固定方向的, 和html标准一致, 即从左到右增大, 从上到下增大
        return new Z.Point(centerPoint.x + containerPoint.x - centerContainerPoint.x, centerPoint.y + containerPoint.y - centerContainerPoint.y);
    },

    _viewPointToPoint: function (viewPoint) {
        return this._containerPointToPoint(this.viewPointToContainerPoint(viewPoint));
    },

    _pointToViewPoint: function (point) {
        return this._prjToViewPoint(this._pointToPrj(point));
    },
});




//--------------hooks after map loaded----------------
Z.Map.prototype._callOnLoadHooks = function () {
    var proto = Z.Map.prototype;
    for (var i = 0, len = proto._onLoadHooks.length; i < len; i++) {
        proto._onLoadHooks[i].call(this);
    }
};

/**
 * Add hooks for additional codes when map's loading complete, useful for plugin developping.
 * @param {function} fn
 * @returns {maptalks.Map}
 * @static
 * @protected
 */
Z.Map.addOnLoadHook = function (fn) { // (Function) || (String, args...)
    var args = Array.prototype.slice.call(arguments, 1);

    var onload = typeof fn === 'function' ? fn : function () {
        this[fn].apply(this, args);
    };

    this.prototype._onLoadHooks = this.prototype._onLoadHooks || [];
    this.prototype._onLoadHooks.push(onload);
    return this;
};


Z.Util.extend(Z.Map, Z.Renderable);
