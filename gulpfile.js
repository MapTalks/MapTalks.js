'use strict';

var minimist = require('minimist'),
  gulp   = require('gulp'),
  del    = require('del'),
  header = require('gulp-header'),
  footer = require('gulp-footer'),
  concat = require('gulp-concat'),
  gzip   = require('gulp-gzip'),
  rename = require('gulp-rename'),
  uglify = require('gulp-uglify'),
  cssnano = require('gulp-cssnano'),
  connect = require('gulp-connect'),
  version = require('./package.json').version;
var Server = require('karma').Server;

var knownOptions = {
  string: ['browsers', 'pattern'],
  boolean: 'coverage',
  alias: {
    'coverage': 'cov'
  },
  default: { browsers: 'PhantomJS', coverage: false }
};

var options = minimist(process.argv.slice(2), knownOptions);

var sources = require('./build/getFiles.js').getFiles(),
    styles = './assets/css/**/*.css';

gulp.task('scripts', function() {
  return gulp.src(sources)
      .pipe(concat('maptalks.js'))
      .pipe(header('(function () {\n\'use strict\';\n\'' + version + '\';\n'))
      .pipe(footer('\n})();'))
      .pipe(gulp.dest('./dist'))
      .pipe(rename({suffix: '.min'}))
      .pipe(uglify())
      .pipe(gulp.dest('./dist'))
      .pipe(gzip())
      .pipe(gulp.dest('./dist'));
});

gulp.task('styles',function() {
   return gulp.src(styles)
        .pipe(concat('maptalks.css'))
        .pipe(cssnano())
        .pipe(gulp.dest('./dist/'));
});


gulp.task('build',['scripts','styles'],function() {
  return gulp.src('./assets/images/**/*')
    .pipe(gulp.dest('./dist/images'));
});

gulp.task('watch', ['build'], function () {
  var scriptWatcher = gulp.watch(['src/**/*.js', './gulpfile.js','build/srcList.txt'], ['reload']); // watch the same files in our scripts task
  var stylesWatcher = gulp.watch(styles, ['styles']);
});


var browsers = options.browsers.split(',');
browsers = browsers.map(function(name) {
  var lname = name.toLowerCase();
  if (lname.indexOf('phantom') === 0) {
    return 'PhantomJS';
  }
  if (lname[0] === 'i') {
    return 'IE' + lname.substr(2);
  } else {
    return lname[0].toUpperCase() + lname.substr(1);
  }
});

/**
 * Run test once and exit
 */
gulp.task('test', ['build'], function (done) {
  var karmaConfig = {
    configFile: __dirname + '/karma.conf.js',
    browsers:browsers,
    singleRun: true
  };
  if (options.coverage) {
    karmaConfig.preprocessors = {
      'src/**/!(happen|Support|Util|DomUtil|Matrix|Promise|FunctionType|HeatmapLayer).js': ['coverage']
    };
    karmaConfig.coverageReporter = {
      type: 'lcov', // lcov or lcovonly are required for generating lcov.info files
      dir: 'coverage/'
    };
    karmaConfig.reporters = ['dots','coverage'];
  };
  if (options.pattern) {
    karmaConfig.client = {
      mocha: {
        grep: options.pattern
      }
    };
  };
  new Server(karmaConfig, done).start();
});

/**
 * Watch for file changes and re-run tests on each change
 */
gulp.task('tdd', function (done) {
  var karmaConfig = {
    configFile: __dirname + '/karma.conf.js',
    browsers: browsers,
    singleRun: false
  };
  if (options.pattern) {
    karmaConfig.client = {
      mocha: {
        grep: options.pattern
      }
    };
  }
  new Server(karmaConfig, done).start();
});

gulp.task('connect',['watch'], function() {
  connect.server({
        root: 'dist',
        livereload: true,
        port: 20000
    });
});

gulp.task('reload',['scripts'], function() {
    gulp.src('./dist/*.js')
      .pipe(connect.reload());
});

gulp.task('doc', function (cb) {
    del([
        'doc/api/**/*'
      ]);
    var conf = require('./jsdoc.json');
    var cmd = 'jsdoc';
    var args = ['-c','jsdoc.json'].concat(['API.md']).concat(sources);
    var exec = require('child_process').exec;
    var child = exec([cmd].concat(args).join(' '), function(error, stdout, stderr) {
        if (error) {
            console.error('JSDoc returned with error: ' + stderr?stderr:'');
            return;
        }
        if (stderr) {
          console.error(stderr);
        }
        if (stdout) {console.log(stdout);}
        console.log('Documented '+sources.length+' files in:');
        console.log(conf.opts.destination);
    });
});

gulp.task('default', ['connect']);

