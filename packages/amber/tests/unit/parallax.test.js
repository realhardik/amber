import test from 'node:test';
import assert from 'node:assert/strict';
import { Parallax } from '../../src/parallax.js';
import { PanelRenderer } from '../../src/panel-renderer.js';

function fixture({ speed = .6, horizontal = false, infinite = false, pin = 0, native = false } = {}) {
  const element = { style: {} };
  const item = { element, start: 0, extent: 420, hasParallax: true, transform: '', occurrence: 0 };
  const driver = { window: {}, viewportSize: 320, isHorizontal: horizontal, isInfinite: infinite,
    cycleLength: 1680, contentOffset: 0, items: [item],
    axis: horizontal ? "x" : "y", vector: { x: 0, y: 0 }, actual: { x: 0, y: 0 },
    readVector() { return this.vector; }, writeVector: PanelRenderer.prototype.writeVector };
  const values = new Map();
  const effects = { ancestorValue: () => pin, set: (target, name, value, axis) => values.set(axis, value) };
  const parallax = new Parallax(driver, effects, () => {});
  const record = { target: element, item: native ? null : item, speed, extent: 40, targetStart: 360, anchor: 220 };
  parallax.records.push(record);
  const write = position => {
    if (!native) PanelRenderer.prototype.write.call(driver, position);
    parallax.write(position);
    const expected = (position - pin - record.anchor - item.occurrence * (infinite ? driver.cycleLength : 0)) * (1 - speed);
    assert.ok(Math.abs(values.get(horizontal ? 'x' : 'y') - expected) < 1e-9,
      `position ${position}, occurrence ${item.occurrence}: expected ${expected}, got ${values.get(horizontal ? 'x' : 'y')}`);
  };
  return { write, record, values };
}

for (const horizontal of [false, true]) {
  for (const speed of [.2, .8, 1.2, 0, -.5]) {
    test(`${horizontal ? 'horizontal' : 'vertical'} speed ${speed}: re-entry does not depend on old offscreen state`, () => {
      const f = fixture({ horizontal, speed });
      for (const position of [0, 300, 700, 3000, 5000, 0, 100, 350, 100, 0, 5000, 350]) f.write(position);
    });
    test(`${horizontal ? 'horizontal' : 'vertical'} speed ${speed}: both infinite occurrences reset before entry`, () => {
      const f = fixture({ horizontal, speed, infinite: true });
      for (let lap = 0; lap < 3; lap++) {
        for (const position of [0, 300, 700, 1200, 1679, 0, 100, 350, 100, 0, 1679, 1200, 700, 350]) f.write(position);
      }
    });
  }
}

test('pin compensation is preserved during offscreen updates', () => {
  const f = fixture({ pin: 180 });
  for (const position of [0, 300, 700, 2000, 5000, 100, 0]) f.write(position);
});

for (const horizontal of [false, true]) {
  test(`native ${horizontal ? 'horizontal' : 'vertical'}: offscreen seeks and reversals keep current offsets`, () => {
    const f = fixture({ native: true, horizontal });
    for (const position of [0, 300, 1200, 3000, 5000, 0, 100, 350, 100, 0]) f.write(position);
  });
}
