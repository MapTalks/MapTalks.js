const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const terser = require('rollup-plugin-terser').terser;
const nodePolyfills = require('rollup-plugin-polyfill-node');
const replace = require('@rollup/plugin-replace');
const pkg = require('./package.json');

const production = process.env.BUILD === 'production';

const banner = `/*!\n * ${pkg.name} v${pkg.version}\n * LICENSE : ${pkg.license}\n * (c) 2022-${new Date().getFullYear()} maptalks.com\n */`;

const plugins = [
    nodePolyfills(),
    nodeResolve({
        // module : true,
        // jsnext : true,
        // main : true
    }),
    commonjs(),
];


const printVer = `typeof console !== 'undefined' && console.log('${pkg.name} v${pkg.version}');\n`;
const intro = `${printVer} const transcoder = function () {\n`;
const outro = `
    };
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        const maptalksgl = require('@maptalks/gl');
        maptalksgl.transcoders.registerTranscoder('ktx2', transcoder);
    } else {
        return transcoder;
    }
`;

const terserPlugin = terser({
    toplevel: true,
    mangle: {
        // properties: {
        //     // 'regex' : /^_/,
        //     'keep_quoted' : true,
        //     'reserved': ['maptalksgl', 'transcoders', 'ktx2'],
        // }
    },
    compress: {
        pure_getters: true
    },
    output : {
        ecma: 2017,
        // keep_quoted_props: true,
        beautify: false,
        comments : '/^!/'
    }
});

module.exports = [
    {
        input: 'src/index.js',
        external : ['@maptalks/gl',],
        plugins : plugins.concat(production ? [terserPlugin] : []),
        output: [
            {
                'sourcemap': false,
                'format': 'umd',
                extend: true,
                'name': 'maptalksgl.transcoders.ktx2',
                'globals' : {
                    '@maptalks/gl' : 'maptalksgl'
                },
                intro,
                outro,
                file: pkg.main,
                banner: `${banner}(function () {`,
                footer: '}())'
            }
        ]
    }
];

if (production) {
    module.exports.push(
        {
            input: 'src/index.js',
            external : ['@maptalks/gl/dist/transcoders'],
            plugins : plugins.concat([
                replace({
                  // '(function(A) {': 'function (A) {',
                  'export { promisify as default };': 'return promisify;',
                  preventAssignment: false,
                  delimiters: ['', '']
                }),
                terserPlugin
            ]),
            output: {
                strict: false,
                format: 'es',
                name: 'exports',
                exports: 'named',
                extend: true,
                file: 'dist/transcoder.js',
                banner: `export default function () {`,
                footer: `}`
            }
        },
        {
            input: 'src/index.es.js',
            external : ['@maptalks/gl/dist/transcoders'],
            plugins : plugins,
            output: {
                globals: {
                    '@maptalks/gl': 'maptalksgl'
                },
                extend: true,
                format: 'es',
                sourcemap: false,
                name: 'maptalksgl.transcoders.ktx2',
                banner,
                intro: printVer,
                file: pkg.module
            }
        }
    );
}