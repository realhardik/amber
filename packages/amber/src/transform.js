import { PanelRenderer } from './panel-renderer.js';
import { PlaneRenderer } from './plane-renderer.js';
import { rendererModule } from './modules.js';

function installNavigation(amber) {
  if (!amber.options.anchors) return;
  const inputRoot = amber.wrapper === amber.wrapper.window ? amber.document : amber.wrapper;
  const historyKey = amber.options.historyKey ?? (amber.driver.content?.id || amber.root.id || 'default');
  let ignoreHashChange = false;
  let historyResetTimer = null;

  const hashTarget = (hash = amber.window.location.hash) => {
    if (!hash || hash === '#') return 'start';
    let id;
    try { id = decodeURIComponent(hash.slice(1)); }
    catch { return null; }
    const element = amber.document.getElementById(id);
    return element && amber.root.contains(element) ? element : null;
  };
  const historyState = (position = amber.driver.isMultiAxis ? amber.positionVector : amber.position) => {
    const current = amber.window.history.state;
    const state = current && typeof current === 'object' ? current : {};
    const stored = state.__amberScroll && typeof state.__amberScroll === 'object' ? state.__amberScroll : {};
    return { ...state, __amberScroll: { ...stored, [historyKey]: position } };
  };
  const saveHistoryPosition = () => {
    try { amber.window.history.replaceState(historyState(), '', amber.window.location.href); }
    catch { /* History can be unavailable in restricted or opaque-origin documents. */ }
  };
  const resetNativeNavigation = () => {
    // Browsers may move the real scroll container before dispatching hashchange
    // or popstate. Transform mode owns the visible position, so discard that
    // native offset before resolving a virtual destination.
    amber.driver.resetNative();
    amber.captureExpected(amber.driver.readVector());
  };
  const handleAnchorClick = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || !amber.root.contains(anchor) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const current = amber.window.location;
    const href = anchor.getAttribute('href').trim();
    let url;
    // Fragment-only links target this route even when a framework sets <base>.
    try { url = href.startsWith('#') ? new URL(href, current.href) : new URL(anchor.href, amber.document.baseURI); }
    catch { return; }
    if (url.origin !== current.origin || url.pathname !== current.pathname || url.search !== current.search || !url.hash) return;
    const target = hashTarget(url.hash);
    if (!target) return;
    event.preventDefault();
    saveHistoryPosition();
    const position = target === 'start' ? (amber.driver.isMultiAxis ? { x: 0, y: 0 } : amber.boundary('start'))
      : amber.driver.isMultiAxis ? amber.driver.destinationVector(target) : amber.driver.destination(target);
    try { amber.window.history.pushState(historyState(position), '', url.href); }
    catch { amber.window.location.hash = url.hash; }
    amber.scrollTo(target);
  };
  const handleHistoryNavigation = event => {
    resetNativeNavigation();
    ignoreHashChange = true;
    if (historyResetTimer !== null) amber.window.clearTimeout(historyResetTimer);
    historyResetTimer = amber.window.setTimeout(() => {
      historyResetTimer = null;
      ignoreHashChange = false;
    }, 0);
    const position = event.state?.__amberScroll?.[historyKey];
    if (Number.isFinite(position) || position && Number.isFinite(position.x) && Number.isFinite(position.y)) amber.scrollTo(position, { immediate: true });
    else {
      const target = hashTarget();
      target && amber.scrollTo(target, { immediate: true });
    }
  };
  const handleHashChange = () => {
    if (ignoreHashChange) return;
    resetNativeNavigation();
    const target = hashTarget();
    target && amber.scrollTo(target, { immediate: true });
  };
  const offScrollend = amber.on('scrollend', saveHistoryPosition);
  amber.listen(inputRoot, 'click', handleAnchorClick);
  amber.listen(amber.window, 'popstate', handleHistoryNavigation);
  amber.listen(amber.window, 'hashchange', handleHashChange);
  amber.cleanups.push(() => {
    saveHistoryPosition();
    offScrollend();
    if (historyResetTimer !== null) amber.window.clearTimeout(historyResetTimer);
  });
  resetNativeNavigation();
  const target = amber.window.location.hash && hashTarget();
  if (target) amber.scrollTo(target, { immediate: true });
  else saveHistoryPosition();
}

export const transform = Object.freeze({
  [rendererModule]: true,
  name: 'transform',
  create(wrapper, content, options) {
    const driver = options.orientation === 'both'
      ? new PlaneRenderer(wrapper, content, options.orientation, options.infinite)
      : new PanelRenderer(wrapper, content, options.orientation, typeof options.infinite === 'object'
        ? !!options.infinite[options.orientation === 'horizontal' ? 'x' : 'y'] : options.infinite);
    driver.installNavigation = installNavigation;
    return driver;
  },
});

export default transform;
