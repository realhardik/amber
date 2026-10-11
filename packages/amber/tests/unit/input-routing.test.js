import test from 'node:test';
import assert from 'node:assert/strict';
import Amber from '../../src/index.js';
import { Motion } from '../../src/motion.js';
import { TouchTracker } from '../../src/input.js';
import snap from '../../src/plugins/snap.js';

function fixture(orientation = 'vertical', options = {}) {
  const amber = Object.create(Amber.prototype);
  amber.options = { orientation, renderer: 'transform', wheelGesture: orientation === 'vertical' ? 'vertical' : 'both',
    wheelMultiplier: 1, touchMultiplier: 2, smoothTouch: true, keyboardStep: 100,
    snap: 'mandatory', lineHeight: 20, touchInertia: 12, touchInertiaTimeout: 100, autoRaf: false, ...options };
  amber.motion = new Motion({ orientation, infinite: options.infinite ?? false });
  amber.motion.setLimit({ x: 1000, y: 1000 });
  amber.driver = { isHorizontal: orientation === 'horizontal', isMultiAxis: orientation === 'both',
    axis: amber.motion.axis, viewport: { width: 400, height: 200 },
    viewportSize: orientation === 'horizontal' ? 400 : 200, finiteLimit: 800, finiteLimits: { x: 800, y: 800 } };
  amber.root = { nodeType: 1, hasAttribute: () => false };
  let now = 0;
  amber.window = { getComputedStyle: element => element.computed, performance: { now: () => now } };
  amber.document = { hidden: false };
  amber.listeners = new Map();
  amber.frame = amber.lastTime = amber.nativeScrollEndTimer = null;
  amber.inputDelta = { x: 0, y: 0 };
  amber.inputTarget = { x: 0, y: 0 };
  amber.touch = new TouchTracker();
  amber.isVisible = true;
  amber.isStopped = amber.isDestroyed = amber.reducedMotion = false;
  amber.write = () => {};
  snap.install(amber);
  amber.snap.queued = 0;
  amber.snap.queue = function () { this.queued++; };
  return { amber, time: value => { now = value; }, event: (values = {}, path = []) => ({
    type: 'wheel', deltaX: 0, deltaY: 0, deltaMode: 0, cancelable: true, defaultPrevented: false,
    composedPath: () => [...path, amber.root], preventDefault() { this.defaultPrevented = true; }, ...values,
  }) };
}

test('wheel routing preserves scalar dominance, 2D diagonals, and Shift mapping', () => {
  for (const [orientation, values, expected] of [
    ['vertical', { deltaX: 60, deltaY: 30 }, { x: 0, y: 30 }],
    ['horizontal', { deltaX: 20, deltaY: 30 }, { x: 30, y: 0 }],
    ['both', { deltaX: 20, deltaY: 30 }, { x: 20, y: 30 }],
    ['both', { deltaY: 30, shiftKey: true }, { x: 30, y: 0 }],
  ]) {
    const f = fixture(orientation), event = f.event(values);
    f.amber.handleWheel(event);
    assert.deepEqual(f.amber.targetVector, expected);
    assert.equal(event.defaultPrevented, true);
    assert.equal(f.amber.snap.queued, 1);
  }
});

test('horizontal mapping still yields to native vertical descendants, including managed wheel', () => {
  const f = fixture('horizontal', { managedWheel: true });
  const child = { nodeType: 1, hasAttribute: () => false, scrollHeight: 500, clientHeight: 100, scrollTop: 50,
    computed: { overflowY: 'auto' } };
  const first = f.event({ deltaY: 40 }, [child]);
  f.amber.handleWheel(first);
  assert.equal(first.defaultPrevented, false);
  assert.equal(f.amber.target, 0);
  child.scrollTop = 400;
  const second = f.event({ deltaY: 40 }, [child]);
  f.amber.handleWheel(second);
  assert.equal(second.defaultPrevented, true);
  assert.equal(f.amber.target, 40);
});

test('a native descendant owning one 2D component receives the entire gesture', () => {
  const f = fixture('both', { managedWheel: true });
  const child = { nodeType: 1, hasAttribute: () => false, scrollWidth: 500, clientWidth: 100, scrollLeft: 50,
    computed: { overflowX: 'auto' } };
  const event = f.event({ deltaX: 40, deltaY: 60 }, [child]);
  f.amber.handleWheel(event);
  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(f.amber.targetVector, { x: 0, y: 0 });
});

