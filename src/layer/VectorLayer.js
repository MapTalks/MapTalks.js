import Browser from '../core/Browser';
import { containerPointInMapView, containerPointOutContainerBBox, isNil } from '../core/util';
import Extent from '../geo/Extent';
import Geometry from '../geometry/Geometry';
import OverlayLayer from './OverlayLayer';
import Painter from '../renderer/geometry/Painter';
import CollectionPainter from '../renderer/geometry/CollectionPainter';
import Coordinate from '../geo/Coordinate';
import Point from '../geo/Point';
import { LineString, Curve } from '../geometry';
import PointExtent from '../geo/PointExtent';

const TEMP_EXTENT = new PointExtent();
/**
 * @property {Object}  options - VectorLayer's options
 * @property {Boolean} options.debug=false           - whether the geometries on the layer is in debug mode.
 * @property {Boolean} options.enableSimplify=true   - whether to simplify geometries before rendering.
 * @property {String}  options.cursor=default        - the cursor style of the layer
 * @property {Boolean} options.geometryEvents=true   - enable/disable firing geometry events, disable it to improve performance.
 * @property {Boolean} options.defaultIconSize=[20,20] - default size of a marker's icon
 * @property {Boolean} [options.enableAltitude=false]  - whether to enable render geometry with altitude, false by default
 * @property {Boolean} [options.altitudeProperty=altitude] - geometry's altitude property name, if enableAltitude is true, "altitude" by default
 * @property {Boolean} [options.drawAltitude=false]  - whether to draw altitude: a vertical line for marker, a vertical polygon for line
 * @property {Boolean} [options.sortByDistanceToCamera=false]  - markers Sort by camera distance
 * @property {Boolean} [options.roundPoint=false]  - round point before painting to improve performance, but will cause geometry shaking in animation
 * @property {Number} [options.altitude=0]           - layer altitude
 * @property {Boolean} [options.debug=false]         - whether the geometries on the layer is in debug mode.
 * @memberOf VectorLayer
 * @instance
 */
const options = {
    'debug': false,
    'enableSimplify': true,
    'geometryEvents': true,
    'defaultIconSize': [20, 20],
    'cacheVectorOnCanvas': true,
    'cacheSvgOnCanvas': Browser.gecko,
    'enableAltitude': false,
    'altitudeProperty': 'altitude',
    'drawAltitude': false,
    'sortByDistanceToCamera': false,
    'roundPoint': false,
    'altitude': 0,
    'clipBBoxBufferSize': 3
};
// Polyline is for custom line geometry
// const TYPES = ['LineString', 'Polyline', 'Polygon', 'MultiLineString', 'MultiPolygon'];
/**
 * @classdesc
 * A layer for managing and rendering geometries.
 * @category layer
 * @extends OverlayLayer
 */
class VectorLayer extends OverlayLayer {

    /**
     * @param {String|Number} id - layer's id
     * @param {Geometry|Geometry[]} [geometries=null] - geometries to add
     * @param {Object}  [options=null]          - construct options
     * @param {Object}  [options.style=null]    - vectorlayer's style
     * @param {*}  [options.*=null]             - options defined in [VectorLayer]{@link VectorLayer#options}
     */
    constructor(id, geometries, options) {
        super(id, geometries, options);
    }

    onConfig(conf) {
        super.onConfig(conf);
        if (conf['enableAltitude'] || conf['drawAltitude'] || conf['altitudeProperty']) {
            const renderer = this.getRenderer();
            if (renderer && renderer.setToRedraw) {
                renderer.setToRedraw();
            }
        }
    }

    /**
     * Identify the geometries on the given coordinate
     * @param  {maptalks.Coordinate} coordinate   - coordinate to identify
     * @param  {Object} [options=null]  - options
     * @param  {Object} [options.tolerance=0] - identify tolerance in pixel
     * @param  {Object} [options.count=null]  - result count
     * @return {Geometry[]} geometries identified
     */
    identify(coordinate, options = {}) {
        const renderer = this.getRenderer();
        if (!(coordinate instanceof Coordinate)) {
            coordinate = new Coordinate(coordinate);
        }
        const cp = this.getMap().coordToContainerPoint(coordinate);
        // only iterate drawn geometries when onlyVisible is true.
        if (options['onlyVisible'] && renderer && renderer.identifyAtPoint) {
            return renderer.identifyAtPoint(cp, options);
        }
        return this._hitGeos(this._geoList, cp, options);
    }

    /**
     * Identify the geometries on the given container point
     * @param  {maptalks.Point} point   - container point to identify
     * @param  {Object} [options=null]  - options
     * @param  {Object} [options.tolerance=0] - identify tolerance in pixel
     * @param  {Object} [options.count=null]  - result count
     * @return {Geometry[]} geometries identified
     */
    identifyAtPoint(point, options = {}) {
        const renderer = this.getRenderer();
        if (!(point instanceof Point)) {
            point = new Point(point);
        }
        // only iterate drawn geometries when onlyVisible is true.
        if (options['onlyVisible'] && renderer && renderer.identifyAtPoint) {
            return renderer.identifyAtPoint(point, options);
        }
        return this._hitGeos(this._geoList, point, options);
    }

