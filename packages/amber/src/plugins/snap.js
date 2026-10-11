import { clamp } from '../motion.js';
import { featureModule, addHooks } from '../modules.js';

class Snap {
  constructor(amber) {
    this.amber = amber;
    this.timer = null;
    this.pending = false;
    this.snapping = false;
  }

  cancel() {
    this.timer && this.amber.window.clearTimeout(this.timer);
    this.timer = null;
    this.pending = this.snapping = false;
  }

  queue() {
    if (!this.amber.options.snap || this.amber.isStopped || this.amber.isDestroyed) return;
    this.timer && this.amber.window.clearTimeout(this.timer);
    this.pending = false;
    this.timer = this.amber.window.setTimeout(() => {
      this.timer = null;
      this.pending = true;
      !this.amber.isScrolling && this.settle();
    }, 160);
  }

  settle() {
    if (!this.pending || this.amber.touch.id !== null || this.amber.isStopped || this.amber.isDestroyed) return false;
    this.pending = false;
    const amber = this.amber, driver = amber.driver, next = { ...amber.motion.positionVector };
    for (const axis of amber.motion.axes) {
      const size = driver.viewport[axis === 'x' ? 'width' : 'height'];
      const position = amber.motion.positionVector[axis], limit = amber.motion.limitVector[axis];
      let nearest = position;
      let distance = amber.options.snap === 'mandatory' ? Infinity : amber.options.snapDistance ?? Math.min(100, size * .2);
      for (const element of driver.content.children) {
        if (element.hasAttribute('data-amber-avoid')) continue;
        // Culled 1D panels retain old DOM transforms; use their measured geometry.
        const panel = !driver.isMultiAxis && driver.items?.find(item => item.element === element);
        const extent = panel ? panel.extent : element.getBoundingClientRect()[axis === 'x' ? 'width' : 'height'];
        if (!extent) continue;
        const start = panel ? panel.start + driver.contentOffset : driver.destinationVector(element)[axis];
        // Oversized panels have both a leading and a trailing snap edge.
        for (let point of [start, ...(extent > size ? [start + extent - size] : [])]) {
          point = amber.motion.infiniteAxes[axis] ? point + Math.round((position - point) / limit) * limit : clamp(point, 0, limit);
          const gap = Math.abs(point - position);
          if (gap <= distance) { distance = gap; nearest = point; }
        }
      }
      // 1D snapping applies a subpixel tolerance threshold; 2D snapping uses exact coordinates.
      if (driver.isMultiAxis || distance >= .01) next[axis] = nearest;
    }
    if (next.x === amber.motion.positionVector.x && next.y === amber.motion.positionVector.y) return false;
    this.snapping = true;
    amber.moveTo(next);
    return true;
  }

  destroy() { this.cancel(); }
}

export const snap = Object.freeze({
  [featureModule]: true,
  name: 'snap',
  order: 30,
  normalize(options) {
    if (options.snapDistance !== undefined && (!Number.isFinite(options.snapDistance) || options.snapDistance < 0)) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: snapDistance must be a finite, nonnegative number of pixels.' : "Amber A057");
    }
    if (![false, 'proximity', 'mandatory'].includes(options.snap)) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: snap must be false, proximity, or mandatory.' : "Amber A058");
    }
  },
  install(amber) {
    if (!amber.options.snap) return;
    const controller = amber.snap = new Snap(amber);
    addHooks(amber, {
      beforeInput() { if (controller.snapping) amber.cancelAnimation(); },
      cancel() { controller.cancel(); },
      input() { controller.queue(); },
      settle(native) {
        if (native) controller.pending = true;
        else controller.snapping = false;
        return controller.settle();
      },
      beforeDestroy() { controller.destroy(); },
    });
  },
});

export default snap;
