import { INTERNAL_LAYER_PREFIX } from 'core/Constants';
import { isNil } from 'core/util';
import { extendSymbol } from 'core/util/style';
import { getExternalResources } from 'core/util/resource';
import { stopPropagation } from 'core/util/dom';
import Coordinate from 'geo/Coordinate';
import Point from 'geo/Point';
import Marker from 'geometry/Marker';
import Polygon from 'geometry/Polygon';
import LineString from 'geometry/LineString';
import Circle from 'geometry/Circle';
import Ellipse from 'geometry/Ellipse';
import Rectangle from 'geometry/Rectangle';
import ArcCurve from 'geometry/ArcCurve';
import CubicBezierCurve from 'geometry/CubicBezierCurve';
import QuadBezierCurve from 'geometry/QuadBezierCurve';
import VectorLayer from 'layer/VectorLayer';
import MapTool from './MapTool';

/**
 * @property {Object} [options=null] - construct options
 * @property {String} [options.mode=null]   - mode of the draw tool
 * @property {Object} [options.symbol=null] - symbol of the geometries drawn
 * @property {Boolean} [options.once=null]  - whether disable immediately once drawn a geometry.
 * @memberOf DrawTool
 * @instance
 */
const options = {
    'symbol': {
        'lineColor': '#000',
        'lineWidth': 2,
        'lineOpacity': 1,
        'polygonFill': '#fff',
        'polygonOpacity': 0.3
    },
    'doubleClickZoom' : false,
    'mode': null,
    'once': false,
    'ignoreMouseleave' : true
};

const registeredMode = {};

/**
 * A map tool to help draw geometries.
 * @category maptool
 * @extends MapTool
 * @example
 * var drawTool = new DrawTool({
 *     mode : 'Polygon',
 *     symbol : {
 *         'lineColor' : '#000',
 *         'lineWidth' : 5
 *     },
 *     once : true
 * }).addTo(map);
 */
class DrawTool extends MapTool {

    /**
     * Register a new mode for DrawTool
     * @param  {String} name       mode name
     * @param  {Object} modeAction modeActions
     * @param  {Object} modeAction.action the action of DrawTool: click, drag, clickDblclick
     * @param  {Object} modeAction.create the create method of drawn geometry
     * @param  {Object} modeAction.update the update method of drawn geometry
     * @param  {Object} modeAction.generate the method to generate geometry at the end of drawing.
     * @example
     * //Register "CubicBezierCurve" mode to draw Cubic Bezier Curves.
     * DrawTool.registerMode('CubicBezierCurve', {
        'action': 'clickDblclick',
        'create': path => new CubicBezierCurve(path),
        'update': (path, geometry) => {
            geometry.setCoordinates(path);
        },
        'generate': geometry => geometry
       }
    });
     */
    static registerMode(name, modeAction) {
        registeredMode[name.toLowerCase()] = modeAction;
    }

    /**
     * Get mode actions by mode name
     * @param  {String} name DrawTool mode name
     * @return {Object}      mode actions
     */
    static getRegisterMode(name) {
        return registeredMode[name.toLowerCase()];
    }

    /**
     * In default, DrawTool supports the following modes: <br>
     * [Point, LineString, Polygon, Circle, Ellipse, Rectangle, ArcCurve, QuadBezierCurve, CubicBezierCurve] <br>
     * You can easily add new mode to DrawTool by calling [registerMode]{@link DrawTool.registerMode}
     * @param {Object} [options=null] - construct options
     * @param {String} [options.mode=null]   - mode of the draw tool
     * @param {Object} [options.symbol=null] - symbol of the geometries drawn
     * @param {Boolean} [options.once=null]  - whether disable immediately once drawn a geometry.
     */
    constructor(options) {
        super(options);
        this._checkMode();
    }

    /**
     * Get current mode of draw tool
     * @return {String} mode
     */
    getMode() {
        if (this.options['mode']) {
            return this.options['mode'].toLowerCase();
        }
        return null;
    }

    /**
     * Set mode of the draw tool
     * @param {String} mode - mode of the draw tool
     * @expose
     */
    setMode(mode) {
        if (this._geometry) {
            this._geometry.remove();
            delete this._geometry;
        }
        this._clearStage();
        this._switchEvents('off');
        this.options['mode'] = mode;
        this._checkMode();
        if (this.isEnabled()) {
            this._switchEvents('on');
        }
        return this;
    }

    /**
     * Get symbol of the draw tool
     * @return {Object} symbol
     */
    getSymbol() {
        const symbol = this.options['symbol'];
        if (symbol) {
            return extendSymbol(symbol);
        } else {
            return extendSymbol(this.options['symbol']);
        }
    }

