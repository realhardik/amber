import Amber, { Amber as NamedAmber, type AmberOptions, type SectionEntry } from 'amber-scroll';
import transform from 'amber-scroll/transform';
import infinite from 'amber-scroll/infinite';
import { parallax, pinning } from 'amber-scroll/effects';
import snap from 'amber-scroll/snap';
import sections from 'amber-scroll/sections';
import Motion, { Animation, animate, bindScroll, resetAll, easings, Ease, Timeline, FrameRunner, Scheduler, Tab, type MotionOptions } from 'amber-motion';
import SvgMotion, { Animation as SvgAnimation, Timeline as SvgTimeline, type SvgMotionOptions } from 'amber-motion/svg';

const content = document.createElement('main');
const child = document.createElement('div');
const options = {
  wrapper: window,
  renderer: 'native',
  plugins: [parallax, pinning, snap, sections],
  pin: [{ target: child, start: '#start', end: '#end', position: 'middle' }],
  observeSections: { targets: ['.section'], onEnter(entry) { const value: SectionEntry = entry; void value; } },
} satisfies AmberOptions;
const amber: NamedAmber = new Amber(options);
const stop = amber.on('scroll', state => {
  const direction: -1 | 0 | 1 = state.direction;
  const velocity: number = state.velocity;
  void [direction, velocity];
  // @ts-expect-error emitted state is immutable
  state.position = 12;
});
amber.on('sectionleave', entry => { entry.target.matches('.panel'); entry.state.position.toFixed(); });
amber.on('destroy', () => {});
amber.off('scroll', state => { state.progress.toFixed(); });
amber.scrollTo('#hero', { immediate: true, offset: -10 }).stop().start().resize();
amber.scrollTo(content);
amber.raf(10);
stop();

const motionOptions = {
  targets: child,
  properties: { x: { v: [0, 100], unit: 'px' }, o: [0, 1], '--progress': [0, 1] },
  easing: 'io4',
  onUpdate(progress, animation) { progress.toFixed(); animation.pause(); },
} satisfies MotionOptions;
const motion: Animation = new Motion(motionOptions);
const legacy: Animation = animate({ el: document.querySelectorAll<HTMLDivElement>('.card'), t: { y: { v: [20, 0, 'px'] } }, ef: 'lin' });
const svgOptions = { el: new Set([child]), l: { start: 0, end: 100, dashed: '3 4' } } satisfies SvgMotionOptions;
const svg: SvgAnimation = new SvgMotion(svgOptions);
new SvgMotion({ el: document.createElementNS('http://www.w3.org/2000/svg', 'path'), m: { end: ['M0 0 L20 30'] } });
new SvgTimeline().from(svgOptions).play();
motion.pause().play({ rev: true }).play({ rev: false }).reverse().seek(.5).setPlaybackRate(2).restart().finish();
motion.onDestroy(() => {});
motion.reset().play();
resetAll([motion, legacy]);
resetAll(new Set([motion]));
motion.cb = current => current.pause();
void [easings.io4(.5), Ease.oe(.5), legacy];
const binding = bindScroll(amber, motion, {
  source: 'position',
  end: state => {
    // Inference retains Amber's full state, not only the minimal motion interface.
    const axis: 'vertical' | 'horizontal' | 'both' = state.orientation;
    void axis;
    return state.limit;
  },
  destroyAnimation: true,
});
binding.pause().play().update();
const plane = new Amber({ renderer: transform, orientation: 'both', infinite: { x: true } });
const nativeLoop = new Amber({ orientation: 'both', plugins: [infinite], infinite: true });
plane.scrollTo({ x: 100, y: 200 }, { offset: { x: 10 }, immediate: true });
plane.scrollTo({ x: 300 });
plane.on('scroll', state => { const x: number = state.positionVector.x; void x; });
bindScroll(nativeLoop, motion, { axis: 'x', source: 'progress' });
// @ts-expect-error vector coordinates must be numbers
plane.scrollTo({ x: '100' });
// @ts-expect-error a coordinate vector must contain an axis
plane.scrollTo({});
// @ts-expect-error infinite axes must be booleans
new Amber({ infinite: { x: 1 } });
// @ts-expect-error unsupported scroll axis
bindScroll(plane, motion, { axis: 'z' });
bindScroll(amber, motion);
const timeline: Timeline = new Timeline({ onComplete: value => value.pause() });
timeline.from(motionOptions).from(() => {}).play().pause().restart().destroy();
const scheduler = new Scheduler(window);
const raf = new FrameRunner((time: number, target: HTMLElement, count: number) => { target.textContent = String(time + count); }, { scheduler });
raf.run(child, 3).pause().stop();
scheduler.add(raf); scheduler.remove(raf); raf.destroy(); scheduler.destroy();
const tab: Tab = new Tab(document);
tab.add(hidden => { const value: boolean = hidden; void value; });
tab.destroy();
binding.destroy(); motion.destroy({ revert: false }); amber.destroy();

// @ts-expect-error unsupported renderer
new Amber({ renderer: 'canvas' });
// @ts-expect-error unknown event
amber.on('wheel', () => {});
// @ts-expect-error destroy callbacks receive no state
amber.on('destroy', (state: { position: number }) => {});
// @ts-expect-error section payload differs from scroll state
amber.on('scroll', (entry: SectionEntry) => {});
// @ts-expect-error missing targets
new Motion({ properties: { o: [0, 1] } });
// @ts-expect-error missing animation tracks
new Motion({ targets: child });
// @ts-expect-error SVG tracks are available from amber-motion/svg
new Motion({ targets: child, line: {} });
// @ts-expect-error numeric property endpoints only
new Motion({ targets: child, properties: { o: ['hidden', 'visible'] } });
// @ts-expect-error unknown easing
new Motion({ targets: child, properties: { o: [0, 1] }, easing: 'unknown' });
// @ts-expect-error rev is a boolean
motion.play({ rev: 1 });
// @ts-expect-error resume was removed
motion.resume();
// @ts-expect-error resetAll takes animations, not DOM elements
resetAll([child]);
// @ts-expect-error resetAll requires an explicit scope
resetAll();
// @ts-expect-error pixel sources require end
bindScroll(amber, motion, { source: 'position' });
// @ts-expect-error source is restricted to supported values
bindScroll(amber, motion, { source: 'target', end: 100 });
// @ts-expect-error runner arguments retain their types
raf.run(child, 'three');
svg.destroy();
