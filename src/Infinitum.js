/*jslint indent: 4, white: true, unparam: true, node: true, browser: true, devel: true, nomen: true, plusplus: true, regexp: true, sloppy: true, vars: true*/
/*global $*/


var lastTrans = 0, cancel = false;

var move = function (move, animation) {

    var linksLeft = $links[0].getBoundingClientRect().left;
    var linksRight = $links[0].getBoundingClientRect().right;

    speed = speed.slice(0, 2);

    speed.unshift(Math.abs(move));

    var avgSpeed = speed.reduce(function (prev, current) {
        return prev + current;
    }, 0) / speed.length;

    var duration = 500 / (Math.log(avgSpeed) || 1);

    if (Math.log(avgSpeed) < 1) {

        $linksWrapper.removeClass("medium").removeClass("fast").addClass("slow");

    } else if (Math.log(avgSpeed) < 2) {

        $linksWrapper.removeClass("slow").removeClass("fast").addClass("medium");

    } else {

        $linksWrapper.removeClass("medium").removeClass("slow").addClass("fast");

    }

    if (!animation) {

        $linksWrapper.css("transform", `translateX(${(getTranslate($linksWrapper).x + move)}px)`);

    } else if (!cancel) {

        requestAnimationFrame(anim);
    }

    var start = null,
        end = null,
        $start = null,
        $end = null,
        $leftOver = $([]),
        $rightOver = $([]),
        $middle = $([]);

    $linksWrapper.children(":not(.removing)").each(function () {

        var $this = $(this),

            left = this.getBoundingClientRect().left,
            right = this.getBoundingClientRect().right;

        if (start === null || start > left) {

            start = left;

            $start = $this;
        }

        if (end === null || end < right) {

            end = right;

            $end = $this;
        }

        if (left < linksLeft) {

            $leftOver.push(this);

        } else if (right > linksRight) {

            $rightOver.push(this);

        } else {

            $middle.push(this);
        }

    });

    $leftOver = $($leftOver.get().sort(function (a, b) {

        return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
    }));

    $rightOver = $($rightOver.get().sort(function (a, b) {

        return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
    }));

    var currentIsNotFirst = (animation && cancel && $start.length && !$start.hasClass("current"));

    //left
    if (move < 0 || currentIsNotFirst) {

        $leftOver.filter(currentIsNotFirst ? ":not(.current)" : "*").each(function (i) {

            var $this = $(this);

            if (!$this.hasClass("hide-tab-link-anim") || currentIsNotFirst) {

                var $prev = $this.prevAll(":not(.removing)").first();

                if (!$prev.length) {

                    $prev = $linksWrapper.children(":not(.removing)").last();
                }

                var $clone = $this.clone();

                $this.addClass("hide-tab-link-anim");

                $clone.addClass("clone");

                $this.after($clone);

                $clone.after($this);

                $this.css({
                    left: parseFloat($prev.css("left")) + $prev.outerWidth()
                });

                var to = setTimeout(function() {

                    $clone.remove();

                    $this.removeClass("hide-tab-link-anim");
                }, 1050);

                $clone.one("transitionend", function () {

                    clearTimeout(to);

                    $clone.remove();
                    $this.removeClass("hide-tab-link-anim");
                });

                $clone.addClass("hide-tab-link-anim");
                $clone.addClass("removing");
            }
        });
    }

    //right
    if (move > 0) {

        var added = 0;

        $rightOver.each(function (i) {

            var $this = $(this);

            if (start - added <= linksLeft) {

                return;
            }

            if (!$this.hasClass("hide-tab-link-anim")) {

                var $next = $this.nextAll(":not(.removing)").first();

                if (!$next.length) {

                    $next = $linksWrapper.children(":not(.removing)").first();
                }

                added += $this.outerWidth();

                var $clone = $this.clone();

                $this.addClass("hide-tab-link-anim");

                $clone.addClass("clone");

                $this.before($clone);

                $clone.before($this);

                $this.css({
                    left: parseFloat($next.css("left")) - $this.outerWidth()
                });

                var to = setTimeout(function() {

                    $clone.remove();
                    $this.removeClass("hide-tab-link-anim");
                }, 1050);

                $clone.one("transitionend", function () {

                    clearTimeout(to);

                    $clone.remove();
                    $this.removeClass("hide-tab-link-anim");
                });

                $clone.addClass("hide-tab-link-anim");
                $clone.addClass("removing");
            }
        });

    }
};

var getCurrentMatrix = function ($element) {

    var currentTransform = $element.css("transform");

    currentTransform = currentTransform === "none" || !currentTransform ? "matrix(1, 0, 0, 1, 0, 0)" : currentTransform;

    var matrix = currentTransform.replace(/^.*\((.*)\)$/g, "$1").split(/, +/),

        isMatrix3d = currentTransform.indexOf("3d") !== -1;

    return {
        value: matrix,
        is3d: isMatrix3d
    };
},

    getTranslate = function ($element) {

        var matrix = getCurrentMatrix($element);

        return {
            x: (matrix.is3d ? +matrix.value[12] : +matrix.value[4]),
            y: (matrix.is3d ? +matrix.value[13] : +matrix.value[5])
        };
    };

var $links = $(".tab-links");
var $link = $(".tab-link");
var $linksWrapper = $(".tab-links-wrapper");

var lastTx = 0;

var speed = [10, 10, 10];

$linksWrapper.css({
    position: "relative"
});

$link.each(function (i) {

    $(this).css({
        minWidth: $links.outerWidth() / $link.length,
        width: (Math.random() * 200) + 100
    });
});

var last = 0;

$link.each(function (i) {

    $(this).css({
        position: "absolute",
        left: last
    });

    $(this).data("left", last);

    last += $(this).outerWidth();
});

$links.on("mousedown", function ({clientX}) {

    $link = $linksWrapper.children(":not(.removing)");

    cancelAnimationFrame(anim);
    cancel = true;

    $linksWrapper.css("transition", "none");

    $link.removeClass("current");

    var lastX = clientX;

    var linksLeft = $links[0].getBoundingClientRect().left;
    var linksRight = $links[0].getBoundingClientRect().right;

    var lastDir = clientX - lastX > 0;


    $(window).on("mousemove", function ({clientX, type}) {

        move(clientX - lastX);

        lastX = clientX;

        return false;
    });

    $(window).one("mouseup", function () {

        var closest = null,
            $closest,

            $sorted = $($link.get().sort(function (a, b) {

                return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
            }));

        var endLeft = parseFloat($sorted.last().css("left"));

        $link = $linksWrapper.children(":not(.removing)");

        $link.each(function (i) {

            var $this = $(this),

                left = this.getBoundingClientRect().left;

            if (closest === null || Math.abs(closest) > Math.abs(left - linksLeft)) {

                closest = left - linksLeft;

                $closest = $this;
            }
        });

        $closest.addClass("current");

        $(window).off("mousemove mouseup");

        if (!closest) {

            console.info("not-moved");

            return;
        }

        lastTrans = getTranslate($linksWrapper).x;

        $linksWrapper.css("transition", "");

        cancel = false;

        $linksWrapper.one("transitionend", function () {
            cancelAnimationFrame(anim);

            cancel = true;
        });

        $linksWrapper.css("transform", `translateX(${(getTranslate($linksWrapper).x - closest)}px)`);

        requestAnimationFrame(anim);
    });

    return false;
});

function anim () {

    move(getTranslate($linksWrapper).x - lastTrans, true);

    lastTrans = getTranslate($linksWrapper).x;
}
