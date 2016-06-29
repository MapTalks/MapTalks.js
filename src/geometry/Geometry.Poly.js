/**
 * Common methods for geometry classes based on coordinates arrays, e.g. LineString, Polygon
 * @mixin maptalks.Geometry.Poly
 */
Z.Geometry.Poly = {
    /**
     * Transform projected coordinates to view points
     * @param  {maptalks.Coordinate[]} prjCoords  - projected coordinates
     * @returns {maptalks.Point[]}
     * @private
     */
    _getPathViewPoints:function (prjCoords) {
        var result = [];
        if (!Z.Util.isArrayHasData(prjCoords)) {
            return result;
        }
        var map = this.getMap(),
            fullExtent = map.getFullExtent(),
            projection = this._getProjection();
        var anti = this.options['antiMeridian'],
            isClip = map.options['clipFullExtent'],
            isSimplify = this.getLayer() && this.getLayer().options['enableSimplify'],
            tolerance = 2 * map._getResolution(),
            isMulti = Z.Util.isArray(prjCoords[0]);
        if (isSimplify && !isMulti) {
            prjCoords = Z.Simplify.simplify(prjCoords, tolerance, false);
        }
        var i, len, p, pre, current, dx, dy, my,
            part1 = [], part2 = [], part = part1;
        for (i = 0, len = prjCoords.length; i < len; i++) {
            p = prjCoords[i];
            if (isMulti) {
                part.push(this._getPathViewPoints(p));
                continue;
            }
            if (Z.Util.isNil(p) || (isClip && !fullExtent.contains(p))) {
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
                                part.push(map.coordinateToViewPoint(new Z.Coordinate(-180, my)));
                                part = part === part1 ? part2 : part1;
                                part.push(map.coordinateToViewPoint(new Z.Coordinate(180, my)));

                            } else {
                                my = pre.y + dy * (180 - pre.x) / (360 + dx) * (pre.y > current.y ? 1 : -1);
                                part.push(map.coordinateToViewPoint(new Z.Coordinate(180, my)));
                                part = part === part1 ? part2 : part1;
                                part.push(map.coordinateToViewPoint(new Z.Coordinate(-180, my)));

                            }
                        }
                    }
                }
            }
            part.push(map._prjToViewPoint(p));
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
        this._onShapeChanged();
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
        if (!Z.Util.isArrayHasData(ring)) {
            return null;
        }
        var sumx = 0, sumy = 0;
        var counter = 0;
        var size = ring.length;
        for (var i = 0; i < size; i++) {
            if (ring[i]) {
                if (Z.Util.isNumber(ring[i].x) && Z.Util.isNumber(ring[i].y)) {
                    sumx += ring[i].x;
                    sumy += ring[i].y;
                    counter++;
                }
            }
        }
        return new Z.Coordinate(sumx / counter, sumy / counter);
    },

    _computeExtent:function () {
        var ring = this._coordinates;
        if (!Z.Util.isArrayHasData(ring)) {
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
                ext = new Z.Extent(p, p);
                result = ext.combine(result);
            }

        }
        return result;
    }
};
