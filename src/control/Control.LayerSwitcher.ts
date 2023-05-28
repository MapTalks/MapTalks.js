import { on, off, createEl, removeDomNode, addClass, hasClass, setClass } from '../core/util/dom';
import Map from '../map/Map';
import Control from './Control';

/**
 * @property {Object} options - options
 * @property {Object} [options.position='top-right'] - position of the control
 * @property {Object} [options.baseTitle='Base Layers'] - title of the base layers
 * @property {Object} [options.overlayTitle='Layers'] - title of the overlay layers
 * @property {Object} [options.excludeLayers=[]] - ids of layers that don't display in layerswitcher
 * @property {Object} [options.containerClass=maptalks-layer-switcher] - layerswitcher's container div's CSS class
 *
 * @memberOf control.LayerSwitcher
 * @instance
 */
const options = {
    'position': 'top-right',
    'baseTitle': 'Base Layers',
    'overlayTitle': 'Layers',
    'excludeLayers': [],
    'containerClass': 'maptalks-layer-switcher'
};

/**
 * @classdesc
 * A LayerSwitcher control for the map.
 * @category control
 * @extends control.Control
 * @memberOf control
 * @example
 * var LayerSwitcher = new LayerSwitcher({
 *     position : {'top': '0', 'right': '0'}
 * }).addTo(map);
*/
class LayerSwitcher extends Control {
    container: HTMLDivElement;
    panel: HTMLDivElement;
    button: HTMLButtonElement;
    /**
     * method to build DOM of the control
     * @return {HTMLDOMElement}
     */
    buildOn() {
        //@ts-ignore
        const container = this.container = createEl('div', this.options['containerClass']),
            //@ts-ignore
            panel = this.panel = createEl('div', 'panel'),
            //@ts-ignore
            button = this.button = createEl('button');
        container.appendChild(button);
        container.appendChild(panel);
        return container;
    }

    onAdd() {
        on(this.button, 'mouseover', this._show, this);
        on(this.panel, 'mouseleave', this._hide, this);
        //@ts-ignore
        on(this.getMap(), 'click', this._hide, this);
    }

    onRemove() {
        if (this.panel) {
            //@ts-ignore
            off(this.button, 'mouseover', this._show, this);
            //@ts-ignore
            off(this.panel, 'mouseleave', this._hide, this);
            //@ts-ignore
            off(this.getMap(), 'click', this._hide, this);
            removeDomNode(this.panel);
            removeDomNode(this.button);
            //@ts-ignore
            delete this.panel;
            //@ts-ignore
            delete this.button;
            //@ts-ignore
            delete this.container;
        }
    }

    _show() {
        if (!hasClass(this.container, 'shown')) {
            addClass(this.container, 'shown');
            this._createPanel();
        }
    }

    _hide(e) {
        if (!this.panel.contains(e.toElement || e.relatedTarget)) {
            setClass(this.container, this.options['containerClass']);
        }
    }

    _createPanel() {
        this.panel.innerHTML = '';
        const ul = createEl('ul');
        this.panel.appendChild(ul);
        this._renderLayers(this.getMap(), ul);
    }

