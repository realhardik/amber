# Changelog

## 1.0.0 — unreleased

- Amber Scroll: native and transform rendering, shared 1D/2D motion, optional infinite scrolling, snapping, parallax, pinning, and section observation.
- Amber Motion: CSS animation, timelines, SVG morphing and stroke drawing, and optional Scroll bindings.
- Consolidated renderer destination calculations, vector handling, input routing, and option validation while preserving scalar public APIs.
- Restored scalar renderer writes and fixed 2D Home/End routing to respect both axes of nested scrollers.
- Optional features own their lifecycle hooks; CSS tracks prepare interpolation and transform lookup once.
- Production builds report compact documented error codes while retaining runtime validation and error classes.
- Added regression coverage and a smoke test using packed packages in an Angular nested-route application.