    /**
     * Set draw tool's symbol
     * @param {Object} symbol - symbol set
     * @returns {DrawTool} this
     */
    setSymbol(symbol) {
        if (!symbol) {
            return this;
        }
        this.options['symbol'] = symbol;
        if (this._geometry) {
            this._geometry.setSymbol(symbol);
        }
        return this;
    }

    onAdd() {
        this._checkMode();
    }

    onEnable() {
        const map = this.getMap();
        this._mapDoubleClickZoom = map.options['doubleClickZoom'];
        map.config({
            'doubleClickZoom': this.options['doubleClickZoom']
        });
        const action = this._getRegisterMode()['action'];
        if (action === 'drag') {
            this._mapDraggable = map.options['draggable'];
            map.config({
                'draggable' : false
            });
        }
        this._drawToolLayer = this._getDrawLayer();
        this._clearStage();
        this._loadResources();
        return this;
    }

    _checkMode() {
        this._getRegisterMode();
    }

    onDisable() {
        const map = this.getMap();
        map.config({
            'doubleClickZoom': this._mapDoubleClickZoom
        });
        if (!isNil(this._mapDraggable)) {
            map.config('draggable', this._mapDraggable);
        }
        delete this._mapDraggable;
        delete this._mapDoubleClickZoom;
        this._endDraw();
        if (this._map) {
            map.removeLayer(this._getDrawLayer());
        }
        return this;
    }


    _loadResources() {
        const symbol = this.getSymbol();
        const resources = getExternalResources(symbol);
        if (resources.length > 0) {
            //load external resources at first
            this._drawToolLayer._getRenderer().loadResources(resources);
        }
    }

    _getProjection() {
        return this._map.getProjection();
    }

    _getRegisterMode() {
        const mode = this.getMode();
        const registerMode = DrawTool.getRegisterMode(mode);
        if (!registerMode) {
            throw new Error(mode + ' is not a valid mode of DrawTool.');
        }
        return registerMode;
    }

    getEvents() {
        const action = this._getRegisterMode()['action'];
        if (action === 'clickDblclick') {
            return {
                'click': this._clickForPath,
                'mousemove': this._mousemoveForPath,
                'dblclick': this._dblclickForPath
            };
        } else if (action === 'click') {
            return {
                'click': this._clickForPoint
            };
        } else if (action === 'drag') {
            return {
                'mousedown': this._mousedownToDraw
            };
        }
        return null;
    }

    _addGeometryToStage(geometry) {
        const drawLayer = this._getDrawLayer();
        drawLayer.addGeometry(geometry);
    }

    _clickForPoint(param) {
        const registerMode = this._getRegisterMode();
        this._geometry = registerMode['create'](param['coordinate']);
        if (this.options['symbol'] && this.options.hasOwnProperty('symbol')) {
            this._geometry.setSymbol(this.options['symbol']);
        }
        this._endDraw();
    }

    _clickForPath(param) {
        const registerMode = this._getRegisterMode();
        const coordinate = param['coordinate'];
        const symbol = this.getSymbol();
        if (!this._geometry) {
            this._clickCoords = [coordinate];
            this._geometry = registerMode['create'](this._clickCoords);
            if (symbol) {
                this._geometry.setSymbol(symbol);
            }
            this._addGeometryToStage(this._geometry);
            /**
             * drawstart event.
             *
             * @event DrawTool#drawstart
             * @type {Object}
             * @property {String} type - drawstart
             * @property {DrawTool} target - draw tool
             * @property {Coordinate} coordinate - coordinate of the event
             * @property {Point} containerPoint  - container point of the event
             * @property {Point} viewPoint       - view point of the event
             * @property {Event} domEvent                 - dom event
             */
            this._fireEvent('drawstart', param);
        } else {
            this._clickCoords.push(coordinate);
            registerMode['update'](this._clickCoords, this._geometry);
            /**
             * drawvertex event.
             *
             * @event DrawTool#drawvertex
             * @type {Object}
             * @property {String} type - drawvertex
             * @property {DrawTool} target - draw tool
             * @property {Geometry} geometry - geometry drawn
             * @property {Coordinate} coordinate - coordinate of the event
             * @property {Point} containerPoint  - container point of the event
             * @property {Point} viewPoint       - view point of the event
             * @property {Event} domEvent                 - dom event
             */
            this._fireEvent('drawvertex', param);

        }
    }

    _mousemoveForPath(param) {
        const map = this.getMap();
        if (!this._geometry || !map || map.isInteracting()) {
            return;
        }
        const containerPoint = this._getMouseContainerPoint(param);
        if (!this._isValidContainerPoint(containerPoint)) {
            return;
        }
        const coordinate = param['coordinate'];
        const registerMode = this._getRegisterMode();
        const path = this._clickCoords;
        if (path && path.length > 0 && coordinate.equals(path[path.length - 1])) {
            return;
        }
        registerMode['update'](path.concat([coordinate]), this._geometry);
        /**
         * mousemove event.
         *
         * @event DrawTool#mousemove
         * @type {Object}
         * @property {String} type - mousemove
         * @property {DrawTool} target - draw tool
         * @property {Geometry} geometry - geometry drawn
         * @property {Coordinate} coordinate - coordinate of the event
         * @property {Point} containerPoint  - container point of the event
         * @property {Point} viewPoint       - view point of the event
         * @property {Event} domEvent                 - dom event
         */
        this._fireEvent('mousemove', param);
    }

