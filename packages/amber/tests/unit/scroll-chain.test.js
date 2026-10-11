import test from 'node:test';
import assert from 'node:assert/strict';
import Amber from '../../src/index.js';
import { Motion } from '../../src/motion.js';

function instance(options = {}) {
  const value = Object.create(Amber.prototype);
  value.options = { scrollChain: true, ...options };
  value.motion = new Motion({ orientation: 'both', ...options });
  value.motion.setLimit({ x: 200, y: 500 });
  value.isStopped = false;
  return value;
}

test('scrollChain is boolean and opt-in', () => {
  assert.throws(() => new Amber({ scrollChain: 'yes' }), /scrollChain/);
  assert.throws(() => new Amber({ managedWheel: 'yes' }), /managedWheel/);
  const child = instance({ scrollChain: false });
  assert.equal(child.canReleaseInput(-10, 'y'), false);
});
test('only outward settled finite edges release, independently by axis', () => {
  const child = instance();
  assert.equal(child.canReleaseInput(-10, 'y'), true);
  assert.equal(child.canReleaseInput(10, 'y'), false);
  child.motion.jump({ x: 0, y: 400 }); child.motion.moveTo({ y: 500 });
  assert.equal(child.canReleaseInput(10, 'y'), false);
  child.motion.jump({ x: 0, y: 500 });
  assert.equal(child.canReleaseInput(10, 'y'), true);
  assert.equal(child.canReleaseInput(-10, 'y'), false);
  assert.equal(child.canReleaseVector({ x: -10, y: 10 }), true);
  assert.equal(child.canReleaseVector({ x: 10, y: 10 }), false);
  assert.equal(child.canReleaseVector({ x: Infinity, y: Infinity }), false);
  child.motion.jump({ x: 200, y: 500 });
  assert.equal(child.canReleaseVector({ x: Infinity, y: Infinity }), true);
  child.isStopped = true;
  assert.equal(child.canReleaseInput(10, 'y'), false);
});
test('looped axes never release but finite axes still can', () => {
  const child = instance({ infinite: { x: true, y: false } });
  assert.equal(child.canReleaseInput(-10, 'x'), false);
  assert.equal(child.canReleaseInput(-10, 'y'), true);
});
