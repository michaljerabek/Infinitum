/*jslint indent: 4, white: true, unparam: true, node: true, browser: true, devel: true, nomen: true, plusplus: true, regexp: true, sloppy: true, vars: true*/
/*global jQuery, requestAnimationFrame, cancelAnimationFrame*/

(function ($) {

    var TRANSFORM_PREFIX = "",

        TRANSFORM_PROP = (function () {

            var el = document.createElement("div"),

                prefixes = ["", "o", "ms", "moz", "webkit"],

                use = "transform";

            prefixes.some(function (prefix) {

                var prop = prefix ? prefix + "Transform" : "transform";

                if (el.style[prop] !== undefined) {

                    use = prop;

                    TRANSFORM_PREFIX = prefix ? "-" + prefix + "-" : "";

                    return true;
                }
            });

            return use;
        }()),

        T3D = (function () {

            var el = document.createElement("div");

            el.style[TRANSFORM_PROP] = "translate3d(0,0,0)";

            return !!el.style[TRANSFORM_PROP];
        }()),

        TRANSITION_PROP = "transition",

        TRANSITION_PREFIX = "",

        TRANSITIONEND = (function () {

            var el = document.createElement("div"),

                transitions = [
                    "transition"      , "transitionend"      , ""        ,
                    "OTransition"     , "otransitionend"     , "-o-"     ,
                    "MozTransition"   , "transitionend"      , "-moz-"   ,
                    "WebkitTransition", "webkitTransitionEnd", "-webkit-"
                ],

                i = 0, length = transitions.length;

            for (i; i < length; i += 3) {

                if (el.style[transitions[i]] !== undefined) {

                    TRANSITION_PROP = transitions[i];

                    TRANSITION_PREFIX = transitions[i + 2];

                    return transitions[i + 1];
                }
            }

            return null;

        }());


    var getCurrentMatrix = function ($element) {

        var currentTransform = $element.css(TRANSFORM_PROP);

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
    },

    $t = (function() {

        var $temp = $([null]);

        return function (element) {

            $temp[0] = element;

            return $temp;
        };
    }()),

    $win = $(window);

    var NS = "Infinitum";

    var CLASS = {
        self: "infinitum",
        track: "infinitum__track",
        item: "infinitum__item",

        current: "infinitum__item--current",
        hide: "infinitum__item--hide",
        clone: "infinitum__item--clone",

        speed1: "infinitum__track--slow",
        speed2: "infinitum__track--medium",
        speed3: "infinitum__track--fast",

        selector: function (className, not) {

            return (not ? ":not(" : "") + "." + this[className] + (not ? ")" : "");
        }
    };

    var DEFAULTS = {
        selector: CLASS.selector("self")
    };


    var Infinitum = window.Infinitum = function Infinitum(options) {

        this.initialized = false;

        this._animate = this._animate.bind(this);

        this._shouldCancelRAF = true;
        this._speed = [5, 5, 5, 5, 5];

        this._lastTrackX = 0;

        this.startItemPos = 0;
        this.endItemPos = 0;

        this.$startItem = $();
        this.$endItem = $();
        this.$leftItemsOver = $();
        this.$rightItemsOver = $();
        this.$insideItems = $();

        this.init(options);
    };

    Infinitum.CLASS = CLASS;
    Infinitum.DEFAULTS = DEFAULTS;


    Infinitum.prototype.init = function (options) {

        if (this.initialized) {

            return;
        }

        this.options = options || this.options || {};

        this.options = $.extend({}, this.options);

        this.$self = $(this.options.selector)
            .addClass(CLASS.self);

        this.$track = $(this.$self).children()
            .addClass(CLASS.track);

        this.$track.css({
            minHeight: this.$track.outerHeight(),
            position: "relative"
        });

        this.$items = $(this.$track).children()
            .addClass(CLASS.item);

        this._prepareItems();

        this.selfRect = this.$self[0].getBoundingClientRect();

        this._initEvents();

        this.initialized = true;
    };

    Infinitum.prototype._onPointerStart = function (event) {

        cancelAnimationFrame(this._animate);
        this._shouldCancelRAF = true;

        this.$track.css(TRANSITION_PROP, "none");

        this.$items.removeClass(CLASS.current);

        this._lastClinetX = event.clientX;

        $win.on("mousemove." + NS + " touchmove." + NS, this._onPointerMove.bind(this));

        $win.one("mouseup." + NS + " touchend." + NS, this._onPointerEnd.bind(this));

        return false;
    };

    Infinitum.prototype._onPointerMove = function (event) {

        this._move(event.clientX - this._lastClinetX);

        this._lastClinetX = event.clientX;

        return false;
    };

    Infinitum.prototype._onPointerEnd = function () {

        var closestItem = this._findClosestItem();

        closestItem.$el.addClass(CLASS.current);

        $win.off("mousemove." + NS + " touchmove." + NS);

        if (!closestItem.pos) {

            return false;
        }

        this._moveTrack(-closestItem.pos, true);

        return false;
    };

    Infinitum.prototype._findClosestItem = function () {

        var closestLeftItemPos = null,

            $closestLeftItem;

        this.$items.each(function (i, item) {

            var left = item.getBoundingClientRect().left;

            if (closestLeftItemPos === null || Math.abs(closestLeftItemPos) > Math.abs(left - this.selfRect.left)) {

                closestLeftItemPos = left - this.selfRect.left;

                $closestLeftItem = $(item);
            }
        }.bind(this));

        return {
            pos: closestLeftItemPos,
            $el: $closestLeftItem
        };
    };

    Infinitum.prototype._initEvents = function () {

        this.$self.on("mousedown." + NS + " touchstart." + NS, this._onPointerStart.bind(this));

        this.$self.on("click." + NS + " touchstart." + NS, CLASS.selector("item"), function (event) {

            event.preventDefault();
        });
    };

    Infinitum.prototype._prepareItems = function () {

        var lastLeft = 0;

        this.$items.each(function () {

            var $this = $t(this);

            $this.css({
                position: "absolute",
                left: lastLeft
            });

            lastLeft += $this.outerWidth();
        });
    };

    Infinitum.prototype._moveTrack = function (x, animate) {

        var value = getTranslate(this.$track).x + x;

        this._setTrackPosition(value, animate);
    };

    Infinitum.prototype._setTrackPosition = function (position, animate) {

        this.$track.css(TRANSITION_PROP, animate ? "" : "none");

        if (animate) {

            this._shouldCancelRAF = false;

            this.$track.one(TRANSITIONEND, function () {

                cancelAnimationFrame(this._animate);

                this._shouldCancelRAF = true;

            }.bind(this));
        }

        this.$track.css(TRANSFORM_PROP, T3D ? "translate3d(" + position + "px, 0px, 0px)" : "translateX(" + position + "px)");

        if (animate) {

            requestAnimationFrame(this._animate);

            this._lastTrackX = getTranslate(this.$track).x;
        }
    };

    Infinitum.prototype._move = function (x, animation) {

        this._setSpeed(x);

        if (!animation) {

            this._moveTrack(x);

        } else if (!this._shouldCancelRAF) {

            requestAnimationFrame(this._animate);
        }

        this._sortItems();

        var animationDoneAndCurrentNotFirst = (animation && this._shouldCancelRAF && this.$startItem.length && !this.$startItem.hasClass(CLASS.current));

        if (x < 0 || animationDoneAndCurrentNotFirst) {

            this._moveLeftItemsOverToTheEnd(animationDoneAndCurrentNotFirst);

        } else if (x > 0) {

            this._moveRightItemsOverToTheStart();
        }
    };

    var counter = 0;

    Infinitum.prototype._moveLeftItemsOverToTheEnd = function (animationDoneAndCurrentNotFirst) {

        var _this = this;

        this.$leftItemsOver.filter(animationDoneAndCurrentNotFirst ? CLASS.selector("current", true) : "*").each(function () {

            var $this = $(this);

            if (!$this.hasClass(CLASS.hide) || $this.hasClass("right") || animationDoneAndCurrentNotFirst) {

                var $prev = $this.prevAll(CLASS.selector("clone", true)).first();

                if (!$prev.length) {

                    $prev = _this.$items.last();
                }

                $this.removeClass(CLASS.hide);

                var $clone = $this.clone();

                $clone.addClass(CLASS.clone);

                $this.addClass(CLASS.hide);
                $this.addClass("left");
                $this.removeClass("right");

                $this.after($clone);

                $clone.after($this);

                $this.css({
                    left: parseFloat($prev.css("left")) + $prev.outerWidth()
                });

                var id = counter++;

                $this.data("id", id);

                var fakeTransitionEnd,

                    onTransitionend = function () {

                        clearTimeout(fakeTransitionEnd);

                        $clone.remove();

                        if ($this.data("id") === id) {

                            $this.removeClass(CLASS.hide);
                            $this.removeClass("left");
                        }
                    };

                fakeTransitionEnd = setTimeout(onTransitionend, 1050);

                $clone.one(TRANSITIONEND, onTransitionend);

                $clone.addClass(CLASS.hide);
            }
        });
    };

    Infinitum.prototype._moveRightItemsOverToTheStart = function () {

        var _this = this,

            addedWidth = 0;

        this.$rightItemsOver.each(function () {

            var $this = $(this);

            if (_this.startItemPos - addedWidth <= _this.selfRect.left) {

                return;
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass("left")) {

                var $next = $this.nextAll(CLASS.selector("clone", true)).first();

                if (!$next.length) {

                    $next = _this.$items.first();
                }

                addedWidth += $this.outerWidth();

                $this.removeClass(CLASS.hide);

                var $clone = $this.clone();

                $clone.addClass(CLASS.clone);

                $this.addClass(CLASS.hide);
                $this.addClass("right");
                $this.removeClass("left");

                $this.before($clone);

                $clone.before($this);

                $this.css({
                    left: parseFloat($next.css("left")) - $this.outerWidth()
                });

                var id = counter++;

                $this.data("id", id);

                var fakeTransitionEnd,

                    onTransitionend = function () {

                        clearTimeout(fakeTransitionEnd);

                        $clone.remove();

                        if ($this.data("id") === id) {

                            $this.removeClass(CLASS.hide);
                            $this.removeClass("right");
                        }
                    };

                fakeTransitionEnd = setTimeout(onTransitionend, 1050);

                $clone.one(TRANSITIONEND, onTransitionend);

                $clone.addClass(CLASS.hide);
            }
        });

    };

    Infinitum.prototype._sortItems = function () {

        this.startItemPos = null;
        this.endItemPos = null;

        var leftItemsOver = [],
            rightItemsOver = [],
            startItem = null,
            endItem = null;

        this.$insideItems = $([]);

        this.$items.each(function (i, item) {

            var rect = item.getBoundingClientRect();

            if (this.startItemPos === null || this.startItemPos > rect.left) {

                this.startItemPos = rect.left;

                startItem = item;
            }

            if (this.endItemPos === null || this.endItemPos < rect.right) {

                this.endItemPos = rect.right;

                endItem = item;
            }

            if (rect.left < this.selfRect.left) {

                leftItemsOver.push(item);

            } else if (rect.right > this.selfRect.right) {

                rightItemsOver.push(item);

            } else {

                this.$insideItems.push(item);
            }

        }.bind(this));

        this.$startItem = $(startItem);
        this.$endItem = $(endItem);

        this.$leftItemsOver = $(leftItemsOver.sort(function (a, b) {

            return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
        }));

        this.$rightItemsOver = $(rightItemsOver.sort(function (a, b) {

            return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
        }));
    };

    Infinitum.prototype._animate = function () {

        this._move(getTranslate(this.$track).x - this._lastTrackX, true);
    };

    Infinitum.prototype._setSpeed = function (move) {

        this._speed = this._speed.slice(0, 4);

        this._speed.unshift(Math.abs(move));

        var avgSpeed = this._speed.reduce(function (acc, current) {

            return acc + current;

        }, 0) / this._speed.length;

        if (avgSpeed < 11) {

            this.$track
                .removeClass(CLASS.speed2)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed1);

        } else if (avgSpeed < 22) {

            this.$track
                .removeClass(CLASS.speed1)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed2);

        } else {

            this.$track
                .removeClass(CLASS.speed1)
                .removeClass(CLASS.speed2)
                .addClass(CLASS.speed3);
        }
    };

}(jQuery));
/*
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
}*/
