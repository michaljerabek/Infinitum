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

    getClientValue = function (event, direction, pointerIndex) {

        pointerIndex = pointerIndex || 0;

        var prop = "client" + direction.toUpperCase();

        event = event.originalEvent || event;

        return typeof event[prop] === "number" ? event[prop] : event.touches[pointerIndex] ? event.touches[pointerIndex][prop] : 0;
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
        willLeft: "willLeft",

        fakeTransitionTimeout: "fakeTransitionTimeout"
    };

    var DEFAULTS = {
        selector: CLASS.selector("self"),
        trackSelector: null,
        itemSelector: null,

        clearLeft: true,

        live: true,
        animateLive: true,

        refreshItems: true
    };


    var idCounter = 1;

    var Infinitum = window.Infinitum = function Infinitum(options) {

        this.id = NS + idCounter++;
        this.NS = "." + this.id;

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
        key: "key",
        scroll: "scroll",
        change: "change",
        willChange: "willchange"
    };

    Infinitum.DIR = {
        LEFT: 1,
        RIGHT: 2
    };

    Infinitum.FAKE_TRANSITION_TIMEOUT = 700;

    Infinitum.CAPTURE_WHEEL_TIMEOUT = 300;
    Infinitum.KEY_THROTTLE = 75;
    Infinitum.WHEEL_THROTTLE = 30;

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

    Infinitum.prototype.softRefresh = function (items) {

        this.refreshing = true;

        this._prepareSelf(true);

        if ((this.options.refreshItems && items !== false) || items) {

            this._prepareItems(true);

            this._setTrackPosition(-parseFloat(this.$currentItem.css("left")));

            this._move(0, false, true);
        }

        this.refreshing = false;
    };

    Infinitum.prototype.setCurrent = function ($item) {

        this._prepareSelf(true);

        this._setCurrent($item, false, true);
    };

    Infinitum.prototype.on = function (event, handler) {

        this.$self.on(event, handler);
    };

    Infinitum.prototype.off = function (event, handler) {

        this.$self.off(event, handler);
    };

    Infinitum.prototype.freeze = function () {

        this.frozen = true;
    };

    Infinitum.prototype.unfreeze = function () {

        this.frozen = false;
    };

    Infinitum.prototype.findNext = function ($from) {

        $from = $from || this.$currentItem;

        var $next = $from.next();

        if (!$next.length) {

            $next = this.$items.first();
        }

        return $next;
    };

    Infinitum.prototype.findPrev = function ($from) {

        $from = $from || this.$currentItem;

        var $prev = $from.prev();

        if (!$prev.length) {

            $prev = this.$items.last();
        }

        return $prev;
    };

    Infinitum.prototype.next = function () {

        this._setCurrent(this.findNext(), false, true);
    };

    Infinitum.prototype.prev = function () {

        this._setCurrent(this.findPrev(), false, true);
    };

    Infinitum.prototype._prepareSelf = function (onlyRect) {

        if (!onlyRect) {

            this.$self = $(this.options.selector)
                .attr("tabindex", 0)
                .addClass(CLASS.self);
        }

        this._selfRect = {};
        this._origSelfRect = this.$self[0].getBoundingClientRect();

        var box = this.$self.css(["padding-left", "padding-right", "border-left-width", "border-right-width"]);

        this._selfRect.left = Math.round(this._origSelfRect.left) + parseFloat(box["padding-left"]) + parseFloat(box["border-left-width"]);
        this._selfRect.right = Math.round(this._origSelfRect.right) - parseFloat(box["padding-right"]) - parseFloat(box["border-right-width"]);
    };

    Infinitum.prototype._prepareTrack = function () {

        this.$track = this.options.trackSelector ? $(this.options.trackSelector) : this.$self.children().first();

        this.$track
            .addClass(CLASS.track)
            .css({
            minHeight: this.$track.css("height")
        });

        this._setTrackPosition(0, false);
    };

    Infinitum.prototype._prepareItems = function (preserveCurrent) {

        this.$items = this.options.itemSelector ? this.$track.find(this.options.itemSelector) : this.$track.children();

        this.$items.addClass(CLASS.item);

        var lastLeft = 0;

        this.$items.each(function (i, item) {

            var $this = $t(item);

            $this.css({
                position: "absolute",
                left: lastLeft
            });

            $this.data(DATA.willLeft + this.NS, lastLeft);

            lastLeft += Math.round($this.outerWidth());

        }.bind(this));

        this._sortItems();

        if (preserveCurrent) {

            return;
        }

        this._setCurrent(this._findCurrentItem(), true, false);
    };

    Infinitum.prototype._initEvents = function () {

        this.$self.on("mousedown" + this.NS + " touchstart" + this.NS, this._onPointerStart.bind(this));

        this.$self.on("click" + this.NS, CLASS.selector("item"), function (event) {

            if (!this._byMouse && !this._byTouch && !this.frozen) {

                this._onPointerEnd(event);
            }

            this._byMouse = false;

            event.preventDefault();

        }.bind(this));

        var keydownThrottle = null;

        this.$self.on("keydown" + this.NS, function (event) {

            if (this.frozen || keydownThrottle || [37, 38, 39, 40].indexOf(event.which) === -1) {

                return;
            }

            keydownThrottle = true;

            setTimeout(function() { keydownThrottle = false; }, Infinitum.KEY_THROTTLE);

            this._onKey(event);

        }.bind(this));

        var scrollDebounce = null,
            allowWheel = true;

        $win.on("scroll" + this.NS, function (event) {

            if (this.frozen || event.target !== document) {

                return;
            }

            allowWheel = false;

            clearTimeout(scrollDebounce);

            scrollDebounce = setTimeout(function() { allowWheel = true; }, Infinitum.CAPTURE_WHEEL_TIMEOUT);

        }.bind(this));

        var wheelThrottle = null;

        this.$self.on("mousewheel" + this.NS + " DOMMouseScroll" + this.NS, function (event) {

            if (!allowWheel || this.frozen) {

                return;
            }

            if (wheelThrottle) {

                event.preventDefault();

                return;
            }

            wheelThrottle = true;

            setTimeout(function() { wheelThrottle = false; }, Infinitum.WHEEL_THROTTLE);

            this._onWheel(event);

        }.bind(this));

        var resizeDebounce = null,

            lastDocHeight = document.documentElement.clientHeight,
            lastDocWidth = document.documentElement.clientWidth;

        $win.on("resize" + this.NS, function () {

            if (lastDocWidth !== document.documentElement.clientWidth || lastDocHeight !== document.documentElement.clientHeight) {

                clearTimeout(resizeDebounce);

                resizeDebounce = setTimeout(this.softRefresh.bind(this), 50);

                lastDocHeight = document.documentElement.clientHeight;
                lastDocWidth = document.documentElement.clientWidth;
            }

        }.bind(this));
    };

    Infinitum.prototype._onPointerStart = function (event) {

        if (this.frozen) {

            return;
        }

        this._byMouse = !!event.type.match(/mouse/);
        this._byTouch = !!event.type.match(/touch/);

        if (this._hasPointer || (this._byMouse && event.button !== 0)) {

            event.preventDefault();

            return;
        }

        this._prepareSelf(true);

        this.$self.focus();

        this._hasPointer = true;
        this._pointerIndex = 0;

        if (this._byTouch) {

            this._hasPointer = event.originalEvent.changedTouches[0].identifier;

            $.each(event.originalEvent.touches, function (i, touch) {

                if (touch.identifier === this._hasPointer) {

                    this._pointerIndex = i;
                }

            }.bind(this));
        }

        this._fixVertical = null;

        this.$track.off(TRANSITIONEND + this.NS);
        cancelAnimationFrame(this._animate);
        this._shouldCancelRAF = true;

        this._setTrackPosition(Math.round(getTranslate(this.$track).x));
        this.$track.css(TRANSITION_PROP, "none");

        this._lastClientY = getClientValue(event, "y", this._pointerIndex);
        this._lastClientX = getClientValue(event, "x", this._pointerIndex);

        this._trackMoved = false;

        $win.on("mousemove" + this.NS, this._onPointerMove.bind(this));

        $win.one("mouseup" + this.NS, this._onPointerEnd.bind(this));

        this.$self.on("touchmove" + this.NS, this._onPointerMove.bind(this));

        this.$self.one("touchend" + this.NS, this._onPointerEnd.bind(this));

        if (!this._byTouch) {

            event.preventDefault();
        }
    };

    Infinitum.prototype._onPointerMove = function (event) {

        if (!this._hasPointer) {

            event.preventDefault();

            return;
        }

        if (event.type.match(/touch/)) {

            $.each(event.originalEvent.touches, function (i, touch) {

                if (touch.identifier === this._hasPointer) {

                    this._pointerIndex = i;
                }

            }.bind(this));
        }

        var clientY = getClientValue(event, "y", this._pointerIndex),
            clientX = getClientValue(event, "x", this._pointerIndex);

        if (this._byTouch && this._fixVertical === null) {

            this._fixVertical = Math.abs(clientY - this._lastClientY) + 1 > Math.abs(clientX - this._lastClientX);
        }

        if (this._fixVertical) {

            return;
        }

        this._move(clientX - this._lastClientX);

        this._lastDir = clientX > this._lastClientX ? Infinitum.DIR.RIGHT : Infinitum.DIR.LEFT;

        this._trackMoved = clientX !== this._lastClientX || this._trackMoved;

        this._lastClientX = clientX;
        this._lastClientY = clientY;

        event.preventDefault();
    };

    Infinitum.prototype._onPointerEnd = function (event) {

        this._hasPointer = false;

        if (this._byMouse && event.button !== 0) {

            return;
        }

        $win.off("mousemove" + this.NS);
        this.$self.off("touchmove" + this.NS);

        if (!this._trackMoved && this._fixVertical === null) {

            var $item = $(event.target).closest(CLASS.selector("item"));

            if ($item.length) {

                var tapEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.tap, event, $item);

                if (tapEvent.isDefaultPrevented()) {

                    return;
                }

                this._setCurrent($item, false, true);
            }

            return !$item.length;
        }

        this.setCurrent(this._findCurrentItem());

        event.preventDefault();
    };

    Infinitum.prototype._onWheel = function (event) {

        this._lastDir = (event.originalEvent.detail || event.originalEvent.deltaY || event.originalEvent.deltaX) > 0 ? Infinitum.DIR.LEFT: Infinitum.DIR.RIGHT;

        var $item = this._lastDir === Infinitum.DIR.LEFT ? this.findNext() : this.findPrev();

        var scrollEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.scroll, event, $item);

        if (scrollEvent.isDefaultPrevented()) {

            return;
        }

        this._prepareSelf(true);

        if (this.options.animateLive) {

            this._moveToItem($item);

        } else {

            this._setCurrent($item);
        }

        event.preventDefault();
    };

    Infinitum.prototype._onKey = function (event) {

        this._lastDir = [37, 38].indexOf(event.which) === -1 ? Infinitum.DIR.LEFT: Infinitum.DIR.RIGHT;

        var $item = this._lastDir === Infinitum.DIR.LEFT ? this.findNext() : this.findPrev();

        var keyEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.key, event, $item);

        if (keyEvent.isDefaultPrevented()) {

            return;
        }

        this._prepareSelf(true);

        if (this.options.animateLive) {

            this._moveToItem($item);

        } else {

            this._setCurrent($item);
        }

        event.preventDefault();
    };

    Infinitum.prototype._triggerChangeTypeEvent = function (type, event, $toItem, moreData) {

        var eventObj = $.extend({}, $.Event(), {
            type: type,
            target: $toItem[0],
            fromElement: this.$currentItem[0],
            toElement: $toItem[0],
            originalEvent: event ? event.originalEvent : null
        }, moreData || null);

        this.$self.trigger(eventObj);

        return eventObj;
    };

    Infinitum.prototype._moveTrack = function (x, animate) {

        var value = Math.round(getTranslate(this.$track).x) + Math.round(x);

        this._setTrackPosition(value, animate);
    };

    Infinitum.prototype._setTrackPosition = function (position, animate) {

        this.$track.css(TRANSITION_PROP, animate ? "" : "none");

        if (animate) {

            this._shouldCancelRAF = false;

            if (typeof animate === "number") {

                this.$track.css(TRANSITION_PROP + "Duration", animate + "ms");
            }

            this.$track.on(TRANSITIONEND + this.NS, function (event) {

                if (event.originalEvent.target !== this.$track[0] || !event.originalEvent.propertyName.match(/transform/i)) {

                    return;
                }

                cancelAnimationFrame(this._animate);

                this._shouldCancelRAF = true;

                this.$track.css(TRANSITION_PROP + "Duration", "");
                this.$track.off(TRANSITIONEND + this.NS);

                this._prepareSelf(true);

            }.bind(this));
        }

        this.$track.css(TRANSFORM_PROP, T3D ? "translate3d(" + Math.round(position) + "px, 0px, 0px)" : "translateX(" + Math.round(position) + "px)");

        if (animate) {

            requestAnimationFrame(this._animate);

            this._lastTrackX = Math.round(getTranslate(this.$track).x);

        }
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

    Infinitum.prototype._move = function (x, animation, fakeMove) {

        this._setSpeed(x);

        if (!animation) {

            this._moveTrack(x);
        }

        this._sortItems();

        var animationDoneAndCurrentNotFirst = (animation && this._shouldCancelRAF && this.$willStartItem.length && !this.$willStartItem.hasClass(CLASS.current));

        if (x < 0 || animationDoneAndCurrentNotFirst || fakeMove) {

            this._moveLeftItemsOverToTheEnd(animationDoneAndCurrentNotFirst || fakeMove);

        } else if (x > 0) {

            this._moveRightItemsOverToTheStart();
        }

        if ((this.options.live && (this.options.animateLive || !animation)) && !fakeMove) {

            this._setCurrent(this._findCurrentItem(), true);
        }

        if (animation && !this._shouldCancelRAF) {

            requestAnimationFrame(this._animate);
        }
    };

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

            var $this = $t(item),

                rect = this._getRect(item),

                attrLeft = parseFloat($this.data(DATA.willLeft + this.NS)),
                cssLeft = parseFloat($this.css("left")),

                diff = attrLeft - cssLeft;

            if (this.startItemPosWll === null || this.startItemPosWll > rect.left + diff) {

                this.startItemPosWll = rect.left + diff;

                willStartItem = item;

                willStartItemRect = {
                    left: rect.left + diff
                };
            }

            if (this.endItemPosWill === null || this.endItemPosWill < rect.right + diff) {

                this.endItemPosWill = rect.right + diff;

                willEndItem = item;
            }

            if (rect.left + (rect.width / 2) < this._selfRect.left) {

                leftItemsOver.push(item);

            } else if (rect.right > this._selfRect.right) {

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

    Infinitum.prototype._moveLeftItemsOverToTheEnd = function (animationDoneAndCurrentNotFirst) {

        var _this = this,

            addedWidth = 0;

        this.$leftItemsOver.each(function () {

            var $this = $(this),

                width = Math.round($this.outerWidth());

            if (!_this.options.clearLeft && _this.endItemPosWill + addedWidth >= _this._selfRect.right/* + (width / 2)*/) {

                return;
            }

            if (animationDoneAndCurrentNotFirst && $this.hasClass(CLASS.current)) {

                return;
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toStart) || animationDoneAndCurrentNotFirst) {

                $this.off(TRANSITIONEND + _this.NS);

                var lastFakeTransition = $this.data(DATA.fakeTransitionTimeout + _this.NS);

                if (lastFakeTransition) {

                    clearTimeout(lastFakeTransition);
                }

                var $prev = _this.findPrev($this);

                addedWidth += width;

                var opacity = $this.css("opacity");

                $this.addClass(CLASS.toEnd)
                    .removeClass(CLASS.toStart)
                    .removeClass(CLASS.hide);

                $this.data(DATA.willLeft + _this.NS, parseFloat($prev.data(DATA.willLeft + _this.NS)) + Math.round($prev.outerWidth()));

                var fakeTransitionEnd,

                    onTransitionend = function (event) {

                        if (event && event.originalEvent.target !== $this[0] && event.originalEvent.propertyName !== "opacity") {

                            return;
                        }

                        clearTimeout(fakeTransitionEnd);

                        $this.css({
                            left: parseFloat($this.data(DATA.willLeft + _this.NS))
                        });

                        $this.data(DATA.fakeTransitionTimeout + _this.NS, null);

                        $this.removeClass(CLASS.hide)
                            .removeClass(CLASS.toEnd);

                        $this.off(TRANSITIONEND + _this.NS);
                    };

                if (!parseFloat(opacity)) {

                    onTransitionend();

                } else {

                    fakeTransitionEnd = setTimeout(onTransitionend, Infinitum.FAKE_TRANSITION_TIMEOUT);

                    $this.data(DATA.fakeTransitionTimeout + _this.NS, fakeTransitionEnd);

                    $this.on(TRANSITIONEND + _this.NS, onTransitionend);

                    $this.addClass(CLASS.hide);
                }
            }
        });

        if (this._shouldCancelRAF) {

            this.$leftItemsOver.each(function () {

                var $this = $t(this);

                if ($this.hasClass(CLASS.toEnd)) {

                    return;
                }

                $this.off(TRANSITIONEND + _this.NS);

                clearTimeout($this.data(DATA.fakeTransitionTimeout + _this.NS));
                $this.data(DATA.fakeTransitionTimeout + _this.NS, null);

                $this.removeClass(CLASS.hide)
                    .removeClass(CLASS.toStart);

                $this.data(DATA.willLeft + _this.NS, parseFloat($this.css("left")));
            });
        }

    };

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

                $this.off(TRANSITIONEND + _this.NS);

                var lastFakeTransition = $this.data(DATA.fakeTransitionTimeout + _this.NS);

                if (lastFakeTransition) {

                    clearTimeout(lastFakeTransition);
                }

                var $next = _this.findNext($this);

                addedWidth += width;

                var opacity = $this.css("opacity");

                $this.addClass(CLASS.toStart)
                    .removeClass(CLASS.toEnd)
                    .removeClass(CLASS.hide);

                $this.data(DATA.willLeft + _this.NS, parseFloat($next.data(DATA.willLeft + _this.NS)) - width);

                var fakeTransitionEnd,

                    onTransitionend = function (event) {

                        if (event && event.originalEvent.target !== $this[0] && event.originalEvent.propertyName !== "opacity") {

                            return;
                        }

                        clearTimeout(fakeTransitionEnd);

                        $this.css({
                            left: parseFloat($this.data(DATA.willLeft + _this.NS))
                        });

                        $this.data(DATA.fakeTransitionTimeout + _this.NS, null);

                        $this.removeClass(CLASS.hide)
                            .removeClass(CLASS.toStart);

                        $this.off(TRANSITIONEND + _this.NS);
                    };

                if (!parseFloat(opacity)) {

                    onTransitionend();

                } else {

                    fakeTransitionEnd = setTimeout(onTransitionend, Infinitum.FAKE_TRANSITION_TIMEOUT);

                    $this.data(DATA.fakeTransitionTimeout + _this.NS, fakeTransitionEnd);

                    $this.on(TRANSITIONEND + _this.NS, onTransitionend);

                    $this.addClass(CLASS.hide);
                }
            }
        });


        if (this._shouldCancelRAF) {

            this.$rightItemsOver.each(function () {

                var $this = $t(this);

                if ($this.hasClass(CLASS.toStart)) {

                    return;
                }

                $this.off(TRANSITIONEND + _this.NS);

                clearTimeout($this.data(DATA.fakeTransitionTimeout + _this.NS));
                $this.data(DATA.fakeTransitionTimeout + _this.NS, null);

                $this.removeClass(CLASS.hide)
                    .removeClass(CLASS.toEnd);

                $this.data(DATA.willLeft + _this.NS, parseFloat($this.css("left")));
            });
        }
    };

    Infinitum.prototype._animate = function () {

        this._move(Math.round(getTranslate(this.$track).x) - this._lastTrackX, true);
    };

    Infinitum.prototype._setCurrent = function ($item, noTrackMove, autoOnLive) {

        if (!$item || !$item[0]) {

            return;
        }

        if ($item[0] !== this.$currentItem[0]) {

            if (!autoOnLive || !this.options.live || !this.options.animateLive) {

                var changeEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.change, null, $item);

                if (changeEvent.isDefaultPrevented()) {

                    if (!noTrackMove) {

                        this._moveToItem(this.$currentItem);
                    }

                    return;
                }

                this.$currentItem.removeClass(CLASS.current);

                this.$currentItem = $item;

                $item.addClass(CLASS.current);

            } else {

                var willChangeEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.willChange, null, $item);

                if (willChangeEvent.isDefaultPrevented()) {

                    if (!noTrackMove) {

                        this._moveToItem(this.$currentItem);
                    }

                    return;
                }
            }
        }

        if (noTrackMove) {

            return;
        }

        this._moveToItem($item);
    };

    Infinitum.prototype._moveToItem = function ($item) {

        var attrLeft = parseFloat($item.data(DATA.willLeft + this.NS)),
            cssLeft = parseFloat($item.css("left")),

            itemPos = this._getRect($item[0]).left + (attrLeft - cssLeft) - this._selfRect.left;

        if (!itemPos) {

            return;
        }

        this._moveTrack(-itemPos, true);
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

            var $this = $t(item),

                attrLeft = parseFloat($this.data(DATA.willLeft + this.NS)),
                cssLeft = parseFloat($this.css("left")),

                willLeft = item.getBoundingClientRect().left + (attrLeft - cssLeft);

            if (closestLeftItemPos === null || Math.abs(closestLeftItemPos) > Math.abs(willLeft - this._selfRect.left)) {

                closestLeftItemPos = willLeft - this._selfRect.left;

                closestLeftItem = item;
            }
        }.bind(this));

        return $(closestLeftItem);
    };

    Infinitum.prototype._getRect = function (element) {

        var rect = element.getBoundingClientRect();

        return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    };

}(jQuery));
