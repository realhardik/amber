import { test } from "node:test";
import assert from "node:assert/strict";
import { TouchTracker, keyDelta, wheelDelta } from "../../src/input.js";

const viewport = { width: 800, height: 400 };
const options = { orientation: "horizontal", wheelGesture: "both", lineHeight: 60 };
const point = (x, y) => ({ clientX: x, clientY: y, identifier: 7 });

test("horizontal wheel mode chooses the dominant delta without adding diagonals", () => {
  assert.equal(wheelDelta({ deltaX: 10, deltaY: 30, deltaMode: 0 }, options, viewport), 30);
  assert.equal(wheelDelta({ deltaX: -40, deltaY: 20, deltaMode: 0 }, options, viewport), -40);
});

test("line and page wheel units normalize to pixels on the correct axis", () => {
  assert.equal(wheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 }, options, viewport), 180);
  assert.equal(wheelDelta({ deltaX: 1, deltaY: 0, deltaMode: 2 }, options, viewport), 800);
  assert.equal(wheelDelta({ deltaX: 0, deltaY: 1, deltaMode: 2 }, options, viewport), 400);
  assert.equal(wheelDelta({ deltaX: 50, deltaY: 10, deltaMode: 0 }, { ...options, wheelGesture: "axis", orientation: "vertical" }, viewport), 10);
});

test("keyboard respects the selected axis, page width, Tab, and Shift+Space", () => {
  assert.equal(keyDelta({ key: "Tab" }, "horizontal", 800, 100), null);
  assert.equal(keyDelta({ key: "ArrowLeft" }, "vertical", 400, 100), null);
  assert.equal(keyDelta({ key: "ArrowLeft" }, "horizontal", 800, 100), -100);
  assert.equal(keyDelta({ key: "PageDown" }, "horizontal", 800, 100), 760);
  assert.equal(keyDelta({ key: " ", shiftKey: true }, "horizontal", 800, 100), -760);
  assert.equal(keyDelta({ key: "Home" }, "vertical", 400, 100), -Infinity);
  assert.equal(keyDelta({ key: "End" }, "vertical", 400, 100), Infinity);
});

test("touch drag and release retain original axis-specific velocity units", () => {
  const touch = new TouchTracker();
  touch.start(point(200, 300), 0);
  assert.deepEqual(touch.move(point(150, 280), 16), { x: 50, y: 20 });
  assert.equal(touch.release("horizontal", 20, 12, 100), 600);
  assert.equal(touch.id, null);
});

test("stationary release, taps, cancellation, and slow releases do not fling", () => {
  const touch = new TouchTracker();
  touch.start(point(200, 300), 0);
  assert.equal(touch.release("vertical", 10, 12, 100), 0);
  touch.start(point(200, 300), 0);
  touch.move(point(150, 280), 16);
  assert.equal(touch.release("vertical", 150, 12, 100), 0);
  touch.start(point(200, 300), 0);
  touch.move(point(150, 280), 16);
  touch.cancel();
  assert.equal(touch.release("vertical", 20, 12, 100), 0);
});

test('2D touch release applies freshness and the momentum threshold independently per axis', () => {
  const touch = new TouchTracker();
  touch.start(point(100, 100), 0);
  touch.move(point(90, 99.75), 16);
  assert.deepEqual(touch.release('both', 20, 12, 100), { x: 120, y: 0 });
  assert.equal(touch.id, null);
  touch.start(point(100, 100), 0);
  touch.move(point(90, 80), 16);
  assert.deepEqual(touch.release('both', 150, 12, 100), { x: 0, y: 0 });
  assert.deepEqual(touch.release('both', 151, 12, 100), { x: 0, y: 0 });
});
