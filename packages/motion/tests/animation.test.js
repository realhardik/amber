import test from 'node:test';
import assert from 'node:assert/strict';
import { Animation, FrameRunner, Tab, Timeline, bindScroll, easings } from '../src/index.js';
import { Animation as SvgAnimation, Timeline as SvgTimeline, morphInterpolator } from '../src/svg.js';
import { environment, element, amberMock } from './helpers.js';

function setup(options = {}) {
  const env = environment(), el = element(env);
  const animation = new Animation({ el, t: { o: { v: [0, 1] } }, d: 100, scheduler: env.scheduler, ...options });
  return { ...env, el, animation, opacity: () => +el.style.getPropertyValue('opacity') };
}

test('axis-aware bindings read vector state without changing legacy scalar bindings', () => {
  const x = setup(), y = setup(), scalar = setup(), amber = amberMock();
  amber.state.progress = .3; amber.state.progressVector = { x: .2, y: .8 };
  const bx = bindScroll(amber, x.animation, { axis: 'x' });
  const by = bindScroll(amber, y.animation, { axis: 'y' });
  const bs = bindScroll(amber, scalar.animation);
  assert.equal(x.opacity(), .2); assert.equal(y.opacity(), .8); assert.equal(scalar.opacity(), .3);
  amber.state.progressVector.x = .6; amber.emit('scroll'); assert.equal(x.opacity(), .6);
  bx.destroy(); by.destroy(); bs.destroy();
  assert.throws(() => bindScroll(amber, x.animation, { axis: 'z' }), /axis/);
  delete amber.state.progressVector;
  assert.throws(() => bindScroll(amber, x.animation, { axis: 'x' }), /finite/);
  assert.equal(amber.listenerCount, 0);
  x.animation.destroy(); y.animation.destroy(); scalar.animation.destroy();
});

test('pause and play preserve time and initial delay; no duplicate completion', () => {
  let complete = 0;
  const e = setup({ delay: 50, onComplete: () => complete++ });
  e.animation.play(); e.frame(0); e.frame(25);
  e.animation.pause(); assert.equal(e.frames.size, 0);
  e.animation.play(); e.frame(5000); e.frame(5025);
  assert.equal(e.opacity(), 0);
  e.frame(5075); assert.equal(e.opacity(), .5);
  e.animation.pause(); e.animation.play(); e.frame(10000); e.frame(10050);
  assert.equal(e.opacity(), 1); assert.equal(complete, 1);
  e.frame(11000); assert.equal(complete, 1);
  assert.equal(e.frames.size, 0); assert.equal(e.visibility.size, 0); assert.equal(e.mediaListeners.size, 0);
});

test('reverse preserves original endpoints and supports repeated direction changes', () => {
  const e = setup(); e.animation.play(); e.frame(0); e.frame(60);
  assert.equal(e.opacity(), .6);
  e.animation.reverse(); e.frame(80); assert.ok(Math.abs(e.opacity() - .4) < 1e-9);
  e.animation.reverse(); e.frame(100); assert.equal(e.opacity(), .6);
  e.frame(140); assert.equal(e.opacity(), 1);
  e.animation.reverse(); e.frame(200); e.frame(300); assert.equal(e.opacity(), 0);
  e.animation.reverse(); e.frame(400); e.frame(500); assert.equal(e.opacity(), 1);
});

test('play rev selects direction from the paused playhead and defaults forward', () => {
  const e = setup();
  e.animation.play(); e.frame(0); e.frame(60); e.animation.pause();
  e.animation.play({ rev: true }); e.frame(100); e.frame(120);
  assert.ok(Math.abs(e.opacity() - .4) < 1e-9);
  e.animation.pause(); e.animation.play({ rev: false }); e.frame(200); e.frame(220);
  assert.equal(e.opacity(), .6);
  e.animation.pause(); e.animation.play(); e.frame(300); e.frame(320);
  assert.equal(e.opacity(), .8);
  assert.throws(() => e.animation.pause().play({ rev: 1 }));
  assert.equal(typeof e.animation.resume, 'undefined');
});

test('seek after completion plays from selected position; seeks do not fire completion', () => {
  let count = 0;
  const e = setup({ onComplete: () => count++ });
  e.animation.finish(); assert.equal(count, 1);
  e.animation.seek(.25).play(); e.frame(0); e.frame(25); assert.equal(e.opacity(), .5);
  e.frame(75); assert.equal(count, 2);
  e.animation.seek(.75); assert.equal(count, 2);
});

