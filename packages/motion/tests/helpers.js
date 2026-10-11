import { Scheduler } from '../src/index.js';

export function environment() {
  let id = 0;
  const frames = new Map(), visibility = new Set(), mediaListeners = new Set();
  const document = {
    hidden: false,
    addEventListener(type, cb) { visibility.add(cb); },
    removeEventListener(type, cb) { visibility.delete(cb); },
  };
  const media = {
    matches: false,
    addEventListener(type, cb) { mediaListeners.add(cb); },
    removeEventListener(type, cb) { mediaListeners.delete(cb); },
  };
  const errors = [];
  const window = {
    document,
    requestAnimationFrame(cb) { frames.set(++id, cb); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    matchMedia() { return media; },
    reportError(error) { errors.push(error); },
  };
  document.defaultView = window;
  return {
    window, document, frames, visibility, mediaListeners, errors,
    scheduler: new Scheduler(window),
    frame(time) { const pending = [...frames.values()]; frames.clear(); for (const cb of pending) cb(time); },
    hide(value) { document.hidden = value; for (const cb of [...visibility]) cb(); },
    reduce(value) { media.matches = value; for (const cb of [...mediaListeners]) cb(); },
  };
}

export function element(env, initial = {}) {
  const styles = new Map(Object.entries(initial)), priorities = new Map(), attrs = new Map();
  let writes = 0;
  return {
    nodeType: 1, ownerDocument: env.document,
    style: {
      getPropertyValue: key => styles.get(key) ?? '',
      getPropertyPriority: key => priorities.get(key) ?? '',
      setProperty(key, value, priority = '') { styles.set(key, String(value)); priorities.set(key, priority); writes++; },
      removeProperty(key) { styles.delete(key); },
    },
    getAttribute: key => attrs.get(key) ?? null,
    setAttribute: (key, value) => attrs.set(key, value),
    removeAttribute: key => attrs.delete(key),
    getTotalLength: () => 100,
    get writes() { return writes; },
  };
}

export function amberMock() {
  const events = new Map();
  return {
    state: { progress: 0, position: 0, wrappedPosition: 0, velocity: 0, limit: 1000 },
    isDestroyed: false,
    on(type, callback) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(callback); return () => events.get(type).delete(callback); },
    emit(type) { for (const callback of [...(events.get(type) ?? [])]) callback(this.state); },
    destroy() { this.isDestroyed = true; this.emit('destroy'); },
    get listenerCount() { return [...events.values()].reduce((count, listeners) => count + listeners.size, 0); },
  };
}
