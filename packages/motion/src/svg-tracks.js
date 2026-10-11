import { clamp, finite } from './easing.js';
import { createCssTrackSet, finishTracks, styleWriter } from './tracks.js';

const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function tokenize(value, points) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'SVG endpoints must be nonempty strings.' : "Amber M019");
  const tokens = value.match(/[a-df-z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
  if (value.replace(/[a-df-z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi, '').replace(/[\s,]/g, '')) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Invalid SVG syntax.' : "Amber M020");
  const parsed = tokens.map(t => /^[a-z]$/i.test(t) ? t : finite(Number(t), 'SVG coordinate'));
  if (points) {
    if (parsed.length < points * 2 || parsed.length % 2 || parsed.some(t => typeof t !== 'number')) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `SVG shape needs at least ${points} coordinate pairs.` : "Amber M021");
    return { tokens: parsed, flags: [] };
  }
  if (!/^[mM]$/.test(parsed[0])) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'SVG path must start with moveto.' : "Amber M022");
  const flags = [];
  for (let i = 0; i < parsed.length;) {
    const command = parsed[i++], size = arity[String(command).toUpperCase()];
    if (size === undefined) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Invalid SVG command.' : "Amber M023");
    const start = i;
    while (i < parsed.length && typeof parsed[i] === 'number') i++;
    const count = i - start;
    if (size ? !count || count % size : count) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Invalid SVG command coordinate count.' : "Amber M024");
    if (String(command).toUpperCase() === 'A') for (let j = start; j < i; j += 7) {
      if (parsed[j] < 0 || parsed[j + 1] < 0 || ![0, 1].includes(parsed[j + 3]) || ![0, 1].includes(parsed[j + 4])) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Invalid SVG arc.' : "Amber M025");
      flags.push(j + 3, j + 4);
    }
  }
  return { tokens: parsed, flags };
}

export function morphInterpolator(from, to, polygon = false) {
  return interpolate(from, to, polygon ? 3 : 0);
}

function interpolate(from, to, points) {
  const a = tokenize(from, points), b = tokenize(to, points);
  if (a.tokens.length !== b.tokens.length || a.tokens.some((v, i) => typeof v !== typeof b.tokens[i] || typeof v === 'string' && v !== b.tokens[i]) || a.flags.some(i => a.tokens[i] !== b.tokens[i])) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'SVG morph needs matching commands, coordinate counts, and arc flags. Normalize shapes first.' : "Amber M026");
  return t => t === 0 ? from : t === 1 ? to : a.tokens.map((v, i) => typeof v === 'string' ? v : +(v + (b.tokens[i] - v) * t).toFixed(5)).join(' ');
}

export function createSvgTracks(element, options, index = 0) {
  const trackSet = createCssTrackSet(element, options), { tracks, restores } = trackSet;
  const morph = options.morph ?? options.m;
  if (morph) {
    if (!['path', 'polygon', 'polyline'].includes(morph.type ?? 'path')) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Unsupported SVG morph type.' : "Amber M027");
    const polygon = morph.type === 'polygon' || morph.type === 'polyline', attr = polygon ? 'points' : 'd';
    const original = element.getAttribute(attr), endpoint = value => Array.isArray(value) ? value[index] : value;
    const morphValue = interpolate(endpoint(morph.start) ?? original, endpoint(morph.end), polygon ? morph.type === 'polyline' ? 2 : 3 : 0);
    let last;
    tracks.push(t => { const value = morphValue(t); if (value !== last) { element.setAttribute(attr, value); last = value; } });
    restores.push(() => original === null ? element.removeAttribute(attr) : element.setAttribute(attr, original));
  }
  const line = options.line ?? options.l;
  if (line) {
    if (typeof element.getTotalLength !== 'function') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Line drawing needs SVG geometry.' : "Amber M028");
    const measured = finite(element.getTotalLength(), 'SVG length', 0), normalized = Number(element.getAttribute('pathLength'));
    const length = measured && Number.isFinite(normalized) && normalized > 0 ? normalized : measured;
    const start = finite(line.start ?? 0, 'Line start'), end = finite(line.end ?? 100, 'Line end');
    let dash = String(length), fullDash = 'none', hidden = false;
    if (line.dashed !== undefined) {
      const pattern = String(line.dashed).trim(), parts = pattern.split(/[\s,]+/).map(Number);
      if (!pattern || parts.some(v => !Number.isFinite(v) || v < 0) || parts.every(v => v === 0)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Dash pattern must contain nonnegative lengths with a positive sum.' : "Amber M029");
      const segments = [];
      // Clip once to the path boundary; whole cycles can expose an unwanted tail.
      for (let remaining = length, i = 0; remaining > 0; i++) {
        if (i === 100000) throw new RangeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Dash pattern is too fine for this path.' : "Amber M030");
        const value = Math.min(parts[i % parts.length], remaining);
        segments.push(value);
        remaining -= value;
      }
      if (segments.length % 2) segments.push(length);
      else if (segments.length) segments[segments.length - 1] += length;
      dash = segments.join(' ') || 'none';
      fullDash = parts.join(' ');
    }
    const array = styleWriter(element, 'stroke-dasharray'), offset = styleWriter(element, 'stroke-dashoffset'), opacity = styleWriter(element, 'stroke-opacity');
    restores.push(() => array.restore(), () => offset.restore(), () => opacity.restore());
    tracks.push(t => {
      const progress = length ? clamp((start + (end - start) * t) / 100) : 0;
      array.set(progress === 1 ? fullDash : dash);
      offset.set((1 - progress) * length);
      // Zero-length dashes can still paint round/square caps. Hide only the stroke.
      if (hidden !== (progress === 0)) {
        hidden = progress === 0;
        if (hidden) opacity.set(0); else opacity.restore();
      }
    });
  }
  if (!tracks.length) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Animation needs properties, morph, or line options.' : "Amber M031");
  return finishTracks(trackSet);
}
