/**
 * @classdesc
 * Represents a Geometry type of MultiPolygon
 * @class
 * @category geometry
 * @category geometry
 * @extends maptalks.GeometryCollection
 * @mixes maptalks.Geometry.MultiPoly
 * @param {Number[][][][]|maptalks.Coordinate[][][]|maptalks.Polygon[]} data - construct data, coordinates or a array of polygons
 * @param {Object} [options=null]           - options defined in [maptalks.MultiPolygon]{@link maptalks.MultiPolygon#options}
 * @example
 * var multiPolygon = new maptalks.MultiPolygon(
 *       [
 *           [
 *               [
 *                   [121.55074604278596, 31.242008515751614],
 *                   [121.55074604278596, 31.23914637638951],
 *                   [121.55349262481711, 31.23914637638951],
 *                   [121.55349262481711, 31.24134802974913],
 *                   [121.5518618417361, 31.241384723537074],
 *                   [121.55074604278596, 31.242008515751614]
 *               ]
 *           ],
 *           [
 *               [
 *                   [121.5543080163576, 31.241054478932387],
 *                   [121.5543938470461, 31.240100432478293],
 *                   [121.55555256134048, 31.240173821009137],
 *                   [121.55542381530773, 31.240981091085693],
 *                   [121.5543080163576, 31.241054478932387]
 *               ]
 *           ]
 *
 *       ],
 *       {
 *           symbol:{
 *               'lineColor' : '#000000',
 *               'lineWidth' : 2,
 *               'lineDasharray' : null,//线形
 *               'lineOpacity' : 1,
 *               'polygonFill' : 'rgb(255, 0, 0)',
 *               'polygonOpacity' : 0.8
 *           },
 *           draggable:true
 * }).addTo(layer);
 */
Z.MultiPolygon = Z.GeometryCollection.extend(/** @lends maptalks.MultiPolygon.prototype */{
    includes:[Z.Geometry.MultiPoly],
    GeometryType:Z.Polygon,

    type:Z.Geometry['TYPE_MULTIPOLYGON'],

    initialize:function (data, opts) {
        this._initOptions(opts);
        this._initData(data);
    }
});
