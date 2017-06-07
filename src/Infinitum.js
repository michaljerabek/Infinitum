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

    getClientValue = function (event, directionOrPointerIndex, direction) {

        var pointerIndex = 0;

        if (typeof directionOrPointerIndex === "number") {

            pointerIndex = directionOrPointerIndex;

            directionOrPointerIndex = direction;
        }

        if (typeof directionOrPointerIndex === "undefined") {

            return {
                x: getClientValue(event, pointerIndex, "x"),
                y: getClientValue(event, pointerIndex, "y")
            };
        }

        var prop = "client" + directionOrPointerIndex.toUpperCase();

        event = event.originalEvent || event;

        return typeof event[prop] === "number" ? event[prop] : event.touches[pointerIndex][prop];
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
        uncurrent: "infinitum__item--uncurrent",
        hide: "infinitum__item--hide",
        clone: "infinitum__item--clone",
        toEnd: "infinitum__item--to-end",
        toStart: "infinitum__item--to-start",

        speed1: "infinitum__track--slow",
        speed2: "infinitum__track--medium",
        speed3: "infinitum__track--fast",

        selector: function (className, not) {

            return (not ? ":not(" : "") + "." + this[className] + (not ? ")" : "");
        }
    };

    var DATA = {
        transitionId: "transitionId"
    };

    var DEFAULTS = {
        selector: CLASS.selector("self"),

        clearLeft: true
    };


    var idCounter = 1,
        transitionIdCounter = 0;

    var Infinitum = window.Infinitum = function Infinitum(options) {

        this.id = NS + idCounter++;

        this.initialized = false;

        this._animate = this._animate.bind(this);

        this._shouldCancelRAF = true;
        this._speed = [7, 7, 7, 7, 7];

        this._lastTrackX = 0;

        this.startItemPosWll = 0;
        this.endItemPosWill = 0;

        this.$currentItem = $();
        this.$willStartItem = null;
        this.$willEndItem = null;
        this.$leftItemsOver = null;
        this.$rightItemsOver = null;
        this.$insideItems = null;

        this.init(options);
    };

    Infinitum.CLASS = CLASS;
    Infinitum.DEFAULTS = DEFAULTS;

    Infinitum.EVENT = {
        tap: "tap",
        change: "change"
    };

    Infinitum.DIR = {
        LEFT: 1,
        RIGHT: 2
    };


    Infinitum.prototype.init = function (options) {

        if (this.initialized) {

            return;
        }

        this.options = options || this.options || {};

        this.options = $.extend({}, DEFAULTS, this.options);

        this._prepareSelf();

        this._prepareTrack();

        this._prepareItems();

        this._initEvents();

        this.initialized = true;
    };

    Infinitum.prototype._onPointerStart = function (event) {

        this.$track.off(TRANSITIONEND + "." + this.id);
        cancelAnimationFrame(this._animate);
        this._shouldCancelRAF = true;

        this._setTrackPosition(getTranslate(this.$track).x);
        this.$track.css(TRANSITION_PROP, "none");

        this._lastClinetX = getClientValue(event, 0, "x");

        this._trackMoved = false;

        $win.on("mousemove." + this.id + " touchmove." + this.id, this._onPointerMove.bind(this));

        $win.one("mouseup." + this.id + " touchend." + this.id, this._onPointerEnd.bind(this));

        return false;
    };

    Infinitum.prototype._onPointerMove = function (event) {

        var clientX = getClientValue(event, 0, "x");

        this._move(clientX - this._lastClinetX);

        this._lastDir = clientX > this._lastClinetX ? Infinitum.DIR.RIGHT : Infinitum.DIR.LEFT;

        this._trackMoved = clientX !== this._lastClinetX || this._trackMoved;

        this._lastClinetX = clientX;

        return false;
    };

    Infinitum.prototype._onPointerEnd = function (event) {

        $win.off("mousemove." + this.id + " touchmove." + this.id);

        if (!this._trackMoved) {

            var $item = $(event.target).closest(CLASS.selector("item"));

            if ($item.length) {

                var tapEvent = $.Event({
                    type: Infinitum.EVENT.tap,
                    target: $item[0],
                    fromElement: this.$currentItem[0],
                    toElement: $item[0]
                });

                this.$self.trigger(tapEvent);

                if (tapEvent.isDefaultPrevented()) {

                    return;
                }

                this._setCurrent($item, true);
            }

            return !$item.length;
        }

        this._setCurrent(this._findCurrentItem());

        return false;
    };

    Infinitum.prototype._findCurrentItem = function () {

        if (this._lastDir === Infinitum.DIR.LEFT || !this.options.clearLeft) {

            return this._findClosestItem();
        }

        return this.$willStartItem;
    };

    Infinitum.prototype._findClosestItem = function () {

        var closestLeftItemPos = null,

            closestLeftItem;

        this.$items.each(function (i, item) {

            var attrLeft = parseFloat($t(item).attr("data-left")),
                cssLeft = parseFloat($t(item).css("left"));

            var left = item.getBoundingClientRect().left + (attrLeft - cssLeft);

            if (closestLeftItemPos === null || Math.abs(closestLeftItemPos) > Math.abs(left - this._selfRect.left)) {

                closestLeftItemPos = left - this._selfRect.left;

                closestLeftItem = item;
            }
        }.bind(this));

        return $(closestLeftItem);
    };

    Infinitum.prototype._initEvents = function () {

        this.$self.on("mousedown." + this.id + " touchstart." + this.id, this._onPointerStart.bind(this));

        this.$self.on("click." + this.id + " touchstart." + this.id, CLASS.selector("item"), function (event) {

            event.preventDefault();
        });
    };

    Infinitum.prototype._prepareSelf = function () {

        this.$self = $(this.options.selector)
            .addClass(CLASS.self);

        this._selfRect = {};
        this._origSelfRect = this.$self[0].getBoundingClientRect();

        var box = this.$self.css(["padding-left", "padding-right", "border-left-width", "border-right-width"]);

        this._selfRect.left = this._origSelfRect.left + parseFloat(box["padding-left"]) + parseFloat(box["border-left-width"]);
        this._selfRect.right = this._origSelfRect.right - parseFloat(box["padding-right"]) - parseFloat(box["border-right-width"]);
    };

    Infinitum.prototype._prepareTrack = function () {

        this.$track = $(this.$self).children()
            .addClass(CLASS.track);

        this.$track.css({
            minHeight: this.$track.css("height")
        });
    };

    Infinitum.prototype._prepareItems = function () {

        this.$items = $(this.$track).children()
            .addClass(CLASS.item);

        var lastLeft = 0;

        this.$items.each(function () {

            var $this = $t(this);

            $this.css({
                position: "absolute",
                left: lastLeft
            });

            $this.attr("data-left", lastLeft);

            lastLeft += Math.round($this.outerWidth());
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

            this.$track.on(TRANSITIONEND + "." + this.id, function (event) {

                if (event.originalEvent.target !== this.$track[0] || !event.originalEvent.propertyName.match(/transform/i)) {

                    return;
                }

                cancelAnimationFrame(this._animate);

                this._shouldCancelRAF = true;

                this.$track.off(TRANSITIONEND + "." + this.id);

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
        }

        this._sortItems();

        var animationDoneAndCurrentNotFirst = (animation && this._shouldCancelRAF && this.$willStartItem.length && !this.$willStartItem.hasClass(CLASS.current));

        if (x < 0 || animationDoneAndCurrentNotFirst) {

            this._moveLeftItemsOverToTheEnd(animationDoneAndCurrentNotFirst);

        } else if (x > 0) {

            this._moveRightItemsOverToTheStart();
        }

        if (!this.options.clearLeft) {

            this.$insideItems.filter(CLASS.selector("uncurrent"))
                .removeClass(CLASS.current)
                .removeClass(CLASS.uncurrent);
        }

        if (animation && !this._shouldCancelRAF) {

            requestAnimationFrame(this._animate);
        }
    };

    Infinitum.prototype._moveLeftItemsOverToTheEnd = function (animationDoneAndCurrentNotFirst) {

        var _this = this,

            addedWidth = 0;

        this.$leftItemsOver.each(function () {

            var $this = $(this),

                width = Math.round($this.outerWidth());

            if (!_this.options.clearLeft && _this.endItemPosWill + addedWidth >= _this._selfRect.right/* + (width / 2)*/) {

                if ($this.hasClass(CLASS.uncurrent)) {

                    $this.removeClass(CLASS.uncurrent);
                    $this.removeClass(CLASS.current);
                }

                return;
            }

            if (animationDoneAndCurrentNotFirst && $this.hasClass(CLASS.current)) {

                return;
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toStart) || animationDoneAndCurrentNotFirst) {

                $this.off(TRANSITIONEND);

//                $this.data("end") && $this.data("end")();
                $this.data("to") && clearTimeout($this.data("to"));

                var $prev = $this.prevAll(CLASS.selector("clone", true)).first();

                if (!$prev.length) {

                    $prev = _this.$items.last();
                }

                addedWidth += width;

                var opacity = $this.css("opacity");

//                $this.css("transition", "none");
//                $this.css("opacity", opacity);
                $this.addClass(CLASS.toEnd);
                $this.removeClass(CLASS.toStart);
                $this.removeClass(CLASS.hide);

                $this.attr("data-left", parseFloat($prev.attr("data-left")) + Math.round($prev.outerWidth()));

                var transitionId = transitionIdCounter++;

                $this.data(DATA.transitionId + "." + _this.id, transitionId);

                var fakeTransitionEnd,

                    onTransitionend = function (event) {

                        if (event && event.originalEvent.target !== $this[0] && (event.originalEvent.propertyName !== "opacity"/* || event.originalEvent.elapsedTime !== 1*/)) {

                            return;
                        }

                        clearTimeout(fakeTransitionEnd);

                        if ($this.data(DATA.transitionId + "." + _this.id) === transitionId) {

                            $this.css({
                                left: parseFloat($this.attr("data-left"))
                            });

                            $this.data("end", null);
                            $this.data("to", null);

                            $this.removeClass(CLASS.hide);
                            $this.removeClass(CLASS.toEnd);
                        }

                        $this.off(TRANSITIONEND);
                    };

                $this.data("end", onTransitionend);

                if (!parseFloat(opacity)) {

                    onTransitionend();

                } else {

                    fakeTransitionEnd = setTimeout(onTransitionend, 1050);

                    $this.data("to", fakeTransitionEnd);

                    $this.on(TRANSITIONEND, onTransitionend);

                    $this.css("transition", "");
                    $this.addClass(CLASS.hide);
                    $this.css("opacity", "");
                }

                if ($this.hasClass(CLASS.uncurrent)) {

                    $this.removeClass(CLASS.uncurrent);
                    $this.removeClass(CLASS.current);
                }
            }
        });

        this._shouldCancelRAF && this.$leftItemsOver.each(function () {

            var $this = $(this);

            if ($this.hasClass(CLASS.toEnd)) return;

            $this.off(TRANSITIONEND);

            $this.data("end", null);
            clearTimeout($this.data("to"));
            $this.data("to", null);

            $this.removeClass(CLASS.hide);
            $this.removeClass(CLASS.toStart);

            $this.attr("data-left", parseFloat($this.css("left")));
        });
    };

//    Infinitum.prototype._moveLeftItemsOverToTheEnd = function (animationDoneAndCurrentNotFirst) {
//
//        var _this = this,
//
//            addedWidth = 0;
//
//        this.$leftItemsOver.each(function () {
//
//            var $this = $(this),
//
//                width = $this.outerWidth();
//
//            if (!_this.options.clearLeft && _this.endItemPos + addedWidth >= _this._selfRect.right/* + (width / 2)*/) {
//
//                if ($this.hasClass(CLASS.uncurrent)) {
//
//                    $this.removeClass(CLASS.uncurrent);
//                    $this.removeClass(CLASS.current);
//                }
//
//                return;
//            }
//
//            if (animationDoneAndCurrentNotFirst && $this.hasClass(CLASS.current)) {
//
//                return;
//            }
//
//            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toStart) || animationDoneAndCurrentNotFirst) {
//
//                var $prev = $this.prevAll(CLASS.selector("clone", true)).first();
//
//                if (!$prev.length) {
//
//                    $prev = _this.$items.last();
//                }
//
//                addedWidth += width;
//
//                var opacity = $this.css("opacity");
//
//                $this.removeClass(CLASS.hide);
//
//                var $clone = $this.clone();
//
//                $clone.css(TRANSITION_PROP, "none");
//                $clone.css("opacity", opacity);
//
//                $clone.addClass(CLASS.clone);
//
//                $this.addClass(CLASS.hide);
//                $this.addClass(CLASS.toEnd);
//                $this.removeClass(CLASS.toStart);
//
//                $this.after($clone);
//
//                $clone.after($this);
//
//                $this.css({
//                    left: parseFloat($prev.css("left")) + $prev.outerWidth()
//                });
//
//                var transitionId = transitionIdCounter++;
//
//                $this.data(DATA.transitionId + "." + _this.id, transitionId);
//
//                var fakeTransitionEnd,
//
//                    onTransitionend = function (event) {
//
//                        if (event && event.originalEvent.target !== $clone[0] && event.originalEvent.propertyName !== "opacity") {
//
//                            return;
//                        }
//
//                        clearTimeout(fakeTransitionEnd);
//
//                        $clone.remove();
//
//                        if ($this.data(DATA.transitionId + "." + _this.id) === transitionId) {
//
//                            $this.removeClass(CLASS.hide);
//                            $this.removeClass(CLASS.toEnd);
//                        }
//
//                        $clone.off(TRANSITIONEND);
//                    };
//
//                if (!parseFloat(opacity)) {
//
//                    onTransitionend();
//
//                } else {
//
//                    fakeTransitionEnd = setTimeout(onTransitionend, 1050);
//
//                    $clone.on(TRANSITIONEND, onTransitionend);
//
//                    $clone.css(TRANSITION_PROP, "");
//                    $clone.addClass(CLASS.hide);
//                    $clone.css("opacity", "");
//                }
//
//                if ($this.hasClass(CLASS.uncurrent)) {
//
//                    $this.removeClass(CLASS.uncurrent);
//                    $this.removeClass(CLASS.current);
//                    $clone.removeClass(CLASS.current);
//                }
//            }
//        });
//    };
//
    Infinitum.prototype._moveRightItemsOverToTheStart = function () {

        var _this = this,

            addedWidth = 0;

        this.$rightItemsOver.each(function () {

            var $this = $(this),

                width = Math.round($this.outerWidth());

            if (_this.startItemPosWll - addedWidth <= _this._selfRect.left/* + (width / 2)*/) {

                return;
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toEnd)) {

                $this.off(TRANSITIONEND);

//                $this.data("end") && $this.data("end")();
                $this.data("to") && clearTimeout($this.data("to"));

                var $next = $this.nextAll(CLASS.selector("clone", true)).first();

                if (!$next.length) {

                    $next = _this.$items.first();
                }

                addedWidth += width;

                var opacity = $this.css("opacity");

//                $this.css("transition", "none");
//                $this.css("opacity", opacity);
                $this.addClass(CLASS.toStart);
                $this.removeClass(CLASS.toEnd);
                $this.removeClass(CLASS.hide);

                $this.attr("data-left", parseFloat($next.attr("data-left")) - Math.round($this.outerWidth()));

                var transitionId = transitionIdCounter++;

                $this.data(DATA.transitionId + "." + _this.id, transitionId);

                var fakeTransitionEnd,

                    onTransitionend = function (event) {

                        if (event && event.originalEvent.target !== $this[0] && (event.originalEvent.propertyName !== "opacity"/* || event.originalEvent.elapsedTime !== 1*/)) {

                            return;
                        }

                        clearTimeout(fakeTransitionEnd);

//                        if ($this.data(DATA.transitionId + "." + _this.id) === transitionId) {

                            $this.css({
                                left: parseFloat($this.attr("data-left"))
                            });

                            $this.data("end", null);
                            $this.data("to", null);

                            $this.removeClass(CLASS.hide);
                            $this.removeClass(CLASS.toStart);
//                        }

                        $this.off(TRANSITIONEND);
                    };

                $this.data("end", onTransitionend);

                if (!parseFloat(opacity)) {

                    onTransitionend();

                } else {

                    fakeTransitionEnd = setTimeout(onTransitionend, 1050);

                    $this.data("to", fakeTransitionEnd);

                    $this.on(TRANSITIONEND, onTransitionend);

                    $this.css("transition", "");
                    $this.addClass(CLASS.hide);
                    $this.css("opacity", "");
                }

                if ($this.hasClass(CLASS.uncurrent)) {

                    $this.removeClass(CLASS.uncurrent);
                    $this.removeClass(CLASS.current);
                }
            }
        });


        this._shouldCancelRAF && this.$rightItemsOver.each(function () {

            var $this = $(this);

            if ($this.hasClass(CLASS.toStart)) return;

            clearTimeout($this.data("to"));
            $this.off(TRANSITIONEND);

            $this.data("end", null);
            $this.data("to", null);

            $this.attr("data-left", parseFloat($this.css("left")));

            $this.removeClass(CLASS.hide);
            $this.removeClass(CLASS.toEnd);
        });

    };
//
//    Infinitum.prototype._moveRightItemsOverToTheStart = function () {
//
//        var _this = this,
//
//            addedWidth = 0;
//
//        this.$rightItemsOver.each(function () {
//
//            var $this = $(this),
//
//                width = $this.outerWidth();
//
//            if (_this.startItemPos - addedWidth <= _this._selfRect.left/* + (width / 2)*/) {
//
//                return;
//            }
//
//            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toEnd)) {
//
//                var $next = $this.nextAll(CLASS.selector("clone", true)).first();
//
//                if (!$next.length) {
//
//                    $next = _this.$items.first();
//                }
//
//                addedWidth += width;
//
//                var opacity = $this.css("opacity");
//
//                $this.removeClass(CLASS.hide);
//
//                var $clone = $this.clone();
//
//                $clone.css(TRANSITION_PROP, "none");
//                $clone.css("opacity", opacity);
//
//                $clone.addClass(CLASS.clone);
//
//                $this.addClass(CLASS.hide);
//                $this.addClass(CLASS.toStart);
//                $this.removeClass(CLASS.toEnd);
//
//                $this.before($clone);
//
//                $clone.before($this);
//
//                $this.css({
//                    left: parseFloat($next.css("left")) - $this.outerWidth()
//                });
//
//                var transitionid = transitionIdCounter++;
//
//                $this.data(DATA.transitionId + "." + _this.id, transitionid);
//
//                var fakeTransitionEnd,
//
//                    onTransitionend = function (event) {
//
//                        if (event && event.originalEvent.target !== $clone[0] && event.originalEvent.propertyName !== "opacity") {
//
//                            return;
//                        }
//
//                        clearTimeout(fakeTransitionEnd);
//
//                        $clone.remove();
//
//                        if ($this.data(DATA.transitionId + "." + _this.id) === transitionid) {
//
//                            $this.removeClass(CLASS.hide);
//                            $this.removeClass(CLASS.toStart);
//                        }
//
//                        $clone.off(TRANSITIONEND);
//                    };
//
//                if (!parseFloat(opacity)) {
//
//                    onTransitionend();
//
//                } else {
//
//                    fakeTransitionEnd = setTimeout(onTransitionend, 1050);
//
//                    $clone.on(TRANSITIONEND, onTransitionend);
//
//                    $clone.css(TRANSITION_PROP, "");
//                    $clone.addClass(CLASS.hide);
//                    $clone.css("opacity", "");
//                }
//
//                if ($this.hasClass(CLASS.uncurrent)) {
//
//                    $this.removeClass(CLASS.uncurrent);
//                    $this.removeClass(CLASS.current);
//                    $clone.removeClass(CLASS.current);
//                }
//            }
//        });
//
//    };

    Infinitum.prototype._sortItems = function () {

        this.startItemPosWll = null;
        this.endItemPosWill = null;

        var leftItemsOver = [],
            rightItemsOver = [],
            willStartItem = null,
            willEndItem = null,
            willStartItemRect = null;

        this.$insideItems = $([]);

        this.$items.each(function (i, item) {

            var rect = item.getBoundingClientRect();

            var attrLeft = parseFloat($t(item).attr("data-left")),
                cssLeft = parseFloat($t(item).css("left"));

            if (this.startItemPosWll === null || this.startItemPosWll > rect.left + (attrLeft - cssLeft)) {

                this.startItemPosWll = rect.left + (attrLeft - cssLeft);

                willStartItem = item;

                willStartItemRect = {
                    left: rect.left + (attrLeft - cssLeft)
                };
            }

            if (this.endItemPosWill === null || this.endItemPosWill < rect.right + (attrLeft - cssLeft)) {

                this.endItemPosWill = rect.right + (attrLeft - cssLeft);

                willEndItem = item;
            }

            if (rect.left /*+ (attrLeft - cssLeft)*/ + (rect.width / 2) < this._selfRect.left) {

                leftItemsOver.push(item);

            } else if (rect.right/* + (attrLeft - cssLeft)*/ > this._selfRect.right) {

                rightItemsOver.push(item);

            } else {

                this.$insideItems.push(item);
            }

        }.bind(this));

        this.$willStartItem = this.$willStartItem && this.$willStartItem[0] === willStartItem ? this.$willStartItem : $(willStartItem);
        this.$willEndItem = this.$willEndItem && this.$willEndItem[0] === willEndItem ? this.$willEndItem : $(willEndItem);

        if (leftItemsOver.length > 1) {

            this.$leftItemsOver = $(leftItemsOver.sort(function (a, b) {

                return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
            }));

        } else {

            this.$leftItemsOver = $(leftItemsOver);
        }

        if (rightItemsOver.length > 1) {

            this.$rightItemsOver = $(rightItemsOver.sort(function (a, b) {

                return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
            }));

        } else {

            this.$rightItemsOver = $(rightItemsOver);
        }

        if (!this.$leftItemsOver.length && !this.$rightItemsOver.length && willStartItemRect.left > this._selfRect.left) {

            this.$rightItemsOver = this.$willEndItem;
        }
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

        if (avgSpeed < 12) {

            this.$track
                .removeClass(CLASS.speed2)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed1);

        } else if (avgSpeed < 24) {

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

    Infinitum.prototype._setCurrent = function ($item, defer) {

        if (!$item || !$item[0]) {

            return;
        }

        if ($item[0] !== this.$currentItem[0]) {

            var changeEvent = $.Event({
                type: Infinitum.EVENT.change,
                target: $item[0],
                fromElement: this.$currentItem[0],
                toElement: $item[0]
            });

            this.$self.trigger(changeEvent);

            if (changeEvent.isDefaultPrevented()) {

                return;
            }

            if (defer) {

                this.$currentItem.addClass(CLASS.uncurrent);

            } else {

                this.$currentItem.removeClass(CLASS.current);
            }

            this.$currentItem = $item;

            $item.addClass(CLASS.current);
        }

        var attrLeft = parseFloat($item.attr("data-left")),
            cssLeft = parseFloat($item.css("left"));

        var itemPos = $item[0].getBoundingClientRect().left + (attrLeft - cssLeft) - this._selfRect.left;

        if (!itemPos) {

            return;
        }

        this._moveTrack(-itemPos, true);
    };

    Infinitum.prototype.setCurrent = function ($item) {

        this._setCurrent($item, true);
    };

    Infinitum.prototype.on = function (event, handler) {

        this.$self.on(event, handler);
    };

    Infinitum.prototype.off = function (event, handler) {

        this.$self.on(event, handler);
    };

}(jQuery));
