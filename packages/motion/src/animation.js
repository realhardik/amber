import { FrameRunner } from './scheduler.js';
import { clamp, easings, finite } from './easing.js';
import { createTracks } from './tracks.js';
import { pauseBindings } from './reset.js';

/** DOM animation engine. State lives on the animation, never on the DOM element. */
export class Animation {
  constructor(options = {}, createTrack = createTracks) {
    const input = options.targets ?? options.el;
    const root = options.root ?? globalThis.document;
    this.elements = typeof input === 'string' ? [...root.querySelectorAll(input)] : input?.nodeType === 1 ? [input] : Array.from(input ?? []);
    this.elements = [...new Set(this.elements)];
    if (!this.elements.length || this.elements.some(el => !el?.style)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Animation needs at least one element.' : "Amber M001");
    this.window = this.elements[0].ownerDocument?.defaultView ?? globalThis.window;
    this.duration = finite(options.duration ?? options.d ?? 400, 'Duration', 0);
    this.delay = finite(options.delay ?? options.id ?? 0, 'Delay', 0);
    this.stagger = finite(options.stagger ?? options.de ?? 0, 'Stagger', 0);
    this.span = finite(this.duration + this.stagger * (this.elements.length - 1), 'Animation span', 0);
    this.total = finite(this.delay + this.span, 'Total duration', 0);
    const easing = options.easing ?? options.ef ?? 'lin';
    this.ease = typeof easing === 'function' ? easing : easings[easing];
    if (!this.ease) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Unknown easing: ${easing}` : "Amber M002");
    this.cb = options.onComplete ?? options.cb;
    this.onUpdate = options.onUpdate;
    for (const cb of [this.cb, this.onUpdate]) if (cb !== undefined && typeof cb !== 'function') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Callbacks must be functions.' : "Amber M003");
    this.respectReducedMotion = options.respectReducedMotion !== false;
    this.direction = options.reverse ?? options.r ? -1 : 1;
    this.playbackRate = finite(options.playbackRate ?? 1, 'Playback rate', Number.MIN_VALUE);
    this.time = this.direction === 1 ? 0 : this.total;
    this.zeroProgress = this.direction === 1 ? 0 : 1;
    this.status = 'idle';
    this.version = 0;
    this.lastElapsed = 0;
    this.destroyListeners = new Set();
    this.tracks = this.elements.map((el, i) => createTrack(el, options, i));
    this.raf = new FrameRunner(elapsed => {
      try { this.tick(elapsed); } catch (error) { this.pause(); throw error; }
    }, { scheduler: options.scheduler, window: this.window });
    this.media = null;
    this.mediaChange = () => { if (this.media?.matches && this.status === 'running') this.finish(); };
    this.render(false);
  }
  get progress() { return this.span ? clamp((this.time - this.delay) / this.span) : this.zeroProgress; }
  get isPlaying() { return this.status === 'running'; }
  get destroyed() { return this.status === 'destroyed'; }
  render(notify = true) {
    const local = this.time - this.delay;
    for (let i = 0; i < this.tracks.length; i++) {
      const elapsed = local - i * this.stagger;
      const p = !this.span ? this.zeroProgress : this.duration ? clamp(elapsed / this.duration) : elapsed >= 0 ? 1 : 0;
      // Exact endpoints are preserved even for custom easing functions.
      const eased = p === 0 || p === 1 ? p : finite(this.ease(p), 'Easing result');
      this.tracks[i].render(eased);
    }
    if (notify) this.onUpdate?.(this.progress, this);
  }
  listenMedia() {
    if (this.respectReducedMotion && !this.media && this.window?.matchMedia) {
      this.media = this.window.matchMedia('(prefers-reduced-motion: reduce)');
      this.media.addEventListener('change', this.mediaChange);
    }
  }
  unlistenMedia() {
    this.media?.removeEventListener('change', this.mediaChange);
    this.media = null;
  }
  play(options = {}) {
    if (this.destroyed) return this;
    const reverse = options.rev ?? options.reverse ?? options.r ?? (this.status === 'idle' && this.direction === -1);
    if (typeof reverse !== 'boolean') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'play().rev must be a boolean.' : "Amber M004");
    if (this.direction !== (reverse ? -1 : 1)) this.version++;
    this.direction = reverse ? -1 : 1;
    if (this.isPlaying) return this;
    if (this.status === 'finished') {
      this.time = this.direction === 1 ? 0 : this.total;
      this.zeroProgress = this.direction === 1 ? 0 : 1;
    }
    this.status = 'running';
    this.version++;
    this.lastElapsed = 0;
    this.listenMedia();
    if (!this.total || this.media?.matches) return this.finish();
    this.raf.run();
    return this;
  }
  tick(elapsed) {
    if (!this.isPlaying) return;
    const delta = Math.max(0, elapsed - this.lastElapsed);
    this.lastElapsed = elapsed;
    this.time = Math.max(0, Math.min(this.total, this.time + delta * this.direction * this.playbackRate));
    const complete = this.direction === 1 ? this.time >= this.total : this.time <= 0;
    if (complete && !this.span) this.zeroProgress = this.direction === 1 ? 1 : 0;
    const version = this.version;
    this.render();
    if (complete && this.isPlaying && version === this.version) this.complete();
  }
  complete() {
    this.raf.pause();
    this.unlistenMedia();
    this.status = 'finished';
    this.cb?.(this);
  }
  pause() {
    if (this.destroyed) return this;
    this.version++;
    this.raf.pause();
    this.unlistenMedia();
    if (this.status !== 'finished') this.status = 'paused';
    return this;
  }
  reverse() {
    if (this.destroyed) return this;
    this.direction *= -1;
    this.version++;
    // Preserve the current playhead, including when reversing from a finished end.
    if (this.status === 'finished') this.status = 'paused';
    return this.play({ rev: this.direction === -1 });
  }
  restart() {
    if (this.destroyed) return this;
    const rev = this.direction === -1;
    this.pause();
    this.time = this.direction === 1 ? 0 : this.total;
    this.zeroProgress = this.direction === 1 ? 0 : 1;
    this.render(false);
    return this.play({ rev });
  }
  reset() {
    if (this.destroyed) return this;
    pauseBindings(this);
    this.pause();
    this.status = 'paused';
    this.direction = 1;
    this.time = this.zeroProgress = this.lastElapsed = 0;
    // Force every track to its start, including zero-duration staggered tracks.
    // Reset deliberately emits neither update nor completion callbacks.
    for (const track of this.tracks) track.render(0);
    return this;
  }
  seek(progress) {
    if (this.destroyed) return this;
    finite(progress, 'Progress');
    this.pause();
    this.status = 'paused';
    this.time = this.delay + clamp(progress) * this.span;
    this.zeroProgress = clamp(progress);
    this.render();
    return this;
  }
  finish() {
    if (this.destroyed || this.status === 'finished') return this;
    this.pause();
    this.time = this.direction === 1 ? this.total : 0;
    this.zeroProgress = this.direction === 1 ? 1 : 0;
    const version = this.version;
    this.render();
    if (!this.destroyed && version === this.version) this.complete();
    return this;
  }
  setPlaybackRate(rate) { this.playbackRate = finite(rate, 'Playback rate', Number.MIN_VALUE); return this; }
  onDestroy(callback) {
    if (this.destroyed) { callback(); return () => {}; }
    this.destroyListeners.add(callback);
    return () => this.destroyListeners.delete(callback);
  }
  destroy({ revert = true } = {}) {
    if (this.destroyed) return;
    this.pause();
    this.status = 'destroyed';
    this.raf.destroy();
    if (revert) for (const track of this.tracks) track.restore();
    for (const listener of [...this.destroyListeners]) listener();
    this.destroyListeners.clear();
  }
}

export const animate = options => new Animation(options);