    _renderLayers(map, elm) {
        const base = map.getBaseLayer(),
            layers = map.getLayers(),
            len = layers.length;
        if (base) {
            const baseLayers = base.layers || [base],
                li = createEl('li', 'group'),
                ul = createEl('ul'),
                label = createEl('label');
            label.innerHTML = this.options['baseTitle'];
            li.appendChild(label);
            for (let i = 0, len = baseLayers.length; i < len; i++) {
                const layer = baseLayers[i];
                if (this._isExcluded(layer)) {
                    ul.appendChild(this._renderLayer(baseLayers[i], true));
                    li.appendChild(ul);
                    elm.appendChild(li);
                }
            }
        }

        if (len) {
            const li = createEl('li', 'group'),
                ul = createEl('ul'),
                label = createEl('label'),
                input = createEl('input');
            //checkbox for select/cancel all overlaylayers
            //@ts-ignore
            input.type = 'checkbox';
            //@ts-ignore
            input.checked = true;
            label.innerHTML = this.options['overlayTitle'];
            li.appendChild(input);
            li.appendChild(label);

            const groupInputOnChange = (e) => {
                const checked = e.target.checked;
                const parentNode = e.target.parentNode;
                if (!parentNode) {
                    return;
                }
                const ul = parentNode.getElementsByTagName('ul')[0];
                if (!ul) {
                    return;
                }
                const parentLayerShow = (node) => {
                    const layer = node._layer;
                    if (layer) {
                        layer[checked ? 'show' : 'hide']();
                    }
                };
                const layerShow = (li) => {
                    const layer = li._layer, checkbox = li.childNodes[0];
                    if (checkbox) {
                        checkbox.checked = checked;
                    }
                    if (layer) {
                        layer[checked ? 'show' : 'hide']();
                    }
                };
                parentLayerShow(parentNode);
                ul.childNodes.forEach(li => {
                    layerShow(li);
                    //检查其是否有子节点,such as :groupgllayer
                    const childUl = li.getElementsByTagName('ul')[0];
                    if (!childUl) {
                        return;
                    }
                    parentLayerShow(li);
                    childUl.childNodes.forEach(li => {
                        layerShow(li);
                    });
                });
            };

            for (let i = 0; i < len; i++) {
                const layer = layers[i];
                if (this._isExcluded(layer)) {
                    //such as :groupgllayer
                    if (layer.getLayers) {
                        const groupLi = createEl('li', 'group'), groupUl = createEl('ul'), groupLabel = createEl('label'), groupInput = createEl('input');
                        groupLabel.innerHTML = layer.getId();
                        //@ts-ignore
                        groupInput.type = 'checkbox';
                        //@ts-ignore
                        groupInput.checked = layer.isVisible();
                        groupInput.onchange = groupInputOnChange;
                        groupLi.appendChild(groupInput);
                        groupLi.appendChild(groupLabel);
                        groupLi.appendChild(groupUl);
                        //@ts-ignore
                        groupLi._layer = layer;
                        ul.appendChild(groupLi);
                        const groupLayers = layer.getLayers() || [];
                        groupLayers.forEach(layer => {
                            //@ts-ignore
                            groupUl.appendChild(this._renderLayer(layer, false, groupInput.checked));
                        });
                    } else {
                        //@ts-ignore
                        ul.appendChild(this._renderLayer(layer));
                    }
                    //只要有一个子节点不选中，顶级节点就不选中
                    if (layer && !layer.isVisible()) {
                        //@ts-ignore
                        input.checked = false;
                    }
                }
            }
            li.appendChild(ul);
            elm.appendChild(li);
            input.onchange = groupInputOnChange;
        }
    }

    _isExcluded(layer) {
        const id = layer.getId(),
            excludeLayers = this.options['excludeLayers'];
        return !(excludeLayers.length && excludeLayers.indexOf(id) >= 0);
    }

    _renderLayer(layer, isBase, parentChecked = true) {
        const li = createEl('li', 'layer'),
            label = createEl('label'),
            input = createEl('input'),
            map = this.getMap();
        const visible = layer.options['visible'];
        layer.options['visible'] = true;
        const enabled = layer.isVisible();
        layer.options['visible'] = visible;
        li.className = 'layer';
        if (isBase) {
            //@ts-ignore
            input.type = 'radio';
            //@ts-ignore
            input.name = 'base';
        } else {
            //@ts-ignore
            input.type = 'checkbox';
        }
        //@ts-ignore
        input.checked = visible && enabled;
        //父节点没有选中，那么子节点一定不选中
        if (!parentChecked) {
            //@ts-ignore
            input.checked = false;
        }
        if (!enabled) {
            input.setAttribute('disabled', 'disabled');
        }

        input.onchange = e => {
            //@ts-ignore
            if (e.target.type === 'radio') {
                const baseLayer = map.getBaseLayer(),
                    //@ts-ignore
                    baseLayers = baseLayer.layers;
                if (baseLayers) {
                    for (let i = 0, len = baseLayers.length; i < len; i++) {
                        const _baseLayer = baseLayers[i];
                        _baseLayer[_baseLayer === layer ? 'show' : 'hide']();
                    }
                } else if (!baseLayer.isVisible()) {
                    baseLayer.show();
                }
                map._fireEvent('setbaselayer');
            } else {
                //@ts-ignore
                layer[e.target.checked ? 'show' : 'hide']();
            }
            //@ts-ignore
            this.fire('layerchange', { target: layer });
        };
        li.appendChild(input);
        label.innerHTML = layer.getId();
        li.appendChild(label);
        //@ts-ignore
        li._layer = layer;
        return li;
    }
}

LayerSwitcher.mergeOptions(options);

Map.mergeOptions({
    'layerSwitcherControl': false
});

Map.addOnLoadHook(function () {
    if (this.options['layerSwitcherControl']) {
        this.layerSwitcherControl = new LayerSwitcher(this.options['layerSwitcherControl']);
        this.addControl(this.layerSwitcherControl);
    }
});

export default LayerSwitcher;
