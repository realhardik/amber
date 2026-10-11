import { PanelRenderer } from '../panel-renderer.js';
import { PlaneRenderer } from '../plane-renderer.js';
import { overrideStyle, hideScrollbar } from '../renderers.js';
import { wrap } from '../motion.js';
import { featureModule } from '../modules.js';

// Native scrolling supplies movement; only the recycling offsets change at seams.
// A bounded runway allows bidirectional browser gestures without reaching an edge.
function nativeLoop(Renderer) {
  return class extends Renderer {
    constructor(wrapper, content, orientation, loop, options = {}) {
      super(wrapper, content, orientation, loop);
      this.nativeLoop = true;
      this.physical = { x: 0, y: 0 };
      this.nativeOffsetVector = this.physical;
      if (options.hideScrollbar) hideScrollbar(this);
      this.restore.push(overrideStyle(this.element, { overflow: 'auto', 'overflow-anchor': 'none' }));
      if (this.window.getComputedStyle(this.element).position === 'static') {
        this.restore.push(overrideStyle(this.element, { position: 'relative' }));
      }
      this.spacer = this.document.createElement('div');
      this.spacer.setAttribute('data-amber-avoid', '');
      this.spacer.setAttribute('aria-hidden', 'true');
      this.spacer.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;visibility:hidden;';
      (this.isWindow ? this.document.body : wrapper).append(this.spacer);
      this.refreshViewport();
      this.refresh();
    }
    refresh() {
      if (this.spacer) this.spacer.style.display = 'none';
      super.refresh();
      if (!this.spacer) return;
      this.spacer.style.display = this.isInfinite ? 'block' : 'none';
      this.spacer.style.width = (this.infiniteAxes.x ? Math.ceil(this.cycles.x) * 4 + this.viewport.width : 1) + 'px';
      this.spacer.style.height = (this.infiniteAxes.y ? Math.ceil(this.cycles.y) * 4 + this.viewport.height : 1) + 'px';
    }
    resetNative() { if (!this.nativeLoop) super.resetNative(); }
    writeVector(position) {
      if (!this.nativeLoop) return super.writeVector(position);
      const x = this.infiniteAxes.x ? Math.ceil(this.cycles.x) + wrap(position.x, this.cycles.x) : position.x;
      const y = this.infiniteAxes.y ? Math.ceil(this.cycles.y) + wrap(position.y, this.cycles.y) : position.y;
      this.element.scrollTo({ left: x, top: y, behavior: 'instant' });
      this.physical.x = this.element.scrollLeft; this.physical.y = this.element.scrollTop;
      return super.writeVector(position);
    }
    destroy() {
      this.spacer?.remove();
      super.destroy();
    }
  };
}

const NativePanels = nativeLoop(PanelRenderer), NativePlane = nativeLoop(PlaneRenderer);
export const infinite = Object.freeze({
  [featureModule]: true,
  name: 'infinite',
  order: 0,
  install() {},
  createNative(wrapper, content, options) {
    if (options.orientation === 'both') return new NativePlane(wrapper, content, options.orientation, options.infinite, options);
    const loop = typeof options.infinite === 'object' ? !!options.infinite[options.orientation === 'horizontal' ? 'x' : 'y'] : options.infinite;
    return new NativePanels(wrapper, content, options.orientation, loop, options);
  },
});
export default infinite;
