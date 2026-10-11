export type Unsubscribe = () => void;
export type MotionElement = HTMLElement | SVGElement;
export type MotionTargets = string | MotionElement | Iterable<MotionElement> | ArrayLike<MotionElement>;
export type EasingName = 'lin' | 'oe' | 'ob' | `${'i' | 'o' | 'io'}${1 | 2 | 3 | 4 | 5 | 6}`;
export type EasingFunction = (progress: number) => number;
export type PropertyValues = readonly [from: number, to: number, unit?: string];
export interface PropertyOptions {
  v: PropertyValues;
  unit?: string;
  name?: string;
}
export type MotionProperties = Readonly<Record<string, PropertyValues | PropertyOptions>>;
export interface MotionTimingOptions {
  root?: ParentNode;
  duration?: number;
  d?: number;
  delay?: number;
  id?: number;
  stagger?: number;
  de?: number;
  easing?: EasingName | EasingFunction;
  ef?: EasingName | EasingFunction;
  /** Sets the initial playhead at the end and makes the initial play() run backward. */
  reverse?: boolean;
  r?: boolean;
  playbackRate?: number;
  respectReducedMotion?: boolean;
  scheduler?: Scheduler;
  onComplete?: (animation: Animation) => void;
  cb?: (animation: Animation) => void;
  onUpdate?: (progress: number, animation: Animation) => void;
}
export interface MotionTracks {
  properties?: MotionProperties;
  t?: MotionProperties;
}
export type TargetOptions = { targets: MotionTargets; el?: MotionTargets } | { el: MotionTargets; targets?: MotionTargets };
type RequiredTrack = { [K in keyof MotionTracks]-?: Required<Pick<MotionTracks, K>> }[keyof MotionTracks];
export type MotionOptions = MotionTimingOptions & TargetOptions & MotionTracks & RequiredTrack;
export type AnimationOptions = MotionOptions;
export interface PlayOptions {
  /** Defaults to the constructor direction on initial play, otherwise false. Reverse from the current paused position when true. */
  rev?: boolean;
  reverse?: boolean;
  r?: boolean;
}
export interface DestroyOptions { revert?: boolean }
export type AnimationStatus = 'idle' | 'running' | 'paused' | 'finished' | 'destroyed';

export class Animation {
  constructor(options: MotionOptions);
  readonly elements: readonly MotionElement[];
  readonly window: Window;
  readonly duration: number;
  readonly delay: number;
  readonly stagger: number;
  readonly span: number;
  readonly total: number;
  readonly direction: -1 | 1;
  readonly playbackRate: number;
  readonly time: number;
  readonly progress: number;
  readonly status: AnimationStatus;
  readonly isPlaying: boolean;
  readonly destroyed: boolean;
  readonly respectReducedMotion: boolean;
  cb: ((animation: Animation) => void) | undefined;
  onUpdate: ((progress: number, animation: Animation) => void) | undefined;
  play(options?: PlayOptions): this;
  pause(): this;
  reverse(): this;
  restart(): this;
  /** Pause bindings, rewind delay, and render start values without callbacks. */
  reset(): this;
  /** Pause and render normalized progress; does not invoke onComplete. */
  seek(progress: number): this;
  finish(): this;
  setPlaybackRate(rate: number): this;
  onDestroy(callback: () => void): Unsubscribe;
  destroy(options?: DestroyOptions): void;
}
export { Animation as default, Animation as Motion };
export function animate(options: MotionOptions): Animation;
/** Reset only the supplied animations; destroyed instances are ignored. */
export function resetAll(animations: Iterable<Animation>): void;
export const easings: Readonly<Record<EasingName, EasingFunction>>;
export { easings as Ease };

export interface TimelineOptions { onComplete?: (timeline: Timeline) => void }
export class Timeline {
  constructor(options?: TimelineOptions);
  readonly status: AnimationStatus;
  readonly index: number;
  readonly current: Animation | null;
  from(step: MotionOptions | (() => void)): this;
  play(callback?: (timeline: Timeline) => void): this;
  restart(callback?: (timeline: Timeline) => void): this;
  pause(): this;
  destroy(options?: DestroyOptions): void;
}

/** Public structural interface keeps standalone Motion independent of amber-scroll. */
export interface ScrollState {
  readonly positionVector?: Readonly<{ x: number; y: number }>;
  readonly progressVector?: Readonly<{ x: number; y: number }>;
  readonly wrappedPositionVector?: Readonly<{ x: number; y: number }>;
  readonly velocityVector?: Readonly<{ x: number; y: number }>;
  readonly progress: number;
  readonly position: number;
  readonly wrappedPosition: number;
  readonly velocity: number;
  readonly limit: number;
}
export interface ScrollController<State extends ScrollState = ScrollState> {
  readonly state: State;
  readonly isDestroyed: boolean;
  on(event: 'scroll' | 'scrollend' | 'resize', callback: (state: State) => void): Unsubscribe;
  on(event: 'destroy', callback: () => void): Unsubscribe;
}
export type ScrollBoundary<State extends ScrollState = ScrollState> = number | ((state: State) => number);
export type ScrollBindingOptions<State extends ScrollState = ScrollState> = {
  /** Omit for the primary-axis scalar source. */
  axis?: 'x' | 'y';
  start?: ScrollBoundary<State>;
  respectReducedMotion?: boolean;
  reducedMotionProgress?: number;
  destroyAnimation?: boolean;
} & (
  { source?: 'progress'; end?: ScrollBoundary<State> } |
  { source: 'position' | 'wrappedPosition' | 'velocity'; end: ScrollBoundary<State> }
);
export interface ScrollBinding {
  update(): void;
  pause(): this;
  play(): this;
  destroy(): void;
}
export function bindScroll<State extends ScrollState>(amber: ScrollController<State>, animation: Animation, options?: ScrollBindingOptions<State>): ScrollBinding;

export class Tab {
  constructor(document?: Document);
  readonly document: Document;
  readonly hidden: boolean;
  add(listener: (hidden: boolean) => void): Unsubscribe;
  destroy(): void;
}

export interface ScheduledRunner {
  lastTime: number | null;
  tick(time: number): void;
  pause(): unknown;
}
export class Scheduler {
  constructor(window?: Window);
  readonly window: Window;
  readonly frame: number | null;
  add(runner: ScheduledRunner): void;
  remove(runner: ScheduledRunner): void;
  cancel(): void;
  wake(): void;
  destroy(): void;
}
export interface FrameRunnerOptions { scheduler?: Scheduler; window?: Window }
export class FrameRunner<Args extends unknown[] = []> implements ScheduledRunner {
  constructor(callback: (elapsedMs: number, ...args: Args) => void, options?: FrameRunnerOptions);
  readonly elapsed: number;
  readonly on: boolean;
  readonly destroyed: boolean;
  lastTime: number | null;
  run(...args: Args): this;
  tick(time: number): void;
  pause(): this;
  stop(): this;
  destroy(): void;
}
