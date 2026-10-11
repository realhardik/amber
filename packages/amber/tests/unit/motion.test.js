import { test } from "node:test";
import assert from "node:assert/strict";
import Amber from "../../src/index.js";
import transform from "../../src/transform.js";
import snap from "../../src/plugins/snap.js";
import pinning from "../../src/plugins/pinning.js";
import sections from "../../src/plugins/sections.js";
import { Motion, FRAME_MS } from "../../src/motion.js";

test("module imports without window, document, or browser side effects", () => {
  assert.equal(typeof Amber, "function");
  assert.throws(() => new Amber(), /browser/);
});

test("one reference frame preserves the original 9% blend", () => {
  const motion = new Motion();
  motion.setLimit(1000);
  motion.moveTo(1000);
  motion.advance(FRAME_MS);
  assert.ok(Math.abs(motion.position - 90) < 1e-10);
});

test("equal elapsed time gives the same trajectory at 30, 60, 120, and 144 Hz", () => {
  const positions = [30, 60, 120, 144].map(hz => {
    const motion = new Motion();
    motion.setLimit(10000);
    motion.moveTo(10000);
    for (let frame = 0; frame < hz / 2; frame++) motion.advance(1000 / hz);
    return motion.position;
  });
  for (const position of positions) assert.ok(Math.abs(position - positions[0]) < 1e-8);
});

test("movement clamps at each boundary, settles exactly, and never overshoots", () => {
  const motion = new Motion();
  motion.setLimit(800);
  motion.moveTo(2000);
  assert.equal(motion.target, 800);
  let previous = 0;
  for (let frame = 0; frame < 200; frame++) {
    motion.advance(FRAME_MS);
    assert.ok(motion.position >= previous && motion.position <= 800);
    previous = motion.position;
  }
  assert.equal(motion.position, 800);
  assert.equal(motion.isScrolling, false);
  motion.moveTo(-100);
  motion.advance(FRAME_MS);
  assert.equal(motion.target, 0);
  assert.equal(motion.direction, -1);
});

test("content shrinking clamps both positions and handles a non-scrollable viewport", () => {
  const motion = new Motion();
  motion.setLimit(1000);
  motion.jump(800);
  motion.setLimit(300);
  assert.equal(motion.position, 300);
  assert.equal(motion.target, 300);
  motion.setLimit(-100);
  assert.equal(motion.limit, 0);
  assert.equal(motion.position, 0);
  assert.equal(motion.progress, 0);
});

test("zero delta does not advance and reverse input changes direction", () => {
  const motion = new Motion();
  motion.setLimit(1000);
  motion.moveTo(1000);
  motion.advance(0);
  assert.equal(motion.position, 0);
  motion.advance(FRAME_MS);
  assert.ok(motion.velocity > 0);
  motion.moveTo(0);
  motion.advance(FRAME_MS);
  assert.ok(motion.velocity < 0);
});

test("infinite motion crosses either boundary with bounded coordinates and unchanged damping", () => {
  const motion = new Motion({ infinite: true });
  motion.setLimit(1000);
  motion.jump(990);
  motion.moveTo(1090);
  motion.advance(FRAME_MS);
  assert.ok(Math.abs(motion.position - 999) < 1e-9);
  motion.advance(FRAME_MS);
  assert.ok(motion.position > 0 && motion.position < 10);
  assert.ok(motion.wrappedPosition > 0 && motion.wrappedPosition < 10);
  assert.equal(motion.target, 90);
  motion.jump(-10);
  assert.equal(motion.position, 990);
  assert.equal(motion.wrappedPosition, 990);
  assert.equal(motion.progress, 0.99);
  motion.jump(1000000);
  assert.equal(motion.wrappedPosition, 0);
});