test('zero duration and reverse zero duration finish synchronously without NaN', () => {
  let count = 0;
  const e = setup({ d: 0, onComplete: () => count++ });
  assert.equal(e.opacity(), 0);
  e.animation.play(); assert.equal(e.opacity(), 1);
  e.animation.reverse(); assert.equal(e.opacity(), 0);
  assert.equal(count, 2); assert.equal(e.frames.size, 0);
});

test('stagger reverses in element order without jumps', () => {
  const e = environment(), a = element(e), b = element(e);
  const animation = new Animation({ el: [a, b], t: { o: [0, 1] }, d: 100, de: 50, scheduler: e.scheduler });
  animation.seek(.5);
  assert.equal(+a.style.getPropertyValue('opacity'), .75);
  assert.equal(+b.style.getPropertyValue('opacity'), .25);
  animation.reverse(); e.frame(0); e.frame(25);
  assert.equal(+a.style.getPropertyValue('opacity'), .5);
  assert.equal(+b.style.getPropertyValue('opacity'), 0);
});

test('timestamp timing is refresh-rate independent and speed can change', () => {
  for (const hz of [30, 60, 120, 144]) {
    const e = setup({ d: 1000 }); e.animation.play(); e.frame(0);
    for (let i = 1; i <= hz; i++) e.frame(i * 1000 / hz);
    assert.equal(e.opacity(), 1); assert.equal(e.animation.status, 'finished');
  }
  const e = setup(); e.animation.setPlaybackRate(2).play(); e.frame(0); e.frame(25); assert.equal(e.opacity(), .5);
});

test('hidden tabs freeze time, restart active runners, and leave manually paused ones paused', () => {
  const e = setup(); e.animation.play(); e.frame(0); e.frame(20);
  e.hide(true); assert.equal(e.frames.size, 0);
  e.hide(false); e.frame(5000); assert.equal(e.opacity(), .2);
  e.frame(5020); assert.equal(e.opacity(), .4);
  e.hide(true); e.animation.pause(); e.hide(false);
  assert.equal(e.frames.size, 0); assert.equal(e.animation.status, 'paused');
});

test('FrameRunner shares one frame and retains each callback argument list', () => {
  const e = environment(), calls = [];
  const a = new FrameRunner((time, arg) => calls.push(['a', time, arg]), { scheduler: e.scheduler });
  const b = new FrameRunner((time, arg) => calls.push(['b', time, arg]), { scheduler: e.scheduler });
  a.run('first'); b.run('second'); assert.equal(e.frames.size, 1);
  e.frame(0); e.frame(10);
  assert.deepEqual(calls.slice(-2), [['a', 10, 'first'], ['b', 10, 'second']]);
  a.pause(); a.run('first'); e.frame(50); assert.equal(calls.at(-1)[1], 0);
  a.destroy(); b.destroy(); assert.equal(e.frames.size, 0); assert.equal(e.visibility.size, 0);
});

test('failing callbacks are isolated; destroying another runner during a frame is safe', () => {
  const e = environment(); let count = 0;
  const b = new FrameRunner(() => count++, { scheduler: e.scheduler });
  const a = new FrameRunner(() => { b.destroy(); throw Error('expected'); }, { scheduler: e.scheduler });
  a.run(); b.run(); e.frame(0);
  assert.equal(count, 0); assert.equal(e.errors.length, 1); assert.equal(e.frames.size, 0);
});

test('Tab subscription removal and destruction detach browser events', () => {
  const e = environment(), tab = new Tab(e.document), states = [];
  const off = tab.add(hidden => states.push(hidden));
  e.hide(true); off(); e.hide(false); assert.deepEqual(states, [true]);
  tab.destroy(); assert.equal(e.visibility.size, 0);
});

