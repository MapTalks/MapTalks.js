const base = require('./karma.base.config.js');

module.exports = function (config) {

    const options = Object.assign(base, {
        browsers: ['Chrome'],
        reporters: ['mocha', 'coverage'],
        coverageReporter: {
            dir: 'coverage',
            reporters: [
                { type: 'lcov', subdir: '.' },
                { type: 'text-summary', subdir: '.' },
            ]
        },
        singleRun: true
    });
    options.rollupPreprocessor.sourceMap = 'inline';
    const plugins = options.rollupPreprocessor.plugins;
    const idx = plugins.findIndex(plugin => {
        return plugin.name === 'babel';
    });
    if (idx >= 0) {
        const babel = require('maptalks-rollup-plugin-babel');
        plugins.splice(idx, 1, babel({
            plugins: [['istanbul', {
                exclude: ['test/**/*.js', 'src/core/mapbox/*.js', 'src/util/dom.js', 'node_modules/**/*']
            }]]
        }));
    }

    config.set(options);
};
