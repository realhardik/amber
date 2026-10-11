import { Animation } from './animation.js';
import { createSvgTracks, morphInterpolator } from './svg-tracks.js';
import { Timeline } from './timeline.js';

/** Animation class with opt-in SVG morphing and stroke drawing tracks. */
export class SvgAnimation extends Animation {
  constructor(options = {}) { super(options, createSvgTracks); }
}

/** Sequential timeline that creates SvgAnimation steps. */
export class SvgTimeline extends Timeline {
  constructor(options = {}) { super(options, SvgAnimation); }
}

export const animate = options => new SvgAnimation(options);
export { SvgAnimation as default, SvgAnimation as Animation, SvgAnimation as Motion, SvgTimeline as Timeline, morphInterpolator };
