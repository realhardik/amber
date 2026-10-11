/** Attribute-driven parallax for nested content in either renderer. */
export class Parallax {
  constructor(driver, effects, scheduleResize) {
    this.driver = driver;
    this.effects = effects;
    this.records = [];
    this.watched = new Set();
    if (driver.window.ResizeObserver) this.observer = new driver.window.ResizeObserver(scheduleResize);
  }

  clear() {
    this.records = [];
    for (const item of this.driver.items ?? this.driver.tiles ?? []) item.hasParallax = false;
  }

  refresh() {
    const { driver, effects } = this;
    const bounds = driver.bounds;
    const position = driver.read();
    const edge = driver.isHorizontal ? 'left' : 'top';
    const dimension = driver.isHorizontal ? 'width' : 'height';
    const watched = new Set();
    for (const target of driver.content.querySelectorAll('[data-amber-speed]')) {
      let section = target;
      while (section.parentElement && section.parentElement !== driver.content) section = section.parentElement;
      // Direct children define layout and always retain the normal scroll speed.
      if (section === target || section.parentElement !== driver.content || section.hasAttribute('data-amber-avoid')) continue;
      const value = target.getAttribute('data-amber-speed').trim();
      const parsed = value ? Number(value) : NaN;
      const speed = Number.isFinite(parsed) ? parsed : 1;
      watched.add(target);
      watched.add(section);
      if (speed === 1) continue;
      const rect = target.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const item = (driver.items ?? driver.tiles)?.find(entry => entry.element === section) ?? null;
      const targetStart = item
        ? driver.contentOffset + item.start + rect[edge] - sectionRect[edge]
        : position + rect[edge] - bounds[edge];
      const anchor = targetStart + rect[dimension] / 2 - driver.viewportSize / 2;
      effects.claim(target);
      if (item) item.hasParallax = true;
      this.records.push({ target, section, item, speed, extent: rect[dimension], targetStart, anchor });
    }
    for (const element of this.watched) if (!watched.has(element)) this.observer?.unobserve(element);
    for (const element of watched) if (!this.watched.has(element)) this.observer?.observe(element);
    this.watched = watched;
  }

  pinProfile(target, targetLine, fallback) {
    const own = this.records.find(entry => entry.target === target);
    const ancestors = this.records.filter(entry => entry.target !== target && entry.target.contains(target));
    const speed = own?.speed ?? 1;
    // Ancestors add visual motion but do not inherit the child's pin offset.
    // The child's own parallax does inherit it, scaling pin compensation by speed.
    const effectiveSpeed = speed - ancestors.reduce((sum, record) => sum + 1 - record.speed, 0);
    if (speed === 0 || effectiveSpeed === 0) throw new RangeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: a pin target must have nonzero effective parallax speed.' : "Amber A036");
    const anchorOffset = [own, ...ancestors].reduce((sum, record) => sum + (record ? record.anchor * (1 - record.speed) : 0), 0);
    const naturalFrom = own ? own.targetStart - targetLine : fallback;
    return { from: (naturalFrom - anchorOffset) / effectiveSpeed, scale: effectiveSpeed / speed, ancestors };
  }

  write(position) {
    const axis = this.driver.isHorizontal ? 'x' : 'y';
    for (const record of this.records) {
      const pinOffset = this.effects.ancestorValue(record.target, 'pin', axis);
      const occurrenceShift = this.driver.isInfinite && record.item
        ? record.item.occurrence * this.driver.cycleLength
        : 0;
      const effectivePosition = position - pinOffset;
      const offset = (effectivePosition - record.anchor - occurrenceShift) * (1 - record.speed);
      // A frozen child still moves with its parent. Its stale transform can enter
      // the viewport before the computed bounds do, especially after recycling
      // or an immediate seek. Synchronize every offset in the parent's write;
      // Effects.flush still skips values that have not actually changed.
      this.effects.set(record.target, 'parallax', offset, axis);
    }
  }

  destroy() {
    this.clear();
    this.observer?.disconnect();
    this.watched.clear();
  }
}
