/* eslint-disable @typescript-eslint/ban-types */
import { RESOURCE_PROPERTIES, RESOURCE_SIZE_PROPERTIES } from '../Constants';
import { IS_NODE } from './env';
import { extend, isNil, isNumber, isString } from './common';
import { extractCssUrl, btoa } from './util';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { isFunctionDefinition, getFunctionTypeResources } from '../mapbox';
import Browser from '../Browser';


/**
 * Translate symbol properties to SVG properties
 * @param s - object with symbol properties
 * @return  object with SVG properties
 * @memberOf Util
 */
export function translateToSVGStyles(s: any) {
    const result = {
        'stroke': {
            'stroke': s['markerLineColor'],
            'stroke-width': s['markerLineWidth'],
            'stroke-opacity': s['markerLineOpacity'],
            'stroke-dasharray': null,
            'stroke-linecap': 'butt',
            'stroke-linejoin': 'round'
        },
        'fill': {
            'fill': s['markerFill'],
            'fill-opacity': s['markerFillOpacity']
        }
    };
    if (result['stroke']['stroke-width'] === 0) {
        result['stroke']['stroke-opacity'] = 0;
    }
    return result;
}

/**
 * Get SVG Base64 String from a marker symbol with (markerType : path)
 * @param  symbol - symbol with markerType of path
 * @param  width
 * @param  height
 * @return SVG Base64 String
 * @memberOf Util
 */
export function getMarkerPathBase64(symbol: any, width?: number, height?: number): string {
    if (!symbol['markerPath']) {
        return null;
    }
    let op = 1;
    const styles = translateToSVGStyles(symbol);
    //context.globalAlpha doesn't take effect with drawing SVG in IE9/10/11 and EGDE, so set opacity in SVG element.
    if (isNumber(symbol['markerOpacity'])) {
        op = symbol['markerOpacity'] as any;
    }
    if (isNumber(symbol['opacity'])) {
        op *= symbol['opacity'] as any;
    }
    const svgStyles = {};
    if (styles) {
        for (const p in styles['stroke']) {
            if (styles['stroke'].hasOwnProperty(p)) {
                if (!isNil(styles['stroke'][p])) {
                    svgStyles[p] = styles['stroke'][p];
                }
            }
        }
        for (const p in styles['fill']) {
            if (styles['fill'].hasOwnProperty(p)) {
                if (!isNil(styles['fill'][p])) {
                    svgStyles[p] = styles['fill'][p];
                }
            }
        }
    }

    const pathes = Array.isArray(symbol['markerPath']) ? symbol['markerPath'] : [symbol['markerPath']];
    let path;
    const pathesToRender = [];
    for (let i = 0; i < pathes.length; i++) {
        path = isString(pathes[i]) ? {
            'path': pathes[i]
        } : pathes[i];
        path = extend({}, path, svgStyles);
        path['d'] = path['path'];
        delete path['path'];
        pathesToRender.push(path);
    }
    const svg = ['<svg version="1.1"', 'xmlns="http://www.w3.org/2000/svg"'];
    if (op < 1) {
        svg.push('opacity="' + op + '"');
    }
    // if (symbol['markerWidth'] && symbol['markerHeight']) {
    //     svg.push('height="' + symbol['markerHeight'] + '" width="' + symbol['markerWidth'] + '"');
    // }
    if (symbol['markerPathWidth'] && symbol['markerPathHeight']) {
        svg.push('viewBox="0 0 ' + symbol['markerPathWidth'] + ' ' + symbol['markerPathHeight'] + '"');
    }
    svg.push('preserveAspectRatio="none"');
    if (width) {
        svg.push('width="' + width + '"');
    }
    if (height) {
        svg.push('height="' + height + '"');
    }
    svg.push('><defs></defs>');

    for (let i = 0; i < pathesToRender.length; i++) {
        //非path节点的直接 out dom html,such: circle rect,polygon,polyline etc
        if (pathesToRender[i].d instanceof Element) {
            svg.push(pathesToRender[i].d.outerHTML);
            continue;
        }
        let strPath = '<path ';
        for (const p in pathesToRender[i]) {
            if (pathesToRender[i].hasOwnProperty(p)) {
                strPath += ' ' + p + '="' + pathesToRender[i][p] + '"';
            }
        }
        strPath += '></path>';
        svg.push(strPath);
    }
    svg.push('</svg>');
    const b64 = 'data:image/svg+xml;base64,' + btoa(svg.join(' ') as any);
    return b64;
}

/**
 * Get external resources from the given symbol
 * @param symbol     - symbol
 * @param toAbsolute - whether convert url to aboslute
 * @return resource urls
 * @memberOf Util
 */
