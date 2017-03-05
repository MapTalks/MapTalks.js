import { extend, isNil } from 'core/util';
import Coordinate from 'geo/Coordinate';
import Point from 'geo/Point';
import Extent from 'geo/Extent';
import CenterMixin from './CenterMixin';
import Polygon from './Polygon';

/**
 * @property {Object} [options=null]
 * @property {Number} [options.numberOfShellPoints=60]   - number of shell points when exporting the ellipse's shell coordinates as a polygon.
 * @memberOf Ellipse
 * @instance
 */
const options = {
    'numberOfShellPoints': 60
};

/**
 * Represents a Ellipse Geometry. <br>
 * @category geometry
 * @extends Polygon
 * @mixes CenterMixin
 * @example
 * var ellipse = new Ellipse([100, 0], 1000, 500, {
 *     id : 'ellipse0'
 * });
 */
class Ellipse extends CenterMixin(Polygon) {

    static fromJSON(json) {
        const feature = json['feature'];
        const ellipse = new Ellipse(json['coordinates'], json['width'], json['height'], json['options']);
        ellipse.setProperties(feature['properties']);
        return ellipse;
    }

    /**
     * @param {Coordinate} center  - center of the ellipse
     * @param {Number} width  - width of the ellipse
     * @param {Number} height - height of the ellipse
     * @param {Object}  [options=null] - construct options defined in [Ellipse]{@link Ellipse#options}
     */
    constructor(coordinates, width, height, opts) {
        super(null, opts);
        if (coordinates) {
            this.setCoordinates(coordinates);
        }
        this.width = width;
        this.height = height;
    }

    /**
     * Get ellipse's width
     * @return {Number}
     */
    getWidth() {
        return this.width;
    }

    /**
     * Set new width to ellipse
     * @param {Number} width - new width
     * @fires Ellipse#shapechange
     * @return {Ellipse} this
     */
    setWidth(width) {
        this.width = width;
        this.onShapeChanged();
        return this;
    }

    /**
     * Get ellipse's height
     * @return {Number}
     */
    getHeight() {
        return this.height;
    }

    /**
     * Set new height to ellipse
     * @param {Number} height - new height
     * @fires Ellipse#shapechange
     * @return {Ellipse} this
     */
    setHeight(height) {
        this.height = height;
        this.onShapeChanged();
        return this;
    }

    /**
     * Gets the shell of the ellipse as a polygon, number of the shell points is decided by [options.numberOfShellPoints]{@link Circle#options}
     * @return {Coordinate[]} - shell coordinates
     */
    getShell() {
        var measurer = this._getMeasurer(),
            center = this.getCoordinates(),
            numberOfPoints = this.options['numberOfShellPoints'],
            width = this.getWidth(),
            height = this.getHeight();
        var shell = [];
        var s = Math.pow(width / 2, 2) * Math.pow(height / 2, 2),
            sx = Math.pow(width / 2, 2),
            sy = Math.pow(height / 2, 2);
        var deg, rad, dx, dy;
        for (var i = 0; i < numberOfPoints; i++) {
            deg = 360 * i / numberOfPoints;
            rad = deg * Math.PI / 180;
            dx = Math.sqrt(s / (sx * Math.pow(Math.tan(rad), 2) + sy));
            dy = Math.sqrt(s / (sy * Math.pow(1 / Math.tan(rad), 2) + sx));
            if (deg > 90 && deg < 270) {
                dx *= -1;
            }
            if (deg > 180 && deg < 360) {
                dy *= -1;
            }
            var vertex = measurer.locate(center, dx, dy);
            shell.push(vertex);
        }
        return shell;
    }

    /**
     * Ellipse won't have any holes, always returns null
     * @return {[]} an empty array
     */
    getHoles() {
        return [];
    }

    _containsPoint(point, tolerance) {
        const map = this.getMap();
        if (map.getCameraMatrix()) {
            return super._containsPoint(point, tolerance);
        }
        var t = isNil(tolerance) ? this._hitTestTolerance() : tolerance,
            pa = map.distanceToPixel(this.width / 2, 0),
            pb = map.distanceToPixel(0, this.height / 2),
            a = pa.width,
            b = pb.height,
            c = Math.sqrt(Math.abs(a * a - b * b)),
            xfocus = a >= b;
        var center = this._getCenter2DPoint();
        var f1, f2, d;
        if (xfocus) {
            f1 = new Point(center.x - c, center.y);
            f2 = new Point(center.x + c, center.y);
            d = a * 2;
        } else {
            f1 = new Point(center.x, center.y - c);
            f2 = new Point(center.x, center.y + c);
            d = b * 2;
        }
        point = new Point(point.x, point.y);

        /*
         L1 + L2 = D
         L1 + t >= L1'
         L2 + t >= L2'
         D + 2t >= L1' + L2'
         */
        return point.distanceTo(f1) + point.distanceTo(f2) <= d + 2 * t;
    }

    _computeExtent(measurer) {
        if (!measurer || !this._coordinates || isNil(this.width) || isNil(this.height)) {
            return null;
        }
        var width = this.getWidth(),
            height = this.getHeight();
        var p1 = measurer.locate(this._coordinates, width / 2, height / 2);
        var p2 = measurer.locate(this._coordinates, -width / 2, -height / 2);
        return new Extent(p1, p2);
    }

    _computeGeodesicLength() {
        if (isNil(this.width) || isNil(this.height)) {
            return 0;
        }
        //L=2πb+4(a-b)
        //近似值
        var longer = (this.width > this.height ? this.width : this.height);
        return 2 * Math.PI * longer / 2 - 4 * Math.abs(this.width - this.height);
    }

    _computeGeodesicArea() {
        if (isNil(this.width) || isNil(this.height)) {
            return 0;
        }
        return Math.PI * this.width * this.height / 4;
    }

    _exportGeoJSONGeometry() {
        var coordinates = Coordinate.toNumberArrays([this.getShell()]);
        return {
            'type': 'Polygon',
            'coordinates': coordinates
        };
    }

    _toJSON(options) {
        var opts = extend({}, options);
        var center = this.getCenter();
        opts.geometry = false;
        var feature = this.toGeoJSON(opts);
        feature['geometry'] = {
            'type': 'Polygon'
        };
        return {
            'feature': feature,
            'subType': 'Ellipse',
            'coordinates': [center.x, center.y],
            'width': this.getWidth(),
            'height': this.getHeight()
        };
    }

}

Ellipse.mergeOptions(options);

Ellipse.registerJSONType('Ellipse');

export default Ellipse;
