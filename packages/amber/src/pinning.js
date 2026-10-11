import { clamp, wrap } from './motion.js';

export function normalizePins(pin) {
  if (pin === false || pin === undefined) return false;
  if (!Array.isArray(pin)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin must be false or an array.' : "Amber A037");
  return Object.freeze(pin.map(options => {
    if (!options || typeof options !== 'object') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: each pin must be an options object.' : "Amber A038");
    for (const key of ['target', 'start', 'end']) {
      if (!(typeof options[key] === 'string' && options[key].trim()) && options[key]?.nodeType !== 1) {
        throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: pin.${key} must be a selector or element.` : "Amber A039");
      }
    }
    const position = options.position ?? 'top';
    const offset = options.offset ?? 0;
    const endOffset = options.endOffset ?? 0;
    if (!['top', 'middle'].includes(position)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin.position must be top or middle.' : "Amber A040");
    if (!Number.isFinite(offset)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin.offset must be finite.' : "Amber A041");
    if (typeof endOffset !== 'function' && !Number.isFinite(endOffset)) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin.endOffset must be finite or a function.' : "Amber A042");
    }
    return Object.freeze({ target: options.target, start: options.start, end: options.end, position, offset, endOffset });
  }));
}

function layoutY(driver, element, section, origin, nativePosition) {
  const item = driver.items?.find(entry => entry.element === section);
  if (item && Number.isFinite(item.start)) {
    // Both rects include the panel's recycled transform, so their difference is
    // stable across laps while still retaining the target's author translate,
    // transform, margins, and containing-block geometry.
    const localY = element.getBoundingClientRect().top - section.getBoundingClientRect().top;
    return (driver.contentOffset ?? 0) + item.start + localY;
  }
  return element.getBoundingClientRect().top - origin + nativePosition;
}

function localY(element, section) {
  return element.getBoundingClientRect().top - section.getBoundingClientRect().top;
}

/** Pin offsets are separate from panel transforms, preserving flow and author transforms. */
export class Pinning {
  constructor(driver, effects, parallax, options, scheduleResize) {
    this.driver = driver;
    this.effects = effects;
    this.parallax = parallax;
    this.options = options;
    this.records = [];
    for (const option of options) {
      for (const key of ['target', 'start', 'end']) {
        if (typeof option[key] === 'string') {
          try { driver.content.querySelector(option[key]); }
          catch { throw new SyntaxError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: invalid pin.${key} selector '${option[key]}'.` : "Amber A043"); }
        }
      }
    }
    this.watched = new Set();
    if (driver.window.ResizeObserver) this.observer = new driver.window.ResizeObserver(scheduleResize);
  }

  clear() {
    this.records = [];
    for (const item of this.driver.items ?? []) {
      item.hasPin = false;
      item.pinOffset = 0;
    }
  }

  refresh() {
    const driver = this.driver;
    const content = driver.content;
    const resolve = value => typeof value === 'string' ? content.querySelector(value) : value;
    const candidates = [];
    for (const options of this.options) {
      const target = resolve(options.target);
      const start = resolve(options.start);
      const end = resolve(options.end);
      // Missing/removed elements are dormant and are resolved on the next resize.
      if (![target, start, end].every(element => element && element !== content && content.contains(element))) continue;
      if (start.parentElement !== content || end.parentElement !== content) {
        throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin start and end must be direct content children.' : "Amber A044");
      }
      let section = target;
      while (section.parentElement !== content) section = section.parentElement;
      if ([section, start, end].some(element => element.hasAttribute('data-amber-avoid'))) continue;
      if (candidates.some(record => record.target.contains(target) || target.contains(record.target))) {
        throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin targets must be unique and cannot contain one another.' : "Amber A045");
      }
      candidates.push({ options, target, start, end, section });
    }
    const nativePosition = driver.items ? 0 : driver.read();
    const origin = driver.bounds.top;
    const top = (element, section) => layoutY(driver, element, section, origin, nativePosition);
    for (const candidate of candidates) {
      const { options, target, start, end, section } = candidate;
      const style = driver.window.getComputedStyle(target);
      if (style.position === 'fixed' || style.position === 'sticky') {
        throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin targets must use normal, relative, or absolute positioning.' : "Amber A046");
      }
      // The visual box is what position: 'middle' must center. A panel's
      // translate does not change its size, while author transforms do.
      const height = target.getBoundingClientRect().height;
      const line = options.position === 'middle' ? driver.viewportSize / 2 + options.offset : options.offset;
      const targetLine = options.position === 'middle' ? line - height / 2 : line;
      const host = driver.items?.find(entry => entry.element === section) ?? null;
      const targetLocalY = host ? localY(target, section) : null;
      const naturalTop = host
        ? (driver.contentOffset ?? 0) + host.start + targetLocalY
        : top(target, section);
      const naturalFrom = naturalTop - targetLine;
      const profile = this.parallax?.pinProfile(target, targetLine, naturalFrom)
        ?? { from: naturalFrom, scale: 1, ancestors: [] };
      const { from } = profile;
      if (top(start, start) - line > from + 0.5) {
        throw new RangeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin target reaches its resting position before the start section. Choose an earlier start section.' : "Amber A047");
      }
      // Resolve responsive release offsets during measurement, never per frame.
      const endOffset = typeof options.endOffset === 'function'
        ? options.endOffset({ target, start, end, height, viewportSize: driver.viewportSize })
        : options.endOffset;
      if (!Number.isFinite(endOffset)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin.endOffset must resolve to a finite number.' : "Amber A048");
      const to = top(end, end) - line + endOffset;
      if (driver.isInfinite) {
        const period = driver.cycleLength;
        if (!(period > 0) || from < -0.5 || to > period + 0.5 || to <= from) {
          throw new RangeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pin intervals cannot wrap the infinite seam. Keep start and end on one lap, with start before end.' : "Amber A049");
        }
      }
      // An empty/reversed interval has no pin effect.
      if (to <= from) continue;
      if (host) host.hasPin = true;
      this.effects.claim(target);
      this.records.push({
        target,
        from,
        to,
        scale: profile.scale,
        parallaxAncestors: profile.ancestors,
        item: target === section ? host : null,
        // Constant until refresh; avoids repeatedly reading host geometry in
        // the per-frame pin loop.
        hostStart: host?.start ?? null,
        hostEnd: host ? host.start + host.extent : null,
        localY: targetLocalY,
        height,
        parallax: this.parallax?.records?.find(record => record.target === target) ?? null,
        shift: NaN,
      });
    }
    const watched = new Set(candidates.flatMap(({ target, start, end }) => [target, start, end]));
    for (const element of this.watched) if (!watched.has(element)) this.observer?.unobserve(element);
    for (const element of watched) if (!this.watched.has(element)) this.observer?.observe(element);
    this.watched = watched;
  }

  write(position) {
    const period = this.driver.cycleLength;
    const looping = this.driver.isInfinite && period > 0;
    const phase = looping ? wrap(position, period) : position;
    for (const record of this.records) {
      const range = record.to - record.from;
      const raw = phase - record.from;
      let shift = clamp(raw, 0, range) * record.scale;
      // Recycle compensation uses the same cycle index as PanelRenderer, so pin
      // translate and panel matrix stay opposite across a lap, including after resize.
      if (looping && record.hostEnd !== null && raw >= 0) {
        // Host geometry is content-relative; phase is viewport-relative.
        const contentOffset = this.driver.contentOffset ?? 0;
        const cycle = Math.floor((phase - contentOffset - record.hostEnd) / period) + 1;
        shift -= cycle * period * record.scale;
        // After a released pin has left above the viewport, its recycled panel
        // can reset to its next occurrence. This is phase-derived rather than
        // history-derived, so a direct seek and continuous scrolling agree.
        if (raw > range && cycle !== 0) {
          const recycledTop = contentOffset + record.hostStart + cycle * period - phase + record.localY;
          const parallaxOffset = record.parallax
            ? (phase - shift - record.parallax.anchor - cycle * period) * (1 - record.parallax.speed)
            : 0;
          const ancestorOffset = record.parallaxAncestors.reduce((sum, ancestor) =>
            sum + (phase - ancestor.anchor - cycle * period) * (1 - ancestor.speed), 0);
          if (recycledTop + shift + parallaxOffset + ancestorOffset + record.height <= 0) shift = 0;
        }
      }
      if (record.item) record.item.pinOffset = shift;
      if (record.shift === shift) continue;
      this.effects.set(record.target, 'pin', shift);
      record.shift = shift;
    }
  }

  destroy() {
    this.observer?.disconnect();
    this.watched.clear();
  }
}