test('numeric CSS, transforms, clip and opacity combine and restore owned properties', () => {
  const e = environment(), el = element(e, { transform: 'rotate(9deg)', opacity: '.3', color: 'red' });
  const a = new Animation({ el, t: { x: { v: [0, 100], unit: 'px' }, r: [0, 90], s: [1, 2], c: [100, 0], o: [0, 1], '--amount': [0, 20] } });
  a.seek(.5);
  assert.equal(el.style.getPropertyValue('transform'), 'translateX(50px) rotate(45deg) scale(1.5)');
  assert.equal(el.style.getPropertyValue('clip-path'), 'inset(50% 0% 0% 0%)');
  assert.equal(el.style.getPropertyValue('opacity'), '0.5');
  assert.equal(el.style.getPropertyValue('--amount'), '10');
  const writes = el.writes; a.seek(.5); assert.equal(el.writes, writes);
  assert.equal('arc' in el, false);
  a.destroy(); assert.equal(el.style.getPropertyValue('transform'), 'rotate(9deg)');
  assert.equal(el.style.getPropertyValue('opacity'), '.3'); assert.equal(el.style.getPropertyValue('color'), 'red');
});

test('SVG scientific notation, polygon morphs, compatibility and arc validation', () => {
  const morph = morphInterpolator('M1e-3 -2 L10 20 Z', 'M2e-3 2 L30 40 Z');
  assert.equal(morph(.5), 'M 0.0015 0 L 20 30 Z');
  assert.equal(morphInterpolator('0,0 10,0 5,10', '0,0 20,0 10,20', true)(.5), '0 0 15 0 7.5 15');
  for (const end of ['M0 0 Q10 20 30 40', 'M0 0 L1', 'M0 0 X2 3']) assert.throws(() => morphInterpolator('M0 0 L10 20', end));
  assert.throws(() => morphInterpolator('M0 0 A5 5 0 0 1 10 10', 'M0 0 A5 5 0 1 1 10 10'));
  assert.throws(() => morphInterpolator('M0 0 A-5 5 0 0 1 10 10', 'M0 0 A5 5 0 0 1 10 10'));
});

test('SVG morphs and stroke drawing restore original attributes and styles', () => {
  const e = environment(), el = element(e);
  el.setAttribute('d', 'M0 0 L10 10');
  const a = new SvgAnimation({ el, m: { type: 'path', end: ['M0 0 L20 20'] }, l: { start: 0, end: 100, dashed: '2 3' } });
  a.seek(.5); assert.equal(el.getAttribute('d'), 'M 0 0 L 15 15');
  assert.equal(el.style.getPropertyValue('stroke-dashoffset'), '50');
  a.destroy(); assert.equal(el.getAttribute('d'), 'M0 0 L10 10');
  assert.equal(el.style.getPropertyValue('stroke-dasharray'), '');
  assert.throws(() => new SvgAnimation({ el, l: { dashed: '0 0' } }));
  assert.throws(() => new Animation({ el, m: { end: 'M0 0 L20 20' } }), /amber-motion\/svg/);
});

test('SVG timeline creates SVG-capable steps without loading them into the CSS timeline', () => {
  const e = environment(), el = element(e);
  el.setAttribute('d', 'M0 0 L10 10');
  const timeline = new SvgTimeline();
  timeline.from({ el, m: { end: 'M0 0 L20 20' }, scheduler: e.scheduler, d: 100 }).play();
  e.frame(0); e.frame(50);
  assert.equal(el.getAttribute('d'), 'M 0 0 L 15 15');
  timeline.destroy();
  assert.equal(el.getAttribute('d'), 'M0 0 L10 10');
});

test('invalid options fail early and all built-in easings have valid endpoints', () => {
  for (const options of [{ d: -1 }, { easing: 'missing' }, { playbackRate: 0 }, { t: { o: [0, NaN] } }]) assert.throws(() => setup(options));
  for (const ease of Object.values(easings)) { assert.ok(Math.abs(ease(0)) < 1e-9); assert.ok(Math.abs(ease(1) - 1) < 1e-9); }
});

test('reduced motion finishes active playback and scroll bindings settle at a chosen state', () => {
  const e = setup(); e.animation.play(); e.frame(0); e.frame(20); e.reduce(true);
  assert.equal(e.opacity(), 1); assert.equal(e.frames.size, 0);
  const amber = amberMock(), binding = bindScroll(amber, e.animation, { reducedMotionProgress: .8 });
  assert.equal(e.opacity(), .8); e.reduce(false); assert.equal(e.opacity(), 0);
  binding.destroy(); assert.equal(e.mediaListeners.size, 0);
});

