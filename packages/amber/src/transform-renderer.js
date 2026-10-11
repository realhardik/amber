import { BaseRenderer, overrideStyle } from './renderers.js';
import { wrap } from './motion.js';

/** Shared vector position, bounds and native offsets for virtual renderers. */
export class TransformRenderer extends BaseRenderer {
  constructor(wrapper, content, orientation, infinite = false) {
    super(wrapper, content, orientation);
    this.vector = { x: 0, y: 0 };
    for (const axis of this.axes) this.vector[axis] = this.element[axis === 'x' ? 'scrollLeft' : 'scrollTop'];
    this.infiniteRequested = infinite;
    this.infiniteAxes = { x: false, y: false };
    this.cycles = { x: 0, y: 0 };
    this.finiteLimits = { x: 0, y: 0 };
    this.restore.push(overrideStyle(this.element, { overflow: 'hidden' }),
      overrideStyle(content, { transform: 'none', transition: 'none', overflow: 'visible' }));
    this.resetNative();
  }
  get isInfinite() { return this.infiniteAxes.x || this.infiniteAxes.y; }
  get cycleLength() { return this.cycles[this.axis]; }
  get finiteLimit() { return this.finiteLimits[this.axis]; }
  get limits() { return { x: this.infiniteAxes.x ? this.cycles.x : this.finiteLimits.x, y: this.infiniteAxes.y ? this.cycles.y : this.finiteLimits.y }; }
  readVector(out = this.actual) {
    out.x = out.y = 0;
    for (const axis of this.axes) out[axis] = this.vector[axis]
      + this.element[axis === 'x' ? 'scrollLeft' : 'scrollTop'] - (this.nativeOffsetVector?.[axis] ?? 0);
    return out;
  }
  resetNative() {
    for (const axis of this.axes) this.element[axis === 'x' ? 'scrollLeft' : 'scrollTop'] = 0;
  }
  destinationVector(element) {
    const item = (this.items ?? this.tiles).find(record => record.element === element || record.element.contains(element));
    const result = { x: 0, y: 0 };
    // Subtract the host rect so stale transforms on culled panels/tiles cancel.
    // Both axes share the same DOM reads.
    const rect = item?.element === element ? null : element.getBoundingClientRect();
    const host = rect && (item ? item.element.getBoundingClientRect() : this.bounds);
    const current = !item && (this.isMultiAxis ? this.vector : this.readVector());
    for (const axis of this.axes) {
      const edge = axis === 'x' ? 'left' : 'top';
      const position = item
        ? (this.origin?.[axis] ?? this.contentOffset) + (item[axis] ?? item.start) + (rect ? rect[edge] - host[edge] : 0)
        : current[axis] + rect[edge] - host[edge];
      const cycle = this.cycles[axis];
      result[axis] = this.infiniteAxes[axis] ? position + Math.round((this.vector[axis] - position) / cycle) * cycle : position;
    }
    return result;
  }
  destroy() {
    super.destroy();
    const position = { behavior: 'instant' };
    for (const axis of this.axes) position[axis === 'x' ? 'left' : 'top'] =
      this.infiniteAxes[axis] ? wrap(this.vector[axis], this.cycles[axis]) : this.vector[axis];
    this.element.scrollTo(position);
  }
}
