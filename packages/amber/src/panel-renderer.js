import { wrap } from "./motion.js";
import { overrideStyle } from "./renderers.js";
import { TransformRenderer } from "./transform-renderer.js";

/** Recycles panels only after they leave the viewport without cloned DOM or reordered nodes. */
export class PanelRenderer extends TransformRenderer {
  constructor(wrapper, content, orientation, infinite = false) {
    super(wrapper, content, orientation, infinite);
    this.items = [];
    this.refresh();
    this.writeVector(this.vector);
  }

  refresh() {
    const children = Array.from(this.content.children).filter(element => !element.hasAttribute("data-amber-avoid"));
    const current = new Set(children);
    const previous = new Map(this.items.map(item => [item.element, item]));
    for (const item of this.items) !current.has(item.element) && item.restore();
    this.items = children.map(element => {
      if (previous.has(element)) return previous.get(element);
      const transform = this.window.getComputedStyle(element).transform;
      const restore = overrideStyle(element, { transform: "none", transition: "none" });
      return {
        element,
        transform: "none" === transform ? "" : transform,
        restore,
        start: 0,
        extent: 0,
        shift: NaN,
        isVisible: null,
      };
    });

    for (const item of this.items) { item.element.style.transform = "none"; item.shift = NaN; item.isVisible = null; }
    const origin = this.content.getBoundingClientRect();
    const contentStyle = this.window.getComputedStyle(this.content);
    const edge = this.isHorizontal ? "left" : "top";
    const dimension = this.isHorizontal ? "width" : "height";
    this.contentOffset = origin[edge] - this.bounds[edge] + this.element[this.property];
    let length = origin[dimension];
    const gap = parseFloat(contentStyle[this.isHorizontal ? "columnGap" : "rowGap"]) || 0;
    const trailing = (parseFloat(contentStyle[this.isHorizontal ? "paddingRight" : "paddingBottom"]) || 0) + (parseFloat(contentStyle[this.isHorizontal ? "borderRightWidth" : "borderBottomWidth"]) || 0);
    let previousEnd = -Infinity;
    let largest = 0;
    let inOneTrack = true;
    for (const item of this.items) {
      const rect = item.element.getBoundingClientRect();
      item.start = rect[edge] - origin[edge];
      item.extent = rect[dimension];
      if (!rect[dimension]) continue;
      inOneTrack &&= item.start >= previousEnd - 0.1;
      previousEnd = item.start + item.extent;
      largest = Math.max(largest, item.extent);
      // Rects retain subpixels; scrollWidth rounds them and would introduce a seam at each lap.
      const margin = parseFloat(this.window.getComputedStyle(item.element)[this.isHorizontal ? "marginRight" : "marginBottom"]) || 0;
      length = Math.max(length, previousEnd + margin + trailing);
    }
    this.cycles[this.axis] = length + gap; // Repeat the track's gap between its last and first panels too.
    this.finiteLimits[this.axis] = Math.max(0, this.contentOffset + length - this.viewportSize);
    // A panel must fit offscreen before recycling. Otherwise the same node would be needed twice.
    this.infiniteAxes[this.axis] = this.infiniteRequested && inOneTrack && largest > 0 && this.viewportSize > 0
      && this.cycleLength >= this.viewportSize + largest;
  }

  writeVector(vector) {
    const position = this.vector[this.axis] = vector[this.axis];
    const phase = this.isInfinite ? wrap(position, this.cycleLength) : position;
    const viewport = this.viewportSize;
    for (const item of this.items) {
      const cycles = this.isInfinite ? Math.floor((phase - this.contentOffset - item.start - item.extent) / this.cycleLength) + 1 : 0;
      const virtualShift = cycles * this.cycleLength - phase;
      const shift = virtualShift + (this.nativeOffsetVector?.[this.axis] ?? 0);
      const visualStart = this.contentOffset + item.start + virtualShift + (item.pinOffset ?? 0);
      const isVisible = visualStart <= viewport && visualStart + item.extent >= 0;
      item.visualStart = visualStart;
      item.occurrence = cycles;

      if ((item.hasPin || item.hasParallax || item.extent === 0 || isVisible || item.isVisible !== false) && shift !== item.shift) {
        item.element.style.transform = `translate3d(${this.isHorizontal ? shift : 0}px, ${this.isHorizontal ? 0 : shift}px, 0) ${item.transform}`;
        item.shift = shift;
      }
      item.isVisible = isVisible;
    }
    this.actual[this.axis] = position;
    return this.actual;
  }

  destroy() {
    for (const item of this.items) item.restore();
    super.destroy();
  }
}
