/*jslint indent: 4, white: true, unparam: true, node: true, browser: true, devel: true, nomen: true, plusplus: true, regexp: true, sloppy: true, vars: true*/
/*global jQuery, requestAnimationFrame, cancelAnimationFrame, HTMLElement*/

(function ($) {

    //https://gist.github.com/paulirish/1579671
    (function() {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                || window[vendors[x]+'CancelRequestAnimationFrame'];
        }

        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function(callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                                           timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };

        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
    }());

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

    getRect = function (element) {

            return (element instanceof HTMLElement ? element : element[0]).getBoundingClientRect();
    },

    $t = (function() {

        var $temp = $([null]);

        return function (element) {

            $temp[0] = element;

            return $temp;
        };
    }()),

    $win = $(window);

    var NS = "Infinitum",

        PROJECT_URL = "https://github.com/michaljerabek/infinitum";

    var CLASS = {
        self: "infinitum",
        disabled: "infinitum--disabled",
        start: "infinitum--start",
        end: "infinitum--end",
        center: "infinitum--center",
        debug: "infinitum--debug",

        item: "infinitum__item",
        current: "infinitum__item--current",
        possibleCurrent: "infinitum__item--possible-current",
        hide: "infinitum__item--hide",
        toEnd: "infinitum__item--to-end",
        toStart: "infinitum__item--to-start",

        track: "infinitum__track",
        dragging: "infinitum__track--dragging",
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
        translate: "translate",
        offset: "offset",

        fakeTransitionTimeout: "fakeTransitionTimeout",

        url: "infinitum-url"
    };

    var POSITION = {
        START: "start",
        END: "end",
        CENTER: "center"
    };

    var CURRENT = {
        CLOSEST: "closest",
        STILL_INSIDE: "still-inside",
        FULL: "full"
    };

    var DEFAULTS = {

        /* String - selektor vybírající widget
         * výchozí: ".infinitum"
         */
        selector: CLASS.selector("self"),

        /* HTMLElement | jQuery - element widgetu (má přednost před "selector")
         */
        el: null,

        /* String - selektor vybírající posouvací element
         * Není-li nastaven použije se první potomek elementu ze "selector" / "el".
         */
        trackSelector: null,

        /* String - selektor vybírající položky
         * Není-li nastaven použijí se potomci elementu z "trackSelector".
         */
        itemSelector: null,


        /* Boolean - obrátit pořadí položek (přerovná elementy)
         */
        reverseItems: false,


        /* Infinitum.POSITION - Zarovnání aktivní (current) položky
         *     - .CENTER | .START | .END
         */
        mode: POSITION.START,


        wheelKeysTapSetCurrent: true, //???


        /* Boolean | Infinitum.POSITION - používat fade efekt
         *     - .START | .END
         */
        fade: true,


        /* Infinitum.CURRENT - kterou položku považovat za výchozí ve směru (výchozí je vlevo - pousouvání do leva)
         *     - .CLOSEST - nejbližší (podle mode)
         *     - .STILL_INSIDE - jakákliv část je uvnitř (podle mode)
         *     - .FULL - celá položka je uvnitř (podle mode)
         * pokud je mode: Infinitum.POSITION.CENTER, výchozí je Infinitum.CURRENT.CLOSEST
         * a ostatní hodnoty znamenají, že current je položka, ve které se nachází střed
         */
        currentIn: CURRENT.CLOSEST,

        /* Infinitum.CURRENT - kterou položku považovat za výchozí v protisměru  (výchozí je vpravo - pousouvání do prava)
         *     - .CLOSEST - nejbližší (podle mode)
         *     - .STILL_INSIDE - jakákliv část je uvnitř (podle mode)
         *     - .FULL - celá položka je uvnitř (podle mode)
         * pokud je mode: Infinitum.POSITION.CENTER, výchozí je Infinitum.CURRENT.CLOSEST
         * a ostatní hodnoty znamenají, že current je položka, ve které se nachází střed
         */
        currentOut: CURRENT.STILL_INSIDE,


        /* Boolean - přesouvat položky z na konec
         */
        clearEdge: true,

        /* Boolean - přesouvat všechny položky
         */
        breakAll: false, //BUGGY!

        /* Infinitum.POSITION - kdy přesunou položky na levé straně
         * pokud je fade false, výchozí je Infinitum.POSITION.END
         * pokud je mode Infinitum.POSITION.END, výchozí je Infinitum.POSITION.END
         *     - .CENTER | .START | .END
         */
        startBreak: POSITION.CENTER,

        /* Infinitum.POSITION - kdy přesunou položky na pravé straně
         * pokud je fade false, výchozí je Infinitum.POSITION.START
         * pokud je mode Infinitum.POSITION.END, výchozí je Infinitum.POSITION.CENTER
         *     - .CENTER | .START | .END
         */
        endBreak: POSITION.END,

        /* Boolean - přesouvat položky pouze pokud přesahují kraj widgetu
         */
        breakOnEdge: false,

        /* Boolean - vyvažovat přesahující položky
         * pokud je mode Infinitum.POSITION.CENTER, výchozí je true
         */
        balanced: false,

        /* Boolean - při softRefresh (např. při resize) přepsat i pozice položek
         * Pokud se nikdy nemění velikost položek, to není nutné.
         */
        refreshItems: true,

        /* Number - throttling ovládání klávesami
         */
        keyThrottle: 75,

        /* Number - throttling ovládání kolečkem
         */
        wheelThrottle: 40,

        debug: false
    };


    $.easing["easeOutQuad." + NS] = function (x) {
        return 1 - ( 1 - x ) * ( 1 - x );
    };


    var hasPointer = [],

        instances = [],

        idCounter = 1,

        scrollDebounce = null,
        allowWheel = true;

    var Infinitum = window.Infinitum = function Infinitum(options) {

        instances.push(this);

        this.id = NS + idCounter++;
        this.NS = "." + this.id;

        this.initialized = false;

        this._animate = this._animate.bind(this);

        this._shouldCancelRAF = true;

        this._lastTrackX = 0;

        this._lastFadeSpeed = -1;

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

    Infinitum.EVENT = {
        tap: "tap",
        key: "key",
        scroll: "scroll",
        dragging: "dragging",
        dragend: "dragend",
        change: "change",
        possibleChange: "possiblechange"
    };

    Infinitum.DIR = {
        LEFT: 1,
        RIGHT: 2
    };

    Infinitum.DEFAULTS = DEFAULTS;
    Infinitum.POSITION = POSITION;
    Infinitum.CURRENT = CURRENT;

    Infinitum.FAKE_TRANSITION_TIMEOUT = 700;

    Infinitum.CAPTURE_WHEEL_TIMEOUT = 350;

    Infinitum.prototype.init = function (options /*Object?*/, destroy /*Boolean?*/) {

        if (this.initialized) {

            if (!destroy) {

                return;
            }

            this.destroy();
        }

        this._initOptions(options);

        this._lastDir = this.options.mode === POSITION.END ? Infinitum.DIR.RIGHT : Infinitum.DIR.LEFT;

        this._prepareSelf();

        this._prepareTrack();

        this._prepareItems();

        this._initEvents();

        this.initialized = true;

        if (this.options.debug) {

            this.$self.addClass(CLASS.debug);

//            var _this = this;
//
//            var debug = function () {
//
//                _this.$items.each(function (i, item) {
//
//                    $t(item).attr("data-debug", getRect(item)[_this._isReverseDirection() ? "right" : "left"]);
//                });
//
//                _this.$self.attr("data-debug", (_this._selfRect.left + ((_this._selfRect.right - _this._selfRect.left) / 2)));
//
//                requestAnimationFrame(debug);
//            };
//
//            requestAnimationFrame(debug);
        }
    };

    Infinitum.prototype.destroy = function () {

        if (!this.initialized) {

            return;
        }

        instances.splice(instances.indexOf(this), 1);

        this._shouldCancelRAF = true;
        this._forceCancelRAF = true;
        cancelAnimationFrame(this._animate);

        this._destroyEvents();

        this.$self.removeAttr("data-" + DATA.url)
            .removeClass(CLASS.self)
            .removeClass(CLASS.disabled)
            .removeClass(this.options.mode === POSITION.START ? CLASS.start :
                this.options.mode === POSITION.END ? CLASS.end : CLASS.center)
            .removeClass(CLASS.debug);

        var trackCSS = {};

        trackCSS.textIndent = "";
        trackCSS[TRANSFORM_PROP] = "";
        trackCSS[TRANSITION_PROP + "Duration"] = "";

        this.$track.stop(true, true)
            .css(trackCSS)
            .off(this.NS, "")
            .removeClass(CLASS.track)
            .removeClass(CLASS.dragging)
            .removeClass(CLASS.moving)
            .removeClass(CLASS.speed0)
            .removeClass(CLASS.speed1)
            .removeClass(CLASS.speed2)
            .removeClass(CLASS.speed3)
            .removeData([DATA.willTranslate + this.NS, DATA.fakeTransitionTimeout + this.NS]);

        this.$items.each(function (i, item) {

            var $this = $t(item);

            clearTimeout($this.data(DATA.fakeTransitionTimeout + this.NS));

            $this.removeData([DATA.fakeTransitionTimeout + this.NS, DATA.willLeft + this.NS, DATA.offset + this.NS, DATA.translate + this.NS]);

        }.bind(this));

        var itemsCSS = {};

        itemsCSS[TRANSFORM_PROP] = "";

        if (this.options.reverseItems) {

            this._reverseItems();
        }

        this.$items.css(itemsCSS)
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

            //simulováním pohybu (třetí param. fakeMove) se položky zařadí na správné pozice

            if (this.options.mode === POSITION.CENTER) {

                this._move(1, false, true);
                this._move(-1, false, true);

            } else {

                this._move(this._lastDir !== Infinitum.DIR.LEFT ? -1 : 1, true, true);
            }
        }

        this.refreshing = false;
    };

    /*
     * Přenastaví aktivní položku.
     *
     * $item (jQuery | Number | String) - jQuery objekt s položkou, její index nebo selektor
     */
    Infinitum.prototype.setCurrent = function ($item /*jQuery | Number*/) {

        this._generateSelfRect();

        if (typeof $item === "number") {

            $item = this.$items.eq($item);

        } else if (typeof $item === "string") {

            $item = this.$items.filter($item);
        }

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
    Infinitum.prototype.disable = function () {

        this.$self.addClass(CLASS.disabled);

        this.disabled = true;
    };

    /*
     * Zruší disable.
     */
    Infinitum.prototype.enable = function () {

        this.$self.removeClass(CLASS.disabled);

        this.disabled = false;
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

        this._lastDir = Infinitum.DIR.LEFT;

        this._setCurrent(this.findNext(), false, true);
    };

    /*
     * Zaktivuje předcházející položku.
     */
    Infinitum.prototype.prev = function () {

        this._lastDir = Infinitum.DIR.RIGHT;

        this._setCurrent(this.findPrev(), false, true);
    };

    /*
     * <= (Boolean | Number) - Přesouvá uživatel položky?
     */
    Infinitum.prototype.dragging = function () {

        return this._hasPointer;
    };

    Infinitum.prototype._initOptions = function (options) {

        if (typeof options === "string") {

            options = {
                selector: options
            };
        }

        if (options && (options.jquery || options instanceof HTMLElement)) {

            options = {
                el: options
            };
        }

        options = options || this.options || {};

        if (options.mode === POSITION.CENTER) {

            options.currentOut = options.currentIn;
        }

        var _DEFAULTS = null;

        if (options.fade === false) {

            _DEFAULTS = $.extend({}, DEFAULTS);

            _DEFAULTS.startBreak = Infinitum.POSITION.END;
            _DEFAULTS.endBreak = Infinitum.POSITION.START;
        }

        if (options.mode === POSITION.CENTER) {

            _DEFAULTS = _DEFAULTS || $.extend({}, DEFAULTS);

            _DEFAULTS.startBreak = Infinitum.POSITION.END;
            _DEFAULTS.endBreak = Infinitum.POSITION.START;

            _DEFAULTS.currentIn = Infinitum.CURRENT.CLOSEST;
            _DEFAULTS.currentOut = Infinitum.CURRENT.CLOSEST;

            _DEFAULTS.clearEdge = false;

            _DEFAULTS.balanced = true;
        }

        if (options.mode === POSITION.END) {

            if (options.fade !== false) {

                _DEFAULTS = _DEFAULTS || $.extend({}, DEFAULTS);

                _DEFAULTS.startBreak = POSITION.END;
                _DEFAULTS.endBreak = POSITION.CENTER;
            }
        }

        this.options = $.extend({}, _DEFAULTS || DEFAULTS, this.options === options ? {} : this.options, options);

        if (!TRANSITIONEND) {

            this.options.fade = false;
        }
    };

    Infinitum.prototype._prepareSelf = function () {

        this.$self = this.options.el && this.options.el.jquery ? this.options.el : $(this.options.el instanceof HTMLElement ? this.options.el : this.options.selector);

        this.$self.attr("tabindex", 0)
            .attr("data-" + DATA.url, PROJECT_URL)
            .addClass(this.options.mode === POSITION.START ? CLASS.start :
                this.options.mode === POSITION.END ? CLASS.end : CLASS.center)
            .addClass(CLASS.self);

        this._generateSelfRect();
    };

    Infinitum.prototype._generateSelfRect = function () {

        this._selfRect = {};
        this._origSelfRect = this.$self[0].getBoundingClientRect();

        var box = this.$self.css(["padding-left", "padding-right", "border-left-width", "border-right-width"]);

        this._selfRect.left = this._origSelfRect.left + parseFloat(box["padding-left"]) + parseFloat(box["border-left-width"]);
        this._selfRect.right = this._origSelfRect.right - parseFloat(box["padding-right"]) - parseFloat(box["border-right-width"]);
        this._selfRect.center = this._origSelfRect.left + ((this._origSelfRect.right - this._origSelfRect.left) / 2);
    };

    Infinitum.prototype._prepareTrack = function () {

        this.$track = this.options.trackSelector ? $(this.options.trackSelector) : this.$self.children().first();

        this.$track.addClass(CLASS.track);

        this._speed = [7, 7, 7, 7, 7];

        this._setTrackPosition(0, false);
    };

    Infinitum.prototype._reverseItems = function () {

        var $parent = this.$items.first().parent();

        this.$items = $(this.$items.get().reverse()).each(function (i, item) {

            $parent.append(item);

        }.bind(this));
    };

    Infinitum.prototype._prepareItems = function (preserveCurrent) {

        if (!preserveCurrent) {

            this.$currentItem = $();
        }

        this.$items = this.options.itemSelector ? this.$track.find(this.options.itemSelector) : this.$track.children();

        this.$items.addClass(CLASS.item);

        if (!this.initialized && this.options.reverseItems) {

            this._reverseItems();
        }

        var lastLeft = 0,

            totalWidth = 0;

        //zařadit položky za sebe a nastavit absolutní pozicování (přejít na transform?)
        this.$items.each(function (i, item) {

            var $this = $t(item),

                CSS = {};

            CSS[TRANSFORM_PROP] = T3D ? "translate3d(0px, 0px, 0px)" : "translateX(0px)";

            $this.css(CSS);

            $this.data(DATA.translate + this.NS, 0);
            $this.data(DATA.offset + this.NS, lastLeft);
            $this.data(DATA.willLeft + this.NS, lastLeft);

            lastLeft += $this.outerWidth();
            totalWidth = lastLeft;

        }.bind(this));

        this._sortItems();

        if (preserveCurrent) {

            this._moveToItem(this.$currentItem, false, false, true);

            this._$possibleCurrent = this.$currentItem;

            return;
        }

        this._initCurrentItem(totalWidth);
    };

    Infinitum.prototype._initCurrentItem = function (totalWidth) {

        var $current;

        if (this.options.current !== null && typeof this.options.current !== "undefined") {

            if (typeof this.options.current === "number") {

                $current = this.$items.eq(this.options.current);

            } else if (this.options.current instanceof HTMLElement) {

                $current = $(this.options.current);

            } else if (this.options.current.jquery) {

                $current = this.options.current;
            }
        }

        if (!$current || !$current.length || this.$items.get().indexOf($current[0]) === -1) {

            if (this.options.mode === POSITION.START) {

                $current = this.$items.first();

            } else if (this.options.mode === POSITION.END) {

                $current = this.$items.last();

            } else {

                var middle = 0,

                    center = totalWidth / 2;

                this.$items.each(function (i, item) {

                    var $this = $t(item),

                        left = $this.data(DATA.willLeft + this.NS),
                        right = left + $this.outerWidth();

                    if (left <= center && right >= center) {

                        middle = i;

                        return false;
                    }
                }.bind(this));

                $current = this.$items.eq(middle);
            }
        }

        this._setCurrent($current, false, false, false, true);

        this._$possibleCurrent = this.$currentItem;

        this._fixItemsPositions();
    };

    Infinitum.prototype._initEvents = function () {

        if (instances.length === 1) {

            $win.on("touchmove." + NS, function (event) {

                if (hasPointer.length) {

                    event.preventDefault();
                }
            });

            //zachytávat události kolečka, pouze pokud uživatel neposouvá stránku (= allowWheel)
            $win.on("scroll." + NS, function (event) {

                if (event.target !== document) {

                    return;
                }

                allowWheel = false;

                clearTimeout(scrollDebounce);

                scrollDebounce = setTimeout(function() { allowWheel = true; }, Infinitum.CAPTURE_WHEEL_TIMEOUT);

            }.bind(this));
        }

        this.$self.on("mousedown" + this.NS + " touchstart" + this.NS, this._onPointerStart.bind(this));

        this.$self.on("click" + this.NS, CLASS.selector("item"), function (event) {

            //"kliknutí" enterem
            if (!this._byMouse && !this._byTouch && !this.disabled) {

                this._onPointerEnd(event);
            }

            this._byMouse = false;

            event.preventDefault();

        }.bind(this));

        var keydownThrottle = null;

        this.$self.on("keydown" + this.NS, function (event) {

            if (this.disabled || keydownThrottle || [37, 38, 39, 40].indexOf(event.which) === -1) {

                return;
            }

            keydownThrottle = true;

            setTimeout(function() { keydownThrottle = false; }, this.options.keyThrottle);

            this._onKey(event);

        }.bind(this));

        var wheelThrottle = null;

        this.$self.on("mousewheel" + this.NS + " DOMMouseScroll" + this.NS, function (event) {

            if (!allowWheel || this.disabled) {

                return;
            }

            if (wheelThrottle) {

                event.preventDefault();

                return;
            }

            wheelThrottle = true;

            setTimeout(function() { wheelThrottle = false; }, this.options.wheelThrottle);

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

        if (!instances.length) {

            $win.off("touchstart." + NS)
                .off("scroll." + NS);
        }
    };

    Infinitum.prototype._onPointerStart = function (event) {

        if (this.disabled) {

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
        this._draggingPrevented = false;

        hasPointer.push(this);

        if (this._byTouch) {

            this._hasPointer = event.originalEvent.changedTouches[0].identifier;

            this._findTouchPointerIndex(event);
        }

        this._fixVertical = null;

        this._clearTrackTransition();

        this._shouldCancelRAF = true;

        this._setPossibleCurrentItem(false, true, true);

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

            if (hasPointer.indexOf(this) !== -1) {

                hasPointer.splice(hasPointer.indexOf(this), 1);
            }

            return;
        }

        if (diffX) {

            if (!this._trackMoved) {

                this.$track.addClass(CLASS.dragging);
            }

            var draggingEvent = $.extend({}, $.Event(), {
                type: Infinitum.EVENT.dragging,
                target: this.$self[0],
                originalEvent: event.originalEvent,
                infinitum: this
            });

            this.$self.trigger(draggingEvent, this);

            if (draggingEvent.isDefaultPrevented()) {

                this._draggingPrevented = true;

                return;
            }

            this._forceCancelRAF = !this._trackMoved;

            this._move(diffX, false, false);

            this._lastTrackX = getTranslate(this.$track).x;
        }

        this._lastDir = !diffX ? this._lastDir : clientX > this._lastClientX ? Infinitum.DIR.RIGHT : Infinitum.DIR.LEFT;

        this._trackMoved = clientX !== this._lastClientX || this._trackMoved;

        this._lastClientX = clientX;
        this._lastClientY = clientY;

        event.preventDefault();
    };

    Infinitum.prototype._isReverseDirection = function () {

        return ((this._lastDir === Infinitum.DIR.RIGHT && (this.options.mode === POSITION.START || this.options.mode === POSITION.CENTER)) ||
                (this._lastDir === Infinitum.DIR.LEFT  &&  this.options.mode === POSITION.END));
    };

    Infinitum.prototype._findTouchPointerIndex = function (event) {

        $.each(event.originalEvent.touches, function (i, touch) {

            if (touch.identifier === this._hasPointer) {

                this._pointerIndex = i;
            }

        }.bind(this));
    };

    Infinitum.prototype._onPointerEnd = function (event) {

        if ((this._byMouse && event.button !== 0) || (!this._hasPointer && event.type !== "click")) {

            return;
        }

        this._hasPointer = false;
        this._forceCancelRAF = false;

        if (hasPointer.indexOf(this) !== -1) {

            hasPointer.splice(hasPointer.indexOf(this), 1);
        }

        $win.off("mousemove" + this.NS);
        this.$self.off("touchmove" + this.NS);

        if (!this._trackMoved && this._fixVertical === null && !this._draggingPrevented) {

             return this._onTap(event);
        }

        this._draggingPrevented = false;

        this._setCurrent(this._findCurrentItem(), false, false, true);

        this.$track.removeClass(CLASS.dragging);

        var dragendEvent = $.extend({}, $.Event(), {
            type: Infinitum.EVENT.dragend,
            target: this.$self[0],
            originalEvent: event.originalEvent,
            infinitum: this
        });

        this.$self.trigger(dragendEvent, this);

        this._trackMoved = false;

        if (dragendEvent.isDefaultPrevented()) {//???

            return;
        }

        event.preventDefault();
    };

    Infinitum.prototype._onTap = function (event) {

        var $item = $(event.target).closest(CLASS.selector("item"));

        if ($item.length) {

            var tapEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.tap, event, $item);

            if (tapEvent.isDefaultPrevented()) {

                return;
            }

            var currentPos = getRect(this.$currentItem[0]).left,
                tappedPos = getRect($item[0]).left;

            this._lastDir = currentPos > tappedPos ? Infinitum.DIR.RIGHT : Infinitum.DIR.LEFT;

            if (this.options.wheelKeysTapSetCurrent) {

                this._setCurrent($item, false);

            } else {

                this._moveToItem($item, false);
            }
        }

        this._trackMoved = false;

        return !$item.length;
    };

    Infinitum.prototype._onWheel = function (event) {

        if (this.disabled) {

            return;
        }

        this._clearTrackTransition();

        this._shouldCancelRAF = true;
        cancelAnimationFrame(this._animate);

        this._lastDir = (event.originalEvent.detail || event.originalEvent.deltaY || event.originalEvent.deltaX || -event.originalEvent.wheelDelta) > 0 ? Infinitum.DIR.LEFT: Infinitum.DIR.RIGHT;

        var $item = this._lastDir === Infinitum.DIR.LEFT ? this.findNext() : this.findPrev();

        var scrollEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.scroll, event, $item);

        if (scrollEvent.isDefaultPrevented()) {

            return;
        }

        this._trackMoved = true;

        this.$self.focus();

        this._generateSelfRect();

        if (this.options.wheelKeysTapSetCurrent) {

            this._setCurrent($item, false, true);

        } else {

            this._moveToItem($item, true);
        }

        event.preventDefault();
    };

    Infinitum.prototype._onKey = function (event) {

        if (this.disabled) {

            return;
        }

        this._clearTrackTransition();

        this._shouldCancelRAF = true;
        cancelAnimationFrame(this._animate);

        this._lastDir = [37, 38].indexOf(event.which) === -1 ? Infinitum.DIR.LEFT: Infinitum.DIR.RIGHT;

        var $item = this._lastDir === Infinitum.DIR.LEFT ? this.findNext() : this.findPrev();

        var keyEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.key, event, $item);

        if (keyEvent.isDefaultPrevented()) {

            return;
        }

        this._trackMoved = true;

        this._generateSelfRect();

        if (this.options.wheelKeysTapSetCurrent) {

            this._setCurrent($item, false, true);

        } else {

            this._moveToItem($item, true);
        }

        event.preventDefault();
    };

    Infinitum.prototype._triggerChangeTypeEvent = function (type, event, $toItem, moreData) {

        var eventObj = $.extend({}, $.Event(), {
            type: type,
            target: $toItem[0],
            fromElement: this.$currentItem[0],
            toElement: $toItem[0],
            originalEvent: event ? event.originalEvent : null,
            infinitum: this
        }, moreData || null);

        this.$self.trigger(eventObj, this);

        return eventObj;
    };

    Infinitum.prototype._moveTrack = function (x, animate, speedByPointer) {

        var value = getTranslate(this.$track).x + x;

        this._setTrackPosition(value, animate, speedByPointer);
    };

    Infinitum.prototype._setTrackPosition = function (position, animate, speedByPointer) {

        this._clearTrackTransition();

        this.$track.css(TRANSITION_PROP, animate ? "" : "none");

        if (animate) {

            this._shouldCancelRAF = false;
            this._forceCancelRAF = false;

            var speed = this._setTrackSpeed(position, speedByPointer),

                fakeTransitionEnd,

                onTransitonEnd = function (event) {

                    if (event && (event.originalEvent.target !== this.$track[0] || !event.originalEvent.propertyName.match(/transform/i))) {

                        return;
                    }

                    this._clearTrackTransition();

                    this.$track.css(TRANSITION_PROP + "Duration", "");

                    this._generateSelfRect();

                    this._shouldCancelRAF = true;

                }.bind(this);

            this.$track.on(TRANSITIONEND + this.NS, onTransitonEnd);

            fakeTransitionEnd = setTimeout(onTransitonEnd, speed + 50);

            this.$track.data(DATA.fakeTransitionTimeout + this.NS, fakeTransitionEnd);

            if (!TRANSITIONEND) {

                var initX = getTranslate(this.$track).x;

                this.$track.stop(true)
                    .css({ textIndent: 0 })
                    .animate({ textIndent: 1 }, {
                        duration: speed,
                        easing: "easeOutQuad." + NS,

                        step: function (step) {

                            var CSS = {};

                            CSS[TRANSFORM_PROP] = "translateX(" + (initX + ((position - initX) * step)) + "px)";

                            this.$track.css(CSS);

                        }.bind(this),

                        complete: onTransitonEnd
                    });
            }
        }

        if (TRANSITIONEND || !animate) {

            this.$track.css(TRANSFORM_PROP, T3D ? "translate3d(" + position + "px, 0px, 0px)" : "translateX(" + position + "px)");
        }

        this.$track.data(DATA.willTranslate + this.NS, position);

        if (animate) {

            requestAnimationFrame(this._animate);
        }
    };

    Infinitum.prototype._clearTrackTransition = function () {

        clearTimeout(this.$track.data(DATA.fakeTransitionTimeout + this.NS));

        this.$track.off(TRANSITIONEND + this.NS)
            .data(DATA.fakeTransitionTimeout + this.NS, null);
    };

    Infinitum.prototype._getAvgSpeed = function () {

        return this._speed.reduce(function (acc, current) {

            return acc + current;

        }, 0) / this._speed.length;
    };

    Infinitum.prototype._setTrackSpeed = function (toPosition, usePointer) {

        var fromPosition = getTranslate(this.$track).x,

            diff = Math.abs(fromPosition - toPosition),

            k = 100;

        if (usePointer) {

            var avgSpeed = this._getAvgSpeed();

            k = k / Math.max(1, Math.log(avgSpeed / 3));

            k = Math.max(Math.min(k, 150), 50) * 2;
        }

        var speed = (k * Math.max(1, Math.log(diff / 5))).toFixed();

        speed = Math.max(Math.min(speed, 650), 150);

        this.$track.css(TRANSITION_PROP + "Duration", speed  + "ms");

        return speed;
    };

    Infinitum.prototype._setFadeSpeed = function (move, noFade) {

        if (noFade) {

            if (this._lastFadeSpeed === 0) {

                return;
            }

            this._lastFadeSpeed = 0;

            this.$track
                .removeClass(CLASS.speed1)
                .removeClass(CLASS.speed2)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed0);

            return;
        }

        if (move) {

            this._speed = this._speed.slice(0, 5);

            this._speed.unshift(Math.abs(move));
        }

        var avgSpeed = this._getAvgSpeed();

        if (avgSpeed < 8) {

            if (this._lastFadeSpeed === 1) {

                return;
            }

            this._lastFadeSpeed = 1;

            this.$track
                .removeClass(CLASS.speed0)
                .removeClass(CLASS.speed2)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed1);

        } else if (avgSpeed < 16) {

            if (this._lastFadeSpeed === 2) {

                return;
            }

            this._lastFadeSpeed = 2;

            this.$track
                .removeClass(CLASS.speed0)
                .removeClass(CLASS.speed1)
                .removeClass(CLASS.speed3)
                .addClass(CLASS.speed2);

        } else {

            if (this._lastFadeSpeed === 3) {

                return;
            }

            this._lastFadeSpeed = 3;

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
    Infinitum.prototype._move = function (x, animation, fakeMove, fix) {

        clearTimeout(this._fixItemsPositionsTimeout);

        this.$track.addClass(CLASS.moving);

        this._setFadeSpeed(x, fakeMove && (!fix || !this.initialized));

        if (!animation && !fakeMove) {

            this._moveTrack(x);
        }

        this._sortItems(animation);

        var animationDone = animation && this._shouldCancelRAF && (!x || this._forceCancelRAF),

            $edgeItem = this.options.mode === POSITION.END ? this.$willEndItem : this.$willStartItem,

            animationDoneAndCurrentNotOnEdge = animationDone && (this.options.clearEdge || this.options.mode === POSITION.CENTER) && $edgeItem.length && !$edgeItem.hasClass(CLASS.current),

            animationDoneAndCurrentNotOnEndEdge = true;

        if (this.options.mode === POSITION.CENTER && animationDoneAndCurrentNotOnEdge) {

            animationDoneAndCurrentNotOnEndEdge = animationDone && this.$willEndItem.length && !this.$willEndItem.hasClass(CLASS.current);
        }

        if (this.options.mode === POSITION.START) {

            if (x < 0 || ((animationDoneAndCurrentNotOnEdge || fakeMove) && this.options.clearEdge)) {

                this._moveLeftItemsOverToTheEnd(animationDone, animationDoneAndCurrentNotOnEdge, fakeMove);

            } else if (x > 0) {

                this._moveRightItemsOverToTheStart(animationDone);
            }

        } else if (this.options.mode === POSITION.END) {

            if (x > 0 || ((animationDoneAndCurrentNotOnEdge || fakeMove) && this.options.clearEdge)) {

                this._moveRightItemsOverToTheStart(animationDone, animationDoneAndCurrentNotOnEdge, fakeMove);

            } else if (x < 0) {

                this._moveLeftItemsOverToTheEnd(animationDone);
            }
        } else {

            if (x < 0 || (!x && !animationDoneAndCurrentNotOnEndEdge)) {

                this._moveLeftItemsOverToTheEnd(animationDone);

            } else if (x > 0 || (fakeMove || (!x && !animationDoneAndCurrentNotOnEdge))) {

                this._moveRightItemsOverToTheStart(animationDone);
            }
        }

        if (!fakeMove) {

            this._setPossibleCurrentItem(animationDone, x);
        }

        //druhá část: opravuje položky, které nemusí být vždy vyváženě vyrovnané
        if ((!animationDone && animation) || (this.options.mode === POSITION.CENTER && animation && animationDone && (!animationDoneAndCurrentNotOnEdge || !animationDoneAndCurrentNotOnEndEdge) && this.options.balanced && this.$items.length > 2)) {

            requestAnimationFrame(this._animate);

            return;
        }

        if (animationDone) {

            if (!fakeMove && animationDoneAndCurrentNotOnEdge) {

                this._fixItemsPositions();
            }

            this.$track.removeClass(CLASS.moving);
        }
    };

    Infinitum.prototype._fixItemsPositions = function () {

        clearTimeout(this._fixItemsPositionsTimeout);

        var fadingsDone = false;

        this.$items.each(function (i, item) {

            var $item = $t(item);

            if ($item.data(DATA.fakeTransitionTimeout + this.NS)) {

                this._fixItemsPositionsTimeout = setTimeout(this._fixItemsPositions.bind(this), 0);

                return false;
            }

            fadingsDone = i === this.$items.length - 1;

        }.bind(this));

        if (fadingsDone) {

            this._forceCancelRAF = true;

            if (this.options.mode === POSITION.CENTER) {

                this._move(1, false, true);
                this._move(-1, false, true);

                return;
            }

            this._move(this._lastDir === Infinitum.DIR.LEFT ? -1 : 1, true, true, true);
        }
    };

    /*
     * Najde položky, které přesahují okraje widgetu.
     */
    Infinitum.prototype._sortItems = function (animation) {

        var items = this._getItemsData(animation);

        this.startItemPosWill = items.startPosWill;
        this.endItemPosWill = items.endPosWill;
        this.endItemWidthWill = items.endWidthWill;

        this.$insideItems = $(items.inside);

        this.$willStartItem = this.$willStartItem && this.$willStartItem[0] === items.willStart ? this.$willStartItem : $(items.willStart);
        this.$willEndItem = this.$willEndItem && this.$willEndItem[0] === items.willEnd ? this.$willEndItem : $(items.willEnd);

        this._setItemsOverInCorrectOrder(items);

        this._setItemOverIfNotBreakOnEdge(items);
    };

    Infinitum.prototype._setItemsOverInCorrectOrder = function (items) {

        if (items.leftOver.length > 1) {

            this.$leftItemsOver = $(items.leftOver.sort(function (a, b) {

                return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
            }));

        } else {

            this.$leftItemsOver = $(items.leftOver);
        }

        if (items.rightOver.length > 1) {

            this.$rightItemsOver = $(items.rightOver.sort(function (a, b) {

                return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
            }));

        } else {

            this.$rightItemsOver = $(items.rightOver);
        }
    };

    Infinitum.prototype._setItemOverIfNotBreakOnEdge = function (items) {

        if (this.$items.length === 1 && this.options.mode === POSITION.CENTER) {

            return;
        }

        if (this.options.mode === POSITION.START || (this.options.mode === POSITION.CENTER && this._isReverseDirection())) {

            //na kraji je místo, ale na opačné straně poslední element není na kraji -> zalomit (když breakOnEdge === true)
            if (!this.options.breakOnEdge && !this.$leftItemsOver.length && !this.$rightItemsOver.length && items.willStartRect.left > this._selfRect.left) {

                if (this.options.balanced) {

                    var ifMovedFromRightLeftFromCenter = Math.abs(-this._selfRect.center + (items.willStartRect.left - items.willEndRect.width)),
                        ifMovedFromRightRightFromCenter = Math.abs(-this._selfRect.center + items.willEndRect.right);

                    if (ifMovedFromRightLeftFromCenter <= ifMovedFromRightRightFromCenter) {

                        this.$rightItemsOver = this.$willEndItem;
                    }

                    return;
                }

                this.$rightItemsOver = this.$willEndItem;
            }

            return;
        }

        if (this.options.mode === POSITION.END || (this.options.mode === POSITION.CENTER && !this._isReverseDirection())) {

            //na kraji je místo, ale na opačné straně poslední element není na kraji -> zalomit (když breakOnEdge === true)
            if (!this.options.breakOnEdge && !this.$leftItemsOver.length && !this.$rightItemsOver.length && items.willEndRect.right < this._selfRect.right) {

                if (this.options.balanced) {

                    var ifMovedFromLeftLeftFromCenter = Math.abs(-this._selfRect.center + items.willStartRect.left),
                        ifMovedFromLeftRightFromCenter = Math.abs(-this._selfRect.center + (items.willEndRect.right + items.willEndRect.width));

                    if (ifMovedFromLeftRightFromCenter <= ifMovedFromLeftLeftFromCenter) {

                        this.$leftItemsOver = this.$willStartItem;
                    }

                    return;
                }

                this.$leftItemsOver = this.$willStartItem;
            }

            return;
        }
    };

    Infinitum.prototype._getItemsData = function (animation) {

        var leftOver = [],
            rightOver = [],
            inside = [],
            willStart = null,
            willEnd = null,
            willStartRect = null,
            willEndRect = null,

            startPosWill = null,
            endPosWill = null,
            endWidthWill = null;

        this.$items.each(function (i, item) {

            var $this = $t(item),

                rect = getRect(item),

                dataLeft = $this.data(DATA.willLeft + this.NS),
                cssLeft = $this.data(DATA.translate + this.NS) + $this.data(DATA.offset + this.NS),

                diff = dataLeft - cssLeft;

            if (startPosWill === null || startPosWill > rect.left + diff) {

                startPosWill = rect.left + diff;

                willStart = item;

                willStartRect = {
                    left: rect.left + diff,
                    right: rect.right + diff,
                    width: rect.width
                };
            }

            if (endPosWill === null || endPosWill < rect.right + diff) {

                endPosWill = rect.right + diff;
                endWidthWill = rect.width;

                willEnd = item;

                willEndRect = {
                    left: rect.left + diff,
                    right: rect.right + diff,
                    width: rect.width
                };
            }

            //uživatel pustil track (animation === true);
            //kvůli odlišnému nastavení current a break může dojít k přeskočení položky na druhou stranu (a změní se na chvíli possibleCurrent)
            // -> zařadit do inside
            if (animation && item === this._$possibleCurrent[0]) {

                inside.push(item);

                return;
            }

            if (this.options.mode === POSITION.CENTER && this.options.balanced && !this.options.breakOnEdge) {

                if (rect.left + diff <= this._selfRect.center && rect.right + diff >= this._selfRect.center) {

                    inside.push(item);

                } else if (rect.left + diff <= this._selfRect.center) {

                    leftOver.push(item);

                } else {

                    rightOver.push(item);
                }

                return;
            }

            var breakEdge = this._getBreakEdge(rect);

            if (breakEdge.left < this._selfRect.left) {

                leftOver.push(item);

            } else if (breakEdge.right > this._selfRect.right) {

                rightOver.push(item);

            } else {

                inside.push(item);
            }

        }.bind(this));

        return {
            leftOver: leftOver,
            rightOver: rightOver,
            inside: inside,
            willStart: willStart,
            willEnd: willEnd,
            willStartRect: willStartRect,
            willEndRect: willEndRect,
            startPosWill: startPosWill,
            endPosWill: endPosWill,
            endWidthWill: endWidthWill
        };
    };

    Infinitum.prototype._getBreakEdge = function (itemRect) {

        var startBreakEdge = itemRect.left,
            endBreakEdge = itemRect.right - 1/*0.5?*/;

        switch (this.options.startBreak) {

            case Infinitum.POSITION.CENTER:

                startBreakEdge = itemRect.left + (itemRect.width / 2);

                break;

            case Infinitum.POSITION.END:

                startBreakEdge = itemRect.right - 1/*0.5?*/;

                break;
        }

        switch (this.options.endBreak) {

            case Infinitum.POSITION.START:

                endBreakEdge = itemRect.left;

                break;

            case Infinitum.POSITION.CENTER:

                endBreakEdge = itemRect.right - 1/*0.5?*/ - (itemRect.width / 2);

                break;
        }

        return {
            left: startBreakEdge,
            right: endBreakEdge
        };
    };

    Infinitum.prototype._moveLeftItemsOverToTheEnd = function (animationDone, animationDoneAndCurrentNotFirst, byFakeMove) {

        var _this = this,

            addedWidth = 0; //kolik px už bylo přidáno na konec

        this.$leftItemsOver.each(function () {

            var $this = $t(this),

                width = $this.outerWidth();

            if (_this.options.balanced && (_this.options === POSITION.CENTER || (!animationDone || !byFakeMove || !_this.options.clearEdge))) {

                var ifMovedFromLeftLeftFromCenter = Math.abs(-_this._selfRect.center + (_this.startItemPosWill + addedWidth)),
                    ifMovedFromLeftRightFromCenter = Math.abs(-_this._selfRect.center + (_this.endItemPosWill + addedWidth + width));

                if (ifMovedFromLeftRightFromCenter >= ifMovedFromLeftLeftFromCenter) {

                    return false;
                }

            } else {

                if (_this.options.mode === POSITION.START || _this.options.mode === POSITION.CENTER) {

                    if (!_this.options.breakAll) {

                        //nepřidávat na konec položky, které by byly až za pravým okrajem
                        if (!_this.options.clearEdge && _this.endItemPosWill + addedWidth >= _this._selfRect.right) {

                            return;
                        }
                    }

                } else if (_this.options.mode === POSITION.END) {

                    if (!_this.options.breakAll) {

                        //nepřidávat na konec položky, které by byly až za pravým okrajem
                        //!!! + 1 může způsobovat problémy (původně to tam nebylo a fungovalo to :) - taky tam bylo >=
                        if (_this.endItemPosWill + addedWidth + 0.5 >= _this._selfRect.right) {

                            return;
                        }
                    }
                }
            }

            if (animationDoneAndCurrentNotFirst && ($this.hasClass(CLASS.current) || (!_this.options.clearEdge && !byFakeMove))) {

                return;
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toStart) || animationDoneAndCurrentNotFirst || byFakeMove) {

                addedWidth += width;

                _this._breakItem($(this), "end");
            }
        });

        if (animationDone) {

            this._clearHideStates("start");
        }
    };

    Infinitum.prototype._moveRightItemsOverToTheStart = function (animationDone, animationDoneAndCurrentNotLast, byFakeMove) {

        var _this = this,

            addedWidth = 0; //kolik px už bylo přidáno na začátek

        this.$rightItemsOver.each(function () {

            var $this = $t(this),

                width = $this.outerWidth();

            if (_this.options.balanced && (_this.options === POSITION.CENTER || (!animationDone || !byFakeMove || !_this.options.clearEdge))) {

                var ifMovedFromRightLeftFromCenter = Math.abs(-_this._selfRect.center + (_this.startItemPosWill - addedWidth - width)),
                    ifMovedFromRightRightFromCenter = Math.abs(-_this._selfRect.center + (_this.endItemPosWill - addedWidth));

                if (ifMovedFromRightLeftFromCenter >= ifMovedFromRightRightFromCenter) {

                    return false;
                }

            } else {

                if (_this.options.mode === POSITION.START || _this.options.mode === POSITION.CENTER) {

                    if (!_this.options.breakAll) {

                        //nepřidávat na začátek položky, které byly až za levým okrajem
                        if (_this.startItemPosWill - addedWidth - 0.5 <= _this._selfRect.left) {

                            return;
                        }
                    }

                } else if (_this.options.mode === POSITION.END) {

                    if (!_this.options.breakAll) {

                        //nepřidávat na začátek položky, které byly až za levým okrajem
                        if (!_this.options.clearEdge && _this.startItemPosWill - addedWidth <= _this._selfRect.left) {

                            return;
                        }
                    }
                }
            }

            if (animationDoneAndCurrentNotLast && ($this.hasClass(CLASS.current) || (!_this.options.clearEdge && !byFakeMove))) {

                return;
            }

            if (!$this.hasClass(CLASS.hide) || $this.hasClass(CLASS.toEnd) || animationDoneAndCurrentNotLast || byFakeMove) {

                addedWidth += width;

                _this._breakItem($(this), "start");
            }
        });

        if (animationDone) {

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

            width = toPosition === "start" ? $item.outerWidth() : -$sibling.outerWidth(),

            left = $sibling.data(DATA.willLeft + this.NS) - width;

        if (!this.options.fade) {

            var CSS = {},

                value = left - $item.data(DATA.offset + this.NS);

            CSS[TRANSFORM_PROP] = T3D ? "translate3d(" + value + "px, 0px, 0px)" : "translateX(" + value + "px)";
            CSS[TRANSITION_PROP] = "";

            $item.css(CSS)
                .data(DATA.translate + this.NS, value)
                .data(DATA.willLeft + this.NS, left);

            return;
        }

        var opacity = $item.css("opacity");

        $item.addClass(toPosition === "start" ? CLASS.toStart : CLASS.toEnd)
            .removeClass(toPosition === "start" ? CLASS.toEnd : CLASS.toStart)
            .removeClass(CLASS.hide);

        //konečná hodnota (kam bude po zmizení položka přesunuta) - pro případy, kdy se potřebujeme tváři, jako by byla položka už na daném místě
        $item.data(DATA.willLeft + this.NS, left);

        var hardBreak = (toPosition === "end" && this.options.fade === POSITION.END) || (toPosition === "start" && this.options.fade === POSITION.START),

            fakeTransitionEnd,

            onTransitionend = function (event) {

                if (event && event.originalEvent.target !== $item[0] && event.originalEvent.propertyName !== "opacity") {

                    return;
                }

                clearTimeout(fakeTransitionEnd);

                var CSS = {},

                    value = $item.data(DATA.willLeft + this.NS) - $item.data(DATA.offset + this.NS);

                CSS[TRANSFORM_PROP] = T3D ? "translate3d(" + value + "px, 0px, 0px)" : "translateX(" + value + "px)";
                CSS[TRANSITION_PROP] = hardBreak || this.options.fade === true ? "" : "none";

                $item.data(DATA.translate + this.NS, value)
                    .css(CSS);

                $item.data(DATA.fakeTransitionTimeout + this.NS, null);

                $item.removeClass(CLASS.hide)
                    .removeClass(toPosition === "start" ? CLASS.toStart : CLASS.toEnd);

                $item.off(TRANSITIONEND + this.NS);

            }.bind(this);

        if (hardBreak) {

            $item.css(TRANSITION_PROP, "none")
                .addClass(CLASS.hide);

            fakeTransitionEnd = setTimeout(onTransitionend, 0);

            $item.data(DATA.fakeTransitionTimeout + this.NS, fakeTransitionEnd);

        } else if (!parseFloat(opacity)) {

            onTransitionend();

        } else {

            fakeTransitionEnd = setTimeout(onTransitionend, Infinitum.FAKE_TRANSITION_TIMEOUT);

            $item.data(DATA.fakeTransitionTimeout + this.NS, fakeTransitionEnd);

            $item.on(TRANSITIONEND + this.NS, onTransitionend);

            $item.css(TRANSITION_PROP, "");

            $item.addClass(CLASS.hide);
        }
    };

    /*
     * Odstraňuje nastavení pro přesunutí položek, pokud se změní směr pohybu.
     */
    Infinitum.prototype._clearHideStates = function (position) {

        if (!this.options.fade) {

            return;
        }

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
                .removeClass(position === "end" ? CLASS.toEnd : CLASS.toStart);

            $this.data(DATA.willLeft + _this.NS, $this.data(DATA.translate + _this.NS) + $this.data(DATA.offset + _this.NS));
        });
    };

    Infinitum.prototype._animate = function () {

        this._move(getTranslate(this.$track).x - this._lastTrackX, true);

        this._lastTrackX = getTranslate(this.$track).x;
    };

    /*
     * isImmediateSibling - pokud je položka hned vedle aktivní (při posouvání se pak použije jiná metoda) - při scroll, key, next, prev
     */
    Infinitum.prototype._setCurrent = function ($item, noTrackMove, isImmediateSibling, speedByPointer, jumpToPosition) {

        if (!$item || !$item[0]) {

            return;
        }

        if ($item[0] !== this.$currentItem[0]) {

            var changeEvent = this._triggerChangeTypeEvent(Infinitum.EVENT.change, null, $item);

            if (changeEvent.isDefaultPrevented()) {

                if (!noTrackMove) {

                    this._moveToItem(this.$currentItem, isImmediateSibling, speedByPointer, jumpToPosition);
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

        this._moveToItem($item, isImmediateSibling, speedByPointer, jumpToPosition);
    };

    /*
     * oneItemMode - posouvá se pouze na položku hned vedle aktivní
     */
    Infinitum.prototype._moveToItem = function ($item, oneItemMode, speedByPointer, jumpToPosition) {

        switch (this.options.mode) {

            case POSITION.START:

                return this._moveToItemModeStart($item, oneItemMode, speedByPointer, jumpToPosition);

            case POSITION.END:

                return this._moveToItemModeEnd($item, oneItemMode, speedByPointer, jumpToPosition);

            case POSITION.CENTER:

                return this._moveToItemModeCenter($item, oneItemMode, speedByPointer, jumpToPosition);
        }
    };

    Infinitum.prototype._moveToItemModeCenter = function ($item, oneItemMode, speedByPointer, jumpToPosition) {

        var dataLeft = $item.data(DATA.willLeft + this.NS),
            cssLeft = $item.data(DATA.translate + this.NS) + $item.data(DATA.offset + this.NS),

            rect = getRect($item[0]),

            willTranslate;

        if (jumpToPosition) {

            this._shouldCancelRAF = true;
            this._forceCancelRAF = true;
        }

        //přesouvá se pouze na vedlejší položku, takže nepotřebujeme přesnou pozici,
        //pokud by se použila, tak by při rychlé sekvenci posouvání mohlo dojít ke skoku opačným směrem
        if (oneItemMode) {

            if (this.$items.length === 1) {

                return;
            }

            willTranslate = this.$track.data(DATA.willTranslate + this.NS);

            if (this._isReverseDirection()) {

                var $next = this.findNext($item),

                    nextWidth = $next.outerWidth();

                this._setTrackPosition(willTranslate + (rect.width / 2) + (nextWidth / 2), !jumpToPosition, speedByPointer);

                return;
            }

            var $prev = this.findPrev($item),

                prevWidth = $prev.outerWidth();

            this._setTrackPosition(willTranslate - (rect.width / 2) - (prevWidth / 2), !jumpToPosition, speedByPointer);

            return;
        }

        var itemPos = rect.left + (dataLeft - cssLeft) - this._selfRect.left - ((this._selfRect.right - this._selfRect.left) / 2) + (rect.width / 2);

        if (!itemPos) {

            return;
        }

        this._moveTrack(-itemPos, !jumpToPosition, speedByPointer);
    };

    Infinitum.prototype._moveToItemModeEnd = function ($item, oneItemMode, speedByPointer, jumpToPosition) {

        var dataLeft = $item.data(DATA.willLeft + this.NS),
            cssLeft = $item.data(DATA.translate + this.NS) + $item.data(DATA.offset + this.NS),

            rect = getRect($item[0]),

            willTranslate;

        if (jumpToPosition) {

            this._shouldCancelRAF = true;
            this._forceCancelRAF = true;
        }

        //přesouvá se pouze na vedlejší položku, takže nepotřebujeme přesnou pozici,
        //pokud by se použila, tak by při rychlé sekvenci posouvání mohlo dojít ke skoku opačným směrem
        if (oneItemMode) {

            if (this.$items.length === 1) {

                return;
            }

            willTranslate = this.$track.data(DATA.willTranslate + this.NS);

            if (this._isReverseDirection()) {

                this._setTrackPosition(willTranslate - rect.width, !jumpToPosition, speedByPointer);

                return;
            }

            var $next = this.findNext($item),

                nextWidth = $next.outerWidth();

            this._setTrackPosition(willTranslate + nextWidth, !jumpToPosition, speedByPointer);

            return;
        }

        var itemPos = rect.right + (dataLeft - cssLeft) - this._selfRect.right;

        if (!itemPos) {

            var currentItemIsNotFirst = this.$willEndItem.length && !this.$willEndItem.hasClass(CLASS.current);

            if (currentItemIsNotFirst) {

                this._fixItemsPositions();
            }

            return;
        }

        this._moveTrack(-itemPos, !jumpToPosition, speedByPointer);
    };

    Infinitum.prototype._moveToItemModeStart = function ($item, oneItemMode, speedByPointer, jumpToPosition) {

        var dataLeft = $item.data(DATA.willLeft + this.NS),
            cssLeft = $item.data(DATA.translate + this.NS) + $item.data(DATA.offset + this.NS),

            rect = getRect($item[0]),

            willTranslate;

        if (jumpToPosition) {

            this._shouldCancelRAF = true;
            this._forceCancelRAF = true;
        }

        if (oneItemMode) {

            if (this.$items.length === 1) {

                return;
            }

            willTranslate = this.$track.data(DATA.willTranslate + this.NS);

            if (this._isReverseDirection()) {

                this._setTrackPosition(willTranslate + rect.width, !jumpToPosition, speedByPointer);

                return;
            }

            var $prev = this.findPrev($item),

                prevWidth = ($prev.outerWidth());

            this._setTrackPosition(willTranslate - prevWidth, !jumpToPosition, speedByPointer);

            return;
        }

        var itemPos = rect.left + (dataLeft - cssLeft) - this._selfRect.left;

        if (!itemPos) {

            var currentItemIsNotFirst = this.$willStartItem.length && !this.$willStartItem.hasClass(CLASS.current);

            if (currentItemIsNotFirst) {

                this._fixItemsPositions();
            }

            return;
        }

        this._moveTrack(-itemPos, !jumpToPosition, speedByPointer);
    };

    /*
     * clear - odstranit possibleCurrent stav (konec přesouvání)
     */
    Infinitum.prototype._setPossibleCurrentItem = function (clear, rewriteCurrent, force) {

        if (rewriteCurrent) {

            var $possible = this._findCurrentItem(),

                chagned = $possible[0] !== this._$possibleCurrent[0];

            if (chagned || force) {

                $possible.addClass(CLASS.possibleCurrent);

                if (chagned) {

                    this._$possibleCurrent.removeClass(CLASS.possibleCurrent);

                    this._triggerChangeTypeEvent(Infinitum.EVENT.possibleChange, null, $possible);

                    this._$possibleCurrent = $possible;
                }
            }
        }

        if (clear) {

            this._$possibleCurrent.removeClass(CLASS.possibleCurrent);

            if (rewriteCurrent) {

                this._setCurrent(this._$possibleCurrent);
            }

            return;
        }
    };

    Infinitum.prototype._findCurrentItem = function () {

        return this._findClosestItem(this._isReverseDirection() ? "out" : "in");
    };

    Infinitum.prototype._findClosestItem = function (direction) {

        var closestItemPos = null,

            closestItem,

            option = direction === "in" ? "currentIn" : "currentOut";

        this.$items.each(function (i, item) {

            var $this = $t(item),

                dataLeft = $this.data(DATA.willLeft + this.NS),
                cssLeft = $this.data(DATA.translate + this.NS) + $this.data(DATA.offset + this.NS),

                rect = getRect(item),

                willLeft = rect.left + (dataLeft - cssLeft),
                willRight = rect.right + (dataLeft - cssLeft),

                thisLeftItemPos,
                thisRightItemPos;

            if (this.options.mode === POSITION.CENTER && this.options[option] !== CURRENT.CLOSEST) {

                if (this._isCenter(willLeft, willRight)) {

                    closestItem = item;

                    return false;
                }

                return;
            }

            if (this.options.mode === POSITION.CENTER && this.options[option] === CURRENT.CLOSEST) {

                thisLeftItemPos = willLeft - this._selfRect.center + 1; /*0.5?*/
                thisRightItemPos = willRight - this._selfRect.center - 1; /*0.5?*/

            } else {

                thisLeftItemPos = willLeft - this._selfRect[this.options.mode === POSITION.END ? "right" : "left"];
                thisRightItemPos = willRight - this._selfRect[this.options.mode === POSITION.END ? "right" : "left"];
            }

            if (this._isCloser(direction, closestItemPos, thisLeftItemPos, thisRightItemPos)) {

                if (this.options.mode === POSITION.CENTER && this.options[option] === CURRENT.CLOSEST) {

                    closestItemPos = direction === "in" ? thisLeftItemPos : thisRightItemPos;

                } else {

                    closestItemPos = this.options.mode === POSITION.END ? thisRightItemPos : thisLeftItemPos;
                }

                closestItem = item;
            }

        }.bind(this));

        return $(closestItem);
    };

    Infinitum.prototype._isCenter = function (currentLeft, currentRight) {

        return currentLeft <= this._selfRect.center && currentRight >= this._selfRect.center;
    };

    Infinitum.prototype._isCloser = function (direction, prev, currentLeft, currentRight) {

        var option = direction === "in" ? "currentIn" : "currentOut";

        if (this.options.mode === POSITION.START) {

            switch (this.options[option]) {

                case CURRENT.CLOSEST: return (prev === null || Math.abs(currentLeft) < Math.abs(prev));

                case CURRENT.FULL: return (currentLeft >= 0 && (prev === null || (Math.abs(currentLeft) < Math.abs(prev))));

                case CURRENT.STILL_INSIDE: return (currentRight >= 0.5 && (prev === null || (currentLeft < prev)));
            }

        } else if (this.options.mode === POSITION.END) {

            switch (this.options[option]) {

                case CURRENT.CLOSEST: return (prev === null || Math.abs(currentRight) < Math.abs(prev));

                case CURRENT.FULL: return (currentRight <= 0 && (prev === null || (Math.abs(currentRight) < Math.abs(prev))));

                case CURRENT.STILL_INSIDE: return (currentLeft <= -0.5 && (prev === null || (currentRight > prev)));
            }

        } else {

            if (this.options[option] === CURRENT.CLOSEST) {

                switch (direction) {

                    case "in": return (prev === null || Math.abs(currentLeft) < Math.abs(prev));

                    case "out": return (prev === null || Math.abs(currentRight) < Math.abs(prev));
                }
            }

            return (prev === null || Math.abs(currentLeft) < Math.abs(prev));
        }
    };

}(jQuery));
