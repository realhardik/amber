// Weak keys avoid retaining animations; bindings unregister during cleanup.
const bindings = new WeakMap();

export function registerBinding(animation, binding) {
  let group = bindings.get(animation);
  if (!group) bindings.set(animation, group = new Set());
  group.add(binding);
  return () => {
    group.delete(binding);
    if (!group.size) bindings.delete(animation);
  };
}

export function pauseBindings(animation) {
  for (const binding of bindings.get(animation) ?? []) binding.pause();
}

/** Explicit scope only: no global list of animations and no automatic replay. */
export function resetAll(animations) {
  if (typeof animations?.[Symbol.iterator] !== 'function') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'resetAll needs an explicit iterable of animations.' : "Amber M006");
  const group = new Set(animations);
  for (const animation of group) {
    if (typeof animation?.reset !== 'function') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'resetAll expects animation instances.' : "Amber M007");
  }
  for (const animation of group) animation.reset();
}
