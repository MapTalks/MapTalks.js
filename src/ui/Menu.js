(function () {
    var defaultOptions = {
        'eventsToStop' : 'mousedown dblclick click',
        'autoPan': false,
        'width'  : 160,
        'custom' : false,
        'items'  : []
    };

    /**
     * Menu items is set to options.items or by setItems method. <br>
     * <br>
     * Normally items is a object array, containing: <br>
     * 1. item object: {'item': 'This is a menu text', 'click': function() {alert('oops! You clicked!');)}} <br>
     * 2. minus string "-", which will draw a splitor line on the menu. <br>
     * <br>
     * If options.custom is set to true, the menu is considered as a customized one. Then items is the customized html codes or HTMLElement. <br>
     *
     * @classdesc
     * Class for context menu, useful for interactions with right clicks on the map.
     * @class
     * @category ui
     * @extends maptalks.ui.UIComponent
     * @param {Object} options - construct options
     * @param {Object} options
     * @param {Boolean} [options.autoPan=false]  - set it to false if you don't want the map to do panning animation to fit the opened menu.
     * @param {Number}  [options.width=160]      - default width
     * @param {String|HTMLElement} [options.custom=false]  - set it to true if you want a customized menu, customized html codes or a HTMLElement is set to items.
     * @param {Object[]|String|HTMLElement}  options.items   - html code or a html element is options.custom is true. Or a menu items array, containing: item objects, "-" as a splitor line
     * @memberOf maptalks.ui
     * @name Menu
     */
    Z.ui.Menu = Z.ui.UIComponent.extend(/** @lends maptalks.ui.Menu.prototype */{

        /**
         * @property {Object} options
         * @property {Boolean} [options.autoPan=false]  - set it to false if you don't want the map to do panning animation to fit the opened menu.
         * @property {Number}  [options.width=160]      - default width
         * @property {String|HTMLElement} [options.custom=false]  - set it to true if you want a customized menu, customized html codes or a HTMLElement is set to items.
         * @property {Object[]|String|HTMLElement}  options.items   - html code or a html element is options.custom is true. Or a menu items array, containing: item objects, "-" as a splitor line
         */
        options: defaultOptions,

        addTo:function (owner) {
            if (owner._menu && owner._menu !== this) {
                owner.removeMenu();
            }
            owner._menu = this;
            return Z.ui.UIComponent.prototype.addTo.apply(this, arguments);
        },

        /**
         * Set the items of the menu.
         * @param {Object[]|String|HTMLElement} items - items of the menu
         * return {maptalks.ui.Menu} this
         * @example
         * menu.setItems([
         *      //return false to prevent event propagation
         *     {'item': 'Query', 'click': function() {alert('Query Clicked!'); return false;}},
         *     '-',
         *     {'item': 'Edit', 'click': function() {alert('Edit Clicked!')}},
         *     {'item': 'About', 'click': function() {alert('About Clicked!')}}
         * ]);
         */
        setItems: function (items) {
            this.options['items'] = items;
            return this;
        },

        /**
         * Get items of  the menu.
         * @return {Object[]|String|HTMLElement} - items of the menu
         */
        getItems:function () {
            return this.options['items'];
        },

        /**
         * Create the menu DOM.
         * @protected
         * @return {HTMLElement} menu's DOM
         */
        buildOn:function () {
            if (this.options['custom']) {
                if (Z.Util.isString(this.options['items'])) {
                    var container = Z.DomUtil.createEl('div');
                    container.innerHTML = this.options['items'];
                    return container;
                } else {
                    return this.options['items'];
                }
            } else {
                var dom = Z.DomUtil.createEl('div');
                Z.DomUtil.addClass(dom, 'maptalks-menu');
                dom.style.width = this._getMenuWidth() + 'px';
                /*var arrow = Z.DomUtil.createEl('em');
                Z.DomUtil.addClass(arrow, 'maptalks-ico');*/
                var menuItems = this._createMenuItemDom();
                // dom.appendChild(arrow);
                dom.appendChild(menuItems);
                return dom;
            }
        },

        /**
         * Offset of the menu DOM to fit the click position.
         * @return {maptalks.Point} offset
         * @private
         */
        getOffset:function () {
            var mapSize = this.getMap().getSize(),
                p = this.getMap().viewPointToContainerPoint(this._getViewPoint()),
                size = this.getSize();
            var dx = 0, dy = 0;
            if (p.x + size['width'] > mapSize['width']) {
                dx = -size['width'];
            }
            if (p.y + size['height'] > mapSize['height']) {
                dy = -size['height'];
            }
            return new Z.Point(dx, dy);
        },

        getEvents: function () {
            return {
                '_zoomstart _zoomend _movestart _dblclick _click' : this.hide
            };
        },

        _createMenuItemDom: function () {
            var me = this;
            var ul = Z.DomUtil.createEl('ul');
            Z.DomUtil.addClass(ul, 'maptalks-menu-items');
            var items = this.getItems();
            function onMenuClick(index) {
                return function () {
                    var result = this._callback({'target':me, 'owner':me._owner, 'index':index});
                    if (result === false) {
                        return;
                    }
                    me.hide();
                };
            }
            var item, itemDOM;
            for (var i = 0, len = items.length; i < len; i++) {
                item = items[i];
                if (item === '-' || item === '_') {
                    itemDOM = Z.DomUtil.createEl('li');
                    Z.DomUtil.addClass(itemDOM, 'maptalks-menu-splitter');
                } else {
                    itemDOM = Z.DomUtil.createEl('li');
                    itemDOM.innerHTML = item['item'];
                    itemDOM._callback = item['click'];
                    Z.DomUtil.on(itemDOM, 'click', (onMenuClick)(i));
                }
                ul.appendChild(itemDOM);
            }
            return ul;
        },

        _getMenuWidth:function () {
            var defaultWidth = 160;
            var width = this.options['width'];
            if (!width) {
                width = defaultWidth;
            }
            return width;
        }
    });

    /**
     * Mixin of the context menu methods.
     * @mixin
     * @memberOf maptalks.ui
     * @name Menu.Mixin
     */
    Z.ui.Menu.Mixin = {
        /**
        * Set a context menu
        * @param {Object} options - menu options
        * @return {*} this
        * @example
        * foo.setMenu({
        *  'width'  : 160,
        *  'custom' : false,
        *  'items' : [
        *      //return false to prevent event propagation
        *     {'item': 'Query', 'click': function() {alert('Query Clicked!'); return false;}},
        *     '-',
        *     {'item': 'Edit', 'click': function() {alert('Edit Clicked!')}},
        *     {'item': 'About', 'click': function() {alert('About Clicked!')}}
        *    ]
        *});
        */
        setMenu: function (options) {
            this._menuOptions = options;

            if (this._menu) {
                Z.Util.setOptions(this._menu, Z.Util.extend(defaultOptions, options));
            } else {
                this.on('contextmenu', this._defaultOpenMenu, this);
            }
            return this;
        },

        /**
        * Open the context menu, default on the center of the geometry or map.
        * @param {maptalks.Coordinate} [coordinate=null] - coordinate to open the context menu
        * @return {*} this
        */
        openMenu: function (coordinate) {
            var map = (this instanceof Z.Map) ? this : this.getMap();
            if (!coordinate) {
                coordinate = this.getCenter();
            }
            if (!this._menu) {
                if (this._menuOptions && map) {
                    this._bindMenu(this._menuOptions);
                    this._menu.show(coordinate);
                }
            } else {
                this._menu.show(coordinate);
            }
            return this;
        },

        /**
        * Set menu items to the context menu
        * @param {Object[]} items - menu items
        * @return {*} this
        */
        setMenuItems: function (items) {
            if (this._menuOptions) {
                if (Z.Util.isArray(items)) {
                    this._menuOptions['custom'] = false;
                }
                this._menuOptions['items'] = items;
            }
            if (this._menu) {
                if (Z.Util.isArray(items)) {
                    this._menu.config('custom', false);
                }
                this._menu.setItems(items);
            }
            return this;
        },

        /**
         * Get the context menu items
         * @return {Object[]}
         */
        getMenuItems:function () {
            if (this._menu) {
                return this._menu.getItems();
            } else {
                return null;
            }
        },

        /**
        * Close the contexnt menu
        * @return {*} this
        */
        closeMenu: function () {
            if (this._menu) {
                this._menu.hide();
            }
            return this;
        },

        /**
         * Remove the context menu
         * @return {*} this
         */
        removeMenu:function () {
            this.off('contextmenu', this._defaultOpenMenu, this);
            this._unbindMenu();
            delete this._menuOptions;
            return this;
        },

        _bindMenu: function (options) {
            this._menu = new Z.ui.Menu(options);
            this._menu.addTo(this);

            return this;
        },

        _unbindMenu:function () {
            if (this._menu) {
                this.closeMenu();
                this._menu.remove();
                delete this._menu;
            }
            return this;
        },

         /**
         * 应用没有注册contextmenu事件时, 默认在contextmenu事件时打开右键菜单
         * 如果注册过contextmenu事件, 则不做任何操作
         * @param  {*} param [description]
         * @return {*}       [description]
         * @private
         */
        _defaultOpenMenu:function (param) {
            if (this.listens('contextmenu') > 1) {
                return;
            } else {
                this.openMenu(param['coordinate']);
            }
        }
    };
})();
