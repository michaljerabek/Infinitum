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

        item: "infinitum__item",
        current: "infinitum__item--current",
        possibleCurrent: "infinitum__item--possible-current",
        hide: "infinitum__item--hide",
        toEnd: "infinitum__item--to-end",
        toStart: "infinitum__item--to-start",

        track: "infinitum__track",
        moving: "infinitum__track--moving",
        speed0: "infinitum__track--static",
        speed1: "infinitum__track--slow",
        speed2: "infinitum__track--medium",
        speed3: "infinitum__track--fast",

        selector: function (className, not) {

            return (not ? ":not(" : "") + "." + this[className] + (not ? ")" : "");
        }
    };

    var DATA = {
        willLeft: "willLeft",
        willTranslate: "willTranslate",

        fakeTransitionTimeout: "fakeTransitionTimeout"
    };

    var POSITION = {
        START: "start",
        END: "end",
        CENTER: "center"
    };

    var DEFAULTS = {

        /* String - selektor vybírající widget
         * výchozí: ".infinitum"
         */
        selector: CLASS.selector("self"),

        /* String - selektor vybírající posouvací element
         * Není-li nastaven použije se první potomek elementu ze "selector".
         */
        trackSelector: null,

        /* String - selektor vybírající položky
         * Není-li nastaven použijí se potomci elementu z "trackSelector".
         */
        itemSelector: null,

        wheelKeysTapSetCurrent: true, //???

        /* Boolean - přesouvat položky z na konec
         */
        clearLeft: true,

        /* Boolean - přesouvat všechny položky
         */
        breakAll: false,

        /* Infinitum.POSITION - kdy přesunou položky na levé straně
         */
        leftBreak: POSITION.CENTER,

        /* Infinitum.POSITION - kdy přesunou položky na pravé straně
         */
        rightBreak: POSITION.START,

        /* Boolean - přesouvat položky pouze pokud přesahují kraj widgetu
         */
        breakOnEdge: false,

        /* Boolean - při softRefresh (např. při resize) přepsat i pozice položek
         * Pokud se nikdy nemění velikost položek, to není nutné.
         */
        refreshItems: true
    };


    var idCounter = 1;

    var Infinitum = window.Infinitum = function Infinitum(options) {

        this.id = NS + idCounter++;
        this.NS = "." + this.id;

        this.initialized = false;

        this._animate = this._animate.bind(this);

        this._shouldCancelRAF = true;

        this._lastTrackX = 0;

        this.startItemPosWill = 0;
        this.endItemPosWill = 0;

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
        possibleChange: "possiblechange"
    };

    Infinitum.DIR = {
        LEFT: 1,
        RIGHT: 2
    };

    Infinitum.POSITION = POSITION;

    Infinitum.FAKE_TRANSITION_TIMEOUT = 700;

    Infinitum.CAPTURE_WHEEL_TIMEOUT = 300;
    Infinitum.KEY_THROTTLE = 75;
    Infinitum.WHEEL_THROTTLE = 40;

    Infinitum.prototype.init = function (options /*Object?*/) {

        if (this.initialized) {

            return;
        }

        options = options || this.options || {};

        this.options = $.extend({}, DEFAULTS, options);

        this._prepareSelf();

        this._prepareTrack();

        this._prepareItems();

        this._initEvents();

        this.initialized = true;
    };

    Infinitum.prototype.destroy = function () {

        if (!this.initialized) {

            return;
        }

        this._shouldCancelRAF = true;
        cancelAnimationFrame(this._animate);

        this._destroyEvents();

        this.$self.removeClass(CLASS.self);

        this.$track.css(TRANSFORM_PROP, "")
            .css(TRANSITION_PROP + "Duration", "")
            .css("min-height", "")
            .off(this.NS, "")
            .removeClass(CLASS.track)
            .removeClass(CLASS.moving)
            .removeClass(CLASS.speed0)
            .removeClass(CLASS.speed1)
            .removeClass(CLASS.speed2)
            .removeClass(CLASS.speed3)
            .data(DATA.willTranslate + this.NS, undefined);

        this.$items.each(function (i, item) {

            var $this = $t(item);

            clearTimeout($this.data(DATA.fakeTransitionTimeout + this.NS));

            $this.data(DATA.fakeTransitionTimeout + this.NS, undefined)
                .data(DATA.willLeft + this.NS, undefined);

        }.bind(this));

        this.$items.css({
                position: "",
                left: ""
            })
            .off(this.NS)
            .removeClass(CLASS.item)
            .removeClass(CLASS.current)
            .removeClass(CLASS.possibleCurrent)
            .removeClass(CLASS.toEnd)
            .removeClass(CLASS.toStart)
            .removeClass(CLASS.hide);

        this.$self = this.$track = this.$items = this.$currentItem = this.$leftItemsOver = this.$rightItemsOver = this.$insideItems = this._$possibleCurrent = this.$willStartItem = this.$willEndItem = null;

        this.initialized = false;
    };

    Infinitum.prototype.refresh = function (options /*Object?*/, mergeOptions /*Boolean?*/) {

        this.destroy();

        this.init(mergeOptions ? $.extend({}, this.options, options) : options);
    };

    /*
     * Obnoví pouze pozice.
     *
     * items (Boolean) - obnovit i pozice položek
     *     - pokud je refreshItem true, pak je výchozí hodnota true
     */
    Infinitum.prototype.softRefresh = function (items /*Boolean?*/) {

        this.refreshing = true;

        this._generateSelfRect();

        if ((this.options.refreshItems && items !== false) || items) {

            this._prepareItems(true);

            this._setTrackPosition(-parseFloat(this.$currentItem.css("left")));

            //simulováním pohybu (třetí param. fakeMove) se položky zařadí na správné pozice
            this._move(0, false, true);
        }

        this.refreshing = false;
    };

    /*
     * Přenastaví aktivní položku.
     *
     * $item (jQuery) - jQuery objekt s položkou
     */
    Infinitum.prototype.setCurrent = function ($item /*jQuery*/) {

        this._generateSelfRect();

        this._setCurrent($item);
    };

    Infinitum.prototype.on = function (event /*String*/, handler /*Function*/) {

        this.$self.on(event, handler);
    };

    Infinitum.prototype.off = function (event /*String*/) {

        this.$self.off(event);
    };

    /*
     * Aktivní položku nebude možné změnit tapnutím, klávesou ani kolečkem (programaticky ano).
     */
    Infinitum.prototype.freeze = function () {

        this.frozen = true;
    };

    /*
     * Zruší freeze.
     */
    Infinitum.prototype.unfreeze = function () {

        this.frozen = false;
    };

    /*
     * Najde následující položku. Pokud není předána položka $from
     * pokužije se aktivní.
     *
     * $item (jQuery) - jQuery objekt s položkou, od které hledat následující
     *
     * <= (jQuery) - následující položka
     */
    Infinitum.prototype.findNext = function ($from /*jQuery?*/) {

        $from = $from || this.$currentItem;

        var $next = $from.next();

        if (!$next.length) {

            $next = this.$items.first();
        }

        return $next;
    };

    /*
     * Najde předcházející položku. Pokud není předána položka $from
     * pokužije se aktivní.
     *
     * $item (jQuery) - jQuery objekt s položkou, od které hledat předcházející
     *
     * <= (jQuery) - předcházející položka
     */
    Infinitum.prototype.findPrev = function ($from /*jQuery?*/) {

        $from = $from || this.$currentItem;

        var $prev = $from.prev();

        if (!$prev.length) {

            $prev = this.$items.last();
        }

        return $prev;
    };

    /*
     * Zaktivuje následující položku.
     */
    Infinitum.prototype.next = function () {

        this._setCurrent(this.findNext(), false, false, true);
    };

    /*
     * Zaktivuje předcházející položku.
     */
    Infinitum.prototype.prev = function () {

        this._setCurrent(this.findPrev(), false, true, true);
    };

    Infinitum.prototype._prepareSelf = function () {

        this.$self = $(this.options.selector)
            .attr("tabindex", 0)
            .addClass(CLASS.self);

        this._generateSelfRect();
    };

    Infinitum.prototype._generateSelfRect = function () {

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

        this._speed = [7, 7, 7, 7, 7];

        this._setTrackPosition(0, false);
    };

    Infinitum.prototype._prepareItems = function (preserveCurrent) {

        if (!preserveCurrent) {

            this.$currentItem = $();
        }

        this.$items = this.options.itemSelector ? this.$track.find(this.options.itemSelector) : this.$track.children();

        this.$items.addClass(CLASS.item);

        var lastLeft = 0;

        //zařadit položky za sebe a nastavit absolutní pozicování (přejít na transform?)
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

        this._setCurrent(this._findCurrentItem(), true);

        this._$possibleCurrent = this.$currentItem;
    };

    Infinitum.prototype._initEvents = function () {

        this.$self.on("mousedown" + this.NS + " touchstart" + this.NS, this._onPointerStart.bind(this));

        this.$self.on("click" + this.NS, CLASS.selector("item"), function (event) {

            //"kliknutí" enterem
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

        //zachytávat události kolečka, pouze pokud uživatel neposouvá stránku (= allowWheel)
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

    Infinitum.prototype._destroyEvents = function () {

        this.$self.off(this.NS);

        $win.on(this.NS);
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

        this._generateSelfRect();

        this.$self.focus();

        this._hasPointer = true;
        this._pointerIndex = 0;

        if (this._byTouch) {

            this._hasPointer = event.originalEvent.changedTouches[0].identifier;

            this._findTouchPointerIndex(event);
        }

        this._fixVertical = null;

        this.$track.off(TRANSITIONEND + this.NS);
        cancelAnimationFrame(this._animate);
        this._shouldCancelRAF = true;

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

            this._findTouchPointerIndex(event);
        }

        var clientY = getClientValue(event, "y", this._pointerIndex),
            clientX = getClientValue(event, "x", this._pointerIndex),

            diffX = clientX - this._lastClientX;

        //vertikální posun na dotykových zařízeních?
        if (this._byTouch && this._fixVertical === null) {

            this._fixVertical = Math.abs(clientY - this._lastClientY) + 1 > Math.abs(diffX);
        }

        if (this._fixVertical) {

            return;
        }

        this._move(diffX);

        this._lastDir = clientX > this._lastClientX ? Infinitum.DIR.RIGHT : Infinitum.DIR.LEFT;

        this._trackMoved = clientX !== this._lastClientX || this._trackMoved;

        this._lastClientX = clientX;
        this._lastClientY = clientY;

        event.preventDefault();
    };

    Infinitum.prototype._findTouchPointerIndex = function (event) {

        $.each(event.originalEvent.touches, function (i, touch) {

            if (touch.identifier === this._hasPointer) {

                this._pointerIndex = i;
            }

        }.bind(this));
    };

    Infinitum.prototype._onPointerEnd = function (event) {

        this._hasPointer = false;

        if (this._byMouse && event.button !== 0) {

            return;
        }

        $win.off("mousemove" + this.NS);
        this.$self.off("touchmove" + this.NS);

        if (!this._trackMoved && this._fixVertical === null) {

            return this._onTap(event);
        }

        this._setCurrent(this._findCurrentItem(), false, false, false, true);

        this.$track.removeClass(CLASS.moving);

        event.preventDefault();
    };

    Infinitum.prototype._onTap = function (event) {

        var $item = $(event.target).closest(CLASS.selector("item"));

        if ($item.length) {

            var tapEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.tap, event, $item);

            if (tapEvent.isDefaultPrevented()) {

                return;
            }

            if (this.options.wheelKeysTapSetCurrent) {

                this._setCurrent($item, false);

            } else {

                this._moveToItem($item, false);
            }
        }

        return !$item.length;
    };

    Infinitum.prototype._onWheel = function (event) {

        if (this.frozen) {

            return;
        }

        this.$track.off(TRANSITIONEND + this.NS);
        cancelAnimationFrame(this._animate);
        this._shouldCancelRAF = true;

        this._lastDir = (event.originalEvent.detail || event.originalEvent.deltaY || event.originalEvent.deltaX) > 0 ? Infinitum.DIR.LEFT: Infinitum.DIR.RIGHT;

        var $item = this._lastDir === Infinitum.DIR.LEFT ? this.findNext() : this.findPrev();

        var scrollEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.scroll, event, $item);

        if (scrollEvent.isDefaultPrevented()) {

            return;
        }

        this.$self.focus();

        this._generateSelfRect();

        if (this.options.wheelKeysTapSetCurrent) {

            this._setCurrent($item, false, this._lastDir === Infinitum.DIR.RIGHT, true);

        } else {

            this._moveToItem($item, this._lastDir === Infinitum.DIR.RIGHT, true);
        }

        event.preventDefault();
    };

    Infinitum.prototype._onKey = function (event) {

        if (this.frozen) {

            return;
        }

        this.$track.off(TRANSITIONEND + this.NS);
        cancelAnimationFrame(this._animate);
        this._shouldCancelRAF = true;

        this._lastDir = [37, 38].indexOf(event.which) === -1 ? Infinitum.DIR.LEFT: Infinitum.DIR.RIGHT;

        var $item = this._lastDir === Infinitum.DIR.LEFT ? this.findNext() : this.findPrev();

        var keyEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.key, event, $item);

        if (keyEvent.isDefaultPrevented()) {

            return;
        }

        this._generateSelfRect();

        if (this.options.wheelKeysTapSetCurrent) {

            this._setCurrent($item, false, this._lastDir === Infinitum.DIR.RIGHT, true);

        } else {

            this._moveToItem($item, this._lastDir === Infinitum.DIR.RIGHT, true);
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

    Infinitum.prototype._moveTrack = function (x, animate, speedByPointer) {

        var value = /*Math.round*/(getTranslate(this.$track).x) + Math.round(x);

        this._setTrackPosition(value, animate, speedByPointer);
    };

    Infinitum.prototype._setTrackPosition = function (position, animate, speedByPointer) {

        this.$track.css(TRANSITION_PROP, animate ? "" : "none");

        if (animate) {

            this._shouldCancelRAF = false;

            this._setTrackSpeed(position, speedByPointer);

            this.$track.on(TRANSITIONEND + this.NS, function (event) {

                if (event.originalEvent.target !== this.$track[0] || !event.originalEvent.propertyName.match(/transform/i)) {

                    return;
                }

                cancelAnimationFrame(this._animate);

                this._shouldCancelRAF = true;

                this.$track.css(TRANSITION_PROP + "Duration", "")
                    .off(TRANSITIONEND + this.NS);

                this._generateSelfRect();

            }.bind(this));
        }

        this.$track.css(TRANSFORM_PROP, T3D ? "translate3d(" + /*Math.round*/(position) + "px, 0px, 0px)" : "translateX(" + /*Math.round*/(position) + "px)");

        this.$track.data(DATA.willTranslate + this.NS, position);

        if (animate) {

            requestAnimationFrame(this._animate);

            this._lastTrackX = /*Math.round*/(getTranslate(this.$track).x);

        }
    };

    Infinitum.prototype._setTrackSpeed = function (toPosition, usePointer) {

        var fromPosition = getTranslate(this.$track).x,

            diff = Math.abs(fromPosition - toPosition),

            k = 100;

        if (usePointer) {

            var avgSpeed = this._speed.reduce(function (acc, current) {

                return acc + current;

            }, 0) / this._speed.length;

            k = k / Math.max(1, Math.log(avgSpeed / 3));

            k = Math.max(Math.min(k, 150), 50) * 2;
        }

        var speed = (k * Math.max(1, Math.log(diff / 5))).toFixed();

        speed = Math.max(Math.min(speed, 650), 150);

        this.$track.css(TRANSITION_PROP + "Duration", speed  + "ms");
    };

    Infinitum.prototype._setFadeSpeed = function (move, noFade) {

        if (noFade) {

            this.$track
                .removeClass(CLASS.speed1)
                .removeClass(CLASS.speed2)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed0);

            return;
        }

        this._speed = this._speed.slice(0, 4);

        this._speed.unshift(Math.abs(move));

        var avgSpeed = this._speed.reduce(function (acc, current) {

            return acc + current;

        }, 0) / this._speed.length;

        if (avgSpeed < 10) {

            this.$track
                .removeClass(CLASS.speed0)
                .removeClass(CLASS.speed2)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed1);

        } else if (avgSpeed < 20) {

            this.$track
                .removeClass(CLASS.speed0)
                .removeClass(CLASS.speed1)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed2);

        } else {

            this.$track
                .removeClass(CLASS.speed0)
                .removeClass(CLASS.speed1)
                .removeClass(CLASS.speed2)
                .addClass(CLASS.speed3);
        }
    };

    /*
     * Zajišťuje posunutí tracku. Pokud se posouvá pomocí transition,
     * pak se animation nastaví na true, čímž se položky začnou chovat
     * jako kdyby se posouvaly pointerem.
     *
     * fakeMove se používá při resetování, aby se položky správně vyrovnaly.
     * V takovém případě by x mělo být 0 a animation false.
     */
    Infinitum.prototype._move = function (x, animation, fakeMove) {

        this.$track.addClass(CLASS.moving);

        this._setFadeSpeed(x, fakeMove);

        if (!animation) {

            this._moveTrack(x);
        }

        this._sortItems();

        var animationDone = animation && this._shouldCancelRAF,

            animationDoneAndCurrentNotFirst = (animationDone && this.$willStartItem.length && !this.$willStartItem.hasClass(CLASS.current));

        if (x < 0 || animationDoneAndCurrentNotFirst || fakeMove) {

            this._moveLeftItemsOverToTheEnd(animationDoneAndCurrentNotFirst || fakeMove);

        } else if (x > 0) {

            this._moveRightItemsOverToTheStart();
        }

        if (!fakeMove) {

            this._setPossibleCurrentItem(animation && this._shouldCancelRAF);
        }

        if (animation && !this._shouldCancelRAF) {

            requestAnimationFrame(this._animate);

            return;
        }

        if (animationDone) {

            this.$track.removeClass(CLASS.moving);
        }
    };

    /*
     * Najde položky, které přesahují okraje widgetu.
     */
    Infinitum.prototype._sortItems = function () {

        this.startItemPosWill = null;
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

            if (this.startItemPosWill === null || this.startItemPosWill > rect.left + diff) {

                this.startItemPosWill = rect.left + diff;

                willStartItem = item;

                willStartItemRect = {
                    left: rect.left + diff,
                    right: rect.right + diff,
                    width: rect.width
                };
            }

            if (this.endItemPosWill === null || this.endItemPosWill < rect.right + diff) {

                this.endItemPosWill = rect.right + diff;

                willEndItem = item;
            }

            var breakEdge = this._getBreakEdge(rect);

            if (breakEdge.left < this._selfRect.left) {

                leftItemsOver.push(item);

            } else if (breakEdge.right > this._selfRect.right) {

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

        //na kraji je místo, ale na opačné straně poslední element není na kraji -> zalomit (když breakOnEdge === true)
        if (!this.options.breakOnEdge && !this.$leftItemsOver.length && !this.$rightItemsOver.length && willStartItemRect.left > this._selfRect.left) {

            this.$rightItemsOver = this.$willEndItem;
        }
    };

    Infinitum.prototype._getBreakEdge = function (itemRect) {

        var leftBreakEdge = itemRect.left,
            rightBreakEdge = itemRect.right;

        switch (this.options.leftBreak) {

            case Infinitum.POSITION.CENTER:

                leftBreakEdge = leftBreakEdge + (itemRect.width / 2);

                break;

            case Infinitum.POSITION.END:

                leftBreakEdge = leftBreakEdge + itemRect.width - 0.1;

                break;
        }

        switch (this.options.rightBreak) {

            case Infinitum.POSITION.START:

                rightBreakEdge = rightBreakEdge - itemRect.width + 0.1;

                break;

            case Infinitum.POSITION.CENTER:

                rightBreakEdge = rightBreakEdge - (itemRect.width / 2);

                break;
        }

        return {
            left: leftBreakEdge,
            right: rightBreakEdge
        };
    };

    Infinitum.prototype._moveLeftItemsOverToTheEnd = function (animationDoneAndCurrentNotFirst) {

        var _this = this,

            addedWidth = 0; //kolik px už bylo přidáno na konec

        this.$leftItemsOver.each(function () {

            var $this = $t(this),

                width = Math.round($this.outerWidth());

            if (!_this.options.breakAll) {

                //nepřidávat na konec položky, které by byly až za pravým okrajem
                if (!_this.options.clearLeft && _this.endItemPosWill + addedWidth >= _this._selfRect.right) {

                    return;
                }
            }

            if (animationDoneAndCurrentNotFirst && ($this.hasClass(CLASS.current) || !_this.options.clearLeft)) {

                return;
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toStart) || animationDoneAndCurrentNotFirst) {

                addedWidth += width;

                _this._breakItem($(this), "end");
            }
        });

        if (this._shouldCancelRAF) {

            this._clearHideStates("start");
        }
    };

    Infinitum.prototype._moveRightItemsOverToTheStart = function () {

        var _this = this,

            addedWidth = 0; //kolik px už bylo přidáno na začátek

        this.$rightItemsOver.each(function () {

            var $this = $t(this),

                width = Math.round($this.outerWidth());

            if (!_this.options.breakAll) {

                //nepřidávat na začátek položky, které byly až za levým okrajem
                if (_this.startItemPosWill - addedWidth <= _this._selfRect.left) {

                    return;
                }
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toEnd)) {

                addedWidth += width;

                _this._breakItem($(this), "start");
            }
        });

        if (this._shouldCancelRAF) {

            this._clearHideStates("end");
        }
    };

    Infinitum.prototype._breakItem = function ($item, toPosition) {

        //odstranit předchozí přesunutí
        $item.off(TRANSITIONEND + this.NS);

        var lastFakeTransition = $item.data(DATA.fakeTransitionTimeout + this.NS);

        if (lastFakeTransition) {

            clearTimeout(lastFakeTransition);
        }

        var $sibling = toPosition === "start" ? this.findNext($item) : this.findPrev($item),

            width = toPosition === "start" ? Math.round($item.outerWidth()) : -Math.round($sibling.outerWidth());

        var opacity = $item.css("opacity");

        $item.addClass(toPosition === "start" ? CLASS.toStart : CLASS.toEnd)
            .removeClass(toPosition === "start" ? CLASS.toEnd : CLASS.toStart)
            .removeClass(CLASS.hide);

        //konečná hodnota (kam bude po zmizení položka přesunuta) - pro případy, kdy se potřebujeme tváři, jako by byla položka už na daném místě
        $item.data(DATA.willLeft + this.NS, parseFloat($sibling.data(DATA.willLeft + this.NS)) - width);

        var fakeTransitionEnd,

            onTransitionend = function (event) {

                if (event && event.originalEvent.target !== $item[0] && event.originalEvent.propertyName !== "opacity") {

                    return;
                }

                clearTimeout(fakeTransitionEnd);

                $item.css({
                    left: parseFloat($item.data(DATA.willLeft + this.NS))
                });

                $item.data(DATA.fakeTransitionTimeout + this.NS, null);

                $item.removeClass(CLASS.hide)
                    .removeClass(toPosition === "start" ? CLASS.toStart : CLASS.toEnd);

                $item.off(TRANSITIONEND + this.NS);
            }.bind(this);

        if (!parseFloat(opacity)) {

            onTransitionend();

        } else {

            fakeTransitionEnd = setTimeout(onTransitionend, Infinitum.FAKE_TRANSITION_TIMEOUT);

            $item.data(DATA.fakeTransitionTimeout + this.NS, fakeTransitionEnd);

            $item.on(TRANSITIONEND + this.NS, onTransitionend);

            $item.addClass(CLASS.hide);
        }
    };

    /*
     * Odstraňuje nastavení pro přesunutí položek, pokud se změní směr pohybu.
     */
    Infinitum.prototype._clearHideStates = function (position) {

        var _this = this;

        (position === "end" ? this.$rightItemsOver : this.$leftItemsOver).each(function () {

            var $this = $t(this);

            if (position === "end" ? $this.hasClass(CLASS.toStart) : $this.hasClass(CLASS.toEnd)) {

                return;
            }

            $this.off(TRANSITIONEND + _this.NS);

            clearTimeout($this.data(DATA.fakeTransitionTimeout + _this.NS));
            $this.data(DATA.fakeTransitionTimeout + _this.NS, null);

            $this.removeClass(CLASS.hide)
                .removeClass(position === "end" ? $this.hasClass(CLASS.toEnd) : $this.hasClass(CLASS.toStart));

            $this.data(DATA.willLeft + _this.NS, parseFloat($this.css("left")));
        });
    };

    Infinitum.prototype._animate = function () {

        this._move(/*Math.round*/(getTranslate(this.$track).x) - this._lastTrackX, true);
    };

    /*
     * isImmediateSibling - pokud je položka hned vedle aktivní (při posouvání se pak použije jiná metoda) - při scroll, key, next, prev
     */
    Infinitum.prototype._setCurrent = function ($item, noTrackMove, reverse, isImmediateSibling, speedByPointer) {

        if (!$item || !$item[0]) {

            return;
        }

        if ($item[0] !== this.$currentItem[0]) {

            var changeEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.change, null, $item);

            if (changeEvent.isDefaultPrevented()) {

                if (!noTrackMove) {

                    this._moveToItem(this.$currentItem, false, isImmediateSibling, speedByPointer);
                }

                return;
            }

            this.$currentItem.removeClass(CLASS.current);

            this.$currentItem = $item;

            $item.addClass(CLASS.current);
        }

        if (noTrackMove) {

            return;
        }

        this._moveToItem($item, reverse, isImmediateSibling, speedByPointer);
    };

    /*
     * oneItemMode - posouvá se pouze na položku hned vedle aktivní
     */
    Infinitum.prototype._moveToItem = function ($item, reverse, oneItemMode, speedByPointer) {

        var attrLeft = parseFloat($item.data(DATA.willLeft + this.NS)),
            cssLeft = parseFloat($item.css("left")),

            rect = this._getRect($item[0]),

            willTranslate;

        if (!reverse) {

            if (oneItemMode) {
                //přesouvá se pouze na vedlejší položku, takže nepotřebujeme přesnou pozici,
                //pokud by se použila, tak by při rychlé sekvenci posouvání mohlo dojít ke skoku opačným směrem

                willTranslate = this.$track.data(DATA.willTranslate + this.NS);

                var $prev = this.findPrev($item),

                    prevWidth = Math.round($prev.outerWidth());

                this._setTrackPosition(willTranslate - prevWidth, true, speedByPointer);

                return;
            }

            var itemPos = rect.left + (attrLeft - cssLeft) - this._selfRect.left;

            if (!itemPos) {

                return;
            }

            this._moveTrack(-itemPos, true, speedByPointer);

        } else {

            willTranslate = this.$track.data(DATA.willTranslate + this.NS);

            this._setTrackPosition(willTranslate + rect.width, true, speedByPointer);
        }
    };

    /*
     * clear - odstranit possibleCurrent stav (konec přesouvání)
     */
    Infinitum.prototype._setPossibleCurrentItem = function (clear) {

        if (clear) {

            this._$possibleCurrent.removeClass(CLASS.possibleCurrent);

            this._setCurrent(this._$possibleCurrent);

            return;
        }

        var $possible = this._findCurrentItem();

        if ($possible[0] !== this._$possibleCurrent[0]) {

            $possible.addClass(CLASS.possibleCurrent);

            this._$possibleCurrent.removeClass(CLASS.possibleCurrent);

            this._triggerChangeTypeEvent(Infinitum.EVENT.possibleChange, null, $possible);

            this._$possibleCurrent = $possible;
        }
    };

    Infinitum.prototype._findCurrentItem = function () {

        if (this._lastDir === Infinitum.DIR.LEFT || !this.options.clearLeft || this.options.breakAll) {

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

            if (closestLeftItemPos === null || Math.abs(willLeft - this._selfRect.left) < closestLeftItemPos) {

                closestLeftItemPos = Math.abs(willLeft - this._selfRect.left);

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