for (const orientation of ['vertical', 'horizontal', 'both']) {
  test(`${orientation}: settled edges release, moving edges retain input, and stop prevents movement`, () => {
    const f = fixture(orientation, { scrollChain: true });
    f.amber.motion.jump({ x: 1000, y: 1000 });
    const released = f.event({ deltaY: 20 });
    f.amber.handleWheel(released);
    assert.equal(released.defaultPrevented, false);
    f.amber.motion.jump({ x: 900, y: 900 });
    f.amber.motion.moveTo({ x: 1000, y: 1000 });
    const moving = f.event({ deltaY: 20 });
    f.amber.handleWheel(moving);
    assert.equal(moving.defaultPrevented, true);
    f.amber.stop();
    const stopped = f.event({ deltaY: -20 });
    f.amber.handleWheel(stopped);
    assert.equal(stopped.defaultPrevented, true);
    assert.equal(f.amber.isScrolling, false);
  });

  test(`${orientation}: new input interrupts a snap from the current position`, () => {
    const f = fixture(orientation);
    f.amber.motion.jump({ x: 40, y: 40 });
    f.amber.motion.moveTo({ x: 100, y: 100 });
    f.amber.snap.snapping = true;
    f.amber.handleWheel(f.event({ deltaY: 10 }));
    assert.equal(f.amber.target, 50);
    if (orientation === 'both') assert.equal(f.amber.targetVector.x, 40);
    assert.equal(f.amber.snap.queued, 1);
  });
}

test('noncancelable, prevented, zero, and zoom wheel input do not move the target', () => {
  for (const orientation of ['vertical', 'both']) {
    const f = fixture(orientation);
    for (const values of [{ cancelable: false }, { defaultPrevented: true }, { ctrlKey: true }, { metaKey: true }, { deltaY: 0 }]) {
      f.amber.handleWheel(f.event({ deltaY: 20, ...values }));
    }
    assert.deepEqual(f.amber.targetVector, { x: 0, y: 0 });
    assert.equal(f.amber.snap.queued, 0);
  }
});

test('Home and End retain loop boundaries and mixed finite/infinite 2D destinations', () => {
  for (const orientation of ['vertical', 'horizontal', 'both']) {
    const f = fixture(orientation, { infinite: orientation === 'both' ? { x: true } : true });
    f.amber.motion.jump({ x: 900, y: 900 });
    f.amber.handleKey(f.event({ type: 'keydown', key: 'End' }));
    assert.deepEqual(f.amber.targetVector, orientation === 'both' ? { x: 800, y: 1000 }
      : orientation === 'horizontal' ? { x: 800, y: 0 } : { x: 0, y: 800 });
    f.amber.handleKey(f.event({ type: 'keydown', key: 'Home' }));
    assert.deepEqual(f.amber.targetVector, { x: 0, y: 0 });
  }
});

test('scalar addition overflow still clamps to the finite boundary', () => {
  const f = fixture();
  f.amber.motion.setLimit(1e308);
  f.amber.motion.jump(5e307);
  f.amber.motion.moveTo(1e308);
  const event = f.event({ deltaY: 1e308 });
  f.amber.handleWheel(event);
  assert.equal(f.amber.target, 1e308);
  assert.equal(event.defaultPrevented, true);
});

test('touch axis locking, scaled drag, and unscaled release momentum are retained', () => {
  for (const orientation of ['vertical', 'horizontal', 'both']) {
    const f = fixture(orientation);
    const start = { identifier: 7, clientX: 200, clientY: 300 };
    f.amber.handleTouchStart(f.event({ type: 'touchstart', touches: [start] }));
    f.time(16);
    const point = { identifier: 7, clientX: 180, clientY: 280 };
    f.amber.handleTouchMove(f.event({ type: 'touchmove', touches: [point] }));
    assert.equal(f.amber.target, 40);
    f.time(20);
    f.amber.handleTouchEnd({ touches: [], changedTouches: [point] });
    assert.equal(f.amber.target, 280); // 40px drag + 20px/frame * 12 inertia.
    if (orientation === 'both') assert.equal(f.amber.targetVector.x, 280);
    assert.equal(f.amber.touch.id, null);
  }
  const f = fixture('horizontal');
  f.amber.touch.start({ identifier: 7, clientX: 200, clientY: 300 }, 0);
  f.time(16);
  f.amber.handleTouchMove(f.event({ type: 'touchmove', touches: [{ identifier: 7, clientX: 199, clientY: 250 }] }));
  assert.equal(f.amber.touch.id, null);
  assert.equal(f.amber.target, 0);
});

