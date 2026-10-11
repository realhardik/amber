import { overrideStyle } from './renderers.js';
import { TransformRenderer } from './transform-renderer.js';
import { wrap } from './motion.js';

/** Two-dimensional surface renderer; uses the same Motion integrator as panels. */
export class PlaneRenderer extends TransformRenderer {
  constructor(wrapper, content, orientation, infinite = false) {
    super(wrapper, content, orientation, infinite);
    this.tiles = [];
    this.refresh();
    this.writeVector(this.vector);
  }
  refresh() {
    for (const tile of this.tiles) tile.restore();
    this.tiles = [];
    this.content.style.transform = 'none';
    const origin = this.content.getBoundingClientRect(), style = this.window.getComputedStyle(this.content);
    this.origin = { x: origin.left - this.bounds.left + this.element.scrollLeft, y: origin.top - this.bounds.top + this.element.scrollTop };
    this.contentOffset = this.origin.y;
    let width = origin.width, height = origin.height, largestX = 0, largestY = 0;
    for (const element of this.content.children) {
      if (element.hasAttribute('data-amber-avoid')) continue;
      const rect = element.getBoundingClientRect();
      const x = rect.left - origin.left, y = rect.top - origin.top;
      width = Math.max(width, x + rect.width);
      height = Math.max(height, y + rect.height);
      largestX = Math.max(largestX, rect.width); largestY = Math.max(largestY, rect.height);
      const transform = this.window.getComputedStyle(element).transform;
      this.tiles.push({ element, x, y, start: y, extent: rect.height, occurrence: 0, width: rect.width, height: rect.height,
        transform: transform === 'none' ? '' : transform, shiftX: NaN, shiftY: NaN, isVisible: null,
        restore: overrideStyle(element, { transform: element.style.transform, transition: 'none' }) });
    }
    this.finiteLimits.x = Math.max(0, this.origin.x + width - this.viewport.width);
    this.finiteLimits.y = Math.max(0, this.origin.y + height - this.viewport.height);
    this.cycles.x = width + (parseFloat(style.columnGap) || 0);
    this.cycles.y = height + (parseFloat(style.rowGap) || 0);
    const requested = axis => !!(typeof this.infiniteRequested === 'object' ? this.infiniteRequested[axis] : this.infiniteRequested);
    this.infiniteAxes.x = requested('x') && largestX > 0 && this.cycles.x >= this.viewport.width + largestX;
    this.infiniteAxes.y = requested('y') && largestY > 0 && this.cycles.y >= this.viewport.height + largestY;
  }
  writeVector(position) {
    this.vector.x = position.x; this.vector.y = position.y;
    const x = this.infiniteAxes.x ? wrap(position.x, this.cycles.x) : position.x;
    const y = this.infiniteAxes.y ? wrap(position.y, this.cycles.y) : position.y;
    const tx = (this.nativeOffsetVector?.x ?? 0) - x, ty = (this.nativeOffsetVector?.y ?? 0) - y;
    for (const tile of this.tiles) {
      const sx = this.infiniteAxes.x ? (Math.floor((x - this.origin.x - tile.x - tile.width) / this.cycles.x) + 1) * this.cycles.x : 0;
      const sy = this.infiniteAxes.y ? (Math.floor((y - this.origin.y - tile.y - tile.height) / this.cycles.y) + 1) * this.cycles.y : 0;
      tile.occurrence = this.infiniteAxes.y ? sy / this.cycles.y : 0;
      const vx = this.origin.x + tile.x + sx - x, vy = this.origin.y + tile.y + sy - y;
      const vis = vx <= this.viewport.width && vx + tile.width >= 0 && vy <= this.viewport.height && vy + tile.height >= 0;
      if ((tile.hasParallax || !tile.width || !tile.height || vis || tile.isVisible !== false) && (sx + tx !== tile.shiftX || sy + ty !== tile.shiftY)) {
        tile.element.style.transform = `translate3d(${tile.shiftX = sx + tx}px, ${tile.shiftY = sy + ty}px, 0) ${tile.transform}`;
      }
      tile.isVisible = vis;
    }
    this.actual.x = position.x; this.actual.y = position.y;
    return this.actual;
  }
  destroy() {
    for (const tile of this.tiles) tile.restore();
    super.destroy();
  }
}
