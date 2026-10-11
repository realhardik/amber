# Production error codes

Published Amber Scroll builds keep validation and error classes, but use the codes below to reduce download size. Source imports retain descriptive messages. No integration changes are required unless you match exact error messages. `${…}` indicates a value supplied at runtime in the source diagnostic.

Do not reuse or renumber these codes. When adding an error, assign the next unused code.

| Code | Error class | Diagnostic |
| --- | --- | --- |
| A001 | TypeError | Amber: renderer must be "native" or the module imported from "amber-scroll/transform". |
| A002 | TypeError | Amber: pin requires the pinning module in plugins (import from "amber-scroll/effects" or "amber-scroll/pinning"). |
| A003 | TypeError | Amber: snap options require the module from "amber-scroll/snap" in plugins. |
| A004 | TypeError | Amber: observeSections requires the module from "amber-scroll/sections" in plugins. |
| A005 | TypeError | Amber: invalid ${key}. |
| A006 | TypeError | Amber: ${key} must be a finite, nonnegative number. |
| A007 | RangeError | Amber: damping must be greater than 0 and at most 1. |
| A008 | TypeError | Amber: smoothTouch=false requires the native renderer. |
| A009 | TypeError | Amber: ${key} must be a boolean. |
| A010 | TypeError | Amber: historyKey must be a non-empty string. |
| A011 | TypeError | Amber: infinite must be a boolean or { x, y } boolean mask. |
| A012 | TypeError | Amber: infinite axes must be enabled by orientation. |
| A013 | TypeError | Amber: native infinite scrolling requires the module from "amber-scroll/infinite" in plugins. |
| A014 | Error | Amber: construct an instance in a browser after the DOM is ready. |
| A015 | TypeError | Amber: wrapper must be a Window or an HTML element in a ready document. |
| A016 | TypeError | Amber: content must be an element inside the wrapper. |
| A017 | TypeError | Amber: transform mode requires an element wrapper and a separate content element inside it. |
| A018 | Error | Amber: this wrapper already has an instance. Destroy it before replacing it. |
| A019 | Error | Amber: horizontal RTL layouts are not supported yet. Use an LTR scroll viewport. |
| A020 | TypeError | Amber: unknown event '${event}'. |
| A021 | TypeError | Amber: event callback must be a function. |
| A022 | Error | Amber: scroll target must exist inside the wrapper. |
| A023 | TypeError | Amber: scrollTo expects finite coordinates and offset. |
| A024 | TypeError | Amber: scrollTo expects a number, selector, element, or { x, y } coordinates. |
| A025 | TypeError | Amber: invalid vector offset. |
| A026 | TypeError | Amber: offset must be finite. |
| A027 | TypeError | Amber: scroll coordinates must be finite. |
| A028 | TypeError | Amber: destination uses an inactive axis. |
| A029 | TypeError | Amber: raf expects a timestamp in milliseconds. |
| A030 | TypeError | Amber: plugins must be an array of imported feature modules. |
| A031 | TypeError | Amber: plugins must contain imported Amber feature modules. |
| A032 | TypeError | Amber: conflicting '${plugin.name}' modules. |
| A033 | TypeError | Motion destination must be a number or vector. |
| A034 | TypeError | Motion destination must be finite. |
| A035 | TypeError | Motion delta time must be finite. |
| A036 | RangeError | Amber: a pin target must have nonzero effective parallax speed. |
| A037 | TypeError | Amber: pin must be false or an array. |
| A038 | TypeError | Amber: each pin must be an options object. |
| A039 | TypeError | Amber: pin.${key} must be a selector or element. |
| A040 | TypeError | Amber: pin.position must be top or middle. |
| A041 | TypeError | Amber: pin.offset must be finite. |
| A042 | TypeError | Amber: pin.endOffset must be finite or a function. |
| A043 | SyntaxError | Amber: invalid pin.${key} selector '${option[key]}'. |
| A044 | TypeError | Amber: pin start and end must be direct content children. |
| A045 | TypeError | Amber: pin targets must be unique and cannot contain one another. |
| A046 | TypeError | Amber: pin targets must use normal, relative, or absolute positioning. |
| A047 | RangeError | Amber: pin target reaches its resting position before the start section. Choose an earlier start section. |
| A048 | TypeError | Amber: pin.endOffset must resolve to a finite number. |
| A049 | RangeError | Amber: pin intervals cannot wrap the infinite seam. Keep start and end on one lap, with start before end. |
| A050 | TypeError | Amber: pinning requires vertical scrolling. |
| A051 | TypeError | Amber: observeSections must be false, true, or an options object. |
| A052 | RangeError | Amber: section observer threshold must be between 0 and 1. |
| A053 | TypeError | Amber: observeSections.${name} must be a function. |
| A054 | TypeError | Amber: observeSections.targets must be an array of CSS selectors. |
| A055 | TypeError | Amber: every section target must be a non-empty CSS selector. |
| A056 | SyntaxError | Amber: invalid section target selector '${selector}'. |
| A057 | TypeError | Amber: snapDistance must be a finite, nonnegative number of pixels. |
| A058 | TypeError | Amber: snap must be false, proximity, or mandatory. |
