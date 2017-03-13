/**
 * DOM utilities used internally.
 * Learned a lot from Leaflet.DomUtil
 * @class
 * @category core
 * @name DomUtil
 */

import Browser from 'core/Browser';
import { isNode } from './env';
import { isString, isNil } from './common';
import { splitWords, trim } from './strings';
import Point from 'geo/Point';
import Size from 'geo/Size';

const first = (props) => {
    return props[0];
};

/**
 * From Leaflet.DomUtil
 * Goes through the array of style names and returns the first name
 * that is a valid style name for an element. If no such name is found,
 * it returns false. Useful for vendor-prefixed styles like `transform`.
 * @param  {String[]} props
 * @return {Boolean}
 * @memberOf DomUtil
 * @private
 */
const testProp = isNode ? first : (props) => {

    var style = document.documentElement.style;

    for (var i = 0; i < props.length; i++) {
        if (props[i] in style) {
            return props[i];
        }
    }
    return false;
};

// prefix style property names

/**
 * Vendor-prefixed fransform style name (e.g. `'webkitTransform'` for WebKit).
 * @property {String} TRANSFORM
 * @memberOf DomUtil
 * @type {String}
 */
export const TRANSFORM = testProp(
    ['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

/**
 * Vendor-prefixed tfransform-origin name (e.g. `'webkitTransformOrigin'` for WebKit).
 * @property {String} TRANSFORMORIGIN
 * @memberOf DomUtil
 * @type {String}
 */
export const TRANSFORMORIGIN = testProp(
    ['transformOrigin', 'WebkitTransformOrigin', 'OTransformOrigin', 'MozTransformOrigin', 'msTransformOrigin']);

/**
 * Vendor-prefixed transition name (e.g. `'WebkitTransition'` for WebKit).
 * @property {String} TRANSITION
 * @memberOf DomUtil
 * @type {String}
 */
export const TRANSITION = testProp(
    ['transition', 'WebkitTransition', 'OTransition', 'MozTransition', 'msTransition']);

/**
 * Vendor-prefixed filter name (e.g. `'WebkitFilter'` for WebKit).
 * @property {String} FILTER
 * @memberOf DomUtil
 * @type {String}
 */
export const CSSFILTER = testProp(
    ['filter', 'WebkitFilter', 'OFilter', 'MozFilter', 'msFilter']);

/**
 * Create a html element.
 * @param {String} tagName
 * @returns {HTMLElement}
 * @memberOf DomUtil
 */
export function createEl(tagName, className) {
    var el = document.createElement(tagName);
    if (className) {
        setClass(el, className);
    }
    return el;
}

/**
 * Create a html element on the specified container
 * @param {String} tagName
 * @param {String} style - css styles
 * @param {HTMLElement} container
 * @return {HTMLElement}
 * @memberOf DomUtil
 */
export function createElOn(tagName, style, container) {
    var el = createEl(tagName);
    if (style) {
        setStyle(el, style);
    }
    if (container) {
        container.appendChild(el);
    }
    return el;
}

/**
 * Removes a html element.
 * @param {HTMLElement} node
 * @memberOf DomUtil
 */
export function removeDomNode(node) {
    if (!node) {
        return this;
    }
    if (Browser.ielt9 || Browser.ie9) {
        //fix memory leak in IE9-
        //http://com.hemiola.com/2009/11/23/memory-leaks-in-ie8/
        var d = createEl('div');
        d.appendChild(node);
        d.innerHTML = '';
        d = null;
    } else if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
    return this;
}

/**
 * Adds a event listener to the dom element.
 * @param {HTMLElement} obj     - dom element to listen on
 * @param {String} typeArr      - event types, seperated by space
 * @param {Function} handler    - listener function
 * @param {Object} context      - function context
 * @memberOf DomUtil
 */
export function addDomEvent(obj, typeArr, handler, context) {
    if (!obj || !typeArr || !handler) {
        return this;
    }
    var eventHandler = function (e) {
        if (!e) {
            e = window.event;
        }
        handler.call(context || obj, e);
        return;
    };
    var types = typeArr.split(' ');
    for (var i = types.length - 1; i >= 0; i--) {
        var type = types[i];
        if (!type) {
            continue;
        }

        if (!obj['Z__' + type]) {
            obj['Z__' + type] = [];

        }
        var hit = listensDomEvent(obj, type, handler);
        if (hit >= 0) {
            removeDomEvent(obj, type, handler);
        }
        obj['Z__' + type].push({
            callback: eventHandler,
            src: handler
        });
        if ('addEventListener' in obj) {
            //滚轮事件的特殊处理
            if (type === 'mousewheel' && Browser.gecko) {
                type = 'DOMMouseScroll';
            }
            obj.addEventListener(type, eventHandler, false);
        } else if ('attachEvent' in obj) {
            obj.attachEvent('on' + type, eventHandler);
        }
    }
    return this;
}

/**
 * Removes event listener from a dom element
 * @param {HTMLElement} obj         - dom element
 * @param {String} typeArr          - event types, separated by space
 * @param {Function} handler        - listening function
 * @memberOf DomUtil
 */
export function removeDomEvent(obj, typeArr, handler) {
    function doRemove(type, callback) {
        if ('removeEventListener' in obj) {
            //mouse wheel in firefox
            if (type === 'mousewheel' && Browser.gecko) {
                type = 'DOMMouseScroll';
            }
            obj.removeEventListener(type, callback, false);
        } else if ('detachEvent' in obj) {
            obj.detachEvent('on' + type, callback);
        }
    }
    if (!obj || !typeArr) {
        return this;
    }
    var types = typeArr.split(' ');
    for (var i = types.length - 1; i >= 0; i--) {
        var type = types[i];
        if (!type) {
            continue;
        }
        //remove all the listeners if handler is not given.
        if (!handler && obj['Z__' + type]) {
            var handlers = obj['Z__' + type];
            for (var j = 0, jlen = handlers.length; j < jlen; j++) {
                doRemove(handlers[j].callback);
            }
            delete obj['Z__' + type];
            return this;
        }
        var hit = listensDomEvent(obj, type, handler);
        if (hit < 0) {
            return this;
        }
        var hitHandler = obj['Z__' + type][hit];
        doRemove(type, hitHandler.callback);
        obj['Z__' + type].splice(hit, 1);
    }
    return this;
}

/**
 * Check if event type of the dom is listened by the handler
 * @param {HTMLElement} obj     - dom element to check
 * @param {String} typeArr      - event
 * @param {Function} handler    - the listening function
 * @return {Number} - the handler's index in the listener chain, returns -1 if not.
 * @memberOf DomUtil
 */
export function listensDomEvent(obj, type, handler) {
    if (!obj || !obj['Z__' + type] || !handler) {
        return -1;
    }
    var handlers = obj['Z__' + type];
    for (var i = 0, len = handlers.length; i < len; i++) {
        if (handlers[i].src === handler) {
            return i;
        }
    }
    return -1;
}

/**
 * Prevent default behavior of the browser. <br/>
 * preventDefault Cancels the event if it is cancelable, without stopping further propagation of the event.
 * @param {Event} event - browser event
 * @memberOf DomUtil
 */
export function preventDefault(event) {
    if (event.preventDefault) {
        event.preventDefault();
    } else {
        event.returnValue = false;
    }
    return this;
}

/**
 * Stop browser event propagation
 * @param  {Event} e - browser event.
 * @memberOf DomUtil
 */
export function stopPropagation(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    } else {
        e.cancelBubble = true;
    }
    return this;
}

export function preventSelection(dom) {
    dom.onselectstart = function () {
        return false;
    };
    dom.ondragstart = function () {
        return false;
    };
    dom.setAttribute('unselectable', 'on');
    return this;
}

/**
 * Get the dom element's current position or offset its position by offset
 * @param  {HTMLElement} dom - HTMLElement
 * @param  {Point} [offset=null] - position to set.
 * @return {Point} - dom element's current position if offset is null.
 * @memberOf DomUtil
 */
export function offsetDom(dom, offset) {
    if (!dom) {
        return null;
    }

    if (Browser.any3d) {
        setTransform(dom, offset);
    } else {
        dom.style.left = offset.x + 'px';
        dom.style.top = offset.y + 'px';
    }
    return offset;
}

/**
 * 获取dom对象在页面上的屏幕坐标
 * @param  {HTMLElement} obj Dom对象
 * @return {Object}     屏幕坐标
 * @memberOf DomUtil
 */
export function getPagePosition(obj) {
    var docEl = document.documentElement;
    var rect = obj.getBoundingClientRect();
    return new Point(rect['left'] + docEl['scrollLeft'], rect['top'] + docEl['scrollTop']);
}

/**
 * 获取鼠标在容器上相对容器左上角的坐标值
 * @param {Event} ev  触发的事件
 * @return {Point} left:鼠标在页面上的横向位置, top:鼠标在页面上的纵向位置
 * @memberOf DomUtil
 */
export function getEventContainerPoint(ev, dom) {
    if (!ev) {
        ev = window.event;
    }
    var rect = dom.getBoundingClientRect();

    return new Point(
        ev.clientX - rect.left - dom.clientLeft,
        ev.clientY - rect.top - dom.clientTop);
}

/**
 * 为dom设置样式
 * @param {HTMLElement} dom dom节点
 * @param {String} strCss 样式字符串
 * @memberOf DomUtil
 */
export function setStyle(dom, strCss) {
    function endsWith(str, suffix) {
        var l = str.length - suffix.length;
        return l >= 0 && str.indexOf(suffix, l) === l;
    }
    var style = dom.style,
        cssText = style.cssText;
    if (!endsWith(cssText, ';')) {
        cssText += ';';
    }
    dom.style.cssText = cssText + strCss;
    return this;
}

/**
 * 清空dom样式
 * @param {HTMLElement} dom dom节点
 * @memberOf DomUtil
 */
export function removeStyle(dom) {
    dom.style.cssText = '';
    return this;
}

/**
 * 为dom添加样式
 * @param {HTMLElement} dom dom节点
 * @param {String} attr 样式标签
 * @param {String} value 样式值
 * @memberOf DomUtil
 */
export function addStyle(dom, attr, value) {
    var css = dom.style.cssText;
    if (attr && value) {
        var newStyle = attr + ':' + value + ';';
        dom.style.cssText = css + newStyle;
    }
    return this;
}

/**
 * 判断元素是否包含class
 * @param {HTMLElement} el html元素
 * @param {String} name class名称
 * @memberOf DomUtil
 */
export function hasClass(el, name) {
    if (el.classList !== undefined) {
        return el.classList.contains(name);
    }
    var className = getClass(el);
    return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
}

/**
 * 为dom添加class
 * @param {HTMLElement} el html元素
 * @param {String} name class名称
 * @memberOf DomUtil
 */
export function addClass(el, name) {
    if (el.classList !== undefined) {
        var classes = splitWords(name);
        for (var i = 0, len = classes.length; i < len; i++) {
            el.classList.add(classes[i]);
        }
    } else if (!hasClass(el, name)) {
        var className = getClass(el);
        setClass(el, (className ? className + ' ' : '') + name);
    }
    return this;
}

/**
 * 移除dom class
 * @param {HTMLElement} el html元素
 * @param {String} name class名称
 * @memberOf DomUtil
 */
export function removeClass(el, name) {
    if (el.classList !== undefined) {
        el.classList.remove(name);
    } else {
        setClass(el, trim((' ' + getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
    }
    return this;
}

/**
 * 设置dom class
 * @param {HTMLElement} el html元素
 * @param {String} name class名称
 * @memberOf DomUtil
 */
export function setClass(el, name) {
    if (isNil(el.className.baseVal)) {
        el.className = name;
    } else {
        el.className.baseVal = name;
    }
    return this;
}

/**
 * 获取dom class
 * @param {String} name class名称
 * @retrun {String} class字符串
 * @memberOf DomUtil
 */
export function getClass(el) {
    return isNil(el.className.baseVal) ? el.className : el.className.baseVal;
}

// Borrowed from Leaflet
// @function setOpacity(el: HTMLElement, opacity: Number)
// Set the opacity of an element (including old IE support).
// `opacity` must be a number from `0` to `1`.
export function setOpacity(el, value) {
    if ('opacity' in el.style) {
        el.style.opacity = value;

    } else if ('filter' in el.style) {
        _setOpacityIE(el, value);
    }
    return this;
}

function _setOpacityIE(el, value) {
    var filter = false,
        filterName = 'DXImageTransform.Microsoft.Alpha';

    // filters collection throws an error if we try to retrieve a filter that doesn't exist
    try {
        filter = el.filters.item(filterName);
    } catch (e) {
        // don't set opacity to 1 if we haven't already set an opacity,
        // it isn't needed and breaks transparent pngs.
        if (value === 1) {
            return;
        }
    }

    value = Math.round(value * 100);

    if (filter) {
        filter.Enabled = (value !== 100);
        filter.Opacity = value;
    } else {
        el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
    }
}

/**
 * Copy the source canvas
 * @param  {Element|Canvas} src - source canvas
 * @return {Element|Canvas}     target canvas
 * @memberOf DomUtil
 */
export function copyCanvas(src) {
    if (isNode) {
        return null;
    }
    var target = createEl('canvas');
    target.width = src.width;
    target.height = src.height;
    target.getContext('2d').drawImage(src, 0, 0);
    return target;
}

/**
 * Resets the 3D CSS transform of `el` so it is translated by `offset` pixels
 * @param {HTMLElement} el
 * @param {Point} offset
 * @memberOf DomUtil
 */
export function setTransform(el, offset) {
    var pos = offset || new Point(0, 0);
    el.style[TRANSFORM] =
        (Browser.ie3d ?
            'translate(' + pos.x + 'px,' + pos.y + 'px)' :
            'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)');

    return this;
}

export function setTransformMatrix(el, m) {
    el.style[TRANSFORM] = 'matrix(' + (isString(m) ? m : m.join()) + ')';
    return this;
}

export function removeTransform(el) {
    el.style[TRANSFORM] = '';
    return this;
}

export function isHTML(str) {
    return /<[a-z\][\s\S]*>/i.test(str);
}

export function measureDom(parentTag, dom) {
    var ruler = _getDomRuler(parentTag);
    if (isString(dom)) {
        ruler.innerHTML = dom;
    } else {
        ruler.appendChild(dom);
    }
    var result = new Size(ruler.clientWidth, ruler.clientHeight);
    removeDomNode(ruler);
    return result;
}

export function _getDomRuler(tag) {
    var span = document.createElement(tag);
    span.style.cssText = 'position:absolute;left:-10000px;top:-10000px;';
    document.body.appendChild(span);
    return span;
}

/**
 * Alias for [addDomEvent]{@link DomUtil.addDomEvent}
 * @param {HTMLElement} obj     - dom element to listen on
 * @param {String} typeArr      - event types, seperated by space
 * @param {Function} handler    - listener function
 * @param {Object} context      - function context
 * @static
 * @function
 * @return {DomUtil}
 * @memberOf DomUtil
 */
export const on = addDomEvent;

/**
 * Alias for [removeDomEvent]{@link DomUtil.removeDomEvent}
 * @param {HTMLElement} obj         - dom element
 * @param {String} typeArr          - event types, separated by space
 * @param {Function} handler        - listening function
 * @static
 * @function
 * @return {DomUtil}
 * @memberOf DomUtil
 */
export const off = removeDomEvent;
