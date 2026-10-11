import test from 'node:test';
import assert from 'node:assert/strict';
import { Animation } from '../src/svg.js';
import { element, environment } from './helpers.js';

function setup(length, line = {}, initial = {}) {
  const env = environment(), el = element(env, initial);
  el.getTotalLength = () => length;
  const animation = new Animation({ el, line, scheduler: env.scheduler, duration: 100 });
  return { ...env, el, animation };
}

test('partial dash and gap cycles end at the path boundary, not the next cycle', () => {
  for (const [length, expected] of [[23, '4 6 4 6 3 23'], [27, '4 6 4 6 4 30']]) {
    const { el, animation } = setup(length, { dashed: '4 6' });
    assert.equal(el.style.getPropertyValue('stroke-dasharray'), expected);
    assert.equal(el.style.getPropertyValue('stroke-opacity'), '0');
    animation.seek(.5);
    assert.equal(el.style.getPropertyValue('stroke-dasharray'), expected);
    assert.equal(+el.style.getPropertyValue('stroke-dashoffset'), length / 2);
    const writes = el.writes;
    animation.seek(.6);
    assert.equal(el.writes - writes, 1, 'ordinary frames update only the offset');
    animation.seek(.6);
    assert.equal(el.writes - writes, 1, 'identical frames do not write');
    animation.seek(1);
    assert.equal(el.style.getPropertyValue('stroke-dasharray'), '4 6');
    animation.destroy();
  }
});

test('repeated hidden/visible transitions and reverse playback preserve stroke opacity and priority', () => {
  const env = environment(), el = element(env, { opacity: '.4', fill: 'red' });
  el.style.setProperty('stroke-opacity', '.35', 'important');
  const animation = new Animation({ el, line: { dashed: '0 7' }, scheduler: env.scheduler, duration: 100 });
  for (const progress of [.5, 0, 1, 0, .1]) {
    animation.seek(progress);
    assert.equal(el.style.getPropertyValue('stroke-opacity'), progress ? '.35' : '0');
    assert.equal(el.style.getPropertyPriority('stroke-opacity'), progress ? 'important' : '');
  }
  animation.seek(1).reverse(); env.frame(0); env.frame(100);
  assert.equal(el.style.getPropertyValue('stroke-opacity'), '0');
  animation.destroy();
  assert.equal(el.style.getPropertyValue('stroke-opacity'), '.35');
  assert.equal(el.style.getPropertyPriority('stroke-opacity'), 'important');
  assert.equal(el.style.getPropertyValue('opacity'), '.4');
  assert.equal(el.style.getPropertyValue('fill'), 'red');
  assert.equal(el.style.getPropertyValue('stroke-dasharray'), '');
  assert.equal(el.style.getPropertyValue('stroke-dashoffset'), '');
});

test('normalized path units, odd patterns, backwards ranges and reset use the same drawing coordinates', () => {
  const env = environment(), el = element(env);
  el.setAttribute('pathLength', '23');
  const animation = new Animation({ el, line: { start: 100, end: 0, dashed: '3, 2, 1' }, scheduler: env.scheduler });
  assert.equal(el.style.getPropertyValue('stroke-dasharray'), '3 2 1');
  animation.seek(.5);
  assert.equal(el.style.getPropertyValue('stroke-dashoffset'), '11.5');
  animation.seek(1);
  assert.equal(el.style.getPropertyValue('stroke-opacity'), '0');
  animation.reset();
  assert.equal(el.style.getPropertyValue('stroke-dashoffset'), '0');
  assert.equal(el.style.getPropertyValue('stroke-opacity'), '');
  animation.destroy();
  assert.equal(el.getAttribute('pathLength'), '23');
});

test('zero geometry stays hidden and overshooting easing cannot wrap the stroke', () => {
  const empty = setup(0, { dashed: '0 3' });
  empty.animation.seek(1);
  assert.equal(empty.el.style.getPropertyValue('stroke-opacity'), '0');
  empty.animation.destroy();
  const env = environment(), el = element(env);
  const animation = new Animation({ el, line: {}, easing: p => p < .5 ? -.2 : 1.2 });
  animation.seek(.25);
  assert.equal(el.style.getPropertyValue('stroke-opacity'), '0');
  animation.seek(.75);
  assert.equal(el.style.getPropertyValue('stroke-dasharray'), 'none');
  assert.equal(el.style.getPropertyValue('stroke-dashoffset'), '0');
  animation.destroy();
});

test('invalid patterns and excessive dash counts still fail before rendering', () => {
  for (const dashed of ['', '0 0', '-1 2', 'NaN 2', 'Infinity 2']) {
    assert.throws(() => setup(23, { dashed }), TypeError);
  }
  assert.throws(() => setup(100, { dashed: '.00001 .00001' }), RangeError);
});
