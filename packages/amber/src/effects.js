import { overrideStyle } from './renderers.js';
import { addHooks } from './modules.js';

// Created only when an installed visual feature needs composition.
export function sharedEffects(amber) {
  if (!amber.effects) {
    amber.effects = new Effects(amber.driver);
    addHooks(amber, {
      beforeRefresh() { amber.effects.clear(); amber.pins?.clear(); amber.parallax?.clear(); },
      refresh() { amber.parallax?.refresh(); amber.pins?.refresh(); },
      refreshError() { amber.pins?.clear(); amber.parallax?.clear(); amber.effects.clear(); },
      beforeWrite(position) { amber.pins?.write(position); },
      afterWrite(position) { amber.parallax?.write(position); amber.effects.flush(); },
      destroy() { amber.pins?.destroy(); amber.parallax?.destroy(); amber.effects.clear(); },
    });
  }
  return amber.effects;
}

function translateComponents(value) {
  if (value === 'none') return ['0px', '0px', '0px'];
  const parts = [];
  let depth = 0;
  let part = '';
  for (const character of value) {
    if (character === '(') depth++;
    if (character === ')') depth--;
    if (/\s/.test(character) && depth === 0) {
      if (part) parts.push(part);
      part = '';
    } else part += character;
  }
  if (part) parts.push(part);
  return [parts[0] ?? '0px', parts[1] ?? '0px', parts[2] ?? '0px'];
}

/** Combines Amber-owned visual offsets without overwriting author transforms. */
export class Effects {
  constructor(driver) {
    this.driver = driver;
    this.records = new Map();
  }

  claim(element) {
    let record = this.records.get(element);
    if (record) return record;
    const style = this.driver.window.getComputedStyle(element);
    const translate = translateComponents(style.translate);
    const restore = overrideStyle(element, { translate: style.translate, transition: 'none' });
    record = { element, translate, values: new Map(), rendered: NaN, restore };
    this.records.set(element, record);
    return record;
  }

  set(element, effect, value, axis = 'y') {
    this.claim(element).values.set(`${effect}:${axis}`, value);
  }

  ancestorValue(element, effect, axis = 'y') {
    let value = 0;
    for (let current = element; current && current !== this.driver.content; current = current.parentElement) {
      value += this.records.get(current)?.values.get(`${effect}:${axis}`) ?? 0;
    }
    return value;
  }

  flush() {
    for (const record of this.records.values()) {
      let xOffset = 0;
      let yOffset = 0;
      for (const [key, value] of record.values) key.endsWith(':x') ? xOffset += value : yOffset += value;
      const rendered = `${xOffset.toFixed(3)},${yOffset.toFixed(3)}`;
      if (rendered === record.rendered) continue;
      const [x, y, z] = record.translate;
      record.element.style.translate = `calc(${x} + ${xOffset}px) calc(${y} + ${yOffset}px) ${z}`;
      record.rendered = rendered;
    }
  }

  clear() {
    for (const record of Array.from(this.records.values()).reverse()) record.restore();
    this.records.clear();
  }
}
