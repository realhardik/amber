import { axesFor } from './motion.js';

export function overrideStyle(element, values) {
  const saved = Object.entries(values).map(([property, value]) => {
    const old = [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)];
    element.style.setProperty(property, value);
    return old;
  });
  return () => {
    for (const [property, value, priority] of saved) {
      value ? element.style.setProperty(property, value, priority) : element.style.removeProperty(property);
    }
  };
}

export class BaseRenderer {
  constructor(wrapper, content, orientation) {
    this.wrapper = wrapper;
    this.isWindow = wrapper === wrapper.window;
    this.document = this.isWindow ? wrapper.document : wrapper.ownerDocument;
    this.window = this.document.defaultView;
    this.element = this.isWindow ? this.document.scrollingElement : wrapper;
    this.content = content;
    this.isHorizontal = orientation === "horizontal";
    this.isMultiAxis = orientation === 'both';
    this.axis = this.isHorizontal ? 'x' : 'y';
    this.axes = axesFor(orientation);
    this.actual = { x: 0, y: 0 };
    this.property = this.isHorizontal ? "scrollLeft" : "scrollTop";
    this.restore = [];
    this.restore.push(overrideStyle(this.element, { "scroll-behavior": "auto", "scroll-snap-type": "none" }));
    this.refreshViewport();
  }

  refreshViewport() {
    const element = this.isWindow ? this.document.documentElement : this.element;
    this.size = { width: element.clientWidth, height: element.clientHeight };
  }

  get viewport() { return this.size; }
  get viewportSize() { return this.viewport[this.isHorizontal ? "width" : "height"]; }
  get limit() { return this.limits[this.axis]; }
  read() { return this.readVector()[this.axis]; }
  write(position) { return this.writeVector({ ...this.readVector(), [this.axis]: position })[this.axis]; }
  destination(element) { return this.destinationVector(element)[this.axis]; }

  get bounds() {
    if (this.isWindow) return { top: 0, left: 0, right: this.viewport.width, bottom: this.viewport.height };
    const rect = this.element.getBoundingClientRect();
    const left = rect.left + this.element.clientLeft;
    const top = rect.top + this.element.clientTop;
    return { left, top, right: left + this.element.clientWidth, bottom: top + this.element.clientHeight };
  }

  destinationVector(element) {
    const rect = element.getBoundingClientRect(), bounds = this.bounds;
    const position = { ...this.readVector() };
    for (const axis of this.axes) {
      const edge = axis === 'x' ? 'left' : 'top';
      position[axis] += rect[edge] - bounds[edge];
    }
    return position;
  }

  destroy() { for (const restore of this.restore.reverse()) restore(); }
}

export function setupHideScrollbar(doc, includePage = true) {
  if (!doc?.head) return () => {};
  const style = doc.createElement("style");
  style.setAttribute("data-amber-hide-scrollbar", "");
  const selectors = includePage ? ['html', 'body', '[data-amber-hide-scrollbar]'] : ['[data-amber-hide-scrollbar]'];
  style.textContent = `${selectors.join(',')}{scrollbar-width:none;-ms-overflow-style:none;}${selectors.map(selector => `${selector}::-webkit-scrollbar`).join(',')}{display:none;width:0;height:0;}`;
  doc.head.appendChild(style);
  return () => { style.remove(); };
}

export function hideScrollbar({ document, element, isWindow, restore }) {
  restore.push(setupHideScrollbar(document, isWindow));
  if (!isWindow) {
    restore.push(overrideStyle(element, { 'scrollbar-width': 'none', '-ms-overflow-style': 'none' }));
    if (!element.hasAttribute?.('data-amber-hide-scrollbar') && element.setAttribute) {
      element.setAttribute('data-amber-hide-scrollbar', '');
      restore.push(() => element.removeAttribute?.('data-amber-hide-scrollbar'));
    }
  }
}

/** Actual browser scroll positions: scrollbar, native anchors, and focus remain available. */
export class NativeRenderer extends BaseRenderer {
  constructor(wrapper, content, orientation, options = {}) {
    super(wrapper, content, orientation);
    if (options.hideScrollbar) hideScrollbar(this);
  }
  get limits() {
    return {
      x: this.isHorizontal || this.isMultiAxis ? Math.max(0, this.element.scrollWidth - this.viewport.width) : 0,
      y: !this.isHorizontal ? Math.max(0, this.element.scrollHeight - this.viewport.height) : 0,
    };
  }
  readVector(out = this.actual) {
    out.x = this.isHorizontal || this.isMultiAxis ? this.element.scrollLeft : 0;
    out.y = !this.isHorizontal ? this.element.scrollTop : 0;
    return out;
  }
  writeVector(position) {
    this.element.scrollTo({
      left: this.isHorizontal || this.isMultiAxis ? position.x : this.element.scrollLeft,
      top: !this.isHorizontal ? position.y : this.element.scrollTop,
      behavior: 'instant',
    });
    return this.readVector();
  }
}
