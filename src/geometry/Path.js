import { isNil, isNumber, isArrayHasData } from 'core/util';
import Coordinate from 'geo/Coordinate';
import Extent from 'geo/Extent';
import Geometry from './Geometry';
import { Measurer } from 'geo/measurer';
import simplify from 'simplify-js';

/**
 * @property {Object} options - configuration options
 * @property {String} [options.antiMeridian=continuous] - continue | split, how to deal with the anti-meridian problem, split or continue the polygon when it cross the 180 or -180 longtitude line.
 * @property {Object} options.symbol - Path's default symbol
 * @memberOf Path
 * @instance
 */
const options = {
    'antiMeridian': 'continuous',
    'symbol': {
        'lineColor': '#000',
        'lineWidth': 2,
        'lineOpacity': 1,

        'polygonFill': '#fff', //default color in cartoCSS
        'polygonOpacity': 1,
        'opacity': 1
    }
};

/**
 * An abstract class Path containing common methods for Path geometry classes, e.g. LineString, Polygon
 * @abstract
 * @category geometry
 * @extends Geometry
 */
class Path extends Geometry {

    /**
     * Transform projected coordinates to view points
     * @param  {Coordinate[]} prjCoords           - projected coordinates
     * @param  {Boolean} disableSimplify          - whether to disable simplify\
     * @param  {Number} zoom                      - 2d points' zoom level
     * @returns {Point[]}
     * @private
     */
    _getPath2DPoints(prjCoords, disableSimplify, zoom) {
        let result = [];
        if (!isArrayHasData(prjCoords)) {
            return result;
        }
        const map = this.getMap(),
            fullExtent = map.getFullExtent(),
            projection = this._getProjection();
        const anti = Measurer.isSphere(projection) ? this.options['antiMeridian'] : false,
            isClip = map.options['clipFullExtent'],
            isSimplify = !disableSimplify && this.getLayer() && this.getLayer().options['enableSimplify'],
            tolerance = 2 * map._getResolution(),
            isMulti = Array.isArray(prjCoords[0]);
        delete this._simplified;
        if (isSimplify && !isMulti) {
            const count = prjCoords.length;
            prjCoords = simplify(prjCoords, tolerance, false);
            this._simplified = prjCoords.length < count;
        }
        if (isNil(zoom)) {
            zoom = map.getZoom();
        }
        let p, pre, current, dx, dy, my;
            // for anit-meridian splits
        const part1 = [], part2 = [];
        let part = part1;
        for (let i = 0, len = prjCoords.length; i < len; i++) {
            p = prjCoords[i];
            if (isMulti) {
                part.push(this._getPath2DPoints(p, disableSimplify, zoom));
                continue;
            }
            if (isNil(p) || (isClip && !fullExtent.contains(p))) {
                continue;
            }
            if (i > 0 && (anti === 'continuous' || anti === 'split')) {
                current = projection.unproject(p);
                if (anti === 'split' || !pre) {
                    pre = projection.unproject(prjCoords[i - 1]);
                }
                if (pre && current) {
                    dx = current.x - pre.x;
                    dy = current.y - pre.y;
                    if (Math.abs(dx) > 180) {
                        if (anti === 'continuous') {
                            current = this._anti(current, dx);
                            pre = current;
                            p = projection.project(current);
                        } else if (anti === 'split') {
                            if (dx > 0) {
                                my = pre.y + dy * (pre.x - (-180)) / (360 - dx) * (pre.y > current.y ? -1 : 1);
                                part = part === part1 ? part2 : part1;
                                part.push(map.coordinateToPoint(new Coordinate(180, my), zoom));
                            } else {
                                my = pre.y + dy * (180 - pre.x) / (360 + dx) * (pre.y > current.y ? 1 : -1);
                                part.push(map.coordinateToPoint(new Coordinate(180, my), zoom));
                                part = part === part1 ? part2 : part1;
                                part.push(map.coordinateToPoint(new Coordinate(-180, my), zoom));
                            }
                        }
                    }
                }
            }
            part.push(map._prjToPoint(p, zoom));
        }
        if (part2.length > 0) {
            result = [part1, part2];
        } else {
            result = part;
        }
        return result;
    }

