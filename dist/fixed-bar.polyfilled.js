var FixedBar = (function () {
  'use strict';

  /**
   * Copyright 2016 Google Inc. All Rights Reserved.
   *
   * Licensed under the W3C SOFTWARE AND DOCUMENT NOTICE AND LICENSE.
   *
   *  https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   *
   */
  (function () {

    if (typeof window !== 'object') {
      return;
    } // Exit early if all IntersectionObserver and IntersectionObserverEntry
    // features are natively supported.


    if ('IntersectionObserver' in window && 'IntersectionObserverEntry' in window && 'intersectionRatio' in window.IntersectionObserverEntry.prototype) {
      // Minimal polyfill for Edge 15's lack of `isIntersecting`
      // See: https://github.com/w3c/IntersectionObserver/issues/211
      if (!('isIntersecting' in window.IntersectionObserverEntry.prototype)) {
        Object.defineProperty(window.IntersectionObserverEntry.prototype, 'isIntersecting', {
          get: function () {
            return this.intersectionRatio > 0;
          }
        });
      }

      return;
    }
    /**
     * Returns the embedding frame element, if any.
     * @param {!Document} doc
     * @return {!Element}
     */


    function getFrameElement(doc) {
      try {
        return doc.defaultView && doc.defaultView.frameElement || null;
      } catch (e) {
        // Ignore the error.
        return null;
      }
    }
    /**
     * A local reference to the root document.
     */


    var document = function (startDoc) {
      var doc = startDoc;
      var frame = getFrameElement(doc);

      while (frame) {
        doc = frame.ownerDocument;
        frame = getFrameElement(doc);
      }

      return doc;
    }(window.document);
    /**
     * An IntersectionObserver registry. This registry exists to hold a strong
     * reference to IntersectionObserver instances currently observing a target
     * element. Without this registry, instances without another reference may be
     * garbage collected.
     */


    var registry = [];
    /**
     * The signal updater for cross-origin intersection. When not null, it means
     * that the polyfill is configured to work in a cross-origin mode.
     * @type {function(DOMRect|ClientRect, DOMRect|ClientRect)}
     */

    var crossOriginUpdater = null;
    /**
     * The current cross-origin intersection. Only used in the cross-origin mode.
     * @type {DOMRect|ClientRect}
     */

    var crossOriginRect = null;
    /**
     * Creates the global IntersectionObserverEntry constructor.
     * https://w3c.github.io/IntersectionObserver/#intersection-observer-entry
     * @param {Object} entry A dictionary of instance properties.
     * @constructor
     */

    function IntersectionObserverEntry(entry) {
      this.time = entry.time;
      this.target = entry.target;
      this.rootBounds = ensureDOMRect(entry.rootBounds);
      this.boundingClientRect = ensureDOMRect(entry.boundingClientRect);
      this.intersectionRect = ensureDOMRect(entry.intersectionRect || getEmptyRect());
      this.isIntersecting = !!entry.intersectionRect; // Calculates the intersection ratio.

      var targetRect = this.boundingClientRect;
      var targetArea = targetRect.width * targetRect.height;
      var intersectionRect = this.intersectionRect;
      var intersectionArea = intersectionRect.width * intersectionRect.height; // Sets intersection ratio.

      if (targetArea) {
        // Round the intersection ratio to avoid floating point math issues:
        // https://github.com/w3c/IntersectionObserver/issues/324
        this.intersectionRatio = Number((intersectionArea / targetArea).toFixed(4));
      } else {
        // If area is zero and is intersecting, sets to 1, otherwise to 0
        this.intersectionRatio = this.isIntersecting ? 1 : 0;
      }
    }
    /**
     * Creates the global IntersectionObserver constructor.
     * https://w3c.github.io/IntersectionObserver/#intersection-observer-interface
     * @param {Function} callback The function to be invoked after intersection
     *     changes have queued. The function is not invoked if the queue has
     *     been emptied by calling the `takeRecords` method.
     * @param {Object=} opt_options Optional configuration options.
     * @constructor
     */


    function IntersectionObserver(callback, opt_options) {
      var options = opt_options || {};

      if (typeof callback != 'function') {
        throw new Error('callback must be a function');
      }

      if (options.root && options.root.nodeType != 1 && options.root.nodeType != 9) {
        throw new Error('root must be a Document or Element');
      } // Binds and throttles `this._checkForIntersections`.


      this._checkForIntersections = throttle(this._checkForIntersections.bind(this), this.THROTTLE_TIMEOUT); // Private properties.

      this._callback = callback;
      this._observationTargets = [];
      this._queuedEntries = [];
      this._rootMarginValues = this._parseRootMargin(options.rootMargin); // Public properties.

      this.thresholds = this._initThresholds(options.threshold);
      this.root = options.root || null;
      this.rootMargin = this._rootMarginValues.map(function (margin) {
        return margin.value + margin.unit;
      }).join(' ');
      /** @private @const {!Array<!Document>} */

      this._monitoringDocuments = [];
      /** @private @const {!Array<function()>} */

      this._monitoringUnsubscribes = [];
    }
    /**
     * The minimum interval within which the document will be checked for
     * intersection changes.
     */


    IntersectionObserver.prototype.THROTTLE_TIMEOUT = 100;
    /**
     * The frequency in which the polyfill polls for intersection changes.
     * this can be updated on a per instance basis and must be set prior to
     * calling `observe` on the first target.
     */

    IntersectionObserver.prototype.POLL_INTERVAL = null;
    /**
     * Use a mutation observer on the root element
     * to detect intersection changes.
     */

    IntersectionObserver.prototype.USE_MUTATION_OBSERVER = true;
    /**
     * Sets up the polyfill in the cross-origin mode. The result is the
     * updater function that accepts two arguments: `boundingClientRect` and
     * `intersectionRect` - just as these fields would be available to the
     * parent via `IntersectionObserverEntry`. This function should be called
     * each time the iframe receives intersection information from the parent
     * window, e.g. via messaging.
     * @return {function(DOMRect|ClientRect, DOMRect|ClientRect)}
     */

    IntersectionObserver._setupCrossOriginUpdater = function () {
      if (!crossOriginUpdater) {
        /**
         * @param {DOMRect|ClientRect} boundingClientRect
         * @param {DOMRect|ClientRect} intersectionRect
         */
        crossOriginUpdater = function (boundingClientRect, intersectionRect) {
          if (!boundingClientRect || !intersectionRect) {
            crossOriginRect = getEmptyRect();
          } else {
            crossOriginRect = convertFromParentRect(boundingClientRect, intersectionRect);
          }

          registry.forEach(function (observer) {
            observer._checkForIntersections();
          });
        };
      }

      return crossOriginUpdater;
    };
    /**
     * Resets the cross-origin mode.
     */


    IntersectionObserver._resetCrossOriginUpdater = function () {
      crossOriginUpdater = null;
      crossOriginRect = null;
    };
    /**
     * Starts observing a target element for intersection changes based on
     * the thresholds values.
     * @param {Element} target The DOM element to observe.
     */


    IntersectionObserver.prototype.observe = function (target) {
      var isTargetAlreadyObserved = this._observationTargets.some(function (item) {
        return item.element == target;
      });

      if (isTargetAlreadyObserved) {
        return;
      }

      if (!(target && target.nodeType == 1)) {
        throw new Error('target must be an Element');
      }

      this._registerInstance();

      this._observationTargets.push({
        element: target,
        entry: null
      });

      this._monitorIntersections(target.ownerDocument);

      this._checkForIntersections();
    };
    /**
     * Stops observing a target element for intersection changes.
     * @param {Element} target The DOM element to observe.
     */


    IntersectionObserver.prototype.unobserve = function (target) {
      this._observationTargets = this._observationTargets.filter(function (item) {
        return item.element != target;
      });

      this._unmonitorIntersections(target.ownerDocument);

      if (this._observationTargets.length == 0) {
        this._unregisterInstance();
      }
    };
    /**
     * Stops observing all target elements for intersection changes.
     */


    IntersectionObserver.prototype.disconnect = function () {
      this._observationTargets = [];

      this._unmonitorAllIntersections();

      this._unregisterInstance();
    };
    /**
     * Returns any queue entries that have not yet been reported to the
     * callback and clears the queue. This can be used in conjunction with the
     * callback to obtain the absolute most up-to-date intersection information.
     * @return {Array} The currently queued entries.
     */


    IntersectionObserver.prototype.takeRecords = function () {
      var records = this._queuedEntries.slice();

      this._queuedEntries = [];
      return records;
    };
    /**
     * Accepts the threshold value from the user configuration object and
     * returns a sorted array of unique threshold values. If a value is not
     * between 0 and 1 and error is thrown.
     * @private
     * @param {Array|number=} opt_threshold An optional threshold value or
     *     a list of threshold values, defaulting to [0].
     * @return {Array} A sorted list of unique and valid threshold values.
     */


    IntersectionObserver.prototype._initThresholds = function (opt_threshold) {
      var threshold = opt_threshold || [0];
      if (!Array.isArray(threshold)) threshold = [threshold];
      return threshold.sort().filter(function (t, i, a) {
        if (typeof t != 'number' || isNaN(t) || t < 0 || t > 1) {
          throw new Error('threshold must be a number between 0 and 1 inclusively');
        }

        return t !== a[i - 1];
      });
    };
    /**
     * Accepts the rootMargin value from the user configuration object
     * and returns an array of the four margin values as an object containing
     * the value and unit properties. If any of the values are not properly
     * formatted or use a unit other than px or %, and error is thrown.
     * @private
     * @param {string=} opt_rootMargin An optional rootMargin value,
     *     defaulting to '0px'.
     * @return {Array<Object>} An array of margin objects with the keys
     *     value and unit.
     */


    IntersectionObserver.prototype._parseRootMargin = function (opt_rootMargin) {
      var marginString = opt_rootMargin || '0px';
      var margins = marginString.split(/\s+/).map(function (margin) {
        var parts = /^(-?\d*\.?\d+)(px|%)$/.exec(margin);

        if (!parts) {
          throw new Error('rootMargin must be specified in pixels or percent');
        }

        return {
          value: parseFloat(parts[1]),
          unit: parts[2]
        };
      }); // Handles shorthand.

      margins[1] = margins[1] || margins[0];
      margins[2] = margins[2] || margins[0];
      margins[3] = margins[3] || margins[1];
      return margins;
    };
    /**
     * Starts polling for intersection changes if the polling is not already
     * happening, and if the page's visibility state is visible.
     * @param {!Document} doc
     * @private
     */


    IntersectionObserver.prototype._monitorIntersections = function (doc) {
      var win = doc.defaultView;

      if (!win) {
        // Already destroyed.
        return;
      }

      if (this._monitoringDocuments.indexOf(doc) != -1) {
        // Already monitoring.
        return;
      } // Private state for monitoring.


      var callback = this._checkForIntersections;
      var monitoringInterval = null;
      var domObserver = null; // If a poll interval is set, use polling instead of listening to
      // resize and scroll events or DOM mutations.

      if (this.POLL_INTERVAL) {
        monitoringInterval = win.setInterval(callback, this.POLL_INTERVAL);
      } else {
        addEvent(win, 'resize', callback, true);
        addEvent(doc, 'scroll', callback, true);

        if (this.USE_MUTATION_OBSERVER && 'MutationObserver' in win) {
          domObserver = new win.MutationObserver(callback);
          domObserver.observe(doc, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true
          });
        }
      }

      this._monitoringDocuments.push(doc);

      this._monitoringUnsubscribes.push(function () {
        // Get the window object again. When a friendly iframe is destroyed, it
        // will be null.
        var win = doc.defaultView;

        if (win) {
          if (monitoringInterval) {
            win.clearInterval(monitoringInterval);
          }

          removeEvent(win, 'resize', callback, true);
        }

        removeEvent(doc, 'scroll', callback, true);

        if (domObserver) {
          domObserver.disconnect();
        }
      }); // Also monitor the parent.


      var rootDoc = this.root && (this.root.ownerDocument || this.root) || document;

      if (doc != rootDoc) {
        var frame = getFrameElement(doc);

        if (frame) {
          this._monitorIntersections(frame.ownerDocument);
        }
      }
    };
    /**
     * Stops polling for intersection changes.
     * @param {!Document} doc
     * @private
     */


    IntersectionObserver.prototype._unmonitorIntersections = function (doc) {
      var index = this._monitoringDocuments.indexOf(doc);

      if (index == -1) {
        return;
      }

      var rootDoc = this.root && (this.root.ownerDocument || this.root) || document; // Check if any dependent targets are still remaining.

      var hasDependentTargets = this._observationTargets.some(function (item) {
        var itemDoc = item.element.ownerDocument; // Target is in this context.

        if (itemDoc == doc) {
          return true;
        } // Target is nested in this context.


        while (itemDoc && itemDoc != rootDoc) {
          var frame = getFrameElement(itemDoc);
          itemDoc = frame && frame.ownerDocument;

          if (itemDoc == doc) {
            return true;
          }
        }

        return false;
      });

      if (hasDependentTargets) {
        return;
      } // Unsubscribe.


      var unsubscribe = this._monitoringUnsubscribes[index];

      this._monitoringDocuments.splice(index, 1);

      this._monitoringUnsubscribes.splice(index, 1);

      unsubscribe(); // Also unmonitor the parent.

      if (doc != rootDoc) {
        var frame = getFrameElement(doc);

        if (frame) {
          this._unmonitorIntersections(frame.ownerDocument);
        }
      }
    };
    /**
     * Stops polling for intersection changes.
     * @param {!Document} doc
     * @private
     */


    IntersectionObserver.prototype._unmonitorAllIntersections = function () {
      var unsubscribes = this._monitoringUnsubscribes.slice(0);

      this._monitoringDocuments.length = 0;
      this._monitoringUnsubscribes.length = 0;

      for (var i = 0; i < unsubscribes.length; i++) {
        unsubscribes[i]();
      }
    };
    /**
     * Scans each observation target for intersection changes and adds them
     * to the internal entries queue. If new entries are found, it
     * schedules the callback to be invoked.
     * @private
     */


    IntersectionObserver.prototype._checkForIntersections = function () {
      if (!this.root && crossOriginUpdater && !crossOriginRect) {
        // Cross origin monitoring, but no initial data available yet.
        return;
      }

      var rootIsInDom = this._rootIsInDom();

      var rootRect = rootIsInDom ? this._getRootRect() : getEmptyRect();

      this._observationTargets.forEach(function (item) {
        var target = item.element;
        var targetRect = getBoundingClientRect(target);

        var rootContainsTarget = this._rootContainsTarget(target);

        var oldEntry = item.entry;

        var intersectionRect = rootIsInDom && rootContainsTarget && this._computeTargetAndRootIntersection(target, targetRect, rootRect);

        var rootBounds = null;

        if (!this._rootContainsTarget(target)) {
          rootBounds = getEmptyRect();
        } else if (!crossOriginUpdater || this.root) {
          rootBounds = rootRect;
        }

        var newEntry = item.entry = new IntersectionObserverEntry({
          time: now(),
          target: target,
          boundingClientRect: targetRect,
          rootBounds: rootBounds,
          intersectionRect: intersectionRect
        });

        if (!oldEntry) {
          this._queuedEntries.push(newEntry);
        } else if (rootIsInDom && rootContainsTarget) {
          // If the new entry intersection ratio has crossed any of the
          // thresholds, add a new entry.
          if (this._hasCrossedThreshold(oldEntry, newEntry)) {
            this._queuedEntries.push(newEntry);
          }
        } else {
          // If the root is not in the DOM or target is not contained within
          // root but the previous entry for this target had an intersection,
          // add a new record indicating removal.
          if (oldEntry && oldEntry.isIntersecting) {
            this._queuedEntries.push(newEntry);
          }
        }
      }, this);

      if (this._queuedEntries.length) {
        this._callback(this.takeRecords(), this);
      }
    };
    /**
     * Accepts a target and root rect computes the intersection between then
     * following the algorithm in the spec.
     * TODO(philipwalton): at this time clip-path is not considered.
     * https://w3c.github.io/IntersectionObserver/#calculate-intersection-rect-algo
     * @param {Element} target The target DOM element
     * @param {Object} targetRect The bounding rect of the target.
     * @param {Object} rootRect The bounding rect of the root after being
     *     expanded by the rootMargin value.
     * @return {?Object} The final intersection rect object or undefined if no
     *     intersection is found.
     * @private
     */


    IntersectionObserver.prototype._computeTargetAndRootIntersection = function (target, targetRect, rootRect) {
      // If the element isn't displayed, an intersection can't happen.
      if (window.getComputedStyle(target).display == 'none') return;
      var intersectionRect = targetRect;
      var parent = getParentNode(target);
      var atRoot = false;

      while (!atRoot && parent) {
        var parentRect = null;
        var parentComputedStyle = parent.nodeType == 1 ? window.getComputedStyle(parent) : {}; // If the parent isn't displayed, an intersection can't happen.

        if (parentComputedStyle.display == 'none') return null;

        if (parent == this.root || parent.nodeType ==
        /* DOCUMENT */
        9) {
          atRoot = true;

          if (parent == this.root || parent == document) {
            if (crossOriginUpdater && !this.root) {
              if (!crossOriginRect || crossOriginRect.width == 0 && crossOriginRect.height == 0) {
                // A 0-size cross-origin intersection means no-intersection.
                parent = null;
                parentRect = null;
                intersectionRect = null;
              } else {
                parentRect = crossOriginRect;
              }
            } else {
              parentRect = rootRect;
            }
          } else {
            // Check if there's a frame that can be navigated to.
            var frame = getParentNode(parent);
            var frameRect = frame && getBoundingClientRect(frame);

            var frameIntersect = frame && this._computeTargetAndRootIntersection(frame, frameRect, rootRect);

            if (frameRect && frameIntersect) {
              parent = frame;
              parentRect = convertFromParentRect(frameRect, frameIntersect);
            } else {
              parent = null;
              intersectionRect = null;
            }
          }
        } else {
          // If the element has a non-visible overflow, and it's not the <body>
          // or <html> element, update the intersection rect.
          // Note: <body> and <html> cannot be clipped to a rect that's not also
          // the document rect, so no need to compute a new intersection.
          var doc = parent.ownerDocument;

          if (parent != doc.body && parent != doc.documentElement && parentComputedStyle.overflow != 'visible') {
            parentRect = getBoundingClientRect(parent);
          }
        } // If either of the above conditionals set a new parentRect,
        // calculate new intersection data.


        if (parentRect) {
          intersectionRect = computeRectIntersection(parentRect, intersectionRect);
        }

        if (!intersectionRect) break;
        parent = parent && getParentNode(parent);
      }

      return intersectionRect;
    };
    /**
     * Returns the root rect after being expanded by the rootMargin value.
     * @return {ClientRect} The expanded root rect.
     * @private
     */


    IntersectionObserver.prototype._getRootRect = function () {
      var rootRect;

      if (this.root && !isDoc(this.root)) {
        rootRect = getBoundingClientRect(this.root);
      } else {
        // Use <html>/<body> instead of window since scroll bars affect size.
        var doc = isDoc(this.root) ? this.root : document;
        var html = doc.documentElement;
        var body = doc.body;
        rootRect = {
          top: 0,
          left: 0,
          right: html.clientWidth || body.clientWidth,
          width: html.clientWidth || body.clientWidth,
          bottom: html.clientHeight || body.clientHeight,
          height: html.clientHeight || body.clientHeight
        };
      }

      return this._expandRectByRootMargin(rootRect);
    };
    /**
     * Accepts a rect and expands it by the rootMargin value.
     * @param {DOMRect|ClientRect} rect The rect object to expand.
     * @return {ClientRect} The expanded rect.
     * @private
     */


    IntersectionObserver.prototype._expandRectByRootMargin = function (rect) {
      var margins = this._rootMarginValues.map(function (margin, i) {
        return margin.unit == 'px' ? margin.value : margin.value * (i % 2 ? rect.width : rect.height) / 100;
      });

      var newRect = {
        top: rect.top - margins[0],
        right: rect.right + margins[1],
        bottom: rect.bottom + margins[2],
        left: rect.left - margins[3]
      };
      newRect.width = newRect.right - newRect.left;
      newRect.height = newRect.bottom - newRect.top;
      return newRect;
    };
    /**
     * Accepts an old and new entry and returns true if at least one of the
     * threshold values has been crossed.
     * @param {?IntersectionObserverEntry} oldEntry The previous entry for a
     *    particular target element or null if no previous entry exists.
     * @param {IntersectionObserverEntry} newEntry The current entry for a
     *    particular target element.
     * @return {boolean} Returns true if a any threshold has been crossed.
     * @private
     */


    IntersectionObserver.prototype._hasCrossedThreshold = function (oldEntry, newEntry) {
      // To make comparing easier, an entry that has a ratio of 0
      // but does not actually intersect is given a value of -1
      var oldRatio = oldEntry && oldEntry.isIntersecting ? oldEntry.intersectionRatio || 0 : -1;
      var newRatio = newEntry.isIntersecting ? newEntry.intersectionRatio || 0 : -1; // Ignore unchanged ratios

      if (oldRatio === newRatio) return;

      for (var i = 0; i < this.thresholds.length; i++) {
        var threshold = this.thresholds[i]; // Return true if an entry matches a threshold or if the new ratio
        // and the old ratio are on the opposite sides of a threshold.

        if (threshold == oldRatio || threshold == newRatio || threshold < oldRatio !== threshold < newRatio) {
          return true;
        }
      }
    };
    /**
     * Returns whether or not the root element is an element and is in the DOM.
     * @return {boolean} True if the root element is an element and is in the DOM.
     * @private
     */


    IntersectionObserver.prototype._rootIsInDom = function () {
      return !this.root || containsDeep(document, this.root);
    };
    /**
     * Returns whether or not the target element is a child of root.
     * @param {Element} target The target element to check.
     * @return {boolean} True if the target element is a child of root.
     * @private
     */


    IntersectionObserver.prototype._rootContainsTarget = function (target) {
      var rootDoc = this.root && (this.root.ownerDocument || this.root) || document;
      return containsDeep(rootDoc, target) && (!this.root || rootDoc == target.ownerDocument);
    };
    /**
     * Adds the instance to the global IntersectionObserver registry if it isn't
     * already present.
     * @private
     */


    IntersectionObserver.prototype._registerInstance = function () {
      if (registry.indexOf(this) < 0) {
        registry.push(this);
      }
    };
    /**
     * Removes the instance from the global IntersectionObserver registry.
     * @private
     */


    IntersectionObserver.prototype._unregisterInstance = function () {
      var index = registry.indexOf(this);
      if (index != -1) registry.splice(index, 1);
    };
    /**
     * Returns the result of the performance.now() method or null in browsers
     * that don't support the API.
     * @return {number} The elapsed time since the page was requested.
     */


    function now() {
      return window.performance && performance.now && performance.now();
    }
    /**
     * Throttles a function and delays its execution, so it's only called at most
     * once within a given time period.
     * @param {Function} fn The function to throttle.
     * @param {number} timeout The amount of time that must pass before the
     *     function can be called again.
     * @return {Function} The throttled function.
     */


    function throttle(fn, timeout) {
      var timer = null;
      return function () {
        if (!timer) {
          timer = setTimeout(function () {
            fn();
            timer = null;
          }, timeout);
        }
      };
    }
    /**
     * Adds an event handler to a DOM node ensuring cross-browser compatibility.
     * @param {Node} node The DOM node to add the event handler to.
     * @param {string} event The event name.
     * @param {Function} fn The event handler to add.
     * @param {boolean} opt_useCapture Optionally adds the even to the capture
     *     phase. Note: this only works in modern browsers.
     */


    function addEvent(node, event, fn, opt_useCapture) {
      if (typeof node.addEventListener == 'function') {
        node.addEventListener(event, fn, opt_useCapture || false);
      } else if (typeof node.attachEvent == 'function') {
        node.attachEvent('on' + event, fn);
      }
    }
    /**
     * Removes a previously added event handler from a DOM node.
     * @param {Node} node The DOM node to remove the event handler from.
     * @param {string} event The event name.
     * @param {Function} fn The event handler to remove.
     * @param {boolean} opt_useCapture If the event handler was added with this
     *     flag set to true, it should be set to true here in order to remove it.
     */


    function removeEvent(node, event, fn, opt_useCapture) {
      if (typeof node.removeEventListener == 'function') {
        node.removeEventListener(event, fn, opt_useCapture || false);
      } else if (typeof node.detatchEvent == 'function') {
        node.detatchEvent('on' + event, fn);
      }
    }
    /**
     * Returns the intersection between two rect objects.
     * @param {Object} rect1 The first rect.
     * @param {Object} rect2 The second rect.
     * @return {?Object|?ClientRect} The intersection rect or undefined if no
     *     intersection is found.
     */


    function computeRectIntersection(rect1, rect2) {
      var top = Math.max(rect1.top, rect2.top);
      var bottom = Math.min(rect1.bottom, rect2.bottom);
      var left = Math.max(rect1.left, rect2.left);
      var right = Math.min(rect1.right, rect2.right);
      var width = right - left;
      var height = bottom - top;
      return width >= 0 && height >= 0 && {
        top: top,
        bottom: bottom,
        left: left,
        right: right,
        width: width,
        height: height
      } || null;
    }
    /**
     * Shims the native getBoundingClientRect for compatibility with older IE.
     * @param {Element} el The element whose bounding rect to get.
     * @return {DOMRect|ClientRect} The (possibly shimmed) rect of the element.
     */


    function getBoundingClientRect(el) {
      var rect;

      try {
        rect = el.getBoundingClientRect();
      } catch (err) {// Ignore Windows 7 IE11 "Unspecified error"
        // https://github.com/w3c/IntersectionObserver/pull/205
      }

      if (!rect) return getEmptyRect(); // Older IE

      if (!(rect.width && rect.height)) {
        rect = {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top
        };
      }

      return rect;
    }
    /**
     * Returns an empty rect object. An empty rect is returned when an element
     * is not in the DOM.
     * @return {ClientRect} The empty rect.
     */


    function getEmptyRect() {
      return {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0
      };
    }
    /**
     * Ensure that the result has all of the necessary fields of the DOMRect.
     * Specifically this ensures that `x` and `y` fields are set.
     *
     * @param {?DOMRect|?ClientRect} rect
     * @return {?DOMRect}
     */


    function ensureDOMRect(rect) {
      // A `DOMRect` object has `x` and `y` fields.
      if (!rect || 'x' in rect) {
        return rect;
      } // A IE's `ClientRect` type does not have `x` and `y`. The same is the case
      // for internally calculated Rect objects. For the purposes of
      // `IntersectionObserver`, it's sufficient to simply mirror `left` and `top`
      // for these fields.


      return {
        top: rect.top,
        y: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        x: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      };
    }
    /**
     * Inverts the intersection and bounding rect from the parent (frame) BCR to
     * the local BCR space.
     * @param {DOMRect|ClientRect} parentBoundingRect The parent's bound client rect.
     * @param {DOMRect|ClientRect} parentIntersectionRect The parent's own intersection rect.
     * @return {ClientRect} The local root bounding rect for the parent's children.
     */


    function convertFromParentRect(parentBoundingRect, parentIntersectionRect) {
      var top = parentIntersectionRect.top - parentBoundingRect.top;
      var left = parentIntersectionRect.left - parentBoundingRect.left;
      return {
        top: top,
        left: left,
        height: parentIntersectionRect.height,
        width: parentIntersectionRect.width,
        bottom: top + parentIntersectionRect.height,
        right: left + parentIntersectionRect.width
      };
    }
    /**
     * Checks to see if a parent element contains a child element (including inside
     * shadow DOM).
     * @param {Node} parent The parent element.
     * @param {Node} child The child element.
     * @return {boolean} True if the parent node contains the child node.
     */


    function containsDeep(parent, child) {
      var node = child;

      while (node) {
        if (node == parent) return true;
        node = getParentNode(node);
      }

      return false;
    }
    /**
     * Gets the parent node of an element or its host element if the parent node
     * is a shadow root.
     * @param {Node} node The node whose parent to get.
     * @return {Node|null} The parent node or null if no parent exists.
     */


    function getParentNode(node) {
      var parent = node.parentNode;

      if (node.nodeType ==
      /* DOCUMENT */
      9 && node != document) {
        // If this node is a document node, look for the embedding frame.
        return getFrameElement(node);
      } // If the parent has element that is assigned through shadow root slot


      if (parent && parent.assignedSlot) {
        parent = parent.assignedSlot.parentNode;
      }

      if (parent && parent.nodeType == 11 && parent.host) {
        // If the parent is a shadow root, return the host element.
        return parent.host;
      }

      return parent;
    }
    /**
     * Returns true if `node` is a Document.
     * @param {!Node} node
     * @returns {boolean}
     */


    function isDoc(node) {
      return node && node.nodeType === 9;
    } // Exposes the constructors globally.


    window.IntersectionObserver = IntersectionObserver;
    window.IntersectionObserverEntry = IntersectionObserverEntry;
  })();

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  (function (module, exports) {
  (function (global, factory) {
    factory() ;
  })(commonjsGlobal, function () {

    var _createClass = function () {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor) descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }

      return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);
        if (staticProps) defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();

    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    /**
     * This work is licensed under the W3C Software and Document License
     * (http://www.w3.org/Consortium/Legal/2015/copyright-software-and-document).
     */


    (function () {
      // Return early if we're not running inside of the browser.
      if (typeof window === 'undefined') {
        return;
      } // Convenience function for converting NodeLists.

      /** @type {typeof Array.prototype.slice} */


      var slice = Array.prototype.slice;
      /**
       * IE has a non-standard name for "matches".
       * @type {typeof Element.prototype.matches}
       */

      var matches = Element.prototype.matches || Element.prototype.msMatchesSelector;
      /** @type {string} */

      var _focusableElementsString = ['a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', 'button:not([disabled])', 'details', 'summary', 'iframe', 'object', 'embed', '[contenteditable]'].join(',');
      /**
       * `InertRoot` manages a single inert subtree, i.e. a DOM subtree whose root element has an `inert`
       * attribute.
       *
       * Its main functions are:
       *
       * - to create and maintain a set of managed `InertNode`s, including when mutations occur in the
       *   subtree. The `makeSubtreeUnfocusable()` method handles collecting `InertNode`s via registering
       *   each focusable node in the subtree with the singleton `InertManager` which manages all known
       *   focusable nodes within inert subtrees. `InertManager` ensures that a single `InertNode`
       *   instance exists for each focusable node which has at least one inert root as an ancestor.
       *
       * - to notify all managed `InertNode`s when this subtree stops being inert (i.e. when the `inert`
       *   attribute is removed from the root node). This is handled in the destructor, which calls the
       *   `deregister` method on `InertManager` for each managed inert node.
       */


      var InertRoot = function () {
        /**
         * @param {!Element} rootElement The Element at the root of the inert subtree.
         * @param {!InertManager} inertManager The global singleton InertManager object.
         */
        function InertRoot(rootElement, inertManager) {
          _classCallCheck(this, InertRoot);
          /** @type {!InertManager} */


          this._inertManager = inertManager;
          /** @type {!Element} */

          this._rootElement = rootElement;
          /**
           * @type {!Set<!InertNode>}
           * All managed focusable nodes in this InertRoot's subtree.
           */

          this._managedNodes = new Set(); // Make the subtree hidden from assistive technology

          if (this._rootElement.hasAttribute('aria-hidden')) {
            /** @type {?string} */
            this._savedAriaHidden = this._rootElement.getAttribute('aria-hidden');
          } else {
            this._savedAriaHidden = null;
          }

          this._rootElement.setAttribute('aria-hidden', 'true'); // Make all focusable elements in the subtree unfocusable and add them to _managedNodes


          this._makeSubtreeUnfocusable(this._rootElement); // Watch for:
          // - any additions in the subtree: make them unfocusable too
          // - any removals from the subtree: remove them from this inert root's managed nodes
          // - attribute changes: if `tabindex` is added, or removed from an intrinsically focusable
          //   element, make that node a managed node.


          this._observer = new MutationObserver(this._onMutation.bind(this));

          this._observer.observe(this._rootElement, {
            attributes: true,
            childList: true,
            subtree: true
          });
        }
        /**
         * Call this whenever this object is about to become obsolete.  This unwinds all of the state
         * stored in this object and updates the state of all of the managed nodes.
         */


        _createClass(InertRoot, [{
          key: 'destructor',
          value: function destructor() {
            this._observer.disconnect();

            if (this._rootElement) {
              if (this._savedAriaHidden !== null) {
                this._rootElement.setAttribute('aria-hidden', this._savedAriaHidden);
              } else {
                this._rootElement.removeAttribute('aria-hidden');
              }
            }

            this._managedNodes.forEach(function (inertNode) {
              this._unmanageNode(inertNode.node);
            }, this); // Note we cast the nulls to the ANY type here because:
            // 1) We want the class properties to be declared as non-null, or else we
            //    need even more casts throughout this code. All bets are off if an
            //    instance has been destroyed and a method is called.
            // 2) We don't want to cast "this", because we want type-aware optimizations
            //    to know which properties we're setting.


            this._observer =
            /** @type {?} */
            null;
            this._rootElement =
            /** @type {?} */
            null;
            this._managedNodes =
            /** @type {?} */
            null;
            this._inertManager =
            /** @type {?} */
            null;
          }
          /**
           * @return {!Set<!InertNode>} A copy of this InertRoot's managed nodes set.
           */

        }, {
          key: '_makeSubtreeUnfocusable',

          /**
           * @param {!Node} startNode
           */
          value: function _makeSubtreeUnfocusable(startNode) {
            var _this2 = this;

            composedTreeWalk(startNode, function (node) {
              return _this2._visitNode(node);
            });
            var activeElement = document.activeElement;

            if (!document.body.contains(startNode)) {
              // startNode may be in shadow DOM, so find its nearest shadowRoot to get the activeElement.
              var node = startNode;
              /** @type {!ShadowRoot|undefined} */

              var root = undefined;

              while (node) {
                if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                  root =
                  /** @type {!ShadowRoot} */
                  node;
                  break;
                }

                node = node.parentNode;
              }

              if (root) {
                activeElement = root.activeElement;
              }
            }

            if (startNode.contains(activeElement)) {
              activeElement.blur(); // In IE11, if an element is already focused, and then set to tabindex=-1
              // calling blur() will not actually move the focus.
              // To work around this we call focus() on the body instead.

              if (activeElement === document.activeElement) {
                document.body.focus();
              }
            }
          }
          /**
           * @param {!Node} node
           */

        }, {
          key: '_visitNode',
          value: function _visitNode(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }

            var element =
            /** @type {!Element} */
            node; // If a descendant inert root becomes un-inert, its descendants will still be inert because of
            // this inert root, so all of its managed nodes need to be adopted by this InertRoot.

            if (element !== this._rootElement && element.hasAttribute('inert')) {
              this._adoptInertRoot(element);
            }

            if (matches.call(element, _focusableElementsString) || element.hasAttribute('tabindex')) {
              this._manageNode(element);
            }
          }
          /**
           * Register the given node with this InertRoot and with InertManager.
           * @param {!Node} node
           */

        }, {
          key: '_manageNode',
          value: function _manageNode(node) {
            var inertNode = this._inertManager.register(node, this);

            this._managedNodes.add(inertNode);
          }
          /**
           * Unregister the given node with this InertRoot and with InertManager.
           * @param {!Node} node
           */

        }, {
          key: '_unmanageNode',
          value: function _unmanageNode(node) {
            var inertNode = this._inertManager.deregister(node, this);

            if (inertNode) {
              this._managedNodes['delete'](inertNode);
            }
          }
          /**
           * Unregister the entire subtree starting at `startNode`.
           * @param {!Node} startNode
           */

        }, {
          key: '_unmanageSubtree',
          value: function _unmanageSubtree(startNode) {
            var _this3 = this;

            composedTreeWalk(startNode, function (node) {
              return _this3._unmanageNode(node);
            });
          }
          /**
           * If a descendant node is found with an `inert` attribute, adopt its managed nodes.
           * @param {!Element} node
           */

        }, {
          key: '_adoptInertRoot',
          value: function _adoptInertRoot(node) {
            var inertSubroot = this._inertManager.getInertRoot(node); // During initialisation this inert root may not have been registered yet,
            // so register it now if need be.


            if (!inertSubroot) {
              this._inertManager.setInert(node, true);

              inertSubroot = this._inertManager.getInertRoot(node);
            }

            inertSubroot.managedNodes.forEach(function (savedInertNode) {
              this._manageNode(savedInertNode.node);
            }, this);
          }
          /**
           * Callback used when mutation observer detects subtree additions, removals, or attribute changes.
           * @param {!Array<!MutationRecord>} records
           * @param {!MutationObserver} self
           */

        }, {
          key: '_onMutation',
          value: function _onMutation(records, self) {
            records.forEach(function (record) {
              var target =
              /** @type {!Element} */
              record.target;

              if (record.type === 'childList') {
                // Manage added nodes
                slice.call(record.addedNodes).forEach(function (node) {
                  this._makeSubtreeUnfocusable(node);
                }, this); // Un-manage removed nodes

                slice.call(record.removedNodes).forEach(function (node) {
                  this._unmanageSubtree(node);
                }, this);
              } else if (record.type === 'attributes') {
                if (record.attributeName === 'tabindex') {
                  // Re-initialise inert node if tabindex changes
                  this._manageNode(target);
                } else if (target !== this._rootElement && record.attributeName === 'inert' && target.hasAttribute('inert')) {
                  // If a new inert root is added, adopt its managed nodes and make sure it knows about the
                  // already managed nodes from this inert subroot.
                  this._adoptInertRoot(target);

                  var inertSubroot = this._inertManager.getInertRoot(target);

                  this._managedNodes.forEach(function (managedNode) {
                    if (target.contains(managedNode.node)) {
                      inertSubroot._manageNode(managedNode.node);
                    }
                  });
                }
              }
            }, this);
          }
        }, {
          key: 'managedNodes',
          get: function get() {
            return new Set(this._managedNodes);
          }
          /** @return {boolean} */

        }, {
          key: 'hasSavedAriaHidden',
          get: function get() {
            return this._savedAriaHidden !== null;
          }
          /** @param {?string} ariaHidden */

        }, {
          key: 'savedAriaHidden',
          set: function set(ariaHidden) {
            this._savedAriaHidden = ariaHidden;
          }
          /** @return {?string} */
          ,
          get: function get() {
            return this._savedAriaHidden;
          }
        }]);

        return InertRoot;
      }();
      /**
       * `InertNode` initialises and manages a single inert node.
       * A node is inert if it is a descendant of one or more inert root elements.
       *
       * On construction, `InertNode` saves the existing `tabindex` value for the node, if any, and
       * either removes the `tabindex` attribute or sets it to `-1`, depending on whether the element
       * is intrinsically focusable or not.
       *
       * `InertNode` maintains a set of `InertRoot`s which are descendants of this `InertNode`. When an
       * `InertRoot` is destroyed, and calls `InertManager.deregister()`, the `InertManager` notifies the
       * `InertNode` via `removeInertRoot()`, which in turn destroys the `InertNode` if no `InertRoot`s
       * remain in the set. On destruction, `InertNode` reinstates the stored `tabindex` if one exists,
       * or removes the `tabindex` attribute if the element is intrinsically focusable.
       */


      var InertNode = function () {
        /**
         * @param {!Node} node A focusable element to be made inert.
         * @param {!InertRoot} inertRoot The inert root element associated with this inert node.
         */
        function InertNode(node, inertRoot) {
          _classCallCheck(this, InertNode);
          /** @type {!Node} */


          this._node = node;
          /** @type {boolean} */

          this._overrodeFocusMethod = false;
          /**
           * @type {!Set<!InertRoot>} The set of descendant inert roots.
           *    If and only if this set becomes empty, this node is no longer inert.
           */

          this._inertRoots = new Set([inertRoot]);
          /** @type {?number} */

          this._savedTabIndex = null;
          /** @type {boolean} */

          this._destroyed = false; // Save any prior tabindex info and make this node untabbable

          this.ensureUntabbable();
        }
        /**
         * Call this whenever this object is about to become obsolete.
         * This makes the managed node focusable again and deletes all of the previously stored state.
         */


        _createClass(InertNode, [{
          key: 'destructor',
          value: function destructor() {
            this._throwIfDestroyed();

            if (this._node && this._node.nodeType === Node.ELEMENT_NODE) {
              var element =
              /** @type {!Element} */
              this._node;

              if (this._savedTabIndex !== null) {
                element.setAttribute('tabindex', this._savedTabIndex);
              } else {
                element.removeAttribute('tabindex');
              } // Use `delete` to restore native focus method.


              if (this._overrodeFocusMethod) {
                delete element.focus;
              }
            } // See note in InertRoot.destructor for why we cast these nulls to ANY.


            this._node =
            /** @type {?} */
            null;
            this._inertRoots =
            /** @type {?} */
            null;
            this._destroyed = true;
          }
          /**
           * @type {boolean} Whether this object is obsolete because the managed node is no longer inert.
           * If the object has been destroyed, any attempt to access it will cause an exception.
           */

        }, {
          key: '_throwIfDestroyed',

          /**
           * Throw if user tries to access destroyed InertNode.
           */
          value: function _throwIfDestroyed() {
            if (this.destroyed) {
              throw new Error('Trying to access destroyed InertNode');
            }
          }
          /** @return {boolean} */

        }, {
          key: 'ensureUntabbable',

          /** Save the existing tabindex value and make the node untabbable and unfocusable */
          value: function ensureUntabbable() {
            if (this.node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }

            var element =
            /** @type {!Element} */
            this.node;

            if (matches.call(element, _focusableElementsString)) {
              if (
              /** @type {!HTMLElement} */
              element.tabIndex === -1 && this.hasSavedTabIndex) {
                return;
              }

              if (element.hasAttribute('tabindex')) {
                this._savedTabIndex =
                /** @type {!HTMLElement} */
                element.tabIndex;
              }

              element.setAttribute('tabindex', '-1');

              if (element.nodeType === Node.ELEMENT_NODE) {
                element.focus = function () {};

                this._overrodeFocusMethod = true;
              }
            } else if (element.hasAttribute('tabindex')) {
              this._savedTabIndex =
              /** @type {!HTMLElement} */
              element.tabIndex;
              element.removeAttribute('tabindex');
            }
          }
          /**
           * Add another inert root to this inert node's set of managing inert roots.
           * @param {!InertRoot} inertRoot
           */

        }, {
          key: 'addInertRoot',
          value: function addInertRoot(inertRoot) {
            this._throwIfDestroyed();

            this._inertRoots.add(inertRoot);
          }
          /**
           * Remove the given inert root from this inert node's set of managing inert roots.
           * If the set of managing inert roots becomes empty, this node is no longer inert,
           * so the object should be destroyed.
           * @param {!InertRoot} inertRoot
           */

        }, {
          key: 'removeInertRoot',
          value: function removeInertRoot(inertRoot) {
            this._throwIfDestroyed();

            this._inertRoots['delete'](inertRoot);

            if (this._inertRoots.size === 0) {
              this.destructor();
            }
          }
        }, {
          key: 'destroyed',
          get: function get() {
            return (
              /** @type {!InertNode} */
              this._destroyed
            );
          }
        }, {
          key: 'hasSavedTabIndex',
          get: function get() {
            return this._savedTabIndex !== null;
          }
          /** @return {!Node} */

        }, {
          key: 'node',
          get: function get() {
            this._throwIfDestroyed();

            return this._node;
          }
          /** @param {?number} tabIndex */

        }, {
          key: 'savedTabIndex',
          set: function set(tabIndex) {
            this._throwIfDestroyed();

            this._savedTabIndex = tabIndex;
          }
          /** @return {?number} */
          ,
          get: function get() {
            this._throwIfDestroyed();

            return this._savedTabIndex;
          }
        }]);

        return InertNode;
      }();
      /**
       * InertManager is a per-document singleton object which manages all inert roots and nodes.
       *
       * When an element becomes an inert root by having an `inert` attribute set and/or its `inert`
       * property set to `true`, the `setInert` method creates an `InertRoot` object for the element.
       * The `InertRoot` in turn registers itself as managing all of the element's focusable descendant
       * nodes via the `register()` method. The `InertManager` ensures that a single `InertNode` instance
       * is created for each such node, via the `_managedNodes` map.
       */


      var InertManager = function () {
        /**
         * @param {!Document} document
         */
        function InertManager(document) {
          _classCallCheck(this, InertManager);

          if (!document) {
            throw new Error('Missing required argument; InertManager needs to wrap a document.');
          }
          /** @type {!Document} */


          this._document = document;
          /**
           * All managed nodes known to this InertManager. In a map to allow looking up by Node.
           * @type {!Map<!Node, !InertNode>}
           */

          this._managedNodes = new Map();
          /**
           * All inert roots known to this InertManager. In a map to allow looking up by Node.
           * @type {!Map<!Node, !InertRoot>}
           */

          this._inertRoots = new Map();
          /**
           * Observer for mutations on `document.body`.
           * @type {!MutationObserver}
           */

          this._observer = new MutationObserver(this._watchForInert.bind(this)); // Add inert style.

          addInertStyle(document.head || document.body || document.documentElement); // Wait for document to be loaded.

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this._onDocumentLoaded.bind(this));
          } else {
            this._onDocumentLoaded();
          }
        }
        /**
         * Set whether the given element should be an inert root or not.
         * @param {!Element} root
         * @param {boolean} inert
         */


        _createClass(InertManager, [{
          key: 'setInert',
          value: function setInert(root, inert) {
            if (inert) {
              if (this._inertRoots.has(root)) {
                // element is already inert
                return;
              }

              var inertRoot = new InertRoot(root, this);
              root.setAttribute('inert', '');

              this._inertRoots.set(root, inertRoot); // If not contained in the document, it must be in a shadowRoot.
              // Ensure inert styles are added there.


              if (!this._document.body.contains(root)) {
                var parent = root.parentNode;

                while (parent) {
                  if (parent.nodeType === 11) {
                    addInertStyle(parent);
                  }

                  parent = parent.parentNode;
                }
              }
            } else {
              if (!this._inertRoots.has(root)) {
                // element is already non-inert
                return;
              }

              var _inertRoot = this._inertRoots.get(root);

              _inertRoot.destructor();

              this._inertRoots['delete'](root);

              root.removeAttribute('inert');
            }
          }
          /**
           * Get the InertRoot object corresponding to the given inert root element, if any.
           * @param {!Node} element
           * @return {!InertRoot|undefined}
           */

        }, {
          key: 'getInertRoot',
          value: function getInertRoot(element) {
            return this._inertRoots.get(element);
          }
          /**
           * Register the given InertRoot as managing the given node.
           * In the case where the node has a previously existing inert root, this inert root will
           * be added to its set of inert roots.
           * @param {!Node} node
           * @param {!InertRoot} inertRoot
           * @return {!InertNode} inertNode
           */

        }, {
          key: 'register',
          value: function register(node, inertRoot) {
            var inertNode = this._managedNodes.get(node);

            if (inertNode !== undefined) {
              // node was already in an inert subtree
              inertNode.addInertRoot(inertRoot);
            } else {
              inertNode = new InertNode(node, inertRoot);
            }

            this._managedNodes.set(node, inertNode);

            return inertNode;
          }
          /**
           * De-register the given InertRoot as managing the given inert node.
           * Removes the inert root from the InertNode's set of managing inert roots, and remove the inert
           * node from the InertManager's set of managed nodes if it is destroyed.
           * If the node is not currently managed, this is essentially a no-op.
           * @param {!Node} node
           * @param {!InertRoot} inertRoot
           * @return {?InertNode} The potentially destroyed InertNode associated with this node, if any.
           */

        }, {
          key: 'deregister',
          value: function deregister(node, inertRoot) {
            var inertNode = this._managedNodes.get(node);

            if (!inertNode) {
              return null;
            }

            inertNode.removeInertRoot(inertRoot);

            if (inertNode.destroyed) {
              this._managedNodes['delete'](node);
            }

            return inertNode;
          }
          /**
           * Callback used when document has finished loading.
           */

        }, {
          key: '_onDocumentLoaded',
          value: function _onDocumentLoaded() {
            // Find all inert roots in document and make them actually inert.
            var inertElements = slice.call(this._document.querySelectorAll('[inert]'));
            inertElements.forEach(function (inertElement) {
              this.setInert(inertElement, true);
            }, this); // Comment this out to use programmatic API only.

            this._observer.observe(this._document.body || this._document.documentElement, {
              attributes: true,
              subtree: true,
              childList: true
            });
          }
          /**
           * Callback used when mutation observer detects attribute changes.
           * @param {!Array<!MutationRecord>} records
           * @param {!MutationObserver} self
           */

        }, {
          key: '_watchForInert',
          value: function _watchForInert(records, self) {
            var _this = this;

            records.forEach(function (record) {
              switch (record.type) {
                case 'childList':
                  slice.call(record.addedNodes).forEach(function (node) {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                      return;
                    }

                    var inertElements = slice.call(node.querySelectorAll('[inert]'));

                    if (matches.call(node, '[inert]')) {
                      inertElements.unshift(node);
                    }

                    inertElements.forEach(function (inertElement) {
                      this.setInert(inertElement, true);
                    }, _this);
                  }, _this);
                  break;

                case 'attributes':
                  if (record.attributeName !== 'inert') {
                    return;
                  }

                  var target =
                  /** @type {!Element} */
                  record.target;
                  var inert = target.hasAttribute('inert');

                  _this.setInert(target, inert);

                  break;
              }
            }, this);
          }
        }]);

        return InertManager;
      }();
      /**
       * Recursively walk the composed tree from |node|.
       * @param {!Node} node
       * @param {(function (!Element))=} callback Callback to be called for each element traversed,
       *     before descending into child nodes.
       * @param {?ShadowRoot=} shadowRootAncestor The nearest ShadowRoot ancestor, if any.
       */


      function composedTreeWalk(node, callback, shadowRootAncestor) {
        if (node.nodeType == Node.ELEMENT_NODE) {
          var element =
          /** @type {!Element} */
          node;

          if (callback) {
            callback(element);
          } // Descend into node:
          // If it has a ShadowRoot, ignore all child elements - these will be picked
          // up by the <content> or <shadow> elements. Descend straight into the
          // ShadowRoot.


          var shadowRoot =
          /** @type {!HTMLElement} */
          element.shadowRoot;

          if (shadowRoot) {
            composedTreeWalk(shadowRoot, callback);
            return;
          } // If it is a <content> element, descend into distributed elements - these
          // are elements from outside the shadow root which are rendered inside the
          // shadow DOM.


          if (element.localName == 'content') {
            var content =
            /** @type {!HTMLContentElement} */
            element; // Verifies if ShadowDom v0 is supported.

            var distributedNodes = content.getDistributedNodes ? content.getDistributedNodes() : [];

            for (var i = 0; i < distributedNodes.length; i++) {
              composedTreeWalk(distributedNodes[i], callback);
            }

            return;
          } // If it is a <slot> element, descend into assigned nodes - these
          // are elements from outside the shadow root which are rendered inside the
          // shadow DOM.


          if (element.localName == 'slot') {
            var slot =
            /** @type {!HTMLSlotElement} */
            element; // Verify if ShadowDom v1 is supported.

            var _distributedNodes = slot.assignedNodes ? slot.assignedNodes({
              flatten: true
            }) : [];

            for (var _i = 0; _i < _distributedNodes.length; _i++) {
              composedTreeWalk(_distributedNodes[_i], callback);
            }

            return;
          }
        } // If it is neither the parent of a ShadowRoot, a <content> element, a <slot>
        // element, nor a <shadow> element recurse normally.


        var child = node.firstChild;

        while (child != null) {
          composedTreeWalk(child, callback);
          child = child.nextSibling;
        }
      }
      /**
       * Adds a style element to the node containing the inert specific styles
       * @param {!Node} node
       */


      function addInertStyle(node) {
        if (node.querySelector('style#inert-style, link#inert-style')) {
          return;
        }

        var style = document.createElement('style');
        style.setAttribute('id', 'inert-style');
        style.textContent = '\n' + '[inert] {\n' + '  pointer-events: none;\n' + '  cursor: default;\n' + '}\n' + '\n' + '[inert], [inert] * {\n' + '  -webkit-user-select: none;\n' + '  -moz-user-select: none;\n' + '  -ms-user-select: none;\n' + '  user-select: none;\n' + '}\n';
        node.appendChild(style);
      }

      if (!Element.prototype.hasOwnProperty('inert')) {
        /** @type {!InertManager} */
        var inertManager = new InertManager(document);
        Object.defineProperty(Element.prototype, 'inert', {
          enumerable: true,

          /** @this {!Element} */
          get: function get() {
            return this.hasAttribute('inert');
          },

          /** @this {!Element} */
          set: function set(inert) {
            inertManager.setInert(this, inert);
          }
        });
      }
    })();
  });
  }());

  class FixedBar {
    constructor(args) {
      this.isExpanded = false;
      this.reverse = false;
      this.revivalTimer = undefined;
      this.isClosedEternally = false;
      this.freezed = false;
      this.intersectionObserveOption = {};
      if (typeof args.bar !== 'string') throw new Error(``);
      this.bar = document.querySelector(args.bar);
      if (!this.bar) throw new Error(``);

      this._switchState(this.isExpanded);

      if (typeof args.range !== 'string') throw new Error(``);
      this.ranges = document.querySelectorAll(args.range);
      if (!this.ranges) throw new Error(``);
      if (typeof args.reverse !== 'undefined') this.reverse = args.reverse;

      if (typeof args.intersectionObserveOption !== 'undefined') {
        this.intersectionObserveOption = args.intersectionObserveOption;
      }

      this.observer = new IntersectionObserver(this._observe.bind(this), this.intersectionObserveOption);

      for (let i = 0; i < this.ranges.length; i++) {
        this.observer.observe(this.ranges[i]);
      }
    }

    _observe(entries) {
      if (this.revivalTimer || this.isClosedEternally || this.freezed) return;
      let isIntersecting = false;

      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          isIntersecting = true;
          break;
        }
      }

      if (!this.reverse && isIntersecting || this.reverse && !isIntersecting) {
        this.open();
      } else {
        this.close();
      }
    }

    open() {
      this.isExpanded = true;

      this._switchState(true);

      this.isClosedEternally = false;
      if (this.revivalTimer) window.clearTimeout(this.revivalTimer);
    }

    close(time) {
      this.isExpanded = false;

      this._switchState(false);

      if (typeof time === 'number' && time === 0) {
        this.isClosedEternally = true;
      } else if (typeof time === 'number' && time > 0) {
        this.revivalTimer = window.setTimeout(() => {
          window.clearTimeout(this.revivalTimer);
        }, time);
      }
    }

    freeze(isExpanded = true) {
      isExpanded ? this.open() : this.close();
      this.freezed = true;
    }

    restart() {
      this.freezed = false;
    }

    _switchState(isExpanded) {
      var _this$bar;

      (_this$bar = this.bar) === null || _this$bar === void 0 ? void 0 : _this$bar.setAttribute('aria-hidden', String(!isExpanded));

      if (isExpanded) {
        var _this$bar2, _this$bar3;

        (_this$bar2 = this.bar) === null || _this$bar2 === void 0 ? void 0 : _this$bar2.removeAttribute('hidden');
        (_this$bar3 = this.bar) === null || _this$bar3 === void 0 ? void 0 : _this$bar3.removeAttribute('inert');
      } else {
        var _this$bar4, _this$bar5;

        (_this$bar4 = this.bar) === null || _this$bar4 === void 0 ? void 0 : _this$bar4.setAttribute('hidden', '');
        (_this$bar5 = this.bar) === null || _this$bar5 === void 0 ? void 0 : _this$bar5.setAttribute('inert', '');
      }
    }

  }

  return FixedBar;

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZWQtYmFyLnBvbHlmaWxsZWQuanMiLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9pbnRlcnNlY3Rpb24tb2JzZXJ2ZXIvaW50ZXJzZWN0aW9uLW9ic2VydmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3dpY2ctaW5lcnQvZGlzdC9pbmVydC5qcyIsIi4uL3NyYy90cy9maXhlZC1iYXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNiBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBXM0MgU09GVFdBUkUgQU5EIERPQ1VNRU5UIE5PVElDRSBBTkQgTElDRU5TRS5cbiAqXG4gKiAgaHR0cHM6Ly93d3cudzMub3JnL0NvbnNvcnRpdW0vTGVnYWwvMjAxNS9jb3B5cmlnaHQtc29mdHdhcmUtYW5kLWRvY3VtZW50XG4gKlxuICovXG4oZnVuY3Rpb24oKSB7XG4ndXNlIHN0cmljdCc7XG5cbi8vIEV4aXQgZWFybHkgaWYgd2UncmUgbm90IHJ1bm5pbmcgaW4gYSBicm93c2VyLlxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICdvYmplY3QnKSB7XG4gIHJldHVybjtcbn1cblxuLy8gRXhpdCBlYXJseSBpZiBhbGwgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIgYW5kIEludGVyc2VjdGlvbk9ic2VydmVyRW50cnlcbi8vIGZlYXR1cmVzIGFyZSBuYXRpdmVseSBzdXBwb3J0ZWQuXG5pZiAoJ0ludGVyc2VjdGlvbk9ic2VydmVyJyBpbiB3aW5kb3cgJiZcbiAgICAnSW50ZXJzZWN0aW9uT2JzZXJ2ZXJFbnRyeScgaW4gd2luZG93ICYmXG4gICAgJ2ludGVyc2VjdGlvblJhdGlvJyBpbiB3aW5kb3cuSW50ZXJzZWN0aW9uT2JzZXJ2ZXJFbnRyeS5wcm90b3R5cGUpIHtcblxuICAvLyBNaW5pbWFsIHBvbHlmaWxsIGZvciBFZGdlIDE1J3MgbGFjayBvZiBgaXNJbnRlcnNlY3RpbmdgXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3czYy9JbnRlcnNlY3Rpb25PYnNlcnZlci9pc3N1ZXMvMjExXG4gIGlmICghKCdpc0ludGVyc2VjdGluZycgaW4gd2luZG93LkludGVyc2VjdGlvbk9ic2VydmVyRW50cnkucHJvdG90eXBlKSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh3aW5kb3cuSW50ZXJzZWN0aW9uT2JzZXJ2ZXJFbnRyeS5wcm90b3R5cGUsXG4gICAgICAnaXNJbnRlcnNlY3RpbmcnLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW50ZXJzZWN0aW9uUmF0aW8gPiAwO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybjtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBlbWJlZGRpbmcgZnJhbWUgZWxlbWVudCwgaWYgYW55LlxuICogQHBhcmFtIHshRG9jdW1lbnR9IGRvY1xuICogQHJldHVybiB7IUVsZW1lbnR9XG4gKi9cbmZ1bmN0aW9uIGdldEZyYW1lRWxlbWVudChkb2MpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZG9jLmRlZmF1bHRWaWV3ICYmIGRvYy5kZWZhdWx0Vmlldy5mcmFtZUVsZW1lbnQgfHwgbnVsbDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIElnbm9yZSB0aGUgZXJyb3IuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGxvY2FsIHJlZmVyZW5jZSB0byB0aGUgcm9vdCBkb2N1bWVudC5cbiAqL1xudmFyIGRvY3VtZW50ID0gKGZ1bmN0aW9uKHN0YXJ0RG9jKSB7XG4gIHZhciBkb2MgPSBzdGFydERvYztcbiAgdmFyIGZyYW1lID0gZ2V0RnJhbWVFbGVtZW50KGRvYyk7XG4gIHdoaWxlIChmcmFtZSkge1xuICAgIGRvYyA9IGZyYW1lLm93bmVyRG9jdW1lbnQ7XG4gICAgZnJhbWUgPSBnZXRGcmFtZUVsZW1lbnQoZG9jKTtcbiAgfVxuICByZXR1cm4gZG9jO1xufSkod2luZG93LmRvY3VtZW50KTtcblxuLyoqXG4gKiBBbiBJbnRlcnNlY3Rpb25PYnNlcnZlciByZWdpc3RyeS4gVGhpcyByZWdpc3RyeSBleGlzdHMgdG8gaG9sZCBhIHN0cm9uZ1xuICogcmVmZXJlbmNlIHRvIEludGVyc2VjdGlvbk9ic2VydmVyIGluc3RhbmNlcyBjdXJyZW50bHkgb2JzZXJ2aW5nIGEgdGFyZ2V0XG4gKiBlbGVtZW50LiBXaXRob3V0IHRoaXMgcmVnaXN0cnksIGluc3RhbmNlcyB3aXRob3V0IGFub3RoZXIgcmVmZXJlbmNlIG1heSBiZVxuICogZ2FyYmFnZSBjb2xsZWN0ZWQuXG4gKi9cbnZhciByZWdpc3RyeSA9IFtdO1xuXG4vKipcbiAqIFRoZSBzaWduYWwgdXBkYXRlciBmb3IgY3Jvc3Mtb3JpZ2luIGludGVyc2VjdGlvbi4gV2hlbiBub3QgbnVsbCwgaXQgbWVhbnNcbiAqIHRoYXQgdGhlIHBvbHlmaWxsIGlzIGNvbmZpZ3VyZWQgdG8gd29yayBpbiBhIGNyb3NzLW9yaWdpbiBtb2RlLlxuICogQHR5cGUge2Z1bmN0aW9uKERPTVJlY3R8Q2xpZW50UmVjdCwgRE9NUmVjdHxDbGllbnRSZWN0KX1cbiAqL1xudmFyIGNyb3NzT3JpZ2luVXBkYXRlciA9IG51bGw7XG5cbi8qKlxuICogVGhlIGN1cnJlbnQgY3Jvc3Mtb3JpZ2luIGludGVyc2VjdGlvbi4gT25seSB1c2VkIGluIHRoZSBjcm9zcy1vcmlnaW4gbW9kZS5cbiAqIEB0eXBlIHtET01SZWN0fENsaWVudFJlY3R9XG4gKi9cbnZhciBjcm9zc09yaWdpblJlY3QgPSBudWxsO1xuXG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgZ2xvYmFsIEludGVyc2VjdGlvbk9ic2VydmVyRW50cnkgY29uc3RydWN0b3IuXG4gKiBodHRwczovL3czYy5naXRodWIuaW8vSW50ZXJzZWN0aW9uT2JzZXJ2ZXIvI2ludGVyc2VjdGlvbi1vYnNlcnZlci1lbnRyeVxuICogQHBhcmFtIHtPYmplY3R9IGVudHJ5IEEgZGljdGlvbmFyeSBvZiBpbnN0YW5jZSBwcm9wZXJ0aWVzLlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEludGVyc2VjdGlvbk9ic2VydmVyRW50cnkoZW50cnkpIHtcbiAgdGhpcy50aW1lID0gZW50cnkudGltZTtcbiAgdGhpcy50YXJnZXQgPSBlbnRyeS50YXJnZXQ7XG4gIHRoaXMucm9vdEJvdW5kcyA9IGVuc3VyZURPTVJlY3QoZW50cnkucm9vdEJvdW5kcyk7XG4gIHRoaXMuYm91bmRpbmdDbGllbnRSZWN0ID0gZW5zdXJlRE9NUmVjdChlbnRyeS5ib3VuZGluZ0NsaWVudFJlY3QpO1xuICB0aGlzLmludGVyc2VjdGlvblJlY3QgPSBlbnN1cmVET01SZWN0KGVudHJ5LmludGVyc2VjdGlvblJlY3QgfHwgZ2V0RW1wdHlSZWN0KCkpO1xuICB0aGlzLmlzSW50ZXJzZWN0aW5nID0gISFlbnRyeS5pbnRlcnNlY3Rpb25SZWN0O1xuXG4gIC8vIENhbGN1bGF0ZXMgdGhlIGludGVyc2VjdGlvbiByYXRpby5cbiAgdmFyIHRhcmdldFJlY3QgPSB0aGlzLmJvdW5kaW5nQ2xpZW50UmVjdDtcbiAgdmFyIHRhcmdldEFyZWEgPSB0YXJnZXRSZWN0LndpZHRoICogdGFyZ2V0UmVjdC5oZWlnaHQ7XG4gIHZhciBpbnRlcnNlY3Rpb25SZWN0ID0gdGhpcy5pbnRlcnNlY3Rpb25SZWN0O1xuICB2YXIgaW50ZXJzZWN0aW9uQXJlYSA9IGludGVyc2VjdGlvblJlY3Qud2lkdGggKiBpbnRlcnNlY3Rpb25SZWN0LmhlaWdodDtcblxuICAvLyBTZXRzIGludGVyc2VjdGlvbiByYXRpby5cbiAgaWYgKHRhcmdldEFyZWEpIHtcbiAgICAvLyBSb3VuZCB0aGUgaW50ZXJzZWN0aW9uIHJhdGlvIHRvIGF2b2lkIGZsb2F0aW5nIHBvaW50IG1hdGggaXNzdWVzOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93M2MvSW50ZXJzZWN0aW9uT2JzZXJ2ZXIvaXNzdWVzLzMyNFxuICAgIHRoaXMuaW50ZXJzZWN0aW9uUmF0aW8gPSBOdW1iZXIoKGludGVyc2VjdGlvbkFyZWEgLyB0YXJnZXRBcmVhKS50b0ZpeGVkKDQpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBJZiBhcmVhIGlzIHplcm8gYW5kIGlzIGludGVyc2VjdGluZywgc2V0cyB0byAxLCBvdGhlcndpc2UgdG8gMFxuICAgIHRoaXMuaW50ZXJzZWN0aW9uUmF0aW8gPSB0aGlzLmlzSW50ZXJzZWN0aW5nID8gMSA6IDA7XG4gIH1cbn1cblxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIGdsb2JhbCBJbnRlcnNlY3Rpb25PYnNlcnZlciBjb25zdHJ1Y3Rvci5cbiAqIGh0dHBzOi8vdzNjLmdpdGh1Yi5pby9JbnRlcnNlY3Rpb25PYnNlcnZlci8jaW50ZXJzZWN0aW9uLW9ic2VydmVyLWludGVyZmFjZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGJlIGludm9rZWQgYWZ0ZXIgaW50ZXJzZWN0aW9uXG4gKiAgICAgY2hhbmdlcyBoYXZlIHF1ZXVlZC4gVGhlIGZ1bmN0aW9uIGlzIG5vdCBpbnZva2VkIGlmIHRoZSBxdWV1ZSBoYXNcbiAqICAgICBiZWVuIGVtcHRpZWQgYnkgY2FsbGluZyB0aGUgYHRha2VSZWNvcmRzYCBtZXRob2QuXG4gKiBAcGFyYW0ge09iamVjdD19IG9wdF9vcHRpb25zIE9wdGlvbmFsIGNvbmZpZ3VyYXRpb24gb3B0aW9ucy5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBJbnRlcnNlY3Rpb25PYnNlcnZlcihjYWxsYmFjaywgb3B0X29wdGlvbnMpIHtcblxuICB2YXIgb3B0aW9ucyA9IG9wdF9vcHRpb25zIHx8IHt9O1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBFcnJvcignY2FsbGJhY2sgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gIH1cblxuICBpZiAoXG4gICAgb3B0aW9ucy5yb290ICYmXG4gICAgb3B0aW9ucy5yb290Lm5vZGVUeXBlICE9IDEgJiZcbiAgICBvcHRpb25zLnJvb3Qubm9kZVR5cGUgIT0gOVxuICApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3QgbXVzdCBiZSBhIERvY3VtZW50IG9yIEVsZW1lbnQnKTtcbiAgfVxuXG4gIC8vIEJpbmRzIGFuZCB0aHJvdHRsZXMgYHRoaXMuX2NoZWNrRm9ySW50ZXJzZWN0aW9uc2AuXG4gIHRoaXMuX2NoZWNrRm9ySW50ZXJzZWN0aW9ucyA9IHRocm90dGxlKFxuICAgICAgdGhpcy5fY2hlY2tGb3JJbnRlcnNlY3Rpb25zLmJpbmQodGhpcyksIHRoaXMuVEhST1RUTEVfVElNRU9VVCk7XG5cbiAgLy8gUHJpdmF0ZSBwcm9wZXJ0aWVzLlxuICB0aGlzLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuICB0aGlzLl9vYnNlcnZhdGlvblRhcmdldHMgPSBbXTtcbiAgdGhpcy5fcXVldWVkRW50cmllcyA9IFtdO1xuICB0aGlzLl9yb290TWFyZ2luVmFsdWVzID0gdGhpcy5fcGFyc2VSb290TWFyZ2luKG9wdGlvbnMucm9vdE1hcmdpbik7XG5cbiAgLy8gUHVibGljIHByb3BlcnRpZXMuXG4gIHRoaXMudGhyZXNob2xkcyA9IHRoaXMuX2luaXRUaHJlc2hvbGRzKG9wdGlvbnMudGhyZXNob2xkKTtcbiAgdGhpcy5yb290ID0gb3B0aW9ucy5yb290IHx8IG51bGw7XG4gIHRoaXMucm9vdE1hcmdpbiA9IHRoaXMuX3Jvb3RNYXJnaW5WYWx1ZXMubWFwKGZ1bmN0aW9uKG1hcmdpbikge1xuICAgIHJldHVybiBtYXJnaW4udmFsdWUgKyBtYXJnaW4udW5pdDtcbiAgfSkuam9pbignICcpO1xuXG4gIC8qKiBAcHJpdmF0ZSBAY29uc3QgeyFBcnJheTwhRG9jdW1lbnQ+fSAqL1xuICB0aGlzLl9tb25pdG9yaW5nRG9jdW1lbnRzID0gW107XG4gIC8qKiBAcHJpdmF0ZSBAY29uc3QgeyFBcnJheTxmdW5jdGlvbigpPn0gKi9cbiAgdGhpcy5fbW9uaXRvcmluZ1Vuc3Vic2NyaWJlcyA9IFtdO1xufVxuXG5cbi8qKlxuICogVGhlIG1pbmltdW0gaW50ZXJ2YWwgd2l0aGluIHdoaWNoIHRoZSBkb2N1bWVudCB3aWxsIGJlIGNoZWNrZWQgZm9yXG4gKiBpbnRlcnNlY3Rpb24gY2hhbmdlcy5cbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLlRIUk9UVExFX1RJTUVPVVQgPSAxMDA7XG5cblxuLyoqXG4gKiBUaGUgZnJlcXVlbmN5IGluIHdoaWNoIHRoZSBwb2x5ZmlsbCBwb2xscyBmb3IgaW50ZXJzZWN0aW9uIGNoYW5nZXMuXG4gKiB0aGlzIGNhbiBiZSB1cGRhdGVkIG9uIGEgcGVyIGluc3RhbmNlIGJhc2lzIGFuZCBtdXN0IGJlIHNldCBwcmlvciB0b1xuICogY2FsbGluZyBgb2JzZXJ2ZWAgb24gdGhlIGZpcnN0IHRhcmdldC5cbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLlBPTExfSU5URVJWQUwgPSBudWxsO1xuXG4vKipcbiAqIFVzZSBhIG11dGF0aW9uIG9ic2VydmVyIG9uIHRoZSByb290IGVsZW1lbnRcbiAqIHRvIGRldGVjdCBpbnRlcnNlY3Rpb24gY2hhbmdlcy5cbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLlVTRV9NVVRBVElPTl9PQlNFUlZFUiA9IHRydWU7XG5cblxuLyoqXG4gKiBTZXRzIHVwIHRoZSBwb2x5ZmlsbCBpbiB0aGUgY3Jvc3Mtb3JpZ2luIG1vZGUuIFRoZSByZXN1bHQgaXMgdGhlXG4gKiB1cGRhdGVyIGZ1bmN0aW9uIHRoYXQgYWNjZXB0cyB0d28gYXJndW1lbnRzOiBgYm91bmRpbmdDbGllbnRSZWN0YCBhbmRcbiAqIGBpbnRlcnNlY3Rpb25SZWN0YCAtIGp1c3QgYXMgdGhlc2UgZmllbGRzIHdvdWxkIGJlIGF2YWlsYWJsZSB0byB0aGVcbiAqIHBhcmVudCB2aWEgYEludGVyc2VjdGlvbk9ic2VydmVyRW50cnlgLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjYWxsZWRcbiAqIGVhY2ggdGltZSB0aGUgaWZyYW1lIHJlY2VpdmVzIGludGVyc2VjdGlvbiBpbmZvcm1hdGlvbiBmcm9tIHRoZSBwYXJlbnRcbiAqIHdpbmRvdywgZS5nLiB2aWEgbWVzc2FnaW5nLlxuICogQHJldHVybiB7ZnVuY3Rpb24oRE9NUmVjdHxDbGllbnRSZWN0LCBET01SZWN0fENsaWVudFJlY3QpfVxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5fc2V0dXBDcm9zc09yaWdpblVwZGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFjcm9zc09yaWdpblVwZGF0ZXIpIHtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0RPTVJlY3R8Q2xpZW50UmVjdH0gYm91bmRpbmdDbGllbnRSZWN0XG4gICAgICogQHBhcmFtIHtET01SZWN0fENsaWVudFJlY3R9IGludGVyc2VjdGlvblJlY3RcbiAgICAgKi9cbiAgICBjcm9zc09yaWdpblVwZGF0ZXIgPSBmdW5jdGlvbihib3VuZGluZ0NsaWVudFJlY3QsIGludGVyc2VjdGlvblJlY3QpIHtcbiAgICAgIGlmICghYm91bmRpbmdDbGllbnRSZWN0IHx8ICFpbnRlcnNlY3Rpb25SZWN0KSB7XG4gICAgICAgIGNyb3NzT3JpZ2luUmVjdCA9IGdldEVtcHR5UmVjdCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3Jvc3NPcmlnaW5SZWN0ID0gY29udmVydEZyb21QYXJlbnRSZWN0KGJvdW5kaW5nQ2xpZW50UmVjdCwgaW50ZXJzZWN0aW9uUmVjdCk7XG4gICAgICB9XG4gICAgICByZWdpc3RyeS5mb3JFYWNoKGZ1bmN0aW9uKG9ic2VydmVyKSB7XG4gICAgICAgIG9ic2VydmVyLl9jaGVja0ZvckludGVyc2VjdGlvbnMoKTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIGNyb3NzT3JpZ2luVXBkYXRlcjtcbn07XG5cblxuLyoqXG4gKiBSZXNldHMgdGhlIGNyb3NzLW9yaWdpbiBtb2RlLlxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5fcmVzZXRDcm9zc09yaWdpblVwZGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgY3Jvc3NPcmlnaW5VcGRhdGVyID0gbnVsbDtcbiAgY3Jvc3NPcmlnaW5SZWN0ID0gbnVsbDtcbn07XG5cblxuLyoqXG4gKiBTdGFydHMgb2JzZXJ2aW5nIGEgdGFyZ2V0IGVsZW1lbnQgZm9yIGludGVyc2VjdGlvbiBjaGFuZ2VzIGJhc2VkIG9uXG4gKiB0aGUgdGhyZXNob2xkcyB2YWx1ZXMuXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldCBUaGUgRE9NIGVsZW1lbnQgdG8gb2JzZXJ2ZS5cbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLm9ic2VydmUgPSBmdW5jdGlvbih0YXJnZXQpIHtcbiAgdmFyIGlzVGFyZ2V0QWxyZWFkeU9ic2VydmVkID0gdGhpcy5fb2JzZXJ2YXRpb25UYXJnZXRzLnNvbWUoZnVuY3Rpb24oaXRlbSkge1xuICAgIHJldHVybiBpdGVtLmVsZW1lbnQgPT0gdGFyZ2V0O1xuICB9KTtcblxuICBpZiAoaXNUYXJnZXRBbHJlYWR5T2JzZXJ2ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoISh0YXJnZXQgJiYgdGFyZ2V0Lm5vZGVUeXBlID09IDEpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YXJnZXQgbXVzdCBiZSBhbiBFbGVtZW50Jyk7XG4gIH1cblxuICB0aGlzLl9yZWdpc3Rlckluc3RhbmNlKCk7XG4gIHRoaXMuX29ic2VydmF0aW9uVGFyZ2V0cy5wdXNoKHtlbGVtZW50OiB0YXJnZXQsIGVudHJ5OiBudWxsfSk7XG4gIHRoaXMuX21vbml0b3JJbnRlcnNlY3Rpb25zKHRhcmdldC5vd25lckRvY3VtZW50KTtcbiAgdGhpcy5fY2hlY2tGb3JJbnRlcnNlY3Rpb25zKCk7XG59O1xuXG5cbi8qKlxuICogU3RvcHMgb2JzZXJ2aW5nIGEgdGFyZ2V0IGVsZW1lbnQgZm9yIGludGVyc2VjdGlvbiBjaGFuZ2VzLlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXQgVGhlIERPTSBlbGVtZW50IHRvIG9ic2VydmUuXG4gKi9cbkludGVyc2VjdGlvbk9ic2VydmVyLnByb3RvdHlwZS51bm9ic2VydmUgPSBmdW5jdGlvbih0YXJnZXQpIHtcbiAgdGhpcy5fb2JzZXJ2YXRpb25UYXJnZXRzID1cbiAgICAgIHRoaXMuX29ic2VydmF0aW9uVGFyZ2V0cy5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS5lbGVtZW50ICE9IHRhcmdldDtcbiAgICAgIH0pO1xuICB0aGlzLl91bm1vbml0b3JJbnRlcnNlY3Rpb25zKHRhcmdldC5vd25lckRvY3VtZW50KTtcbiAgaWYgKHRoaXMuX29ic2VydmF0aW9uVGFyZ2V0cy5sZW5ndGggPT0gMCkge1xuICAgIHRoaXMuX3VucmVnaXN0ZXJJbnN0YW5jZSgpO1xuICB9XG59O1xuXG5cbi8qKlxuICogU3RvcHMgb2JzZXJ2aW5nIGFsbCB0YXJnZXQgZWxlbWVudHMgZm9yIGludGVyc2VjdGlvbiBjaGFuZ2VzLlxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9vYnNlcnZhdGlvblRhcmdldHMgPSBbXTtcbiAgdGhpcy5fdW5tb25pdG9yQWxsSW50ZXJzZWN0aW9ucygpO1xuICB0aGlzLl91bnJlZ2lzdGVySW5zdGFuY2UoKTtcbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIGFueSBxdWV1ZSBlbnRyaWVzIHRoYXQgaGF2ZSBub3QgeWV0IGJlZW4gcmVwb3J0ZWQgdG8gdGhlXG4gKiBjYWxsYmFjayBhbmQgY2xlYXJzIHRoZSBxdWV1ZS4gVGhpcyBjYW4gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIHRoZVxuICogY2FsbGJhY2sgdG8gb2J0YWluIHRoZSBhYnNvbHV0ZSBtb3N0IHVwLXRvLWRhdGUgaW50ZXJzZWN0aW9uIGluZm9ybWF0aW9uLlxuICogQHJldHVybiB7QXJyYXl9IFRoZSBjdXJyZW50bHkgcXVldWVkIGVudHJpZXMuXG4gKi9cbkludGVyc2VjdGlvbk9ic2VydmVyLnByb3RvdHlwZS50YWtlUmVjb3JkcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVjb3JkcyA9IHRoaXMuX3F1ZXVlZEVudHJpZXMuc2xpY2UoKTtcbiAgdGhpcy5fcXVldWVkRW50cmllcyA9IFtdO1xuICByZXR1cm4gcmVjb3Jkcztcbn07XG5cblxuLyoqXG4gKiBBY2NlcHRzIHRoZSB0aHJlc2hvbGQgdmFsdWUgZnJvbSB0aGUgdXNlciBjb25maWd1cmF0aW9uIG9iamVjdCBhbmRcbiAqIHJldHVybnMgYSBzb3J0ZWQgYXJyYXkgb2YgdW5pcXVlIHRocmVzaG9sZCB2YWx1ZXMuIElmIGEgdmFsdWUgaXMgbm90XG4gKiBiZXR3ZWVuIDAgYW5kIDEgYW5kIGVycm9yIGlzIHRocm93bi5cbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fG51bWJlcj19IG9wdF90aHJlc2hvbGQgQW4gb3B0aW9uYWwgdGhyZXNob2xkIHZhbHVlIG9yXG4gKiAgICAgYSBsaXN0IG9mIHRocmVzaG9sZCB2YWx1ZXMsIGRlZmF1bHRpbmcgdG8gWzBdLlxuICogQHJldHVybiB7QXJyYXl9IEEgc29ydGVkIGxpc3Qgb2YgdW5pcXVlIGFuZCB2YWxpZCB0aHJlc2hvbGQgdmFsdWVzLlxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5wcm90b3R5cGUuX2luaXRUaHJlc2hvbGRzID0gZnVuY3Rpb24ob3B0X3RocmVzaG9sZCkge1xuICB2YXIgdGhyZXNob2xkID0gb3B0X3RocmVzaG9sZCB8fCBbMF07XG4gIGlmICghQXJyYXkuaXNBcnJheSh0aHJlc2hvbGQpKSB0aHJlc2hvbGQgPSBbdGhyZXNob2xkXTtcblxuICByZXR1cm4gdGhyZXNob2xkLnNvcnQoKS5maWx0ZXIoZnVuY3Rpb24odCwgaSwgYSkge1xuICAgIGlmICh0eXBlb2YgdCAhPSAnbnVtYmVyJyB8fCBpc05hTih0KSB8fCB0IDwgMCB8fCB0ID4gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd0aHJlc2hvbGQgbXVzdCBiZSBhIG51bWJlciBiZXR3ZWVuIDAgYW5kIDEgaW5jbHVzaXZlbHknKTtcbiAgICB9XG4gICAgcmV0dXJuIHQgIT09IGFbaSAtIDFdO1xuICB9KTtcbn07XG5cblxuLyoqXG4gKiBBY2NlcHRzIHRoZSByb290TWFyZ2luIHZhbHVlIGZyb20gdGhlIHVzZXIgY29uZmlndXJhdGlvbiBvYmplY3RcbiAqIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIHRoZSBmb3VyIG1hcmdpbiB2YWx1ZXMgYXMgYW4gb2JqZWN0IGNvbnRhaW5pbmdcbiAqIHRoZSB2YWx1ZSBhbmQgdW5pdCBwcm9wZXJ0aWVzLiBJZiBhbnkgb2YgdGhlIHZhbHVlcyBhcmUgbm90IHByb3Blcmx5XG4gKiBmb3JtYXR0ZWQgb3IgdXNlIGEgdW5pdCBvdGhlciB0aGFuIHB4IG9yICUsIGFuZCBlcnJvciBpcyB0aHJvd24uXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmc9fSBvcHRfcm9vdE1hcmdpbiBBbiBvcHRpb25hbCByb290TWFyZ2luIHZhbHVlLFxuICogICAgIGRlZmF1bHRpbmcgdG8gJzBweCcuXG4gKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBBbiBhcnJheSBvZiBtYXJnaW4gb2JqZWN0cyB3aXRoIHRoZSBrZXlzXG4gKiAgICAgdmFsdWUgYW5kIHVuaXQuXG4gKi9cbkludGVyc2VjdGlvbk9ic2VydmVyLnByb3RvdHlwZS5fcGFyc2VSb290TWFyZ2luID0gZnVuY3Rpb24ob3B0X3Jvb3RNYXJnaW4pIHtcbiAgdmFyIG1hcmdpblN0cmluZyA9IG9wdF9yb290TWFyZ2luIHx8ICcwcHgnO1xuICB2YXIgbWFyZ2lucyA9IG1hcmdpblN0cmluZy5zcGxpdCgvXFxzKy8pLm1hcChmdW5jdGlvbihtYXJnaW4pIHtcbiAgICB2YXIgcGFydHMgPSAvXigtP1xcZCpcXC4/XFxkKykocHh8JSkkLy5leGVjKG1hcmdpbik7XG4gICAgaWYgKCFwYXJ0cykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdyb290TWFyZ2luIG11c3QgYmUgc3BlY2lmaWVkIGluIHBpeGVscyBvciBwZXJjZW50Jyk7XG4gICAgfVxuICAgIHJldHVybiB7dmFsdWU6IHBhcnNlRmxvYXQocGFydHNbMV0pLCB1bml0OiBwYXJ0c1syXX07XG4gIH0pO1xuXG4gIC8vIEhhbmRsZXMgc2hvcnRoYW5kLlxuICBtYXJnaW5zWzFdID0gbWFyZ2luc1sxXSB8fCBtYXJnaW5zWzBdO1xuICBtYXJnaW5zWzJdID0gbWFyZ2luc1syXSB8fCBtYXJnaW5zWzBdO1xuICBtYXJnaW5zWzNdID0gbWFyZ2luc1szXSB8fCBtYXJnaW5zWzFdO1xuXG4gIHJldHVybiBtYXJnaW5zO1xufTtcblxuXG4vKipcbiAqIFN0YXJ0cyBwb2xsaW5nIGZvciBpbnRlcnNlY3Rpb24gY2hhbmdlcyBpZiB0aGUgcG9sbGluZyBpcyBub3QgYWxyZWFkeVxuICogaGFwcGVuaW5nLCBhbmQgaWYgdGhlIHBhZ2UncyB2aXNpYmlsaXR5IHN0YXRlIGlzIHZpc2libGUuXG4gKiBAcGFyYW0geyFEb2N1bWVudH0gZG9jXG4gKiBAcHJpdmF0ZVxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5wcm90b3R5cGUuX21vbml0b3JJbnRlcnNlY3Rpb25zID0gZnVuY3Rpb24oZG9jKSB7XG4gIHZhciB3aW4gPSBkb2MuZGVmYXVsdFZpZXc7XG4gIGlmICghd2luKSB7XG4gICAgLy8gQWxyZWFkeSBkZXN0cm95ZWQuXG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLl9tb25pdG9yaW5nRG9jdW1lbnRzLmluZGV4T2YoZG9jKSAhPSAtMSkge1xuICAgIC8vIEFscmVhZHkgbW9uaXRvcmluZy5cbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBQcml2YXRlIHN0YXRlIGZvciBtb25pdG9yaW5nLlxuICB2YXIgY2FsbGJhY2sgPSB0aGlzLl9jaGVja0ZvckludGVyc2VjdGlvbnM7XG4gIHZhciBtb25pdG9yaW5nSW50ZXJ2YWwgPSBudWxsO1xuICB2YXIgZG9tT2JzZXJ2ZXIgPSBudWxsO1xuXG4gIC8vIElmIGEgcG9sbCBpbnRlcnZhbCBpcyBzZXQsIHVzZSBwb2xsaW5nIGluc3RlYWQgb2YgbGlzdGVuaW5nIHRvXG4gIC8vIHJlc2l6ZSBhbmQgc2Nyb2xsIGV2ZW50cyBvciBET00gbXV0YXRpb25zLlxuICBpZiAodGhpcy5QT0xMX0lOVEVSVkFMKSB7XG4gICAgbW9uaXRvcmluZ0ludGVydmFsID0gd2luLnNldEludGVydmFsKGNhbGxiYWNrLCB0aGlzLlBPTExfSU5URVJWQUwpO1xuICB9IGVsc2Uge1xuICAgIGFkZEV2ZW50KHdpbiwgJ3Jlc2l6ZScsIGNhbGxiYWNrLCB0cnVlKTtcbiAgICBhZGRFdmVudChkb2MsICdzY3JvbGwnLCBjYWxsYmFjaywgdHJ1ZSk7XG4gICAgaWYgKHRoaXMuVVNFX01VVEFUSU9OX09CU0VSVkVSICYmICdNdXRhdGlvbk9ic2VydmVyJyBpbiB3aW4pIHtcbiAgICAgIGRvbU9ic2VydmVyID0gbmV3IHdpbi5NdXRhdGlvbk9ic2VydmVyKGNhbGxiYWNrKTtcbiAgICAgIGRvbU9ic2VydmVyLm9ic2VydmUoZG9jLCB7XG4gICAgICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZSxcbiAgICAgICAgc3VidHJlZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5fbW9uaXRvcmluZ0RvY3VtZW50cy5wdXNoKGRvYyk7XG4gIHRoaXMuX21vbml0b3JpbmdVbnN1YnNjcmliZXMucHVzaChmdW5jdGlvbigpIHtcbiAgICAvLyBHZXQgdGhlIHdpbmRvdyBvYmplY3QgYWdhaW4uIFdoZW4gYSBmcmllbmRseSBpZnJhbWUgaXMgZGVzdHJveWVkLCBpdFxuICAgIC8vIHdpbGwgYmUgbnVsbC5cbiAgICB2YXIgd2luID0gZG9jLmRlZmF1bHRWaWV3O1xuXG4gICAgaWYgKHdpbikge1xuICAgICAgaWYgKG1vbml0b3JpbmdJbnRlcnZhbCkge1xuICAgICAgICB3aW4uY2xlYXJJbnRlcnZhbChtb25pdG9yaW5nSW50ZXJ2YWwpO1xuICAgICAgfVxuICAgICAgcmVtb3ZlRXZlbnQod2luLCAncmVzaXplJywgY2FsbGJhY2ssIHRydWUpO1xuICAgIH1cblxuICAgIHJlbW92ZUV2ZW50KGRvYywgJ3Njcm9sbCcsIGNhbGxiYWNrLCB0cnVlKTtcbiAgICBpZiAoZG9tT2JzZXJ2ZXIpIHtcbiAgICAgIGRvbU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEFsc28gbW9uaXRvciB0aGUgcGFyZW50LlxuICB2YXIgcm9vdERvYyA9XG4gICAgKHRoaXMucm9vdCAmJiAodGhpcy5yb290Lm93bmVyRG9jdW1lbnQgfHwgdGhpcy5yb290KSkgfHwgZG9jdW1lbnQ7XG4gIGlmIChkb2MgIT0gcm9vdERvYykge1xuICAgIHZhciBmcmFtZSA9IGdldEZyYW1lRWxlbWVudChkb2MpO1xuICAgIGlmIChmcmFtZSkge1xuICAgICAgdGhpcy5fbW9uaXRvckludGVyc2VjdGlvbnMoZnJhbWUub3duZXJEb2N1bWVudCk7XG4gICAgfVxuICB9XG59O1xuXG5cbi8qKlxuICogU3RvcHMgcG9sbGluZyBmb3IgaW50ZXJzZWN0aW9uIGNoYW5nZXMuXG4gKiBAcGFyYW0geyFEb2N1bWVudH0gZG9jXG4gKiBAcHJpdmF0ZVxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5wcm90b3R5cGUuX3VubW9uaXRvckludGVyc2VjdGlvbnMgPSBmdW5jdGlvbihkb2MpIHtcbiAgdmFyIGluZGV4ID0gdGhpcy5fbW9uaXRvcmluZ0RvY3VtZW50cy5pbmRleE9mKGRvYyk7XG4gIGlmIChpbmRleCA9PSAtMSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciByb290RG9jID1cbiAgICAodGhpcy5yb290ICYmICh0aGlzLnJvb3Qub3duZXJEb2N1bWVudCB8fCB0aGlzLnJvb3QpKSB8fCBkb2N1bWVudDtcblxuICAvLyBDaGVjayBpZiBhbnkgZGVwZW5kZW50IHRhcmdldHMgYXJlIHN0aWxsIHJlbWFpbmluZy5cbiAgdmFyIGhhc0RlcGVuZGVudFRhcmdldHMgPVxuICAgICAgdGhpcy5fb2JzZXJ2YXRpb25UYXJnZXRzLnNvbWUoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB2YXIgaXRlbURvYyA9IGl0ZW0uZWxlbWVudC5vd25lckRvY3VtZW50O1xuICAgICAgICAvLyBUYXJnZXQgaXMgaW4gdGhpcyBjb250ZXh0LlxuICAgICAgICBpZiAoaXRlbURvYyA9PSBkb2MpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUYXJnZXQgaXMgbmVzdGVkIGluIHRoaXMgY29udGV4dC5cbiAgICAgICAgd2hpbGUgKGl0ZW1Eb2MgJiYgaXRlbURvYyAhPSByb290RG9jKSB7XG4gICAgICAgICAgdmFyIGZyYW1lID0gZ2V0RnJhbWVFbGVtZW50KGl0ZW1Eb2MpO1xuICAgICAgICAgIGl0ZW1Eb2MgPSBmcmFtZSAmJiBmcmFtZS5vd25lckRvY3VtZW50O1xuICAgICAgICAgIGlmIChpdGVtRG9jID09IGRvYykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0pO1xuICBpZiAoaGFzRGVwZW5kZW50VGFyZ2V0cykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFVuc3Vic2NyaWJlLlxuICB2YXIgdW5zdWJzY3JpYmUgPSB0aGlzLl9tb25pdG9yaW5nVW5zdWJzY3JpYmVzW2luZGV4XTtcbiAgdGhpcy5fbW9uaXRvcmluZ0RvY3VtZW50cy5zcGxpY2UoaW5kZXgsIDEpO1xuICB0aGlzLl9tb25pdG9yaW5nVW5zdWJzY3JpYmVzLnNwbGljZShpbmRleCwgMSk7XG4gIHVuc3Vic2NyaWJlKCk7XG5cbiAgLy8gQWxzbyB1bm1vbml0b3IgdGhlIHBhcmVudC5cbiAgaWYgKGRvYyAhPSByb290RG9jKSB7XG4gICAgdmFyIGZyYW1lID0gZ2V0RnJhbWVFbGVtZW50KGRvYyk7XG4gICAgaWYgKGZyYW1lKSB7XG4gICAgICB0aGlzLl91bm1vbml0b3JJbnRlcnNlY3Rpb25zKGZyYW1lLm93bmVyRG9jdW1lbnQpO1xuICAgIH1cbiAgfVxufTtcblxuXG4vKipcbiAqIFN0b3BzIHBvbGxpbmcgZm9yIGludGVyc2VjdGlvbiBjaGFuZ2VzLlxuICogQHBhcmFtIHshRG9jdW1lbnR9IGRvY1xuICogQHByaXZhdGVcbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLl91bm1vbml0b3JBbGxJbnRlcnNlY3Rpb25zID0gZnVuY3Rpb24oKSB7XG4gIHZhciB1bnN1YnNjcmliZXMgPSB0aGlzLl9tb25pdG9yaW5nVW5zdWJzY3JpYmVzLnNsaWNlKDApO1xuICB0aGlzLl9tb25pdG9yaW5nRG9jdW1lbnRzLmxlbmd0aCA9IDA7XG4gIHRoaXMuX21vbml0b3JpbmdVbnN1YnNjcmliZXMubGVuZ3RoID0gMDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bnN1YnNjcmliZXMubGVuZ3RoOyBpKyspIHtcbiAgICB1bnN1YnNjcmliZXNbaV0oKTtcbiAgfVxufTtcblxuXG4vKipcbiAqIFNjYW5zIGVhY2ggb2JzZXJ2YXRpb24gdGFyZ2V0IGZvciBpbnRlcnNlY3Rpb24gY2hhbmdlcyBhbmQgYWRkcyB0aGVtXG4gKiB0byB0aGUgaW50ZXJuYWwgZW50cmllcyBxdWV1ZS4gSWYgbmV3IGVudHJpZXMgYXJlIGZvdW5kLCBpdFxuICogc2NoZWR1bGVzIHRoZSBjYWxsYmFjayB0byBiZSBpbnZva2VkLlxuICogQHByaXZhdGVcbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLl9jaGVja0ZvckludGVyc2VjdGlvbnMgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLnJvb3QgJiYgY3Jvc3NPcmlnaW5VcGRhdGVyICYmICFjcm9zc09yaWdpblJlY3QpIHtcbiAgICAvLyBDcm9zcyBvcmlnaW4gbW9uaXRvcmluZywgYnV0IG5vIGluaXRpYWwgZGF0YSBhdmFpbGFibGUgeWV0LlxuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciByb290SXNJbkRvbSA9IHRoaXMuX3Jvb3RJc0luRG9tKCk7XG4gIHZhciByb290UmVjdCA9IHJvb3RJc0luRG9tID8gdGhpcy5fZ2V0Um9vdFJlY3QoKSA6IGdldEVtcHR5UmVjdCgpO1xuXG4gIHRoaXMuX29ic2VydmF0aW9uVGFyZ2V0cy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICB2YXIgdGFyZ2V0ID0gaXRlbS5lbGVtZW50O1xuICAgIHZhciB0YXJnZXRSZWN0ID0gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KHRhcmdldCk7XG4gICAgdmFyIHJvb3RDb250YWluc1RhcmdldCA9IHRoaXMuX3Jvb3RDb250YWluc1RhcmdldCh0YXJnZXQpO1xuICAgIHZhciBvbGRFbnRyeSA9IGl0ZW0uZW50cnk7XG4gICAgdmFyIGludGVyc2VjdGlvblJlY3QgPSByb290SXNJbkRvbSAmJiByb290Q29udGFpbnNUYXJnZXQgJiZcbiAgICAgICAgdGhpcy5fY29tcHV0ZVRhcmdldEFuZFJvb3RJbnRlcnNlY3Rpb24odGFyZ2V0LCB0YXJnZXRSZWN0LCByb290UmVjdCk7XG5cbiAgICB2YXIgcm9vdEJvdW5kcyA9IG51bGw7XG4gICAgaWYgKCF0aGlzLl9yb290Q29udGFpbnNUYXJnZXQodGFyZ2V0KSkge1xuICAgICAgcm9vdEJvdW5kcyA9IGdldEVtcHR5UmVjdCgpO1xuICAgIH0gZWxzZSBpZiAoIWNyb3NzT3JpZ2luVXBkYXRlciB8fCB0aGlzLnJvb3QpIHtcbiAgICAgIHJvb3RCb3VuZHMgPSByb290UmVjdDtcbiAgICB9XG5cbiAgICB2YXIgbmV3RW50cnkgPSBpdGVtLmVudHJ5ID0gbmV3IEludGVyc2VjdGlvbk9ic2VydmVyRW50cnkoe1xuICAgICAgdGltZTogbm93KCksXG4gICAgICB0YXJnZXQ6IHRhcmdldCxcbiAgICAgIGJvdW5kaW5nQ2xpZW50UmVjdDogdGFyZ2V0UmVjdCxcbiAgICAgIHJvb3RCb3VuZHM6IHJvb3RCb3VuZHMsXG4gICAgICBpbnRlcnNlY3Rpb25SZWN0OiBpbnRlcnNlY3Rpb25SZWN0XG4gICAgfSk7XG5cbiAgICBpZiAoIW9sZEVudHJ5KSB7XG4gICAgICB0aGlzLl9xdWV1ZWRFbnRyaWVzLnB1c2gobmV3RW50cnkpO1xuICAgIH0gZWxzZSBpZiAocm9vdElzSW5Eb20gJiYgcm9vdENvbnRhaW5zVGFyZ2V0KSB7XG4gICAgICAvLyBJZiB0aGUgbmV3IGVudHJ5IGludGVyc2VjdGlvbiByYXRpbyBoYXMgY3Jvc3NlZCBhbnkgb2YgdGhlXG4gICAgICAvLyB0aHJlc2hvbGRzLCBhZGQgYSBuZXcgZW50cnkuXG4gICAgICBpZiAodGhpcy5faGFzQ3Jvc3NlZFRocmVzaG9sZChvbGRFbnRyeSwgbmV3RW50cnkpKSB7XG4gICAgICAgIHRoaXMuX3F1ZXVlZEVudHJpZXMucHVzaChuZXdFbnRyeSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElmIHRoZSByb290IGlzIG5vdCBpbiB0aGUgRE9NIG9yIHRhcmdldCBpcyBub3QgY29udGFpbmVkIHdpdGhpblxuICAgICAgLy8gcm9vdCBidXQgdGhlIHByZXZpb3VzIGVudHJ5IGZvciB0aGlzIHRhcmdldCBoYWQgYW4gaW50ZXJzZWN0aW9uLFxuICAgICAgLy8gYWRkIGEgbmV3IHJlY29yZCBpbmRpY2F0aW5nIHJlbW92YWwuXG4gICAgICBpZiAob2xkRW50cnkgJiYgb2xkRW50cnkuaXNJbnRlcnNlY3RpbmcpIHtcbiAgICAgICAgdGhpcy5fcXVldWVkRW50cmllcy5wdXNoKG5ld0VudHJ5KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHRoaXMpO1xuXG4gIGlmICh0aGlzLl9xdWV1ZWRFbnRyaWVzLmxlbmd0aCkge1xuICAgIHRoaXMuX2NhbGxiYWNrKHRoaXMudGFrZVJlY29yZHMoKSwgdGhpcyk7XG4gIH1cbn07XG5cblxuLyoqXG4gKiBBY2NlcHRzIGEgdGFyZ2V0IGFuZCByb290IHJlY3QgY29tcHV0ZXMgdGhlIGludGVyc2VjdGlvbiBiZXR3ZWVuIHRoZW5cbiAqIGZvbGxvd2luZyB0aGUgYWxnb3JpdGhtIGluIHRoZSBzcGVjLlxuICogVE9ETyhwaGlsaXB3YWx0b24pOiBhdCB0aGlzIHRpbWUgY2xpcC1wYXRoIGlzIG5vdCBjb25zaWRlcmVkLlxuICogaHR0cHM6Ly93M2MuZ2l0aHViLmlvL0ludGVyc2VjdGlvbk9ic2VydmVyLyNjYWxjdWxhdGUtaW50ZXJzZWN0aW9uLXJlY3QtYWxnb1xuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXQgVGhlIHRhcmdldCBET00gZWxlbWVudFxuICogQHBhcmFtIHtPYmplY3R9IHRhcmdldFJlY3QgVGhlIGJvdW5kaW5nIHJlY3Qgb2YgdGhlIHRhcmdldC5cbiAqIEBwYXJhbSB7T2JqZWN0fSByb290UmVjdCBUaGUgYm91bmRpbmcgcmVjdCBvZiB0aGUgcm9vdCBhZnRlciBiZWluZ1xuICogICAgIGV4cGFuZGVkIGJ5IHRoZSByb290TWFyZ2luIHZhbHVlLlxuICogQHJldHVybiB7P09iamVjdH0gVGhlIGZpbmFsIGludGVyc2VjdGlvbiByZWN0IG9iamVjdCBvciB1bmRlZmluZWQgaWYgbm9cbiAqICAgICBpbnRlcnNlY3Rpb24gaXMgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5wcm90b3R5cGUuX2NvbXB1dGVUYXJnZXRBbmRSb290SW50ZXJzZWN0aW9uID1cbiAgICBmdW5jdGlvbih0YXJnZXQsIHRhcmdldFJlY3QsIHJvb3RSZWN0KSB7XG4gIC8vIElmIHRoZSBlbGVtZW50IGlzbid0IGRpc3BsYXllZCwgYW4gaW50ZXJzZWN0aW9uIGNhbid0IGhhcHBlbi5cbiAgaWYgKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhcmdldCkuZGlzcGxheSA9PSAnbm9uZScpIHJldHVybjtcblxuICB2YXIgaW50ZXJzZWN0aW9uUmVjdCA9IHRhcmdldFJlY3Q7XG4gIHZhciBwYXJlbnQgPSBnZXRQYXJlbnROb2RlKHRhcmdldCk7XG4gIHZhciBhdFJvb3QgPSBmYWxzZTtcblxuICB3aGlsZSAoIWF0Um9vdCAmJiBwYXJlbnQpIHtcbiAgICB2YXIgcGFyZW50UmVjdCA9IG51bGw7XG4gICAgdmFyIHBhcmVudENvbXB1dGVkU3R5bGUgPSBwYXJlbnQubm9kZVR5cGUgPT0gMSA/XG4gICAgICAgIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHBhcmVudCkgOiB7fTtcblxuICAgIC8vIElmIHRoZSBwYXJlbnQgaXNuJ3QgZGlzcGxheWVkLCBhbiBpbnRlcnNlY3Rpb24gY2FuJ3QgaGFwcGVuLlxuICAgIGlmIChwYXJlbnRDb21wdXRlZFN0eWxlLmRpc3BsYXkgPT0gJ25vbmUnKSByZXR1cm4gbnVsbDtcblxuICAgIGlmIChwYXJlbnQgPT0gdGhpcy5yb290IHx8IHBhcmVudC5ub2RlVHlwZSA9PSAvKiBET0NVTUVOVCAqLyA5KSB7XG4gICAgICBhdFJvb3QgPSB0cnVlO1xuICAgICAgaWYgKHBhcmVudCA9PSB0aGlzLnJvb3QgfHwgcGFyZW50ID09IGRvY3VtZW50KSB7XG4gICAgICAgIGlmIChjcm9zc09yaWdpblVwZGF0ZXIgJiYgIXRoaXMucm9vdCkge1xuICAgICAgICAgIGlmICghY3Jvc3NPcmlnaW5SZWN0IHx8XG4gICAgICAgICAgICAgIGNyb3NzT3JpZ2luUmVjdC53aWR0aCA9PSAwICYmIGNyb3NzT3JpZ2luUmVjdC5oZWlnaHQgPT0gMCkge1xuICAgICAgICAgICAgLy8gQSAwLXNpemUgY3Jvc3Mtb3JpZ2luIGludGVyc2VjdGlvbiBtZWFucyBuby1pbnRlcnNlY3Rpb24uXG4gICAgICAgICAgICBwYXJlbnQgPSBudWxsO1xuICAgICAgICAgICAgcGFyZW50UmVjdCA9IG51bGw7XG4gICAgICAgICAgICBpbnRlcnNlY3Rpb25SZWN0ID0gbnVsbDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGFyZW50UmVjdCA9IGNyb3NzT3JpZ2luUmVjdDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGFyZW50UmVjdCA9IHJvb3RSZWN0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDaGVjayBpZiB0aGVyZSdzIGEgZnJhbWUgdGhhdCBjYW4gYmUgbmF2aWdhdGVkIHRvLlxuICAgICAgICB2YXIgZnJhbWUgPSBnZXRQYXJlbnROb2RlKHBhcmVudCk7XG4gICAgICAgIHZhciBmcmFtZVJlY3QgPSBmcmFtZSAmJiBnZXRCb3VuZGluZ0NsaWVudFJlY3QoZnJhbWUpO1xuICAgICAgICB2YXIgZnJhbWVJbnRlcnNlY3QgPVxuICAgICAgICAgICAgZnJhbWUgJiZcbiAgICAgICAgICAgIHRoaXMuX2NvbXB1dGVUYXJnZXRBbmRSb290SW50ZXJzZWN0aW9uKGZyYW1lLCBmcmFtZVJlY3QsIHJvb3RSZWN0KTtcbiAgICAgICAgaWYgKGZyYW1lUmVjdCAmJiBmcmFtZUludGVyc2VjdCkge1xuICAgICAgICAgIHBhcmVudCA9IGZyYW1lO1xuICAgICAgICAgIHBhcmVudFJlY3QgPSBjb252ZXJ0RnJvbVBhcmVudFJlY3QoZnJhbWVSZWN0LCBmcmFtZUludGVyc2VjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGFyZW50ID0gbnVsbDtcbiAgICAgICAgICBpbnRlcnNlY3Rpb25SZWN0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB0aGUgZWxlbWVudCBoYXMgYSBub24tdmlzaWJsZSBvdmVyZmxvdywgYW5kIGl0J3Mgbm90IHRoZSA8Ym9keT5cbiAgICAgIC8vIG9yIDxodG1sPiBlbGVtZW50LCB1cGRhdGUgdGhlIGludGVyc2VjdGlvbiByZWN0LlxuICAgICAgLy8gTm90ZTogPGJvZHk+IGFuZCA8aHRtbD4gY2Fubm90IGJlIGNsaXBwZWQgdG8gYSByZWN0IHRoYXQncyBub3QgYWxzb1xuICAgICAgLy8gdGhlIGRvY3VtZW50IHJlY3QsIHNvIG5vIG5lZWQgdG8gY29tcHV0ZSBhIG5ldyBpbnRlcnNlY3Rpb24uXG4gICAgICB2YXIgZG9jID0gcGFyZW50Lm93bmVyRG9jdW1lbnQ7XG4gICAgICBpZiAocGFyZW50ICE9IGRvYy5ib2R5ICYmXG4gICAgICAgICAgcGFyZW50ICE9IGRvYy5kb2N1bWVudEVsZW1lbnQgJiZcbiAgICAgICAgICBwYXJlbnRDb21wdXRlZFN0eWxlLm92ZXJmbG93ICE9ICd2aXNpYmxlJykge1xuICAgICAgICBwYXJlbnRSZWN0ID0gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KHBhcmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgZWl0aGVyIG9mIHRoZSBhYm92ZSBjb25kaXRpb25hbHMgc2V0IGEgbmV3IHBhcmVudFJlY3QsXG4gICAgLy8gY2FsY3VsYXRlIG5ldyBpbnRlcnNlY3Rpb24gZGF0YS5cbiAgICBpZiAocGFyZW50UmVjdCkge1xuICAgICAgaW50ZXJzZWN0aW9uUmVjdCA9IGNvbXB1dGVSZWN0SW50ZXJzZWN0aW9uKHBhcmVudFJlY3QsIGludGVyc2VjdGlvblJlY3QpO1xuICAgIH1cbiAgICBpZiAoIWludGVyc2VjdGlvblJlY3QpIGJyZWFrO1xuICAgIHBhcmVudCA9IHBhcmVudCAmJiBnZXRQYXJlbnROb2RlKHBhcmVudCk7XG4gIH1cbiAgcmV0dXJuIGludGVyc2VjdGlvblJlY3Q7XG59O1xuXG5cbi8qKlxuICogUmV0dXJucyB0aGUgcm9vdCByZWN0IGFmdGVyIGJlaW5nIGV4cGFuZGVkIGJ5IHRoZSByb290TWFyZ2luIHZhbHVlLlxuICogQHJldHVybiB7Q2xpZW50UmVjdH0gVGhlIGV4cGFuZGVkIHJvb3QgcmVjdC5cbiAqIEBwcml2YXRlXG4gKi9cbkludGVyc2VjdGlvbk9ic2VydmVyLnByb3RvdHlwZS5fZ2V0Um9vdFJlY3QgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHJvb3RSZWN0O1xuICBpZiAodGhpcy5yb290ICYmICFpc0RvYyh0aGlzLnJvb3QpKSB7XG4gICAgcm9vdFJlY3QgPSBnZXRCb3VuZGluZ0NsaWVudFJlY3QodGhpcy5yb290KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBVc2UgPGh0bWw+Lzxib2R5PiBpbnN0ZWFkIG9mIHdpbmRvdyBzaW5jZSBzY3JvbGwgYmFycyBhZmZlY3Qgc2l6ZS5cbiAgICB2YXIgZG9jID0gaXNEb2ModGhpcy5yb290KSA/IHRoaXMucm9vdCA6IGRvY3VtZW50O1xuICAgIHZhciBodG1sID0gZG9jLmRvY3VtZW50RWxlbWVudDtcbiAgICB2YXIgYm9keSA9IGRvYy5ib2R5O1xuICAgIHJvb3RSZWN0ID0ge1xuICAgICAgdG9wOiAwLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHJpZ2h0OiBodG1sLmNsaWVudFdpZHRoIHx8IGJvZHkuY2xpZW50V2lkdGgsXG4gICAgICB3aWR0aDogaHRtbC5jbGllbnRXaWR0aCB8fCBib2R5LmNsaWVudFdpZHRoLFxuICAgICAgYm90dG9tOiBodG1sLmNsaWVudEhlaWdodCB8fCBib2R5LmNsaWVudEhlaWdodCxcbiAgICAgIGhlaWdodDogaHRtbC5jbGllbnRIZWlnaHQgfHwgYm9keS5jbGllbnRIZWlnaHRcbiAgICB9O1xuICB9XG4gIHJldHVybiB0aGlzLl9leHBhbmRSZWN0QnlSb290TWFyZ2luKHJvb3RSZWN0KTtcbn07XG5cblxuLyoqXG4gKiBBY2NlcHRzIGEgcmVjdCBhbmQgZXhwYW5kcyBpdCBieSB0aGUgcm9vdE1hcmdpbiB2YWx1ZS5cbiAqIEBwYXJhbSB7RE9NUmVjdHxDbGllbnRSZWN0fSByZWN0IFRoZSByZWN0IG9iamVjdCB0byBleHBhbmQuXG4gKiBAcmV0dXJuIHtDbGllbnRSZWN0fSBUaGUgZXhwYW5kZWQgcmVjdC5cbiAqIEBwcml2YXRlXG4gKi9cbkludGVyc2VjdGlvbk9ic2VydmVyLnByb3RvdHlwZS5fZXhwYW5kUmVjdEJ5Um9vdE1hcmdpbiA9IGZ1bmN0aW9uKHJlY3QpIHtcbiAgdmFyIG1hcmdpbnMgPSB0aGlzLl9yb290TWFyZ2luVmFsdWVzLm1hcChmdW5jdGlvbihtYXJnaW4sIGkpIHtcbiAgICByZXR1cm4gbWFyZ2luLnVuaXQgPT0gJ3B4JyA/IG1hcmdpbi52YWx1ZSA6XG4gICAgICAgIG1hcmdpbi52YWx1ZSAqIChpICUgMiA/IHJlY3Qud2lkdGggOiByZWN0LmhlaWdodCkgLyAxMDA7XG4gIH0pO1xuICB2YXIgbmV3UmVjdCA9IHtcbiAgICB0b3A6IHJlY3QudG9wIC0gbWFyZ2luc1swXSxcbiAgICByaWdodDogcmVjdC5yaWdodCArIG1hcmdpbnNbMV0sXG4gICAgYm90dG9tOiByZWN0LmJvdHRvbSArIG1hcmdpbnNbMl0sXG4gICAgbGVmdDogcmVjdC5sZWZ0IC0gbWFyZ2luc1szXVxuICB9O1xuICBuZXdSZWN0LndpZHRoID0gbmV3UmVjdC5yaWdodCAtIG5ld1JlY3QubGVmdDtcbiAgbmV3UmVjdC5oZWlnaHQgPSBuZXdSZWN0LmJvdHRvbSAtIG5ld1JlY3QudG9wO1xuXG4gIHJldHVybiBuZXdSZWN0O1xufTtcblxuXG4vKipcbiAqIEFjY2VwdHMgYW4gb2xkIGFuZCBuZXcgZW50cnkgYW5kIHJldHVybnMgdHJ1ZSBpZiBhdCBsZWFzdCBvbmUgb2YgdGhlXG4gKiB0aHJlc2hvbGQgdmFsdWVzIGhhcyBiZWVuIGNyb3NzZWQuXG4gKiBAcGFyYW0gez9JbnRlcnNlY3Rpb25PYnNlcnZlckVudHJ5fSBvbGRFbnRyeSBUaGUgcHJldmlvdXMgZW50cnkgZm9yIGFcbiAqICAgIHBhcnRpY3VsYXIgdGFyZ2V0IGVsZW1lbnQgb3IgbnVsbCBpZiBubyBwcmV2aW91cyBlbnRyeSBleGlzdHMuXG4gKiBAcGFyYW0ge0ludGVyc2VjdGlvbk9ic2VydmVyRW50cnl9IG5ld0VudHJ5IFRoZSBjdXJyZW50IGVudHJ5IGZvciBhXG4gKiAgICBwYXJ0aWN1bGFyIHRhcmdldCBlbGVtZW50LlxuICogQHJldHVybiB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGEgYW55IHRocmVzaG9sZCBoYXMgYmVlbiBjcm9zc2VkLlxuICogQHByaXZhdGVcbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLl9oYXNDcm9zc2VkVGhyZXNob2xkID1cbiAgICBmdW5jdGlvbihvbGRFbnRyeSwgbmV3RW50cnkpIHtcblxuICAvLyBUbyBtYWtlIGNvbXBhcmluZyBlYXNpZXIsIGFuIGVudHJ5IHRoYXQgaGFzIGEgcmF0aW8gb2YgMFxuICAvLyBidXQgZG9lcyBub3QgYWN0dWFsbHkgaW50ZXJzZWN0IGlzIGdpdmVuIGEgdmFsdWUgb2YgLTFcbiAgdmFyIG9sZFJhdGlvID0gb2xkRW50cnkgJiYgb2xkRW50cnkuaXNJbnRlcnNlY3RpbmcgP1xuICAgICAgb2xkRW50cnkuaW50ZXJzZWN0aW9uUmF0aW8gfHwgMCA6IC0xO1xuICB2YXIgbmV3UmF0aW8gPSBuZXdFbnRyeS5pc0ludGVyc2VjdGluZyA/XG4gICAgICBuZXdFbnRyeS5pbnRlcnNlY3Rpb25SYXRpbyB8fCAwIDogLTE7XG5cbiAgLy8gSWdub3JlIHVuY2hhbmdlZCByYXRpb3NcbiAgaWYgKG9sZFJhdGlvID09PSBuZXdSYXRpbykgcmV0dXJuO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy50aHJlc2hvbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHRocmVzaG9sZCA9IHRoaXMudGhyZXNob2xkc1tpXTtcblxuICAgIC8vIFJldHVybiB0cnVlIGlmIGFuIGVudHJ5IG1hdGNoZXMgYSB0aHJlc2hvbGQgb3IgaWYgdGhlIG5ldyByYXRpb1xuICAgIC8vIGFuZCB0aGUgb2xkIHJhdGlvIGFyZSBvbiB0aGUgb3Bwb3NpdGUgc2lkZXMgb2YgYSB0aHJlc2hvbGQuXG4gICAgaWYgKHRocmVzaG9sZCA9PSBvbGRSYXRpbyB8fCB0aHJlc2hvbGQgPT0gbmV3UmF0aW8gfHxcbiAgICAgICAgdGhyZXNob2xkIDwgb2xkUmF0aW8gIT09IHRocmVzaG9sZCA8IG5ld1JhdGlvKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIHdoZXRoZXIgb3Igbm90IHRoZSByb290IGVsZW1lbnQgaXMgYW4gZWxlbWVudCBhbmQgaXMgaW4gdGhlIERPTS5cbiAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhlIHJvb3QgZWxlbWVudCBpcyBhbiBlbGVtZW50IGFuZCBpcyBpbiB0aGUgRE9NLlxuICogQHByaXZhdGVcbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLl9yb290SXNJbkRvbSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gIXRoaXMucm9vdCB8fCBjb250YWluc0RlZXAoZG9jdW1lbnQsIHRoaXMucm9vdCk7XG59O1xuXG5cbi8qKlxuICogUmV0dXJucyB3aGV0aGVyIG9yIG5vdCB0aGUgdGFyZ2V0IGVsZW1lbnQgaXMgYSBjaGlsZCBvZiByb290LlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXQgVGhlIHRhcmdldCBlbGVtZW50IHRvIGNoZWNrLlxuICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdGFyZ2V0IGVsZW1lbnQgaXMgYSBjaGlsZCBvZiByb290LlxuICogQHByaXZhdGVcbiAqL1xuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIucHJvdG90eXBlLl9yb290Q29udGFpbnNUYXJnZXQgPSBmdW5jdGlvbih0YXJnZXQpIHtcbiAgdmFyIHJvb3REb2MgPVxuICAgICh0aGlzLnJvb3QgJiYgKHRoaXMucm9vdC5vd25lckRvY3VtZW50IHx8IHRoaXMucm9vdCkpIHx8IGRvY3VtZW50O1xuICByZXR1cm4gKFxuICAgIGNvbnRhaW5zRGVlcChyb290RG9jLCB0YXJnZXQpICYmXG4gICAgKCF0aGlzLnJvb3QgfHwgcm9vdERvYyA9PSB0YXJnZXQub3duZXJEb2N1bWVudClcbiAgKTtcbn07XG5cblxuLyoqXG4gKiBBZGRzIHRoZSBpbnN0YW5jZSB0byB0aGUgZ2xvYmFsIEludGVyc2VjdGlvbk9ic2VydmVyIHJlZ2lzdHJ5IGlmIGl0IGlzbid0XG4gKiBhbHJlYWR5IHByZXNlbnQuXG4gKiBAcHJpdmF0ZVxuICovXG5JbnRlcnNlY3Rpb25PYnNlcnZlci5wcm90b3R5cGUuX3JlZ2lzdGVySW5zdGFuY2UgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHJlZ2lzdHJ5LmluZGV4T2YodGhpcykgPCAwKSB7XG4gICAgcmVnaXN0cnkucHVzaCh0aGlzKTtcbiAgfVxufTtcblxuXG4vKipcbiAqIFJlbW92ZXMgdGhlIGluc3RhbmNlIGZyb20gdGhlIGdsb2JhbCBJbnRlcnNlY3Rpb25PYnNlcnZlciByZWdpc3RyeS5cbiAqIEBwcml2YXRlXG4gKi9cbkludGVyc2VjdGlvbk9ic2VydmVyLnByb3RvdHlwZS5fdW5yZWdpc3Rlckluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBpbmRleCA9IHJlZ2lzdHJ5LmluZGV4T2YodGhpcyk7XG4gIGlmIChpbmRleCAhPSAtMSkgcmVnaXN0cnkuc3BsaWNlKGluZGV4LCAxKTtcbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgdGhlIHBlcmZvcm1hbmNlLm5vdygpIG1ldGhvZCBvciBudWxsIGluIGJyb3dzZXJzXG4gKiB0aGF0IGRvbid0IHN1cHBvcnQgdGhlIEFQSS5cbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIGVsYXBzZWQgdGltZSBzaW5jZSB0aGUgcGFnZSB3YXMgcmVxdWVzdGVkLlxuICovXG5mdW5jdGlvbiBub3coKSB7XG4gIHJldHVybiB3aW5kb3cucGVyZm9ybWFuY2UgJiYgcGVyZm9ybWFuY2Uubm93ICYmIHBlcmZvcm1hbmNlLm5vdygpO1xufVxuXG5cbi8qKlxuICogVGhyb3R0bGVzIGEgZnVuY3Rpb24gYW5kIGRlbGF5cyBpdHMgZXhlY3V0aW9uLCBzbyBpdCdzIG9ubHkgY2FsbGVkIGF0IG1vc3RcbiAqIG9uY2Ugd2l0aGluIGEgZ2l2ZW4gdGltZSBwZXJpb2QuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgZnVuY3Rpb24gdG8gdGhyb3R0bGUuXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZW91dCBUaGUgYW1vdW50IG9mIHRpbWUgdGhhdCBtdXN0IHBhc3MgYmVmb3JlIHRoZVxuICogICAgIGZ1bmN0aW9uIGNhbiBiZSBjYWxsZWQgYWdhaW4uXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gVGhlIHRocm90dGxlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gdGhyb3R0bGUoZm4sIHRpbWVvdXQpIHtcbiAgdmFyIHRpbWVyID0gbnVsbDtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRpbWVyKSB7XG4gICAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGZuKCk7XG4gICAgICAgIHRpbWVyID0gbnVsbDtcbiAgICAgIH0sIHRpbWVvdXQpO1xuICAgIH1cbiAgfTtcbn1cblxuXG4vKipcbiAqIEFkZHMgYW4gZXZlbnQgaGFuZGxlciB0byBhIERPTSBub2RlIGVuc3VyaW5nIGNyb3NzLWJyb3dzZXIgY29tcGF0aWJpbGl0eS5cbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZSBUaGUgRE9NIG5vZGUgdG8gYWRkIHRoZSBldmVudCBoYW5kbGVyIHRvLlxuICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50IFRoZSBldmVudCBuYW1lLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGV2ZW50IGhhbmRsZXIgdG8gYWRkLlxuICogQHBhcmFtIHtib29sZWFufSBvcHRfdXNlQ2FwdHVyZSBPcHRpb25hbGx5IGFkZHMgdGhlIGV2ZW4gdG8gdGhlIGNhcHR1cmVcbiAqICAgICBwaGFzZS4gTm90ZTogdGhpcyBvbmx5IHdvcmtzIGluIG1vZGVybiBicm93c2Vycy5cbiAqL1xuZnVuY3Rpb24gYWRkRXZlbnQobm9kZSwgZXZlbnQsIGZuLCBvcHRfdXNlQ2FwdHVyZSkge1xuICBpZiAodHlwZW9mIG5vZGUuYWRkRXZlbnRMaXN0ZW5lciA9PSAnZnVuY3Rpb24nKSB7XG4gICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBmbiwgb3B0X3VzZUNhcHR1cmUgfHwgZmFsc2UpO1xuICB9XG4gIGVsc2UgaWYgKHR5cGVvZiBub2RlLmF0dGFjaEV2ZW50ID09ICdmdW5jdGlvbicpIHtcbiAgICBub2RlLmF0dGFjaEV2ZW50KCdvbicgKyBldmVudCwgZm4pO1xuICB9XG59XG5cblxuLyoqXG4gKiBSZW1vdmVzIGEgcHJldmlvdXNseSBhZGRlZCBldmVudCBoYW5kbGVyIGZyb20gYSBET00gbm9kZS5cbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZSBUaGUgRE9NIG5vZGUgdG8gcmVtb3ZlIHRoZSBldmVudCBoYW5kbGVyIGZyb20uXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQgVGhlIGV2ZW50IG5hbWUuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgZXZlbnQgaGFuZGxlciB0byByZW1vdmUuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IG9wdF91c2VDYXB0dXJlIElmIHRoZSBldmVudCBoYW5kbGVyIHdhcyBhZGRlZCB3aXRoIHRoaXNcbiAqICAgICBmbGFnIHNldCB0byB0cnVlLCBpdCBzaG91bGQgYmUgc2V0IHRvIHRydWUgaGVyZSBpbiBvcmRlciB0byByZW1vdmUgaXQuXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZUV2ZW50KG5vZGUsIGV2ZW50LCBmbiwgb3B0X3VzZUNhcHR1cmUpIHtcbiAgaWYgKHR5cGVvZiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPT0gJ2Z1bmN0aW9uJykge1xuICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgZm4sIG9wdF91c2VDYXB0dXJlIHx8IGZhbHNlKTtcbiAgfVxuICBlbHNlIGlmICh0eXBlb2Ygbm9kZS5kZXRhdGNoRXZlbnQgPT0gJ2Z1bmN0aW9uJykge1xuICAgIG5vZGUuZGV0YXRjaEV2ZW50KCdvbicgKyBldmVudCwgZm4pO1xuICB9XG59XG5cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBpbnRlcnNlY3Rpb24gYmV0d2VlbiB0d28gcmVjdCBvYmplY3RzLlxuICogQHBhcmFtIHtPYmplY3R9IHJlY3QxIFRoZSBmaXJzdCByZWN0LlxuICogQHBhcmFtIHtPYmplY3R9IHJlY3QyIFRoZSBzZWNvbmQgcmVjdC5cbiAqIEByZXR1cm4gez9PYmplY3R8P0NsaWVudFJlY3R9IFRoZSBpbnRlcnNlY3Rpb24gcmVjdCBvciB1bmRlZmluZWQgaWYgbm9cbiAqICAgICBpbnRlcnNlY3Rpb24gaXMgZm91bmQuXG4gKi9cbmZ1bmN0aW9uIGNvbXB1dGVSZWN0SW50ZXJzZWN0aW9uKHJlY3QxLCByZWN0Mikge1xuICB2YXIgdG9wID0gTWF0aC5tYXgocmVjdDEudG9wLCByZWN0Mi50b3ApO1xuICB2YXIgYm90dG9tID0gTWF0aC5taW4ocmVjdDEuYm90dG9tLCByZWN0Mi5ib3R0b20pO1xuICB2YXIgbGVmdCA9IE1hdGgubWF4KHJlY3QxLmxlZnQsIHJlY3QyLmxlZnQpO1xuICB2YXIgcmlnaHQgPSBNYXRoLm1pbihyZWN0MS5yaWdodCwgcmVjdDIucmlnaHQpO1xuICB2YXIgd2lkdGggPSByaWdodCAtIGxlZnQ7XG4gIHZhciBoZWlnaHQgPSBib3R0b20gLSB0b3A7XG5cbiAgcmV0dXJuICh3aWR0aCA+PSAwICYmIGhlaWdodCA+PSAwKSAmJiB7XG4gICAgdG9wOiB0b3AsXG4gICAgYm90dG9tOiBib3R0b20sXG4gICAgbGVmdDogbGVmdCxcbiAgICByaWdodDogcmlnaHQsXG4gICAgd2lkdGg6IHdpZHRoLFxuICAgIGhlaWdodDogaGVpZ2h0XG4gIH0gfHwgbnVsbDtcbn1cblxuXG4vKipcbiAqIFNoaW1zIHRoZSBuYXRpdmUgZ2V0Qm91bmRpbmdDbGllbnRSZWN0IGZvciBjb21wYXRpYmlsaXR5IHdpdGggb2xkZXIgSUUuXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsIFRoZSBlbGVtZW50IHdob3NlIGJvdW5kaW5nIHJlY3QgdG8gZ2V0LlxuICogQHJldHVybiB7RE9NUmVjdHxDbGllbnRSZWN0fSBUaGUgKHBvc3NpYmx5IHNoaW1tZWQpIHJlY3Qgb2YgdGhlIGVsZW1lbnQuXG4gKi9cbmZ1bmN0aW9uIGdldEJvdW5kaW5nQ2xpZW50UmVjdChlbCkge1xuICB2YXIgcmVjdDtcblxuICB0cnkge1xuICAgIHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgLy8gSWdub3JlIFdpbmRvd3MgNyBJRTExIFwiVW5zcGVjaWZpZWQgZXJyb3JcIlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93M2MvSW50ZXJzZWN0aW9uT2JzZXJ2ZXIvcHVsbC8yMDVcbiAgfVxuXG4gIGlmICghcmVjdCkgcmV0dXJuIGdldEVtcHR5UmVjdCgpO1xuXG4gIC8vIE9sZGVyIElFXG4gIGlmICghKHJlY3Qud2lkdGggJiYgcmVjdC5oZWlnaHQpKSB7XG4gICAgcmVjdCA9IHtcbiAgICAgIHRvcDogcmVjdC50b3AsXG4gICAgICByaWdodDogcmVjdC5yaWdodCxcbiAgICAgIGJvdHRvbTogcmVjdC5ib3R0b20sXG4gICAgICBsZWZ0OiByZWN0LmxlZnQsXG4gICAgICB3aWR0aDogcmVjdC5yaWdodCAtIHJlY3QubGVmdCxcbiAgICAgIGhlaWdodDogcmVjdC5ib3R0b20gLSByZWN0LnRvcFxuICAgIH07XG4gIH1cbiAgcmV0dXJuIHJlY3Q7XG59XG5cblxuLyoqXG4gKiBSZXR1cm5zIGFuIGVtcHR5IHJlY3Qgb2JqZWN0LiBBbiBlbXB0eSByZWN0IGlzIHJldHVybmVkIHdoZW4gYW4gZWxlbWVudFxuICogaXMgbm90IGluIHRoZSBET00uXG4gKiBAcmV0dXJuIHtDbGllbnRSZWN0fSBUaGUgZW1wdHkgcmVjdC5cbiAqL1xuZnVuY3Rpb24gZ2V0RW1wdHlSZWN0KCkge1xuICByZXR1cm4ge1xuICAgIHRvcDogMCxcbiAgICBib3R0b206IDAsXG4gICAgbGVmdDogMCxcbiAgICByaWdodDogMCxcbiAgICB3aWR0aDogMCxcbiAgICBoZWlnaHQ6IDBcbiAgfTtcbn1cblxuXG4vKipcbiAqIEVuc3VyZSB0aGF0IHRoZSByZXN1bHQgaGFzIGFsbCBvZiB0aGUgbmVjZXNzYXJ5IGZpZWxkcyBvZiB0aGUgRE9NUmVjdC5cbiAqIFNwZWNpZmljYWxseSB0aGlzIGVuc3VyZXMgdGhhdCBgeGAgYW5kIGB5YCBmaWVsZHMgYXJlIHNldC5cbiAqXG4gKiBAcGFyYW0gez9ET01SZWN0fD9DbGllbnRSZWN0fSByZWN0XG4gKiBAcmV0dXJuIHs/RE9NUmVjdH1cbiAqL1xuZnVuY3Rpb24gZW5zdXJlRE9NUmVjdChyZWN0KSB7XG4gIC8vIEEgYERPTVJlY3RgIG9iamVjdCBoYXMgYHhgIGFuZCBgeWAgZmllbGRzLlxuICBpZiAoIXJlY3QgfHwgJ3gnIGluIHJlY3QpIHtcbiAgICByZXR1cm4gcmVjdDtcbiAgfVxuICAvLyBBIElFJ3MgYENsaWVudFJlY3RgIHR5cGUgZG9lcyBub3QgaGF2ZSBgeGAgYW5kIGB5YC4gVGhlIHNhbWUgaXMgdGhlIGNhc2VcbiAgLy8gZm9yIGludGVybmFsbHkgY2FsY3VsYXRlZCBSZWN0IG9iamVjdHMuIEZvciB0aGUgcHVycG9zZXMgb2ZcbiAgLy8gYEludGVyc2VjdGlvbk9ic2VydmVyYCwgaXQncyBzdWZmaWNpZW50IHRvIHNpbXBseSBtaXJyb3IgYGxlZnRgIGFuZCBgdG9wYFxuICAvLyBmb3IgdGhlc2UgZmllbGRzLlxuICByZXR1cm4ge1xuICAgIHRvcDogcmVjdC50b3AsXG4gICAgeTogcmVjdC50b3AsXG4gICAgYm90dG9tOiByZWN0LmJvdHRvbSxcbiAgICBsZWZ0OiByZWN0LmxlZnQsXG4gICAgeDogcmVjdC5sZWZ0LFxuICAgIHJpZ2h0OiByZWN0LnJpZ2h0LFxuICAgIHdpZHRoOiByZWN0LndpZHRoLFxuICAgIGhlaWdodDogcmVjdC5oZWlnaHRcbiAgfTtcbn1cblxuXG4vKipcbiAqIEludmVydHMgdGhlIGludGVyc2VjdGlvbiBhbmQgYm91bmRpbmcgcmVjdCBmcm9tIHRoZSBwYXJlbnQgKGZyYW1lKSBCQ1IgdG9cbiAqIHRoZSBsb2NhbCBCQ1Igc3BhY2UuXG4gKiBAcGFyYW0ge0RPTVJlY3R8Q2xpZW50UmVjdH0gcGFyZW50Qm91bmRpbmdSZWN0IFRoZSBwYXJlbnQncyBib3VuZCBjbGllbnQgcmVjdC5cbiAqIEBwYXJhbSB7RE9NUmVjdHxDbGllbnRSZWN0fSBwYXJlbnRJbnRlcnNlY3Rpb25SZWN0IFRoZSBwYXJlbnQncyBvd24gaW50ZXJzZWN0aW9uIHJlY3QuXG4gKiBAcmV0dXJuIHtDbGllbnRSZWN0fSBUaGUgbG9jYWwgcm9vdCBib3VuZGluZyByZWN0IGZvciB0aGUgcGFyZW50J3MgY2hpbGRyZW4uXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRGcm9tUGFyZW50UmVjdChwYXJlbnRCb3VuZGluZ1JlY3QsIHBhcmVudEludGVyc2VjdGlvblJlY3QpIHtcbiAgdmFyIHRvcCA9IHBhcmVudEludGVyc2VjdGlvblJlY3QudG9wIC0gcGFyZW50Qm91bmRpbmdSZWN0LnRvcDtcbiAgdmFyIGxlZnQgPSBwYXJlbnRJbnRlcnNlY3Rpb25SZWN0LmxlZnQgLSBwYXJlbnRCb3VuZGluZ1JlY3QubGVmdDtcbiAgcmV0dXJuIHtcbiAgICB0b3A6IHRvcCxcbiAgICBsZWZ0OiBsZWZ0LFxuICAgIGhlaWdodDogcGFyZW50SW50ZXJzZWN0aW9uUmVjdC5oZWlnaHQsXG4gICAgd2lkdGg6IHBhcmVudEludGVyc2VjdGlvblJlY3Qud2lkdGgsXG4gICAgYm90dG9tOiB0b3AgKyBwYXJlbnRJbnRlcnNlY3Rpb25SZWN0LmhlaWdodCxcbiAgICByaWdodDogbGVmdCArIHBhcmVudEludGVyc2VjdGlvblJlY3Qud2lkdGhcbiAgfTtcbn1cblxuXG4vKipcbiAqIENoZWNrcyB0byBzZWUgaWYgYSBwYXJlbnQgZWxlbWVudCBjb250YWlucyBhIGNoaWxkIGVsZW1lbnQgKGluY2x1ZGluZyBpbnNpZGVcbiAqIHNoYWRvdyBET00pLlxuICogQHBhcmFtIHtOb2RlfSBwYXJlbnQgVGhlIHBhcmVudCBlbGVtZW50LlxuICogQHBhcmFtIHtOb2RlfSBjaGlsZCBUaGUgY2hpbGQgZWxlbWVudC5cbiAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhlIHBhcmVudCBub2RlIGNvbnRhaW5zIHRoZSBjaGlsZCBub2RlLlxuICovXG5mdW5jdGlvbiBjb250YWluc0RlZXAocGFyZW50LCBjaGlsZCkge1xuICB2YXIgbm9kZSA9IGNoaWxkO1xuICB3aGlsZSAobm9kZSkge1xuICAgIGlmIChub2RlID09IHBhcmVudCkgcmV0dXJuIHRydWU7XG5cbiAgICBub2RlID0gZ2V0UGFyZW50Tm9kZShub2RlKTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cblxuLyoqXG4gKiBHZXRzIHRoZSBwYXJlbnQgbm9kZSBvZiBhbiBlbGVtZW50IG9yIGl0cyBob3N0IGVsZW1lbnQgaWYgdGhlIHBhcmVudCBub2RlXG4gKiBpcyBhIHNoYWRvdyByb290LlxuICogQHBhcmFtIHtOb2RlfSBub2RlIFRoZSBub2RlIHdob3NlIHBhcmVudCB0byBnZXQuXG4gKiBAcmV0dXJuIHtOb2RlfG51bGx9IFRoZSBwYXJlbnQgbm9kZSBvciBudWxsIGlmIG5vIHBhcmVudCBleGlzdHMuXG4gKi9cbmZ1bmN0aW9uIGdldFBhcmVudE5vZGUobm9kZSkge1xuICB2YXIgcGFyZW50ID0gbm9kZS5wYXJlbnROb2RlO1xuXG4gIGlmIChub2RlLm5vZGVUeXBlID09IC8qIERPQ1VNRU5UICovIDkgJiYgbm9kZSAhPSBkb2N1bWVudCkge1xuICAgIC8vIElmIHRoaXMgbm9kZSBpcyBhIGRvY3VtZW50IG5vZGUsIGxvb2sgZm9yIHRoZSBlbWJlZGRpbmcgZnJhbWUuXG4gICAgcmV0dXJuIGdldEZyYW1lRWxlbWVudChub2RlKTtcbiAgfVxuXG4gIC8vIElmIHRoZSBwYXJlbnQgaGFzIGVsZW1lbnQgdGhhdCBpcyBhc3NpZ25lZCB0aHJvdWdoIHNoYWRvdyByb290IHNsb3RcbiAgaWYgKHBhcmVudCAmJiBwYXJlbnQuYXNzaWduZWRTbG90KSB7XG4gICAgcGFyZW50ID0gcGFyZW50LmFzc2lnbmVkU2xvdC5wYXJlbnROb2RlXG4gIH1cblxuICBpZiAocGFyZW50ICYmIHBhcmVudC5ub2RlVHlwZSA9PSAxMSAmJiBwYXJlbnQuaG9zdCkge1xuICAgIC8vIElmIHRoZSBwYXJlbnQgaXMgYSBzaGFkb3cgcm9vdCwgcmV0dXJuIHRoZSBob3N0IGVsZW1lbnQuXG4gICAgcmV0dXJuIHBhcmVudC5ob3N0O1xuICB9XG5cbiAgcmV0dXJuIHBhcmVudDtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgYG5vZGVgIGlzIGEgRG9jdW1lbnQuXG4gKiBAcGFyYW0geyFOb2RlfSBub2RlXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuZnVuY3Rpb24gaXNEb2Mobm9kZSkge1xuICByZXR1cm4gbm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSA5O1xufVxuXG5cbi8vIEV4cG9zZXMgdGhlIGNvbnN0cnVjdG9ycyBnbG9iYWxseS5cbndpbmRvdy5JbnRlcnNlY3Rpb25PYnNlcnZlciA9IEludGVyc2VjdGlvbk9ic2VydmVyO1xud2luZG93LkludGVyc2VjdGlvbk9ic2VydmVyRW50cnkgPSBJbnRlcnNlY3Rpb25PYnNlcnZlckVudHJ5O1xuXG59KCkpO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gZmFjdG9yeSgpIDpcbiAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKCdpbmVydCcsIGZhY3RvcnkpIDpcbiAgKGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuICB2YXIgX2NyZWF0ZUNsYXNzID0gZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSgpO1xuXG4gIGZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTsgfSB9XG5cbiAgLyoqXG4gICAqIFRoaXMgd29yayBpcyBsaWNlbnNlZCB1bmRlciB0aGUgVzNDIFNvZnR3YXJlIGFuZCBEb2N1bWVudCBMaWNlbnNlXG4gICAqIChodHRwOi8vd3d3LnczLm9yZy9Db25zb3J0aXVtL0xlZ2FsLzIwMTUvY29weXJpZ2h0LXNvZnR3YXJlLWFuZC1kb2N1bWVudCkuXG4gICAqL1xuXG4gIChmdW5jdGlvbiAoKSB7XG4gICAgLy8gUmV0dXJuIGVhcmx5IGlmIHdlJ3JlIG5vdCBydW5uaW5nIGluc2lkZSBvZiB0aGUgYnJvd3Nlci5cbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDb252ZW5pZW5jZSBmdW5jdGlvbiBmb3IgY29udmVydGluZyBOb2RlTGlzdHMuXG4gICAgLyoqIEB0eXBlIHt0eXBlb2YgQXJyYXkucHJvdG90eXBlLnNsaWNlfSAqL1xuICAgIHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuICAgIC8qKlxuICAgICAqIElFIGhhcyBhIG5vbi1zdGFuZGFyZCBuYW1lIGZvciBcIm1hdGNoZXNcIi5cbiAgICAgKiBAdHlwZSB7dHlwZW9mIEVsZW1lbnQucHJvdG90eXBlLm1hdGNoZXN9XG4gICAgICovXG4gICAgdmFyIG1hdGNoZXMgPSBFbGVtZW50LnByb3RvdHlwZS5tYXRjaGVzIHx8IEVsZW1lbnQucHJvdG90eXBlLm1zTWF0Y2hlc1NlbGVjdG9yO1xuXG4gICAgLyoqIEB0eXBlIHtzdHJpbmd9ICovXG4gICAgdmFyIF9mb2N1c2FibGVFbGVtZW50c1N0cmluZyA9IFsnYVtocmVmXScsICdhcmVhW2hyZWZdJywgJ2lucHV0Om5vdChbZGlzYWJsZWRdKScsICdzZWxlY3Q6bm90KFtkaXNhYmxlZF0pJywgJ3RleHRhcmVhOm5vdChbZGlzYWJsZWRdKScsICdidXR0b246bm90KFtkaXNhYmxlZF0pJywgJ2RldGFpbHMnLCAnc3VtbWFyeScsICdpZnJhbWUnLCAnb2JqZWN0JywgJ2VtYmVkJywgJ1tjb250ZW50ZWRpdGFibGVdJ10uam9pbignLCcpO1xuXG4gICAgLyoqXG4gICAgICogYEluZXJ0Um9vdGAgbWFuYWdlcyBhIHNpbmdsZSBpbmVydCBzdWJ0cmVlLCBpLmUuIGEgRE9NIHN1YnRyZWUgd2hvc2Ugcm9vdCBlbGVtZW50IGhhcyBhbiBgaW5lcnRgXG4gICAgICogYXR0cmlidXRlLlxuICAgICAqXG4gICAgICogSXRzIG1haW4gZnVuY3Rpb25zIGFyZTpcbiAgICAgKlxuICAgICAqIC0gdG8gY3JlYXRlIGFuZCBtYWludGFpbiBhIHNldCBvZiBtYW5hZ2VkIGBJbmVydE5vZGVgcywgaW5jbHVkaW5nIHdoZW4gbXV0YXRpb25zIG9jY3VyIGluIHRoZVxuICAgICAqICAgc3VidHJlZS4gVGhlIGBtYWtlU3VidHJlZVVuZm9jdXNhYmxlKClgIG1ldGhvZCBoYW5kbGVzIGNvbGxlY3RpbmcgYEluZXJ0Tm9kZWBzIHZpYSByZWdpc3RlcmluZ1xuICAgICAqICAgZWFjaCBmb2N1c2FibGUgbm9kZSBpbiB0aGUgc3VidHJlZSB3aXRoIHRoZSBzaW5nbGV0b24gYEluZXJ0TWFuYWdlcmAgd2hpY2ggbWFuYWdlcyBhbGwga25vd25cbiAgICAgKiAgIGZvY3VzYWJsZSBub2RlcyB3aXRoaW4gaW5lcnQgc3VidHJlZXMuIGBJbmVydE1hbmFnZXJgIGVuc3VyZXMgdGhhdCBhIHNpbmdsZSBgSW5lcnROb2RlYFxuICAgICAqICAgaW5zdGFuY2UgZXhpc3RzIGZvciBlYWNoIGZvY3VzYWJsZSBub2RlIHdoaWNoIGhhcyBhdCBsZWFzdCBvbmUgaW5lcnQgcm9vdCBhcyBhbiBhbmNlc3Rvci5cbiAgICAgKlxuICAgICAqIC0gdG8gbm90aWZ5IGFsbCBtYW5hZ2VkIGBJbmVydE5vZGVgcyB3aGVuIHRoaXMgc3VidHJlZSBzdG9wcyBiZWluZyBpbmVydCAoaS5lLiB3aGVuIHRoZSBgaW5lcnRgXG4gICAgICogICBhdHRyaWJ1dGUgaXMgcmVtb3ZlZCBmcm9tIHRoZSByb290IG5vZGUpLiBUaGlzIGlzIGhhbmRsZWQgaW4gdGhlIGRlc3RydWN0b3IsIHdoaWNoIGNhbGxzIHRoZVxuICAgICAqICAgYGRlcmVnaXN0ZXJgIG1ldGhvZCBvbiBgSW5lcnRNYW5hZ2VyYCBmb3IgZWFjaCBtYW5hZ2VkIGluZXJ0IG5vZGUuXG4gICAgICovXG5cbiAgICB2YXIgSW5lcnRSb290ID0gZnVuY3Rpb24gKCkge1xuICAgICAgLyoqXG4gICAgICAgKiBAcGFyYW0geyFFbGVtZW50fSByb290RWxlbWVudCBUaGUgRWxlbWVudCBhdCB0aGUgcm9vdCBvZiB0aGUgaW5lcnQgc3VidHJlZS5cbiAgICAgICAqIEBwYXJhbSB7IUluZXJ0TWFuYWdlcn0gaW5lcnRNYW5hZ2VyIFRoZSBnbG9iYWwgc2luZ2xldG9uIEluZXJ0TWFuYWdlciBvYmplY3QuXG4gICAgICAgKi9cbiAgICAgIGZ1bmN0aW9uIEluZXJ0Um9vdChyb290RWxlbWVudCwgaW5lcnRNYW5hZ2VyKSB7XG4gICAgICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBJbmVydFJvb3QpO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7IUluZXJ0TWFuYWdlcn0gKi9cbiAgICAgICAgdGhpcy5faW5lcnRNYW5hZ2VyID0gaW5lcnRNYW5hZ2VyO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7IUVsZW1lbnR9ICovXG4gICAgICAgIHRoaXMuX3Jvb3RFbGVtZW50ID0gcm9vdEVsZW1lbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHshU2V0PCFJbmVydE5vZGU+fVxuICAgICAgICAgKiBBbGwgbWFuYWdlZCBmb2N1c2FibGUgbm9kZXMgaW4gdGhpcyBJbmVydFJvb3QncyBzdWJ0cmVlLlxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbWFuYWdlZE5vZGVzID0gbmV3IFNldCgpO1xuXG4gICAgICAgIC8vIE1ha2UgdGhlIHN1YnRyZWUgaGlkZGVuIGZyb20gYXNzaXN0aXZlIHRlY2hub2xvZ3lcbiAgICAgICAgaWYgKHRoaXMuX3Jvb3RFbGVtZW50Lmhhc0F0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nKSkge1xuICAgICAgICAgIC8qKiBAdHlwZSB7P3N0cmluZ30gKi9cbiAgICAgICAgICB0aGlzLl9zYXZlZEFyaWFIaWRkZW4gPSB0aGlzLl9yb290RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fc2F2ZWRBcmlhSGlkZGVuID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yb290RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblxuICAgICAgICAvLyBNYWtlIGFsbCBmb2N1c2FibGUgZWxlbWVudHMgaW4gdGhlIHN1YnRyZWUgdW5mb2N1c2FibGUgYW5kIGFkZCB0aGVtIHRvIF9tYW5hZ2VkTm9kZXNcbiAgICAgICAgdGhpcy5fbWFrZVN1YnRyZWVVbmZvY3VzYWJsZSh0aGlzLl9yb290RWxlbWVudCk7XG5cbiAgICAgICAgLy8gV2F0Y2ggZm9yOlxuICAgICAgICAvLyAtIGFueSBhZGRpdGlvbnMgaW4gdGhlIHN1YnRyZWU6IG1ha2UgdGhlbSB1bmZvY3VzYWJsZSB0b29cbiAgICAgICAgLy8gLSBhbnkgcmVtb3ZhbHMgZnJvbSB0aGUgc3VidHJlZTogcmVtb3ZlIHRoZW0gZnJvbSB0aGlzIGluZXJ0IHJvb3QncyBtYW5hZ2VkIG5vZGVzXG4gICAgICAgIC8vIC0gYXR0cmlidXRlIGNoYW5nZXM6IGlmIGB0YWJpbmRleGAgaXMgYWRkZWQsIG9yIHJlbW92ZWQgZnJvbSBhbiBpbnRyaW5zaWNhbGx5IGZvY3VzYWJsZVxuICAgICAgICAvLyAgIGVsZW1lbnQsIG1ha2UgdGhhdCBub2RlIGEgbWFuYWdlZCBub2RlLlxuICAgICAgICB0aGlzLl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMuX29uTXV0YXRpb24uYmluZCh0aGlzKSk7XG4gICAgICAgIHRoaXMuX29ic2VydmVyLm9ic2VydmUodGhpcy5fcm9vdEVsZW1lbnQsIHsgYXR0cmlidXRlczogdHJ1ZSwgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgICAgfVxuXG4gICAgICAvKipcbiAgICAgICAqIENhbGwgdGhpcyB3aGVuZXZlciB0aGlzIG9iamVjdCBpcyBhYm91dCB0byBiZWNvbWUgb2Jzb2xldGUuICBUaGlzIHVud2luZHMgYWxsIG9mIHRoZSBzdGF0ZVxuICAgICAgICogc3RvcmVkIGluIHRoaXMgb2JqZWN0IGFuZCB1cGRhdGVzIHRoZSBzdGF0ZSBvZiBhbGwgb2YgdGhlIG1hbmFnZWQgbm9kZXMuXG4gICAgICAgKi9cblxuXG4gICAgICBfY3JlYXRlQ2xhc3MoSW5lcnRSb290LCBbe1xuICAgICAgICBrZXk6ICdkZXN0cnVjdG9yJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGRlc3RydWN0b3IoKSB7XG4gICAgICAgICAgdGhpcy5fb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuXG4gICAgICAgICAgaWYgKHRoaXMuX3Jvb3RFbGVtZW50KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2F2ZWRBcmlhSGlkZGVuICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3Jvb3RFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCB0aGlzLl9zYXZlZEFyaWFIaWRkZW4pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5fcm9vdEVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWhpZGRlbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuX21hbmFnZWROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChpbmVydE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VubWFuYWdlTm9kZShpbmVydE5vZGUubm9kZSk7XG4gICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAvLyBOb3RlIHdlIGNhc3QgdGhlIG51bGxzIHRvIHRoZSBBTlkgdHlwZSBoZXJlIGJlY2F1c2U6XG4gICAgICAgICAgLy8gMSkgV2Ugd2FudCB0aGUgY2xhc3MgcHJvcGVydGllcyB0byBiZSBkZWNsYXJlZCBhcyBub24tbnVsbCwgb3IgZWxzZSB3ZVxuICAgICAgICAgIC8vICAgIG5lZWQgZXZlbiBtb3JlIGNhc3RzIHRocm91Z2hvdXQgdGhpcyBjb2RlLiBBbGwgYmV0cyBhcmUgb2ZmIGlmIGFuXG4gICAgICAgICAgLy8gICAgaW5zdGFuY2UgaGFzIGJlZW4gZGVzdHJveWVkIGFuZCBhIG1ldGhvZCBpcyBjYWxsZWQuXG4gICAgICAgICAgLy8gMikgV2UgZG9uJ3Qgd2FudCB0byBjYXN0IFwidGhpc1wiLCBiZWNhdXNlIHdlIHdhbnQgdHlwZS1hd2FyZSBvcHRpbWl6YXRpb25zXG4gICAgICAgICAgLy8gICAgdG8ga25vdyB3aGljaCBwcm9wZXJ0aWVzIHdlJ3JlIHNldHRpbmcuXG4gICAgICAgICAgdGhpcy5fb2JzZXJ2ZXIgPSAvKiogQHR5cGUgez99ICovbnVsbDtcbiAgICAgICAgICB0aGlzLl9yb290RWxlbWVudCA9IC8qKiBAdHlwZSB7P30gKi9udWxsO1xuICAgICAgICAgIHRoaXMuX21hbmFnZWROb2RlcyA9IC8qKiBAdHlwZSB7P30gKi9udWxsO1xuICAgICAgICAgIHRoaXMuX2luZXJ0TWFuYWdlciA9IC8qKiBAdHlwZSB7P30gKi9udWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4geyFTZXQ8IUluZXJ0Tm9kZT59IEEgY29weSBvZiB0aGlzIEluZXJ0Um9vdCdzIG1hbmFnZWQgbm9kZXMgc2V0LlxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfbWFrZVN1YnRyZWVVbmZvY3VzYWJsZScsXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHshTm9kZX0gc3RhcnROb2RlXG4gICAgICAgICAqL1xuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gX21ha2VTdWJ0cmVlVW5mb2N1c2FibGUoc3RhcnROb2RlKSB7XG4gICAgICAgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgICAgICAgICBjb21wb3NlZFRyZWVXYWxrKHN0YXJ0Tm9kZSwgZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpczIuX3Zpc2l0Tm9kZShub2RlKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHZhciBhY3RpdmVFbGVtZW50ID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblxuICAgICAgICAgIGlmICghZG9jdW1lbnQuYm9keS5jb250YWlucyhzdGFydE5vZGUpKSB7XG4gICAgICAgICAgICAvLyBzdGFydE5vZGUgbWF5IGJlIGluIHNoYWRvdyBET00sIHNvIGZpbmQgaXRzIG5lYXJlc3Qgc2hhZG93Um9vdCB0byBnZXQgdGhlIGFjdGl2ZUVsZW1lbnQuXG4gICAgICAgICAgICB2YXIgbm9kZSA9IHN0YXJ0Tm9kZTtcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7IVNoYWRvd1Jvb3R8dW5kZWZpbmVkfSAqL1xuICAgICAgICAgICAgdmFyIHJvb3QgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5ET0NVTUVOVF9GUkFHTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICAgICAgcm9vdCA9IC8qKiBAdHlwZSB7IVNoYWRvd1Jvb3R9ICovbm9kZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJvb3QpIHtcbiAgICAgICAgICAgICAgYWN0aXZlRWxlbWVudCA9IHJvb3QuYWN0aXZlRWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0YXJ0Tm9kZS5jb250YWlucyhhY3RpdmVFbGVtZW50KSkge1xuICAgICAgICAgICAgYWN0aXZlRWxlbWVudC5ibHVyKCk7XG4gICAgICAgICAgICAvLyBJbiBJRTExLCBpZiBhbiBlbGVtZW50IGlzIGFscmVhZHkgZm9jdXNlZCwgYW5kIHRoZW4gc2V0IHRvIHRhYmluZGV4PS0xXG4gICAgICAgICAgICAvLyBjYWxsaW5nIGJsdXIoKSB3aWxsIG5vdCBhY3R1YWxseSBtb3ZlIHRoZSBmb2N1cy5cbiAgICAgICAgICAgIC8vIFRvIHdvcmsgYXJvdW5kIHRoaXMgd2UgY2FsbCBmb2N1cygpIG9uIHRoZSBib2R5IGluc3RlYWQuXG4gICAgICAgICAgICBpZiAoYWN0aXZlRWxlbWVudCA9PT0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkge1xuICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmZvY3VzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7IU5vZGV9IG5vZGVcbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnX3Zpc2l0Tm9kZScsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBfdmlzaXROb2RlKG5vZGUpIHtcbiAgICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSAhPT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSAvKiogQHR5cGUgeyFFbGVtZW50fSAqL25vZGU7XG5cbiAgICAgICAgICAvLyBJZiBhIGRlc2NlbmRhbnQgaW5lcnQgcm9vdCBiZWNvbWVzIHVuLWluZXJ0LCBpdHMgZGVzY2VuZGFudHMgd2lsbCBzdGlsbCBiZSBpbmVydCBiZWNhdXNlIG9mXG4gICAgICAgICAgLy8gdGhpcyBpbmVydCByb290LCBzbyBhbGwgb2YgaXRzIG1hbmFnZWQgbm9kZXMgbmVlZCB0byBiZSBhZG9wdGVkIGJ5IHRoaXMgSW5lcnRSb290LlxuICAgICAgICAgIGlmIChlbGVtZW50ICE9PSB0aGlzLl9yb290RWxlbWVudCAmJiBlbGVtZW50Lmhhc0F0dHJpYnV0ZSgnaW5lcnQnKSkge1xuICAgICAgICAgICAgdGhpcy5fYWRvcHRJbmVydFJvb3QoZWxlbWVudCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG1hdGNoZXMuY2FsbChlbGVtZW50LCBfZm9jdXNhYmxlRWxlbWVudHNTdHJpbmcpIHx8IGVsZW1lbnQuaGFzQXR0cmlidXRlKCd0YWJpbmRleCcpKSB7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VOb2RlKGVsZW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlciB0aGUgZ2l2ZW4gbm9kZSB3aXRoIHRoaXMgSW5lcnRSb290IGFuZCB3aXRoIEluZXJ0TWFuYWdlci5cbiAgICAgICAgICogQHBhcmFtIHshTm9kZX0gbm9kZVxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfbWFuYWdlTm9kZScsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBfbWFuYWdlTm9kZShub2RlKSB7XG4gICAgICAgICAgdmFyIGluZXJ0Tm9kZSA9IHRoaXMuX2luZXJ0TWFuYWdlci5yZWdpc3Rlcihub2RlLCB0aGlzKTtcbiAgICAgICAgICB0aGlzLl9tYW5hZ2VkTm9kZXMuYWRkKGluZXJ0Tm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVW5yZWdpc3RlciB0aGUgZ2l2ZW4gbm9kZSB3aXRoIHRoaXMgSW5lcnRSb290IGFuZCB3aXRoIEluZXJ0TWFuYWdlci5cbiAgICAgICAgICogQHBhcmFtIHshTm9kZX0gbm9kZVxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfdW5tYW5hZ2VOb2RlJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIF91bm1hbmFnZU5vZGUobm9kZSkge1xuICAgICAgICAgIHZhciBpbmVydE5vZGUgPSB0aGlzLl9pbmVydE1hbmFnZXIuZGVyZWdpc3Rlcihub2RlLCB0aGlzKTtcbiAgICAgICAgICBpZiAoaW5lcnROb2RlKSB7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VkTm9kZXNbJ2RlbGV0ZSddKGluZXJ0Tm9kZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVucmVnaXN0ZXIgdGhlIGVudGlyZSBzdWJ0cmVlIHN0YXJ0aW5nIGF0IGBzdGFydE5vZGVgLlxuICAgICAgICAgKiBAcGFyYW0geyFOb2RlfSBzdGFydE5vZGVcbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnX3VubWFuYWdlU3VidHJlZScsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBfdW5tYW5hZ2VTdWJ0cmVlKHN0YXJ0Tm9kZSkge1xuICAgICAgICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgICAgICAgY29tcG9zZWRUcmVlV2FsayhzdGFydE5vZGUsIGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMzLl91bm1hbmFnZU5vZGUobm9kZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYSBkZXNjZW5kYW50IG5vZGUgaXMgZm91bmQgd2l0aCBhbiBgaW5lcnRgIGF0dHJpYnV0ZSwgYWRvcHQgaXRzIG1hbmFnZWQgbm9kZXMuXG4gICAgICAgICAqIEBwYXJhbSB7IUVsZW1lbnR9IG5vZGVcbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnX2Fkb3B0SW5lcnRSb290JyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIF9hZG9wdEluZXJ0Um9vdChub2RlKSB7XG4gICAgICAgICAgdmFyIGluZXJ0U3Vicm9vdCA9IHRoaXMuX2luZXJ0TWFuYWdlci5nZXRJbmVydFJvb3Qobm9kZSk7XG5cbiAgICAgICAgICAvLyBEdXJpbmcgaW5pdGlhbGlzYXRpb24gdGhpcyBpbmVydCByb290IG1heSBub3QgaGF2ZSBiZWVuIHJlZ2lzdGVyZWQgeWV0LFxuICAgICAgICAgIC8vIHNvIHJlZ2lzdGVyIGl0IG5vdyBpZiBuZWVkIGJlLlxuICAgICAgICAgIGlmICghaW5lcnRTdWJyb290KSB7XG4gICAgICAgICAgICB0aGlzLl9pbmVydE1hbmFnZXIuc2V0SW5lcnQobm9kZSwgdHJ1ZSk7XG4gICAgICAgICAgICBpbmVydFN1YnJvb3QgPSB0aGlzLl9pbmVydE1hbmFnZXIuZ2V0SW5lcnRSb290KG5vZGUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGluZXJ0U3Vicm9vdC5tYW5hZ2VkTm9kZXMuZm9yRWFjaChmdW5jdGlvbiAoc2F2ZWRJbmVydE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZU5vZGUoc2F2ZWRJbmVydE5vZGUubm9kZSk7XG4gICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FsbGJhY2sgdXNlZCB3aGVuIG11dGF0aW9uIG9ic2VydmVyIGRldGVjdHMgc3VidHJlZSBhZGRpdGlvbnMsIHJlbW92YWxzLCBvciBhdHRyaWJ1dGUgY2hhbmdlcy5cbiAgICAgICAgICogQHBhcmFtIHshQXJyYXk8IU11dGF0aW9uUmVjb3JkPn0gcmVjb3Jkc1xuICAgICAgICAgKiBAcGFyYW0geyFNdXRhdGlvbk9ic2VydmVyfSBzZWxmXG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ19vbk11dGF0aW9uJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIF9vbk11dGF0aW9uKHJlY29yZHMsIHNlbGYpIHtcbiAgICAgICAgICByZWNvcmRzLmZvckVhY2goZnVuY3Rpb24gKHJlY29yZCkge1xuICAgICAgICAgICAgdmFyIHRhcmdldCA9IC8qKiBAdHlwZSB7IUVsZW1lbnR9ICovcmVjb3JkLnRhcmdldDtcbiAgICAgICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gJ2NoaWxkTGlzdCcpIHtcbiAgICAgICAgICAgICAgLy8gTWFuYWdlIGFkZGVkIG5vZGVzXG4gICAgICAgICAgICAgIHNsaWNlLmNhbGwocmVjb3JkLmFkZGVkTm9kZXMpLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYWtlU3VidHJlZVVuZm9jdXNhYmxlKG5vZGUpO1xuICAgICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgICAvLyBVbi1tYW5hZ2UgcmVtb3ZlZCBub2Rlc1xuICAgICAgICAgICAgICBzbGljZS5jYWxsKHJlY29yZC5yZW1vdmVkTm9kZXMpLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bm1hbmFnZVN1YnRyZWUobm9kZSk7XG4gICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyZWNvcmQudHlwZSA9PT0gJ2F0dHJpYnV0ZXMnKSB7XG4gICAgICAgICAgICAgIGlmIChyZWNvcmQuYXR0cmlidXRlTmFtZSA9PT0gJ3RhYmluZGV4Jykge1xuICAgICAgICAgICAgICAgIC8vIFJlLWluaXRpYWxpc2UgaW5lcnQgbm9kZSBpZiB0YWJpbmRleCBjaGFuZ2VzXG4gICAgICAgICAgICAgICAgdGhpcy5fbWFuYWdlTm9kZSh0YXJnZXQpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRhcmdldCAhPT0gdGhpcy5fcm9vdEVsZW1lbnQgJiYgcmVjb3JkLmF0dHJpYnV0ZU5hbWUgPT09ICdpbmVydCcgJiYgdGFyZ2V0Lmhhc0F0dHJpYnV0ZSgnaW5lcnQnKSkge1xuICAgICAgICAgICAgICAgIC8vIElmIGEgbmV3IGluZXJ0IHJvb3QgaXMgYWRkZWQsIGFkb3B0IGl0cyBtYW5hZ2VkIG5vZGVzIGFuZCBtYWtlIHN1cmUgaXQga25vd3MgYWJvdXQgdGhlXG4gICAgICAgICAgICAgICAgLy8gYWxyZWFkeSBtYW5hZ2VkIG5vZGVzIGZyb20gdGhpcyBpbmVydCBzdWJyb290LlxuICAgICAgICAgICAgICAgIHRoaXMuX2Fkb3B0SW5lcnRSb290KHRhcmdldCk7XG4gICAgICAgICAgICAgICAgdmFyIGluZXJ0U3Vicm9vdCA9IHRoaXMuX2luZXJ0TWFuYWdlci5nZXRJbmVydFJvb3QodGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYW5hZ2VkTm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobWFuYWdlZE5vZGUpIHtcbiAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuY29udGFpbnMobWFuYWdlZE5vZGUubm9kZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5lcnRTdWJyb290Ll9tYW5hZ2VOb2RlKG1hbmFnZWROb2RlLm5vZGUpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnbWFuYWdlZE5vZGVzJyxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBTZXQodGhpcy5fbWFuYWdlZE5vZGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKiBAcmV0dXJuIHtib29sZWFufSAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ2hhc1NhdmVkQXJpYUhpZGRlbicsXG4gICAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlZEFyaWFIaWRkZW4gIT09IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvKiogQHBhcmFtIHs/c3RyaW5nfSBhcmlhSGlkZGVuICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnc2F2ZWRBcmlhSGlkZGVuJyxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQoYXJpYUhpZGRlbikge1xuICAgICAgICAgIHRoaXMuX3NhdmVkQXJpYUhpZGRlbiA9IGFyaWFIaWRkZW47XG4gICAgICAgIH1cblxuICAgICAgICAvKiogQHJldHVybiB7P3N0cmluZ30gKi9cbiAgICAgICAgLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fc2F2ZWRBcmlhSGlkZGVuO1xuICAgICAgICB9XG4gICAgICB9XSk7XG5cbiAgICAgIHJldHVybiBJbmVydFJvb3Q7XG4gICAgfSgpO1xuXG4gICAgLyoqXG4gICAgICogYEluZXJ0Tm9kZWAgaW5pdGlhbGlzZXMgYW5kIG1hbmFnZXMgYSBzaW5nbGUgaW5lcnQgbm9kZS5cbiAgICAgKiBBIG5vZGUgaXMgaW5lcnQgaWYgaXQgaXMgYSBkZXNjZW5kYW50IG9mIG9uZSBvciBtb3JlIGluZXJ0IHJvb3QgZWxlbWVudHMuXG4gICAgICpcbiAgICAgKiBPbiBjb25zdHJ1Y3Rpb24sIGBJbmVydE5vZGVgIHNhdmVzIHRoZSBleGlzdGluZyBgdGFiaW5kZXhgIHZhbHVlIGZvciB0aGUgbm9kZSwgaWYgYW55LCBhbmRcbiAgICAgKiBlaXRoZXIgcmVtb3ZlcyB0aGUgYHRhYmluZGV4YCBhdHRyaWJ1dGUgb3Igc2V0cyBpdCB0byBgLTFgLCBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgZWxlbWVudFxuICAgICAqIGlzIGludHJpbnNpY2FsbHkgZm9jdXNhYmxlIG9yIG5vdC5cbiAgICAgKlxuICAgICAqIGBJbmVydE5vZGVgIG1haW50YWlucyBhIHNldCBvZiBgSW5lcnRSb290YHMgd2hpY2ggYXJlIGRlc2NlbmRhbnRzIG9mIHRoaXMgYEluZXJ0Tm9kZWAuIFdoZW4gYW5cbiAgICAgKiBgSW5lcnRSb290YCBpcyBkZXN0cm95ZWQsIGFuZCBjYWxscyBgSW5lcnRNYW5hZ2VyLmRlcmVnaXN0ZXIoKWAsIHRoZSBgSW5lcnRNYW5hZ2VyYCBub3RpZmllcyB0aGVcbiAgICAgKiBgSW5lcnROb2RlYCB2aWEgYHJlbW92ZUluZXJ0Um9vdCgpYCwgd2hpY2ggaW4gdHVybiBkZXN0cm95cyB0aGUgYEluZXJ0Tm9kZWAgaWYgbm8gYEluZXJ0Um9vdGBzXG4gICAgICogcmVtYWluIGluIHRoZSBzZXQuIE9uIGRlc3RydWN0aW9uLCBgSW5lcnROb2RlYCByZWluc3RhdGVzIHRoZSBzdG9yZWQgYHRhYmluZGV4YCBpZiBvbmUgZXhpc3RzLFxuICAgICAqIG9yIHJlbW92ZXMgdGhlIGB0YWJpbmRleGAgYXR0cmlidXRlIGlmIHRoZSBlbGVtZW50IGlzIGludHJpbnNpY2FsbHkgZm9jdXNhYmxlLlxuICAgICAqL1xuXG5cbiAgICB2YXIgSW5lcnROb2RlID0gZnVuY3Rpb24gKCkge1xuICAgICAgLyoqXG4gICAgICAgKiBAcGFyYW0geyFOb2RlfSBub2RlIEEgZm9jdXNhYmxlIGVsZW1lbnQgdG8gYmUgbWFkZSBpbmVydC5cbiAgICAgICAqIEBwYXJhbSB7IUluZXJ0Um9vdH0gaW5lcnRSb290IFRoZSBpbmVydCByb290IGVsZW1lbnQgYXNzb2NpYXRlZCB3aXRoIHRoaXMgaW5lcnQgbm9kZS5cbiAgICAgICAqL1xuICAgICAgZnVuY3Rpb24gSW5lcnROb2RlKG5vZGUsIGluZXJ0Um9vdCkge1xuICAgICAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgSW5lcnROb2RlKTtcblxuICAgICAgICAvKiogQHR5cGUgeyFOb2RlfSAqL1xuICAgICAgICB0aGlzLl9ub2RlID0gbm9kZTtcblxuICAgICAgICAvKiogQHR5cGUge2Jvb2xlYW59ICovXG4gICAgICAgIHRoaXMuX292ZXJyb2RlRm9jdXNNZXRob2QgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUgeyFTZXQ8IUluZXJ0Um9vdD59IFRoZSBzZXQgb2YgZGVzY2VuZGFudCBpbmVydCByb290cy5cbiAgICAgICAgICogICAgSWYgYW5kIG9ubHkgaWYgdGhpcyBzZXQgYmVjb21lcyBlbXB0eSwgdGhpcyBub2RlIGlzIG5vIGxvbmdlciBpbmVydC5cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2luZXJ0Um9vdHMgPSBuZXcgU2V0KFtpbmVydFJvb3RdKTtcblxuICAgICAgICAvKiogQHR5cGUgez9udW1iZXJ9ICovXG4gICAgICAgIHRoaXMuX3NhdmVkVGFiSW5kZXggPSBudWxsO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICAgICAgdGhpcy5fZGVzdHJveWVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gU2F2ZSBhbnkgcHJpb3IgdGFiaW5kZXggaW5mbyBhbmQgbWFrZSB0aGlzIG5vZGUgdW50YWJiYWJsZVxuICAgICAgICB0aGlzLmVuc3VyZVVudGFiYmFibGUoKTtcbiAgICAgIH1cblxuICAgICAgLyoqXG4gICAgICAgKiBDYWxsIHRoaXMgd2hlbmV2ZXIgdGhpcyBvYmplY3QgaXMgYWJvdXQgdG8gYmVjb21lIG9ic29sZXRlLlxuICAgICAgICogVGhpcyBtYWtlcyB0aGUgbWFuYWdlZCBub2RlIGZvY3VzYWJsZSBhZ2FpbiBhbmQgZGVsZXRlcyBhbGwgb2YgdGhlIHByZXZpb3VzbHkgc3RvcmVkIHN0YXRlLlxuICAgICAgICovXG5cblxuICAgICAgX2NyZWF0ZUNsYXNzKEluZXJ0Tm9kZSwgW3tcbiAgICAgICAga2V5OiAnZGVzdHJ1Y3RvcicsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBkZXN0cnVjdG9yKCkge1xuICAgICAgICAgIHRoaXMuX3Rocm93SWZEZXN0cm95ZWQoKTtcblxuICAgICAgICAgIGlmICh0aGlzLl9ub2RlICYmIHRoaXMuX25vZGUubm9kZVR5cGUgPT09IE5vZGUuRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICB2YXIgZWxlbWVudCA9IC8qKiBAdHlwZSB7IUVsZW1lbnR9ICovdGhpcy5fbm9kZTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zYXZlZFRhYkluZGV4ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsIHRoaXMuX3NhdmVkVGFiSW5kZXgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ3RhYmluZGV4Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFVzZSBgZGVsZXRlYCB0byByZXN0b3JlIG5hdGl2ZSBmb2N1cyBtZXRob2QuXG4gICAgICAgICAgICBpZiAodGhpcy5fb3ZlcnJvZGVGb2N1c01ldGhvZCkge1xuICAgICAgICAgICAgICBkZWxldGUgZWxlbWVudC5mb2N1cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTZWUgbm90ZSBpbiBJbmVydFJvb3QuZGVzdHJ1Y3RvciBmb3Igd2h5IHdlIGNhc3QgdGhlc2UgbnVsbHMgdG8gQU5ZLlxuICAgICAgICAgIHRoaXMuX25vZGUgPSAvKiogQHR5cGUgez99ICovbnVsbDtcbiAgICAgICAgICB0aGlzLl9pbmVydFJvb3RzID0gLyoqIEB0eXBlIHs/fSAqL251bGw7XG4gICAgICAgICAgdGhpcy5fZGVzdHJveWVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn0gV2hldGhlciB0aGlzIG9iamVjdCBpcyBvYnNvbGV0ZSBiZWNhdXNlIHRoZSBtYW5hZ2VkIG5vZGUgaXMgbm8gbG9uZ2VyIGluZXJ0LlxuICAgICAgICAgKiBJZiB0aGUgb2JqZWN0IGhhcyBiZWVuIGRlc3Ryb3llZCwgYW55IGF0dGVtcHQgdG8gYWNjZXNzIGl0IHdpbGwgY2F1c2UgYW4gZXhjZXB0aW9uLlxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfdGhyb3dJZkRlc3Ryb3llZCcsXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhyb3cgaWYgdXNlciB0cmllcyB0byBhY2Nlc3MgZGVzdHJveWVkIEluZXJ0Tm9kZS5cbiAgICAgICAgICovXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBfdGhyb3dJZkRlc3Ryb3llZCgpIHtcbiAgICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBkZXN0cm95ZWQgSW5lcnROb2RlJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEByZXR1cm4ge2Jvb2xlYW59ICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnZW5zdXJlVW50YWJiYWJsZScsXG5cblxuICAgICAgICAvKiogU2F2ZSB0aGUgZXhpc3RpbmcgdGFiaW5kZXggdmFsdWUgYW5kIG1ha2UgdGhlIG5vZGUgdW50YWJiYWJsZSBhbmQgdW5mb2N1c2FibGUgKi9cbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGVuc3VyZVVudGFiYmFibGUoKSB7XG4gICAgICAgICAgaWYgKHRoaXMubm9kZS5ub2RlVHlwZSAhPT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSAvKiogQHR5cGUgeyFFbGVtZW50fSAqL3RoaXMubm9kZTtcbiAgICAgICAgICBpZiAobWF0Y2hlcy5jYWxsKGVsZW1lbnQsIF9mb2N1c2FibGVFbGVtZW50c1N0cmluZykpIHtcbiAgICAgICAgICAgIGlmICggLyoqIEB0eXBlIHshSFRNTEVsZW1lbnR9ICovZWxlbWVudC50YWJJbmRleCA9PT0gLTEgJiYgdGhpcy5oYXNTYXZlZFRhYkluZGV4KSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVsZW1lbnQuaGFzQXR0cmlidXRlKCd0YWJpbmRleCcpKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3NhdmVkVGFiSW5kZXggPSAvKiogQHR5cGUgeyFIVE1MRWxlbWVudH0gKi9lbGVtZW50LnRhYkluZGV4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJy0xJyk7XG4gICAgICAgICAgICBpZiAoZWxlbWVudC5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgZWxlbWVudC5mb2N1cyA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgICB0aGlzLl9vdmVycm9kZUZvY3VzTWV0aG9kID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQuaGFzQXR0cmlidXRlKCd0YWJpbmRleCcpKSB7XG4gICAgICAgICAgICB0aGlzLl9zYXZlZFRhYkluZGV4ID0gLyoqIEB0eXBlIHshSFRNTEVsZW1lbnR9ICovZWxlbWVudC50YWJJbmRleDtcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCd0YWJpbmRleCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgYW5vdGhlciBpbmVydCByb290IHRvIHRoaXMgaW5lcnQgbm9kZSdzIHNldCBvZiBtYW5hZ2luZyBpbmVydCByb290cy5cbiAgICAgICAgICogQHBhcmFtIHshSW5lcnRSb290fSBpbmVydFJvb3RcbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnYWRkSW5lcnRSb290JyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGFkZEluZXJ0Um9vdChpbmVydFJvb3QpIHtcbiAgICAgICAgICB0aGlzLl90aHJvd0lmRGVzdHJveWVkKCk7XG4gICAgICAgICAgdGhpcy5faW5lcnRSb290cy5hZGQoaW5lcnRSb290KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgdGhlIGdpdmVuIGluZXJ0IHJvb3QgZnJvbSB0aGlzIGluZXJ0IG5vZGUncyBzZXQgb2YgbWFuYWdpbmcgaW5lcnQgcm9vdHMuXG4gICAgICAgICAqIElmIHRoZSBzZXQgb2YgbWFuYWdpbmcgaW5lcnQgcm9vdHMgYmVjb21lcyBlbXB0eSwgdGhpcyBub2RlIGlzIG5vIGxvbmdlciBpbmVydCxcbiAgICAgICAgICogc28gdGhlIG9iamVjdCBzaG91bGQgYmUgZGVzdHJveWVkLlxuICAgICAgICAgKiBAcGFyYW0geyFJbmVydFJvb3R9IGluZXJ0Um9vdFxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdyZW1vdmVJbmVydFJvb3QnLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gcmVtb3ZlSW5lcnRSb290KGluZXJ0Um9vdCkge1xuICAgICAgICAgIHRoaXMuX3Rocm93SWZEZXN0cm95ZWQoKTtcbiAgICAgICAgICB0aGlzLl9pbmVydFJvb3RzWydkZWxldGUnXShpbmVydFJvb3QpO1xuICAgICAgICAgIGlmICh0aGlzLl9pbmVydFJvb3RzLnNpemUgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJ1Y3RvcigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdkZXN0cm95ZWQnLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gKC8qKiBAdHlwZSB7IUluZXJ0Tm9kZX0gKi90aGlzLl9kZXN0cm95ZWRcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ2hhc1NhdmVkVGFiSW5kZXgnLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fc2F2ZWRUYWJJbmRleCAhPT0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKiBAcmV0dXJuIHshTm9kZX0gKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdub2RlJyxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgICAgdGhpcy5fdGhyb3dJZkRlc3Ryb3llZCgpO1xuICAgICAgICAgIHJldHVybiB0aGlzLl9ub2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEBwYXJhbSB7P251bWJlcn0gdGFiSW5kZXggKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdzYXZlZFRhYkluZGV4JyxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQodGFiSW5kZXgpIHtcbiAgICAgICAgICB0aGlzLl90aHJvd0lmRGVzdHJveWVkKCk7XG4gICAgICAgICAgdGhpcy5fc2F2ZWRUYWJJbmRleCA9IHRhYkluZGV4O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEByZXR1cm4gez9udW1iZXJ9ICovXG4gICAgICAgICxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgICAgdGhpcy5fdGhyb3dJZkRlc3Ryb3llZCgpO1xuICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlZFRhYkluZGV4O1xuICAgICAgICB9XG4gICAgICB9XSk7XG5cbiAgICAgIHJldHVybiBJbmVydE5vZGU7XG4gICAgfSgpO1xuXG4gICAgLyoqXG4gICAgICogSW5lcnRNYW5hZ2VyIGlzIGEgcGVyLWRvY3VtZW50IHNpbmdsZXRvbiBvYmplY3Qgd2hpY2ggbWFuYWdlcyBhbGwgaW5lcnQgcm9vdHMgYW5kIG5vZGVzLlxuICAgICAqXG4gICAgICogV2hlbiBhbiBlbGVtZW50IGJlY29tZXMgYW4gaW5lcnQgcm9vdCBieSBoYXZpbmcgYW4gYGluZXJ0YCBhdHRyaWJ1dGUgc2V0IGFuZC9vciBpdHMgYGluZXJ0YFxuICAgICAqIHByb3BlcnR5IHNldCB0byBgdHJ1ZWAsIHRoZSBgc2V0SW5lcnRgIG1ldGhvZCBjcmVhdGVzIGFuIGBJbmVydFJvb3RgIG9iamVjdCBmb3IgdGhlIGVsZW1lbnQuXG4gICAgICogVGhlIGBJbmVydFJvb3RgIGluIHR1cm4gcmVnaXN0ZXJzIGl0c2VsZiBhcyBtYW5hZ2luZyBhbGwgb2YgdGhlIGVsZW1lbnQncyBmb2N1c2FibGUgZGVzY2VuZGFudFxuICAgICAqIG5vZGVzIHZpYSB0aGUgYHJlZ2lzdGVyKClgIG1ldGhvZC4gVGhlIGBJbmVydE1hbmFnZXJgIGVuc3VyZXMgdGhhdCBhIHNpbmdsZSBgSW5lcnROb2RlYCBpbnN0YW5jZVxuICAgICAqIGlzIGNyZWF0ZWQgZm9yIGVhY2ggc3VjaCBub2RlLCB2aWEgdGhlIGBfbWFuYWdlZE5vZGVzYCBtYXAuXG4gICAgICovXG5cblxuICAgIHZhciBJbmVydE1hbmFnZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAvKipcbiAgICAgICAqIEBwYXJhbSB7IURvY3VtZW50fSBkb2N1bWVudFxuICAgICAgICovXG4gICAgICBmdW5jdGlvbiBJbmVydE1hbmFnZXIoZG9jdW1lbnQpIHtcbiAgICAgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEluZXJ0TWFuYWdlcik7XG5cbiAgICAgICAgaWYgKCFkb2N1bWVudCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2luZyByZXF1aXJlZCBhcmd1bWVudDsgSW5lcnRNYW5hZ2VyIG5lZWRzIHRvIHdyYXAgYSBkb2N1bWVudC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKiBAdHlwZSB7IURvY3VtZW50fSAqL1xuICAgICAgICB0aGlzLl9kb2N1bWVudCA9IGRvY3VtZW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbGwgbWFuYWdlZCBub2RlcyBrbm93biB0byB0aGlzIEluZXJ0TWFuYWdlci4gSW4gYSBtYXAgdG8gYWxsb3cgbG9va2luZyB1cCBieSBOb2RlLlxuICAgICAgICAgKiBAdHlwZSB7IU1hcDwhTm9kZSwgIUluZXJ0Tm9kZT59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9tYW5hZ2VkTm9kZXMgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFsbCBpbmVydCByb290cyBrbm93biB0byB0aGlzIEluZXJ0TWFuYWdlci4gSW4gYSBtYXAgdG8gYWxsb3cgbG9va2luZyB1cCBieSBOb2RlLlxuICAgICAgICAgKiBAdHlwZSB7IU1hcDwhTm9kZSwgIUluZXJ0Um9vdD59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9pbmVydFJvb3RzID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBPYnNlcnZlciBmb3IgbXV0YXRpb25zIG9uIGBkb2N1bWVudC5ib2R5YC5cbiAgICAgICAgICogQHR5cGUgeyFNdXRhdGlvbk9ic2VydmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcih0aGlzLl93YXRjaEZvckluZXJ0LmJpbmQodGhpcykpO1xuXG4gICAgICAgIC8vIEFkZCBpbmVydCBzdHlsZS5cbiAgICAgICAgYWRkSW5lcnRTdHlsZShkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmJvZHkgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcblxuICAgICAgICAvLyBXYWl0IGZvciBkb2N1bWVudCB0byBiZSBsb2FkZWQuXG4gICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcbiAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgdGhpcy5fb25Eb2N1bWVudExvYWRlZC5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9vbkRvY3VtZW50TG9hZGVkKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgd2hldGhlciB0aGUgZ2l2ZW4gZWxlbWVudCBzaG91bGQgYmUgYW4gaW5lcnQgcm9vdCBvciBub3QuXG4gICAgICAgKiBAcGFyYW0geyFFbGVtZW50fSByb290XG4gICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGluZXJ0XG4gICAgICAgKi9cblxuXG4gICAgICBfY3JlYXRlQ2xhc3MoSW5lcnRNYW5hZ2VyLCBbe1xuICAgICAgICBrZXk6ICdzZXRJbmVydCcsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBzZXRJbmVydChyb290LCBpbmVydCkge1xuICAgICAgICAgIGlmIChpbmVydCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2luZXJ0Um9vdHMuaGFzKHJvb3QpKSB7XG4gICAgICAgICAgICAgIC8vIGVsZW1lbnQgaXMgYWxyZWFkeSBpbmVydFxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBpbmVydFJvb3QgPSBuZXcgSW5lcnRSb290KHJvb3QsIHRoaXMpO1xuICAgICAgICAgICAgcm9vdC5zZXRBdHRyaWJ1dGUoJ2luZXJ0JywgJycpO1xuICAgICAgICAgICAgdGhpcy5faW5lcnRSb290cy5zZXQocm9vdCwgaW5lcnRSb290KTtcbiAgICAgICAgICAgIC8vIElmIG5vdCBjb250YWluZWQgaW4gdGhlIGRvY3VtZW50LCBpdCBtdXN0IGJlIGluIGEgc2hhZG93Um9vdC5cbiAgICAgICAgICAgIC8vIEVuc3VyZSBpbmVydCBzdHlsZXMgYXJlIGFkZGVkIHRoZXJlLlxuICAgICAgICAgICAgaWYgKCF0aGlzLl9kb2N1bWVudC5ib2R5LmNvbnRhaW5zKHJvb3QpKSB7XG4gICAgICAgICAgICAgIHZhciBwYXJlbnQgPSByb290LnBhcmVudE5vZGU7XG4gICAgICAgICAgICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAocGFyZW50Lm5vZGVUeXBlID09PSAxMSkge1xuICAgICAgICAgICAgICAgICAgYWRkSW5lcnRTdHlsZShwYXJlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2luZXJ0Um9vdHMuaGFzKHJvb3QpKSB7XG4gICAgICAgICAgICAgIC8vIGVsZW1lbnQgaXMgYWxyZWFkeSBub24taW5lcnRcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgX2luZXJ0Um9vdCA9IHRoaXMuX2luZXJ0Um9vdHMuZ2V0KHJvb3QpO1xuICAgICAgICAgICAgX2luZXJ0Um9vdC5kZXN0cnVjdG9yKCk7XG4gICAgICAgICAgICB0aGlzLl9pbmVydFJvb3RzWydkZWxldGUnXShyb290KTtcbiAgICAgICAgICAgIHJvb3QucmVtb3ZlQXR0cmlidXRlKCdpbmVydCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXQgdGhlIEluZXJ0Um9vdCBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGUgZ2l2ZW4gaW5lcnQgcm9vdCBlbGVtZW50LCBpZiBhbnkuXG4gICAgICAgICAqIEBwYXJhbSB7IU5vZGV9IGVsZW1lbnRcbiAgICAgICAgICogQHJldHVybiB7IUluZXJ0Um9vdHx1bmRlZmluZWR9XG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ2dldEluZXJ0Um9vdCcsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRJbmVydFJvb3QoZWxlbWVudCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9pbmVydFJvb3RzLmdldChlbGVtZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlciB0aGUgZ2l2ZW4gSW5lcnRSb290IGFzIG1hbmFnaW5nIHRoZSBnaXZlbiBub2RlLlxuICAgICAgICAgKiBJbiB0aGUgY2FzZSB3aGVyZSB0aGUgbm9kZSBoYXMgYSBwcmV2aW91c2x5IGV4aXN0aW5nIGluZXJ0IHJvb3QsIHRoaXMgaW5lcnQgcm9vdCB3aWxsXG4gICAgICAgICAqIGJlIGFkZGVkIHRvIGl0cyBzZXQgb2YgaW5lcnQgcm9vdHMuXG4gICAgICAgICAqIEBwYXJhbSB7IU5vZGV9IG5vZGVcbiAgICAgICAgICogQHBhcmFtIHshSW5lcnRSb290fSBpbmVydFJvb3RcbiAgICAgICAgICogQHJldHVybiB7IUluZXJ0Tm9kZX0gaW5lcnROb2RlXG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ3JlZ2lzdGVyJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIHJlZ2lzdGVyKG5vZGUsIGluZXJ0Um9vdCkge1xuICAgICAgICAgIHZhciBpbmVydE5vZGUgPSB0aGlzLl9tYW5hZ2VkTm9kZXMuZ2V0KG5vZGUpO1xuICAgICAgICAgIGlmIChpbmVydE5vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gbm9kZSB3YXMgYWxyZWFkeSBpbiBhbiBpbmVydCBzdWJ0cmVlXG4gICAgICAgICAgICBpbmVydE5vZGUuYWRkSW5lcnRSb290KGluZXJ0Um9vdCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluZXJ0Tm9kZSA9IG5ldyBJbmVydE5vZGUobm9kZSwgaW5lcnRSb290KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLl9tYW5hZ2VkTm9kZXMuc2V0KG5vZGUsIGluZXJ0Tm9kZSk7XG5cbiAgICAgICAgICByZXR1cm4gaW5lcnROb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERlLXJlZ2lzdGVyIHRoZSBnaXZlbiBJbmVydFJvb3QgYXMgbWFuYWdpbmcgdGhlIGdpdmVuIGluZXJ0IG5vZGUuXG4gICAgICAgICAqIFJlbW92ZXMgdGhlIGluZXJ0IHJvb3QgZnJvbSB0aGUgSW5lcnROb2RlJ3Mgc2V0IG9mIG1hbmFnaW5nIGluZXJ0IHJvb3RzLCBhbmQgcmVtb3ZlIHRoZSBpbmVydFxuICAgICAgICAgKiBub2RlIGZyb20gdGhlIEluZXJ0TWFuYWdlcidzIHNldCBvZiBtYW5hZ2VkIG5vZGVzIGlmIGl0IGlzIGRlc3Ryb3llZC5cbiAgICAgICAgICogSWYgdGhlIG5vZGUgaXMgbm90IGN1cnJlbnRseSBtYW5hZ2VkLCB0aGlzIGlzIGVzc2VudGlhbGx5IGEgbm8tb3AuXG4gICAgICAgICAqIEBwYXJhbSB7IU5vZGV9IG5vZGVcbiAgICAgICAgICogQHBhcmFtIHshSW5lcnRSb290fSBpbmVydFJvb3RcbiAgICAgICAgICogQHJldHVybiB7P0luZXJ0Tm9kZX0gVGhlIHBvdGVudGlhbGx5IGRlc3Ryb3llZCBJbmVydE5vZGUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbm9kZSwgaWYgYW55LlxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdkZXJlZ2lzdGVyJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGRlcmVnaXN0ZXIobm9kZSwgaW5lcnRSb290KSB7XG4gICAgICAgICAgdmFyIGluZXJ0Tm9kZSA9IHRoaXMuX21hbmFnZWROb2Rlcy5nZXQobm9kZSk7XG4gICAgICAgICAgaWYgKCFpbmVydE5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGluZXJ0Tm9kZS5yZW1vdmVJbmVydFJvb3QoaW5lcnRSb290KTtcbiAgICAgICAgICBpZiAoaW5lcnROb2RlLmRlc3Ryb3llZCkge1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlZE5vZGVzWydkZWxldGUnXShub2RlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gaW5lcnROb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENhbGxiYWNrIHVzZWQgd2hlbiBkb2N1bWVudCBoYXMgZmluaXNoZWQgbG9hZGluZy5cbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnX29uRG9jdW1lbnRMb2FkZWQnLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gX29uRG9jdW1lbnRMb2FkZWQoKSB7XG4gICAgICAgICAgLy8gRmluZCBhbGwgaW5lcnQgcm9vdHMgaW4gZG9jdW1lbnQgYW5kIG1ha2UgdGhlbSBhY3R1YWxseSBpbmVydC5cbiAgICAgICAgICB2YXIgaW5lcnRFbGVtZW50cyA9IHNsaWNlLmNhbGwodGhpcy5fZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2luZXJ0XScpKTtcbiAgICAgICAgICBpbmVydEVsZW1lbnRzLmZvckVhY2goZnVuY3Rpb24gKGluZXJ0RWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5zZXRJbmVydChpbmVydEVsZW1lbnQsIHRydWUpO1xuICAgICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgICAgLy8gQ29tbWVudCB0aGlzIG91dCB0byB1c2UgcHJvZ3JhbW1hdGljIEFQSSBvbmx5LlxuICAgICAgICAgIHRoaXMuX29ic2VydmVyLm9ic2VydmUodGhpcy5fZG9jdW1lbnQuYm9keSB8fCB0aGlzLl9kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHsgYXR0cmlidXRlczogdHJ1ZSwgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OiB0cnVlIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENhbGxiYWNrIHVzZWQgd2hlbiBtdXRhdGlvbiBvYnNlcnZlciBkZXRlY3RzIGF0dHJpYnV0ZSBjaGFuZ2VzLlxuICAgICAgICAgKiBAcGFyYW0geyFBcnJheTwhTXV0YXRpb25SZWNvcmQ+fSByZWNvcmRzXG4gICAgICAgICAqIEBwYXJhbSB7IU11dGF0aW9uT2JzZXJ2ZXJ9IHNlbGZcbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnX3dhdGNoRm9ySW5lcnQnLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gX3dhdGNoRm9ySW5lcnQocmVjb3Jkcywgc2VsZikge1xuICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgcmVjb3Jkcy5mb3JFYWNoKGZ1bmN0aW9uIChyZWNvcmQpIHtcbiAgICAgICAgICAgIHN3aXRjaCAocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgICAgICAgY2FzZSAnY2hpbGRMaXN0JzpcbiAgICAgICAgICAgICAgICBzbGljZS5jYWxsKHJlY29yZC5hZGRlZE5vZGVzKS5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSAhPT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgdmFyIGluZXJ0RWxlbWVudHMgPSBzbGljZS5jYWxsKG5vZGUucXVlcnlTZWxlY3RvckFsbCgnW2luZXJ0XScpKTtcbiAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzLmNhbGwobm9kZSwgJ1tpbmVydF0nKSkge1xuICAgICAgICAgICAgICAgICAgICBpbmVydEVsZW1lbnRzLnVuc2hpZnQobm9kZSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpbmVydEVsZW1lbnRzLmZvckVhY2goZnVuY3Rpb24gKGluZXJ0RWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldEluZXJ0KGluZXJ0RWxlbWVudCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICB9LCBfdGhpcyk7XG4gICAgICAgICAgICAgICAgfSwgX3RoaXMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlICdhdHRyaWJ1dGVzJzpcbiAgICAgICAgICAgICAgICBpZiAocmVjb3JkLmF0dHJpYnV0ZU5hbWUgIT09ICdpbmVydCcpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IC8qKiBAdHlwZSB7IUVsZW1lbnR9ICovcmVjb3JkLnRhcmdldDtcbiAgICAgICAgICAgICAgICB2YXIgaW5lcnQgPSB0YXJnZXQuaGFzQXR0cmlidXRlKCdpbmVydCcpO1xuICAgICAgICAgICAgICAgIF90aGlzLnNldEluZXJ0KHRhcmdldCwgaW5lcnQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XSk7XG5cbiAgICAgIHJldHVybiBJbmVydE1hbmFnZXI7XG4gICAgfSgpO1xuXG4gICAgLyoqXG4gICAgICogUmVjdXJzaXZlbHkgd2FsayB0aGUgY29tcG9zZWQgdHJlZSBmcm9tIHxub2RlfC5cbiAgICAgKiBAcGFyYW0geyFOb2RlfSBub2RlXG4gICAgICogQHBhcmFtIHsoZnVuY3Rpb24gKCFFbGVtZW50KSk9fSBjYWxsYmFjayBDYWxsYmFjayB0byBiZSBjYWxsZWQgZm9yIGVhY2ggZWxlbWVudCB0cmF2ZXJzZWQsXG4gICAgICogICAgIGJlZm9yZSBkZXNjZW5kaW5nIGludG8gY2hpbGQgbm9kZXMuXG4gICAgICogQHBhcmFtIHs/U2hhZG93Um9vdD19IHNoYWRvd1Jvb3RBbmNlc3RvciBUaGUgbmVhcmVzdCBTaGFkb3dSb290IGFuY2VzdG9yLCBpZiBhbnkuXG4gICAgICovXG5cblxuICAgIGZ1bmN0aW9uIGNvbXBvc2VkVHJlZVdhbGsobm9kZSwgY2FsbGJhY2ssIHNoYWRvd1Jvb3RBbmNlc3Rvcikge1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSAvKiogQHR5cGUgeyFFbGVtZW50fSAqL25vZGU7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgIGNhbGxiYWNrKGVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGVzY2VuZCBpbnRvIG5vZGU6XG4gICAgICAgIC8vIElmIGl0IGhhcyBhIFNoYWRvd1Jvb3QsIGlnbm9yZSBhbGwgY2hpbGQgZWxlbWVudHMgLSB0aGVzZSB3aWxsIGJlIHBpY2tlZFxuICAgICAgICAvLyB1cCBieSB0aGUgPGNvbnRlbnQ+IG9yIDxzaGFkb3c+IGVsZW1lbnRzLiBEZXNjZW5kIHN0cmFpZ2h0IGludG8gdGhlXG4gICAgICAgIC8vIFNoYWRvd1Jvb3QuXG4gICAgICAgIHZhciBzaGFkb3dSb290ID0gLyoqIEB0eXBlIHshSFRNTEVsZW1lbnR9ICovZWxlbWVudC5zaGFkb3dSb290O1xuICAgICAgICBpZiAoc2hhZG93Um9vdCkge1xuICAgICAgICAgIGNvbXBvc2VkVHJlZVdhbGsoc2hhZG93Um9vdCwgY2FsbGJhY2ssIHNoYWRvd1Jvb3QpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGl0IGlzIGEgPGNvbnRlbnQ+IGVsZW1lbnQsIGRlc2NlbmQgaW50byBkaXN0cmlidXRlZCBlbGVtZW50cyAtIHRoZXNlXG4gICAgICAgIC8vIGFyZSBlbGVtZW50cyBmcm9tIG91dHNpZGUgdGhlIHNoYWRvdyByb290IHdoaWNoIGFyZSByZW5kZXJlZCBpbnNpZGUgdGhlXG4gICAgICAgIC8vIHNoYWRvdyBET00uXG4gICAgICAgIGlmIChlbGVtZW50LmxvY2FsTmFtZSA9PSAnY29udGVudCcpIHtcbiAgICAgICAgICB2YXIgY29udGVudCA9IC8qKiBAdHlwZSB7IUhUTUxDb250ZW50RWxlbWVudH0gKi9lbGVtZW50O1xuICAgICAgICAgIC8vIFZlcmlmaWVzIGlmIFNoYWRvd0RvbSB2MCBpcyBzdXBwb3J0ZWQuXG4gICAgICAgICAgdmFyIGRpc3RyaWJ1dGVkTm9kZXMgPSBjb250ZW50LmdldERpc3RyaWJ1dGVkTm9kZXMgPyBjb250ZW50LmdldERpc3RyaWJ1dGVkTm9kZXMoKSA6IFtdO1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGlzdHJpYnV0ZWROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29tcG9zZWRUcmVlV2FsayhkaXN0cmlidXRlZE5vZGVzW2ldLCBjYWxsYmFjaywgc2hhZG93Um9vdEFuY2VzdG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgaXQgaXMgYSA8c2xvdD4gZWxlbWVudCwgZGVzY2VuZCBpbnRvIGFzc2lnbmVkIG5vZGVzIC0gdGhlc2VcbiAgICAgICAgLy8gYXJlIGVsZW1lbnRzIGZyb20gb3V0c2lkZSB0aGUgc2hhZG93IHJvb3Qgd2hpY2ggYXJlIHJlbmRlcmVkIGluc2lkZSB0aGVcbiAgICAgICAgLy8gc2hhZG93IERPTS5cbiAgICAgICAgaWYgKGVsZW1lbnQubG9jYWxOYW1lID09ICdzbG90Jykge1xuICAgICAgICAgIHZhciBzbG90ID0gLyoqIEB0eXBlIHshSFRNTFNsb3RFbGVtZW50fSAqL2VsZW1lbnQ7XG4gICAgICAgICAgLy8gVmVyaWZ5IGlmIFNoYWRvd0RvbSB2MSBpcyBzdXBwb3J0ZWQuXG4gICAgICAgICAgdmFyIF9kaXN0cmlidXRlZE5vZGVzID0gc2xvdC5hc3NpZ25lZE5vZGVzID8gc2xvdC5hc3NpZ25lZE5vZGVzKHsgZmxhdHRlbjogdHJ1ZSB9KSA6IFtdO1xuICAgICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBfZGlzdHJpYnV0ZWROb2Rlcy5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgIGNvbXBvc2VkVHJlZVdhbGsoX2Rpc3RyaWJ1dGVkTm9kZXNbX2ldLCBjYWxsYmFjaywgc2hhZG93Um9vdEFuY2VzdG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIElmIGl0IGlzIG5laXRoZXIgdGhlIHBhcmVudCBvZiBhIFNoYWRvd1Jvb3QsIGEgPGNvbnRlbnQ+IGVsZW1lbnQsIGEgPHNsb3Q+XG4gICAgICAvLyBlbGVtZW50LCBub3IgYSA8c2hhZG93PiBlbGVtZW50IHJlY3Vyc2Ugbm9ybWFsbHkuXG4gICAgICB2YXIgY2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7XG4gICAgICB3aGlsZSAoY2hpbGQgIT0gbnVsbCkge1xuICAgICAgICBjb21wb3NlZFRyZWVXYWxrKGNoaWxkLCBjYWxsYmFjaywgc2hhZG93Um9vdEFuY2VzdG9yKTtcbiAgICAgICAgY2hpbGQgPSBjaGlsZC5uZXh0U2libGluZztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgc3R5bGUgZWxlbWVudCB0byB0aGUgbm9kZSBjb250YWluaW5nIHRoZSBpbmVydCBzcGVjaWZpYyBzdHlsZXNcbiAgICAgKiBAcGFyYW0geyFOb2RlfSBub2RlXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkSW5lcnRTdHlsZShub2RlKSB7XG4gICAgICBpZiAobm9kZS5xdWVyeVNlbGVjdG9yKCdzdHlsZSNpbmVydC1zdHlsZSwgbGluayNpbmVydC1zdHlsZScpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoJ2lkJywgJ2luZXJ0LXN0eWxlJyk7XG4gICAgICBzdHlsZS50ZXh0Q29udGVudCA9ICdcXG4nICsgJ1tpbmVydF0ge1xcbicgKyAnICBwb2ludGVyLWV2ZW50czogbm9uZTtcXG4nICsgJyAgY3Vyc29yOiBkZWZhdWx0O1xcbicgKyAnfVxcbicgKyAnXFxuJyArICdbaW5lcnRdLCBbaW5lcnRdICoge1xcbicgKyAnICAtd2Via2l0LXVzZXItc2VsZWN0OiBub25lO1xcbicgKyAnICAtbW96LXVzZXItc2VsZWN0OiBub25lO1xcbicgKyAnICAtbXMtdXNlci1zZWxlY3Q6IG5vbmU7XFxuJyArICcgIHVzZXItc2VsZWN0OiBub25lO1xcbicgKyAnfVxcbic7XG4gICAgICBub2RlLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICB9XG5cbiAgICBpZiAoIUVsZW1lbnQucHJvdG90eXBlLmhhc093blByb3BlcnR5KCdpbmVydCcpKSB7XG4gICAgICAvKiogQHR5cGUgeyFJbmVydE1hbmFnZXJ9ICovXG4gICAgICB2YXIgaW5lcnRNYW5hZ2VyID0gbmV3IEluZXJ0TWFuYWdlcihkb2N1bWVudCk7XG5cbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShFbGVtZW50LnByb3RvdHlwZSwgJ2luZXJ0Jywge1xuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAvKiogQHRoaXMgeyFFbGVtZW50fSAqL1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYXNBdHRyaWJ1dGUoJ2luZXJ0Jyk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKiBAdGhpcyB7IUVsZW1lbnR9ICovXG4gICAgICAgIHNldDogZnVuY3Rpb24gc2V0KGluZXJ0KSB7XG4gICAgICAgICAgaW5lcnRNYW5hZ2VyLnNldEluZXJ0KHRoaXMsIGluZXJ0KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9KSgpO1xuXG59KSkpO1xuIiwiaW1wb3J0ICdpbnRlcnNlY3Rpb24tb2JzZXJ2ZXInXG5pbXBvcnQgJ3dpY2ctaW5lcnQnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZpeGVkQmFyIHtcbiAgYmFyOiBIVE1MRWxlbWVudCB8IG51bGxcbiAgcmFuZ2VzOiBOb2RlTGlzdE9mPEhUTUxFbGVtZW50PiB8IG51bGxcbiAgb2JzZXJ2ZXI6IEludGVyc2VjdGlvbk9ic2VydmVyXG4gIGlzRXhwYW5kZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICByZXZlcnNlOiBib29sZWFuID0gZmFsc2VcbiAgcmV2aXZhbFRpbWVyOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcbiAgaXNDbG9zZWRFdGVybmFsbHk6IGJvb2xlYW4gPSBmYWxzZVxuICBmcmVlemVkOiBib29sZWFuID0gZmFsc2VcbiAgaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbj86IEludGVyc2VjdGlvbk9ic2VydmVySW5pdCA9IHt9XG5cbiAgY29uc3RydWN0b3IoYXJnczoge1xuICAgIGJhcjogc3RyaW5nXG4gICAgcmFuZ2U6IHN0cmluZ1xuICAgIGNsb3Nlcj86IHN0cmluZ1xuICAgIHJldmVyc2U/OiBib29sZWFuXG4gICAgaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbj86IEludGVyc2VjdGlvbk9ic2VydmVySW5pdFxuICB9KSB7XG4gICAgaWYgKHR5cGVvZiBhcmdzLmJhciAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihgYClcbiAgICB0aGlzLmJhciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJncy5iYXIpXG4gICAgaWYgKCF0aGlzLmJhcikgdGhyb3cgbmV3IEVycm9yKGBgKVxuICAgIHRoaXMuX3N3aXRjaFN0YXRlKHRoaXMuaXNFeHBhbmRlZClcblxuICAgIGlmICh0eXBlb2YgYXJncy5yYW5nZSAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihgYClcbiAgICB0aGlzLnJhbmdlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYXJncy5yYW5nZSlcbiAgICBpZiAoIXRoaXMucmFuZ2VzKSB0aHJvdyBuZXcgRXJyb3IoYGApXG4gICAgaWYgKHR5cGVvZiBhcmdzLnJldmVyc2UgIT09ICd1bmRlZmluZWQnKSB0aGlzLnJldmVyc2UgPSBhcmdzLnJldmVyc2VcbiAgICBpZiAodHlwZW9mIGFyZ3MuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbiA9IGFyZ3MuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvblxuICAgIH1cblxuICAgIHRoaXMub2JzZXJ2ZXIgPSBuZXcgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIoXG4gICAgICB0aGlzLl9vYnNlcnZlLmJpbmQodGhpcyksIHRoaXMuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbilcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucmFuZ2VzLmxlbmd0aDsgaSsrICkge1xuICAgICAgdGhpcy5vYnNlcnZlci5vYnNlcnZlKHRoaXMucmFuZ2VzW2ldKVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX29ic2VydmUoZW50cmllczogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJFbnRyeVtdKSB7XG4gICAgaWYgKHRoaXMucmV2aXZhbFRpbWVyIHx8IHRoaXMuaXNDbG9zZWRFdGVybmFsbHkgfHwgdGhpcy5mcmVlemVkKSByZXR1cm5cblxuICAgIGxldCBpc0ludGVyc2VjdGluZyA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW50cmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGVudHJpZXNbaV0uaXNJbnRlcnNlY3RpbmcpIHtcbiAgICAgICAgaXNJbnRlcnNlY3RpbmcgPSB0cnVlXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCghdGhpcy5yZXZlcnNlICYmIGlzSW50ZXJzZWN0aW5nKSB8fCAodGhpcy5yZXZlcnNlICYmICFpc0ludGVyc2VjdGluZykpIHtcbiAgICAgIHRoaXMub3BlbigpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH1cbiAgfVxuXG4gIG9wZW4oKSB7XG4gICAgdGhpcy5pc0V4cGFuZGVkID0gdHJ1ZVxuICAgIHRoaXMuX3N3aXRjaFN0YXRlKHRydWUpXG4gICAgdGhpcy5pc0Nsb3NlZEV0ZXJuYWxseSA9IGZhbHNlXG4gICAgaWYgKHRoaXMucmV2aXZhbFRpbWVyKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmV2aXZhbFRpbWVyKVxuICB9XG5cbiAgY2xvc2UodGltZT86IG51bWJlcikge1xuICAgIHRoaXMuaXNFeHBhbmRlZCA9IGZhbHNlXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUoZmFsc2UpXG4gICAgaWYgKHR5cGVvZiB0aW1lID09PSAnbnVtYmVyJyAmJiB0aW1lID09PSAwKSB7XG4gICAgICB0aGlzLmlzQ2xvc2VkRXRlcm5hbGx5ID0gdHJ1ZVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInICYmIHRpbWUgPiAwKSB7XG4gICAgICB0aGlzLnJldml2YWxUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnJldml2YWxUaW1lcilcbiAgICAgIH0sIHRpbWUpXG4gICAgfVxuICB9XG5cbiAgZnJlZXplKGlzRXhwYW5kZWQ6IGJvb2xlYW4gPSB0cnVlKSB7XG4gICAgaXNFeHBhbmRlZCA/IHRoaXMub3BlbigpIDogdGhpcy5jbG9zZSgpXG4gICAgdGhpcy5mcmVlemVkID0gdHJ1ZVxuICB9XG5cbiAgcmVzdGFydCgpIHtcbiAgICB0aGlzLmZyZWV6ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX3N3aXRjaFN0YXRlKGlzRXhwYW5kZWQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLmJhcj8uc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsIFN0cmluZyghaXNFeHBhbmRlZCkpXG4gICAgaWYgKGlzRXhwYW5kZWQpIHtcbiAgICAgIHRoaXMuYmFyPy5yZW1vdmVBdHRyaWJ1dGUoJ2hpZGRlbicpXG4gICAgICB0aGlzLmJhcj8ucmVtb3ZlQXR0cmlidXRlKCdpbmVydCcpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYmFyPy5zZXRBdHRyaWJ1dGUoJ2hpZGRlbicsICcnKVxuICAgICAgdGhpcy5iYXI/LnNldEF0dHJpYnV0ZSgnaW5lcnQnLCAnJylcbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJ3aW5kb3ciLCJJbnRlcnNlY3Rpb25PYnNlcnZlckVudHJ5IiwicHJvdG90eXBlIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXQiLCJpbnRlcnNlY3Rpb25SYXRpbyIsImdldEZyYW1lRWxlbWVudCIsImRvYyIsImRlZmF1bHRWaWV3IiwiZnJhbWVFbGVtZW50IiwiZSIsImRvY3VtZW50Iiwic3RhcnREb2MiLCJmcmFtZSIsIm93bmVyRG9jdW1lbnQiLCJyZWdpc3RyeSIsImNyb3NzT3JpZ2luVXBkYXRlciIsImNyb3NzT3JpZ2luUmVjdCIsImVudHJ5IiwidGltZSIsInRhcmdldCIsInJvb3RCb3VuZHMiLCJlbnN1cmVET01SZWN0IiwiYm91bmRpbmdDbGllbnRSZWN0IiwiaW50ZXJzZWN0aW9uUmVjdCIsImdldEVtcHR5UmVjdCIsImlzSW50ZXJzZWN0aW5nIiwidGFyZ2V0UmVjdCIsInRhcmdldEFyZWEiLCJ3aWR0aCIsImhlaWdodCIsImludGVyc2VjdGlvbkFyZWEiLCJOdW1iZXIiLCJ0b0ZpeGVkIiwiSW50ZXJzZWN0aW9uT2JzZXJ2ZXIiLCJjYWxsYmFjayIsIm9wdF9vcHRpb25zIiwib3B0aW9ucyIsIkVycm9yIiwicm9vdCIsIm5vZGVUeXBlIiwiX2NoZWNrRm9ySW50ZXJzZWN0aW9ucyIsInRocm90dGxlIiwiYmluZCIsIlRIUk9UVExFX1RJTUVPVVQiLCJfY2FsbGJhY2siLCJfb2JzZXJ2YXRpb25UYXJnZXRzIiwiX3F1ZXVlZEVudHJpZXMiLCJfcm9vdE1hcmdpblZhbHVlcyIsIl9wYXJzZVJvb3RNYXJnaW4iLCJyb290TWFyZ2luIiwidGhyZXNob2xkcyIsIl9pbml0VGhyZXNob2xkcyIsInRocmVzaG9sZCIsIm1hcCIsIm1hcmdpbiIsInZhbHVlIiwidW5pdCIsImpvaW4iLCJfbW9uaXRvcmluZ0RvY3VtZW50cyIsIl9tb25pdG9yaW5nVW5zdWJzY3JpYmVzIiwiUE9MTF9JTlRFUlZBTCIsIlVTRV9NVVRBVElPTl9PQlNFUlZFUiIsIl9zZXR1cENyb3NzT3JpZ2luVXBkYXRlciIsImNvbnZlcnRGcm9tUGFyZW50UmVjdCIsImZvckVhY2giLCJvYnNlcnZlciIsIl9yZXNldENyb3NzT3JpZ2luVXBkYXRlciIsIm9ic2VydmUiLCJpc1RhcmdldEFscmVhZHlPYnNlcnZlZCIsInNvbWUiLCJpdGVtIiwiZWxlbWVudCIsIl9yZWdpc3Rlckluc3RhbmNlIiwicHVzaCIsIl9tb25pdG9ySW50ZXJzZWN0aW9ucyIsInVub2JzZXJ2ZSIsImZpbHRlciIsIl91bm1vbml0b3JJbnRlcnNlY3Rpb25zIiwibGVuZ3RoIiwiX3VucmVnaXN0ZXJJbnN0YW5jZSIsImRpc2Nvbm5lY3QiLCJfdW5tb25pdG9yQWxsSW50ZXJzZWN0aW9ucyIsInRha2VSZWNvcmRzIiwicmVjb3JkcyIsInNsaWNlIiwib3B0X3RocmVzaG9sZCIsIkFycmF5IiwiaXNBcnJheSIsInNvcnQiLCJ0IiwiaSIsImEiLCJpc05hTiIsIm9wdF9yb290TWFyZ2luIiwibWFyZ2luU3RyaW5nIiwibWFyZ2lucyIsInNwbGl0IiwicGFydHMiLCJleGVjIiwicGFyc2VGbG9hdCIsIndpbiIsImluZGV4T2YiLCJtb25pdG9yaW5nSW50ZXJ2YWwiLCJkb21PYnNlcnZlciIsInNldEludGVydmFsIiwiYWRkRXZlbnQiLCJNdXRhdGlvbk9ic2VydmVyIiwiYXR0cmlidXRlcyIsImNoaWxkTGlzdCIsImNoYXJhY3RlckRhdGEiLCJzdWJ0cmVlIiwiY2xlYXJJbnRlcnZhbCIsInJlbW92ZUV2ZW50Iiwicm9vdERvYyIsImluZGV4IiwiaGFzRGVwZW5kZW50VGFyZ2V0cyIsIml0ZW1Eb2MiLCJ1bnN1YnNjcmliZSIsInNwbGljZSIsInVuc3Vic2NyaWJlcyIsInJvb3RJc0luRG9tIiwiX3Jvb3RJc0luRG9tIiwicm9vdFJlY3QiLCJfZ2V0Um9vdFJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJyb290Q29udGFpbnNUYXJnZXQiLCJfcm9vdENvbnRhaW5zVGFyZ2V0Iiwib2xkRW50cnkiLCJfY29tcHV0ZVRhcmdldEFuZFJvb3RJbnRlcnNlY3Rpb24iLCJuZXdFbnRyeSIsIm5vdyIsIl9oYXNDcm9zc2VkVGhyZXNob2xkIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsImRpc3BsYXkiLCJwYXJlbnQiLCJnZXRQYXJlbnROb2RlIiwiYXRSb290IiwicGFyZW50UmVjdCIsInBhcmVudENvbXB1dGVkU3R5bGUiLCJmcmFtZVJlY3QiLCJmcmFtZUludGVyc2VjdCIsImJvZHkiLCJkb2N1bWVudEVsZW1lbnQiLCJvdmVyZmxvdyIsImNvbXB1dGVSZWN0SW50ZXJzZWN0aW9uIiwiaXNEb2MiLCJodG1sIiwidG9wIiwibGVmdCIsInJpZ2h0IiwiY2xpZW50V2lkdGgiLCJib3R0b20iLCJjbGllbnRIZWlnaHQiLCJfZXhwYW5kUmVjdEJ5Um9vdE1hcmdpbiIsInJlY3QiLCJuZXdSZWN0Iiwib2xkUmF0aW8iLCJuZXdSYXRpbyIsImNvbnRhaW5zRGVlcCIsInBlcmZvcm1hbmNlIiwiZm4iLCJ0aW1lb3V0IiwidGltZXIiLCJzZXRUaW1lb3V0Iiwibm9kZSIsImV2ZW50Iiwib3B0X3VzZUNhcHR1cmUiLCJhZGRFdmVudExpc3RlbmVyIiwiYXR0YWNoRXZlbnQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZGV0YXRjaEV2ZW50IiwicmVjdDEiLCJyZWN0MiIsIk1hdGgiLCJtYXgiLCJtaW4iLCJlbCIsImVyciIsInkiLCJ4IiwicGFyZW50Qm91bmRpbmdSZWN0IiwicGFyZW50SW50ZXJzZWN0aW9uUmVjdCIsImNoaWxkIiwicGFyZW50Tm9kZSIsImFzc2lnbmVkU2xvdCIsImhvc3QiLCJnbG9iYWwiLCJmYWN0b3J5IiwidGhpcyIsIl9jcmVhdGVDbGFzcyIsImRlZmluZVByb3BlcnRpZXMiLCJwcm9wcyIsImRlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwiY29uZmlndXJhYmxlIiwid3JpdGFibGUiLCJrZXkiLCJDb25zdHJ1Y3RvciIsInByb3RvUHJvcHMiLCJzdGF0aWNQcm9wcyIsIl9jbGFzc0NhbGxDaGVjayIsImluc3RhbmNlIiwiVHlwZUVycm9yIiwibWF0Y2hlcyIsIkVsZW1lbnQiLCJtc01hdGNoZXNTZWxlY3RvciIsIl9mb2N1c2FibGVFbGVtZW50c1N0cmluZyIsIkluZXJ0Um9vdCIsInJvb3RFbGVtZW50IiwiaW5lcnRNYW5hZ2VyIiwiX2luZXJ0TWFuYWdlciIsIl9yb290RWxlbWVudCIsIl9tYW5hZ2VkTm9kZXMiLCJTZXQiLCJoYXNBdHRyaWJ1dGUiLCJfc2F2ZWRBcmlhSGlkZGVuIiwiZ2V0QXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwiX21ha2VTdWJ0cmVlVW5mb2N1c2FibGUiLCJfb2JzZXJ2ZXIiLCJfb25NdXRhdGlvbiIsImRlc3RydWN0b3IiLCJyZW1vdmVBdHRyaWJ1dGUiLCJpbmVydE5vZGUiLCJfdW5tYW5hZ2VOb2RlIiwic3RhcnROb2RlIiwiX3RoaXMyIiwiY29tcG9zZWRUcmVlV2FsayIsIl92aXNpdE5vZGUiLCJhY3RpdmVFbGVtZW50IiwiY29udGFpbnMiLCJ1bmRlZmluZWQiLCJOb2RlIiwiRE9DVU1FTlRfRlJBR01FTlRfTk9ERSIsImJsdXIiLCJmb2N1cyIsIkVMRU1FTlRfTk9ERSIsIl9hZG9wdEluZXJ0Um9vdCIsImNhbGwiLCJfbWFuYWdlTm9kZSIsInJlZ2lzdGVyIiwiYWRkIiwiZGVyZWdpc3RlciIsIl91bm1hbmFnZVN1YnRyZWUiLCJfdGhpczMiLCJpbmVydFN1YnJvb3QiLCJnZXRJbmVydFJvb3QiLCJzZXRJbmVydCIsIm1hbmFnZWROb2RlcyIsInNhdmVkSW5lcnROb2RlIiwic2VsZiIsInJlY29yZCIsInR5cGUiLCJhZGRlZE5vZGVzIiwicmVtb3ZlZE5vZGVzIiwiYXR0cmlidXRlTmFtZSIsIm1hbmFnZWROb2RlIiwic2V0IiwiYXJpYUhpZGRlbiIsIkluZXJ0Tm9kZSIsImluZXJ0Um9vdCIsIl9ub2RlIiwiX292ZXJyb2RlRm9jdXNNZXRob2QiLCJfaW5lcnRSb290cyIsIl9zYXZlZFRhYkluZGV4IiwiX2Rlc3Ryb3llZCIsImVuc3VyZVVudGFiYmFibGUiLCJfdGhyb3dJZkRlc3Ryb3llZCIsImRlc3Ryb3llZCIsInRhYkluZGV4IiwiaGFzU2F2ZWRUYWJJbmRleCIsImFkZEluZXJ0Um9vdCIsInJlbW92ZUluZXJ0Um9vdCIsInNpemUiLCJJbmVydE1hbmFnZXIiLCJfZG9jdW1lbnQiLCJNYXAiLCJfd2F0Y2hGb3JJbmVydCIsImFkZEluZXJ0U3R5bGUiLCJoZWFkIiwicmVhZHlTdGF0ZSIsIl9vbkRvY3VtZW50TG9hZGVkIiwiaW5lcnQiLCJoYXMiLCJfaW5lcnRSb290IiwiaW5lcnRFbGVtZW50cyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpbmVydEVsZW1lbnQiLCJfdGhpcyIsInVuc2hpZnQiLCJzaGFkb3dSb290QW5jZXN0b3IiLCJzaGFkb3dSb290IiwibG9jYWxOYW1lIiwiY29udGVudCIsImRpc3RyaWJ1dGVkTm9kZXMiLCJnZXREaXN0cmlidXRlZE5vZGVzIiwic2xvdCIsIl9kaXN0cmlidXRlZE5vZGVzIiwiYXNzaWduZWROb2RlcyIsImZsYXR0ZW4iLCJfaSIsImZpcnN0Q2hpbGQiLCJuZXh0U2libGluZyIsInF1ZXJ5U2VsZWN0b3IiLCJzdHlsZSIsImNyZWF0ZUVsZW1lbnQiLCJ0ZXh0Q29udGVudCIsImFwcGVuZENoaWxkIiwiaGFzT3duUHJvcGVydHkiLCJGaXhlZEJhciIsImNvbnN0cnVjdG9yIiwiYXJncyIsImJhciIsIl9zd2l0Y2hTdGF0ZSIsImlzRXhwYW5kZWQiLCJyYW5nZSIsInJhbmdlcyIsInJldmVyc2UiLCJpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uIiwiX29ic2VydmUiLCJlbnRyaWVzIiwicmV2aXZhbFRpbWVyIiwiaXNDbG9zZWRFdGVybmFsbHkiLCJmcmVlemVkIiwib3BlbiIsImNsb3NlIiwiY2xlYXJUaW1lb3V0IiwiZnJlZXplIiwicmVzdGFydCIsIlN0cmluZyJdLCJtYXBwaW5ncyI6Ijs7O0VBQUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNDLGFBQVc7O0VBSVosTUFBSSxPQUFPQSxNQUFQLEtBQWtCLFFBQXRCLEVBQWdDO0VBQzlCO0VBQ0QsR0FO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