    _dblclickForPath(param) {
        if (!this._geometry) {
            return;
        }
        const containerPoint = this._getMouseContainerPoint(param);
        if (!this._isValidContainerPoint(containerPoint)) {
            return;
        }
        const registerMode = this._getRegisterMode();
        const coordinate = param['coordinate'];
        const path = this._clickCoords;
        path.push(coordinate);
        if (path.length < 2) {
            return;
        }
        //去除重复的端点
        const nIndexes = [];
        for (let i = 1, len = path.length; i < len; i++) {
            if (path[i].x === path[i - 1].x && path[i].y === path[i - 1].y) {
                nIndexes.push(i);
            }
        }
        for (let i = nIndexes.length - 1; i >= 0; i--) {
            path.splice(nIndexes[i], 1);
        }

        if (path.length < 2 || (this._geometry && (this._geometry instanceof Polygon) && path.length < 3)) {
            return;
        }
        registerMode['update'](path, this._geometry);
        this._endDraw(param);
    }

    _mousedownToDraw(param) {
        const registerMode = this._getRegisterMode();
        const me = this,
            firstPoint = this._getMouseContainerPoint(param);
        if (!this._isValidContainerPoint(firstPoint)) {
            return false;
        }
        const firstCoord = param['coordinate'];

        function genGeometry(coordinate) {
            const symbol = me.getSymbol();
            let geometry = me._geometry;
            if (!geometry) {
                geometry = registerMode['create'](coordinate);
                geometry.setSymbol(symbol);
                me._addGeometryToStage(geometry);
                me._geometry = geometry;
            } else {
                registerMode['update'](coordinate, geometry);
            }
        }

        function onMouseMove(_event) {
            if (!this._geometry) {
                return false;
            }
            const current = this._getMouseContainerPoint(_event);
            if (!this._isValidContainerPoint(current)) {
                return false;
            }
            const coordinate = _event['coordinate'];
            genGeometry(coordinate);
            this._fireEvent('mousemove', param);
            return false;
        }
        const onMouseUp = function (_event) {
            if (!this._geometry) {
                return false;
            }
            const current = this._getMouseContainerPoint(_event);
            if (this._isValidContainerPoint(current)) {
                const coordinate = _event['coordinate'];
                genGeometry(coordinate);
            }
            this._map.off('mousemove', onMouseMove, this);
            this._map.off('mouseup', onMouseUp, this);
            if (!this.options['ignoreMouseleave']) {
                this._map.off('mouseleave', onMouseUp, this);
            }
            this._endDraw(param);
            return false;
        };

        this._fireEvent('drawstart', param);
        genGeometry(firstCoord);
        this._map.on('mousemove', onMouseMove, this);
        this._map.on('mouseup', onMouseUp, this);
        if (!this.options['ignoreMouseleave']) {
            this._map.on('mouseleave', onMouseUp, this);
        }
        return false;
    }

    _endDraw(param) {
        if (!this._geometry || this._ending) {
            return;
        }
        this._ending = true;
        const geometry = this._geometry;
        this._clearStage();
        if (!param) {
            param = {};
        }
        this._geometry = geometry;
        /**
         * drawend event.
         *
         * @event DrawTool#drawend
         * @type {Object}
         * @property {String} type - drawend
         * @property {DrawTool} target - draw tool
         * @property {Geometry} geometry - geometry drawn
         * @property {Coordinate} coordinate - coordinate of the event
         * @property {Point} containerPoint  - container point of the event
         * @property {Point} viewPoint       - view point of the event
         * @property {Event} domEvent                 - dom event
         */
        this._fireEvent('drawend', param);
        delete this._geometry;
        if (this.options['once']) {
            this.disable();
        }
        delete this._ending;
    }

    _clearStage() {
        this._getDrawLayer().clear();
        delete this._geometry;
        delete this._clickCoords;
    }

    /**
     * Get container point of the mouse event
     * @param  {Event} event -  mouse event
     * @return {Point}
     * @private
     */
    _getMouseContainerPoint(event) {
        const action = this._getRegisterMode()['action'];
        if (action === 'drag') {
            stopPropagation(event['domEvent']);
        }
        return event['containerPoint'];
    }

