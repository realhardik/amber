import type { Animation as BaseAnimation, AnimationStatus, DestroyOptions, MotionProperties, MotionTargets, MotionTimingOptions, PlayOptions, TargetOptions, Unsubscribe } from './index.js';

export interface MorphOptions {
  type?: 'path' | 'polygon' | 'polyline';
  start?: string | readonly string[];
  end: string | readonly string[];
}
export interface LineOptions {
  start?: number;
  end?: number;
  dashed?: string;
}
export interface SvgMotionTracks {
  properties?: MotionProperties;
  t?: MotionProperties;
  morph?: MorphOptions;
  m?: MorphOptions;
  line?: LineOptions;
  l?: LineOptions;
}
type RequiredTrack = { [K in keyof SvgMotionTracks]-?: Required<Pick<SvgMotionTracks, K>> }[keyof SvgMotionTracks];
export type SvgMotionOptions = MotionTimingOptions & TargetOptions & SvgMotionTracks & RequiredTrack;

/** Opt-in SVG-capable animation. Import from amber-motion/svg. */
export class SvgAnimation extends BaseAnimation {
  constructor(options: SvgMotionOptions);
}
export { SvgAnimation as default, SvgAnimation as Animation, SvgAnimation as Motion };
export function animate(options: SvgMotionOptions): SvgAnimation;
export function morphInterpolator(from: string, to: string, polygon?: boolean): (progress: number) => string;

export interface SvgTimelineOptions { onComplete?: (timeline: SvgTimeline) => void }
export class SvgTimeline {
  constructor(options?: SvgTimelineOptions);
  readonly status: AnimationStatus;
  readonly index: number;
  readonly current: SvgAnimation | null;
  from(step: SvgMotionOptions | (() => void)): this;
  play(callback?: (timeline: SvgTimeline) => void): this;
  restart(callback?: (timeline: SvgTimeline) => void): this;
  pause(): this;
  destroy(options?: DestroyOptions): void;
}
export { SvgTimeline as Timeline };
