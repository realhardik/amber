import test from 'node:test';
import assert from 'node:assert/strict';
import { Amber } from '../../src/amber.js';
import { NativeRenderer, setupHideScrollbar } from '../../src/renderers.js';

test('hideScrollbar defaults to false and rejects non-boolean values', () => {
  assert.throws(() => new Amber({ hideScrollbar: 'yes' }), /hideScrollbar must be a boolean/);
  assert.throws(() => new Amber({ hideScrollbar: 1 }), /hideScrollbar must be a boolean/);
  assert.throws(() => new Amber({ hideScrollbar: null }), /hideScrollbar must be a boolean/);
});

test('setupHideScrollbar injects CSS covering html, body, and [data-amber-hide-scrollbar]', () => {
  const styles = [];
  const fakeDoc = {
    head: {
      appendChild(node) { styles.push(node); },
    },
    createElement(tag) {
      return {
        tag,
        attributes: {},
        textContent: '',
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() {
          const idx = styles.indexOf(this);
          if (idx !== -1) styles.splice(idx, 1);
        },
      };
    },
  };

  const cleanup = setupHideScrollbar(fakeDoc);
  assert.equal(styles.length, 1);
  const style = styles[0];
  assert.equal(style.attributes['data-amber-hide-scrollbar'], '');
  assert.match(style.textContent, /html,body,\[data-amber-hide-scrollbar\]/);
  assert.match(style.textContent, /scrollbar-width:none/);
  assert.match(style.textContent, /display:none/);

  // Calling cleanup removes the style element
  cleanup();
  assert.equal(styles.length, 0);
});

test('setupHideScrollbar is safe when document or head is missing', () => {
  assert.doesNotThrow(() => {
    const cleanup = setupHideScrollbar(null);
    cleanup();
  });
  assert.doesNotThrow(() => {
    const cleanup = setupHideScrollbar({});
    cleanup();
  });
});

test('NativeRenderer scopes hideScrollbar styles and cleans up on destroy', () => {
  const styles = [];
  const fakeDoc = {
    head: {
      appendChild(node) { styles.push(node); },
    },
    createElement(tag) {
      return {
        tag,
        attributes: {},
        textContent: '',
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() {
          const idx = styles.indexOf(this);
          if (idx !== -1) styles.splice(idx, 1);
        },
      };
    },
    scrollingElement: {
      style: {
        getPropertyValue() { return ''; },
        getPropertyPriority() { return ''; },
        setProperty() {},
        removeProperty() {},
      },
    },
    documentElement: { clientWidth: 1024, clientHeight: 768 },
  };

  const fakeWindow = {};
  fakeWindow.window = fakeWindow;
  fakeWindow.document = fakeDoc;
  fakeDoc.defaultView = fakeWindow;

  // 1. hideScrollbar: true on window -> injected
  const windowRenderer = new NativeRenderer(fakeWindow, null, 'vertical', { hideScrollbar: true });
  assert.equal(styles.length, 1);
  windowRenderer.destroy();
  assert.equal(styles.length, 0);

  // 2. hideScrollbar: false on window -> not injected
  const noHideRenderer = new NativeRenderer(fakeWindow, null, 'vertical', { hideScrollbar: false });
  assert.equal(styles.length, 0);
  noHideRenderer.destroy();

  // 3. Inner containers receive a rule that does not hide page scrollbars.
  const fakeElement = {
    ownerDocument: fakeDoc,
    style: {
      getPropertyValue() { return ''; },
      getPropertyPriority() { return ''; },
      setProperty() {},
      removeProperty() {},
    },
    clientWidth: 400,
    clientHeight: 300,
  };
  const innerRenderer = new NativeRenderer(fakeElement, null, 'vertical', { hideScrollbar: true });
  assert.equal(styles.length, 1);
  assert.match(styles[0].textContent, /\[data-amber-hide-scrollbar\]::-webkit-scrollbar/);
  assert.doesNotMatch(styles[0].textContent, /html|body/);
  innerRenderer.destroy();
  assert.equal(styles.length, 0);
});
