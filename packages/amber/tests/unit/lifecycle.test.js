import test from 'node:test';
import assert from 'node:assert/strict';
import Amber from '../../src/index.js';
import { sharedEffects } from '../../src/effects.js';
import { addHooks, runHooks } from '../../src/modules.js';
import snap from '../../src/plugins/snap.js';

function fixture() {
  const calls = [];
  const amber = Object.create(Amber.prototype);
  amber.motion = { position: 100, axis: 'y', positionVector: { x: 0, y: 100 } };
  amber.expectedVector = { x: 0, y: 0 };
  amber.driver = { writeVector() { calls.push('renderer'); return { x: 0, y: 99 }; } };
  const effects = sharedEffects(amber);
  effects.flush = () => calls.push('flush');
  effects.clear = () => calls.push('effects clear');
  for (const [key, name] of [['pins', 'pin'], ['parallax', 'parallax']]) {
    amber[key] = Object.fromEntries(['refresh', 'clear', 'destroy', 'write'].map(method =>
      [method, value => { calls.push(`${name} ${method}${value === undefined ? '' : ` ${value}`}`); }]));
  }
  return { amber, calls };
}

test('effects compose around renderer writes, correct clamped pins before observers and register once', () => {
  const { amber, calls } = fixture();
  assert.equal(sharedEffects(amber), amber.effects);
  addHooks(amber, { afterWrite() { calls.push('observe'); } });
  amber.write();
  assert.deepEqual(calls, ['pin write 100', 'renderer', 'pin write 99', 'parallax write 99', 'flush', 'observe']);
  assert.equal(amber.expectedPosition, 99);
});

test('refresh and failure cleanup preserve effect order', () => {
  const { amber, calls } = fixture();
  runHooks(amber, 'beforeRefresh');
  runHooks(amber, 'refresh');
  assert.deepEqual(calls, ['effects clear', 'pin clear', 'parallax clear', 'parallax refresh', 'pin refresh']);
  calls.length = 0;
  amber.pins.refresh = () => { throw new Error('bad pin'); };
  assert.throws(() => runHooks(amber, 'refresh'), /bad pin/);
  runHooks(amber, 'refreshError');
  assert.deepEqual(calls, ['parallax refresh', 'pin clear', 'parallax clear', 'effects clear']);
  calls.length = 0;
  runHooks(amber, 'destroy');
  assert.deepEqual(calls, ['pin destroy', 'parallax destroy', 'effects clear']);
});

test('snap lifecycle preserves native and animated settling and cancels queued work on teardown', () => {
  const cleared = [];
  const amber = { options: { snap: 'mandatory' }, window: { clearTimeout: id => cleared.push(id) } };
  snap.install(amber);
  let observed;
  amber.snap.settle = () => { observed = [amber.snap.pending, amber.snap.snapping]; return true; };
  let notified = false;
  addHooks(amber, { settle() { notified = true; } });
  assert.equal(runHooks(amber, 'settle', true), true);
  assert.deepEqual(observed, [true, false]);
  assert.equal(notified, true);
  amber.snap.snapping = true;
  runHooks(amber, 'settle');
  assert.deepEqual(observed, [true, false]);
  amber.snap.timer = 7;
  runHooks(amber, 'beforeDestroy');
  assert.deepEqual(cleared, [7]);
  assert.equal(amber.snap.pending, false);
});
