import test from 'node:test';
import assert from 'node:assert/strict';
import { Animation, Timeline } from '../src/index.js';
import { Animation as SvgAnimation } from '../src/svg.js';
import { environment, element } from './helpers.js';

for (const duration of [0, 100]) {
  test(`timeline completion can restart without stalling (${duration}ms)`, () => {
    const env = environment(), el = element(env);
    let completions = 0;
    const timeline = new Timeline({ onComplete: current => {
      if (++completions === 1) current.restart();
    } });
    timeline.from({ el, t: { o: [0, 1] }, d: duration, scheduler: env.scheduler }).play();
    if (duration) {
      env.frame(0); env.frame(100);
      assert.equal(timeline.status, 'running');
      assert.ok(timeline.current);
      assert.equal(env.frames.size, 1);
      env.frame(200); env.frame(300);
    }
    assert.equal(completions, 2);
    assert.equal(timeline.status, 'finished');
    assert.equal(env.frames.size, 0);
    assert.deepEqual(env.errors, []);
    timeline.destroy();
  });
}

test('timeline resumes the current reverse direction and uses the resumed completion callback', () => {
  const env = environment(), el = element(env), calls = [];
  const timeline = new Timeline({ onComplete: () => calls.push('old') });
  timeline.from({ el, t: { o: [0, 1] }, reverse: true, d: 100, scheduler: env.scheduler }).play();
  env.frame(0); env.frame(40);
  assert.equal(+el.style.getPropertyValue('opacity'), .6);
  timeline.pause().play(() => calls.push('resumed'));
  env.frame(100); env.frame(120);
  assert.equal(+el.style.getPropertyValue('opacity'), .4);
  env.frame(160);
  assert.equal(+el.style.getPropertyValue('opacity'), 0);
  assert.deepEqual(calls, ['resumed']);
  assert.equal(env.frames.size, 0);
  timeline.destroy();
});

for (const reverse of [false, true]) {
  test(`play can change direction during an endpoint update (reverse: ${reverse})`, () => {
    const env = environment(), el = element(env);
    let switched = false, completions = 0;
    const animation = new Animation({ el, t: { o: [0, 1] }, reverse, d: 100, scheduler: env.scheduler,
      onUpdate(progress, current) {
        if (!switched && progress === (reverse ? 0 : 1)) {
          switched = true;
          current.play({ rev: !reverse });
        }
      },
      onComplete() { completions++; },
    }).play();
    env.frame(0); env.frame(100);
    assert.equal(animation.status, 'running');
    assert.equal(completions, 0);
    env.frame(150);
    assert.equal(animation.progress, .5);
    env.frame(200);
    assert.equal(animation.progress, reverse ? 1 : 0);
    assert.equal(completions, 1);
    assert.equal(env.frames.size, 0);
    animation.destroy();
  });
}

test('playing the same direction during an update still allows completion', () => {
  const env = environment(), el = element(env);
  const animation = new Animation({ el, t: { o: [0, 1] }, d: 100, scheduler: env.scheduler,
    onUpdate: (_, current) => current.play(),
  }).play();
  env.frame(0); env.frame(100);
  assert.equal(animation.status, 'finished');
  assert.equal(env.frames.size, 0);
  animation.destroy();
});

test('two-point polylines morph and restore while malformed shapes are rejected', () => {
  const env = environment(), el = element(env);
  el.setAttribute('points', '0,0 10,10');
  const animation = new SvgAnimation({ el, morph: { type: 'polyline', end: '0,0 20,20' } });
  animation.seek(.5);
  assert.equal(el.getAttribute('points'), '0 0 15 15');
  animation.destroy();
  assert.equal(el.getAttribute('points'), '0,0 10,10');
  for (const [type, start, end] of [
    ['polygon', '0,0 10,10', '0,0 20,20'],
    ['polyline', '0,0', '1,1'],
    ['polyline', '0,0 10', '0,0 20'],
    ['polyline', '0,0 10,10', '0,0 20,20 30,30'],
  ]) assert.throws(() => new SvgAnimation({ el, morph: { type, start, end } }), TypeError);
});
