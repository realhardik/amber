import { test } from "node:test";
import assert from "node:assert/strict";
import Amber from "../../src/index.js";
import transform from "../../src/transform.js";
import snap from "../../src/plugins/snap.js";
import parallax from "../../src/plugins/parallax.js";
import pinning from "../../src/plugins/pinning.js";
import sections from "../../src/plugins/sections.js";
import { parallax as effectsParallax, pinning as effectsPinning } from "../../src/plugins/effects.js";
import { resolvePlugins, featureModule, rendererModule } from "../../src/modules.js";

test("plugin resolution validates inputs, deduplicates, and sorts by priority", () => {
  // Must be an array
  assert.throws(() => new Amber({ plugins: null }), /plugins must be an array/);
  assert.throws(() => new Amber({ plugins: "snap" }), /plugins must be an array/);
  assert.throws(() => new Amber({ plugins: {} }), /plugins must be an array/);

  // Must contain valid feature modules
  assert.throws(() => new Amber({ plugins: [{}] }), /imported Amber feature modules/);
  assert.throws(() => new Amber({ plugins: [null] }), /imported Amber feature modules/);
  assert.throws(() => new Amber({ plugins: [{ [featureModule]: true, name: "custom" }] }), /imported Amber feature modules/);

  // Deduplication
  const deduplicated = resolvePlugins([snap, snap, parallax]);
  assert.equal(deduplicated.length, 2);

  // Conflict detection for different implementations sharing a name
  const fakeSnap = { [featureModule]: true, name: "snap", install: () => {} };
  assert.throws(() => resolvePlugins([snap, fakeSnap]), /conflicting 'snap' modules/);

  // Ordering: parallax (order 10) must precede pinning (order 20) regardless of input order
  const ordered = resolvePlugins([pinning, parallax]);
  assert.equal(ordered[0].name, "parallax");
  assert.equal(ordered[1].name, "pinning");
});

test("renderer configuration requires native or imported transform module", () => {
  // Default is native, proceeds to DOM readiness check
  assert.throws(() => new Amber(), /browser/);
  assert.throws(() => new Amber({ renderer: "native" }), /browser/);

  // String 'transform' is rejected with explicit instructions
  assert.throws(
    () => new Amber({ renderer: "transform" }),
    /renderer must be "native" or the module imported from "amber-scroll\/transform"/
  );

  // Unknown renderer names are rejected
  assert.throws(() => new Amber({ renderer: "webgl" }), /renderer must be "native"/);
  assert.throws(() => new Amber({ renderer: {} }), /renderer must be "native"/);

  // Imported transform module is accepted
  assert.equal(transform[rendererModule], true);
  assert.equal(transform.name, "transform");
  assert.throws(() => new Amber({ renderer: transform }), /browser/);

  // Infinite mode requires transform renderer
  assert.throws(() => new Amber({ infinite: true }), /native infinite scrolling requires/);
  assert.throws(() => new Amber({ infinite: true, renderer: "native" }), /native infinite scrolling requires/);
  assert.throws(() => new Amber({ infinite: true, renderer: transform }), /browser/);
});

test("snap plugin is required to use snap options", () => {
  // Setting snap without the plugin throws
  assert.throws(
    () => new Amber({ snap: "proximity" }),
    /snap options require the module from "amber-scroll\/snap" in plugins/
  );
  assert.throws(
    () => new Amber({ snap: "mandatory" }),
    /snap options require the module from "amber-scroll\/snap" in plugins/
  );
  assert.throws(
    () => new Amber({ snapDistance: 50 }),
    /snap options require the module from "amber-scroll\/snap" in plugins/
  );

  // snap: false is accepted without the plugin
  assert.throws(() => new Amber({ snap: false }), /browser/);

  // With plugin installed, options are validated
  assert.throws(
    () => new Amber({ plugins: [snap], snap: "always" }),
    /snap must be false, proximity, or mandatory/
  );
  assert.throws(
    () => new Amber({ plugins: [snap], snapDistance: -10 }),
    /snapDistance must be a finite, nonnegative number/
  );
  assert.throws(
    () => new Amber({ plugins: [snap], snapDistance: NaN }),
    /snapDistance must be a finite, nonnegative number/
  );
  assert.throws(
    () => new Amber({ plugins: [snap], snapDistance: "50" }),
    /snapDistance must be a finite, nonnegative number/
  );

  // Valid snap options pass validation to DOM check
  assert.throws(() => new Amber({ plugins: [snap], snap: "proximity" }), /browser/);
  assert.throws(() => new Amber({ plugins: [snap], snap: "mandatory" }), /browser/);
  assert.throws(() => new Amber({ plugins: [snap], snap: "proximity", snapDistance: 80 }), /browser/);
});