test("infinite motion handles empty tracks and switching to bounded motion", () => {
  const motion = new Motion({ infinite: true });
  motion.moveTo(1000);
  assert.equal(motion.target, 0);
  assert.equal(motion.progress, 0);
  motion.setLimit(1000);
  motion.jump(-100);
  motion.infinite = false;
  motion.setLimit(500);
  assert.equal(motion.position, 500);
  assert.equal(motion.target, 500);
});

test("native infinite requires its optional module; transform keeps its own recycling", () => {
  assert.throws(() => new Amber({ infinite: true }), /native infinite scrolling requires/);
  assert.throws(() => new Amber({ infinite: true, renderer: "native" }), /native infinite scrolling requires/);
  assert.throws(() => new Amber({ infinite: true, orientation: "horizontal", renderer: "native" }), /native infinite scrolling requires/);
  assert.throws(() => new Amber({ infinite: true, renderer: transform }), /browser/);
});


test("infinite input cannot accumulate more than one lap of pending travel", () => {
  const motion = new Motion({ infinite: true });
  motion.setLimit(1000);
  for (let i = 0; i < 10000; i++) {
    motion.moveTo(motion.target + 800);
    motion.advance(FRAME_MS);
    assert.ok(motion.position >= 0 && motion.position < 1000);
    assert.ok(Math.abs(motion.target - motion.position) <= 1000);
    assert.ok(motion.velocity > 0);
  }
});


test("snapDistance rejects invalid values before DOM setup", () => {
  // Without snap plugin, specifying snapDistance throws plugin required error
  assert.throws(() => new Amber({ snapDistance: 50 }), /require the module from "amber-scroll\/snap"/);

  for (const snapDistance of [-1, Infinity, NaN, "50", null]) {
    assert.throws(() => new Amber({ plugins: [snap], snapDistance }), /snapDistance/);
  }
  for (const snapDistance of [0, 50, 100, undefined]) {
    assert.throws(() => new Amber({ plugins: [snap], snapDistance }), /browser/);
  }
});

test("new feature options validate before DOM setup", () => {
  // Without plugins, feature options throw plugin requirement errors
  assert.throws(() => new Amber({ snap: "mandatory" }), /require the module from "amber-scroll\/snap"/);
  assert.throws(() => new Amber({ observeSections: true }), /requires the module from "amber-scroll\/sections"/);
  assert.throws(() => new Amber({ pin: [{ target: "#nav", start: "#first", end: "#last" }] }), /requires the pinning module/);

  // With plugins installed, validation rules execute
  for (const snapValue of ["mandatory", "proximity", false]) {
    assert.throws(() => new Amber({ plugins: [snap], snap: snapValue }), /browser/);
  }
  assert.throws(() => new Amber({ plugins: [snap], snap: "always" }), /snap/);
  assert.throws(() => new Amber({ anchors: "yes" }), /anchors/);
  assert.throws(() => new Amber({ historyKey: "" }), /historyKey/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: null }), /observeSections/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { threshold: 2 } }), /threshold/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { onEnter: true } }), /onEnter/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { targets: ".watch" } }), /targets/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { targets: [".watch", ""] } }), /section target/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { targets: [".watch", 2] } }), /section target/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { targets: [".watch", ".watch"] } }), /browser/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: true }), /pin/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: [null] }), /each pin/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: [{ target: "#nav", start: "#first" }] }), /pin.end/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: [{ target: "#nav", start: "#first", end: "#last", position: "bottom" }] }), /pin.position/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: [{ target: "#nav", start: "#first", end: "#last", offset: "10" }] }), /pin.offset/);
  assert.throws(() => new Amber({ plugins: [pinning], orientation: "horizontal", pin: [{ target: "#nav", start: "#first", end: "#last" }] }), /vertical scrolling/);
  assert.throws(() => new Amber({ plugins: [pinning], renderer: transform, infinite: true, pin: [{ target: "#nav", start: "#first", end: "#last" }] }), /browser/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: [{ target: "#nav", start: "#first", end: "#last" }] }), /browser/);
});
