import { finite, clamp } from './easing.js';
import { registerBinding } from './reset.js';

/** Maps Amber's smoothed public state onto an animation without a second RAF. */
export function bindScroll(amber, animation, options = {}) {
  if (!amber?.on || amber.isDestroyed) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'bindScroll needs a live Amber instance.' : "Amber M013");
  if (!animation?.seek || animation.destroyed) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'bindScroll needs a live animation.' : "Amber M014");
  const source = options.source ?? 'progress';
  const axis = options.axis;
  if (axis !== undefined && !['x', 'y'].includes(axis)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Scroll axis must be x or y.' : "Amber M015");
  if (!['progress', 'position', 'wrappedPosition', 'velocity'].includes(source)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Invalid scroll source.' : "Amber M016");
  const start = options.start ?? 0, end = options.end ?? (source === 'progress' ? 1 : undefined);
  if (end === undefined) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Provide end for pixel or velocity ranges.' : "Amber M017");
  const cleanups = [];
  let connected = true, paused = false;
  const window = animation.window;
  const media = options.respectReducedMotion !== false && animation.respectReducedMotion && window?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedProgress = finite(options.reducedMotionProgress ?? 1, 'Reduced motion progress');
  const update = (state = amber.state) => {
    if (!connected || paused || amber.isDestroyed || animation.destroyed) return;
    const a = finite(typeof start === 'function' ? start(state) : start, 'Scroll start');
    const b = finite(typeof end === 'function' ? end(state) : end, 'Scroll end');
    if (a === b) throw new RangeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Scroll start and end must differ.' : "Amber M018");
    const value = finite(axis === undefined ? state[source] : state[`${source}Vector`]?.[axis], `Scroll ${source}`);
    animation.seek(media?.matches ? reducedProgress : clamp((value - a) / (b - a)));
  };
  const binding = {
    update: () => update(),
    pause() { paused = true; return this; },
    play() { if (connected) { paused = false; update(); } return this; },
    destroy() {
      if (!connected) return;
      connected = false;
      for (const cleanup of cleanups) cleanup();
      if (options.destroyAnimation) animation.destroy();
    },
  };
  try {
    cleanups.push(registerBinding(animation, binding));
    cleanups.push(amber.on('scroll', update));
    // Amber resets velocity after the last scroll event, before scrollend.
    if (source === 'velocity') cleanups.push(amber.on('scrollend', update));
    cleanups.push(amber.on('resize', update));
    cleanups.push(amber.on('destroy', () => binding.destroy()));
    cleanups.push(animation.onDestroy(() => binding.destroy()));
    if (media) {
      const change = () => update();
      media.addEventListener('change', change);
      cleanups.push(() => media.removeEventListener('change', change));
    }
    update();
  } catch (error) { binding.destroy(); throw error; }
  return binding;
}
