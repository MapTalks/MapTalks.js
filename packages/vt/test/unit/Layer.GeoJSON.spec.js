const maptalks = require('maptalks');
const assert = require('assert');
const { GeoJSONVectorTileLayer } = require('../../dist/maptalks.vt.js');
// const deepEqual = require('fast-deep-equal');

const points = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [114.25814, 30.58595] }, properties: { type: 1 } }
    ]
};

describe('GeoJSONVectorTileLayer', () => {
    let map, container;
    beforeEach(() => {
        container = document.createElement('div');
        container.style.width = '400px';
        container.style.height = '300px';
        document.body.appendChild(container);
        map = new maptalks.Map(container, {
            center: [114.25814, 30.58595],
            zoom: 19
        });
    });

    afterEach(() => {
        map.remove();
        document.body.removeChild(container);
    });

    it('should stringify input geojson data', () => {
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: points
        }).addTo(map);
        assert.ok(layer.options.data === points);
        //TODO 改为多图层后，getData返回的数据格式可能会有改变
        assert.equal(layer.getData().features.length, points.features.length);
        assert.ok(points.features[0].id === undefined);
    });

    it('should fire workerready event', (done) => {
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: points
        }).addTo(map);
        layer.on('workerready', e => {
            assert.ok(e);
            done();
        });
    });

    it('should can be serialized', done => {
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: points
        });
        const json = layer.toJSON();
        const layer2 = maptalks.Layer.fromJSON(json);
        layer2.on('workerready', e => {
            assert.ok(e);
            assert.ok(layer2.getData().features.length === points.features.length);
            done();
        });
        layer2.addTo(map);
    });
});
