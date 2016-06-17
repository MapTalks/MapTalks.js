/**
 * @classdesc
 * A class internally used by tile layer helps to descibe tile system used by different tile services.<br>
 * Similar with [transformation]{@link maptalks.Transformation}, it contains 4 numbers: <br>
 * sx : the order of X-axis tile index, 1 means right is larger and -1 means the reverse, left is larger;<br>
 * sy : the order of Y-axis tile index, 1 means top is larger and -1 means the reverse, bottom is larger;<br>
 * ox : x of the origin point of the world's projected coordinate system <br>
 * oy : y of the origin point of the world's projected coordinate system <br>
 * @see {@link http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification}
 * @class
 * @category layer
 * @protected
 */
Z.TileSystem = function (sx, sy, ox, oy) {
    if (Z.Util.isArray(sx)) {
        this.scale =  {x : sx[0], y : sx[1]};
        this.origin = {x : sx[2], y : sx[3]};
    } else {
        this.scale =  {x : sx, y : sy};
        this.origin = {x : ox, y : oy};
    }
};

Z.Util.extend(Z.TileSystem, /** @lends maptalks.TileSystem */{
    /**
     * The most common used tile system, used by google maps, bing maps and amap, soso maps in China.
     * @see {@link https://en.wikipedia.org/wiki/Web_Mercator}
     * @constant
     * @static
     */
    'web-mercator' : new Z.TileSystem([1, -1, -20037508.34, 20037508.34]),

    /**
     * Predefined tile system for TMS tile system, A tile system published by [OSGEO]{@link http://www.osgeo.org/}. <br>
     * Also used by mapbox's [mbtiles]{@link https://github.com/mapbox/mbtiles-spec} specification.
     * @see {@link http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification}
     * @constant
     * @static
     */
    'tms-global-mercator' : new Z.TileSystem([1, 1, -20037508.34, -20037508.34]),

    /**
     * Another tile system published by [OSGEO]{@link http://www.osgeo.org/}, based on EPSG:4326 SRS.
     * @see {@link http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification#global-geodetic}
     * @constant
     * @static
     */
    'tms-global-geodetic' : new Z.TileSystem([1, 1, -180, -90]),

    /**
     * Tile system used by [baidu]{@link http://map.baidu.com}
     * @constant
     * @static
     */
    'baidu' : new Z.TileSystem([1, 1, 0, 0])
});

/**
 * Get the default tile system's code for the projection.
 * @function
 * @static
 * @memberOf maptalks.TileSystem
 * @name  getDefault
 * @param  {Object} projection      - a projection object
 * @return {String} tile system code
 */
Z.TileSystem.getDefault = function (projection) {
    if (projection['code'].toLowerCase() === 'baidu') {
        return 'baidu';
    } else if (projection['code'].toLowerCase() === 'EPSG:4326'.toLowerCase()) {
        return 'tms-global-geodetic';
    } else {
        return 'web-mercator';
    }
};
