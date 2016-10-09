/**
 * @classdesc Curve style LineString
 * @class
 * @category geometry
 * @extends {maptalks.LineString}
 * @param {maptalks.Coordinate[]|Number[][]} coordinates - coordinates of the line string
 * @param {Object} [options=null]   - construct options defined in [maptalks.CurveLine]{@link maptalks.CurveLine#options}
 * @example
 * var curve = new maptalks.CurveLine(
 *     [
 *         [121.47083767181408,31.214448123476995],
 *         [121.4751292062378,31.215475523000404],
 *         [121.47869117980943,31.211916269810335]
 *     ],
 *     {
 *         curveType : 1,
 *         arcDegree : 120,
 *         symbol : {
 *             'lineWidth' : 5
 *         }
 *     }
 * ).addTo(layer);
 */
Z.CurveLine = Z.LineString.extend(/** @lends maptalks.CurveLine.prototype */{
    /**
     * @property {Object} options
     * @property {Number} [options.curveType=1]            - curve type of the curve line: 0 - straight line; 1: circle arc; 2: quadratic curve; 3: bezier curve
     * @property {Number} [options.arcDegree=90]           - arc's degree if curveType is 1 (circle arc).
     */
    options:{
        'curveType'   : 1,
        'arcDegree'     : 90
    },

    _toJSON:function (options) {
        return {
            'feature' : this.toGeoJSON(options),
            'subType' : 'CurveLine'
        };
    },

    _getRenderCanvasResources:function () {
        //draw a triangle arrow
        var prjVertexes = this._getPrjCoordinates();
        var points = this._getPath2DPoints(prjVertexes);
        var arcDegree = this.options['arcDegree'],
            curveType = this.options['curveType'];
        var me = this;
        var fn = function (_ctx, _points, _lineOpacity) {
            var curveFn, degree;
            switch (curveType) {
            case 0 : curveFn = Z.Canvas._lineTo; degree = 1; break;
            case 1 : curveFn = Z.Canvas._arcBetween; degree = 1; break;
            case 2 : curveFn = Z.Canvas._quadraticCurveTo; degree = 2; break;
            case 3 : curveFn = Z.Canvas._bezierCurveTo; degree = 3; break;
            }
            var i, len = _points.length;
            _ctx.beginPath();
            for (i = 0; i < len; i += degree) {
                // var p = _points[i].round();
                var p = _points[i];
                if (i === 0) {
                    _ctx.moveTo(p.x, p.y);
                }
                var left = len - i;
                if (left <= degree) {
                    if (left === 2) {
                        p = _points[len - 1];
                        _ctx.lineTo(p.x, p.y);
                    } else if (left === 3) {
                        Z.Canvas._quadraticCurveTo(_ctx, _points[len - 2], _points[len - 1]);
                    }
                } else {
                    var points = [];
                    for (var ii = 0; ii < degree; ii++) {
                        points.push(_points[i + ii + 1]);
                    }
                    var args = [_ctx].concat(points);
                    if (curveFn === Z.Canvas._arcBetween) {
                        //arc start point
                        args.splice(1, 0, p);
                        args = args.concat([arcDegree]);
                    }
                    curveFn.apply(Z.Canvas, args);
                    Z.Canvas._stroke(_ctx, this.style['lineOpacity']);
                }
            }
            Z.Canvas._stroke(_ctx, this.style['lineOpacity']);
            if (_ctx.setLineDash) {
                //remove line dash effect if any
                _ctx.setLineDash([]);
            }
            if (me.options['arrowStyle'] && _points.length >= 2) {
                var placement = me.options['arrowPlacement'];
                if (placement === 'vertex-first' || placement === 'vertex-firstlast') {
                    me._arrow(_ctx, _points[1], _points[0], _lineOpacity, me.options['arrowStyle']);
                }
                if (placement === 'vertex-last' || placement === 'vertex-firstlast') {
                    me._arrow(_ctx, _points[_points.length - 2], _points[_points.length - 1], _lineOpacity, me.options['arrowStyle']);
                }
                //besizerCurves doesn't have point arrows
                if ((curveType === 0 || curveType === 1) && placement === 'point') {
                    for (i = 0, len = _points.length - 1; i < len; i++) {
                        me._arrow(_ctx, _points[i], _points[i + 1], _lineOpacity, me.options['arrowStyle']);
                    }
                }
            }

        };
        return {
            'fn' : fn,
            'context' : [points]
        };
    }
});

Z.CurveLine.fromJSON = function (json) {
    var feature = json['feature'];
    var curveLine = new Z.CurveLine(feature['geometry']['coordinates'], json['options']);
    curveLine.setProperties(feature['properties']);
    return curveLine;
};
