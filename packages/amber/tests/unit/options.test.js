import test from 'node:test';
import assert from 'node:assert/strict';
import Amber from '../../src/index.js';
import transform from '../../src/transform.js';
import { featureModule } from '../../src/modules.js';

// Reaching the DOM readiness error confirms option validation accepted the input.
test('numeric options retain strict types, finite bounds and damping constraints', () => {
  for (const key of ['damping', 'wheelMultiplier', 'touchMultiplier', 'touchInertia', 'touchInertiaTimeout', 'lineHeight', 'keyboardStep']) {
    for (const value of [undefined, null, false, '1', NaN, Infinity, -Infinity, -1]) {
      assert.throws(() => new Amber({ [key]: value }), { name: 'TypeError', message: `Amber: ${key} must be a finite, nonnegative number.` });
    }
    for (const value of key === 'damping' ? [.01, 1] : [0, 1, 1e10]) {
      assert.throws(() => new Amber({ [key]: value }), /browser/);
    }
  }
  for (const damping of [0, 1.01]) assert.throws(() => new Amber({ damping }), RangeError);
});

test('boolean options reject coercion and retain renderer-specific normalization', () => {
  for (const key of ['anchors', 'smoothTouch', 'scrollChain', 'managedWheel', 'respectReducedMotion', 'autoRaf', 'hideScrollbar']) {
    for (const value of [undefined, null, 0, 1, 'false', {}]) {
      assert.throws(() => new Amber({ [key]: value }), { name: 'TypeError', message: `Amber: ${key} must be a boolean.` });
    }
    for (const value of [true, false]) assert.throws(() => new Amber({ [key]: value }), /browser/);
  }
  assert.throws(() => new Amber({ renderer: transform, smoothTouch: false }), /requires the native renderer/);
  assert.throws(() => new Amber({ orientation: 'both', hideScrollbar: 'overridden' }), /browser/);
});

test('normalization retains defaults, freezes resolved options and leaves caller input alone', () => {
  let resolved;
  const inspect = { [featureModule]: true, name: 'inspect', order: 100, install() {}, normalize(options) { resolved = options; } };
  const supplied = Object.freeze({ plugins: Object.freeze([inspect]), wheelMultiplier: 0, anchors: false });
  assert.throws(() => new Amber(supplied), /browser/);
  assert.equal(Object.isFrozen(resolved), true);
  assert.deepEqual(Object.fromEntries(['damping', 'wheelMultiplier', 'touchMultiplier', 'touchInertia', 'touchInertiaTimeout', 'lineHeight', 'keyboardStep'].map(key => [key, resolved[key]])), {
    damping: .09, wheelMultiplier: 0, touchMultiplier: 2.5, touchInertia: 12, touchInertiaTimeout: 100, lineHeight: 60, keyboardStep: 100,
  });
  assert.equal(resolved.anchors, false);
  assert.equal(resolved.smoothTouch, true);
  assert.equal(resolved.wheelGesture, 'vertical');
  assert.deepEqual(Object.keys(supplied), ['plugins', 'wheelMultiplier', 'anchors']);
  assert.throws(() => new Amber(), /browser/);
  // Numeric validation still precedes damping bounds and boolean validation.
  assert.throws(() => new Amber({ damping: 0, wheelMultiplier: -1, anchors: null }), /wheelMultiplier/);
});
