var FixedBar = (function () {
	'use strict';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZWQtYmFyLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvd2ljZy1pbmVydC9kaXN0L2luZXJ0LmpzIiwiLi4vc3JjL3RzL2ZpeGVkLWJhci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuICB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBmYWN0b3J5KCkgOlxuICB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoJ2luZXJ0JywgZmFjdG9yeSkgOlxuICAoZmFjdG9yeSgpKTtcbn0odGhpcywgKGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciBfY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KCk7XG5cbiAgZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuICAvKipcbiAgICogVGhpcyB3b3JrIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBXM0MgU29mdHdhcmUgYW5kIERvY3VtZW50IExpY2Vuc2VcbiAgICogKGh0dHA6Ly93d3cudzMub3JnL0NvbnNvcnRpdW0vTGVnYWwvMjAxNS9jb3B5cmlnaHQtc29mdHdhcmUtYW5kLWRvY3VtZW50KS5cbiAgICovXG5cbiAgKGZ1bmN0aW9uICgpIHtcbiAgICAvLyBSZXR1cm4gZWFybHkgaWYgd2UncmUgbm90IHJ1bm5pbmcgaW5zaWRlIG9mIHRoZSBicm93c2VyLlxuICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENvbnZlbmllbmNlIGZ1bmN0aW9uIGZvciBjb252ZXJ0aW5nIE5vZGVMaXN0cy5cbiAgICAvKiogQHR5cGUge3R5cGVvZiBBcnJheS5wcm90b3R5cGUuc2xpY2V9ICovXG4gICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4gICAgLyoqXG4gICAgICogSUUgaGFzIGEgbm9uLXN0YW5kYXJkIG5hbWUgZm9yIFwibWF0Y2hlc1wiLlxuICAgICAqIEB0eXBlIHt0eXBlb2YgRWxlbWVudC5wcm90b3R5cGUubWF0Y2hlc31cbiAgICAgKi9cbiAgICB2YXIgbWF0Y2hlcyA9IEVsZW1lbnQucHJvdG90eXBlLm1hdGNoZXMgfHwgRWxlbWVudC5wcm90b3R5cGUubXNNYXRjaGVzU2VsZWN0b3I7XG5cbiAgICAvKiogQHR5cGUge3N0cmluZ30gKi9cbiAgICB2YXIgX2ZvY3VzYWJsZUVsZW1lbnRzU3RyaW5nID0gWydhW2hyZWZdJywgJ2FyZWFbaHJlZl0nLCAnaW5wdXQ6bm90KFtkaXNhYmxlZF0pJywgJ3NlbGVjdDpub3QoW2Rpc2FibGVkXSknLCAndGV4dGFyZWE6bm90KFtkaXNhYmxlZF0pJywgJ2J1dHRvbjpub3QoW2Rpc2FibGVkXSknLCAnZGV0YWlscycsICdzdW1tYXJ5JywgJ2lmcmFtZScsICdvYmplY3QnLCAnZW1iZWQnLCAnW2NvbnRlbnRlZGl0YWJsZV0nXS5qb2luKCcsJyk7XG5cbiAgICAvKipcbiAgICAgKiBgSW5lcnRSb290YCBtYW5hZ2VzIGEgc2luZ2xlIGluZXJ0IHN1YnRyZWUsIGkuZS4gYSBET00gc3VidHJlZSB3aG9zZSByb290IGVsZW1lbnQgaGFzIGFuIGBpbmVydGBcbiAgICAgKiBhdHRyaWJ1dGUuXG4gICAgICpcbiAgICAgKiBJdHMgbWFpbiBmdW5jdGlvbnMgYXJlOlxuICAgICAqXG4gICAgICogLSB0byBjcmVhdGUgYW5kIG1haW50YWluIGEgc2V0IG9mIG1hbmFnZWQgYEluZXJ0Tm9kZWBzLCBpbmNsdWRpbmcgd2hlbiBtdXRhdGlvbnMgb2NjdXIgaW4gdGhlXG4gICAgICogICBzdWJ0cmVlLiBUaGUgYG1ha2VTdWJ0cmVlVW5mb2N1c2FibGUoKWAgbWV0aG9kIGhhbmRsZXMgY29sbGVjdGluZyBgSW5lcnROb2RlYHMgdmlhIHJlZ2lzdGVyaW5nXG4gICAgICogICBlYWNoIGZvY3VzYWJsZSBub2RlIGluIHRoZSBzdWJ0cmVlIHdpdGggdGhlIHNpbmdsZXRvbiBgSW5lcnRNYW5hZ2VyYCB3aGljaCBtYW5hZ2VzIGFsbCBrbm93blxuICAgICAqICAgZm9jdXNhYmxlIG5vZGVzIHdpdGhpbiBpbmVydCBzdWJ0cmVlcy4gYEluZXJ0TWFuYWdlcmAgZW5zdXJlcyB0aGF0IGEgc2luZ2xlIGBJbmVydE5vZGVgXG4gICAgICogICBpbnN0YW5jZSBleGlzdHMgZm9yIGVhY2ggZm9jdXNhYmxlIG5vZGUgd2hpY2ggaGFzIGF0IGxlYXN0IG9uZSBpbmVydCByb290IGFzIGFuIGFuY2VzdG9yLlxuICAgICAqXG4gICAgICogLSB0byBub3RpZnkgYWxsIG1hbmFnZWQgYEluZXJ0Tm9kZWBzIHdoZW4gdGhpcyBzdWJ0cmVlIHN0b3BzIGJlaW5nIGluZXJ0IChpLmUuIHdoZW4gdGhlIGBpbmVydGBcbiAgICAgKiAgIGF0dHJpYnV0ZSBpcyByZW1vdmVkIGZyb20gdGhlIHJvb3Qgbm9kZSkuIFRoaXMgaXMgaGFuZGxlZCBpbiB0aGUgZGVzdHJ1Y3Rvciwgd2hpY2ggY2FsbHMgdGhlXG4gICAgICogICBgZGVyZWdpc3RlcmAgbWV0aG9kIG9uIGBJbmVydE1hbmFnZXJgIGZvciBlYWNoIG1hbmFnZWQgaW5lcnQgbm9kZS5cbiAgICAgKi9cblxuICAgIHZhciBJbmVydFJvb3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAvKipcbiAgICAgICAqIEBwYXJhbSB7IUVsZW1lbnR9IHJvb3RFbGVtZW50IFRoZSBFbGVtZW50IGF0IHRoZSByb290IG9mIHRoZSBpbmVydCBzdWJ0cmVlLlxuICAgICAgICogQHBhcmFtIHshSW5lcnRNYW5hZ2VyfSBpbmVydE1hbmFnZXIgVGhlIGdsb2JhbCBzaW5nbGV0b24gSW5lcnRNYW5hZ2VyIG9iamVjdC5cbiAgICAgICAqL1xuICAgICAgZnVuY3Rpb24gSW5lcnRSb290KHJvb3RFbGVtZW50LCBpbmVydE1hbmFnZXIpIHtcbiAgICAgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEluZXJ0Um9vdCk7XG5cbiAgICAgICAgLyoqIEB0eXBlIHshSW5lcnRNYW5hZ2VyfSAqL1xuICAgICAgICB0aGlzLl9pbmVydE1hbmFnZXIgPSBpbmVydE1hbmFnZXI7XG5cbiAgICAgICAgLyoqIEB0eXBlIHshRWxlbWVudH0gKi9cbiAgICAgICAgdGhpcy5fcm9vdEVsZW1lbnQgPSByb290RWxlbWVudDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUgeyFTZXQ8IUluZXJ0Tm9kZT59XG4gICAgICAgICAqIEFsbCBtYW5hZ2VkIGZvY3VzYWJsZSBub2RlcyBpbiB0aGlzIEluZXJ0Um9vdCdzIHN1YnRyZWUuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9tYW5hZ2VkTm9kZXMgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLy8gTWFrZSB0aGUgc3VidHJlZSBoaWRkZW4gZnJvbSBhc3Npc3RpdmUgdGVjaG5vbG9neVxuICAgICAgICBpZiAodGhpcy5fcm9vdEVsZW1lbnQuaGFzQXR0cmlidXRlKCdhcmlhLWhpZGRlbicpKSB7XG4gICAgICAgICAgLyoqIEB0eXBlIHs/c3RyaW5nfSAqL1xuICAgICAgICAgIHRoaXMuX3NhdmVkQXJpYUhpZGRlbiA9IHRoaXMuX3Jvb3RFbGVtZW50LmdldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9zYXZlZEFyaWFIaWRkZW4gPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3Jvb3RFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xuXG4gICAgICAgIC8vIE1ha2UgYWxsIGZvY3VzYWJsZSBlbGVtZW50cyBpbiB0aGUgc3VidHJlZSB1bmZvY3VzYWJsZSBhbmQgYWRkIHRoZW0gdG8gX21hbmFnZWROb2Rlc1xuICAgICAgICB0aGlzLl9tYWtlU3VidHJlZVVuZm9jdXNhYmxlKHRoaXMuX3Jvb3RFbGVtZW50KTtcblxuICAgICAgICAvLyBXYXRjaCBmb3I6XG4gICAgICAgIC8vIC0gYW55IGFkZGl0aW9ucyBpbiB0aGUgc3VidHJlZTogbWFrZSB0aGVtIHVuZm9jdXNhYmxlIHRvb1xuICAgICAgICAvLyAtIGFueSByZW1vdmFscyBmcm9tIHRoZSBzdWJ0cmVlOiByZW1vdmUgdGhlbSBmcm9tIHRoaXMgaW5lcnQgcm9vdCdzIG1hbmFnZWQgbm9kZXNcbiAgICAgICAgLy8gLSBhdHRyaWJ1dGUgY2hhbmdlczogaWYgYHRhYmluZGV4YCBpcyBhZGRlZCwgb3IgcmVtb3ZlZCBmcm9tIGFuIGludHJpbnNpY2FsbHkgZm9jdXNhYmxlXG4gICAgICAgIC8vICAgZWxlbWVudCwgbWFrZSB0aGF0IG5vZGUgYSBtYW5hZ2VkIG5vZGUuXG4gICAgICAgIHRoaXMuX29ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIodGhpcy5fb25NdXRhdGlvbi5iaW5kKHRoaXMpKTtcbiAgICAgICAgdGhpcy5fb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLl9yb290RWxlbWVudCwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XG4gICAgICB9XG5cbiAgICAgIC8qKlxuICAgICAgICogQ2FsbCB0aGlzIHdoZW5ldmVyIHRoaXMgb2JqZWN0IGlzIGFib3V0IHRvIGJlY29tZSBvYnNvbGV0ZS4gIFRoaXMgdW53aW5kcyBhbGwgb2YgdGhlIHN0YXRlXG4gICAgICAgKiBzdG9yZWQgaW4gdGhpcyBvYmplY3QgYW5kIHVwZGF0ZXMgdGhlIHN0YXRlIG9mIGFsbCBvZiB0aGUgbWFuYWdlZCBub2Rlcy5cbiAgICAgICAqL1xuXG5cbiAgICAgIF9jcmVhdGVDbGFzcyhJbmVydFJvb3QsIFt7XG4gICAgICAgIGtleTogJ2Rlc3RydWN0b3InLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gZGVzdHJ1Y3RvcigpIHtcbiAgICAgICAgICB0aGlzLl9vYnNlcnZlci5kaXNjb25uZWN0KCk7XG5cbiAgICAgICAgICBpZiAodGhpcy5fcm9vdEVsZW1lbnQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zYXZlZEFyaWFIaWRkZW4gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhpcy5fcm9vdEVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsIHRoaXMuX3NhdmVkQXJpYUhpZGRlbik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9yb290RWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5fbWFuYWdlZE5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGluZXJ0Tm9kZSkge1xuICAgICAgICAgICAgdGhpcy5fdW5tYW5hZ2VOb2RlKGluZXJ0Tm9kZS5ub2RlKTtcbiAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgIC8vIE5vdGUgd2UgY2FzdCB0aGUgbnVsbHMgdG8gdGhlIEFOWSB0eXBlIGhlcmUgYmVjYXVzZTpcbiAgICAgICAgICAvLyAxKSBXZSB3YW50IHRoZSBjbGFzcyBwcm9wZXJ0aWVzIHRvIGJlIGRlY2xhcmVkIGFzIG5vbi1udWxsLCBvciBlbHNlIHdlXG4gICAgICAgICAgLy8gICAgbmVlZCBldmVuIG1vcmUgY2FzdHMgdGhyb3VnaG91dCB0aGlzIGNvZGUuIEFsbCBiZXRzIGFyZSBvZmYgaWYgYW5cbiAgICAgICAgICAvLyAgICBpbnN0YW5jZSBoYXMgYmVlbiBkZXN0cm95ZWQgYW5kIGEgbWV0aG9kIGlzIGNhbGxlZC5cbiAgICAgICAgICAvLyAyKSBXZSBkb24ndCB3YW50IHRvIGNhc3QgXCJ0aGlzXCIsIGJlY2F1c2Ugd2Ugd2FudCB0eXBlLWF3YXJlIG9wdGltaXphdGlvbnNcbiAgICAgICAgICAvLyAgICB0byBrbm93IHdoaWNoIHByb3BlcnRpZXMgd2UncmUgc2V0dGluZy5cbiAgICAgICAgICB0aGlzLl9vYnNlcnZlciA9IC8qKiBAdHlwZSB7P30gKi9udWxsO1xuICAgICAgICAgIHRoaXMuX3Jvb3RFbGVtZW50ID0gLyoqIEB0eXBlIHs/fSAqL251bGw7XG4gICAgICAgICAgdGhpcy5fbWFuYWdlZE5vZGVzID0gLyoqIEB0eXBlIHs/fSAqL251bGw7XG4gICAgICAgICAgdGhpcy5faW5lcnRNYW5hZ2VyID0gLyoqIEB0eXBlIHs/fSAqL251bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7IVNldDwhSW5lcnROb2RlPn0gQSBjb3B5IG9mIHRoaXMgSW5lcnRSb290J3MgbWFuYWdlZCBub2RlcyBzZXQuXG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ19tYWtlU3VidHJlZVVuZm9jdXNhYmxlJyxcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0geyFOb2RlfSBzdGFydE5vZGVcbiAgICAgICAgICovXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBfbWFrZVN1YnRyZWVVbmZvY3VzYWJsZShzdGFydE5vZGUpIHtcbiAgICAgICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgICAgIGNvbXBvc2VkVHJlZVdhbGsoc3RhcnROb2RlLCBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzMi5fdmlzaXROb2RlKG5vZGUpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgdmFyIGFjdGl2ZUVsZW1lbnQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXG4gICAgICAgICAgaWYgKCFkb2N1bWVudC5ib2R5LmNvbnRhaW5zKHN0YXJ0Tm9kZSkpIHtcbiAgICAgICAgICAgIC8vIHN0YXJ0Tm9kZSBtYXkgYmUgaW4gc2hhZG93IERPTSwgc28gZmluZCBpdHMgbmVhcmVzdCBzaGFkb3dSb290IHRvIGdldCB0aGUgYWN0aXZlRWxlbWVudC5cbiAgICAgICAgICAgIHZhciBub2RlID0gc3RhcnROb2RlO1xuICAgICAgICAgICAgLyoqIEB0eXBlIHshU2hhZG93Um9vdHx1bmRlZmluZWR9ICovXG4gICAgICAgICAgICB2YXIgcm9vdCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBOb2RlLkRPQ1VNRU5UX0ZSQUdNRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgICByb290ID0gLyoqIEB0eXBlIHshU2hhZG93Um9vdH0gKi9ub2RlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocm9vdCkge1xuICAgICAgICAgICAgICBhY3RpdmVFbGVtZW50ID0gcm9vdC5hY3RpdmVFbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3RhcnROb2RlLmNvbnRhaW5zKGFjdGl2ZUVsZW1lbnQpKSB7XG4gICAgICAgICAgICBhY3RpdmVFbGVtZW50LmJsdXIoKTtcbiAgICAgICAgICAgIC8vIEluIElFMTEsIGlmIGFuIGVsZW1lbnQgaXMgYWxyZWFkeSBmb2N1c2VkLCBhbmQgdGhlbiBzZXQgdG8gdGFiaW5kZXg9LTFcbiAgICAgICAgICAgIC8vIGNhbGxpbmcgYmx1cigpIHdpbGwgbm90IGFjdHVhbGx5IG1vdmUgdGhlIGZvY3VzLlxuICAgICAgICAgICAgLy8gVG8gd29yayBhcm91bmQgdGhpcyB3ZSBjYWxsIGZvY3VzKCkgb24gdGhlIGJvZHkgaW5zdGVhZC5cbiAgICAgICAgICAgIGlmIChhY3RpdmVFbGVtZW50ID09PSBkb2N1bWVudC5hY3RpdmVFbGVtZW50KSB7XG4gICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuZm9jdXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHshTm9kZX0gbm9kZVxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfdmlzaXROb2RlJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIF92aXNpdE5vZGUobm9kZSkge1xuICAgICAgICAgIGlmIChub2RlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgZWxlbWVudCA9IC8qKiBAdHlwZSB7IUVsZW1lbnR9ICovbm9kZTtcblxuICAgICAgICAgIC8vIElmIGEgZGVzY2VuZGFudCBpbmVydCByb290IGJlY29tZXMgdW4taW5lcnQsIGl0cyBkZXNjZW5kYW50cyB3aWxsIHN0aWxsIGJlIGluZXJ0IGJlY2F1c2Ugb2ZcbiAgICAgICAgICAvLyB0aGlzIGluZXJ0IHJvb3QsIHNvIGFsbCBvZiBpdHMgbWFuYWdlZCBub2RlcyBuZWVkIHRvIGJlIGFkb3B0ZWQgYnkgdGhpcyBJbmVydFJvb3QuXG4gICAgICAgICAgaWYgKGVsZW1lbnQgIT09IHRoaXMuX3Jvb3RFbGVtZW50ICYmIGVsZW1lbnQuaGFzQXR0cmlidXRlKCdpbmVydCcpKSB7XG4gICAgICAgICAgICB0aGlzLl9hZG9wdEluZXJ0Um9vdChlbGVtZW50KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobWF0Y2hlcy5jYWxsKGVsZW1lbnQsIF9mb2N1c2FibGVFbGVtZW50c1N0cmluZykgfHwgZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ3RhYmluZGV4JykpIHtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZU5vZGUoZWxlbWVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlZ2lzdGVyIHRoZSBnaXZlbiBub2RlIHdpdGggdGhpcyBJbmVydFJvb3QgYW5kIHdpdGggSW5lcnRNYW5hZ2VyLlxuICAgICAgICAgKiBAcGFyYW0geyFOb2RlfSBub2RlXG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ19tYW5hZ2VOb2RlJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIF9tYW5hZ2VOb2RlKG5vZGUpIHtcbiAgICAgICAgICB2YXIgaW5lcnROb2RlID0gdGhpcy5faW5lcnRNYW5hZ2VyLnJlZ2lzdGVyKG5vZGUsIHRoaXMpO1xuICAgICAgICAgIHRoaXMuX21hbmFnZWROb2Rlcy5hZGQoaW5lcnROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVbnJlZ2lzdGVyIHRoZSBnaXZlbiBub2RlIHdpdGggdGhpcyBJbmVydFJvb3QgYW5kIHdpdGggSW5lcnRNYW5hZ2VyLlxuICAgICAgICAgKiBAcGFyYW0geyFOb2RlfSBub2RlXG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ191bm1hbmFnZU5vZGUnLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gX3VubWFuYWdlTm9kZShub2RlKSB7XG4gICAgICAgICAgdmFyIGluZXJ0Tm9kZSA9IHRoaXMuX2luZXJ0TWFuYWdlci5kZXJlZ2lzdGVyKG5vZGUsIHRoaXMpO1xuICAgICAgICAgIGlmIChpbmVydE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZWROb2Rlc1snZGVsZXRlJ10oaW5lcnROb2RlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVW5yZWdpc3RlciB0aGUgZW50aXJlIHN1YnRyZWUgc3RhcnRpbmcgYXQgYHN0YXJ0Tm9kZWAuXG4gICAgICAgICAqIEBwYXJhbSB7IU5vZGV9IHN0YXJ0Tm9kZVxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfdW5tYW5hZ2VTdWJ0cmVlJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIF91bm1hbmFnZVN1YnRyZWUoc3RhcnROb2RlKSB7XG4gICAgICAgICAgdmFyIF90aGlzMyA9IHRoaXM7XG5cbiAgICAgICAgICBjb21wb3NlZFRyZWVXYWxrKHN0YXJ0Tm9kZSwgZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpczMuX3VubWFuYWdlTm9kZShub2RlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBhIGRlc2NlbmRhbnQgbm9kZSBpcyBmb3VuZCB3aXRoIGFuIGBpbmVydGAgYXR0cmlidXRlLCBhZG9wdCBpdHMgbWFuYWdlZCBub2Rlcy5cbiAgICAgICAgICogQHBhcmFtIHshRWxlbWVudH0gbm9kZVxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfYWRvcHRJbmVydFJvb3QnLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gX2Fkb3B0SW5lcnRSb290KG5vZGUpIHtcbiAgICAgICAgICB2YXIgaW5lcnRTdWJyb290ID0gdGhpcy5faW5lcnRNYW5hZ2VyLmdldEluZXJ0Um9vdChub2RlKTtcblxuICAgICAgICAgIC8vIER1cmluZyBpbml0aWFsaXNhdGlvbiB0aGlzIGluZXJ0IHJvb3QgbWF5IG5vdCBoYXZlIGJlZW4gcmVnaXN0ZXJlZCB5ZXQsXG4gICAgICAgICAgLy8gc28gcmVnaXN0ZXIgaXQgbm93IGlmIG5lZWQgYmUuXG4gICAgICAgICAgaWYgKCFpbmVydFN1YnJvb3QpIHtcbiAgICAgICAgICAgIHRoaXMuX2luZXJ0TWFuYWdlci5zZXRJbmVydChub2RlLCB0cnVlKTtcbiAgICAgICAgICAgIGluZXJ0U3Vicm9vdCA9IHRoaXMuX2luZXJ0TWFuYWdlci5nZXRJbmVydFJvb3Qobm9kZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaW5lcnRTdWJyb290Lm1hbmFnZWROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChzYXZlZEluZXJ0Tm9kZSkge1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlTm9kZShzYXZlZEluZXJ0Tm9kZS5ub2RlKTtcbiAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsYmFjayB1c2VkIHdoZW4gbXV0YXRpb24gb2JzZXJ2ZXIgZGV0ZWN0cyBzdWJ0cmVlIGFkZGl0aW9ucywgcmVtb3ZhbHMsIG9yIGF0dHJpYnV0ZSBjaGFuZ2VzLlxuICAgICAgICAgKiBAcGFyYW0geyFBcnJheTwhTXV0YXRpb25SZWNvcmQ+fSByZWNvcmRzXG4gICAgICAgICAqIEBwYXJhbSB7IU11dGF0aW9uT2JzZXJ2ZXJ9IHNlbGZcbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnX29uTXV0YXRpb24nLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gX29uTXV0YXRpb24ocmVjb3Jkcywgc2VsZikge1xuICAgICAgICAgIHJlY29yZHMuZm9yRWFjaChmdW5jdGlvbiAocmVjb3JkKSB7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gLyoqIEB0eXBlIHshRWxlbWVudH0gKi9yZWNvcmQudGFyZ2V0O1xuICAgICAgICAgICAgaWYgKHJlY29yZC50eXBlID09PSAnY2hpbGRMaXN0Jykge1xuICAgICAgICAgICAgICAvLyBNYW5hZ2UgYWRkZWQgbm9kZXNcbiAgICAgICAgICAgICAgc2xpY2UuY2FsbChyZWNvcmQuYWRkZWROb2RlcykuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21ha2VTdWJ0cmVlVW5mb2N1c2FibGUobm9kZSk7XG4gICAgICAgICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgICAgICAgIC8vIFVuLW1hbmFnZSByZW1vdmVkIG5vZGVzXG4gICAgICAgICAgICAgIHNsaWNlLmNhbGwocmVjb3JkLnJlbW92ZWROb2RlcykuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VubWFuYWdlU3VidHJlZShub2RlKTtcbiAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlY29yZC50eXBlID09PSAnYXR0cmlidXRlcycpIHtcbiAgICAgICAgICAgICAgaWYgKHJlY29yZC5hdHRyaWJ1dGVOYW1lID09PSAndGFiaW5kZXgnKSB7XG4gICAgICAgICAgICAgICAgLy8gUmUtaW5pdGlhbGlzZSBpbmVydCBub2RlIGlmIHRhYmluZGV4IGNoYW5nZXNcbiAgICAgICAgICAgICAgICB0aGlzLl9tYW5hZ2VOb2RlKHRhcmdldCk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAodGFyZ2V0ICE9PSB0aGlzLl9yb290RWxlbWVudCAmJiByZWNvcmQuYXR0cmlidXRlTmFtZSA9PT0gJ2luZXJ0JyAmJiB0YXJnZXQuaGFzQXR0cmlidXRlKCdpbmVydCcpKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgYSBuZXcgaW5lcnQgcm9vdCBpcyBhZGRlZCwgYWRvcHQgaXRzIG1hbmFnZWQgbm9kZXMgYW5kIG1ha2Ugc3VyZSBpdCBrbm93cyBhYm91dCB0aGVcbiAgICAgICAgICAgICAgICAvLyBhbHJlYWR5IG1hbmFnZWQgbm9kZXMgZnJvbSB0aGlzIGluZXJ0IHN1YnJvb3QuXG4gICAgICAgICAgICAgICAgdGhpcy5fYWRvcHRJbmVydFJvb3QodGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB2YXIgaW5lcnRTdWJyb290ID0gdGhpcy5faW5lcnRNYW5hZ2VyLmdldEluZXJ0Um9vdCh0YXJnZXQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX21hbmFnZWROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChtYW5hZ2VkTm9kZSkge1xuICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldC5jb250YWlucyhtYW5hZ2VkTm9kZS5ub2RlKSkge1xuICAgICAgICAgICAgICAgICAgICBpbmVydFN1YnJvb3QuX21hbmFnZU5vZGUobWFuYWdlZE5vZGUubm9kZSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdtYW5hZ2VkTm9kZXMnLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFNldCh0aGlzLl9tYW5hZ2VkTm9kZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEByZXR1cm4ge2Jvb2xlYW59ICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnaGFzU2F2ZWRBcmlhSGlkZGVuJyxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmVkQXJpYUhpZGRlbiAhPT0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKiBAcGFyYW0gez9zdHJpbmd9IGFyaWFIaWRkZW4gKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdzYXZlZEFyaWFIaWRkZW4nLFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIHNldChhcmlhSGlkZGVuKSB7XG4gICAgICAgICAgdGhpcy5fc2F2ZWRBcmlhSGlkZGVuID0gYXJpYUhpZGRlbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKiBAcmV0dXJuIHs/c3RyaW5nfSAqL1xuICAgICAgICAsXG4gICAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlZEFyaWFIaWRkZW47XG4gICAgICAgIH1cbiAgICAgIH1dKTtcblxuICAgICAgcmV0dXJuIEluZXJ0Um9vdDtcbiAgICB9KCk7XG5cbiAgICAvKipcbiAgICAgKiBgSW5lcnROb2RlYCBpbml0aWFsaXNlcyBhbmQgbWFuYWdlcyBhIHNpbmdsZSBpbmVydCBub2RlLlxuICAgICAqIEEgbm9kZSBpcyBpbmVydCBpZiBpdCBpcyBhIGRlc2NlbmRhbnQgb2Ygb25lIG9yIG1vcmUgaW5lcnQgcm9vdCBlbGVtZW50cy5cbiAgICAgKlxuICAgICAqIE9uIGNvbnN0cnVjdGlvbiwgYEluZXJ0Tm9kZWAgc2F2ZXMgdGhlIGV4aXN0aW5nIGB0YWJpbmRleGAgdmFsdWUgZm9yIHRoZSBub2RlLCBpZiBhbnksIGFuZFxuICAgICAqIGVpdGhlciByZW1vdmVzIHRoZSBgdGFiaW5kZXhgIGF0dHJpYnV0ZSBvciBzZXRzIGl0IHRvIGAtMWAsIGRlcGVuZGluZyBvbiB3aGV0aGVyIHRoZSBlbGVtZW50XG4gICAgICogaXMgaW50cmluc2ljYWxseSBmb2N1c2FibGUgb3Igbm90LlxuICAgICAqXG4gICAgICogYEluZXJ0Tm9kZWAgbWFpbnRhaW5zIGEgc2V0IG9mIGBJbmVydFJvb3RgcyB3aGljaCBhcmUgZGVzY2VuZGFudHMgb2YgdGhpcyBgSW5lcnROb2RlYC4gV2hlbiBhblxuICAgICAqIGBJbmVydFJvb3RgIGlzIGRlc3Ryb3llZCwgYW5kIGNhbGxzIGBJbmVydE1hbmFnZXIuZGVyZWdpc3RlcigpYCwgdGhlIGBJbmVydE1hbmFnZXJgIG5vdGlmaWVzIHRoZVxuICAgICAqIGBJbmVydE5vZGVgIHZpYSBgcmVtb3ZlSW5lcnRSb290KClgLCB3aGljaCBpbiB0dXJuIGRlc3Ryb3lzIHRoZSBgSW5lcnROb2RlYCBpZiBubyBgSW5lcnRSb290YHNcbiAgICAgKiByZW1haW4gaW4gdGhlIHNldC4gT24gZGVzdHJ1Y3Rpb24sIGBJbmVydE5vZGVgIHJlaW5zdGF0ZXMgdGhlIHN0b3JlZCBgdGFiaW5kZXhgIGlmIG9uZSBleGlzdHMsXG4gICAgICogb3IgcmVtb3ZlcyB0aGUgYHRhYmluZGV4YCBhdHRyaWJ1dGUgaWYgdGhlIGVsZW1lbnQgaXMgaW50cmluc2ljYWxseSBmb2N1c2FibGUuXG4gICAgICovXG5cblxuICAgIHZhciBJbmVydE5vZGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAvKipcbiAgICAgICAqIEBwYXJhbSB7IU5vZGV9IG5vZGUgQSBmb2N1c2FibGUgZWxlbWVudCB0byBiZSBtYWRlIGluZXJ0LlxuICAgICAgICogQHBhcmFtIHshSW5lcnRSb290fSBpbmVydFJvb3QgVGhlIGluZXJ0IHJvb3QgZWxlbWVudCBhc3NvY2lhdGVkIHdpdGggdGhpcyBpbmVydCBub2RlLlxuICAgICAgICovXG4gICAgICBmdW5jdGlvbiBJbmVydE5vZGUobm9kZSwgaW5lcnRSb290KSB7XG4gICAgICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBJbmVydE5vZGUpO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7IU5vZGV9ICovXG4gICAgICAgIHRoaXMuX25vZGUgPSBub2RlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICAgICAgdGhpcy5fb3ZlcnJvZGVGb2N1c01ldGhvZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7IVNldDwhSW5lcnRSb290Pn0gVGhlIHNldCBvZiBkZXNjZW5kYW50IGluZXJ0IHJvb3RzLlxuICAgICAgICAgKiAgICBJZiBhbmQgb25seSBpZiB0aGlzIHNldCBiZWNvbWVzIGVtcHR5LCB0aGlzIG5vZGUgaXMgbm8gbG9uZ2VyIGluZXJ0LlxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faW5lcnRSb290cyA9IG5ldyBTZXQoW2luZXJ0Um9vdF0pO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7P251bWJlcn0gKi9cbiAgICAgICAgdGhpcy5fc2F2ZWRUYWJJbmRleCA9IG51bGw7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtib29sZWFufSAqL1xuICAgICAgICB0aGlzLl9kZXN0cm95ZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyBTYXZlIGFueSBwcmlvciB0YWJpbmRleCBpbmZvIGFuZCBtYWtlIHRoaXMgbm9kZSB1bnRhYmJhYmxlXG4gICAgICAgIHRoaXMuZW5zdXJlVW50YWJiYWJsZSgpO1xuICAgICAgfVxuXG4gICAgICAvKipcbiAgICAgICAqIENhbGwgdGhpcyB3aGVuZXZlciB0aGlzIG9iamVjdCBpcyBhYm91dCB0byBiZWNvbWUgb2Jzb2xldGUuXG4gICAgICAgKiBUaGlzIG1ha2VzIHRoZSBtYW5hZ2VkIG5vZGUgZm9jdXNhYmxlIGFnYWluIGFuZCBkZWxldGVzIGFsbCBvZiB0aGUgcHJldmlvdXNseSBzdG9yZWQgc3RhdGUuXG4gICAgICAgKi9cblxuXG4gICAgICBfY3JlYXRlQ2xhc3MoSW5lcnROb2RlLCBbe1xuICAgICAgICBrZXk6ICdkZXN0cnVjdG9yJyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGRlc3RydWN0b3IoKSB7XG4gICAgICAgICAgdGhpcy5fdGhyb3dJZkRlc3Ryb3llZCgpO1xuXG4gICAgICAgICAgaWYgKHRoaXMuX25vZGUgJiYgdGhpcy5fbm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIHZhciBlbGVtZW50ID0gLyoqIEB0eXBlIHshRWxlbWVudH0gKi90aGlzLl9ub2RlO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NhdmVkVGFiSW5kZXggIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgdGhpcy5fc2F2ZWRUYWJJbmRleCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgndGFiaW5kZXgnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVXNlIGBkZWxldGVgIHRvIHJlc3RvcmUgbmF0aXZlIGZvY3VzIG1ldGhvZC5cbiAgICAgICAgICAgIGlmICh0aGlzLl9vdmVycm9kZUZvY3VzTWV0aG9kKSB7XG4gICAgICAgICAgICAgIGRlbGV0ZSBlbGVtZW50LmZvY3VzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFNlZSBub3RlIGluIEluZXJ0Um9vdC5kZXN0cnVjdG9yIGZvciB3aHkgd2UgY2FzdCB0aGVzZSBudWxscyB0byBBTlkuXG4gICAgICAgICAgdGhpcy5fbm9kZSA9IC8qKiBAdHlwZSB7P30gKi9udWxsO1xuICAgICAgICAgIHRoaXMuX2luZXJ0Um9vdHMgPSAvKiogQHR5cGUgez99ICovbnVsbDtcbiAgICAgICAgICB0aGlzLl9kZXN0cm95ZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufSBXaGV0aGVyIHRoaXMgb2JqZWN0IGlzIG9ic29sZXRlIGJlY2F1c2UgdGhlIG1hbmFnZWQgbm9kZSBpcyBubyBsb25nZXIgaW5lcnQuXG4gICAgICAgICAqIElmIHRoZSBvYmplY3QgaGFzIGJlZW4gZGVzdHJveWVkLCBhbnkgYXR0ZW1wdCB0byBhY2Nlc3MgaXQgd2lsbCBjYXVzZSBhbiBleGNlcHRpb24uXG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ190aHJvd0lmRGVzdHJveWVkJyxcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaHJvdyBpZiB1c2VyIHRyaWVzIHRvIGFjY2VzcyBkZXN0cm95ZWQgSW5lcnROb2RlLlxuICAgICAgICAgKi9cbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIF90aHJvd0lmRGVzdHJveWVkKCkge1xuICAgICAgICAgIGlmICh0aGlzLmRlc3Ryb3llZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGRlc3Ryb3llZCBJbmVydE5vZGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKiogQHJldHVybiB7Ym9vbGVhbn0gKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdlbnN1cmVVbnRhYmJhYmxlJyxcblxuXG4gICAgICAgIC8qKiBTYXZlIHRoZSBleGlzdGluZyB0YWJpbmRleCB2YWx1ZSBhbmQgbWFrZSB0aGUgbm9kZSB1bnRhYmJhYmxlIGFuZCB1bmZvY3VzYWJsZSAqL1xuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gZW5zdXJlVW50YWJiYWJsZSgpIHtcbiAgICAgICAgICBpZiAodGhpcy5ub2RlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgZWxlbWVudCA9IC8qKiBAdHlwZSB7IUVsZW1lbnR9ICovdGhpcy5ub2RlO1xuICAgICAgICAgIGlmIChtYXRjaGVzLmNhbGwoZWxlbWVudCwgX2ZvY3VzYWJsZUVsZW1lbnRzU3RyaW5nKSkge1xuICAgICAgICAgICAgaWYgKCAvKiogQHR5cGUgeyFIVE1MRWxlbWVudH0gKi9lbGVtZW50LnRhYkluZGV4ID09PSAtMSAmJiB0aGlzLmhhc1NhdmVkVGFiSW5kZXgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ3RhYmluZGV4JykpIHtcbiAgICAgICAgICAgICAgdGhpcy5fc2F2ZWRUYWJJbmRleCA9IC8qKiBAdHlwZSB7IUhUTUxFbGVtZW50fSAqL2VsZW1lbnQudGFiSW5kZXg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnLTEnKTtcbiAgICAgICAgICAgIGlmIChlbGVtZW50Lm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgICBlbGVtZW50LmZvY3VzID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgIHRoaXMuX292ZXJyb2RlRm9jdXNNZXRob2QgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ3RhYmluZGV4JykpIHtcbiAgICAgICAgICAgIHRoaXMuX3NhdmVkVGFiSW5kZXggPSAvKiogQHR5cGUgeyFIVE1MRWxlbWVudH0gKi9lbGVtZW50LnRhYkluZGV4O1xuICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ3RhYmluZGV4Jyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZCBhbm90aGVyIGluZXJ0IHJvb3QgdG8gdGhpcyBpbmVydCBub2RlJ3Mgc2V0IG9mIG1hbmFnaW5nIGluZXJ0IHJvb3RzLlxuICAgICAgICAgKiBAcGFyYW0geyFJbmVydFJvb3R9IGluZXJ0Um9vdFxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdhZGRJbmVydFJvb3QnLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gYWRkSW5lcnRSb290KGluZXJ0Um9vdCkge1xuICAgICAgICAgIHRoaXMuX3Rocm93SWZEZXN0cm95ZWQoKTtcbiAgICAgICAgICB0aGlzLl9pbmVydFJvb3RzLmFkZChpbmVydFJvb3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSB0aGUgZ2l2ZW4gaW5lcnQgcm9vdCBmcm9tIHRoaXMgaW5lcnQgbm9kZSdzIHNldCBvZiBtYW5hZ2luZyBpbmVydCByb290cy5cbiAgICAgICAgICogSWYgdGhlIHNldCBvZiBtYW5hZ2luZyBpbmVydCByb290cyBiZWNvbWVzIGVtcHR5LCB0aGlzIG5vZGUgaXMgbm8gbG9uZ2VyIGluZXJ0LFxuICAgICAgICAgKiBzbyB0aGUgb2JqZWN0IHNob3VsZCBiZSBkZXN0cm95ZWQuXG4gICAgICAgICAqIEBwYXJhbSB7IUluZXJ0Um9vdH0gaW5lcnRSb290XG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ3JlbW92ZUluZXJ0Um9vdCcsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiByZW1vdmVJbmVydFJvb3QoaW5lcnRSb290KSB7XG4gICAgICAgICAgdGhpcy5fdGhyb3dJZkRlc3Ryb3llZCgpO1xuICAgICAgICAgIHRoaXMuX2luZXJ0Um9vdHNbJ2RlbGV0ZSddKGluZXJ0Um9vdCk7XG4gICAgICAgICAgaWYgKHRoaXMuX2luZXJ0Um9vdHMuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5kZXN0cnVjdG9yKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ2Rlc3Ryb3llZCcsXG4gICAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICAgIHJldHVybiAoLyoqIEB0eXBlIHshSW5lcnROb2RlfSAqL3RoaXMuX2Rlc3Ryb3llZFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnaGFzU2F2ZWRUYWJJbmRleCcsXG4gICAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlZFRhYkluZGV4ICE9PSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEByZXR1cm4geyFOb2RlfSAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ25vZGUnLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICB0aGlzLl90aHJvd0lmRGVzdHJveWVkKCk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX25vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvKiogQHBhcmFtIHs/bnVtYmVyfSB0YWJJbmRleCAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ3NhdmVkVGFiSW5kZXgnLFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIHNldCh0YWJJbmRleCkge1xuICAgICAgICAgIHRoaXMuX3Rocm93SWZEZXN0cm95ZWQoKTtcbiAgICAgICAgICB0aGlzLl9zYXZlZFRhYkluZGV4ID0gdGFiSW5kZXg7XG4gICAgICAgIH1cblxuICAgICAgICAvKiogQHJldHVybiB7P251bWJlcn0gKi9cbiAgICAgICAgLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICB0aGlzLl90aHJvd0lmRGVzdHJveWVkKCk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmVkVGFiSW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH1dKTtcblxuICAgICAgcmV0dXJuIEluZXJ0Tm9kZTtcbiAgICB9KCk7XG5cbiAgICAvKipcbiAgICAgKiBJbmVydE1hbmFnZXIgaXMgYSBwZXItZG9jdW1lbnQgc2luZ2xldG9uIG9iamVjdCB3aGljaCBtYW5hZ2VzIGFsbCBpbmVydCByb290cyBhbmQgbm9kZXMuXG4gICAgICpcbiAgICAgKiBXaGVuIGFuIGVsZW1lbnQgYmVjb21lcyBhbiBpbmVydCByb290IGJ5IGhhdmluZyBhbiBgaW5lcnRgIGF0dHJpYnV0ZSBzZXQgYW5kL29yIGl0cyBgaW5lcnRgXG4gICAgICogcHJvcGVydHkgc2V0IHRvIGB0cnVlYCwgdGhlIGBzZXRJbmVydGAgbWV0aG9kIGNyZWF0ZXMgYW4gYEluZXJ0Um9vdGAgb2JqZWN0IGZvciB0aGUgZWxlbWVudC5cbiAgICAgKiBUaGUgYEluZXJ0Um9vdGAgaW4gdHVybiByZWdpc3RlcnMgaXRzZWxmIGFzIG1hbmFnaW5nIGFsbCBvZiB0aGUgZWxlbWVudCdzIGZvY3VzYWJsZSBkZXNjZW5kYW50XG4gICAgICogbm9kZXMgdmlhIHRoZSBgcmVnaXN0ZXIoKWAgbWV0aG9kLiBUaGUgYEluZXJ0TWFuYWdlcmAgZW5zdXJlcyB0aGF0IGEgc2luZ2xlIGBJbmVydE5vZGVgIGluc3RhbmNlXG4gICAgICogaXMgY3JlYXRlZCBmb3IgZWFjaCBzdWNoIG5vZGUsIHZpYSB0aGUgYF9tYW5hZ2VkTm9kZXNgIG1hcC5cbiAgICAgKi9cblxuXG4gICAgdmFyIEluZXJ0TWFuYWdlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIC8qKlxuICAgICAgICogQHBhcmFtIHshRG9jdW1lbnR9IGRvY3VtZW50XG4gICAgICAgKi9cbiAgICAgIGZ1bmN0aW9uIEluZXJ0TWFuYWdlcihkb2N1bWVudCkge1xuICAgICAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgSW5lcnRNYW5hZ2VyKTtcblxuICAgICAgICBpZiAoIWRvY3VtZW50KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHJlcXVpcmVkIGFyZ3VtZW50OyBJbmVydE1hbmFnZXIgbmVlZHMgdG8gd3JhcCBhIGRvY3VtZW50LicpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEB0eXBlIHshRG9jdW1lbnR9ICovXG4gICAgICAgIHRoaXMuX2RvY3VtZW50ID0gZG9jdW1lbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFsbCBtYW5hZ2VkIG5vZGVzIGtub3duIHRvIHRoaXMgSW5lcnRNYW5hZ2VyLiBJbiBhIG1hcCB0byBhbGxvdyBsb29raW5nIHVwIGJ5IE5vZGUuXG4gICAgICAgICAqIEB0eXBlIHshTWFwPCFOb2RlLCAhSW5lcnROb2RlPn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21hbmFnZWROb2RlcyA9IG5ldyBNYXAoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWxsIGluZXJ0IHJvb3RzIGtub3duIHRvIHRoaXMgSW5lcnRNYW5hZ2VyLiBJbiBhIG1hcCB0byBhbGxvdyBsb29raW5nIHVwIGJ5IE5vZGUuXG4gICAgICAgICAqIEB0eXBlIHshTWFwPCFOb2RlLCAhSW5lcnRSb290Pn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2luZXJ0Um9vdHMgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE9ic2VydmVyIGZvciBtdXRhdGlvbnMgb24gYGRvY3VtZW50LmJvZHlgLlxuICAgICAgICAgKiBAdHlwZSB7IU11dGF0aW9uT2JzZXJ2ZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMuX3dhdGNoRm9ySW5lcnQuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgLy8gQWRkIGluZXJ0IHN0eWxlLlxuICAgICAgICBhZGRJbmVydFN0eWxlKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuYm9keSB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuXG4gICAgICAgIC8vIFdhaXQgZm9yIGRvY3VtZW50IHRvIGJlIGxvYWRlZC5cbiAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykge1xuICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCB0aGlzLl9vbkRvY3VtZW50TG9hZGVkLmJpbmQodGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX29uRG9jdW1lbnRMb2FkZWQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvKipcbiAgICAgICAqIFNldCB3aGV0aGVyIHRoZSBnaXZlbiBlbGVtZW50IHNob3VsZCBiZSBhbiBpbmVydCByb290IG9yIG5vdC5cbiAgICAgICAqIEBwYXJhbSB7IUVsZW1lbnR9IHJvb3RcbiAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaW5lcnRcbiAgICAgICAqL1xuXG5cbiAgICAgIF9jcmVhdGVDbGFzcyhJbmVydE1hbmFnZXIsIFt7XG4gICAgICAgIGtleTogJ3NldEluZXJ0JyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIHNldEluZXJ0KHJvb3QsIGluZXJ0KSB7XG4gICAgICAgICAgaWYgKGluZXJ0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5faW5lcnRSb290cy5oYXMocm9vdCkpIHtcbiAgICAgICAgICAgICAgLy8gZWxlbWVudCBpcyBhbHJlYWR5IGluZXJ0XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGluZXJ0Um9vdCA9IG5ldyBJbmVydFJvb3Qocm9vdCwgdGhpcyk7XG4gICAgICAgICAgICByb290LnNldEF0dHJpYnV0ZSgnaW5lcnQnLCAnJyk7XG4gICAgICAgICAgICB0aGlzLl9pbmVydFJvb3RzLnNldChyb290LCBpbmVydFJvb3QpO1xuICAgICAgICAgICAgLy8gSWYgbm90IGNvbnRhaW5lZCBpbiB0aGUgZG9jdW1lbnQsIGl0IG11c3QgYmUgaW4gYSBzaGFkb3dSb290LlxuICAgICAgICAgICAgLy8gRW5zdXJlIGluZXJ0IHN0eWxlcyBhcmUgYWRkZWQgdGhlcmUuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX2RvY3VtZW50LmJvZHkuY29udGFpbnMocm9vdCkpIHtcbiAgICAgICAgICAgICAgdmFyIHBhcmVudCA9IHJvb3QucGFyZW50Tm9kZTtcbiAgICAgICAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgIGlmIChwYXJlbnQubm9kZVR5cGUgPT09IDExKSB7XG4gICAgICAgICAgICAgICAgICBhZGRJbmVydFN0eWxlKHBhcmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5faW5lcnRSb290cy5oYXMocm9vdCkpIHtcbiAgICAgICAgICAgICAgLy8gZWxlbWVudCBpcyBhbHJlYWR5IG5vbi1pbmVydFxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBfaW5lcnRSb290ID0gdGhpcy5faW5lcnRSb290cy5nZXQocm9vdCk7XG4gICAgICAgICAgICBfaW5lcnRSb290LmRlc3RydWN0b3IoKTtcbiAgICAgICAgICAgIHRoaXMuX2luZXJ0Um9vdHNbJ2RlbGV0ZSddKHJvb3QpO1xuICAgICAgICAgICAgcm9vdC5yZW1vdmVBdHRyaWJ1dGUoJ2luZXJ0Jyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldCB0aGUgSW5lcnRSb290IG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoZSBnaXZlbiBpbmVydCByb290IGVsZW1lbnQsIGlmIGFueS5cbiAgICAgICAgICogQHBhcmFtIHshTm9kZX0gZWxlbWVudFxuICAgICAgICAgKiBAcmV0dXJuIHshSW5lcnRSb290fHVuZGVmaW5lZH1cbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAnZ2V0SW5lcnRSb290JyxcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGdldEluZXJ0Um9vdChlbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX2luZXJ0Um9vdHMuZ2V0KGVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlZ2lzdGVyIHRoZSBnaXZlbiBJbmVydFJvb3QgYXMgbWFuYWdpbmcgdGhlIGdpdmVuIG5vZGUuXG4gICAgICAgICAqIEluIHRoZSBjYXNlIHdoZXJlIHRoZSBub2RlIGhhcyBhIHByZXZpb3VzbHkgZXhpc3RpbmcgaW5lcnQgcm9vdCwgdGhpcyBpbmVydCByb290IHdpbGxcbiAgICAgICAgICogYmUgYWRkZWQgdG8gaXRzIHNldCBvZiBpbmVydCByb290cy5cbiAgICAgICAgICogQHBhcmFtIHshTm9kZX0gbm9kZVxuICAgICAgICAgKiBAcGFyYW0geyFJbmVydFJvb3R9IGluZXJ0Um9vdFxuICAgICAgICAgKiBAcmV0dXJuIHshSW5lcnROb2RlfSBpbmVydE5vZGVcbiAgICAgICAgICovXG5cbiAgICAgIH0sIHtcbiAgICAgICAga2V5OiAncmVnaXN0ZXInLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gcmVnaXN0ZXIobm9kZSwgaW5lcnRSb290KSB7XG4gICAgICAgICAgdmFyIGluZXJ0Tm9kZSA9IHRoaXMuX21hbmFnZWROb2Rlcy5nZXQobm9kZSk7XG4gICAgICAgICAgaWYgKGluZXJ0Tm9kZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBub2RlIHdhcyBhbHJlYWR5IGluIGFuIGluZXJ0IHN1YnRyZWVcbiAgICAgICAgICAgIGluZXJ0Tm9kZS5hZGRJbmVydFJvb3QoaW5lcnRSb290KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5lcnROb2RlID0gbmV3IEluZXJ0Tm9kZShub2RlLCBpbmVydFJvb3QpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuX21hbmFnZWROb2Rlcy5zZXQobm9kZSwgaW5lcnROb2RlKTtcblxuICAgICAgICAgIHJldHVybiBpbmVydE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogRGUtcmVnaXN0ZXIgdGhlIGdpdmVuIEluZXJ0Um9vdCBhcyBtYW5hZ2luZyB0aGUgZ2l2ZW4gaW5lcnQgbm9kZS5cbiAgICAgICAgICogUmVtb3ZlcyB0aGUgaW5lcnQgcm9vdCBmcm9tIHRoZSBJbmVydE5vZGUncyBzZXQgb2YgbWFuYWdpbmcgaW5lcnQgcm9vdHMsIGFuZCByZW1vdmUgdGhlIGluZXJ0XG4gICAgICAgICAqIG5vZGUgZnJvbSB0aGUgSW5lcnRNYW5hZ2VyJ3Mgc2V0IG9mIG1hbmFnZWQgbm9kZXMgaWYgaXQgaXMgZGVzdHJveWVkLlxuICAgICAgICAgKiBJZiB0aGUgbm9kZSBpcyBub3QgY3VycmVudGx5IG1hbmFnZWQsIHRoaXMgaXMgZXNzZW50aWFsbHkgYSBuby1vcC5cbiAgICAgICAgICogQHBhcmFtIHshTm9kZX0gbm9kZVxuICAgICAgICAgKiBAcGFyYW0geyFJbmVydFJvb3R9IGluZXJ0Um9vdFxuICAgICAgICAgKiBAcmV0dXJuIHs/SW5lcnROb2RlfSBUaGUgcG90ZW50aWFsbHkgZGVzdHJveWVkIEluZXJ0Tm9kZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBub2RlLCBpZiBhbnkuXG4gICAgICAgICAqL1xuXG4gICAgICB9LCB7XG4gICAgICAgIGtleTogJ2RlcmVnaXN0ZXInLFxuICAgICAgICB2YWx1ZTogZnVuY3Rpb24gZGVyZWdpc3Rlcihub2RlLCBpbmVydFJvb3QpIHtcbiAgICAgICAgICB2YXIgaW5lcnROb2RlID0gdGhpcy5fbWFuYWdlZE5vZGVzLmdldChub2RlKTtcbiAgICAgICAgICBpZiAoIWluZXJ0Tm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaW5lcnROb2RlLnJlbW92ZUluZXJ0Um9vdChpbmVydFJvb3QpO1xuICAgICAgICAgIGlmIChpbmVydE5vZGUuZGVzdHJveWVkKSB7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VkTm9kZXNbJ2RlbGV0ZSddKG5vZGUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBpbmVydE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FsbGJhY2sgdXNlZCB3aGVuIGRvY3VtZW50IGhhcyBmaW5pc2hlZCBsb2FkaW5nLlxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfb25Eb2N1bWVudExvYWRlZCcsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBfb25Eb2N1bWVudExvYWRlZCgpIHtcbiAgICAgICAgICAvLyBGaW5kIGFsbCBpbmVydCByb290cyBpbiBkb2N1bWVudCBhbmQgbWFrZSB0aGVtIGFjdHVhbGx5IGluZXJ0LlxuICAgICAgICAgIHZhciBpbmVydEVsZW1lbnRzID0gc2xpY2UuY2FsbCh0aGlzLl9kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbaW5lcnRdJykpO1xuICAgICAgICAgIGluZXJ0RWxlbWVudHMuZm9yRWFjaChmdW5jdGlvbiAoaW5lcnRFbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLnNldEluZXJ0KGluZXJ0RWxlbWVudCwgdHJ1ZSk7XG4gICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAvLyBDb21tZW50IHRoaXMgb3V0IHRvIHVzZSBwcm9ncmFtbWF0aWMgQVBJIG9ubHkuXG4gICAgICAgICAgdGhpcy5fb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLl9kb2N1bWVudC5ib2R5IHx8IHRoaXMuX2RvY3VtZW50LmRvY3VtZW50RWxlbWVudCwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FsbGJhY2sgdXNlZCB3aGVuIG11dGF0aW9uIG9ic2VydmVyIGRldGVjdHMgYXR0cmlidXRlIGNoYW5nZXMuXG4gICAgICAgICAqIEBwYXJhbSB7IUFycmF5PCFNdXRhdGlvblJlY29yZD59IHJlY29yZHNcbiAgICAgICAgICogQHBhcmFtIHshTXV0YXRpb25PYnNlcnZlcn0gc2VsZlxuICAgICAgICAgKi9cblxuICAgICAgfSwge1xuICAgICAgICBrZXk6ICdfd2F0Y2hGb3JJbmVydCcsXG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiBfd2F0Y2hGb3JJbmVydChyZWNvcmRzLCBzZWxmKSB7XG4gICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICByZWNvcmRzLmZvckVhY2goZnVuY3Rpb24gKHJlY29yZCkge1xuICAgICAgICAgICAgc3dpdGNoIChyZWNvcmQudHlwZSkge1xuICAgICAgICAgICAgICBjYXNlICdjaGlsZExpc3QnOlxuICAgICAgICAgICAgICAgIHNsaWNlLmNhbGwocmVjb3JkLmFkZGVkTm9kZXMpLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChub2RlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB2YXIgaW5lcnRFbGVtZW50cyA9IHNsaWNlLmNhbGwobm9kZS5xdWVyeVNlbGVjdG9yQWxsKCdbaW5lcnRdJykpO1xuICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMuY2FsbChub2RlLCAnW2luZXJ0XScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZXJ0RWxlbWVudHMudW5zaGlmdChub2RlKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGluZXJ0RWxlbWVudHMuZm9yRWFjaChmdW5jdGlvbiAoaW5lcnRFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0SW5lcnQoaW5lcnRFbGVtZW50LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgIH0sIF90aGlzKTtcbiAgICAgICAgICAgICAgICB9LCBfdGhpcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJ2F0dHJpYnV0ZXMnOlxuICAgICAgICAgICAgICAgIGlmIChyZWNvcmQuYXR0cmlidXRlTmFtZSAhPT0gJ2luZXJ0Jykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gLyoqIEB0eXBlIHshRWxlbWVudH0gKi9yZWNvcmQudGFyZ2V0O1xuICAgICAgICAgICAgICAgIHZhciBpbmVydCA9IHRhcmdldC5oYXNBdHRyaWJ1dGUoJ2luZXJ0Jyk7XG4gICAgICAgICAgICAgICAgX3RoaXMuc2V0SW5lcnQodGFyZ2V0LCBpbmVydCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH1dKTtcblxuICAgICAgcmV0dXJuIEluZXJ0TWFuYWdlcjtcbiAgICB9KCk7XG5cbiAgICAvKipcbiAgICAgKiBSZWN1cnNpdmVseSB3YWxrIHRoZSBjb21wb3NlZCB0cmVlIGZyb20gfG5vZGV8LlxuICAgICAqIEBwYXJhbSB7IU5vZGV9IG5vZGVcbiAgICAgKiBAcGFyYW0geyhmdW5jdGlvbiAoIUVsZW1lbnQpKT19IGNhbGxiYWNrIENhbGxiYWNrIHRvIGJlIGNhbGxlZCBmb3IgZWFjaCBlbGVtZW50IHRyYXZlcnNlZCxcbiAgICAgKiAgICAgYmVmb3JlIGRlc2NlbmRpbmcgaW50byBjaGlsZCBub2Rlcy5cbiAgICAgKiBAcGFyYW0gez9TaGFkb3dSb290PX0gc2hhZG93Um9vdEFuY2VzdG9yIFRoZSBuZWFyZXN0IFNoYWRvd1Jvb3QgYW5jZXN0b3IsIGlmIGFueS5cbiAgICAgKi9cblxuXG4gICAgZnVuY3Rpb24gY29tcG9zZWRUcmVlV2Fsayhub2RlLCBjYWxsYmFjaywgc2hhZG93Um9vdEFuY2VzdG9yKSB7XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICB2YXIgZWxlbWVudCA9IC8qKiBAdHlwZSB7IUVsZW1lbnR9ICovbm9kZTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2soZWxlbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEZXNjZW5kIGludG8gbm9kZTpcbiAgICAgICAgLy8gSWYgaXQgaGFzIGEgU2hhZG93Um9vdCwgaWdub3JlIGFsbCBjaGlsZCBlbGVtZW50cyAtIHRoZXNlIHdpbGwgYmUgcGlja2VkXG4gICAgICAgIC8vIHVwIGJ5IHRoZSA8Y29udGVudD4gb3IgPHNoYWRvdz4gZWxlbWVudHMuIERlc2NlbmQgc3RyYWlnaHQgaW50byB0aGVcbiAgICAgICAgLy8gU2hhZG93Um9vdC5cbiAgICAgICAgdmFyIHNoYWRvd1Jvb3QgPSAvKiogQHR5cGUgeyFIVE1MRWxlbWVudH0gKi9lbGVtZW50LnNoYWRvd1Jvb3Q7XG4gICAgICAgIGlmIChzaGFkb3dSb290KSB7XG4gICAgICAgICAgY29tcG9zZWRUcmVlV2FsayhzaGFkb3dSb290LCBjYWxsYmFjaywgc2hhZG93Um9vdCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgaXQgaXMgYSA8Y29udGVudD4gZWxlbWVudCwgZGVzY2VuZCBpbnRvIGRpc3RyaWJ1dGVkIGVsZW1lbnRzIC0gdGhlc2VcbiAgICAgICAgLy8gYXJlIGVsZW1lbnRzIGZyb20gb3V0c2lkZSB0aGUgc2hhZG93IHJvb3Qgd2hpY2ggYXJlIHJlbmRlcmVkIGluc2lkZSB0aGVcbiAgICAgICAgLy8gc2hhZG93IERPTS5cbiAgICAgICAgaWYgKGVsZW1lbnQubG9jYWxOYW1lID09ICdjb250ZW50Jykge1xuICAgICAgICAgIHZhciBjb250ZW50ID0gLyoqIEB0eXBlIHshSFRNTENvbnRlbnRFbGVtZW50fSAqL2VsZW1lbnQ7XG4gICAgICAgICAgLy8gVmVyaWZpZXMgaWYgU2hhZG93RG9tIHYwIGlzIHN1cHBvcnRlZC5cbiAgICAgICAgICB2YXIgZGlzdHJpYnV0ZWROb2RlcyA9IGNvbnRlbnQuZ2V0RGlzdHJpYnV0ZWROb2RlcyA/IGNvbnRlbnQuZ2V0RGlzdHJpYnV0ZWROb2RlcygpIDogW107XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaXN0cmlidXRlZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb21wb3NlZFRyZWVXYWxrKGRpc3RyaWJ1dGVkTm9kZXNbaV0sIGNhbGxiYWNrLCBzaGFkb3dSb290QW5jZXN0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBpdCBpcyBhIDxzbG90PiBlbGVtZW50LCBkZXNjZW5kIGludG8gYXNzaWduZWQgbm9kZXMgLSB0aGVzZVxuICAgICAgICAvLyBhcmUgZWxlbWVudHMgZnJvbSBvdXRzaWRlIHRoZSBzaGFkb3cgcm9vdCB3aGljaCBhcmUgcmVuZGVyZWQgaW5zaWRlIHRoZVxuICAgICAgICAvLyBzaGFkb3cgRE9NLlxuICAgICAgICBpZiAoZWxlbWVudC5sb2NhbE5hbWUgPT0gJ3Nsb3QnKSB7XG4gICAgICAgICAgdmFyIHNsb3QgPSAvKiogQHR5cGUgeyFIVE1MU2xvdEVsZW1lbnR9ICovZWxlbWVudDtcbiAgICAgICAgICAvLyBWZXJpZnkgaWYgU2hhZG93RG9tIHYxIGlzIHN1cHBvcnRlZC5cbiAgICAgICAgICB2YXIgX2Rpc3RyaWJ1dGVkTm9kZXMgPSBzbG90LmFzc2lnbmVkTm9kZXMgPyBzbG90LmFzc2lnbmVkTm9kZXMoeyBmbGF0dGVuOiB0cnVlIH0pIDogW107XG4gICAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IF9kaXN0cmlidXRlZE5vZGVzLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgY29tcG9zZWRUcmVlV2FsayhfZGlzdHJpYnV0ZWROb2Rlc1tfaV0sIGNhbGxiYWNrLCBzaGFkb3dSb290QW5jZXN0b3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gSWYgaXQgaXMgbmVpdGhlciB0aGUgcGFyZW50IG9mIGEgU2hhZG93Um9vdCwgYSA8Y29udGVudD4gZWxlbWVudCwgYSA8c2xvdD5cbiAgICAgIC8vIGVsZW1lbnQsIG5vciBhIDxzaGFkb3c+IGVsZW1lbnQgcmVjdXJzZSBub3JtYWxseS5cbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuZmlyc3RDaGlsZDtcbiAgICAgIHdoaWxlIChjaGlsZCAhPSBudWxsKSB7XG4gICAgICAgIGNvbXBvc2VkVHJlZVdhbGsoY2hpbGQsIGNhbGxiYWNrLCBzaGFkb3dSb290QW5jZXN0b3IpO1xuICAgICAgICBjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBzdHlsZSBlbGVtZW50IHRvIHRoZSBub2RlIGNvbnRhaW5pbmcgdGhlIGluZXJ0IHNwZWNpZmljIHN0eWxlc1xuICAgICAqIEBwYXJhbSB7IU5vZGV9IG5vZGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBhZGRJbmVydFN0eWxlKG5vZGUpIHtcbiAgICAgIGlmIChub2RlLnF1ZXJ5U2VsZWN0b3IoJ3N0eWxlI2luZXJ0LXN0eWxlLCBsaW5rI2luZXJ0LXN0eWxlJykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICAgIHN0eWxlLnNldEF0dHJpYnV0ZSgnaWQnLCAnaW5lcnQtc3R5bGUnKTtcbiAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gJ1xcbicgKyAnW2luZXJ0XSB7XFxuJyArICcgIHBvaW50ZXItZXZlbnRzOiBub25lO1xcbicgKyAnICBjdXJzb3I6IGRlZmF1bHQ7XFxuJyArICd9XFxuJyArICdcXG4nICsgJ1tpbmVydF0sIFtpbmVydF0gKiB7XFxuJyArICcgIC13ZWJraXQtdXNlci1zZWxlY3Q6IG5vbmU7XFxuJyArICcgIC1tb3otdXNlci1zZWxlY3Q6IG5vbmU7XFxuJyArICcgIC1tcy11c2VyLXNlbGVjdDogbm9uZTtcXG4nICsgJyAgdXNlci1zZWxlY3Q6IG5vbmU7XFxuJyArICd9XFxuJztcbiAgICAgIG5vZGUuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIH1cblxuICAgIGlmICghRWxlbWVudC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoJ2luZXJ0JykpIHtcbiAgICAgIC8qKiBAdHlwZSB7IUluZXJ0TWFuYWdlcn0gKi9cbiAgICAgIHZhciBpbmVydE1hbmFnZXIgPSBuZXcgSW5lcnRNYW5hZ2VyKGRvY3VtZW50KTtcblxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEVsZW1lbnQucHJvdG90eXBlLCAnaW5lcnQnLCB7XG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIC8qKiBAdGhpcyB7IUVsZW1lbnR9ICovXG4gICAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmhhc0F0dHJpYnV0ZSgnaW5lcnQnKTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqIEB0aGlzIHshRWxlbWVudH0gKi9cbiAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQoaW5lcnQpIHtcbiAgICAgICAgICBpbmVydE1hbmFnZXIuc2V0SW5lcnQodGhpcywgaW5lcnQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0pKCk7XG5cbn0pKSk7XG4iLCJpbXBvcnQgJ2ludGVyc2VjdGlvbi1vYnNlcnZlcidcbmltcG9ydCAnd2ljZy1pbmVydCdcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRml4ZWRCYXIge1xuICBiYXI6IEhUTUxFbGVtZW50IHwgbnVsbFxuICByYW5nZXM6IE5vZGVMaXN0T2Y8SFRNTEVsZW1lbnQ+IHwgbnVsbFxuICBvYnNlcnZlcjogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJcbiAgaXNFeHBhbmRlZDogYm9vbGVhbiA9IGZhbHNlXG4gIHJldmVyc2U6IGJvb2xlYW4gPSBmYWxzZVxuICByZXZpdmFsVGltZXI6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuICBpc0Nsb3NlZEV0ZXJuYWxseTogYm9vbGVhbiA9IGZhbHNlXG4gIGZyZWV6ZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICBpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uPzogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJJbml0ID0ge31cblxuICBjb25zdHJ1Y3RvcihhcmdzOiB7XG4gICAgYmFyOiBzdHJpbmdcbiAgICByYW5nZTogc3RyaW5nXG4gICAgY2xvc2VyPzogc3RyaW5nXG4gICAgcmV2ZXJzZT86IGJvb2xlYW5cbiAgICBpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uPzogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJJbml0XG4gIH0pIHtcbiAgICBpZiAodHlwZW9mIGFyZ3MuYmFyICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKGBgKVxuICAgIHRoaXMuYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzLmJhcilcbiAgICBpZiAoIXRoaXMuYmFyKSB0aHJvdyBuZXcgRXJyb3IoYGApXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUodGhpcy5pc0V4cGFuZGVkKVxuXG4gICAgaWYgKHR5cGVvZiBhcmdzLnJhbmdlICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKGBgKVxuICAgIHRoaXMucmFuZ2VzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChhcmdzLnJhbmdlKVxuICAgIGlmICghdGhpcy5yYW5nZXMpIHRocm93IG5ldyBFcnJvcihgYClcbiAgICBpZiAodHlwZW9mIGFyZ3MucmV2ZXJzZSAhPT0gJ3VuZGVmaW5lZCcpIHRoaXMucmV2ZXJzZSA9IGFyZ3MucmV2ZXJzZVxuICAgIGlmICh0eXBlb2YgYXJncy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhpcy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uID0gYXJncy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uXG4gICAgfVxuXG4gICAgdGhpcy5vYnNlcnZlciA9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihcbiAgICAgIHRoaXMuX29ic2VydmUuYmluZCh0aGlzKSwgdGhpcy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5yYW5nZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICB0aGlzLm9ic2VydmVyLm9ic2VydmUodGhpcy5yYW5nZXNbaV0pXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfb2JzZXJ2ZShlbnRyaWVzOiBJbnRlcnNlY3Rpb25PYnNlcnZlckVudHJ5W10pIHtcbiAgICBpZiAodGhpcy5yZXZpdmFsVGltZXIgfHwgdGhpcy5pc0Nsb3NlZEV0ZXJuYWxseSB8fCB0aGlzLmZyZWV6ZWQpIHJldHVyblxuXG4gICAgbGV0IGlzSW50ZXJzZWN0aW5nID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZW50cmllc1tpXS5pc0ludGVyc2VjdGluZykge1xuICAgICAgICBpc0ludGVyc2VjdGluZyA9IHRydWVcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKCF0aGlzLnJldmVyc2UgJiYgaXNJbnRlcnNlY3RpbmcpIHx8ICh0aGlzLnJldmVyc2UgJiYgIWlzSW50ZXJzZWN0aW5nKSkge1xuICAgICAgdGhpcy5vcGVuKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfVxuICB9XG5cbiAgb3BlbigpIHtcbiAgICB0aGlzLmlzRXhwYW5kZWQgPSB0cnVlXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUodHJ1ZSlcbiAgICB0aGlzLmlzQ2xvc2VkRXRlcm5hbGx5ID0gZmFsc2VcbiAgICBpZiAodGhpcy5yZXZpdmFsVGltZXIpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZXZpdmFsVGltZXIpXG4gIH1cblxuICBjbG9zZSh0aW1lPzogbnVtYmVyKSB7XG4gICAgdGhpcy5pc0V4cGFuZGVkID0gZmFsc2VcbiAgICB0aGlzLl9zd2l0Y2hTdGF0ZShmYWxzZSlcbiAgICBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInICYmIHRpbWUgPT09IDApIHtcbiAgICAgIHRoaXMuaXNDbG9zZWRFdGVybmFsbHkgPSB0cnVlXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGltZSA9PT0gJ251bWJlcicgJiYgdGltZSA+IDApIHtcbiAgICAgIHRoaXMucmV2aXZhbFRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmV2aXZhbFRpbWVyKVxuICAgICAgfSwgdGltZSlcbiAgICB9XG4gIH1cblxuICBmcmVlemUoaXNFeHBhbmRlZDogYm9vbGVhbiA9IHRydWUpIHtcbiAgICBpc0V4cGFuZGVkID8gdGhpcy5vcGVuKCkgOiB0aGlzLmNsb3NlKClcbiAgICB0aGlzLmZyZWV6ZWQgPSB0cnVlXG4gIH1cblxuICByZXN0YXJ0KCkge1xuICAgIHRoaXMuZnJlZXplZCA9IGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3dpdGNoU3RhdGUoaXNFeHBhbmRlZDogYm9vbGVhbikge1xuICAgIHRoaXMuYmFyPy5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgU3RyaW5nKCFpc0V4cGFuZGVkKSlcbiAgICBpZiAoaXNFeHBhbmRlZCkge1xuICAgICAgdGhpcy5iYXI/LnJlbW92ZUF0dHJpYnV0ZSgnaGlkZGVuJylcbiAgICAgIHRoaXMuYmFyPy5yZW1vdmVBdHRyaWJ1dGUoJ2luZXJ0JylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5iYXI/LnNldEF0dHJpYnV0ZSgnaGlkZGVuJywgJycpXG4gICAgICB0aGlzLmJhcj8uc2V0QXR0cmlidXRlKCdpbmVydCcsICcnKVxuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbImdsb2JhbCIsImZhY3RvcnkiLCJ0aGlzIiwiX2NyZWF0ZUNsYXNzIiwiZGVmaW5lUHJvcGVydGllcyIsInRhcmdldCIsInByb3BzIiwiaSIsImxlbmd0aCIsImRlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwiY29uZmlndXJhYmxlIiwid3JpdGFibGUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImtleSIsIkNvbnN0cnVjdG9yIiwicHJvdG9Qcm9wcyIsInN0YXRpY1Byb3BzIiwicHJvdG90eXBlIiwiX2NsYXNzQ2FsbENoZWNrIiwiaW5zdGFuY2UiLCJUeXBlRXJyb3IiLCJ3aW5kb3ciLCJzbGljZSIsIkFycmF5IiwibWF0Y2hlcyIsIkVsZW1lbnQiLCJtc01hdGNoZXNTZWxlY3RvciIsIl9mb2N1c2FibGVFbGVtZW50c1N0cmluZyIsImpvaW4iLCJJbmVydFJvb3QiLCJyb290RWxlbWVudCIsImluZXJ0TWFuYWdlciIsIl9pbmVydE1hbmFnZXIiLCJfcm9vdEVsZW1lbnQiLCJfbWFuYWdlZE5vZGVzIiwiU2V0IiwiaGFzQXR0cmlidXRlIiwiX3NhdmVkQXJpYUhpZGRlbiIsImdldEF0dHJpYnV0ZSIsInNldEF0dHJpYnV0ZSIsIl9tYWtlU3VidHJlZVVuZm9jdXNhYmxlIiwiX29ic2VydmVyIiwiTXV0YXRpb25PYnNlcnZlciIsIl9vbk11dGF0aW9uIiwiYmluZCIsIm9ic2VydmUiLCJhdHRyaWJ1dGVzIiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsInZhbHVlIiwiZGVzdHJ1Y3RvciIsImRpc2Nvbm5lY3QiLCJyZW1vdmVBdHRyaWJ1dGUiLCJmb3JFYWNoIiwiaW5lcnROb2RlIiwiX3VubWFuYWdlTm9kZSIsIm5vZGUiLCJzdGFydE5vZGUiLCJfdGhpczIiLCJjb21wb3NlZFRyZWVXYWxrIiwiX3Zpc2l0Tm9kZSIsImFjdGl2ZUVsZW1lbnQiLCJkb2N1bWVudCIsImJvZHkiLCJjb250YWlucyIsInJvb3QiLCJ1bmRlZmluZWQiLCJub2RlVHlwZSIsIk5vZGUiLCJET0NVTUVOVF9GUkFHTUVOVF9OT0RFIiwicGFyZW50Tm9kZSIsImJsdXIiLCJmb2N1cyIsIkVMRU1FTlRfTk9ERSIsImVsZW1lbnQiLCJfYWRvcHRJbmVydFJvb3QiLCJjYWxsIiwiX21hbmFnZU5vZGUiLCJyZWdpc3RlciIsImFkZCIsImRlcmVnaXN0ZXIiLCJfdW5tYW5hZ2VTdWJ0cmVlIiwiX3RoaXMzIiwiaW5lcnRTdWJyb290IiwiZ2V0SW5lcnRSb290Iiwic2V0SW5lcnQiLCJtYW5hZ2VkTm9kZXMiLCJzYXZlZEluZXJ0Tm9kZSIsInJlY29yZHMiLCJzZWxmIiwicmVjb3JkIiwidHlwZSIsImFkZGVkTm9kZXMiLCJyZW1vdmVkTm9kZXMiLCJhdHRyaWJ1dGVOYW1lIiwibWFuYWdlZE5vZGUiLCJnZXQiLCJzZXQiLCJhcmlhSGlkZGVuIiwiSW5lcnROb2RlIiwiaW5lcnRSb290IiwiX25vZGUiLCJfb3ZlcnJvZGVGb2N1c01ldGhvZCIsIl9pbmVydFJvb3RzIiwiX3NhdmVkVGFiSW5kZXgiLCJfZGVzdHJveWVkIiwiZW5zdXJlVW50YWJiYWJsZSIsIl90aHJvd0lmRGVzdHJveWVkIiwiZGVzdHJveWVkIiwiRXJyb3IiLCJ0YWJJbmRleCIsImhhc1NhdmVkVGFiSW5kZXgiLCJhZGRJbmVydFJvb3QiLCJyZW1vdmVJbmVydFJvb3QiLCJzaXplIiwiSW5lcnRNYW5hZ2VyIiwiX2RvY3VtZW50IiwiTWFwIiwiX3dhdGNoRm9ySW5lcnQiLCJhZGRJbmVydFN0eWxlIiwiaGVhZCIsImRvY3VtZW50RWxlbWVudCIsInJlYWR5U3RhdGUiLCJhZGRFdmVudExpc3RlbmVyIiwiX29uRG9jdW1lbnRMb2FkZWQiLCJpbmVydCIsImhhcyIsInBhcmVudCIsIl9pbmVydFJvb3QiLCJpbmVydEVsZW1lbnRzIiwicXVlcnlTZWxlY3RvckFsbCIsImluZXJ0RWxlbWVudCIsIl90aGlzIiwidW5zaGlmdCIsImNhbGxiYWNrIiwic2hhZG93Um9vdEFuY2VzdG9yIiwic2hhZG93Um9vdCIsImxvY2FsTmFtZSIsImNvbnRlbnQiLCJkaXN0cmlidXRlZE5vZGVzIiwiZ2V0RGlzdHJpYnV0ZWROb2RlcyIsInNsb3QiLCJfZGlzdHJpYnV0ZWROb2RlcyIsImFzc2lnbmVkTm9kZXMiLCJmbGF0dGVuIiwiX2kiLCJjaGlsZCIsImZpcnN0Q2hpbGQiLCJuZXh0U2libGluZyIsInF1ZXJ5U2VsZWN0b3IiLCJzdHlsZSIsImNyZWF0ZUVsZW1lbnQiLCJ0ZXh0Q29udGVudCIsImFwcGVuZENoaWxkIiwiaGFzT3duUHJvcGVydHkiLCJGaXhlZEJhciIsImNvbnN0cnVjdG9yIiwiYXJncyIsImJhciIsIl9zd2l0Y2hTdGF0ZSIsImlzRXhwYW5kZWQiLCJyYW5nZSIsInJhbmdlcyIsInJldmVyc2UiLCJpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uIiwib2JzZXJ2ZXIiLCJJbnRlcnNlY3Rpb25PYnNlcnZlciIsIl9vYnNlcnZlIiwiZW50cmllcyIsInJldml2YWxUaW1lciIsImlzQ2xvc2VkRXRlcm5hbGx5IiwiZnJlZXplZCIsImlzSW50ZXJzZWN0aW5nIiwib3BlbiIsImNsb3NlIiwiY2xlYXJUaW1lb3V0IiwidGltZSIsInNldFRpbWVvdXQiLCJmcmVlemUiLCJyZXN0YXJ0IiwiU3RyaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Q0FBQyxXQUFVQSxNQUFWLEVBQWtCQyxPQUFsQixFQUEyQjtDQUMxQixFQUErREEsT0FBTyxFQUF0RSxDQUFBO0NBR0QsQ0FKQSxFQUlDQyxjQUpELEVBSVEsWUFBWTs7Q0FFbkIsTUFBSUMsWUFBWSxHQUFHLFlBQVk7Q0FBRSxhQUFTQyxnQkFBVCxDQUEwQkMsTUFBMUIsRUFBa0NDLEtBQWxDLEVBQXlDO0NBQUUsV0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHRCxLQUFLLENBQUNFLE1BQTFCLEVBQWtDRCxDQUFDLEVBQW5DLEVBQXVDO0NBQUUsWUFBSUUsVUFBVSxHQUFHSCxLQUFLLENBQUNDLENBQUQsQ0FBdEI7Q0FBMkJFLFFBQUFBLFVBQVUsQ0FBQ0MsVUFBWCxHQUF3QkQsVUFBVSxDQUFDQyxVQUFYLElBQXlCLEtBQWpEO0NBQXdERCxRQUFBQSxVQUFVLENBQUNFLFlBQVgsR0FBMEIsSUFBMUI7Q0FBZ0MsWUFBSSxXQUFXRixVQUFmLEVBQTJCQSxVQUFVLENBQUNHLFFBQVgsR0FBc0IsSUFBdEI7Q0FBNEJDLFFBQUFBLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQlQsTUFBdEIsRUFBOEJJLFVBQVUsQ0FBQ00sR0FB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