test('a delegated touch release never adds momentum', () => {
  const f = fixture('both');
  f.amber.touch.start({ identifier: 7, clientX: 200, clientY: 300 }, 0);
  f.amber.touch.move({ identifier: 7, clientX: 150, clientY: 250 }, 16);
  f.amber.touchDelegated = true;
  f.time(20);
  f.amber.handleTouchEnd({ touches: [], changedTouches: [{ identifier: 7 }] });
  assert.deepEqual(f.amber.targetVector, { x: 0, y: 0 });
  assert.equal(f.amber.snap.queued, 0);
  assert.equal(f.amber.touch.id, null);
});

for (const managedWheel of [false, true]) {
  test(`diagonal routing walks once and reads each descendant style once (managed: ${managedWheel})`, () => {
    for (const [overflowY, overscrollBehaviorY, scrollTop, ignored] of [
      ['auto', 'auto', 400, false],
      ['auto', 'auto', 50, true],
      ['auto', 'contain', 400, true],
      ['hidden', 'contain', 50, false],
    ]) {
      const f = fixture('both', { managedWheel });
      const child = { nodeType: 1, hasAttribute: () => false,
        scrollWidth: 500, clientWidth: 100, scrollLeft: 400,
        scrollHeight: 500, clientHeight: 100, scrollTop,
        computed: { overflowX: 'auto', overflowY, overscrollBehaviorY } };
      let paths = 0, styles = 0;
      f.amber.window.getComputedStyle = element => { styles++; return element.computed; };
      const event = f.event({ deltaX: 40, deltaY: 60,
        composedPath: () => { paths++; return [child, f.amber.root]; } });
      f.amber.handleWheel(event);
      assert.deepEqual(f.amber.targetVector, ignored ? { x: 0, y: 0 } : { x: 40, y: 60 });
      assert.equal(event.defaultPrevented, !ignored);
      assert.equal(paths, 1);
      assert.equal(styles, 1);
    }
  });
}

test('managed wheel fallback claims a settled edge without repeating routing', () => {
  for (const orientation of ['vertical', 'horizontal', 'both']) {
    const f = fixture(orientation, { managedWheel: true, scrollChain: true });
    let paths = 0;
    const event = f.event({ deltaY: -40, composedPath: () => { paths++; return [f.amber.root]; } });
    f.amber.handleWheel(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(f.amber.target, 0);
    assert.equal(paths, 1);
  }
});

test('combined routing respects prevent markers and stops at its own root', () => {
  const f = fixture('both', { managedWheel: true });
  const prevent = { nodeType: 1, hasAttribute: () => true };
  const blocked = f.event({ deltaX: 10, deltaY: 20 }, [prevent]);
  f.amber.handleWheel(blocked);
  assert.equal(blocked.defaultPrevented, false);
  assert.deepEqual(f.amber.targetVector, { x: 0, y: 0 });
  const allowed = f.event({ deltaX: 10, deltaY: 20, composedPath: () => [f.amber.root, prevent] });
  f.amber.handleWheel(allowed);
  assert.equal(allowed.defaultPrevented, true);
  assert.deepEqual(f.amber.targetVector, { x: 10, y: 20 });
});

for (const key of ['Home', 'End']) {
  test(`2D ${key} yields to either nested axis, respects containment and accepts edge handoff`, () => {
    for (const axis of ['x', 'y']) {
      const f = fixture('both');
      f.amber.motion.jump({ x: 100, y: 100 });
      const horizontal = axis === 'x';
      const child = { nodeType: 1, hasAttribute: () => false,
        scrollWidth: horizontal ? 500 : 100, clientWidth: 100, scrollLeft: horizontal ? 200 : 0,
        scrollHeight: horizontal ? 100 : 500, clientHeight: 100, scrollTop: horizontal ? 0 : 200,
        computed: { overflowX: 'auto', overflowY: 'auto' } };
      const send = () => {
        const event = f.event({ type: 'keydown', key }, [child]);
        f.amber.handleKey(event);
        return event;
      };
      assert.equal(send().defaultPrevented, false);
      assert.deepEqual(f.amber.targetVector, { x: 100, y: 100 });
      child[horizontal ? 'scrollLeft' : 'scrollTop'] = key === 'Home' ? 0 : 400;
      child.computed[horizontal ? 'overscrollBehaviorX' : 'overscrollBehaviorY'] = 'contain';
      assert.equal(send().defaultPrevented, false);
      child.computed[horizontal ? 'overscrollBehaviorX' : 'overscrollBehaviorY'] = 'auto';
      assert.equal(send().defaultPrevented, true);
      assert.deepEqual(f.amber.targetVector, key === 'Home' ? { x: 0, y: 0 } : { x: 1000, y: 1000 });
    }
  });
}