test("pinning plugin is required to configure pins", () => {
  const validPin = { target: "#nav", start: "#intro", end: "#projects" };

  // Without plugin, configuring pins throws
  assert.throws(
    () => new Amber({ pin: [validPin] }),
    /pin requires the pinning module in plugins/
  );

  // pin: false and empty array are allowed without plugin
  assert.throws(() => new Amber({ pin: false }), /browser/);
  assert.throws(() => new Amber({ pin: [] }), /browser/);

  // With plugin installed, pin structure is validated
  assert.throws(() => new Amber({ plugins: [pinning], pin: true }), /pin/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: [null] }), /each pin/);
  assert.throws(() => new Amber({ plugins: [pinning], pin: [{ target: "#nav", start: "#intro" }] }), /pin\.end/);
  assert.throws(
    () => new Amber({ plugins: [pinning], pin: [{ ...validPin, position: "bottom" }] }),
    /pin\.position/
  );
  assert.throws(
    () => new Amber({ plugins: [pinning], pin: [{ ...validPin, offset: "10" }] }),
    /pin\.offset/
  );

  // Pinning requires vertical scrolling; infinite is allowed when the range does not wrap the seam
  assert.throws(
    () => new Amber({ plugins: [pinning], orientation: "horizontal", pin: [validPin] }),
    /pinning requires vertical scrolling/
  );
  assert.throws(
    () => new Amber({ plugins: [pinning], orientation: "both", pin: [validPin] }),
    /pinning requires vertical scrolling/
  );
  assert.throws(() => new Amber({ plugins: [pinning], renderer: transform, infinite: true, pin: [validPin] }), /browser/);

  // Valid pins pass validation to DOM check
  assert.throws(() => new Amber({ plugins: [pinning], pin: [validPin] }), /browser/);
});

test("sections plugin is required to observe section visibility", () => {
  // Without plugin, observing sections throws
  assert.throws(
    () => new Amber({ observeSections: true }),
    /observeSections requires the module from "amber-scroll\/sections" in plugins/
  );
  assert.throws(
    () => new Amber({ observeSections: { threshold: 0.5 } }),
    /observeSections requires the module from "amber-scroll\/sections" in plugins/
  );

  // observeSections: false is accepted without plugin
  assert.throws(() => new Amber({ observeSections: false }), /browser/);

  // With plugin installed, configuration is validated
  assert.throws(() => new Amber({ plugins: [sections], observeSections: null }), /observeSections/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { threshold: 2 } }), /threshold/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { onEnter: true } }), /onEnter/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { targets: ".watch" } }), /targets/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { targets: [".watch", ""] } }), /section target/);

  // Valid observeSections passes to DOM check
  assert.throws(() => new Amber({ plugins: [sections], observeSections: true }), /browser/);
  assert.throws(() => new Amber({ plugins: [sections], observeSections: { threshold: 0.25 } }), /browser/);
});

test("parallax and effects convenience bundle export expected plugins", () => {
  assert.equal(parallax[featureModule], true);
  assert.equal(parallax.name, "parallax");
  assert.deepEqual(parallax.attributes, ["data-amber-speed"]);

  // Effects bundle re-exports parallax and pinning
  assert.equal(effectsParallax, parallax);
  assert.equal(effectsPinning, pinning);

  // Multiple plugins combine cleanly
  assert.throws(() => new Amber({ plugins: [parallax, pinning] }), /browser/);
});
