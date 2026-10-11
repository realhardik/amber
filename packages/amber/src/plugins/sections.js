import { clamp } from '../motion.js';
import { featureModule, addHooks } from '../modules.js';

class Sections {
  constructor(amber) {
    this.amber = amber;
    this.records = new Map();
    this.frame = null;
  }

  start() {
    this.frame = this.amber.window.requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  }

  entry(type, record, reason = "intersection") {
    const viewport = this.amber.driver.viewportSize;
    const progress = record.extent > 0
      ? clamp((viewport - record.start) / (viewport + record.extent), 0, 1)
      : 0;
    return Object.freeze({
      target: record.element,
      element: record.element,
      index: record.index,
      type: `section${type}`,
      isActive: type === "enter",
      isIntersecting: reason === "unobserved" ? false : record.isIntersecting,
      intersectionRatio: reason === "unobserved" ? 0 : record.ratio,
      visiblePixels: reason === "unobserved" ? 0 : record.visiblePixels,
      start: record.start,
      end: record.start + record.extent,
      viewportSize: viewport,
      progress,
      occurrence: record.occurrence,
      direction: this.amber.direction,
      reason,
      state: this.amber.state,
    });
  }

  notify(type, record, reason) {
    const isEnter = type === "enter";
    const entry = this.entry(type, record, reason);
    this.amber.options.observeSections[isEnter ? "onEnter" : "onLeave"]?.(entry);
    this.amber.emit(isEnter ? "sectionenter" : "sectionleave", entry);
  }

  update() {
    if (!this.records || this.amber.isDestroyed) return;
    const viewport = this.amber.driver.viewportSize;
    const threshold = this.amber.options.observeSections.threshold;
    const targets = this.amber.options.observeSections.targets;
    const selected = element => !targets || targets.some(selector => element.matches(selector));
    let geometries;

    if (this.amber.driver.items) {
      geometries = this.amber.driver.items.flatMap((item, index) => selected(item.element) ? [{
          element: item.element,
          index,
          start: item.visualStart,
          extent: item.extent,
          occurrence: this.amber.isInfinite ? item.occurrence : 0,
        }] : []);
    } else {
      const bounds = this.amber.driver.bounds;
      const edge = this.amber.driver.isHorizontal ? "left" : "top";
      const dimension = this.amber.driver.isHorizontal ? "width" : "height";
      geometries = Array.from(this.amber.driver.content.children)
        .filter(element => !element.hasAttribute("data-amber-avoid") && selected(element))
        .map((element, index) => {
          const rect = element.getBoundingClientRect();
          const crossVisible = this.amber.driver.isMultiAxis ? Math.max(0, Math.min(bounds.right, rect.right) - Math.max(bounds.left, rect.left)) : null;
          return { element, index, start: rect[edge] - bounds[edge], extent: rect[dimension], occurrence: 0,
            crossRatio: crossVisible === null ? 1 : rect.width > 0 ? Math.min(1, crossVisible / rect.width) : 0 };
        });
    }

    const current = new Set();
    for (const geometry of geometries) {
      current.add(geometry.element);
      const visiblePixels = Math.max(0, Math.min(viewport, geometry.start + geometry.extent) - Math.max(0, geometry.start));
      const ratio = geometry.extent > 0 ? Math.min(1, visiblePixels / geometry.extent) * (geometry.crossRatio ?? 1) : 0;
      const isIntersecting = visiblePixels > 0 && (geometry.crossRatio ?? 1) > 0;
      const isActive = isIntersecting && ratio >= threshold;
      const previous = this.records.get(geometry.element);
      const record = { ...geometry, visiblePixels, ratio, isIntersecting, isActive };
      this.records.set(geometry.element, record);
      !previous?.isActive && isActive ? this.notify("enter", record) : previous?.isActive && !isActive && this.notify("leave", record);
      if (this.amber.isDestroyed) return;
    }

    for (const [element, record] of this.records) {
      if (current.has(element)) continue;
      this.records.delete(element);
      if (record.isActive) this.notify("leave", record, "unobserved");
      if (this.amber.isDestroyed) return;
    }
  }

  destroy() {
    this.frame && this.amber.window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.records.clear();
  }
}

export const sections = Object.freeze({
  [featureModule]: true,
  name: 'sections',
  order: 40,
  attributes: Object.freeze(['class', 'id']),
  normalize(options) {
    if (options.observeSections === false) return;
    const observer = options.observeSections === true ? {} : options.observeSections;
    if (!observer || typeof observer !== "object" || Array.isArray(observer)) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: observeSections must be false, true, or an options object." : "Amber A051");
    }
    const threshold = observer.threshold ?? 0;
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new RangeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: section observer threshold must be between 0 and 1." : "Amber A052");
    }
    for (const name of ["onEnter", "onLeave"]) {
      if (observer[name] !== undefined && typeof observer[name] !== "function") {
        throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: observeSections.${name} must be a function.` : "Amber A053");
      }
    }
    if (observer.targets !== undefined) {
      if (!Array.isArray(observer.targets)) {
        throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: observeSections.targets must be an array of CSS selectors." : "Amber A054");
      }
      for (const selector of observer.targets) {
        if (typeof selector !== "string" || !selector.trim()) {
          throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? "Amber: every section target must be a non-empty CSS selector." : "Amber A055");
        }
      }
    }
    options.observeSections = Object.freeze({
      threshold,
      targets: observer.targets ? Object.freeze([...new Set(observer.targets)]) : null,
      onEnter: observer.onEnter ?? null,
      onLeave: observer.onLeave ?? null,
    });
  },
  validate(document, options) {
    for (const selector of options.observeSections?.targets ?? []) {
      try { document.createElement('div').matches(selector); }
      catch { throw new SyntaxError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: invalid section target selector '${selector}'.` : "Amber A056"); }
    }
  },
  install(amber) {
    if (!amber.options.observeSections) return;
    const controller = amber.sections = new Sections(amber);
    addHooks(amber, {
      start() { controller.start(); },
      afterWrite(position, initializing) { if (!initializing) controller.update(); },
      beforeDestroy() { controller.destroy(); },
    });
  },
});

export default sections;
