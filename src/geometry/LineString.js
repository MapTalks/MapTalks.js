/**
 * @classdesc Represents a LineString type Geometry.
 * @class
 * @category geometry
 * @extends {maptalks.Vector}
 * @mixes   {maptalks.Geometry.Poly}
 * @param {maptalks.Coordinate[]|Number[][]} coordinates - coordinates of the line string
 * @param {Object} [options=null] - construct options defined in [maptalks.LineString]{@link maptalks.LineString#options}
 * @example
 * var line = new maptalks.LineString(
 *     [
 *         [121.4594221902467, 31.241237891628657],
 *         [121.46371372467041, 31.242265291152066],
 *         [121.46727569824205, 31.238706037961997],
 *         [121.47019394165014, 31.24145804961012]
 *     ]
 * ).addTo(layer);
 */
maptalks.LineString = maptalks.Polyline = maptalks.Vector.extend(/** @lends maptalks.LineString.prototype */{
    includes:[maptalks.Geometry.Poly],

    type:maptalks.Geometry['TYPE_LINESTRING'],

    /**
    * @property {Object} [options=null]
    * @property {String} [options.antiMeridian=continuous] - how to deal with the anti-meridian problem, split or continue the linestring when it cross the 180 or -180 longtitude line.
    * @property {String} [options.arrowStyle=null]                 - style of arrow, if not null, arrows will be drawn, possible values: classic
    * @property {String} [options.arrowPlacement=vertex-last]      - arrow's placement: vertex-first, vertex-last, vertex-firstlast, point
    */
    options:{
        'antiMeridian' : 'continuous',
        'arrowStyle' : null,
        'arrowPlacement' : 'vertex-last' //vertex-first, vertex-last, vertex-firstlast, point
    },

    initialize:function (coordinates, opts) {
        this.setCoordinates(coordinates);
        this._initOptions(opts);
    },

    /**
     * Set new coordinates to the line string
     * @param {maptalks.Coordinate[]|Number[][]} coordinates - new coordinates
     * @fires maptalks.LineString#shapechange
     * @return {maptalks.LineString} this
     */
    setCoordinates:function (coordinates) {
        if (!coordinates) {
            this._coordinates = null;
            this._setPrjCoordinates(null);
            return this;
        }
        this._coordinates = maptalks.GeoJSON.toCoordinates(coordinates);
        if (this.getMap()) {
            this._setPrjCoordinates(this._projectCoords(this._coordinates));
        } else {
            this.onShapeChanged();
        }
        return this;
    },

    /**
     * Get coordinates of the line string
     * @return {maptalks.Coordinate[]|Number[][]} coordinates
     */
    getCoordinates:function () {
        if (!this._coordinates) {
            return [];
        }
        return this._coordinates;
    },

    animateShow: function (options) {
        if (!options) {
            options = {};
        }
        var coordinates = this.getCoordinates();
        var duration = options['duration'] || 1000;
        var length = this.getLength();
        var easing = options['easing'] || 'out';
        this.setCoordinates([]);
        var player = maptalks.Animation.animate({'t' : duration}, {'speed' : duration, 'easing' : easing}, maptalks.Util.bind(function (frame) {
            if (!this.getMap()) {
                player.finish();
                this.setCoordinates(coordinates);
                return;
            }
            this._drawAnimFrame(frame.styles.t, duration, length, coordinates);
        }, this));
        player.play();
        return this;
    },

    _drawAnimFrame: function (t, duration, length, coordinates) {
        if (t === 0) {
            this.setCoordinates([]);
            return;
        }
        var map = this.getMap();
        var targetLength = t / duration * length;
        if (!this._animIdx) {
            this._animIdx = 0;
            this._animLenSoFar = 0;
            this.show();
        }
        var i, l;
        var segLen = 0;
        for (i = this._animIdx, l = coordinates.length; i < l - 1; i++) {
            segLen = map.computeLength(coordinates[i], coordinates[i + 1]);
            if (this._animLenSoFar + segLen > targetLength) {
                break;
            }
            this._animLenSoFar += segLen;
        }
        this._animIdx = i;
        if (this._animIdx >= l - 1) {
            this.setCoordinates(coordinates);
            return;
        }
        var idx = this._animIdx;
        var p1 = coordinates[idx], p2 = coordinates[idx + 1],
            span = targetLength - this._animLenSoFar,
            r = span / segLen;
        var x = p1.x + (p2.x - p1.x) * r,
            y = p1.y + (p2.y - p1.y) * r,
            targetCoord = new maptalks.Coordinate(x, y);
        var animCoords = coordinates.slice(0, this._animIdx + 1);
        animCoords.push(targetCoord);

        this.setCoordinates(animCoords);
    },

    _computeGeodesicLength:function (measurer) {
        return maptalks.GeoUtil._computeLength(this.getCoordinates(), measurer);
    },

    _computeGeodesicArea:function () {
        return 0;
    },

    _containsPoint: function (point, tolerance) {
        var t = maptalks.Util.isNil(tolerance) ? this._hitTestTolerance() : tolerance;
        function isContains(points) {
            var i, p1, p2,
                len = points.length;

            for (i = 0, len = points.length; i < len - 1; i++) {
                p1 = points[i];
                p2 = points[i + 1];

                if (maptalks.GeoUtil.distanceToSegment(point, p1, p2) <= t) {
                    return true;
                }
            }
            return false;
        }

        if (t < 3) {
            t = 3;
        }

        var arrowStyle = this._getArrowStyle();
        var lineWidth = this._getInternalSymbol()['lineWidth'];

        var map = this.getMap(),
            extent = this._getPrjExtent(),
            nw = new maptalks.Coordinate(extent.xmin, extent.ymax),
            se = new maptalks.Coordinate(extent.xmax, extent.ymin),
            pxMin = map._prjToPoint(nw),
            pxMax = map._prjToPoint(se),
            pxExtent = new maptalks.PointExtent(pxMin.x - t, pxMin.y - t,
                                    pxMax.x + t, pxMax.y + t);
        if (arrowStyle) {
            pxExtent._expand(Math.max(arrowStyle[0] * lineWidth, arrowStyle[1] * lineWidth));
        }
        if (!pxExtent.contains(point)) { return false; }

        // check arrow
        var points;
        if (this._getArrowStyle()) {
            points = this._getPath2DPoints(this._getPrjCoordinates(), true);
            var arrows = this._getArrows(points, lineWidth, (tolerance ? tolerance : 2) + lineWidth / 2);
            for (var ii = arrows.length - 1; ii >= 0; ii--) {
                if (maptalks.GeoUtil.pointInsidePolygon(point, arrows[ii])) {
                    return true;
                }
            }
        }

        points = points || this._getPath2DPoints(this._getPrjCoordinates());
        var isSplitted = points.length > 0 && maptalks.Util.isArray(points[0]);
        if (isSplitted) {
            for (var i = 0, l = points.length; i < l; i++) {
                if (isContains(points[i])) {
                    return true;
                }
            }
            return false;
        } else {
            return isContains(points);
        }

    }

});
