import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePins, Pinning } from '../../src/pinning.js';

function fixture(endOffset = 0) {
  let height = 500, shift = 0;
  const content = { contains: element => [start, end, target].includes(element) };
  const section = top => ({ nodeType: 1, parentElement: content, offsetTop: top,
    hasAttribute: () => false, getBoundingClientRect: () => ({ top, height: 2000 }) });
  const start = section(0), end = section(2000);
  const target = { nodeType: 1, parentElement: start, offsetTop: 200, offsetParent: start,
    get offsetHeight() { return height; },
    getBoundingClientRect: () => ({ top: 200, height }) };
  const driver = { content, bounds: { top: 0 }, viewportSize: 900,
    items: [{ element: start, start: 0, extent: 2000 }], window: { getComputedStyle: () => ({ position: 'relative' }) } };
  const effects = { claim() {}, set(element, name, value) { shift = value; } };
  const options = normalizePins([{ target, start, end, offset: 80, endOffset }]);
  const pin = new Pinning(driver, effects, null, options, () => {});
  pin.refresh();
  return { pin, options, resize: value => { height = value; pin.clear(); pin.refresh(); },
    topAt(position) { pin.write(position); return 200 - position + shift; } };
}

test('default end offset preserves the existing section-line release', () => {
  const f = fixture();
  assert.equal(f.pin.records[0].to, 1920);
});

test('responsive release keeps the heading on its own panel as it scrolls away', () => {
  const f = fixture(({ height }) => -height - 64);
  const release = f.pin.records[0].to;
  assert.equal(release, 1356);
  assert.equal(f.topAt(release), 80);
  assert.equal(f.topAt(release + 100), -20);
  assert.equal(2000 - (release + 100) - (f.topAt(release + 100) + 500), 64);
  f.resize(700);
  assert.equal(f.pin.records[0].to, 1156);
});

test('invalid release offsets are rejected', () => {
  assert.throws(() => fixture('early'), /pin.endOffset/);
  assert.throws(() => fixture(() => NaN), /pin.endOffset/);
});

test('infinite pins use wrapped position and reject seam-wrapping ranges', () => {
  const f = fixture();
  f.pin.driver.isInfinite = true;
  f.pin.driver.cycleLength = 3000;
  f.pin.clear();
  f.pin.refresh();
  assert.equal(f.pin.records[0].from, 120);
  assert.equal(f.pin.records[0].to, 1920);
  assert.throws(() => {
    f.pin.driver.cycleLength = 1000;
    f.pin.clear();
    f.pin.refresh();
  }, /cannot wrap the infinite seam/);
  f.pin.driver.cycleLength = 3000;
  f.pin.clear();
  f.pin.refresh();
  f.pin.write(120);
  const engaged = f.pin.records[0].shift;
  f.pin.write(120 + 3000);
  assert.equal(f.pin.records[0].shift, engaged);
  f.pin.write(800);
  const held = f.pin.records[0].shift;
  f.pin.write(800 + 3000 * 3);
  assert.equal(f.pin.records[0].shift, held);
  f.pin.write(50);
  assert.equal(f.pin.records[0].shift, 0);
  const world = (phase) => {
    f.pin.write(phase);
    const item = f.pin.driver.items[0];
    const period = 3000;
    const wrapped = ((phase % period) + period) % period;
    const cycles = Math.floor((wrapped - item.start - item.extent) / period) + 1;
    return item.start + cycles * period - wrapped + f.pin.records[0].shift;
  };
  assert.equal(world(200), world(900));
  assert.equal(world(200), world(1500));
});
