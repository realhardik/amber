import { Animation } from './animation.js';

/** Sequential timeline; supports animation options and synchronous callbacks. */
export class Timeline {
  constructor({ onComplete } = {}, AnimationClass = Animation) {
    this.queue = [];
    this.index = 0;
    this.status = 'idle';
    this.onComplete = onComplete;
    this.AnimationClass = AnimationClass;
    this.current = null;
    this.animations = [];
    this.generation = 0;
  }
  from(step) { if (this.status !== 'destroyed') this.queue.push(step); return this; }
  play(callback) {
    if (this.status === 'destroyed') return this;
    if (this.status === 'paused') {
      if (callback !== undefined) this.callback = callback;
      this.status = 'running';
      if (this.current) this.current.play({ rev: this.current.direction === -1 });
      else this.next();
      return this;
    }
    if (this.status === 'running') return this;
    return this.restart(callback);
  }
  restart(callback = this.onComplete) {
    if (this.status === 'destroyed') return this;
    for (const animation of [...this.animations].reverse()) animation.destroy();
    this.animations = [];
    this.current = null;
    this.generation++;
    this.index = 0;
    this.callback = callback;
    this.status = 'running';
    this.next();
    return this;
  }
  next() {
    if (this.advancing) return;
    this.advancing = true;
    try {
      while (this.status === 'running' && !this.current) {
        if (this.index >= this.queue.length) {
          this.status = 'finished';
          this.callback?.(this);
          // A completion callback can restart; advance that run in this loop.
          continue;
        }
        const step = this.queue[this.index++];
        if (typeof step === 'function') { step(); continue; }
        const generation = this.generation;
        const original = step.onComplete ?? step.cb;
        const animation = new this.AnimationClass({ ...step, onComplete: current => {
          if (generation !== this.generation || this.status === 'destroyed') return;
          this.current = null;
          original?.(current);
          this.next();
        } });
        this.animations.push(animation);
        this.current = animation;
        animation.play();
      }
    } catch (error) { this.pause(); throw error; }
    finally { this.advancing = false; }
  }
  pause() {
    if (this.status === 'running') { this.status = 'paused'; this.current?.pause(); }
    return this;
  }
  destroy({ revert = true } = {}) {
    this.status = 'destroyed';
    this.generation++;
    for (const animation of [...this.animations].reverse()) animation.destroy({ revert });
    this.animations = [];
    this.current = null;
  }
}
