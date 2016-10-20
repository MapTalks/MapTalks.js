describe('#LineString', function() {

    var container;
    var map;
    var tile;
    var center = new maptalks.Coordinate(118.846825, 32.046534);
    var layer;
    var canvasContainer;

    beforeEach(function() {
        var setups = commonSetupMap(center);
        container = setups.container;
        map = setups.map;
        layer = new maptalks.VectorLayer('id');
        map.addLayer(layer);
        canvasContainer = map._panels.canvasContainer;
    });

    afterEach(function() {
        map.removeLayer(layer);
        removeContainer(container)
    });

    it('getCenter', function() {
        var polyline = new maptalks.LineString([
          {x: 0, y: 0},
          {x: 120, y: 0}
        ]);
        var got = polyline.getCenter();
        expect(got.x).to.eql(60);
        expect(got.y).to.eql(0);
    });

    it('getExtent', function() {
        var polyline = new maptalks.LineString([
          {x: 0, y: 0},
          {x: 120, y: 10}
        ]);

        var extent = polyline.getExtent();
        expect(extent.getWidth()).to.be.above(0);
        expect(extent.getHeight()).to.be.above(0);
    });

    it('getSize', function() {
        var polyline = new maptalks.LineString([
          {x: 0, y: 0},
          {x: 10, y: 10},
          {x: 20, y: 30}
        ]);
        layer.addGeometry(polyline);
        var size = polyline.getSize();

        expect(size.width).to.be.above(0);
        expect(size.height).to.be.above(0);
    });


    it('getCoordinates', function() {
        var path = [
          {x: 0, y: 0},
          {x: 10, y: 10},
          {x: 20, y: 30}
        ];
        var polyline = new maptalks.LineString(path);
        layer.addGeometry(polyline);
        var coords = polyline.getCoordinates();

        for(var i = 0; i < coords.length; i++) {
            expect(coords[i]).to.closeTo(path[i]);
        }
        // expect(polyline.getCoordinates()).to.eql(path);
    });

    it('setCoordinates', function() {
        var path = [
          {x: 0, y: 0},
          {x: 10, y: 10},
          {x: 20, y: 30}
        ];
        var polyline = new maptalks.LineString([]);
        layer.addGeometry(polyline);
        polyline.setCoordinates(path);

        expect(polyline.getCoordinates()).to.eql(path);
    });


    describe('constructor', function() {

        it('normal constructor', function() {
            var points = [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0] ];
            var polyline = new maptalks.Polyline(points);
            var coordinates = polyline.getCoordinates();
            expect(coordinates).to.have.length(points.length);
            var geojsonCoordinates = maptalks.GeoJSON.toNumberArrays(coordinates);
            expect(geojsonCoordinates).to.eql(points);
        });

        it('can be empty.',function() {
            var polyline = new maptalks.Polyline();
            expect(polyline.getCoordinates()).to.have.length(0);
        });

    });

    describe('getCenter', function() {
        it('should返回笛卡尔坐标系上的点集合的中心点', function() {
            var polyline = new maptalks.Polyline([
                {x: 0, y: 0},
                {x: 0, y: 10},
                {x: 0, y: 80}
            ]);
            layer.addGeometry(polyline);

            expect(polyline.getCenter()).to.closeTo(new maptalks.Coordinate(0, 30));
        });
    });

    it('getExtent', function() {
        var polyline = new maptalks.Polyline([
            {x: 0, y: 0},
            {x: 0, y: 10},
            {x: 0, y: 80}
        ]);
        // layer.addGeometry(polyline);

        expect(polyline.getExtent()).to.eql(new maptalks.Extent(0, 0, 0, 80));
    });

    describe('geometry fires events', function() {
        it('events', function() {
            var points = [
                {x: 0, y: 0},
                {x: 0, y: 10},
                {x: 0, y: 80}
            ];
            var vector = new maptalks.Polyline(points);
            new GeoEventsTester().testCanvasEvents(vector, map, vector.getCenter());
        });
    });

    it('can have various symbols',function(done) {
        var points = [
                {x: 0, y: 0},
                {x: 0, y: 10},
                {x: 0, y: 80}
            ];
            var vector = new maptalks.Polyline(points);
        GeoSymbolTester.testGeoSymbols(vector, map, done);
    });

    it("Rectangle._containsPoint", function() {
        layer.clear();
        var geometry = new maptalks.Rectangle(center, 20, 10, {
            symbol: {
                'lineWidth': 6
            }
        });
        layer.addGeometry(geometry);

        var spy = sinon.spy();
        geometry.on('click', spy);

        happen.click(canvasContainer, {
            clientX: 400 + 8,
            clientY: 300 + 8 - 4
        });
        expect(spy.called).to.not.be.ok();

        happen.click(canvasContainer, {
            clientX: 400 + 8,
            clientY: 300 + 8 - 2
        });
        expect(spy.called).to.be.ok();
    });

    it('bug: create with dynamic textSize', function () {
        // bug desc:
        // when creating a linestring with dynamic textsize, geometry._getPainter() will create a textMarkerSymbolizer.
        // the dynamic textSize in the symbol will read map's zoom, which is still null.
        //
        // fix:
        // forbidden to getPainter when geometry is not added to a map.
        var points = [
                {x: 0, y: 0},
                {x: 0, y: 10},
                {x: 0, y: 80}
            ];
        var symbol = {"lineWidth":1,"lineColor":"#000","textName":"{count}","textSize":{"type":"interval","stops":[[0,0],[16,5],[17,10],[18,20],[19,40]]}};
        new maptalks.LineString(points, {
            'symbol' : symbol,
            'properties' : {'count' : 1}
        });
    })
});
