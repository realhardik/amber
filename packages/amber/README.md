# amber-scroll

> High-performance, modular smooth scrolling engine with physics-based inertia, true 2D omnidirectional movement, sub-pixel transform rendering, edge snapping, GPU parallax, and infinite cyclic looping.

[![npm version](https://img.shields.io/npm/v/amber-scroll.svg?style=flat-square)](https://www.npmjs.com/package/amber-scroll)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Tree Shakeable](https://img.shields.io/badge/architecture-modular%20plugins-success.svg?style=flat-square)](#the-plugin-ecosystem)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-none-success.svg?style=flat-square)](#)

Amber is a standalone, dependency-free smooth scrolling engine engineered for high-end creative websites and fluid interactive applications. Built around a **modular, tree-shakeable plugin architecture**, Amber allows you to start with a featherweight native smooth scroll engine (~15KB unminified) and opt into advanced capabilities—such as 2D omnidirectional spatial scrolling, panel transforms, magnetic snapping, GPU parallax, section pinning, and native infinite runways—only when your project demands them.

---

## Features

- **Modular & Tree-Shakeable**: Pay only for what you use. The core engine is lean and native; transforms, parallax, pinning, snapping, sections, and native loops are opt-in subpath plugins.
- **Omnidirectional Multi-Axis (`orientation: 'both'`)**: True 2D vector scrolling across both X and Y axes simultaneously. Perfect for spatial canvases, maps, photo matrices, and creative grids.
- **Dual-Mode Rendering**:
  - `native` (Default): Smooths the browser's native `scrollTop` / `scrollLeft`. Retains the default browser scrollbar, accessibility, and form controls for standard websites with zero plugin dependencies.
  - `transform` (Plugin): Virtualized, sub-pixel smooth translation on direct children. Perfect for full-viewport panel layouts, infinite tracks, 2D planes, and creative portfolios.
- **Infinite Looping Runway**: True closed-loop recycling without cloning or re-mounting DOM elements. Preserves velocity, form state, and event listeners across seams in both `transform` mode and `native` mode (via the `infinite` plugin).
- **Magnetic Snapping (Plugin)**: Proximity-based resting (settles when stopping near boundaries) or mandatory settling for 1D panels and 2D spatial elements.
- **Declarative Parallax (Plugin)**: Multi-speed depth planes configured simply with `data-amber-speed`. Calculated relative to viewport passage with GPU-accelerated CSS `translate`.
- **Element Pinning (Plugin)**: Pin headers, titles, or sidebars across arbitrary section boundaries with zero layout shift and optional dynamic `endOffset`.
- **Nested Scroll Handoff (`scrollChain: true`)**: Fluid, boundary-aware gesture handoff from inner scrollers to ancestor viewports.
- **Section Visibility Observer (Plugin)**: High-performance enter/leave triggers calculated from virtual panel geometry with true 2D cross-intersection calculations.
- **Scrollbar Control**: Declarative `hideScrollbar: true` option and `data-amber-hide-scrollbar` attribute to cleanly suppress scrollbars across all browsers.
- **Touch & Gesture Isolation**: Robust touchpad, mousewheel, and touch-inertia handling. Respects nested native scrollers, form controls, and zoom gestures.
- **Accessibility First**: Automatically falls back to immediate/native scrolling when `prefers-reduced-motion` is detected.
- **TypeScript First**: Full type definitions included out of the box.

---

## Installation

```bash
npm install amber-scroll
```

> **Looking for animations?** Pair it with [`amber-motion`](https://github.com/realhardik/amber/tree/main/packages/motion), our zero-dependency companion engine with timeline controls and direct scroll-scrubbing bindings (`bindScroll`). SVG morphing and stroke drawing are opt-in from `amber-motion/svg`.

---

## The Plugin Ecosystem

Amber features a modular subpath export design so your production bundle remains minimal:

| Subpath Export | Import | Purpose |
| :--- | :--- | :--- |
| `amber-scroll` | `import Amber from 'amber-scroll'` | **Core Engine**. Native smooth scrolling (1D or 2D), wheel/touch/keyboard normalization, damping physics, and events. |
| `amber-scroll/transform` | `import transform from 'amber-scroll/transform'` | **Transform Renderer**. Required for panel layouts, 2D plane transforms, and virtual tracks. |
| `amber-scroll/infinite` | `import loop from 'amber-scroll/infinite'` | **Native Infinite Loop Plugin**. Enables continuous wrap-around scrolling for the native renderer via a bounded runway. |
| `amber-scroll/snap` | `import snap from 'amber-scroll/snap'` | **Snapping Plugin**. Enables `snap: 'proximity' \| 'mandatory'` and `snapDistance` on 1D and 2D layouts. |
| `amber-scroll/parallax` | `import parallax from 'amber-scroll/parallax'` | **Parallax Plugin**. Enables declarative `data-amber-speed` elements. |
| `amber-scroll/pinning` | `import pinning from 'amber-scroll/pinning'` | **Pinning Plugin**. Enables section boundary pinning (`pin: [...]`). |
| `amber-scroll/effects` | `import { parallax, pinning } from 'amber-scroll/effects'` | **Effects Bundle**. Convenience bundle exporting both parallax and pinning. |
| `amber-scroll/sections` | `import sections from 'amber-scroll/sections'` | **Sections Plugin**. Enables section enter/leave observation (`observeSections`). |

---

## Quick Start

### 1. Standard Document (Native Mode — Zero Plugins)

By default, Amber runs in `native` mode. It enhances the browser's real scroll position with smooth inertia without adding any plugin weight:

```js
import Amber from 'amber-scroll';

// Initialize after the DOM has loaded
const amber = new Amber({
  damping: 0.09, // Lower is smoother/floatier, higher is more responsive (default: 0.09)
  hideScrollbar: true, // Cleanly hides the page scrollbar across all browsers
});
```

> **Tip:** `hideScrollbar: true` hides the scrollbar for the page. To hide the scrollbar on an inner scrollable container too, simply add the `data-amber-hide-scrollbar` attribute to that container element.

---

### 2. Panel / Portfolio Layout (Transform Mode + Plugins)

Transform mode provides sub-pixel virtual smoothing and unlocks features like infinite looping and horizontal tracks. It requires the `transform` renderer module and any desired plugins.

#### HTML Markup
```html
<main data-amber>
  <section class="panel">
    <h1>Intro</h1>
    <a href="#projects">Jump to Projects</a>
  </section>

  <section class="panel" id="projects">
    <!-- Parallax layer (requires parallax plugin) -->
    <h2 data-amber-speed="0.7">Projects</h2>
  </section>

  <section class="panel">
    <h2>Contact</h2>
  </section>

  <!-- Optional stationary overlay excluded from movement -->
  <div data-amber-avoid class="fixed-nav">Stationary HUD</div>
</main>
```

#### CSS
```css
html, body {
  margin: 0;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
}

main[data-amber] {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

main[data-amber] > section {
  flex: none;
  min-height: 100dvh;
}
```

#### JavaScript
```js
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';
import snap from 'amber-scroll/snap';
import { parallax } from 'amber-scroll/effects';

// Pass the transform module to `renderer` and plugins to `plugins: [...]`
const amber = new Amber({
  renderer: transform,
  plugins: [snap, parallax],
  snap: 'proximity',
});
```

---

### 3. 2D Omnidirectional Canvas / Grid (`orientation: 'both'`)

Smoothly glide across both X and Y dimensions simultaneously—ideal for infinite matrices, interactive floorplans, or Figma-style artboards:

```html
<div class="canvas-viewport">
  <div class="canvas-content">
    <div class="tile">01</div>
    <div class="tile">02</div>
    <div class="tile">03</div>
    <div class="tile">04</div>
  </div>
</div>
```

Give the viewport a bounded size and make the content larger along both axes.
These demo dimensions allow the `{ x: 800, y: 1200 }` destination below:

```css
.canvas-viewport {
  width: 100%;
  max-width: 800px;
  height: min(70dvh, 600px);
  overflow: auto;
}

.canvas-content {
  display: grid;
  grid-template-columns: repeat(2, 800px);
  grid-template-rows: repeat(2, 900px);
  width: 1600px;
  height: 1800px;
}

.canvas-content > .tile {
  box-sizing: border-box;
  padding: 24px;
  border: 1px solid currentColor;
}
```

The CSS also works with the native renderer. The transform renderer manages the
viewport's overflow while it is active. Adjust the dimensions for your layout,
keeping content larger than the viewport on each axis you want to scroll.

```js
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';

const amber = new Amber({
  wrapper: document.querySelector('.canvas-viewport'),
  content: document.querySelector('.canvas-content'),
  orientation: 'both',
  renderer: transform, // Or omit for smooth 2D native scrolling
  managedWheel: true,  // Optional: keep native scrolling from taking over at edges
});

// Programmatic 2D navigation:
amber.scrollTo({ x: 800, y: 1200 });

// Access independent vector coordinates:
console.log(amber.positionVector.x, amber.positionVector.y);
```

---

## HTML Directives & Attributes

Amber recognizes declarative data attributes to customize element behavior:

| Attribute | Target Element | Description |
| :--- | :--- | :--- |
| `data-amber` | Container (`<main>`) | Enables automatic discovery when calling `new Amber()` without explicit `wrapper`/`content` options. |
| `data-amber-speed="<number>"` | Element inside a panel | Adds center-relative parallax. `1` is normal speed, `< 1` moves slower (distant background), `> 1` moves faster (foreground). *(Requires `parallax` or `effects` plugin)*. |
| `data-amber-avoid` | Direct child of content | Excludes this child from transform movement, snap targets, and infinite recycling (ideal for absolute overlays / HUDs). |
| `data-amber-prevent` | Any subtree / container | Instructs Amber to ignore wheel, touch, and keyboard events originating inside this element (ideal for code editors, inner overflow lists, or interactive canvas elements). |
| `data-amber-hide-scrollbar` | Any container element | Hides that element's scrollbar while Amber's scrollbar stylesheet is installed by a native-renderer instance with `hideScrollbar: true` in the same document. The attribute alone does not install styles. |

---

## Guides & Core Features

### 1. True 2D Omnidirectional Scrolling

> **Available in**: Both `native` and `transform` renderers

Amber features a unified allocation-free 2D vector integrator (`motion.js`). When `orientation: 'both'` is active:

```js
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';

const amber = new Amber({
  orientation: 'both',
  renderer: transform,
  damping: 0.09,
});
```

- **Vector State**: Access vector properties alongside scalar fallbacks:
  ```js
  amber.positionVector;          // { readonly x: number, readonly y: number }
  amber.targetVector;            // Destination vector
  amber.limitVector;             // { x: maxX, y: maxY }
  amber.velocityVector;          // Velocity in px/ms per axis
  amber.directionVector;         // { x: -1 | 0 | 1, y: -1 | 0 | 1 }
  amber.progressVector;          // Normalized progress [0, 1] per axis
  ```
- **2D Navigation**: Pass coordinates directly or use element targets with 2D offsets:
  ```js
  amber.scrollTo({ x: 400, y: 600 });
  amber.scrollTo('#tile-4', { offset: { x: -20, y: -50 } });
  ```
- **2D Plane Rendering (`PlaneRenderer`)**: When paired with `renderer: transform`, Amber uses a 2D surface renderer that writes unified GPU `translate3d(x, y, 0)` transforms to direct tiles with zero wrapper bloat.
- **Independent input**: X and Y targets settle independently, so new horizontal input joins active vertical inertia immediately. Shift + vertical wheel maps to X, matching the browser’s familiar horizontal-wheel shortcut.
- **Managed wheel ownership**: `managedWheel: true` captures and cancels wheel events before native scrolling can take over at an edge. Use it only for self-contained canvases: nested native scrollers inside that Amber root will not receive wheel input. It cannot infer arbitrary horizontal intent if the platform reports only `deltaY`.
- **Scrollbar policy**: 2D instances hide their viewport scrollbar automatically; scrolling and `scrollTo()` remain available.

---

### 2. Infinite Looping (Transform & Native)

Amber provides closed-loop cyclic scrolling that recycles original DOM nodes without cloning, preserving DOM state, form inputs, video playback, and event listeners.

#### In Transform Mode:
Infinite looping is built directly into `amber-scroll/transform`:
```js
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';

const amber = new Amber({
  renderer: transform,
  infinite: true, // Or { x: true, y: false } in multi-axis mode
});
```

#### In Native Mode:
> **Requires**: `import loop from 'amber-scroll/infinite'`

Amber supports an industry-first **native infinite runway**, allowing continuous wrap-around cyclic scrolling using the browser's native scroll engine:
```js
import Amber from 'amber-scroll';
import loop from 'amber-scroll/infinite';

const amber = new Amber({
  renderer: 'native',
  plugins: [loop],
  infinite: true,
});
```

- **Per-Axis Loops**: In 2D mode, you can loop independently on X, Y, or both:
  ```js
  const amber = new Amber({
    orientation: 'both',
    renderer: transform,
    infinite: { x: true, y: false }, // Loops horizontally, bounded vertically
  });
  ```
- **Track Requirement**: The total cycle length must be at least the viewport size plus the largest panel size (`cycle length >= viewport + largest panel`).

---

### 3. Magnetic Snapping

> **Requires**: `import snap from 'amber-scroll/snap'`

Amber provides two snapping modes for settling smoothly onto panel edges:

```js
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';
import snap from 'amber-scroll/snap';

const amber = new Amber({
  renderer: transform,
  plugins: [snap],
  // 'proximity': Snaps only when landing near a boundary
  snap: 'proximity',
  snapDistance: 80, // Optional: Snap threshold in pixels (defaults to 20% of viewport, max 100px)
});
```

```js
// 'mandatory': Always settles on the nearest edge after every scroll gesture
const amber = new Amber({
  renderer: transform,
  plugins: [snap],
  snap: 'mandatory',
});
```

- **Multi-Axis Aware**: In `orientation: 'both'`, snapping settles independently along both X and Y to the nearest grid element.
- Programmatic scrolling (`scrollTo`) and active dragging bypass snapping until movement rests.

---

### 4. Built-in Parallax

> **Requires**: `import parallax from 'amber-scroll/parallax'` (or `from 'amber-scroll/effects'`)

Add `data-amber-speed` to any element nested inside a panel:

```html
<section class="panel">
  <!-- Moves at 60% speed (appears distant in the background) -->
  <img data-amber-speed="0.6" src="mountains.webp" alt="Background" />

  <!-- Moves at 120% speed (appears in foreground) -->
  <h2 data-amber-speed="1.2">Floating Headline</h2>
</section>
```

```js
import Amber from 'amber-scroll';
import parallax from 'amber-scroll/parallax';

const amber = new Amber({
  plugins: [parallax],
});
```

- **GPU Composited**: Uses CSS `translate` independent of the element's layout or `transform`.
- **Center-relative**: Offsets are normalized to the element's passage through the viewport rather than accumulating arbitrary unbounded offsets from the page top.
- Supported in both `native` and `transform` renderers.

---

### 5. Element Pinning

> **Requires**: `import pinning from 'amber-scroll/pinning'` (or `from 'amber-scroll/effects'`)

Pin elements across section intervals without CSS `position: sticky` limitations:

```js
import Amber from 'amber-scroll';
import pinning from 'amber-scroll/pinning';

const amber = new Amber({
  plugins: [pinning],
  pin: [
    {
      target: '#sticky-header', // Selector or Element to pin
      start: '#intro',          // Required section boundary; see activation rules below
      end: '#footer',           // Section boundary where pinning releases
      position: 'top',          // 'top' | 'middle' (default: 'top')
      offset: 24,               // Offset in pixels from resting position (default: 0)
      endOffset: ({ height }) => -height - 64, // Optional dynamic release offset
    },
  ],
});
```

Pinning begins when the **target reaches its resting line**. With `position: 'top'`,
the target's top rests at `offset` pixels from the viewport top. With `'middle'`,
the target's center rests at the viewport center plus `offset`. The `start` section
must reach that line no later than the target does; an earlier target arrival
throws. Choosing an earlier `start` section does not make the target pin sooner.
Release occurs when the `end` section's top reaches the line, adjusted by
`endOffset`.

- `start` and `end` must be **direct children of the configured content element**. The target must be a content descendant and may be a panel itself or a nested element.
- Targets must use normal flow, `position: relative`, or `position: absolute`; `sticky` and `fixed` targets are rejected.
- Targets must be unique, and one pin target cannot contain another pin target.
- Missing targets or boundaries remain inactive until a layout refresh resolves them. Sections marked `data-amber-avoid` do not participate.
- `endOffset` adjusts the release boundary in CSS pixels (default `0`). It accepts a number or a callback receiving `{ target, start, end, height, viewportSize }`, evaluated on layout refresh.
- Pinning works on **vertical** tracks in both `native` and `transform` renderers, including infinite loops. Horizontal and 2D pinning are not supported.
- On an infinite track the pin range must sit on **one lap**: `start` before `end`, and the release must occur before the loop seam. A range that wraps from the last panel back through the first throws: `pin intervals cannot wrap the infinite seam`. Native loops use the same virtual pin write path as transform; they do not pin to physical `scrollTop`.
- Parallax effects inside a pinned element pause automatically during the pin interval and resume seamlessly upon release.

---

### 6. Nested Scroll Handoff (`scrollChain: true`)

Set `scrollChain: true` on a nested Amber instance to pass outward wheel, keyboard, or touch input to an ancestor when reaching a finite edge:

```js
const innerAmber = new Amber({
  wrapper: document.querySelector('.nested-scroll-container'),
  scrollChain: true, // Passes gestures to the parent once boundary is reached
});
```

- In two-axis mode, a diagonal gesture is handed off only when all its moving axes can release.
- Reversing direction smoothly gives control back to the nested instance without lifting the finger.

---

### 7. Section Visibility Observer

> **Requires**: `import sections from 'amber-scroll/sections'`

Subscribe to high-performance enter and leave events for direct panels:

```js
import Amber from 'amber-scroll';
import sections from 'amber-scroll/sections';

const amber = new Amber({
  plugins: [sections],
  observeSections: {
    threshold: 0.25, // Fires when at least 25% of the panel is visible
    targets: ['.feature-panel', '#contact'], // Optional: Filter by selector (omitting tracks all panels)
    onEnter(entry) {
      console.log('Entered:', entry.target, 'Progress:', entry.progress);
    },
    onLeave(entry) {
      console.log('Left:', entry.target);
    },
  },
});
```

Or listen via event subscriptions:

```js
const amber = new Amber({
  plugins: [sections],
  observeSections: true,
});

amber.on('sectionenter', (entry) => {
  entry.target.classList.add('is-visible');
});

amber.on('sectionleave', (entry) => {
  entry.target.classList.remove('is-visible');
});
```

- In 2D multi-axis mode, the observer calculates true 2D cross-intersection (`crossRatio`), ensuring sections are only activated when genuinely within the viewport plane.

---

## API Reference

### Constructor Options (`AmberOptions`)

```js
const amber = new Amber(options);
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `renderer` | `'native'` \| `transform` *(module)* | `'native'` | Rendering engine. Set to `'native'` (default) or pass the imported `transform` module from `'amber-scroll/transform'`. Note: pass the imported module object, not the string `'transform'`, to preserve tree-shaking. |
| `plugins` | `AmberPlugin[]` | `[]` | Array of imported plugins (e.g. `[snap, parallax, pinning, sections, loop]`). |
| `orientation` | `'vertical'` \| `'horizontal'` \| `'both'` | `'vertical'` | Scroll orientation. `'both'` enables simultaneous 2D omnidirectional motion. |
| `wrapper` | `HTMLElement` \| `Window` | Auto / `window` | Viewport container element (or `window` in native mode). |
| `content` | `HTMLElement` | Auto / `body` | Inner content wrapper containing panels/tiles. |
| `damping` | `number` | `0.09` | Inertial smoothing factor per 60Hz frame (range: `(0, 1]`). |
| `infinite` | `boolean` \| `{ x?: boolean, y?: boolean }` | `false` | Enable continuous cyclic wrap-around track. Requires `transform` renderer or `amber-scroll/infinite` in plugins. |
| `snap` | `false` \| `'proximity'` \| `'mandatory'` | `false` | Magnetic edge settling mode *(Requires `amber-scroll/snap`)*. |
| `snapDistance` | `number` | Auto | Proximity snap radius in pixels (default: 20% of viewport, capped at 100px). |
| `pin` | `false` \| `PinOptions[]` | `false` | Section boundary pinning configurations *(Requires `amber-scroll/pinning`)*. |
| `observeSections` | `boolean` \| `SectionObserverOptions` | `false` | Track panel enter/leave visibility transitions *(Requires `amber-scroll/sections`)*. |
| `scrollChain` | `boolean` | `false` | When `true`, passes gestures to ancestor containers when reaching edges. |
| `managedWheel` | `boolean` | `false` | Captures and cancels every cancelable wheel event in the Amber root. Use for self-contained 2D canvases; nested native wheel scrolling is blocked. |
| `hideScrollbar` | `boolean` | `false` | Hides native scrollbars on the configured viewport (the page when using `window`) and installs styles for `data-amber-hide-scrollbar`. 2D instances enable it automatically; transform viewports use hidden overflow. |
| `anchors` | `boolean` | `true` | Intercept hash links (`<a href="#id">`) and restore browser history in transform mode. |
| `historyKey` | `string` | Auto | Key identifier used for history and session hash storage in transform mode. |
| `wheelMultiplier` | `number` | `0.5` | Multiplier for mousewheel / trackpad input distance. |
| `wheelGesture` | `'vertical'` \| `'horizontal'` \| `'both'` \| `'axis'` | Axis-dependent | Restrict or allow multi-axis wheel input. |
| `lineHeight` | `number` | `60` | Pixel height used to normalize line-based wheel scroll deltas. |
| `touchMultiplier` | `number` | `2.5` | Multiplier for touch drag movement. |
| `touchInertia` | `number` | `12` | Release momentum velocity multiplier (`0` disables fling). |
| `touchInertiaTimeout` | `number` | `100` | Maximum time in milliseconds between the last tracked touch movement and release for momentum to apply. Holding still longer before lifting prevents a fling. |
| `smoothTouch` | `boolean` | `true` | When `false`, uses native browser touch scrolling in native mode. |
| `keyboardStep` | `number` | `100` | Travel distance per arrow key press (in pixels). |
| `respectReducedMotion` | `boolean` | `true` | When user prefers reduced motion, falls back to immediate/native scrolling. |
| `autoRaf` | `boolean` | `true` | When `false`, Amber will not run its internal RAF loop; call `amber.raf(time)` manually. |

---

### Instance Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `amber.position` | `number` | Primary axis position in CSS pixels (X for horizontal, Y for vertical/both). |
| `amber.target` | `number` | Primary axis destination target currently being approached. |
| `amber.limit` | `number` | Maximum scrollable distance on primary axis (or cycle length if looping). |
| `amber.velocity` | `number` | Current velocity in CSS pixels per millisecond. |
| `amber.direction` | `1` \| `-1` \| `0` | Direction of last movement (`1` = forward/down, `-1` = backward/up). |
| `amber.progress` | `number` | Normalized progress from `0` to `1` along the primary axis. |
| `amber.wrappedPosition`| `number` | Position within the current loop cycle in infinite mode. |
| `amber.loopLength` | `number` | Total cycle length in pixels on primary axis (or `0` if not infinite). |
| `amber.positionVector` | `Vector` | `{ readonly x: number, readonly y: number }` coordinates. |
| `amber.targetVector` | `Vector` | Target destination vector `{ x, y }`. |
| `amber.limitVector` | `Vector` | Maximum scrollable bounds vector `{ x, y }`. |
| `amber.velocityVector` | `Vector` | Current velocity vector in px/ms per axis. |
| `amber.directionVector`| `{ x, y }` | Directions per axis (`-1` \| `0` \| `1`). |
| `amber.progressVector` | `Vector` | Normalized `[0, 1]` progress vector per axis. |
| `amber.wrappedPositionVector` | `Vector` | Loop-wrapped positions per axis `{ x, y }`. |
| `amber.loopLengthVector` | `Vector` | Total cycle lengths per axis `{ x, y }`. |
| `amber.infiniteAxes` | `{ x, y }` | Active loop status per axis. |
| `amber.isScrolling` | `boolean` | `true` while inertia or drag movement is actively underway. |
| `amber.isStopped` | `boolean` | `true` if input is currently halted via `amber.stop()`. |
| `amber.isDestroyed` | `boolean` | `true` if the instance has been torn down. |
| `amber.isInfinite` | `boolean` | `true` if infinite looping mode is active on any axis. |
| `amber.state` | `ScrollState` | Immutable snapshot of all current scroll metrics. |

---

### Instance Methods

#### `amber.scrollTo(target, options?)`
Scrolls programmatically to a given pixel position, element, or 2D vector coordinate.
```js
amber.scrollTo(500);                                // Numeric pixel position (primary axis)
amber.scrollTo({ x: 800, y: 1200 });                 // 2D Vector position
amber.scrollTo('#projects');                         // Selector
amber.scrollTo(document.querySelector('.contact'));  // DOM element
amber.scrollTo('start');                             // Top / start of track
amber.scrollTo('end');                               // Bottom / end of track

// With options:
amber.scrollTo('#projects', {
  offset: -32,      // Apply an offset in pixels (or { x: -10, y: -30 } for 2D)
  immediate: true,  // Jump immediately without smoothing
});
```

#### `amber.start()` / `amber.stop()`
Pauses or resumes handling user input (wheel, touch, keyboard).
```js
amber.stop();  // Cancels active momentum and ignores user gestures (e.g. while modal is open)
amber.start(); // Resumes listening to input
```

#### `amber.resize()`
Recalculates bounding dimensions, panels, pinning, and parallax limits. Call this if you dynamically resize containers without triggering standard DOM layout changes.
```js
amber.resize();
```

#### `amber.on(event, callback)` / `amber.off(event, callback)`
Subscribes to instance events. Returns an unsubscribe function.
```js
const unsubscribe = amber.on('scroll', (state) => {
  console.log(state.positionVector.x, state.positionVector.y);
});

// Later:
unsubscribe();
```

**Supported Events:**
- `'scroll'`: Fires every animation frame while moving. Receives `state`.
- `'scrollend'`: Fires when motion comes to a complete rest. Receives `state`.
- `'resize'`: Fires when viewport or content dimensions change. Receives `state`.
- `'sectionenter'`: Fires when an observed section reaches the visibility threshold. Receives `entry`.
- `'sectionleave'`: Fires when an observed section exits the threshold. Receives `entry`.
- `'destroy'`: Fires once upon teardown.

#### `amber.raf(timestamp)`
Used when `autoRaf: false` to drive Amber through your own custom animation loop:
```js
function render(timestamp) {
  amber.raf(timestamp);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
```

#### `amber.destroy()`
Performs complete cleanup: cancels animation frames, removes all event listeners, detaches resize observers, and restores original inline styles.
```js
amber.destroy();
```

---

## Framework Integration

### React / Next.js (App Router Compatible)

In React, instantiate Amber within a `useEffect` hook and ensure you return `amber.destroy()` for cleanup:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';
import snap from 'amber-scroll/snap';
import { parallax } from 'amber-scroll/effects';

export default function SmoothPage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!viewportRef.current || !contentRef.current) return;

    const amber = new Amber({
      wrapper: viewportRef.current,
      content: contentRef.current,
      renderer: transform,
      plugins: [snap, parallax],
      snap: 'proximity',
    });

    return () => {
      amber.destroy();
    };
  }, []);

  return (
    <div ref={viewportRef} className="viewport">
      <main ref={contentRef} className="panels">
        <section className="panel">Panel 1</section>
        <section className="panel">
          <h2 data-amber-speed="0.7">Parallax Title</h2>
        </section>
        <section className="panel">Panel 3</section>
      </main>
    </div>
  );
}
```

```css
.viewport {
  height: 100dvh;
  overflow: hidden;
}

.panels {
  display: flex;
  flex-direction: column;
}

.panel {
  flex: none;
  min-height: 100dvh;
}
```

---

### Vue 3 (Composition API)

```vue
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';
import snap from 'amber-scroll/snap';

const viewport = ref(null);
const content = ref(null);
let amber = null;

onMounted(() => {
  amber = new Amber({
    wrapper: viewport.value,
    content: content.value,
    renderer: transform,
    plugins: [snap],
    snap: 'proximity',
  });
});

onUnmounted(() => {
  amber?.destroy();
});
</script>

<template>
  <div ref="viewport" class="viewport">
    <main ref="content" class="panels">
      <section class="panel">Section 1</section>
      <section class="panel">Section 2</section>
    </main>
  </div>
</template>
```

---

## Combining with `amber-motion`

If you are using [`amber-motion`](https://github.com/realhardik/amber/tree/main/packages/motion), you can bind animations directly to Amber's smoothed scroll position without running separate RAF loops.

```js
import Amber from 'amber-scroll';
import Motion, { bindScroll } from 'amber-motion';

const amber = new Amber({ orientation: 'both' });

// Create an animation
const heroAnimation = new Motion({
  targets: '.hero-heading',
  properties: {
    y: { v: [0, -100], unit: 'px' },
    o: [1, 0],
  },
});

// Scrub animation progress against the Y scroll axis from 0px to 500px:
const binding = bindScroll(amber, heroAnimation, {
  source: 'position',
  axis: 'y', // In 2D instances: 'x' or 'y' (defaults to primary axis)
  start: 0,
  end: 500,
  destroyAnimation: true, // Automatically cleans up animation when amber is destroyed
});
```

---

## TypeScript

TypeScript declarations ship with the package and support all vector types and plugin configurations:

```ts
import Amber, {
  type AmberOptions,
  type ScrollState,
  type SectionEntry,
  type PinOptions,
  type Vector,
  type VectorTarget,
} from 'amber-scroll';
import transform from 'amber-scroll/transform';
import snap from 'amber-scroll/snap';
import { parallax, pinning } from 'amber-scroll/effects';

const options: AmberOptions = {
  orientation: 'both',
  renderer: transform,
  plugins: [snap, parallax, pinning],
  damping: 0.08,
  snap: 'proximity',
};

const amber = new Amber(options);

amber.on('scroll', (state: ScrollState) => {
  const current: Vector = state.positionVector;
  console.log(current.x, current.y);
});
```

---

## Limitations & Troubleshooting

- **Horizontal RTL layouts:** `orientation: 'horizontal'` and `'both'` require an LTR viewport. A viewport with computed `direction: rtl` is rejected.
- **Infinite mode falls back to finite scrolling:** Requesting `infinite` does not guarantee an active loop. Each looped axis needs a cycle at least as long as the viewport plus its largest panel/tile. One-dimensional panels must also form an ordered, nonoverlapping track. Check `amber.isInfinite` or `amber.infiniteAxes` after construction and resize; changing layout can enable or disable looping.
- **Style ownership:** Transform renderers own direct panel/tile `transform` values. Parallax and pinning own their targets' `translate` values. Put independent animation transforms on a nested child and avoid concurrent writers to the same property. Destroying Amber restores the inline styles it saved.
- **Browser setup:** The package exports ES modules. Importing during SSR is safe, but construct Amber only after mounting its elements in a browser. Transform mode needs an element viewport and a separate content element inside it. Destroy the existing instance before creating another on the same viewport.
- **Content does not move:** Check that the viewport is constrained and content overflows the intended axes, as in the quick starts. Call `amber.resize()` after layout changes that automatic observation does not detect, and confirm that reduced motion or `amber.stop()` is not changing the expected behavior.

---

## Author

**Hardik Gandhi**

[![GitHub](https://img.shields.io/badge/GitHub-realhardik-181717?style=flat-square&logo=github)](https://github.com/realhardik)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thehardikgandhi-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/thehardikgandhi)
[![Instagram](https://img.shields.io/badge/Instagram-he.is.gandhi-E4405F?style=flat-square&logo=instagram)](https://www.instagram.com/he.is.gandhi/)
[![Pinterest](https://img.shields.io/badge/Pinterest-chill__chief-BD081C?style=flat-square&logo=pinterest)](https://pinterest.com/chill_chief/)

## License

MIT © [Hardik Gandhi](https://github.com/realhardik)

### Error diagnostics

Published builds keep runtime validation but report compact `Amber Axxx` error codes. See [the error reference](./ERRORS.md) for their meanings. Source imports retain descriptive messages.