test('scroll uses smoothed state, supports reverse and dynamic ranges, and never starts RAF', () => {
  const e = setup(), amber = amberMock();
  const binding = bindScroll(amber, e.animation, { source: 'position', start: s => s.limit, end: 0 });
  assert.equal(e.opacity(), 1);
  amber.state.position = 250; amber.emit('scroll'); assert.equal(e.opacity(), .75);
  amber.state.limit = 500; amber.emit('resize'); assert.equal(e.opacity(), .5);
  binding.pause(); amber.state.position = 500; amber.emit('scroll'); assert.equal(e.opacity(), .5);
  binding.play(); assert.equal(e.opacity(), 0); assert.equal(e.frames.size, 0);
  amber.destroy(); assert.equal(amber.listenerCount, 0); assert.equal(e.mediaListeners.size, 0);
});

test('animation destruction detaches bindings and invalid ranges leak no subscriptions', () => {
  const e = setup(), amber = amberMock(); bindScroll(amber, e.animation);
  e.animation.destroy(); assert.equal(amber.listenerCount, 0);
  const f = setup(); assert.throws(() => bindScroll(amber, f.animation, { start: 1, end: 1 }));
  assert.equal(amber.listenerCount, 0); assert.equal(f.mediaListeners.size, 0);
});

test('timelines pause/play, invoke callbacks once, and restore sequential style changes', () => {
  const e = environment(), el = element(e, { opacity: '.8' }), calls = [];
  const timeline = new Timeline({ onComplete: () => calls.push('done') });
  timeline.from({ el, t: { o: [0, 1] }, d: 100, scheduler: e.scheduler }).from(() => calls.push('middle')).from({ el, t: { o: [1, 0] }, d: 100, scheduler: e.scheduler });
  timeline.play(); e.frame(0); e.frame(50); timeline.pause();
  timeline.play(); e.frame(500); e.frame(550); assert.deepEqual(calls, ['middle']);
  e.frame(600); e.frame(700); assert.deepEqual(calls, ['middle', 'done']);
  timeline.destroy(); assert.equal(el.style.getPropertyValue('opacity'), '.8');
});

test('timelines process zero-duration steps iteratively and support pause between steps', () => {
  const e = environment(), el = element(e); let count = 0;
  const timeline = new Timeline();
  for (let i = 0; i < 1500; i++) timeline.from({ el, t: { o: [0, 1] }, d: 0 });
  timeline.from(() => timeline.pause()).from(() => count++);
  timeline.play(); assert.equal(timeline.status, 'paused'); assert.equal(count, 0);
  timeline.play(); assert.equal(count, 1); assert.equal(timeline.status, 'finished'); timeline.destroy();
});

test('completion callback can replay without the old tick stopping the new run', () => {
  let calls = 0;
  const e = setup({ onComplete: a => { if (++calls === 1) a.restart(); } });
  e.animation.play(); e.frame(0); e.frame(100);
  assert.equal(e.animation.isPlaying, true); e.frame(200); e.frame(300);
  assert.equal(calls, 2); assert.equal(e.frames.size, 0);
});

test('replaying a delayed zero-duration animation resets its appearance during the delay', () => {
  const e = setup({ duration: 0, delay: 50 });
  e.animation.play(); e.frame(0); e.frame(50); assert.equal(e.opacity(), 1);
  e.animation.play(); e.frame(100); e.frame(125); assert.equal(e.opacity(), 0);
  e.frame(150); assert.equal(e.opacity(), 1);
});

test('numeric custom properties preserve case and z uses a valid length unit', () => {
  const e = environment(), el = element(e);
  const a = new Animation({ el, properties: { '--myProgress': [0, 1], z: [0, 100] } });
  a.seek(.5);
  assert.equal(el.style.getPropertyValue('--myProgress'), '0.5');
  assert.equal(el.style.getPropertyValue('transform'), 'translateZ(50px)');
  a.destroy();
});

test('incompatible Amber versions roll back partially installed scroll listeners', () => {
  const e = setup(), amber = amberMock(), on = amber.on;
  amber.on = (type, callback) => {
    if (type === 'destroy') throw new TypeError('Unknown event');
    return on(type, callback);
  };
  assert.throws(() => bindScroll(amber, e.animation));
  assert.equal(amber.listenerCount, 0);
  assert.equal(e.mediaListeners.size, 0);
});
