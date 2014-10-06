var buildDir = "build";
var outputFile = "chr";

var gulp   = require('gulp');

// browser builds
var browserify = require('browserify');
var watchify = require('watchify')
var uglify = require('gulp-uglify');

// testing
var mocha = require('gulp-mocha');

var mochaPhantomJS = require('gulp-mocha-phantomjs'); 

// code style
var jshint = require('gulp-jshint');
var coveralls = require('gulp-coveralls');

// gulp helper
var source = require('vinyl-source-stream'); // converts node streams into vinyl streams
var gzip = require('gulp-gzip');
var clean = require('gulp-rimraf');
var rename = require('gulp-rename');
var chmod = require('gulp-chmod');
var streamify = require('gulp-streamify'); // converts streams into buffers (legacy support for old plugins)
var watch = require('gulp-watch');

// path tools
var fs = require('fs');
var path = require('path');
var join = path.join;
var mkdirp = require('mkdirp');

// browserify build config
var packageConfig = require('./package.json');
var outputFileMin = join(buildDir,outputFile + ".min.js");

// a failing test breaks the whole build chain
gulp.task('build', ['build-browser', 'build-browser-gzip']);
gulp.task('default', ['lint', 'test', 'coveralls', 'build']);

gulp.task('lint', function() {
  return gulp.src('./lib/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});


gulp.task('test', ['test-unit', 'test-dom']);


gulp.task('test-unit', function () {
    return gulp.src('./test/unit/**/*.js', {read: false})
        .pipe(mocha({reporter: 'spec',
                    useColors: false}));
});


gulp.task('test-dom', ["build-test"], function () {
  return gulp
  .src('test/index.html')
  .pipe(mochaPhantomJS());
});

// browserify debug
gulp.task('build-test',['init'], function() {
  var b = browserify({debug: true});
  b.add('./test/dom/index');
  return b.bundle()
    .pipe(source("test.js"))
    .pipe(chmod(644))
    .pipe(gulp.dest(buildDir));
});



gulp.task('coveralls', function () {
    return gulp.src('coverage/lcov.info')
	.pipe(coveralls());
});

gulp.task('test-watch', function() {
   gulp.watch(['./src/**/*.js','./lib/**/*.js', './test/**/*.js'], function() {
     gulp.run('test');
   });
});


// will remove everything in build
gulp.task('clean', function() {
  return gulp.src(buildDir).pipe(clean());
});

// just makes sure that the build dir exists
gulp.task('init', ['clean'], function() {
  mkdirp(buildDir, function (err) {
    if (err) console.error(err)
  });
});

// browserify debug
gulp.task('build-browser',['init'], function() {
  var b = browserify({debug: true,hasExports: true});
  exposeBundles(b);
  return b.bundle()
    .pipe(source(outputFile + ".js"))
    .pipe(chmod(644))
    .pipe(gulp.dest(buildDir));
});

// browserify min
gulp.task('build-browser-min',['init'], function() {
  var b = browserify({hasExports: true, standalone: "oo"});
  exposeBundles(b);
  return b.bundle()
    .pipe(source(outputFile + ".min.js"))
    .pipe(chmod(644))
    .pipe(streamify(uglify()))
    .pipe(gulp.dest(buildDir));
});
 
gulp.task('build-browser-gzip', ['build-browser-min'], function() {
  return gulp.src(outputFileMin)
    .pipe(gzip({append: false, gzipOptions: { level: 9 }}))
    .pipe(rename(outputFile + ".min.gz.js"))
    .pipe(gulp.dest(buildDir));
});

// exposes the main package
// + checks the config whether it should expose other packages
function exposeBundles(b){
  b.add('./index.js', {expose: packageConfig.name });
  if(packageConfig.sniper !== undefined && packageConfig.sniper.exposed !== undefined){
    for(var i=0; i<packageConfig.sniper.exposed.length; i++){
      b.require(packageConfig.sniper.exposed[i]);
    }
  }
}

// watch task for browserify 
// watchify has an internal cache -> subsequent builds are faster
gulp.task('watch', function() {
  var util = require('gulp-util')

  var b = browserify({debug: true,hasExports: true, cache: {}, packageCache: {} });
  b.add('./index.js', {expose: packageConfig.name});

  function rebundle(ids){
    b.bundle()
    .on("error", function(error) {
      util.log(util.colors.red("Error: "), error);
     })
    .pipe(source(outputFile + ".js"))
    .pipe(chmod(644))
    .pipe(gulp.dest(buildDir));
  }

  var watcher = watchify(b);
  watcher.on("update", rebundle)
   .on("log", function(message) {
      util.log("Refreshed:", message);
  });
  return rebundle();
});
