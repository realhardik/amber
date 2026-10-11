import test from 'node:test';
import assert from 'node:assert/strict';
import { Animation, bindScroll, resetAll } from '../src/index.js';
import { Animation as SvgAnimation } from '../src/svg.js';
import { environment, element, amberMock } from './helpers.js';

test('resetAll rewinds running, paused, finished and reversed animations without callbacks', () => {
  const env = environment();
  let updates = 0, completes = 0;
  const animations = Array.from({ length: 4 }, () => new Animation({
    targets: element(env), properties: { x: [10, 90, 'px'], o: [.2, 1] },
    duration: 100, delay: 50, scheduler: env.scheduler,
    onUpdate: () => updates++, onComplete: () => completes++,
  }));
  animations[0].play(); env.frame(0); env.frame(75);
  animations[1].seek(.4);
  animations[2].finish();
  animations[3].seek(.8).play({ rev: true });
  const before = [updates, completes];
  resetAll(animations);
  assert.deepEqual([updates, completes], before);
  for (const animation of animations) {
    assert.equal(animation.status, 'paused');
    assert.equal(animation.progress, 0);
    assert.equal(animation.time, 0);
    assert.equal(animation.direction, 1);
    assert.equal(animation.elements[0].style.getPropertyValue('transform'), 'translateX(10px)');
    assert.equal(animation.elements[0].style.getPropertyValue('opacity'), '0.2');
  }
  assert.equal(env.frames.size, 0);
  assert.equal(env.mediaListeners.size, 0);
  assert.equal(env.visibility.size, 0);
  animations[0].play(); env.frame(1000); env.frame(1025);
  assert.equal(animations[0].progress, 0);
  env.frame(1075); assert.equal(animations[0].progress, .25);
  animations.forEach(animation => animation.destroy());
});

test('resetAll pauses all attached bindings, preserves other animations, and can reattach scroll control', () => {
  const env = environment(), amber = amberMock();
  const make = () => new Animation({ targets: element(env), properties: { o: [0, 1] } });
  const animation = make(), other = make();
  const first = bindScroll(amber, animation), second = bindScroll(amber, animation);
  bindScroll(amber, other);
  amber.state.progress = .75; amber.emit('scroll');
  resetAll(new Set([animation]));
  amber.state.progress = .5; amber.emit('scroll'); amber.emit('resize'); env.reduce(true);
  first.update(); second.update();
  assert.equal(animation.progress, 0);
  assert.equal(other.progress, 1); // other binding still respects reduced motion
  env.reduce(false);
  first.play(); assert.equal(animation.progress, .5);
  first.destroy(); second.destroy();
  animation.reset().seek(.2);
  amber.emit('scroll'); assert.equal(animation.progress, .2);
  animation.destroy(); other.destroy();
  assert.equal(amber.listenerCount, 0);
  assert.equal(env.mediaListeners.size, 0);
});

test('reset is exact for zero duration, stagger, SVG morph, line and clipping', () => {
  const env = environment(), a = element(env), b = element(env);
  const stagger = new Animation({ targets: [a, b], duration: 0, stagger: 50, properties: { o: [0, 1] } });
  const instant = new Animation({ targets: element(env), duration: 0, properties: { o: [0, 1] } });
  const path = element(env);
  const start = 'M0 0 L10 10';
  path.setAttribute('d', start);
  const svg = new SvgAnimation({ targets: path, morph: { end: 'M0 0 L20 30' }, line: {}, properties: { c: [100, 0] } });
  for (const animation of [stagger, instant, svg]) animation.seek(1);
  resetAll([stagger, instant, svg]);
  for (const el of [a, b, instant.elements[0]]) assert.equal(el.style.getPropertyValue('opacity'), '0');
  assert.equal(path.getAttribute('d'), start);
  assert.equal(path.style.getPropertyValue('stroke-dashoffset'), '100');
  assert.equal(path.style.getPropertyValue('clip-path'), 'inset(100% 0% 0% 0%)');
  instant.play(); assert.equal(instant.progress, 1);
  [stagger, instant, svg].forEach(animation => animation.destroy());
});

test('resetAll validates scope before changes, deduplicates and ignores destroyed animations', () => {
  const env = environment(), el = element(env, { opacity: '.7' });
  const animation = new Animation({ targets: el, properties: { o: [0, 1] } });
  animation.seek(.5);
  assert.throws(() => resetAll(), TypeError);
  assert.throws(() => resetAll([animation, {}]), TypeError);
  assert.equal(animation.progress, .5);
  let calls = 0;
  const reset = animation.reset.bind(animation);
  animation.reset = () => { calls++; return reset(); };
  resetAll([animation, animation]); assert.equal(calls, 1);
  resetAll([]);
  animation.destroy(); resetAll([animation]);
  assert.equal(animation.status, 'destroyed');
  assert.equal(el.style.getPropertyValue('opacity'), '.7');
});

test('reset from an update callback cancels completion and leaves no scheduled frame', () => {
  const env = environment();
  let completes = 0;
  const animation = new Animation({ targets: element(env), properties: { o: [0, 1] },
    duration: 100, scheduler: env.scheduler,
    onUpdate: (progress, current) => { if (progress === 1) resetAll([current]); },
    onComplete: () => completes++,
  });
  animation.play(); env.frame(0); env.frame(100);
  assert.equal(animation.progress, 0);
  assert.equal(animation.status, 'paused');
  assert.equal(completes, 0);
  assert.equal(env.frames.size, 0);
  animation.destroy();
});
