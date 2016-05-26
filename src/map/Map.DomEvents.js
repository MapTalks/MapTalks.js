Z.Map.include(/** @lends maptalks.Map.prototype */{
    _registerDomEvents: function (remove) {
        var events = /**
                      * mousedown event
                      * @event maptalks.Map#mousedown
                      * @type {Object}
                      * @property {String} type                    - mousedown
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'mousedown ' +
                     /**
                      * mouseup event
                      * @event maptalks.Map#mouseup
                      * @type {Object}
                      * @property {String} type                    - mouseup
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'mouseup ' +
                     /**
                      * mouseover event
                      * @event maptalks.Map#mouseover
                      * @type {Object}
                      * @property {String} type                    - mouseover
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'mouseover ' +
                     /**
                      * mouseout event
                      * @event maptalks.Map#mouseout
                      * @type {Object}
                      * @property {String} type                    - mouseout
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'mouseout ' +
                     /**
                      * mousemove event
                      * @event maptalks.Map#mousemove
                      * @type {Object}
                      * @property {String} type                    - mousemove
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'mousemove ' +
                     /**
                      * click event
                      * @event maptalks.Map#click
                      * @type {Object}
                      * @property {String} type                    - click
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'click ' +
                     /**
                      * dblclick event
                      * @event maptalks.Map#dblclick
                      * @type {Object}
                      * @property {String} type                    - dblclick
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'dblclick ' +
                     /**
                      * contextmenu event
                      * @event maptalks.Map#contextmenu
                      * @type {Object}
                      * @property {String} type                    - contextmenu
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'contextmenu ' +
                     /**
                      * keypress event
                      * @event maptalks.Map#keypress
                      * @type {Object}
                      * @property {String} type                    - keypress
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'keypress ' +
                     /**
                      * touchstart event
                      * @event maptalks.Map#touchstart
                      * @type {Object}
                      * @property {String} type                    - touchstart
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'touchstart ' +
                     /**
                      * touchmove event
                      * @event maptalks.Map#touchmove
                      * @type {Object}
                      * @property {String} type                    - touchmove
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'touchmove ' +
                     /**
                      * touchend event
                      * @event maptalks.Map#touchend
                      * @type {Object}
                      * @property {String} type                    - touchend
                      * @property {String} target                  - the map fires event
                      * @property {maptalks.Coordinate} coordinate - coordinate of the event
                      * @property {maptalks.Point} containerPoint  - container point of the event
                      * @property {maptalks.Point} viewPoint       - view point of the event
                      * @property {Event} domEvent                 - dom event
                      */
                     'touchend ';
        //phantomjs will crash when registering events on canvasContainer
        var dom = this._panels.mapWrapper || this._containerDOM;
        if (remove) {
            Z.DomUtil.removeDomEvent(dom, events, this._handleDOMEvent, this);
        } else {
            Z.DomUtil.addDomEvent(dom, events, this._handleDOMEvent, this);
        }

    },

    _handleDOMEvent: function (e) {
        if (this._ignoreEvent(e)) {
            return;
        }
        var type = e.type;
        this._fireDOMEvent(this, e, type);
    },

    _ignoreEvent: function (domEvent) {
        //ignore events originated from control doms.
        if (!domEvent || !this._panels.control) {
            return false;
        }
        var target = domEvent.srcElement || domEvent.target;
        if (target) {
            while (target && target !== this._containerDOM) {
                if (target.className === 'maptalks-control') {
                    return true;
                }
                target = target.parentNode;
            }

        }
        return false;
    },

    _parseEvent:function (e, type) {
        var eventParam = {
            'domEvent': e
        };
        if (type !== 'keypress') {
            var actual = e.touches ? e.touches[0] : e;
            if (actual) {
                var containerPoint = Z.DomUtil.getEventContainerPoint(actual, this._containerDOM);
                eventParam['coordinate'] = this.containerPointToCoordinate(containerPoint);
                eventParam['containerPoint'] = containerPoint;
                eventParam['viewPoint'] = this.containerPointToViewPoint(containerPoint);
            }
        }
        return eventParam;
    },

    _fireDOMEvent: function (target, e, type) {
        var eventParam = this._parseEvent(e, type);

        //阻止右键菜单
        if (type === 'contextmenu') {
            Z.DomUtil.preventDefault(e);
        }
        if (type === 'mousedown' || type === 'click') {
            var button = e.button;
            if (button === 2) {
                type = 'contextmenu';
            }
        }
        this._fireEvent(type, eventParam);
    }
});
