import test from 'node:test';
import assert from 'node:assert/strict';
import { Animation } from '../src/index.js';
import { environment, element } from './helpers.js';

test('prepared tracks preserve mixed units, transform order, clipping and exact restoration', () => {
  const env = environment(), el = element(env, { transform: 'rotate(7deg)', opacity: '.4', '--amount': '3' });
  el.style.setProperty('opacity', '.4', 'important');
  const animation = new Animation({ el, t: {
    y: { v: [10, 30], unit: 'px' }, x: [0, 100], r: { v: [-30, 30], name: 'rotateY' },
    s: [1, 2], z: [0, 10], c: [100, 0], o: [0, 1], '--amount': [0, 10], marginTop: [0, 20, 'px'],
  } });
  animation.seek(.5);
  assert.equal(el.style.getPropertyValue('transform'), 'translateY(20px) translateX(50%) rotateY(0deg) scale(1.5) translateZ(5px)');
  assert.equal(el.style.getPropertyValue('clip-path'), 'inset(50% 0% 0% 0%)');
  assert.equal(el.style.getPropertyValue('margin-top'), '10px');
  assert.equal(el.style.getPropertyValue('--amount'), '5');
  const writes = el.writes;
  animation.seek(.5);
  assert.equal(el.writes, writes);
  animation.seek(1);
  assert.equal(el.style.getPropertyValue('opacity'), '1');
  animation.reset();
  assert.equal(el.style.getPropertyValue('transform'), 'translateY(10px) translateX(0%) rotateY(-30deg) scale(1) translateZ(0px)');
  animation.destroy();
  assert.equal(el.style.getPropertyValue('transform'), 'rotate(7deg)');
  assert.equal(el.style.getPropertyValue('opacity'), '.4');
  assert.equal(el.style.getPropertyPriority('opacity'), 'important');
  assert.equal(el.style.getPropertyValue('--amount'), '3');
  assert.equal(el.style.getPropertyValue('clip-path'), '');
});

test('prepared transform lookup keeps validation and custom CSS property support', () => {
  const env = environment(), el = element(env);
  assert.throws(() => new Animation({ el, t: { x: { v: [0, 1], name: 'unknown' } } }), /Unsupported transform/);
  assert.throws(() => new Animation({ el, t: { x: { v: [0, 1], unit: 0 } } }), /unit/);
  assert.throws(() => new Animation({ el, t: { x: [0, NaN] } }), /finite/);
  const animation = new Animation({ el, t: { toString: [0, 2], '--x': [1, 3] } });
  animation.seek(.5);
  assert.equal(el.style.getPropertyValue('to-string'), '1');
  assert.equal(el.style.getPropertyValue('--x'), '2');
  animation.destroy();
});
