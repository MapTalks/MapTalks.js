/**
 * Common methods for geometry classes based on coordinates arrays, e.g. LineString, Polygon
 * @mixin maptalks.Geometry.Poly
 */
maptalks.Geometry.Poly = {
    /**
     * Transform projected coordinates to view points
     * @param  {maptalks.Coordinate[]} prjCoords  - projected coordinates
     * @param  {Boolean} disableSimplify          - whether to disable simplify\
     * @param  {Number} zoom                      - 2d points' zoom level
     * @returns {maptalks.Point[]}
     * @private
     */
    _getPath2DPoints:function (prjCoords, disableSimplify, zoom) {
        var result = [];
        if (!maptalks.Util.isArrayHasData(prjCoords)) {
            return result;
        }
        delete this._simplified;
        var map = this.getMap(),
            fullExtent = map.getFullExtent(),
            projection = this._getProjection();
        var anti = this.options['antiMeridian'] && maptalks.MeasurerUtil.isSphere(projection),
            isClip = map.options['clipFullExtent'],
            isSimplify = !disableSimplify && this.getLayer() && this.getLayer().options['enableSimplify'],
            tolerance = 2 * map._getResolution(),
            isMulti = maptalks.Util.isArray(prjCoords[0]);
        if (isSimplify && !isMulti) {
            var count = prjCoords.length;
            prjCoords = maptalks.Simplify.simplify(prjCoords, tolerance, false);
            this._simplified = prjCoords.length < count;
        }
        if (maptalks.Util.isNil(zoom)) {
            zoom = map.getZoom();
        }
        var i, len, p, pre, current, dx, dy, my,
            part1 = [], part2 = [], part = part1;
        for (i = 0, len = prjCoords.length; i < len; i++) {
            p = prjCoords[i];
            if (isMulti) {
                part.push(this._getPath2DPoints(p, disableSimplify, zoom));
                continue;
            }
            if (maptalks.Util.isNil(p) || (isClip && !fullExtent.contains(p))) {
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
                                part.push(map.coordinateToPoint(new maptalks.Coordinate(-180, my), zoom));
                                part = part === part1 ? part2 : part1;
                                part.push(map.coordinateToPoint(new maptalks.Coordinate(180, my), zoom));

                            } else {
                                my = pre.y + dy * (180 - pre.x) / (360 + dx) * (pre.y > current.y ? 1 : -1);
                                part.push(map.coordinateToPoint(new maptalks.Coordinate(180, my), zoom));
                                part = part === part1 ? part2 : part1;
                                part.push(map.coordinateToPoint(new maptalks.Coordinate(-180, my), zoom));

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
    },

    _anti: function (c, dx) {
        if (dx > 0) {
            return c.substract(180 * 2, 0);
        } else {
            return c.add(180 * 2, 0);
        }
    },

    _setPrjCoordinates:function (prjPoints) {
        this._prjCoords = prjPoints;
        this.onShapeChanged();
    },

    _getPrjCoordinates:function () {
        if (!this._prjCoords) {
            var points = this._coordinates;
            this._prjCoords = this._projectCoords(points);
        }
        return this._prjCoords;
    },

    //update cached variables if geometry is updated.
    _updateCache:function () {
        delete this._extent;
        var projection = this._getProjection();
        if (!projection) {
            return;
        }
        if (this._prjCoords) {
            this._coordinates = this._unprojectCoords(this._getPrjCoordinates());
        }
        if (this._prjHoles) {
            this._holes = this._unprojectCoords(this._getPrjHoles());
        }
    },

    _clearProjection:function () {
        this._prjCoords = null;
        if (this._prjHoles) {
            this._prjHoles = null;
        }
    },

    _projectCoords:function (points) {
        var projection = this._getProjection();
        if (projection) {
            return projection.projectCoords(points);
        }
        return null;
    },

    _unprojectCoords:function (prjPoints) {
        var projection = this._getProjection();
        if (projection) {
            return projection.unprojectCoords(prjPoints);
        }
        return null;
    },

    _computeCenter:function () {
        var ring = this._coordinates;
        if (!maptalks.Util.isArrayHasData(ring)) {
            return null;
        }
        var sumx = 0, sumy = 0;
        var counter = 0;
        var size = ring.length;
        for (var i = 0; i < size; i++) {
            if (ring[i]) {
                if (maptalks.Util.isNumber(ring[i].x) && maptalks.Util.isNumber(ring[i].y)) {
                    sumx += ring[i].x;
                    sumy += ring[i].y;
                    counter++;
                }
            }
        }
        return new maptalks.Coordinate(sumx / counter, sumy / counter);
    },

    _computeExtent:function () {
        var ring = this._coordinates;
        if (!maptalks.Util.isArrayHasData(ring)) {
            return null;
        }
        var rings = [ring];
        if (this.hasHoles && this.hasHoles()) {
            rings = rings.concat(this.getHoles());
        }
        return this._computeCoordsExtent(rings);
    },

     /**
      * Compute extent of a group of coordinates
      * @param  {maptalks.Coordinate[]} coords  - coordinates
      * @returns {maptalks.Extent}
      * @private
      */
    _computeCoordsExtent: function (coords) {
        var result = null,
            anti = this.options['antiMeridian'];
        var ext, p, dx, pre;
        for (var i = 0, len = coords.length; i < len; i++) {
            for (var j = 0, jlen = coords[i].length; j < jlen; j++) {
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
                ext = new maptalks.Extent(p, p);
                result = ext.combine(result);
            }

        }
        return result;
    },

    _get2DLength: function () {
        var vertexes = this._getPath2DPoints(this._getPrjCoordinates(), true);
        var len = 0;
        for (var i = 1, l = vertexes.length; i < l; i++) {
            len += vertexes[i].distanceTo(vertexes[i - 1]);
        }
        return len;
    }
};
