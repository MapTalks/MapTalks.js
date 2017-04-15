import { isString, parseJSON } from 'core/util';
import Ajax from 'core/Ajax';

function parse(arcConf) {
    const tileInfo = arcConf['tileInfo'],
        tileSize = {
            'width': tileInfo['cols'],
            'height': tileInfo['rows']
        },
        resolutions = [],
        lods = tileInfo['lods'];
    for (let i = 0, len = lods.length; i < len; i++) {
        resolutions.push(lods[i]['resolution']);
    }
    const fullExtent = arcConf['fullExtent'],
        origin = tileInfo['origin'],
        tileSystem = [1, -1, origin['x'], origin['y']];
    delete fullExtent['spatialReference'];
    return {
        'view': {
            'resolutions': resolutions,
            'fullExtent': fullExtent
        },
        'tileSystem': tileSystem,
        'tileSize': tileSize
    };
}

export default function loadArcgis(url, cb, context) {
    if (isString(url) && url.substring(0, 1) !== '{') {
        Ajax.getJSON(url, function (err, json) {
            if (err) {
                if (context) {
                    cb.call(context, err);
                } else {
                    cb(err);
                }
                return;
            }
            const view = parse(json);
            if (context) {
                cb.call(context, null, view);
            } else {
                cb(null, view);
            }
        });
    } else {
        if (isString(url)) {
            url = parseJSON(url);
        }
        const view = parse(url);
        if (context) {
            cb.call(context, null, view);
        } else {
            cb(null, view);
        }

    }
    return this;
}
