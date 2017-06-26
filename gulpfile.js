/*jslint indent: 4, white: true, nomen: true, regexp: true, unparam: true, node: true, browser: true, devel: true, nomen: true, plusplus: true, regexp: true, sloppy: true, vars: true*/
var gulp = require("gulp");
var rename = require("gulp-rename");
var uglify = require("gulp-uglify");
var concat = require("gulp-concat");
var cleanCSS = require("gulp-clean-css");

gulp.task("js", function () {

    gulp.src(["./src/*.js"])
        .pipe(concat("infinitum.js"))
        .pipe(
            gulp.dest("./dist")
        )
        .pipe(uglify())
        .pipe(rename(function (path) {
            path.basename = "infinitum.min";
        }))
        .pipe(
            gulp.dest("./dist")
        );
});

gulp.task("css", function () {

    gulp.src(["./src/*.css"])
        .pipe(concat("infinitum.css"))
        .pipe(
            gulp.dest("./dist/css")
        )
        .pipe(cleanCSS())
        .pipe(rename(function (path) {
            path.basename = "infinitum.min";
        }))
        .pipe(
            gulp.dest("./dist/css")
        );
});

gulp.task("watch", function () {

    gulp.watch(["src/**/*.js", "src/*.js"], ["js"]);
    gulp.watch(["src/*.css"], ["css"]);
});
