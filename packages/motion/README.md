# amber-motion

> Zero-dependency CSS animation engine with opt-in SVG morphing/stroke drawing, timelines, and direct scroll synchronization.

[![npm version](https://img.shields.io/npm/v/amber-motion.svg?style=flat-square)](https://www.npmjs.com/package/amber-motion)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-none-success.svg?style=flat-square)](#)

`amber-motion` is a lightweight, zero-dependency motion engine for hardware-accelerated UI animations, sequential timelines, and direct scroll-scrubbing synchronization with `amber-scroll`. SVG morphing and stroke drawing are available through the opt-in `amber-motion/svg` entry. It has zero runtime dependencies and does not start a frame loop or install browser listeners until an animation is actively played.

This package includes TypeScript declarations for all exports, options, callbacks, and scroll bindings out of the box (use `import type { MotionOptions, PlayOptions } from 'amber-motion'`, or `SvgMotionOptions` from `amber-motion/svg`).

The default entry provides numeric CSS animation, transforms, opacity, clipping, delays, stagger, easing, reversible playback, sequential timelines, and direct bindings to Amber's smoothed scroll state. The SVG entry adds compatible morphs and stroke drawing.

## Installation

```sh
npm install amber-motion
```

If you are using scroll bindings (`bindScroll`) to directly synchronize animations with Amber scroll state, install `amber-scroll` as well:

```sh
npm install amber-scroll amber-motion
```

`amber-scroll` does not depend on or import this plugin. Installing only Amber
does not download the plugin or include it in the browser bundle. The plugin has
an optional peer dependency on the matching Amber release, so it can also animate
without a scroll controller.

The package ships ES modules and declares `sideEffects: false`. An application's
bundler can remove unused exports. Importing in Node or SSR is safe; construct
DOM animations after their elements exist.

### Choose an entry

| Import | Includes | Use for |
| --- | --- | --- |
| `amber-motion` | Numeric CSS properties, transforms, easing, scheduler, CSS timelines, `bindScroll`, reset helpers | Normal UI animation and scroll-linked effects |
| `amber-motion/svg` | Everything needed for CSS tracks plus SVG morphing, stroke drawing, and SVG timelines | Paths, polygons, polylines, and stroked SVG geometry |

The default entry intentionally does **not** include SVG parsing or path-length
code. Passing `morph`/`m` or `line`/`l` to it throws with an instruction to use
`amber-motion/svg` instead. This keeps a CSS-only consumer small while retaining
the same animation controls and reset behavior for SVG consumers.

## Create an animation

```js
import Motion from 'amber-motion';

const intro = new Motion({
  targets: document.querySelectorAll('.card-content'),
  duration: 700,
  delay: 100,
  stagger: 60,
  easing: 'io4',
  properties: {
    y: { v: [60, 0], unit: 'px' },
    s: [0.94, 1],
    o: [0, 1],
  },
  onUpdate(progress, animation) {},
  onComplete(animation) {},
});

intro.play();
```

`Motion` is the default controller export. `Animation` is an alias for the same class. Construction resolves targets, validates and prepares interpolation, captures
original styles, and renders the initial state. It does not autoplay.
Targets may be one element, a selector, a NodeList, or an iterable of elements.
Selectors use `root` when provided, otherwise `document`; empty selections throw.
`animate(options)` is a convenience constructor with the same behavior.

| Option | Default | Meaning |
| --- | --- | --- |
| `duration` / `d` | `400` | Milliseconds per element; zero completes immediately |
| `delay` / `id` | `0` | Initial delay in milliseconds |
| `stagger` / `de` | `0` | Milliseconds between successive elements |
| `easing` / `ef` | `'lin'` | Built-in name or function receiving normalized progress |
| `reverse` / `r` | `false` | Construct at the end and play backward |
| `playbackRate` | `1` | Positive multiplier; use `reverse()` for direction |
| `respectReducedMotion` | `true` | Settle playback when reduced motion is requested |

Durations and delays must be finite and nonnegative. `duration + stagger ×
(element count − 1)` is the animated span. Initial delay precedes that span.

## Playback controls

```js
intro.pause();                  // Freeze at the last rendered frame, including delay
intro.play();                   // Continue forward from the exact paused playhead
intro.play({ rev: true });      // Continue backward from the exact paused playhead
intro.play({ rev: false });     // Explicitly continue forward
intro.reverse();                // Flip direction and play from the current playhead
intro.seek(0.5);                // Pause and render the middle of the animated span
intro.setPlaybackRate(2);       // Double the speed
intro.restart();                // Restart in the current direction, including delay
intro.reset();                  // Restore start values and pause, including scroll bindings
intro.finish();                 // Render directional endpoint and complete once
intro.destroy();                // Stop and restore original owned styles/attributes
// intro.destroy({ revert: false }); // Stop but retain the rendered appearance
```

There is no `resume()` method. `play()` is the single start/continue operation.
It continues a paused animation from its current playhead and replays a finished
animation. Calling it while already running does not create another runner.
`play({ rev: true })` selects backward playback; `play({ rev: false })` selects
forward playback. On initial play, `rev` defaults to the constructor's direction;
afterward it defaults to `false`. The `reverse` option key can also
be passed. `reverse()` toggles the current direction and plays from the same position.
Reversing traverses the same delay/stagger schedule backward, so the last element
reverses first. The original endpoints never change.

`seek()` clamps progress to `[0, 1]`, excludes initial delay, includes stagger, and
does not fire completion callbacks. At zero duration without stagger, seeking
still interpolates endpoints; timed playback completes immediately. A completed
animation can be sought and played without restarting from the beginning.

`progress`, `time` (milliseconds including delay), `status`, `isPlaying`, and
`destroyed` expose current state. Treat timing configuration as immutable; change
speed with `setPlaybackRate()`. `onUpdate` receives linear overall progress after
rendering; each element receives easing separately. Completion is synchronous
for `finish()`, zero-duration playback, and reduced-motion playback. `onComplete`
(or `cb`) sets the completion callback.

## Optional reset-all

```js
import { resetAll } from 'amber-motion';

const animations = [heroAnimation, titleAnimation, svgAnimation];
resetAll(animations); // Arrays, Sets, or other iterables; explicit scope required

// Later, choose timed playback OR return control to the scroll bindings:
heroAnimation.play(); // Forward from the start, with its initial delay again
// heroBinding.play(); // Instead, immediately catch up to Amber's current scroll
```

`resetAll()` calls `reset()` once per unique animation. It restores every track's
**defined start value**, not the pre-animation inline style; transforms, opacity,
clipping, and other numeric styles are included. SVG morphs and stroke drawing
are included when the instances were created from `amber-motion/svg`.
It pauses playback and every attached `bindScroll()` binding, sets forward
direction, rewinds the initial delay, and leaves the instances reusable. It does
not run update/completion callbacks, change Amber's scroll position, or replay.
Other animation configuration, including playback rate, is preserved. Destroyed
animations are ignored. An empty group is valid. There is no page-wide animation
registry and this operation is never triggered automatically.

Paused bindings stay paused through scroll/resize/reduced-motion changes and
`binding.update()`. Use `binding.play()` to reconnect control; that immediately
seeks to current scroll progress, so it may jump away from the start.

For infinite scroll, progress/wrapped-position bindings already repeat each lap;
manual resetting is optional and does not make mismatched endpoints seamless.
`resetAll()` takes animation instances, not DOM elements, selectors or timelines.
Timeline sequencing is separate: use `timeline.restart()` to replay a sequence;
there is no whole-timeline reset-to-paused-start operation yet. Avoid multiple
animations owning the same element/property, including when grouping resets.

## Properties and easing

Properties accept `[from, to]` or `{ v: [from, to], unit, name }`. Endpoints must be
finite numbers. Units can also be the third entry in `v`; explicit `unit` wins.

| Key | Output | Default unit |
| --- | --- | --- |
| `x`, `y`, `z` | `translateX/Y/Z` | `%` for x/y; `px` for z |
| `r` | `rotate`; `name` may select `rotateX`, `rotateY`, etc. | `deg` |
| `s` | `scale`; `name` may select `scaleX/Y/Z` | none |
| `o` | opacity | none |
| `c` | top edge of `clip-path: inset(...)` | `%` |
| Other keys | Numeric CSS property or custom property, e.g. `width`, `--reveal` | none; supply units as needed |

Transform components, clipping, and opacity can run together. For example:

```js
new Animation({
  targets: '.heading',
  properties: {
    c: [100, 0],
    o: [0, 1],
    r: { v: [15, 0], name: 'rotateX' },
    '--reveal': [0, 1],
  },
}).play();
```

Built-in easing functions include: `lin`, `i1/o1/io1` (sine), `i2/o2/io2`
through `i5/o5/io5` (quadratic through quintic), `i6/o6/io6` (exponential),
`oe` (elastic out), and `ob` (back out). `easings` / `Ease` exports them directly.
Custom easing must return a finite number; endpoints always render exactly.
Overshooting easings may exceed property endpoints between start and finish.

Colors, arbitrary CSS string interpolation, automatic computed starting values,
keyframe arrays, and spring simulation are not provided. Supply explicit numeric
endpoints; use sequential timeline steps for multiple stages.

## SVG morphing

```js
import SvgMotion from 'amber-motion/svg';

const shape = new SvgMotion({
  targets: '#shape',
  duration: 900,
  easing: 'io3',
  morph: {
    type: 'path',
    // start defaults to the element's current d attribute
    end: 'M0 0 L80 20 L50 80 Z',
  },
});
shape.play();
```

Use `type: 'polygon'` for `points`. Endpoint strings can be shared across targets,
or arrays can supply a string for each target. Scientific notation and negative
coordinates are supported. Geometry is tokenized once; frames only interpolate
numbers and write changed attributes. Original strings are restored on destroy.

Paths must have identical command sequences **including case**, compatible
coordinate counts, and equal arc flags. Polygons must have matching vertex counts
and corresponding vertex order. Incompatible shapes throw before rendering.
This engine does not convert arbitrary SVG shapes, resample curves, or match
vertices automatically. Normalize those shapes beforehand. Use a nonovershooting
easing when morphing arcs so radii do not cross below zero.

## SVG stroke drawing

```js
import SvgMotion from 'amber-motion/svg';

new SvgMotion({
  targets: '#outline',
  duration: 1200,
  line: { start: 0, end: 100 },
  // line: { start: 0, end: 100, dashed: '4 6' },
}).play();
```

`start` and `end` are percentages of the stroke revealed. The engine measures
`getTotalLength()` once, uses a positive `pathLength` when supplied, and animates
`stroke-dashoffset`. Dash patterns must have nonnegative finite lengths and a
positive total; excessively fine patterns are rejected to bound allocation.
The dashed pattern is trimmed once to the path length; dashes move along the path
as it reveals. No extra SVG elements or per-frame dash-list construction are needed.
Reveal percentages are clamped to 0–100, including easing overshoot. At 0% the
engine temporarily sets `stroke-opacity: 0` to hide cap dots without hiding the
fill, then restores the original stroke opacity when drawing begins. At 100%
it uses the ordinary dashed or solid stroke. Avoid separately animating
`stroke-opacity` on the same target during line drawing. Recreate the animation
after changing path geometry or length.
Morph and drawing can be combined, but the drawing length remains the initially
measured length while the path morphs. `SvgMotion` / `Animation` from this entry
have the same playback controls as the default `Motion` class.

## Connect to Amber scroll

```js
import Amber from 'amber-scroll';
import Motion, { bindScroll } from 'amber-motion';

const amber = new Amber();
const reveal = new Motion({
  targets: '.hero-content', // Inner element, not an Amber structural panel
  properties: { y: { v: [80, 0], unit: 'px' }, o: [0, 1] },
  easing: 'io3',
});

const binding = bindScroll(amber, reveal, {
  source: 'progress',
  start: 0,
  end: 0.35,
  destroyAnimation: true,
});
```

`bindScroll()` renders immediately, then subscribes to Amber's public `scroll`,
`resize`, and `destroy` events. It maps `(value − start) / (end − start)` to the
animation's seekable span. The value is Amber's **smoothed current state**, not
wheel input or its target position. No additional RAF or smoothing is used, so
there is no second easing delay behind the scroll controller. With `autoRaf:
false`, your existing calls to `amber.raf(timestamp)` drive scroll bindings too.

Supported sources are `progress` (default range 0–1), `position`,
`wrappedPosition`, and signed `velocity`. Non-progress sources require `end`.
For 2D omnidirectional Amber instances (`orientation: 'both'`), specify `axis: 'x'`
or `axis: 'y'` to bind directly to that vector dimension; omitting `axis` defaults
to Amber's primary scalar axis. Start/end can be numbers or functions of Amber's
state; functions run on each update and should be cheap. For example:

```js
bindScroll(amber, reveal, {
  source: 'position',
  axis: 'y', // 'x' or 'y' for multi-axis 2D instances
  start: 100,
  end: state => Math.max(101, state.limit * 0.5),
});
```

Reversed ranges work; equal bounds throw. Out-of-range values clamp. Infinite
scroll progress repeats each lap, so animations reset at the seam; match their
endpoints if seamless visual looping is needed. The integration supports both
axes and both Amber renderers. Pixel ranges are scroll coordinates, not element
visibility thresholds. It does not infer section geometry from DOM rectangles;
those can be stale for Amber's culled/infinite panels. Velocity bindings use the
velocity in emitted state and also subscribe to `scrollend` to apply the final
zero-velocity state. They do not add a separate decay after scrolling ends.

`binding.pause()` freezes scroll updates. `binding.play()` immediately catches
up. `binding.update()` re-evaluates the current state. `binding.destroy()` detaches
listeners and leaves the animation available, unless `destroyAnimation: true`.
Destroying either Amber or the animation also detaches the binding. Do not run
timed playback on an animation while its scroll binding is active; pause or
destroy the binding first. Seeking does not trigger `onComplete` on scroll.

Reduced-motion scroll bindings render progress `1` by default. Set
`reducedMotionProgress` for another static appearance; `respectReducedMotion:
false` opts out at the binding or animation level. Preference changes are handled
while connected.

### Style ownership with Amber

Amber owns structural panel transforms and uses `translate` for parallax/pinning.
Animate a nested child for transform effects; do not animate a panel's `transform`
or a pinned/parallax target's `translate`. The animation engine replaces the
transform property while active, then restores its original inline value on
destruction. It does not merge concurrent transform owners or CSS transitions.
Use separate nested elements for independent transform layers. Avoid concurrent
animations writing the same property on the same element. Unrelated inline
properties are preserved on cleanup.

## Timelines

```js
import { Timeline } from 'amber-motion';

const timeline = new Timeline({ onComplete: () => console.log('done') });
timeline
  .from({ targets: '.title', properties: { o: [0, 1] }, duration: 400 })
  .from(() => console.log('title revealed'))
  .from({ targets: '.detail', properties: { y: [20, 0], o: [0, 1] }, duration: 500 })
  .play();

// timeline.pause(); timeline.play(); timeline.restart(); timeline.destroy();
```

Steps are animation option objects or synchronous functions. Steps are constructed
when reached, which captures their starting inline styles at the correct time.
`play()` continues a paused step and starts or replays a sequence otherwise.
`restart()` always starts the sequence again. There is no timeline `resume()`.
Destroying a
timeline restores its steps in reverse order. A timeline is sequential; overlap,
labels, whole-timeline seeking/reversal, and asynchronous function steps are not
supported. Do not restart a timeline recursively from a synchronous step.

For timeline steps containing `morph` or `line`, import the matching SVG timeline:

```js
import { Timeline } from 'amber-motion/svg';

new Timeline()
  .from({ targets: '#logo-path', morph: { end: 'M0 0 L80 20 L50 80 Z' } })
  .play();
```

## Frame runner and Tab

```js
import { FrameRunner, Tab } from 'amber-motion';

const runner = new FrameRunner((elapsedMs, element) => {
  // Custom frame work; arguments belong to this runner only.
});
runner.run(document.querySelector('.custom'));
runner.pause();
runner.run(document.querySelector('.custom')); // A stopped runner begins again at zero
runner.stop();  // Alias for pause; next run() starts elapsed time at zero
runner.destroy();

const tab = new Tab(document);
const unsubscribe = tab.add(hidden => console.log({ hidden }));
unsubscribe();
tab.destroy();
```

The default scheduler is shared per browser window. It requests one frame for all
active runners and cancels it when none remain. Its visibility listener exists
only while there are runners. Hidden tabs suspend the loop and exclude hidden
time; manually paused runners remain paused on return. The first frame after a
start establishes the timestamp baseline. `Tab.add()` reports changes,
not an immediate initial notification; `tab.hidden` exposes the current state.

`Scheduler` is exported for an isolated scheduler or testing. Pass `{ scheduler }`
to an animation or `FrameRunner`. Custom runner errors stop that runner, report the error
through the browser, and allow other runners to continue. Custom runners own
their own reduced-motion behavior; `Animation` implements it automatically.

## Limitations & Troubleshooting

- **Disconnected SVG subpaths:** SVG restarts its dash pattern at each subpath. For predictable sequential drawing, put disconnected subpaths in separate elements and animate them with a timeline. Line drawing measures geometry once; recreate it after changes to geometry or `pathLength`.
- **Competing style writers:** An animation replaces the properties it owns. Use nested elements for independent transform effects, especially with Amber's structural panels and parallax/pinning targets. See [Style ownership with Amber](#style-ownership-with-amber).
- **Browser setup:** Import the ES module during SSR if needed, but construct animations after the target elements exist in the browser. Construction renders the starting values; call `.play()` for timed playback or connect a scroll binding for scroll-driven playback.

## Performance and verification

Timing uses elapsed milliseconds, so duration is consistent at 30/60/120/144 Hz.
Rendering follows the display's RAF cadence; 60 fps is a target, not a guarantee
for arbitrary hardware, element counts, SVG complexity, or property choices.
Transforms and opacity generally cost less than layout properties, clipping,
or SVG geometry. There are no per-frame DOM geometry reads. Changed output is
written once; unchanged property values are skipped. Offscreen animations still
advance; this engine does not add per-element visibility observers.

With a production ESM bundle, importing `animate` from `amber-motion` measures
about **3.38 kB gzip**. Importing `animate` from `amber-motion/svg` measures about
**4.61 kB gzip**. These are representative esbuild measurements, not a guarantee
of every application's final bundle.

```sh
npm test --workspace=amber-motion
npm run test:browser --workspace=amber-motion
npm test              # Both packages' unit tests
npm run test:browser  # Both packages, Chromium/Firefox/WebKit
npm run build        # Build both package distributions
```

The deterministic tests cover timing, lifecycle, reverse, zero-duration/stagger,
visibility, per-runner arguments, errors, SVG validation, restoration, scroll
mapping, reduced motion, and timelines. Browser integration exercises actual
Amber instances across both axes/renderers, infinite scroll, pin/parallax
coexistence, SVG rendering, and real requestAnimationFrame playback.

### Error diagnostics

Published builds keep runtime validation but report compact `Amber Mxxx` error codes. See [the error reference](./ERRORS.md) for their meanings. Source imports retain descriptive messages.

---

## Author

**Hardik Gandhi**

[![GitHub](https://img.shields.io/badge/GitHub-realhardik-181717?style=flat-square&logo=github)](https://github.com/realhardik)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thehardikgandhi-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/thehardikgandhi)
[![Instagram](https://img.shields.io/badge/Instagram-he.is.gandhi-E4405F?style=flat-square&logo=instagram)](https://www.instagram.com/he.is.gandhi/)
[![Pinterest](https://img.shields.io/badge/Pinterest-chill__chief-BD081C?style=flat-square&logo=pinterest)](https://pinterest.com/chill_chief/)

## License

MIT © [Hardik Gandhi](https://github.com/realhardik)
