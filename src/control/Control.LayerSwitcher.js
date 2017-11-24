import { on, off, createEl } from 'core/util/dom';
import Map from 'map/Map';
import Control from './Control';

/**
 * @property {Object} options - options
 * @property {Object} [options.position='top-right'] - position of the control
 * @property {Object} [options.baseTitle='Base Layers'] - title of the base layers
 * @property {Object} [options.overlayTitle='Overlay Layers'] - title of the overlay layers
 * @property {Object} [options.excludeLayers=[] - ids of layers that don't display in layerswitcher
 * @property {Object} [options.containerClass=maptalks-layer-switcher] - layerswitcher's container div's CSS class
 *
 * @memberOf control.LayerSwitcher
 * @instance
 */
const options = {
    'position' : 'top-right',
    'baseTitle' : 'Base Layers',
    'overlayTitle' : 'Overlay Layers',
    'excludeLayers' : [],
    'containerClass' : 'maptalks-layer-switcher'
};

/**
 * @classdesc
 * A layerswither control for the map.
 * @category control
 * @extends control.Control
 * @memberOf control
 * @example
 * var layerswither = new Layerswither({
 *     position : {'top': '0', 'right': '0'}
 * }).addTo(map);
*/
class LayerSwitcher extends Control {
    /**
     * method to build DOM of the control
     * @return {HTMLDOMElement}
     */
    buildOn() {
        const container = this.container = createEl('div', this.options['containerClass']),
            panel = this.panel = createEl('div', 'panel'),
            button = this.button = createEl('button');
        container.appendChild(button);
        container.appendChild(panel);
        return container;
    }

    onAdd() {
        on(this.button, 'mouseover', this._show, this);
        on(this.panel, 'mouseout', this._hide, this);
    }

    onRemove() {
        if (this.panel) {
            this.panel.remove();
            delete this.panel;
        }
        off(this.button, 'mouseover', this._show, this);
        off(this.panel, 'mouseout', this._hide, this);
    }

    _show() {
        const list = this.container.classList;
        if (!list.contains('shown')) {
            list.add('shown');
            this._createPanel();
        }
    }

    _hide(e) {
        e = e || window.event;
        const list = this.container.classList;
        if (!this.panel.contains(e.toElement || e.relatedTarget) && list.contains('shown')) {
            list.remove('shown');
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
                ul =  createEl('ul'),
                label = createEl('label');
            label.innerHTML = this.options['baseTitle'];
            li.appendChild(label);
            for (let i = 0, len = baseLayers.length; i < len; i++) {
                const layer = baseLayers[i];
                if (this._isDisplay(layer)) {
                    ul.appendChild(this._renderLayer(baseLayers[i], true));
                    li.appendChild(ul);
                    elm.appendChild(li);
                }
            }
        }

        if (len) {
            const li = createEl('li', 'group'),
                ul = createEl('ul'),
                label = createEl('label');
            label.innerHTML = this.options['overlayTitle'];
            li.appendChild(label);
            for (let i = 0; i < len; i++) {
                const layer = layers[i];
                if (this._isDisplay(layer)) {
                    ul.appendChild(this._renderLayer(layer));
                }
            }
            li.appendChild(ul);
            elm.appendChild(li);
        }
    }

    _isDisplay(layer) {
        const id = layer.getId(),
            excludeLayers = this.options['excludeLayers'];
        return !(excludeLayers.length && excludeLayers.includes(id));
    }

    _renderLayer(layer, isBase) {
        const li = createEl('li', 'layer'),
            label =  createEl('label'),
            input = createEl('input'),
            map = this.getMap(),
            visible = layer.isVisible();
        li.className = 'layer';
        if (isBase) {
            input.type = 'radio';
            input.name = 'base';
        } else {
            input.type = 'checkbox';
        }

        input.checked = visible;
        if (!visible) {
            input.setAttribute('disabled', 'disabled');
        }

        input.onchange = function (e) {
            if (e.target.type === 'radio') {
                const baseLayers = map.getBaseLayer().layers;
                for (let i = 0, len = baseLayers.length; i < len; i++) {
                    const baseLayer = baseLayers[i];
                    baseLayer[baseLayer === layer ? 'show' : 'hide']();
                }
            } else {
                layer[e.target.checked ? 'show' : 'hide']();
            }
        };
        li.appendChild(input);
        label.innerHTML = layer.getId();
        li.appendChild(label);
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
