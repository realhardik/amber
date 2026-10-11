import { FRAME_MS, Motion, clamp } from "./motion.js";
import { TouchTracker, isInteractive, keyDelta, wheelDelta, wheelVector } from "./input.js";
import { NativeRenderer } from "./renderers.js";
import { rendererModule, resolvePlugins, runHooks } from "./modules.js";

const instances = new WeakMap();
// The same option groups supply defaults and validation keys.
const numericDefaults = {
  damping: 0.09,
  wheelMultiplier: 0.5,
  touchMultiplier: 2.5,
  touchInertia: 12,
  touchInertiaTimeout: 100,
  lineHeight: 60,
  keyboardStep: 100,
};
const booleanDefaults = {
  anchors: true,
  smoothTouch: true,
  scrollChain: false,
  managedWheel: false,
  respectReducedMotion: true,
  autoRaf: true,
  hideScrollbar: false,
};
const defaults = Object.freeze({
  orientation: "vertical",
  renderer: "native",
  infinite: false,
  snap: false,
  observeSections: false,
  pin: false,
  ...numericDefaults,
  ...booleanDefaults,
});

function optionsWithDefaults(options) {
  const result = { ...defaults, ...options };
  if (result.pin === undefined) result.pin = false;
  result.plugins = resolvePlugins(options.plugins);
  const renderer = options.renderer ?? "native";
  if (renderer !== "native" && (!renderer?.[rendererModule] || renderer.name !== "transform" || typeof renderer.create !== "function")) {
    throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: renderer must be "native" or the module imported from "amber-scroll/transform".' : "Amber A001");
  }
  result.renderer = renderer === "native" ? "native" : renderer.name;
  const has = name => result.plugins.some(plugin => plugin.name === name);
  if (!has("pinning")) {
    if (result.pin !== false && !(Array.isArray(result.pin) && !result.pin.length)) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin requires the pinning module in plugins (import from "amber-scroll/effects" or "amber-scroll/pinning").' : "Amber A002");
    }
    if (Array.isArray(result.pin)) result.pin = Object.freeze([]);
  }
  if (!has("snap") && (result.snap !== false || result.snapDistance !== undefined)) {
    throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: snap options require the module from "amber-scroll/snap" in plugins.' : "Amber A003");
  }
  if (!has("sections") && result.observeSections !== false) {
    throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: observeSections requires the module from "amber-scroll/sections" in plugins.' : "Amber A004");
  }
  for (const plugin of result.plugins) plugin.normalize?.(result);
  result.wheelGesture ??= result.orientation === "vertical" ? "vertical" : "both";
  if (result.orientation === "both") result.hideScrollbar = true;
  for (const [key, allowed] of Object.entries({
    orientation: ["vertical", "horizontal", "both"],
    renderer: ["native", "transform"],
    wheelGesture: ["vertical", "horizontal", "both", "axis"],
  })) {
    if (!allowed.includes(result[key])) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: invalid ${key}.` : "Amber A005");
  }
  for (const key of Object.keys(numericDefaults)) {
    if (!Number.isFinite(result[key]) || result[key] < 0) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: ${key} must be a finite, nonnegative number.` : "Amber A006");
  }
  if (result.damping <= 0 || result.damping > 1) throw new RangeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: damping must be greater than 0 and at most 1." : "Amber A007");
  if (result.renderer === "transform" && !result.smoothTouch) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: smoothTouch=false requires the native renderer." : "Amber A008");
  for (const key of Object.keys(booleanDefaults)) {
    if ("boolean" !== typeof result[key]) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: ${key} must be a boolean.` : "Amber A009");
  }
  if (result.historyKey !== undefined && (typeof result.historyKey !== "string" || !result.historyKey)) {
    throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: historyKey must be a non-empty string." : "Amber A010");
  }
  if (typeof result.infinite !== "boolean") {
    if (!result.infinite || typeof result.infinite !== "object" || Array.isArray(result.infinite)
      || Object.entries(result.infinite).some(([axis, value]) => !["x", "y"].includes(axis) || typeof value !== "boolean")) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: infinite must be a boolean or { x, y } boolean mask." : "Amber A011");
    }
    if (result.orientation === "vertical" && result.infinite.x || result.orientation === "horizontal" && result.infinite.y) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: infinite axes must be enabled by orientation." : "Amber A012");
    }
    result.infinite = Object.freeze({ x: !!result.infinite.x, y: !!result.infinite.y });
  }
  if ((result.infinite === true || result.infinite.x || result.infinite.y) && result.renderer === "native" && !has("infinite")) {
    throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: native infinite scrolling requires the module from "amber-scroll/infinite" in plugins.' : "Amber A013");
  }
  return Object.freeze(result);
}

/** A vector-based smooth-scroll controller. Importing this module never accesses the DOM. */
export class Amber {
  constructor(options = {}) {
    this.options = optionsWithDefaults(options);
    const main = options.content ?? globalThis.document?.querySelector("main[data-amber]");
    const wrapper = options.wrapper ?? (this.options.renderer === "transform" ? main?.parentElement : null) ?? globalThis.window;
    if (!wrapper) throw new Error((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: construct an instance in a browser after the DOM is ready." : "Amber A014");
    const isWindow = wrapper === wrapper.window;
    const document = isWindow ? wrapper.document : wrapper.ownerDocument;
    if (!document?.body || (!isWindow && wrapper.nodeType !== 1)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: wrapper must be a Window or an HTML element in a ready document." : "Amber A015");
    const content = options.content ?? (!options.wrapper ? main : null) ?? (isWindow ? document.body : wrapper.firstElementChild ?? wrapper);
    if (content && (content.nodeType !== 1 || !document.documentElement.contains(content) || (!isWindow && !wrapper.contains(content)))) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: content must be an element inside the wrapper." : "Amber A016");
    }
    if (this.options.renderer === "transform" && (isWindow || !content || content === wrapper)) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: transform mode requires an element wrapper and a separate content element inside it." : "Amber A017");
    }
    for (const plugin of this.options.plugins) plugin.validate?.(document, this.options);
    this.window = document.defaultView;
    this.document = document;
    this.wrapper = wrapper;
    this.root = isWindow ? document.documentElement : wrapper;
    if (instances.has(this.root)) throw new Error((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: this wrapper already has an instance. Destroy it before replacing it." : "Amber A018");
    if (this.options.orientation !== "vertical" && this.window.getComputedStyle(this.root).direction === "rtl") {
      throw new Error((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: horizontal RTL layouts are not supported yet. Use an LTR scroll viewport." : "Amber A019");
    }
    const nativeLoop = this.options.plugins.find(plugin => plugin.createNative);
    const loopRequested = this.options.infinite === true || this.options.infinite.x || this.options.infinite.y;
    this.driver = this.options.renderer === "native"
      ? loopRequested && nativeLoop ? nativeLoop.createNative(wrapper, content, this.options)
        : new NativeRenderer(wrapper, content, this.options.orientation, this.options)
      : options.renderer.create(wrapper, content, this.options);
    this.hooks = [];
    try {
      for (const plugin of this.options.plugins) plugin.install(this);
      this.driver.refresh?.();
      runHooks(this, "refresh");
      const position = this.driver.readVector();
      runHooks(this, "beforeWrite", position[this.driver.axis]);
      this.driver.writeVector(position);
      runHooks(this, "afterWrite", position[this.driver.axis], true);
    } catch (error) {
      runHooks(this, "beforeDestroy");
      runHooks(this, "destroy");
      this.driver.destroy();
      throw error;
    }
    this.motion = new Motion({ ...this.options, infinite: this.driver.infiniteAxes ?? !!this.driver.isInfinite });
    this.touch = new TouchTracker();
    this.listeners = new Map();
    this.cleanups = [];
    this.isStopped = false;
    this.isDestroyed = false;
    this.isVisible = true;
    this.frame = null;
    this.resizeFrame = null;
    this.nativeScrollEndTimer = null;
    this.lastTime = null;
    this.tick = time => {
      this.frame = null;
      this.raf(time);
      this.isScrolling && this.wake();
    };
    this.resizeTick = () => { this.resizeFrame = null; this.resize(); };
    this.motion.setLimit(this.driver.limits);
    this.expectedVector = { ...this.driver.readVector() };
    this.expectedPosition = this.expectedVector[this.motion.axis];
    this.inputDelta = { x: 0, y: 0 };
    this.inputTarget = { x: 0, y: 0 };
    this.motion.jump(this.expectedVector);
    this.media = this.window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.options.respectReducedMotion && this.media.matches;
    instances.set(this.root, this);

    const inputRoot = isWindow ? document : wrapper;
    // Capture lets managed input claim the event before an ancestor's native
    // scrolling begins. The default keeps normal bubbling behavior.
    this.listen(inputRoot, "wheel", event => this.handleWheel(event), { passive: false, capture: this.options.managedWheel });
    this.listen(inputRoot, "keydown", event => this.handleKey(event));
    this.listen(inputRoot, "touchstart", event => this.handleTouchStart(event), { passive: true });
    this.listen(inputRoot, "touchmove", event => this.handleTouchMove(event), { passive: false });
    this.listen(inputRoot, "touchend", event => this.handleTouchEnd(event), { passive: true });
    this.listen(inputRoot, "touchcancel", () => { this.touch.cancel(); runHooks(this, "cancel"); }, { passive: true });
    this.listen(inputRoot, "focusin", event => this.handleFocus(event));
    this.listen(isWindow ? this.window : wrapper, "scroll", () => this.handleNativeScroll(), { passive: true });
    this.listen(this.window, "resize", () => this.scheduleResize(), { passive: true });
    this.listen(inputRoot, "load", () => this.scheduleResize(), { capture: true, passive: true });
    this.listen(document, "visibilitychange", () => {
      this.lastTime = null;
      this.touch.cancel();
      document.hidden ? this.cancelFrame() : this.isScrolling && this.wake();
    });
    this.listen(this.media, "change", () => {
      (this.reducedMotion = this.options.respectReducedMotion && this.media.matches) && this.isScrolling && this.scrollTo(this.motion.targetVector, { immediate: true });
    });
    if (this.window.ResizeObserver) {
      this.observer = new this.window.ResizeObserver(() => this.scheduleResize());
      this.observer.observe(this.root);
      content && content !== this.root && this.observer.observe(content);
    }
    if (!isWindow && this.window.IntersectionObserver) {
      this.intersection = new this.window.IntersectionObserver(entries => {
        this.isVisible = entries[entries.length - 1].isIntersecting;
        this.isVisible ? this.isScrolling && this.wake() : this.cancelFrame();
      });
      this.intersection.observe(wrapper);
    }
    this.mutations = new this.window.MutationObserver(() => this.scheduleResize());
    const observedAttributes = [...new Set([
      "data-amber-avoid", ...this.options.plugins.flatMap(plugin => plugin.attributes ?? []),
    ])];
    this.mutations.observe(content ?? this.root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: observedAttributes,
    });
    // Transform-specific navigation is installed by its driver. Keeping it out
    // of core means native-only bundles do not include hash/history machinery.
    this.driver.installNavigation?.(this);
    runHooks(this, "start");
  }

  get position() { return this.motion.position; }
  get target() { return this.motion.target; }
  get limit() { return this.motion.limit; }
  get velocity() { return this.motion.velocity; }
  get direction() { return this.motion.direction; }
  get progress() { return this.motion.progress; }
  get isInfinite() { return this.motion.infinite; }
  get wrappedPosition() { return this.motion.wrappedPosition; }
  get loopLength() { return this.motion.infiniteAxes[this.motion.axis] ? this.motion.limit : 0; }
  get loopLengthVector() { return Object.freeze({ x: this.motion.infiniteAxes.x ? this.motion.limitVector.x : 0, y: this.motion.infiniteAxes.y ? this.motion.limitVector.y : 0 }); }
  get isScrolling() { return this.motion.isScrolling; }
  get positionVector() { return Object.freeze({ ...this.motion.positionVector }); }
  get targetVector() { return Object.freeze({ ...this.motion.targetVector }); }
  get limitVector() { return Object.freeze({ ...this.motion.limitVector }); }
  get velocityVector() { return Object.freeze({ ...this.motion.velocityVector }); }
  get directionVector() { return Object.freeze({ ...this.motion.directionVector }); }
  get progressVector() { return Object.freeze({ x: this.motion.progressAt('x'), y: this.motion.progressAt('y') }); }
  get wrappedPositionVector() { return Object.freeze({ x: this.motion.wrapped('x'), y: this.motion.wrapped('y') }); }
  get infiniteAxes() { return Object.freeze({ ...this.motion.infiniteAxes }); }
  get state() {
    return Object.freeze({ position: this.position, target: this.target, limit: this.limit, velocity: this.velocity,
      direction: this.direction, progress: this.progress, isScrolling: this.isScrolling,
      isStopped: this.isStopped, orientation: this.options.orientation,
      isInfinite: this.isInfinite, wrappedPosition: this.wrappedPosition, loopLength: this.loopLength,
      positionVector: this.positionVector, targetVector: this.targetVector, limitVector: this.limitVector,
      velocityVector: this.velocityVector, directionVector: this.directionVector, progressVector: this.progressVector,
      wrappedPositionVector: this.wrappedPositionVector, loopLengthVector: this.loopLengthVector, infiniteAxes: this.infiniteAxes });
  }

  listen(target, event, callback, options) {
    target.addEventListener(event, callback, options);
    this.cleanups.push(() => target.removeEventListener(event, callback, options));
  }

  on(event, callback) {
    if (!["scroll", "scrollend", "resize", "sectionenter", "sectionleave", "destroy"].includes(event)) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: unknown event '${event}'.` : "Amber A020");
    }
    if (typeof callback !== "function") throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: event callback must be a function." : "Amber A021");
    if (this.isDestroyed) return () => {};
    const callbacks = this.listeners.get(event) ?? [];
    if (!callbacks.includes(callback)) this.listeners.set(event, [...callbacks, callback]);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    callbacks && this.listeners.set(event, callbacks.filter(fn => fn !== callback));
    return this;
  }
  emit(event, payload) {
    const callbacks = this.listeners.get(event);
    if (!callbacks?.length || this.isDestroyed) return;
    payload ??= this.state;
    // Subscriptions copy on change, so dispatch needs no per-frame array allocation.
    for (const callback of callbacks) {
      if (this.isDestroyed) break;
      callback(payload);
    }
  }

  /** Respect opt-outs, other Amber instances, and scrollable descendants that can consume input. */
  shouldIgnore(event, delta = 0, axis) {
    if (event.defaultPrevented) return true;
    const h = axis ? axis === "x" : event.type === "wheel" ? Math.abs(event.deltaX) > Math.abs(event.deltaY)
      : event.type === "keydown" ? event.key === "ArrowLeft" || event.key === "ArrowRight" : this.driver.isHorizontal;
    const axes = typeof delta === 'number' ? [axis ?? (h ? 'x' : 'y')] : ['x', 'y'].filter(a => delta[a]);
    if (!axes.length) return false;
    for (const el of event.composedPath()) {
      if (el?.nodeType !== 1) continue;
      if (el.hasAttribute("data-amber-prevent")) return true;
      if (el === this.root) break;
      const nested = instances.get(el);
      if (nested) {
        // Observe touches that may use an axis the child does not handle.
        if (event.type === 'touchstart' && this.motion.axes.some(a => !nested.motion.axes.includes(a)
          || nested.options.scrollChain && !nested.isStopped && !nested.motion.infiniteAxes[a])) continue;
        if (event.type === 'wheel' && !nested.driver.isMultiAxis) {
          // A scalar child may map vertical wheel input onto horizontal motion.
          const input = wheelDelta(event, nested.options, nested.driver.viewport) * nested.options.wheelMultiplier;
          if (!input || nested.canReleaseInput(input)) continue;
          return true;
        }
      }
      let style;
      for (const a of axes) {
        const amount = typeof delta === 'number' ? delta : delta[a];
        if (nested) {
          if (nested.motion.axes.includes(a) && !nested.canReleaseInput(amount, a)) return true;
          continue;
        }
        if (!amount) continue;
        const horizontal = a === 'x';
        const limit = horizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
        if (limit <= 0) continue;
        style ??= this.window.getComputedStyle(el);
        if (!/^(auto|scroll|overlay)$/.test(horizontal ? style.overflowX : style.overflowY)) continue;
        const pos = horizontal ? el.scrollLeft : el.scrollTop;
        const over = horizontal ? style.overscrollBehaviorX : style.overscrollBehaviorY;
        if (over === "contain" || over === "none" || (amount < 0 ? pos > 0 : pos < limit - 1)) return true;
      }
    }
    return false;
  }

  consume(event, delta) {
    if (!event.cancelable || this.shouldIgnore(event, delta)) return false;
    // Managed wheel input is claimed once routing has allowed it, even at an edge.
    if (event.type === 'wheel' && this.options.managedWheel) event.preventDefault();
    if (typeof delta === 'number') {
      this.inputDelta.x = this.inputDelta.y = 0;
      this.inputDelta[this.motion.axis] = delta;
      delta = this.inputDelta;
    }
    if (!delta.x && !delta.y) return false;
    if (this.isStopped) { event.preventDefault(); return true; }
    if (this.canReleaseInput(delta)) return false;
    runHooks(this, "beforeInput");
    const target = this.inputTarget;
    let changed = false;
    for (const axis of this.motion.axes) {
      const desired = !Number.isFinite(delta[axis]) ? this.boundary(delta[axis] < 0 ? 'start' : 'end', axis)
        : this.motion.targetVector[axis] + delta[axis];
      const constrained = this.motion.constrain(desired, axis);
      target[axis] = constrained;
      if (constrained !== this.motion.targetVector[axis]) changed = true;
    }
    if (!changed && !this.isScrolling) return false;
    event.preventDefault();
    runHooks(this, "cancel");
    this.moveTo(target);
    runHooks(this, "input");
    return true;
  }

  canReleaseInput(d, a = this.motion.axis) {
    if (typeof d === 'object') return Boolean(d.x || d.y) && (!d.x || this.canReleaseInput(d.x, 'x')) && (!d.y || this.canReleaseInput(d.y, 'y'));
    if (!this.options.scrollChain || this.isStopped || !d || !this.motion.axes.includes(a) || this.motion.infiniteAxes[a]) return false;
    const pos = this.motion.positionVector[a], tgt = this.motion.targetVector[a], lim = this.motion.limitVector[a];
    return d < 0 ? tgt <= 0 && pos <= 1 : tgt >= lim && pos >= lim - 1;
  }

  canReleaseVector(d) { return this.canReleaseInput(d); }

  hasChainingChild(event) {
    for (const el of event.composedPath()) {
      if (el === this.root) break;
      const n = instances.get(el);
      if (n?.options.scrollChain && !n.isStopped && this.motion.axes.some(a => n.motion.axes.includes(a) && !n.motion.infiniteAxes[a])) return true;
    }
    return false;
  }

  handleWheel(event) {
    if (event.ctrlKey || event.metaKey || (this.reducedMotion && this.options.renderer === "native" && !this.driver.isHorizontal && !this.driver.isMultiAxis && !this.isStopped && !this.driver.nativeLoop)) return;
    let delta;
    if (this.driver.isMultiAxis) {
      delta = wheelVector(event, this.options, this.driver.viewport, this.inputDelta);
      if (event.shiftKey && !delta.x && delta.y) { delta.x = delta.y; delta.y = 0; }
      delta.x *= this.options.wheelMultiplier; delta.y *= this.options.wheelMultiplier;
    } else {
      delta = wheelDelta(event, this.options, this.driver.viewport) * this.options.wheelMultiplier;
    }
    this.consume(event, delta);
  }

  handleKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || isInteractive(event.target)) return;
    if (this.driver.isMultiAxis) {
      const h = event.key === "ArrowLeft" || event.key === "ArrowRight";
      const delta = keyDelta(event, h ? "horizontal" : "vertical", h ? this.driver.viewport.width : this.driver.viewport.height, this.options.keyboardStep);
      if (delta === null) return;
      if (!Number.isFinite(delta)) {
        const direction = { x: delta, y: delta };
        if (!this.shouldIgnore(event, direction) && event.cancelable && !this.canReleaseVector(direction)) {
          event.preventDefault();
          !this.isStopped && this.scrollTo(delta < 0 ? "start" : "end");
        }
        return;
      }
      this.inputDelta.x = h ? delta : 0; this.inputDelta.y = h ? 0 : delta;
      this.consume(event, this.inputDelta);
      return;
    }
    const delta = keyDelta(event, this.options.orientation, this.driver.viewportSize, this.options.keyboardStep);
    delta !== null && !(this.reducedMotion && this.options.renderer === "native" && !this.driver.isHorizontal && !this.driver.isMultiAxis && !this.isStopped && !this.driver.nativeLoop) && this.consume(event, delta);
  }

  handleTouchStart(event) {
    this.touch.cancel();
    this.touchDelegated = false;
    if ((!this.options.smoothTouch && !this.isStopped) || event.touches.length !== 1 || this.shouldIgnore(event)
      || (this.reducedMotion && this.options.renderer === "native" && !this.driver.nativeLoop && !this.isStopped)
      || event.target?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    this.cancelAnimation();
    this.touch.start(event.touches[0], this.window.performance.now());
  }

  handleTouchMove(event) {
    if (this.touch.id === null) return;
    const p = event.touches[0];
    if (event.touches.length !== 1 || !event.cancelable || p.identifier !== this.touch.id) { this.touch.cancel(); return; }
    const delta = this.touch.move(p, this.window.performance.now());
    let input = delta, release = delta;
    if (this.driver.isMultiAxis) {
      delta.x *= this.options.touchMultiplier; delta.y *= this.options.touchMultiplier;
    } else {
      release = delta[this.motion.axis];
      if (Math.abs(delta[this.driver.isHorizontal ? 'y' : 'x']) > Math.abs(release)) { this.touch.cancel(); return; }
      input = release * this.options.touchMultiplier;
    }
    const consumed = this.consume(event, input);
    this.touchDelegated = !consumed && (this.hasChainingChild(event) || this.canReleaseInput(release));
    !consumed && !this.touchDelegated && this.touch.cancel();
  }

  handleTouchEnd(event) {
    if (this.touch.id === null) return;
    if (this.touchDelegated) { this.touch.cancel(); this.touchDelegated = false; return; }
    let ended = false;
    for (let i = 0; i < event.changedTouches.length; i++) ended ||= event.changedTouches[i].identifier === this.touch.id;
    if (event.touches.length || !ended) { this.touch.cancel(); return; }
    const momentum = this.touch.release(this.options.orientation, this.window.performance.now(), this.options.touchInertia, this.options.touchInertiaTimeout);
    !this.isStopped && !this.reducedMotion && (this.driver.isMultiAxis || momentum)
      && this.moveTo(this.driver.isMultiAxis ? { x: this.motion.targetVector.x + momentum.x, y: this.motion.targetVector.y + momentum.y } : this.target + momentum);
    runHooks(this, "input");
  }

  handleFocus(event) {
    if (this.isStopped || this.shouldIgnore(event) || event.target === this.root || !event.target?.getBoundingClientRect) return;
    this.handleNativeScroll();
    const r = event.target.getBoundingClientRect(), b = this.driver.bounds,
      d = (s, e) => r[s] < b[s] ? r[s] - b[s] : r[e] > b[e] ? r[e] - b[e] : 0;
    const target = { ...this.driver.readVector() };
    let changed = false;
    for (const axis of this.motion.axes) {
      const delta = axis === 'x' ? d('left', 'right') : d('top', 'bottom');
      target[axis] += delta;
      changed ||= delta !== 0;
    }
    changed && this.scrollTo(target, { immediate: true });
  }

  captureExpected(position) {
    this.expectedVector.x = position.x; this.expectedVector.y = position.y;
    this.expectedPosition = position[this.motion.axis];
  }

  handleNativeScroll() {
    if (this.isDestroyed) return;
    const pos = this.driver.readVector();
    if (Math.abs(pos.x - this.expectedVector.x) < 0.01 && Math.abs(pos.y - this.expectedVector.y) < 0.01) return;
    runHooks(this, "cancel");
    this.cancelFrame();
    this.motion.jump(pos);
    this.driver.resetNative?.();
    if (this.options.renderer === "transform" || this.driver.nativeLoop) this.write();
    else {
      this.captureExpected(pos);
      runHooks(this, "beforeWrite", this.position);
      runHooks(this, "afterWrite", this.position);
    }
    this.cancelNativeScrollEnd();
    this.nativeScrollEndTimer = this.window.setTimeout(() => {
      this.nativeScrollEndTimer = null;
      if (this.isDestroyed || this.isStopped || this.isScrolling) return;
      if (runHooks(this, "settle", true)) return;
      this.emit('scrollend');
    }, 160);
    this.emit("scroll");
  }

  cancelNativeScrollEnd() {
    this.nativeScrollEndTimer != null && this.window.clearTimeout(this.nativeScrollEndTimer);
    this.nativeScrollEndTimer = null;
  }

  write() {
    runHooks(this, "beforeWrite", this.position);
    this.captureExpected(this.driver.writeVector(this.motion.positionVector));
    if (this.expectedPosition !== this.position) runHooks(this, "beforeWrite", this.expectedPosition);
    runHooks(this, "afterWrite", this.expectedPosition);
  }

  boundary(destination, axis = this.motion.axis) {
    const limit = this.motion.limitVector[axis];
    if (!this.motion.infiniteAxes[axis]) return destination === 'start' ? 0 : limit;
    const lapStart = limit ? Math.floor(this.motion.positionVector[axis] / limit) * limit : 0;
    return destination === 'start' ? lapStart : lapStart + (this.driver.finiteLimits?.[axis] ?? this.driver.finiteLimit);
  }

  scrollTo(destination, { immediate = false, offset = 0 } = {}) {
    if (this.isDestroyed) return this;
    let position = destination;
    if (destination === "start" || destination === "end") {
      position = Object.fromEntries(this.motion.axes.map(axis => [axis, this.boundary(destination, axis)]));
    } else if (typeof destination === "string" || destination?.nodeType === 1) {
      const el = typeof destination === "string" ? this.root.querySelector(destination) : destination;
      if (!el || !this.root.contains(el)) throw new Error((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: scroll target must exist inside the wrapper." : "Amber A022");
      position = this.driver.destinationVector(el);
      if (!this.driver.isMultiAxis && !this.isInfinite) {
        const value = position[this.motion.axis];
        position[this.motion.axis] = Math.abs(value) < .01 ? 0 : Math.abs(value - this.limit) < .01 ? this.limit : value;
      }
    }
    if (typeof position === "number") {
      if (!Number.isFinite(position) || !Number.isFinite(offset)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: scrollTo expects finite coordinates and offset." : "Amber A023");
      position = { [this.motion.axis]: position };
    }
    if (!position || typeof position !== "object" || Array.isArray(position)
      || !Object.keys(position).length || Object.keys(position).some(key => !["x", "y"].includes(key))) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: scrollTo expects a number, selector, element, or { x, y } coordinates." : "Amber A024");
    }
    if (typeof offset !== "number" && (!offset || typeof offset !== "object" || Array.isArray(offset)
      || Object.keys(offset).some(axis => !["x", "y"].includes(axis)))) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: invalid vector offset." : "Amber A025");
    const adjusted = {};
    for (const axis of ["x", "y"]) {
      const amount = typeof offset === "number" ? (axis === this.motion.axis ? offset : 0) : offset[axis] ?? 0;
      if (!Number.isFinite(amount)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: offset must be finite." : "Amber A026");
      if (position[axis] === undefined) continue;
      if (!Number.isFinite(position[axis])) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: scroll coordinates must be finite." : "Amber A027");
      if (!this.motion.axes.includes(axis) && position[axis] + amount !== 0) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: destination uses an inactive axis." : "Amber A028");
      adjusted[axis] = position[axis] + amount;
    }
    runHooks(this, "cancel");
    return this.moveTo(adjusted, immediate);
  }

  moveTo(position, immediate = false) {
    if (this.isDestroyed) return this;
    this.cancelNativeScrollEnd();
    this.motion.moveTo(position);
    if (immediate || this.reducedMotion) {
      this.cancelFrame();
      this.motion.jump(position);
      this.write();
      this.emit("scroll");
      !this.isScrolling ? this.emit("scrollend") : this.wake();
    } else if (this.isScrolling) this.wake();
    return this;
  }

  /** Drive with a requestAnimationFrame timestamp in milliseconds when autoRaf is false. */
  raf(time) {
    if (this.isDestroyed || this.document.hidden || !this.isVisible) { this.lastTime = null; return; }
    if (!Number.isFinite(time)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: raf expects a timestamp in milliseconds." : "Amber A029");
    if (!this.isScrolling) { this.lastTime = null; this.motion.velocity = 0; return; }
    const deltaTime = this.lastTime === null ? FRAME_MS : clamp(time - this.lastTime, 0, 64);
    this.lastTime = time;
    if (this.motion.advance(deltaTime)) {
      this.write();
      this.emit("scroll");
      if (!this.isScrolling) {
        this.lastTime = null;
        this.motion.velocity = 0;
        if (!runHooks(this, "settle")) this.emit("scrollend");
      }
    }
  }

  wake() {
    this.options.autoRaf && this.frame === null && !this.isDestroyed && this.isVisible && !this.document.hidden
      && (this.frame = this.window.requestAnimationFrame(this.tick));
  }

  cancelFrame() {
    this.frame !== null && this.window.cancelAnimationFrame(this.frame);
    this.frame = this.lastTime = null;
  }

  cancelAnimation() {
    this.cancelNativeScrollEnd();
    runHooks(this, "cancel");
    this.cancelFrame();
    this.motion.jump(this.motion.positionVector);
  }

  start() { !this.isDestroyed && (this.isStopped = false); return this; }
  stop() {
    if (this.isDestroyed) return this;
    this.isStopped = true;
    this.touch.cancel();
    this.cancelAnimation();
    return this;
  }

  scheduleResize() {
    this.resizeFrame === null && !this.isDestroyed && (this.resizeFrame = this.window.requestAnimationFrame(this.resizeTick));
  }

  resize() {
    if (this.isDestroyed) return this;
    const previousLimit = this.limitVector;
    const previousPosition = this.positionVector;
    const previousInfinite = this.isInfinite;
    const previousViewport = { ...this.driver.viewport };
    runHooks(this, "beforeRefresh");
    this.driver.refreshViewport();
    this.driver.refresh?.();
    try {
      runHooks(this, "refresh");
    }
    catch (error) {
      runHooks(this, "refreshError");
      this.driver.writeVector(this.motion.positionVector);
      throw error;
    }
    this.motion.infinite = this.driver.infiniteAxes ?? !!this.driver.isInfinite;
    this.motion.setLimit(this.driver.limits);
    this.driver.resetNative?.();
    this.write();
    if (this.motion.positionVector.x !== previousPosition.x || this.motion.positionVector.y !== previousPosition.y) this.emit("scroll");
    if (this.motion.limitVector.x !== previousLimit.x || this.motion.limitVector.y !== previousLimit.y || this.isInfinite !== previousInfinite
      || this.driver.viewport.width !== previousViewport.width || this.driver.viewport.height !== previousViewport.height) this.emit("resize");
    return this;
  }

  destroy() {
    if (this.isDestroyed) return;
    const destroyCallbacks = this.listeners.get("destroy") ?? [];
    this.isDestroyed = true;
    this.touch.cancel();
    this.cancelAnimation();
    if (this.resizeFrame !== null) this.window.cancelAnimationFrame(this.resizeFrame);
    runHooks(this, "beforeDestroy");
    for (const cleanup of this.cleanups) cleanup();
    this.observer?.disconnect();
    this.intersection?.disconnect();
    this.mutations.disconnect();
    this.listeners.clear();
    instances.delete(this.root);
    runHooks(this, "destroy");
    this.driver.destroy();
    // Plugins detach after core cleanup. One failing plugin cannot strand another.
    const errors = [];
    for (const callback of destroyCallbacks) {
      try { callback(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Amber plugin cleanup failed.');
  }
}
