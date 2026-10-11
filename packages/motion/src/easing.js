export const easings = {
  lin: t => t,
  i1: t => 1 - Math.cos(t * Math.PI / 2),
  o1: t => Math.sin(t * Math.PI / 2),
  io1: t => -(Math.cos(Math.PI * t) - 1) / 2,
  i6: t => t === 0 ? 0 : 2 ** (10 * t - 10),
  o6: t => t === 1 ? 1 : 1 - 2 ** (-10 * t),
  io6: t => t === 0 || t === 1 ? t : t < .5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  oe: t => t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1,
  ob: t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
for (let n = 2; n <= 5; n++) {
  easings[`i${n}`] = t => t ** n;
  easings[`o${n}`] = t => 1 - (1 - t) ** n;
  easings[`io${n}`] = t => t < .5 ? 2 ** (n - 1) * t ** n : 1 - (-2 * t + 2) ** n / 2;
}
Object.freeze(easings);
export const clamp = t => Math.max(0, Math.min(1, t));
export function finite(value, name, min = -Infinity) {
  if (!Number.isFinite(value) || value < min) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `${name} must be finite and >= ${min}.` : "Amber M005");
  return value;
}
