# Production error codes

Published Amber Motion builds keep validation and error classes, but use the codes below to reduce download size. Source imports retain descriptive messages. No integration changes are required unless you match exact error messages. `${…}` indicates a value supplied at runtime in the source diagnostic.

Do not reuse or renumber these codes. When adding an error, assign the next unused code.

| Code | Error class | Diagnostic |
| --- | --- | --- |
| M001 | TypeError | Animation needs at least one element. |
| M002 | TypeError | Unknown easing: ${easing} |
| M003 | TypeError | Callbacks must be functions. |
| M004 | TypeError | play().rev must be a boolean. |
| M005 | TypeError | ${name} must be finite and >= ${min}. |
| M006 | TypeError | resetAll needs an explicit iterable of animations. |
| M007 | TypeError | resetAll expects animation instances. |
| M008 | TypeError | Tab requires a document. |
| M009 | TypeError | Tab.add expects a function. |
| M010 | TypeError | Scheduler requires a browser window. |
| M011 | Error | Start animations in a browser, or supply a scheduler. |
| M012 | TypeError | FrameRunner expects a callback. |
| M013 | TypeError | bindScroll needs a live Amber instance. |
| M014 | TypeError | bindScroll needs a live animation. |
| M015 | TypeError | Scroll axis must be x or y. |
| M016 | TypeError | Invalid scroll source. |
| M017 | TypeError | Provide end for pixel or velocity ranges. |
| M018 | RangeError | Scroll start and end must differ. |
| M019 | TypeError | SVG endpoints must be nonempty strings. |
| M020 | TypeError | Invalid SVG syntax. |
| M021 | TypeError | SVG shape needs at least ${points} coordinate pairs. |
| M022 | TypeError | SVG path must start with moveto. |
| M023 | TypeError | Invalid SVG command. |
| M024 | TypeError | Invalid SVG command coordinate count. |
| M025 | TypeError | Invalid SVG arc. |
| M026 | TypeError | SVG morph needs matching commands, coordinate counts, and arc flags. Normalize shapes first. |
| M027 | TypeError | Unsupported SVG morph type. |
| M028 | TypeError | Line drawing needs SVG geometry. |
| M029 | TypeError | Dash pattern must contain nonnegative lengths with a positive sum. |
| M030 | RangeError | Dash pattern is too fine for this path. |
| M031 | TypeError | Animation needs properties, morph, or line options. |
| M032 | TypeError | Property ${key} needs v: [from, to]. |
| M033 | TypeError | Property unit must be a string. |
| M034 | TypeError | Unsupported transform function. |
| M035 | TypeError | SVG morph and line tracks require the amber-motion/svg entry. |
| M036 | TypeError | Animation needs properties. |
