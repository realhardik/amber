import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelRenderer } from '../../src/panel-renderer.js';
import { PlaneRenderer } from '../../src/plane-renderer.js';

function fixture(orientation) {
  let targetReads = 0, hostReads = 0;
  const target = { getBoundingClientRect() { targetReads++; return { left: -2982.5, top: -3972.25 }; } };
  const host = { contains: element => element === target,
    getBoundingClientRect() { hostReads++; return { left: -3000, top: -4000 }; } };
  const plane = orientation === 'both';
  const driver = Object.create(plane ? PlaneRenderer.prototype : PanelRenderer.prototype);
  Object.assign(driver, {
    axes: plane ? ['x', 'y'] : [orientation === 'horizontal' ? 'x' : 'y'],
    isMultiAxis: plane, vector: { x: 2120, y: -1770 },
    cycles: { x: 1000, y: 1000 }, infiniteAxes: { x: false, y: false },
    contentOffset: 20,
    readVector() { throw new Error('Tracked destinations must not depend on transient native offsets'); },
  });
  if (plane) {
    driver.origin = { x: 20, y: 30 };
    driver.tiles = [{ element: host, x: 100.25, y: 200.5 }];
  } else driver.items = [{ element: host, start: 100.25 }];
  return { driver, target, host, reads: () => [targetReads, hostReads] };
}

for (const orientation of ['vertical', 'horizontal', 'both']) {
  test(`${orientation}: culled descendants retain fractional destinations and share rect reads`, () => {
    const { driver, target, reads } = fixture(orientation);
    assert.deepEqual(driver.destinationVector(target), orientation === 'vertical' ? { x: 0, y: 148 }
      : orientation === 'horizontal' ? { x: 137.75, y: 0 } : { x: 137.75, y: 258.25 });
    assert.deepEqual(reads(), [1, 1]);
    driver.infiniteAxes = { x: true, y: true };
    assert.deepEqual(driver.destinationVector(target), orientation === 'vertical' ? { x: 0, y: -1852 }
      : orientation === 'horizontal' ? { x: 2137.75, y: 0 } : { x: 2137.75, y: -1741.75 });
    if (orientation === 'both') {
      driver.infiniteAxes.y = false;
      assert.deepEqual(driver.destinationVector(target), { x: 2137.75, y: 258.25 });
    }
  });

  test(`${orientation}: a direct panel destination uses measured geometry without DOM reads`, () => {
    const { driver, host, reads } = fixture(orientation);
    assert.deepEqual(driver.destinationVector(host), orientation === 'vertical' ? { x: 0, y: 120.25 }
      : orientation === 'horizontal' ? { x: 120.25, y: 0 } : { x: 120.25, y: 230.5 });
    assert.deepEqual(reads(), [0, 0]);
  });

  test(`${orientation}: untracked targets retain native-offset fallback semantics`, () => {
    const { driver } = fixture(orientation);
    Object.defineProperty(driver, 'bounds', { value: { left: 5, top: 15 } });
    driver.vector = { x: 20, y: 30 };
    driver.readVector = () => ({ x: 50, y: 80 });
    const target = { getBoundingClientRect: () => ({ left: 75, top: 95 }) };
    assert.deepEqual(driver.destinationVector(target), orientation === 'vertical' ? { x: 0, y: 160 }
      : orientation === 'horizontal' ? { x: 120, y: 0 } : { x: 90, y: 110 });
  });
}
