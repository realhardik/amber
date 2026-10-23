# Amber

> High-performance smooth scrolling engine and animation system for the modern web.

Amber provides buttery smooth, physics-based inertial scrolling with native and CSS transform rendering, infinite track looping, proximity edge snapping, GPU-composited parallax, and responsive pinning. Amber is paired with `amber-motion`, a zero-dependency timeline and animation engine.

---

## Packages

This repository is organized as an npm workspace containing the core engine and companion plugins:

| Package | Version | Description |
| :--- | :--- | :--- |
| [`amber-scroll`](packages/amber) | `1.0.1` | Standalone smooth-scroll engine with native and transform rendering, virtual keyboard isolation, infinite seams, and parallax. |
| [`amber-motion`](packages/motion) | `1.0.1` | Optional, zero-dependency motion engine for CSS animation, timelines, and scroll-linked reactivity; SVG tools are opt-in via `amber-motion/svg`. |

---

## Features

### `amber-scroll`
- **Modular Plugin Architecture**: Native document scrolling core, with on-demand subpath plugins for transforms, edge snapping, parallax, pinning, sections, and native infinite looping.
- **Omnidirectional Multi-Axis**: True 2D vector scrolling (`orientation: 'both'`) across spatial canvases, maps, photo matrices, and creative grids. X/Y targets settle independently; Shift + wheel is an explicit horizontal fallback.
- **Dual-Mode Rendering**: Default native scrolling for standard web documents, or virtualized sub-pixel smoothing via the `transform` renderer module.
- **Infinite Seams**: Closed-loop cyclic scrolling with seamless wrap-around, velocity preservation, and zero-gap edge transitions in both transform and native modes.
- **Declarative Parallax**: Multi-speed depth planes (`data-amber-speed`) calculated per-frame with GPU-composited CSS translates.
- **Element Pinning**: Pin sections across custom scroll extents with zero layout thrashing and dynamic offsets.
- **Nested Scroll Handoff**: Fluid scroll chaining (`scrollChain: true`) between inner scrollers and parent viewports.
- **Accessibility First**: Respects `prefers-reduced-motion` preferences automatically. Form inputs, zoom gestures, and nested native containers remain fully functional.

### `amber-motion`
- **Zero Dependencies**: Lightweight, hardware-accelerated animation runner using shared RAF scheduling.
- **Scroll Synchronization**: Directly connects Amber's smoothed playhead to animation progress without starting extra requestAnimationFrame loops.
- **Optional SVG Morphing & Path Drawing**: Import `amber-motion/svg` for smooth interpolation across polygon shapes and stroked paths without adding SVG machinery to normal CSS-only animation bundles.
- **Timelines & Chaining**: Compose complex multi-step sequences with stagger offsets, pauses, and reversible playheads.

---

## Quick Start

### Installation

Install both the smooth scroll and animation engines in your project:

```bash
npm install amber-scroll amber-motion
```

You can also install either package on its own:

```bash
# Smooth scrolling only
npm install amber-scroll

# Animation only
npm install amber-motion
```

See the [amber-scroll guide](packages/amber/README.md#quick-start) or [amber-motion guide](packages/motion/README.md#create-an-animation) for usage examples. Scroll bindings require both packages.

## Development

From a clone of this repository, install the workspace dependencies:

```bash
npm install
```

### Run Tests

```bash
# Run all unit tests for amber-scroll and amber-motion
npm test

# Run full cross-browser test suite (Chromium, Firefox, WebKit)
npm run test:browser

# Check package declarations and TypeScript consumer examples
npm run test:types

# Run all checks
npm run check
```

### Local Development Fixture

```bash
npm run dev
```

---

## Documentation & References

- [`amber-scroll` Documentation & API](packages/amber/README.md) — Complete guide: setup, options, edge snapping, parallax, section pinning, infinite loops, and framework integrations (React, Next.js, Vue).
- [`amber-motion` Documentation & API](packages/motion/README.md) — Animation engine: CSS timelines, opt-in `amber-motion/svg` morphing/path drawing, easing, and scroll synchronization (`bindScroll`).
- Both packages include TypeScript declarations; no separate `@types` installation is needed.
- [Release preparation and publishing](RELEASING.md) — validation, packaging, and publishing commands.

---

## Architecture

```text
amber/
├── packages/
│   ├── amber/                  # amber-scroll package
│   │   ├── src/                # Core engine, input handlers, renderers, parallax, pinning
│   │   ├── tests/              # Unit tests and Playwright browser test suite
│   │   └── package.json
│   └── motion/                 # amber-motion package
│       ├── src/                # Scheduler, CSS/SVG animation entries, timelines, scroll bindings
│       ├── tests/              # Unit and browser integration tests
│       └── package.json
├── package.json                # Workspace configuration
└── README.md
```

## Author

**[Hardik Gandhi](https://hardikgandhi.me)**

[![Website](https://img.shields.io/badge/Website-hardikgandhi.me-000000?style=flat-square)](https://hardikgandhi.me)
[![GitHub](https://img.shields.io/badge/GitHub-realhardik-181717?style=flat-square&logo=github)](https://github.com/realhardik)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thehardikgandhi-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/thehardikgandhi)
[![Instagram](https://img.shields.io/badge/Instagram-he.is.gandhi-E4405F?style=flat-square&logo=instagram)](https://www.instagram.com/he.is.gandhi/)

## License

MIT © [Hardik Gandhi](https://hardikgandhi.me)
