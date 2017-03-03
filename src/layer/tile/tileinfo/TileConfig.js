import { isString } from 'core/util';
import Point from 'geo/Point';
import Coordinate from 'geo/Coordinate';
import Extent from 'geo/Extent';
import Transformation from 'geo/transformation/Transformation';
import TileSystem from './TileSystem';

/**
 * Tile config for tile layers, an utilities class for tile layers to render tiles
 * @class
 * @category layer
 * @private
 */
class TileConfig {

    /**
     * @param {TileSystem} tileSystem  - tileSystem
     * @param {Extent} fullExtent      - fullExtent of the tile layer
     * @param {Size} tileSize          - tile size
     */
    constructor(tileSystem, fullExtent, tileSize) {
        this.tileSize = tileSize;
        this.fullExtent = fullExtent;
        this.prepareTileInfo(tileSystem, fullExtent);
    }

    prepareTileInfo(tileSystem, fullExtent) {
        if (isString(tileSystem)) {
            tileSystem = TileSystem[tileSystem.toLowerCase()];
        } else if (Array.isArray(tileSystem)) {
            tileSystem = new TileSystem(tileSystem);
        }

        if (!tileSystem) {
            throw new Error('Invalid TileSystem');
        }
        this.tileSystem = tileSystem;

        //自动计算transformation
        var a = fullExtent['right'] > fullExtent['left'] ? 1 : -1,
            b = fullExtent['top'] > fullExtent['bottom'] ? -1 : 1,
            c = tileSystem['origin']['x'],
            d = tileSystem['origin']['y'];
        this.transformation = new Transformation([a, b, c, d]);
        //计算transform后的以像素为单位的原点
        tileSystem['transOrigin'] = this.transformation.transform(tileSystem['origin'], 1);
    }

    getTileIndex(point, res) {
        var tileSystem = this.tileSystem,
            tileSize = this['tileSize'],
            transOrigin = tileSystem['transOrigin'],
            delta = 1E-7;

        var tileX = Math.floor(delta + (point.x - transOrigin.x) / (tileSize['width'] * res));
        var tileY = -Math.floor(delta + (point.y - transOrigin.y) / (tileSize['height'] * res));

        return {
            'x': tileSystem['scale']['x'] * tileX,
            'y': tileSystem['scale']['y'] * tileY
        };
    }

    /**
     * 根据中心点投影坐标, 计算中心点对应的瓦片和瓦片内偏移量
     * @param  {*} pLonlat   [description]
     * @param  {*} res [description]
     * @return {*}           [description]
     */
    getCenterTile(pLonlat, res) {
        var tileSystem = this.tileSystem,
            tileSize = this['tileSize'];
        var point = this.transformation.transform(pLonlat, 1);
        var tileIndex = this.getTileIndex(point, res);

        var tileLeft = tileIndex['x'] * tileSize['width'];
        var tileTop = tileIndex['y'] * tileSize['height'];

        var offsetLeft = point.x / res - tileSystem['scale']['x'] * tileLeft;
        var offsetTop = point.y / res + tileSystem['scale']['y'] * tileTop;

        //如果x方向为左大右小
        if (tileSystem['scale']['x'] < 0) {
            tileIndex['x'] -= 1;
        }
        //如果y方向上大下小
        if (tileSystem['scale']['y'] > 0) {
            tileIndex['y'] -= 1;
        }

        //有可能tileIndex超出世界范围
        tileIndex = this.getNeighorTileIndex(tileIndex['y'], tileIndex['x'], 0, 0, true);

        return {
            'x': tileIndex['x'],
            'y': tileIndex['y'],
            'offset': new Point(offsetLeft, offsetTop)
        };
    }

    /**
     * 根据给定的瓦片编号,和坐标编号偏移量,计算指定的瓦片编号
     * @param  {*} tileY   [description]
     * @param  {*} tileX   [description]
     * @param  {*} offsetY [description]
     * @param  {*} offsetX [description]
     * @param  {*} zoomLevel [description]
     * @return {*}         [description]
     */
    getNeighorTileIndex(tileY, tileX, offsetY, offsetX, res, isRepeatWorld) {
        var tileSystem = this.tileSystem;
        var x = (tileX + tileSystem['scale']['x'] * offsetX);
        var y = (tileY - tileSystem['scale']['y'] * offsetY);
        var idx = x;
        var idy = y;
        //连续世界瓦片计算
        if (isRepeatWorld) {
            var ext = this._getTileFullIndex(res);
            if (x < ext['xmin']) {
                x = ext['xmax'] - (ext['xmin'] - x) % (ext['xmax'] - ext['xmin']);
                if (x === ext['xmax']) {
                    x = ext['xmin'];
                }
            } else if (x >= ext['xmax']) {
                x = ext['xmin'] + (x - ext['xmin']) % (ext['xmax'] - ext['xmin']);
            }

            if (y >= ext['ymax']) {
                y = ext['ymin'] + (y - ext['ymin']) % (ext['ymax'] - ext['ymin']);
            } else if (y < ext['ymin']) {
                y = ext['ymax'] - (ext['ymin'] - y) % (ext['ymax'] - ext['ymin']);
                if (y === ext['ymax']) {
                    y = ext['ymin'];
                }
            }
        }
        return {
            'x': x,
            'y': y,
            'idx' : idx,
            'idy' : idy
        };
    }

    _getTileFullIndex(res) {
        var ext = this.fullExtent;
        var transformation = this.transformation;
        var nwIndex = this.getTileIndex(transformation.transform(new Coordinate(ext['left'], ext['top']), 1), res);
        var seIndex = this.getTileIndex(transformation.transform(new Coordinate(ext['right'], ext['bottom']), 1), res);
        return new Extent(nwIndex, seIndex);
    }

    /**
     * 计算瓦片左下角的大地投影坐标
     * @param  {*} tileY     [description]
     * @param  {*} tileX     [description]
     * @param  {*} res       [description]
     * @return {*}           [description]
     */
    getTileProjectedSw(tileY, tileX, res) {
        var tileSystem = this.tileSystem;
        var tileSize = this['tileSize'];
        var y = tileSystem['origin']['y'] + tileSystem['scale']['y'] * (tileY + (tileSystem['scale']['y'] === 1 ? 0 : 1)) * (res * tileSize['height']);
        var x = tileSystem['scale']['x'] * (tileX + (tileSystem['scale']['x'] === 1 ? 0 : 1)) * res * tileSize['width'] + tileSystem['origin']['x'];
        return [x, y];
    }

}

export default TileConfig;