export function getExternalResources(symbol: any, toAbsolute?: boolean): string[] {
    if (!symbol) {
        return [];
    }
    let symbols = symbol;
    if (!Array.isArray(symbol)) {
        symbols = [symbol];
    }
    const resources = [];
    const props = RESOURCE_PROPERTIES;
    let res, resSizeProp;
    let w, h;
    for (let i = symbols.length - 1; i >= 0; i--) {
        symbol = symbols[i];
        if (!symbol) {
            continue;
        }
        if (toAbsolute) {
            symbol = convertResourceUrl(symbol);
        }
        for (let ii = 0; ii < props.length; ii++) {
            res = symbol[props[ii]];
            if (isFunctionDefinition(res)) {
                res = getFunctionTypeResources(res);
            }
            if (!res) {
                continue;
            }
            if (!Array.isArray(res)) {
                res = [res];
            }
            for (let iii = 0; iii < res.length; iii++) {
                if (res[iii].slice(0, 4) === 'url(') {
                    res[iii] = extractCssUrl(res[iii]);
                }
                resSizeProp = RESOURCE_SIZE_PROPERTIES[ii];
                resources.push([res[iii], symbol[resSizeProp[0]], symbol[resSizeProp[1]]]);
            }
        }
        if (symbol['markerType'] === 'path' && symbol['markerPath']) {
            w = isFunctionDefinition(symbol['markerWidth']) ? 200 : symbol['markerWidth'];
            h = isFunctionDefinition(symbol['markerHeight']) ? 200 : symbol['markerHeight'];
            if (isFunctionDefinition(symbol['markerPath'])) {
                res = getFunctionTypeResources(symbol['markerPath']);
                const path = symbol['markerPath'];
                for (let iii = 0; iii < res.length; iii++) {
                    symbol['markerPath'] = res[iii];
                    resources.push([getMarkerPathBase64(symbol), w, h]);
                }
                symbol['markerPath'] = path;
            } else {
                resources.push([getMarkerPathBase64(symbol), w, h]);
            }
        }
    }
    return resources;
}

/**
 * Convert symbol's resources' urls from relative path to an absolute path.
 * @param symbol
 * @private
 * @memberOf Util
 */
export function convertResourceUrl(symbol: any) {
    if (!symbol) {
        return null;
    }

    const s = symbol;
    if (IS_NODE) {
        return s;
    }
    const props = RESOURCE_PROPERTIES;
    let res;
    for (let ii = 0, len = props.length; ii < len; ii++) {
        res = s[props[ii]];
        if (!res) {
            continue;
        }
        s[props[ii]] = _convertUrl(res);
    }
    return s;
}

function _convertUrl(res: any) {
    if (isFunctionDefinition(res) && res.stops) {
        const stops = res.stops;
        for (let i = 0; i < stops.length; i++) {
            stops[i][1] = _convertUrl(stops[i][1]);
        }
        return res;
    }
    if (res.slice(0, 4) === 'url(') {
        res = extractCssUrl(res);
    }
    return res;
}



export function isImageBitMap(img) {
    return img && Browser.decodeImageInWorker && img instanceof ImageBitmap;
}


const parser = new DOMParser();

function getAttr(attributes: NamedNodeMap, key: string) {
    if (!attributes) {
        return null;
    }
    return attributes[key] && attributes[key].value;
}

export function parseSVG(str: string) {
    const xmlDoc = parser.parseFromString(str, 'text/xml');
    const root = xmlDoc.querySelector('svg');
    if (!root) {
        return null;
    }
    //parse all node,not only path node
    const paths = root.childNodes;
    const data = [];
    const rootAttribute = root.attributes;
    const rootFill = getAttr(rootAttribute, 'fill');
    const rootFillOpacity = getAttr(rootAttribute, 'fill-opacity');
    const rootStroke = getAttr(rootAttribute, 'stroke');
    const rootStrokeOpacity = getAttr(rootAttribute, 'stroke-opacity');
    const rootStrokeWidth = getAttr(rootAttribute, 'stroke-width');
    for (let i = 0, len = paths.length; i < len; i++) {
        const dom = paths[i];
        const attributes = (dom as any).attributes;
        if (!attributes) {
            continue;
        }
        let d;
        const tagName = (dom as any).tagName || '';
        const isPath = tagName.toLowerCase() === 'path';
        //非path节点直接拿dom节点 作为path参数
        if (!isPath) {
            d = dom;
        } else {
            d = getAttr(attributes, 'd');
        }
        if (!d) {
            continue;
        }
        const fill = getAttr(attributes, 'fill') || rootFill;
        const stroke = getAttr(attributes, 'stroke') || rootStroke;
        const pathData: any = {
            path: d
        };
        if (fill) {
            pathData.fill = fill;
            pathData['fill-opacity'] = getAttr(attributes, 'fill-opacity') || rootFillOpacity || 1;
        }
        if (stroke) {
            pathData.stroke = stroke;
            pathData['stroke-opacity'] = getAttr(attributes, 'stroke-opacity') || rootStrokeOpacity || 1;
            pathData['stroke-width'] = getAttr(attributes, 'stroke-width') || rootStrokeWidth || 1;
        }
        data.push(pathData);
        if (!isPath) {
            for (const p in pathData) {
                if (p === 'path') {
                    continue;
                }
                if (pathData.hasOwnProperty(p)) {
                    (dom as any).setAttribute(p, pathData[p]);
                }
            }
        }
    }
    return data;
}