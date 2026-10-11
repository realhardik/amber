/** Page visibility subscriptions. No browser globals are accessed at import time. */
export class Tab {
  constructor(document = globalThis.document) {
    if (!document?.addEventListener) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Tab requires a document.' : "Amber M008");
    this.document = document;
    this.hidden = document.hidden;
    this.listeners = new Set();
    this.change = () => {
      this.hidden = document.hidden;
      for (const listener of [...this.listeners]) listener(this.hidden);
    };
    document.addEventListener('visibilitychange', this.change);
  }
  add(listener) {
    if (typeof listener !== 'function') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Tab.add expects a function.' : "Amber M009");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  destroy() {
    this.document.removeEventListener('visibilitychange', this.change);
    this.listeners.clear();
  }
}

/** Shared on-demand scheduler. Injectable environment supports deterministic tests. */
export class Scheduler {
  constructor(window = globalThis.window) {
    if (!window?.requestAnimationFrame) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Scheduler requires a browser window.' : "Amber M010");
    this.window = window;
    this.runners = new Set();
    this.frame = null;
    this.tab = null;
    this.tick = time => {
      this.frame = null;
      // A snapshot prevents newly started runners running twice in the same frame.
      for (const runner of [...this.runners]) {
        if (!this.runners.has(runner)) continue;
        try { runner.tick(time); }
        catch (error) {
          runner.pause();
          if (this.window.reportError) this.window.reportError(error);
          else this.window.setTimeout(() => { throw error; }, 0);
        }
      }
      this.wake();
    };
  }
  add(runner) {
    this.runners.add(runner);
    if (!this.tab) {
      this.tab = new Tab(this.window.document);
      this.tab.add(hidden => {
        for (const current of this.runners) current.lastTime = null;
        if (hidden) this.cancel();
        else this.wake();
      });
    }
    this.wake();
  }
  remove(runner) {
    this.runners.delete(runner);
    if (!this.runners.size) {
      this.cancel();
      this.tab?.destroy();
      this.tab = null;
    }
  }
  cancel() {
    if (this.frame !== null) this.window.cancelAnimationFrame(this.frame);
    this.frame = null;
  }
  wake() {
    if (this.runners.size && !this.window.document.hidden && this.frame === null) {
      this.frame = this.window.requestAnimationFrame(this.tick);
    }
  }
  destroy() {
    for (const runner of [...this.runners]) runner.pause();
    this.cancel();
  }
}

const schedulers = new WeakMap();
function shared(window = globalThis.window) {
  if (!window) throw new Error((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Start animations in a browser, or supply a scheduler.' : "Amber M011");
  if (!schedulers.has(window)) schedulers.set(window, new Scheduler(window));
  return schedulers.get(window);
}

/** Managed frame runner: tracks elapsed active milliseconds and coordinates with the scheduler. */
export class FrameRunner {
  constructor(callback, { scheduler, window } = {}) {
    if (typeof callback !== 'function') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'FrameRunner expects a callback.' : "Amber M012");
    this.callback = callback;
    this.scheduler = scheduler;
    this.window = window;
    this.elapsed = 0;
    this.lastTime = null;
    this.on = false;
    this.args = [];
    this.destroyed = false;
  }
  run(...args) {
    if (this.destroyed || this.on) return this;
    this.elapsed = 0;
    this.args = args;
    this.scheduler ??= shared(this.window);
    this.lastTime = null;
    this.on = true;
    this.scheduler.add(this);
    return this;
  }
  tick(time) {
    const delta = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    this.elapsed += delta;
    this.callback(this.elapsed, ...this.args);
  }
  pause() {
    this.on = false;
    this.lastTime = null;
    this.scheduler?.remove(this);
    return this;
  }
  stop() { return this.pause(); }
  destroy() { this.pause(); this.destroyed = true; }
}
