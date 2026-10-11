import { finite } from './easing.js';

const transformNames = ['translateX', 'translateY', 'translateZ', 'rotate', 'scale',
  'rotateX', 'rotateY', 'rotateZ', 'scaleX', 'scaleY', 'scaleZ', 'skewX', 'skewY'];

function interpolation(from, to, prefix, suffix) {
  const distance = to - from;
  return t => `${prefix}${from + distance * t}${suffix}`;
}

export function styleWriter(element, property) {
  const original = element.style.getPropertyValue(property);
  const priority = element.style.getPropertyPriority(property);
  let last;
  return {
    set(value) {
      value = String(value);
      if (value !== last) { element.style.setProperty(property, value); last = value; }
    },
    restore() {
      if (original) element.style.setProperty(property, original, priority);
      else element.style.removeProperty(property);
      last = undefined;
    },
  };
}

export function createCssTrackSet(element, options) {
  const tracks = [], restores = [];
  const writer = (property, value) => {
    const result = styleWriter(element, property);
    restores.push(() => result.restore());
    tracks.push(t => result.set(value(t)));
  };
  const props = options.properties ?? options.t;
  if (props) {
    const transforms = [];
    for (const [key, raw] of Object.entries(props)) {
      const spec = Array.isArray(raw) ? { v: raw } : raw;
      if (!spec || !Array.isArray(spec.v) || spec.v.length < 2) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Property ${key} needs v: [from, to].` : "Amber M032");
      const from = finite(spec.v[0], `${key} start`), to = finite(spec.v[1], `${key} end`);
      const unit = spec.unit ?? spec.v[2] ?? (['x', 'y', 'c'].includes(key) ? '%' : key === 'z' ? 'px' : key === 'r' ? 'deg' : '');
      if (typeof unit !== 'string') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Property unit must be a string.' : "Amber M033");
      const transformIndex = ['x', 'y', 'z', 'r', 's'].indexOf(key);
      if (transformIndex >= 0) {
        const name = spec.name ?? transformNames[transformIndex];
        if (!transformNames.includes(name)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Unsupported transform function.' : "Amber M034");
        transforms.push(interpolation(from, to, `${name}(`, `${unit})`));
      } else {
        const name = spec.name ?? key;
        const property = key === 'o' ? 'opacity' : key === 'c' ? 'clip-path' : name.startsWith('--') ? name : name.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        writer(property, interpolation(from, to, key === 'c' ? 'inset(' : '', key === 'c' ? `${unit} 0% 0% 0%)` : unit));
      }
    }
    if (transforms.length) {
      writer('transform', t => {
        let value = '';
        for (const transform of transforms) value += (value ? ' ' : '') + transform(t);
        return value;
      });
    }
  }
  return { tracks, restores };
}

export function finishTracks({ tracks, restores }) {
  return { render: t => { for (const track of tracks) track(t); }, restore: () => { for (const restore of restores) restore(); } };
}

export function createTracks(element, options) {
  const trackSet = createCssTrackSet(element, options);
  if (!trackSet.tracks.length) {
    if (options.morph ?? options.m ?? options.line ?? options.l) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'SVG morph and line tracks require the amber-motion/svg entry.' : "Amber M035");
    throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Animation needs properties.' : "Amber M036");
  }
  return finishTracks(trackSet);
}
