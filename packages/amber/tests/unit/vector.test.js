import test from 'node:test';
import assert from 'node:assert/strict';
import { Motion, FRAME_MS } from '../../src/motion.js';
import { wheelVector } from '../../src/input.js';
import Amber from '../../src/index.js';
import infinite from '../../src/plugins/infinite.js';
import { readFileSync } from 'node:fs';

test('one integrator advances independent X/Y targets using one frame blend', () => {
  const m = new Motion({ orientation: 'both' });
  m.setLimit({ x: 1000, y: 2000 }); m.moveTo({ x: 1000, y: 500 }); m.advance(FRAME_MS);
  assert.ok(Math.abs(m.positionVector.x - 90) < 1e-9);
  assert.ok(Math.abs(m.positionVector.y - 45) < 1e-9);
  assert.equal(m.position, m.positionVector.y);
  m.moveTo({ x: 0 });
  assert.equal(m.targetVector.y, 500);
  m.advance(FRAME_MS);
  assert.equal(m.directionVector.x, -1); assert.equal(m.directionVector.y, 1);
});

test('single-axis path enables only one component and retains scalar behavior', () => {
  for (const orientation of ['vertical', 'horizontal']) {
    const m = new Motion({ orientation }); m.setLimit(1000); m.moveTo(100); m.advance(FRAME_MS);
    assert.equal(m.axes.length, 1);
    assert.ok(Math.abs(m.position - 9) < 1e-9);
    assert.equal(m.positionVector[orientation === 'vertical' ? 'x' : 'y'], 0);
  }
});

test('both axes converge consistently across refresh rates without frame allocations', () => {
  const samples = [30, 60, 120, 144].map(hz => {
    const m = new Motion({ orientation: 'both' });
    const reference = m.positionVector;
    m.setLimit({ x: 4000, y: 3000 }); m.moveTo({ x: 2700, y: 1300 });
    for (let i = 0; i < hz; i++) m.advance(1000 / hz);
    assert.equal(m.positionVector, reference);
    return { ...m.positionVector };
  });
  for (const sample of samples) for (const axis of ['x', 'y']) assert.ok(Math.abs(sample[axis] - samples[0][axis]) < 1e-8);
});

test('per-axis looping rebases targets without introducing velocity jumps', () => {
  const m = new Motion({ orientation: 'both', infinite: { x: true, y: false } });
  m.setLimit({ x: 1000, y: 500 }); m.jump({ x: 990, y: 490 }); m.moveTo({ x: 1100, y: 600 });
  m.advance(FRAME_MS); m.advance(FRAME_MS);
  assert.ok(m.positionVector.x < 20); assert.equal(m.targetVector.x, 100);
  assert.equal(m.targetVector.y, 500); assert.ok(m.velocityVector.x > 0);
  m.jump({ x: -1000010 }); assert.equal(m.positionVector.x, 990);
  assert.ok(m.positionVector.y > 490);
});

test('diagonal loops, shrinking and empty dimensions remain finite and bounded', () => {
  const m = new Motion({ orientation: 'both', infinite: true });
  m.setLimit({ x: 1000, y: 800 });
  for (let i = 0; i < 2000; i++) {
    m.moveTo({ x: m.targetVector.x + 400, y: m.targetVector.y - 500 }); m.advance(FRAME_MS);
    for (const axis of m.axes) {
      assert.ok(m.positionVector[axis] >= 0 && m.positionVector[axis] < m.limitVector[axis]);
      assert.ok(Math.abs(m.targetVector[axis] - m.positionVector[axis]) <= m.limitVector[axis]);
    }
  }
  m.infinite = false; m.setLimit({ x: 20, y: 0 });
  assert.ok(m.positionVector.x <= 20); assert.equal(m.positionVector.y, 0);
  assert.equal(m.progressAt('y'), 0);
});

test('invalid destinations do not partially mutate vector targets', () => {
  const m = new Motion({ orientation: 'both' }); m.setLimit({ x: 100, y: 100 }); m.moveTo({ x: 20, y: 30 });
  assert.throws(() => m.moveTo({ x: 90, y: NaN }));
  assert.deepEqual(m.targetVector, { x: 20, y: 30 });
  assert.throws(() => m.advance(NaN));
});

test('wheel vector preserves diagonal components, units and explicit filtering', () => {
  const out = {}, viewport = { width: 600, height: 400 };
  assert.equal(wheelVector({ deltaX: 1, deltaY: 2, deltaMode: 2 }, { wheelGesture: 'both' }, viewport, out), out);
  assert.deepEqual(out, { x: 600, y: 800 });
  wheelVector({ deltaX: -2, deltaY: 3, deltaMode: 1 }, { wheelGesture: 'vertical', lineHeight: 20 }, viewport, out);
  assert.deepEqual(out, { x: 0, y: 60 });
});

test('native infinite is opt-in and supports vector masks before DOM construction', () => {
  assert.throws(() => new Amber({ plugins: [infinite], infinite: true }), /browser/);
  assert.throws(() => new Amber({ plugins: [infinite], orientation: 'both', infinite: { x: true } }), /browser/);
  assert.throws(() => new Amber({ plugins: [infinite], infinite: { x: true } }), /inactive|enabled by orientation/);
  for (const value of [null, [], 'yes', { z: true }, { x: 1 }]) assert.throws(() => new Amber({ infinite: value }), /infinite/);
});

test('the lean native entry does not import optional renderers or effects', () => {
  const visited = new Set();
  const visit = url => {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const source = readFileSync(url, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) visit(new URL(match[1], url));
  };
  visit(new URL('../../src/index.js', import.meta.url));
  for (const url of visited) assert.doesNotMatch(url, /(?:plane-renderer|panel-renderer|transform-renderer|parallax|pinning|plugins)\.?(?:js|\/)/);
});