    _anti(c, dx) {
        if (dx > 0) {
            return c.sub(180 * 2, 0);
        } else {
            return c.add(180 * 2, 0);
        }
    }

    _setPrjCoordinates(prjPoints) {
        this._prjCoords = prjPoints;
        this.onShapeChanged();
    }

    _getPrjCoordinates() {
        if (!this._prjCoords) {
            const points = this._coordinates;
            this._prjCoords = this._projectCoords(points);
        }
        return this._prjCoords;
    }

    //update cached variables if geometry is updated.
    _updateCache() {
        this._clearCache();
        const projection = this._getProjection();
        if (!projection) {
            return;
        }
        if (this._prjCoords) {
            this._coordinates = this._unprojectCoords(this._getPrjCoordinates());
        }
        if (this._prjHoles) {
            this._holes = this._unprojectCoords(this._getPrjHoles());
        }
    }

    _clearProjection() {
        this._prjCoords = null;
        if (this._prjHoles) {
            this._prjHoles = null;
        }
    }

    _projectCoords(points) {
        const projection = this._getProjection();
        if (projection) {
            return projection.projectCoords(points);
        }
        return [];
    }

    _unprojectCoords(prjPoints) {
        const projection = this._getProjection();
        if (projection) {
            return projection.unprojectCoords(prjPoints);
        }
        return [];
    }

    _computeCenter() {
        const ring = this._coordinates;
        if (!isArrayHasData(ring)) {
            return null;
        }
        let sumx = 0,
            sumy = 0,
            counter = 0;
        const size = ring.length;
        for (let i = 0; i < size; i++) {
            if (ring[i]) {
                if (isNumber(ring[i].x) && isNumber(ring[i].y)) {
                    sumx += ring[i].x;
                    sumy += ring[i].y;
                    counter++;
                }
            }
        }
        return new Coordinate(sumx / counter, sumy / counter);
    }

    _computeExtent() {
        const shell = this._coordinates;
        if (!isArrayHasData(shell)) {
            return null;
        }
        const rings = [shell];
        if (this.hasHoles && this.hasHoles()) {
            rings.push.apply(rings, this.getHoles());
        }
        return this._computeCoordsExtent(rings);
    }

    /**
     * Compute extent of a group of coordinates
     * @param  {Coordinate[]} coords  - coordinates
     * @returns {Extent}
     * @private
     */
    _computeCoordsExtent(coords) {
        const anti = this.options['antiMeridian'];
        let result = null;
        let ext, p, dx, pre;
        for (let i = 0, len = coords.length; i < len; i++) {
            for (let j = 0, jlen = coords[i].length; j < jlen; j++) {
                p = coords[i][j];
                if (j > 0 && anti) {
                    if (!pre) {
                        pre = coords[i][j - 1];
                    }
                    dx = p.x - pre.x;
                    if (Math.abs(dx) > 180) {
                        p = this._anti(p, dx);
                        pre = p;
                    }
                }
                ext = new Extent(p, p);
                result = ext.combine(result);
            }

        }
        return result;
    }

    _get2DLength() {
        const vertexes = this._getPath2DPoints(this._getPrjCoordinates(), true);
        let len = 0;
        for (let i = 1, l = vertexes.length; i < l; i++) {
            len += vertexes[i].distanceTo(vertexes[i - 1]);
        }
        return len;
    }

    _hitTestTolerance() {
        const symbol = this._getInternalSymbol();
        let w;
        if (Array.isArray(symbol)) {
            w = 0;
            for (let i = 0; i < symbol.length; i++) {
                if (isNumber(symbol[i]['lineWidth'])) {
                    if (symbol[i]['lineWidth'] > w) {
                        w = symbol[i]['lineWidth'];
                    }
                }
            }
        } else {
            w = symbol['lineWidth'];
        }
        return w ? w / 2 : 1.5;
    }
}

Path.mergeOptions(options);

export default Path;
