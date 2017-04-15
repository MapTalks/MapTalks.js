import { extend } from 'core/util';
import Size from 'geo/Size';
import TextMarker from './TextMarker';

/**
 * @property {Object} [options=null]                   - textbox's options, also including options of [Marker]{@link Marker#options}
 * @property {Boolean} [options.boxAutoSize=false]     - whether to set the size of the box automatically to fit for the textbox's text.
 * @property {Boolean} [options.boxMinWidth=0]         - the minimum width of the box.
 * @property {Boolean} [options.boxMinHeight=0]        - the minimum height of the box.
 * @property {Boolean} [options.boxPadding={'width' : 12, 'height' : 8}] - padding of the text to the border of the box.
 * @memberOf TextBox
 * @instance
 */
const options = {
    'boxAutoSize': false,
    'boxMinWidth': 0,
    'boxMinHeight': 0,
    'boxPadding': {
        'width': 12,
        'height': 8
    }
};

/**
 * @classdesc
 * Represents point type geometry for text boxes.<br>
 * A TextBox is used to draw a box with text inside on a particular coordinate.
 * @category geometry
 * @extends TextMarker
 * @mixes TextEditable
 * @param {String} content                          - TextBox's text content
 * @param {Coordinate} coordinates         - center
 * @param {Object} [options=null]                   - construct options defined in [TextBox]{@link TextBox#options}
 * @example
 * var textBox = new TextBox('This is a textBox',[100,0])
 *     .addTo(layer);
 */
class TextBox extends TextMarker {

    static fromJSON(json) {
        const feature = json['feature'];
        const textBox = new TextBox(json['content'], feature['geometry']['coordinates'], json['options']);
        textBox.setProperties(feature['properties']);
        textBox.setId(feature['id']);
        return textBox;
    }

    _toJSON(options) {
        return {
            'feature': this.toGeoJSON(options),
            'subType': 'TextBox',
            'content': this._content
        };
    }

    _refresh() {
        const symbol = this.getSymbol() || this._getDefaultTextSymbol();
        symbol['textName'] = this._content;

        const sizes = this._getBoxSize(symbol),
            textSize = sizes[1];
        let boxSize = sizes[0];

        //if no boxSize then use text's size in default
        if (!boxSize && !symbol['markerWidth'] && !symbol['markerHeight']) {
            const padding = this.options['boxPadding'];
            const width = textSize['width'] + padding['width'] * 2,
                height = textSize['height'] + padding['height'] * 2;
            boxSize = new Size(width, height);
            symbol['markerWidth'] = boxSize['width'];
            symbol['markerHeight'] = boxSize['height'];
        } else if (boxSize) {
            symbol['markerWidth'] = boxSize['width'];
            symbol['markerHeight'] = boxSize['height'];
        }

        const textAlign = symbol['textHorizontalAlignment'];
        if (textAlign) {
            symbol['textDx'] = symbol['markerDx'] || 0;
            if (textAlign === 'left') {
                symbol['textDx'] -= symbol['markerWidth'] / 2;
            } else if (textAlign === 'right') {
                symbol['textDx'] += symbol['markerWidth'] / 2;
            }
        }

        const vAlign = symbol['textVerticalAlignment'];
        if (vAlign) {
            symbol['textDy'] = symbol['markerDy'] || 0;
            if (vAlign === 'top') {
                symbol['textDy'] -= symbol['markerHeight'] / 2;
            } else if (vAlign === 'bottom') {
                symbol['textDy'] += symbol['markerHeight'] / 2;
            }
        }

        this._symbol = symbol;
        this.onSymbolChanged();
    }

    _getInternalSymbol() {
        //In TextBox, textHorizontalAlignment's meaning is textAlign in the box which is reversed from original textHorizontalAlignment.
        const textSymbol = extend({}, this._symbol);
        if (textSymbol['textHorizontalAlignment'] === 'left') {
            textSymbol['textHorizontalAlignment'] = 'right';
        } else if (textSymbol['textHorizontalAlignment'] === 'right') {
            textSymbol['textHorizontalAlignment'] = 'left';
        }
        if (textSymbol['textVerticalAlignment'] === 'top') {
            textSymbol['textVerticalAlignment'] = 'bottom';
        } else if (textSymbol['textVerticalAlignment'] === 'bottom') {
            textSymbol['textVerticalAlignment'] = 'top';
        }
        return textSymbol;
    }
}

TextBox.mergeOptions(options);

TextBox.registerJSONType('TextBox');

export default TextBox;