    _hitGeos(geometries, cp, options = {}) {
        const filter = options['filter'],
            tolerance = options['tolerance'],
            hits = [];
        const map = this.getMap();
        const renderer = this.getRenderer();
        const imageData = renderer && renderer.getImageData && renderer.getImageData();
        if (imageData) {
            const r = map.getDevicePixelRatio();
            imageData.r = r;
            const x = Math.round(cp.x * r),
                y = Math.round(cp.y * r);
            const idx = y * imageData.width * 4 + x * 4;
            //空白的直接返回，避免下面的逻辑,假设有50%的概率不命中(要么命中,要么不命中)，可以节省大量的时间
            if (imageData.data[idx + 3] === 0) {
                return hits;
            }
        }
        const mapSize = map.getSize();
        const isInMapView = containerPointInMapView(cp, mapSize);
        //如果鼠标位置在当前地图视野内，仅仅需要判断render的_geosToDraw就可以了，无需判断所有的geolist
        const geosToDraw = renderer._geosToDraw || [];
        if (isInMapView && geosToDraw && geosToDraw.length) {
            geometries = geosToDraw;
        }
        for (let i = geometries.length - 1; i >= 0; i--) {
            const geo = geometries[i];
            const painter = geo._getPainter();
            if (!geo || !geo.isVisible() || !painter || !geo.options['interactive']) {
                continue;
            }
            // bbox not contains mousepoint
            const isPoly = geo._isPoly();
            const isNotComplexSymbol = painter._isNotComplexSymbol && painter._isNotComplexSymbol();
            const polyAndNotComplexSymbol = isPoly && isNotComplexSymbol;
            if (isInMapView && polyAndNotComplexSymbol && painter._containerBbox) {
                if (containerPointOutContainerBBox(cp, painter._containerBbox)) {
                    continue;
                }
            }
            //其他的图形或者复合样式仍然保持原来的逻辑
            if (!polyAndNotComplexSymbol) {
                if ((!(geo instanceof LineString) || (!geo._getArrowStyle() && !(geo instanceof Curve)))) {
                    // Except for LineString with arrows or curves
                    let extent = geo.getContainerExtent(TEMP_EXTENT);
                    if (tolerance) {
                        extent = extent._expand(tolerance);
                    }
                    if (!extent || !extent.contains(cp)) {
                        continue;
                    }
                }
            }
            if (geo._containsPoint(cp, tolerance, mapSize) && (!filter || filter(geo))) {
                hits.push(geo);
                if (options['count']) {
                    if (hits.length >= options['count']) {
                        break;
                    }
                }
            }
        }
        return hits;
    }

    getAltitude() {
        return this.options['altitude'] || 0;
    }

    /**
     * Export the VectorLayer's JSON. <br>
     * @param  {Object} [options=null] - export options
     * @param  {Object} [options.geometries=null] - If not null and the layer is a [OverlayerLayer]{@link OverlayLayer},
     *                                            the layer's geometries will be exported with the given "options.geometries" as a parameter of geometry's toJSON.
     * @param  {Extent} [options.clipExtent=null] - if set, only the geometries intersectes with the extent will be exported.
     * @return {Object} layer's JSON
     */
    toJSON(options) {
        if (!options) {
            options = {};
        }
        const profile = {
            'type': this.getJSONType(),
            'id': this.getId(),
            'options': this.config()
        };
        if (isNil(options['geometries']) || options['geometries']) {
            let clipExtent;
            if (options['clipExtent']) {
                const map = this.getMap();
                const projection = map ? map.getProjection() : null;
                clipExtent = new Extent(options['clipExtent'], projection);
            }
            const geoJSONs = [];
            const geometries = this.getGeometries();
            for (let i = 0, len = geometries.length; i < len; i++) {
                const geo = geometries[i];
                const geoExt = geo.getExtent();
                if (!geoExt || (clipExtent && !clipExtent.intersects(geoExt))) {
                    continue;
                }
                const json = geo.toJSON(options['geometries']);
                geoJSONs.push(json);
            }
            profile['geometries'] = geoJSONs;
        }
        return profile;
    }

    /**
     * Reproduce a VectorLayer from layer's JSON.
     * @param  {Object} layerJSON - layer's JSON
     * @return {VectorLayer}
     * @static
     * @private
     * @function
     */
    static fromJSON(json) {
        if (!json || json['type'] !== 'VectorLayer') {
            return null;
        }
        const layer = new VectorLayer(json['id'], json['options']);
        const geoJSONs = json['geometries'];
        const geometries = [];
        for (let i = 0; i < geoJSONs.length; i++) {
            const geo = Geometry.fromJSON(geoJSONs[i]);
            if (geo) {
                geometries.push(geo);
            }
        }
        layer.addGeometry(geometries);
        return layer;
    }

    static getPainterClass() {
        return Painter;
    }

    static getCollectionPainterClass() {
        return CollectionPainter;
    }
}

VectorLayer.mergeOptions(options);

VectorLayer.registerJSONType('VectorLayer');

export default VectorLayer;
