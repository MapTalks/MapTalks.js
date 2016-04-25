Z.Map.mergeOptions({
    'draggable': true
});

Z.Map.Drag = Z.Handler.extend({
    addHooks: function () {
        var map = this.target;
        if (!map) {return;}
        this.dom = map._panels.mapWrapper || map._containerDOM;
        this._dragHandler = new Z.Handler.Drag(this.dom);
        map.on(this._dragHandler.START.join(' '), this._onMouseDown,this);

        this._dragHandler.on("dragstart", this._onDragStart, this);
        this._dragHandler.on("dragging", this._onDragging, this);
        this._dragHandler.on("dragend", this._onDragEnd, this);

        this._dragHandler.enable();
    },

    removeHooks: function () {
        var map = this.target;
        map.off(this._dragHandler.START.join(' '), this._onMouseDown,this);
        this._dragHandler.disable();
        delete this._dragHandler;
    },

    _ignore: function(param) {
        if (!param || !param.domEvent) {
            return false;
        }
        return this.target._ignoreEvent(param.domEvent);
    },


    _onMouseDown:function(param) {
        if (this._ignore(param)) {
            return;
        }
        if (this.target._panAnimating) {
            this.target._enablePanAnimation=false;
        }
    },

    _onDragStart:function(param) {
        if (this._ignore(param)) {
            return;
        }
        var map = this.target;
        this.startDragTime = new Date().getTime();
        var domOffset = map.offsetPlatform();
        this.startLeft = domOffset.x;
        this.startTop = domOffset.y;
        this.preX = param['mousePos'].x;
        this.preY = param['mousePos'].y;
        this.startX = this.preX;
        this.startY = this.preY;
        map._onMoveStart();
    },

    _onDragging:function(param) {
        if (this._ignore(param)) {
            return;
        }
        Z.DomUtil.preventDefault(param['domEvent']);
        if (this.startLeft === undefined) {
            return;
        }
        var map = this.target;
        var mx = param['mousePos'].x,
            my = param['mousePos'].y;
        var nextLeft = (this.startLeft + mx - this.startX);
        var nextTop = (this.startTop + my - this.startY);
        var mapPos = map.offsetPlatform();
        var offset = new Z.Point(nextLeft,nextTop)._substract(mapPos);
        map.offsetPlatform(offset);
        map._offsetCenterByPixel(offset);
        map._onMoving();
    },

    _onDragEnd:function(param) {
        if (this._ignore(param)) {
            return;
        }
        Z.DomUtil.preventDefault(param['domEvent']);
        if (this.startLeft === undefined) {
            return;
        }
        var map = this.target;
        var t = new Date().getTime()-this.startDragTime;
        var domOffset = map.offsetPlatform();
        var xSpan =  domOffset.x - this.startLeft;
        var ySpan =  domOffset.y - this.startTop;

        delete this.startLeft;
        delete this.startTop;
        delete this.preX;
        delete this.preY;
        delete this.startX;
        delete this.startY;

        if (t<280 && Math.abs(ySpan)+Math.abs(xSpan) > 5) {
            map._enablePanAnimation=true;
            var distance = new Z.Point(xSpan*Math.ceil(500/t),ySpan*Math.ceil(500/t)).multi(0.5);
            t = 5*t*(Math.abs(distance.x)+Math.abs(distance.y))/600;
            map._panAnimation(distance._multi(2/3),t);
        } else {
            map._onMoveEnd();
        }

    }
});

Z.Map.addInitHook('addHandler', 'draggable', Z.Map.Drag);