    _isValidContainerPoint(containerPoint) {
        const mapSize = this._map.getSize();
        const w = mapSize['width'],
            h = mapSize['height'];
        if (containerPoint.x < 0 || containerPoint.y < 0) {
            return false;
        } else if (containerPoint.x > w || containerPoint.y > h) {
            return false;
        }
        return true;
    }

    _getDrawLayer() {
        const drawLayerId = INTERNAL_LAYER_PREFIX + 'drawtool';
        let drawToolLayer = this._map.getLayer(drawLayerId);
        if (!drawToolLayer) {
            drawToolLayer = new VectorLayer(drawLayerId, {
                'enableSimplify': false
            });
            this._map.addLayer(drawToolLayer);
        }
        return drawToolLayer;
    }

    _fireEvent(eventName, param) {
        if (!param) {
            param = {};
        }
        if (this._geometry) {
            param['geometry'] = this._getRegisterMode()['generate'](this._geometry).copy();
        }
        MapTool.prototype._fireEvent.call(this, eventName, param);
    }

}

DrawTool.mergeOptions(options);

DrawTool.registerMode('circle', {
    'action': 'drag',
    'create': function (coordinate) {
        return new Circle(coordinate, 0);
    },
    'update': function (coordinate, geometry) {
        const map = geometry.getMap();
        const center = geometry.getCenter();
        const radius = map.computeLength(center, coordinate);
        geometry.setRadius(radius);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

DrawTool.registerMode('ellipse', {
    'action': 'drag',
    'create': function (coordinate) {
        return new Ellipse(coordinate, 0, 0);
    },
    'update': function (coordinate, geometry) {
        const map = geometry.getMap();
        const center = geometry.getCenter();
        const rx = map.computeLength(center, new Coordinate({
            x: coordinate.x,
            y: center.y
        }));
        const ry = map.computeLength(center, new Coordinate({
            x: center.x,
            y: coordinate.y
        }));
        geometry.setWidth(rx * 2);
        geometry.setHeight(ry * 2);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

DrawTool.registerMode('rectangle', {
    'action': 'drag',
    'create': function (coordinate) {
        const rect = new Rectangle(coordinate, 0, 0);
        rect._firstClick = coordinate;
        return rect;
    },
    'update': function (coordinate, geometry) {
        const firstCoord = geometry._firstClick;
        const map = geometry.getMap();
        const width = map.computeLength(firstCoord, new Coordinate(coordinate.x, firstCoord.y)),
            height = map.computeLength(firstCoord, new Coordinate(firstCoord.x, coordinate.y));
        const cnw = map.coordinateToPoint(firstCoord),
            cc = map.coordinateToPoint(coordinate);
        const x = Math.min(cnw.x, cc.x),
            y = Math.min(cnw.y, cc.y);
        geometry.setCoordinates(map.pointToCoordinate(new Point(x, y)));
        geometry.setWidth(width);
        geometry.setHeight(height);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

DrawTool.registerMode('point', {
    'action': 'click',
    'create': function (coordinate) {
        return new Marker(coordinate);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

DrawTool.registerMode('polygon', {
    'action': 'clickDblclick',
    'create': function (path) {
        return new LineString(path);
    },
    'update': function (path, geometry) {
        const symbol = geometry.getSymbol();
        geometry.setCoordinates(path);
        if (path.length >= 3) {
            const layer = geometry.getLayer();
            if (layer) {
                let polygon = layer.getGeometryById('polygon');
                if (!polygon) {
                    polygon = new Polygon([path], {
                        'id': 'polygon'
                    });
                    if (symbol) {
                        const pSymbol = extendSymbol(symbol, {
                            'lineOpacity': 0
                        });
                        polygon.setSymbol(pSymbol);
                    }
                    polygon.addTo(layer);
                }
                polygon.setCoordinates(path);
            }
        }
    },
    'generate': function (geometry) {
        return new Polygon(geometry.getCoordinates(), {
            'symbol': geometry.getSymbol()
        });
    }
});

DrawTool.registerMode('linestring', {
    'action': 'clickDblclick',
    'create': function (path) {
        return new LineString(path);
    },
    'update': function (path, geometry) {
        geometry.setCoordinates(path);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

DrawTool.registerMode('arccurve', {
    'action': 'clickDblclick',
    'create': function (path) {
        return new ArcCurve(path);
    },
    'update': function (path, geometry) {
        geometry.setCoordinates(path);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

DrawTool.registerMode('quadbeziercurve', {
    'action': 'clickDblclick',
    'create': function (path) {
        return new QuadBezierCurve(path);
    },
    'update': function (path, geometry) {
        geometry.setCoordinates(path);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

DrawTool.registerMode('cubicbeziercurve', {
    'action': 'clickDblclick',
    'create': function (path) {
        return new CubicBezierCurve(path);
    },
    'update': function (path, geometry) {
        geometry.setCoordinates(path);
    },
    'generate': function (geometry) {
        return geometry;
    }
});

export default DrawTool;
