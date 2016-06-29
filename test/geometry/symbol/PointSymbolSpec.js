describe('PointSymbolSpec', function() {

    var container;
    var map;
    var tile;
    var center = new Z.Coordinate(118.846825, 32.046534);
    var layer;
    var canvasContainer;

    beforeEach(function() {
        var setups = commonSetupMap(center);
        container = setups.container;
        map = setups.map;
        canvasContainer = map._panels.canvasContainer;
        layer = new maptalks.VectorLayer('id').addTo(map);
    });

    afterEach(function() {
        map.removeLayer(layer);
        removeContainer(container)
    });

    describe('dx dy', function() {
        it('without dx, dy', function() {
            var marker = new maptalks.Marker(center, {
                symbol:{
                    "markerType" : "ellipse",
                    "markerWidth": 2,
                    "markerHeight": 2
                }
            });
            var v = new maptalks.VectorLayer('v', {'drawImmediate' : true}).addTo(map);
            v.addGeometry(marker);
            expect(v).to.be.painted();
        });

        it('with dx', function() {
            var marker = new maptalks.Marker(center, {
                symbol:{
                    "markerType" : "ellipse",
                    "markerWidth": 2,
                    "markerHeight": 2,
                    "markerDx": 10
                }
            });
            var v = new maptalks.VectorLayer('v', {'drawImmediate' : true}).addTo(map);
            v.addGeometry(marker);
            expect(v).not.to.be.painted();
            expect(v).to.be.painted(10);
        });

        it('with dy', function() {
            var marker = new maptalks.Marker(center, {
                symbol:{
                    "markerType" : "ellipse",
                    "markerWidth": 2,
                    "markerHeight": 2,
                    "markerDy": 10
                }
            });
            var v = new maptalks.VectorLayer('v', {'drawImmediate' : true}).addTo(map);
            v.addGeometry(marker);
            expect(v).not.to.be.painted();
            expect(v).to.be.painted(0, 10);
        });

        it('with dx, dy', function() {
            var marker = new maptalks.Marker(center, {
                symbol:{
                    "markerType" : "ellipse",
                    "markerWidth": 2,
                    "markerHeight": 2,
                    "markerDx": 10,
                    "markerDy": 10
                }
            });
            var v = new maptalks.VectorLayer('v', {'drawImmediate' : true}).addTo(map);
            v.addGeometry(marker);
            expect(v).not.to.be.painted();
            expect(v).to.be.painted(10, 10);
        });
    });

    describe('placement', function() {
        it('point placement', function() {
            var p = map.coordinateToContainerPoint(map.getCenter()),
                c2 = map.containerPointToCoordinate(p.add(10, 0)),
                c3 = map.containerPointToCoordinate(p.add(20, 0));
            var line = new maptalks.LineString([map.getCenter(), c2, c3], {
                'symbol' : {
                    'markerPlacement' : 'point',
                    'lineOpacity' : 0,
                    'markerType' : 'ellipse',
                    'markerWidth': 3,
                    'markerHeight': 3
                },

            });
            var v = new maptalks.VectorLayer('v', {'drawImmediate' : true, 'enableSimplify':false}).addGeometry(line).addTo(map);
            expect(v).to.be.painted();
            expect(v).to.be.painted(10, 0);
            expect(v).to.be.painted(20, 0);
        });

        it('line placement', function() {
            var p = map.coordinateToContainerPoint(map.getCenter()),
                c2 = map.containerPointToCoordinate(p.add(10, 0)),
                c3 = map.containerPointToCoordinate(p.add(20, 0));
            var line = new maptalks.LineString([map.getCenter(), c2, c3], {
                'symbol' : {
                    'markerPlacement' : 'line',
                    'lineOpacity' : 0,
                    'markerType' : 'ellipse',
                    'markerWidth': 2,
                    'markerHeight': 2
                }
            });
            var v = new maptalks.VectorLayer('v', {'drawImmediate' : true, 'enableSimplify':false}).addGeometry(line).addTo(map);
            expect(v).not.to.be.painted();
            expect(v).not.to.be.painted(10, 0);
            expect(v).not.to.be.painted(20, 0);
            expect(v).to.be.painted(5, 0);
            expect(v).to.be.painted(15, 0);
        });
    });


});
