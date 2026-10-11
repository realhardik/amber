// Instance-scoped descriptors: importing a module never changes global defaults.
export const rendererModule = Symbol('Amber renderer');
export const featureModule = Symbol('Amber feature');

export function resolvePlugins(plugins = []) {
  if (!Array.isArray(plugins)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: plugins must be an array of imported feature modules.' : "Amber A030");
  const unique = new Map();
  for (const plugin of plugins) {
    if (!plugin?.[featureModule] || typeof plugin.install !== 'function') {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: plugins must contain imported Amber feature modules.' : "Amber A031");
    }
    if (unique.has(plugin.name) && unique.get(plugin.name) !== plugin) {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? `Amber: conflicting '${plugin.name}' modules.` : "Amber A032");
    }
    unique.set(plugin.name, plugin);
  }
  // Parallax geometry must be available to pinning, regardless of input order.
  return Object.freeze([...unique.values()].sort((a, b) => a.order - b.order));
}

// Internal lifecycle hooks run in installation order. Every hook runs even if
// an earlier hook handles the event (e.g. starts a settling animation).
export function runHooks(amber, name, ...args) {
  let handled = false;
  for (const hooks of amber.hooks ?? []) handled = !!hooks[name]?.(...args) || handled;
  return handled;
}

export function addHooks(amber, hooks) {
  (amber.hooks ??= []).push(hooks);
}
