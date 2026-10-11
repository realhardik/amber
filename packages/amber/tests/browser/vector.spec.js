import { test, expect } from '@playwright/test';

async function setup(page, options = {}) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.amber);
  await page.evaluate(options => {
    amber.destroy();
    const viewport = document.querySelector('#viewport'), content = document.querySelector('#content');
    viewport.style.cssText = 'position:relative;width:240px;height:180px;overflow:auto;border:0;';
    content.className = '';
    content.style.cssText = 'display:grid;grid-template-columns:repeat(3,400px);grid-auto-rows:300px;width:1200px;height:900px;position:relative;';
    content.replaceChildren(...Array.from({ length: 9 }, (_, i) => {
      const tile = document.createElement('div'); tile.id = `tile${i}`;
      tile.style.cssText = `width:400px;height:300px;background:hsl(${i * 40} 65% 60%);`;
      tile.textContent = String(i); return tile;
    }));
    viewport.scrollTo(0, 0);
    window.amber = new Amber({ wrapper: viewport, content, plugins: amberPlugins,
      orientation: 'both', autoRaf: false, ...options, renderer: options.renderer === 'transform' ? transform : 'native' });
  }, options);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const renderer of ['native', 'transform']) {
  test(`${renderer}: a managed 2D parent yields to a nested 2D child, then receives its edge handoff`, async ({ page }) => {
    await setup(page, { renderer, managedWheel: true });
    const result = await page.evaluate(renderer => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:absolute;left:20px;top:20px;width:120px;height:90px;overflow:hidden;z-index:1';
      const content = document.createElement('div');
      content.style.cssText = 'width:360px;height:270px';
      wrapper.append(content);
      document.querySelector('#tile0').append(wrapper);
      const child = new Amber({
        wrapper,
        content,
        renderer: renderer === 'transform' ? transform : 'native',
        orientation: 'both',
        plugins: amberPlugins,
        scrollChain: true,
        autoRaf: false,
      });
      const wheel = () => {
        const event = new WheelEvent('wheel', { deltaX: 80, deltaY: 60, bubbles: true, cancelable: true });
        wrapper.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const childOwned = wheel();
      const inside = { parent: amber.targetVector, child: child.targetVector };
      child.scrollTo({ x: child.limitVector.x, y: 0 }, { immediate: true });
      const mixedOwned = wheel();
      const mixed = { parent: amber.targetVector, child: child.targetVector, limit: child.limitVector };
      child.scrollTo('end', { immediate: true });
      amber.scrollTo({ x: 100, y: 100 }, { immediate: true });
      const parentOwned = wheel();
      const handoff = { parent: amber.targetVector, child: child.targetVector, childLimit: child.limitVector };
      child.destroy();
      return { childOwned, inside, mixedOwned, mixed, parentOwned, handoff };
    }, renderer);
    expect(result.childOwned).toBe(true);
    expect(result.inside.parent).toEqual({ x: 0, y: 0 });
    expect(result.inside.child.x).toBeGreaterThan(0);
    expect(result.inside.child.y).toBeGreaterThan(0);
    expect(result.mixedOwned).toBe(true);
    expect(result.mixed.parent).toEqual({ x: 0, y: 0 });
    expect(result.mixed.child.x).toBe(result.mixed.limit.x);
    expect(result.mixed.child.y).toBeGreaterThan(0);
    expect(result.parentOwned).toBe(true);
    expect(result.handoff.parent.x).toBeGreaterThan(100);
    expect(result.handoff.parent.y).toBeGreaterThan(100);
    expect(result.handoff.child).toEqual(result.handoff.childLimit);
  });

  test(`${renderer}: managed wheel capture owns edge gestures before native scrolling can take over`, async ({ page }) => {
    await setup(page, { renderer, managedWheel: true });
    const result = await page.evaluate(() => {
      const viewport = document.querySelector('#viewport');
      const edge = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
      viewport.dispatchEvent(edge);
      const horizontal = new WheelEvent('wheel', { deltaY: 180, shiftKey: true, bubbles: true, cancelable: true });
      viewport.dispatchEvent(horizontal);
      return { edgePrevented: edge.defaultPrevented, horizontalPrevented: horizontal.defaultPrevented,
        position: amber.positionVector, target: amber.targetVector };
    });
    expect(result.edgePrevented && result.horizontalPrevented).toBe(true);
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.target.x).toBeCloseTo(90);
    expect(result.target.y).toBe(0);
  });

  test(`${renderer}: real browser wheel input becomes diagonal before vertical settling ends`, async ({ page }) => {
    await setup(page, { renderer, autoRaf: true });
    const box = await page.locator('#viewport').boundingBox();
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.wheel(0, 240);
    await expect.poll(() => page.evaluate(() => amber.positionVector.y)).toBeGreaterThan(0);
    const vertical = await page.evaluate(() => ({ position: amber.positionVector, target: amber.targetVector }));
    await page.mouse.wheel(180, 0);
    const joined = await page.evaluate(() => ({ position: amber.positionVector, target: amber.targetVector, scrolling: amber.isScrolling }));
    expect(vertical.position.y).toBeLessThan(vertical.target.y);
    expect(joined.target.x).toBeGreaterThan(joined.position.x);
    expect(joined.target.y).toBe(vertical.target.y);
    expect(joined.scrolling).toBe(true);
    await expect.poll(() => page.evaluate(() => amber.positionVector.x)).toBeGreaterThan(0);
  });

  test(`${renderer}: a new horizontal gesture joins active vertical inertia immediately`, async ({ page }) => {
    await setup(page, { renderer });
    const result = await page.evaluate(() => {
      const viewport = document.querySelector('#viewport');
      const vertical = new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true });
      viewport.dispatchEvent(vertical);
      amber.raf(0);
      const before = { position: amber.positionVector, target: amber.targetVector };
      const horizontal = new WheelEvent('wheel', { deltaX: 180, bubbles: true, cancelable: true });
      viewport.dispatchEvent(horizontal);
      const joined = { position: amber.positionVector, target: amber.targetVector, prevented: horizontal.defaultPrevented };
      amber.raf(1000 / 60);
      const next = amber.positionVector;
      return { before, joined, next };
    });
    expect(result.before.target.y).toBeGreaterThan(result.before.position.y);
    expect(result.joined.target.x).toBeGreaterThan(result.joined.position.x);
    expect(result.joined.target.y).toBe(result.before.target.y);
    expect(result.joined.prevented).toBe(true);
    expect(result.next.x).toBeGreaterThan(result.joined.position.x);
    expect(result.next.y).toBeGreaterThan(result.joined.position.y);
  });

  test(`${renderer}: initializing a looping plane preserves the existing browser position`, async ({ page }) => {
    await setup(page, { renderer });
    const result = await page.evaluate(renderer => {
      amber.destroy();
      const viewport = document.querySelector('#viewport'), content = document.querySelector('#content');
      viewport.scrollTo({ left: 125, top: 225, behavior: 'instant' });
      const before = document.querySelector('#tile4').getBoundingClientRect();
      const instance = new Amber({ wrapper: viewport, content, plugins: amberPlugins, infinite: true,
        orientation: 'both', autoRaf: false, renderer: renderer === 'transform' ? transform : 'native' });
      const after = document.querySelector('#tile4').getBoundingClientRect();
      const position = instance.positionVector;
      instance.destroy(); return { position, dx: after.left - before.left, dy: after.top - before.top };
    }, renderer);
    expect(result.position).toEqual({ x: 125, y: 225 });
    expect(result.dx).toBeCloseTo(0, 3); expect(result.dy).toBeCloseTo(0, 3);
  });

  test(`${renderer}: diagonal input preserves both axes and renders actual DOM displacement`, async ({ page }) => {
    await setup(page, { renderer });
    const value = await page.evaluate(() => {
      const tile = document.querySelector('#tile0'), before = tile.getBoundingClientRect();
      const event = new WheelEvent('wheel', { deltaX: 100, deltaY: 200, bubbles: true, cancelable: true });
      document.querySelector('#viewport').dispatchEvent(event);
      const target = amber.targetVector;
      for (let i = 0; i < 300; i++) amber.raf(i * 1000 / 60);
      const after = tile.getBoundingClientRect();
      return { target, position: amber.positionVector, dx: before.left - after.left, dy: before.top - after.top,
        prevented: event.defaultPrevented, stopped: !amber.isScrolling };
    });
    expect(value.target.x).toBeCloseTo(50); expect(value.target.y).toBeCloseTo(100);
    expect(value.position).toEqual(value.target);
    expect(Math.abs(value.dx - 50)).toBeLessThan(1); expect(Math.abs(value.dy - 100)).toBeLessThan(1);
    expect(value.prevented && value.stopped).toBe(true);
  });

  test(`${renderer}: partial coordinates, offsets, element navigation and shrink clamp independently`, async ({ page }) => {
    await setup(page, { renderer });
    const result = await page.evaluate(() => {
      amber.scrollTo({ x: 100, y: 200 }, { immediate: true });
      const snapshot = amber.state;
      amber.scrollTo({ x: 250 }, { immediate: true, offset: { x: -10 } });
      const partial = amber.positionVector;
      amber.scrollTo('#tile4', { immediate: true }); const destination = amber.positionVector;
      let invalid = 0;
      for (const target of [{ x: NaN }, { x: 1, y: Infinity }, {}, { z: 1 }]) {
        try { amber.scrollTo(target); } catch { invalid++; }
      }
      const content = document.querySelector('#content'); content.replaceChildren();
      content.style.width = '100px'; content.style.height = '100px'; amber.resize();
      return { partial, destination, snapshot: snapshot.positionVector, frozen: Object.isFrozen(snapshot.positionVector), invalid,
        position: amber.positionVector, limits: amber.limitVector };
    });
    expect(result.partial).toEqual({ x: 240, y: 200 });
    expect(result.destination).toEqual({ x: 400, y: 300 });
    expect(result.snapshot).toEqual({ x: 100, y: 200 }); expect(result.frozen).toBe(true); expect(result.invalid).toBe(4);
    expect(result.position).toEqual({ x: 0, y: 0 }); expect(result.limits).toEqual({ x: 0, y: 0 });
  });

  test(`${renderer}: keyboard, diagonal touch and stop/start use the same vector state`, async ({ page }) => {
    await setup(page, { renderer });
    const result = await page.evaluate(() => {
      const viewport = document.querySelector('#viewport');
      viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      const keys = amber.targetVector; amber.scrollTo({ x: 0, y: 0 }, { immediate: true });
      const touch = (type, x, y) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        const point = { identifier: 1, clientX: x, clientY: y };
        Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
        viewport.dispatchEvent(event);
      };
      touch('touchstart', 200, 200); touch('touchmove', 180, 170);
      const drag = amber.targetVector; touch('touchend', 180, 170); const release = amber.targetVector;
      amber.stop(); const stopped = amber.targetVector;
      viewport.dispatchEvent(new WheelEvent('wheel', { deltaX: 50, deltaY: 50, bubbles: true, cancelable: true }));
      const ignored = amber.targetVector; amber.start();
      viewport.dispatchEvent(new WheelEvent('wheel', { deltaX: 50, deltaY: 50, bubbles: true, cancelable: true }));
      return { keys, drag, release, stopped, ignored, started: amber.targetVector };
    });
    expect(result.keys).toEqual({ x: 100, y: 100 }); expect(result.drag).toEqual({ x: 50, y: 75 });
    expect(result.release.x).toBeGreaterThan(result.drag.x); expect(result.release.y).toBeGreaterThan(result.drag.y);
    expect(result.ignored).toEqual(result.stopped); expect(result.started.x).toBeGreaterThan(result.stopped.x);
  });

  test(`${renderer}: two-dimensional infinite seams remain covered and preserve original nodes`, async ({ page }) => {
    await setup(page, { renderer, infinite: true });
    const result = await page.evaluate(() => {
      const nodes = [...document.querySelector('#content').children], gaps = [];
      for (const x of [-20, 1180, 1200, 1220, 12000020]) for (const y of [-20, 880, 900, 920]) {
        amber.scrollTo({ x, y }, { immediate: true });
        const bounds = amber.driver.bounds;
        const rects = nodes.map(el => el.getBoundingClientRect());
        for (let dx = 5; dx < 235; dx += 25) for (let dy = 5; dy < 175; dy += 25) {
          if (!rects.some(r => r.left <= bounds.left + dx && r.right > bounds.left + dx && r.top <= bounds.top + dy && r.bottom > bounds.top + dy)) gaps.push({ x, y, dx, dy });
        }
      }
      const physical = { x: amber.driver.element.scrollLeft, y: amber.driver.element.scrollTop };
      return { gaps, same: nodes.every((el, i) => el === document.querySelector('#content').children[i]),
        position: amber.positionVector, active: amber.infiniteAxes, physical };
    });
    expect(result.gaps).toEqual([]); expect(result.same).toBe(true); expect(result.active).toEqual({ x: true, y: true });
    // Firefox DOMRect subtraction can differ by ~0.000015px; preserve real subpixels.
    expect(result.position.x).toBeCloseTo(20, 4); expect(result.position.y).toBeCloseTo(20, 4);
    if (renderer === 'native') { expect(result.physical.x).toBeGreaterThan(0); expect(result.physical.y).toBeGreaterThan(0); }
  });

  test(`${renderer}: infinite X can coexist with bounded Y, including live resize`, async ({ page }) => {
    await setup(page, { renderer, infinite: { x: true, y: false } });
    const result = await page.evaluate(() => {
      amber.scrollTo({ x: -10, y: 100000 }, { immediate: true });
      const before = amber.state;
      amber.resize(); amber.resize();
      return { before, after: amber.state };
    });
    expect(result.before.positionVector.x).toBe(1190);
    expect(result.before.positionVector.y).toBe(result.before.limitVector.y);
    for (const axis of ['x', 'y']) {
      expect(result.after.positionVector[axis]).toBeCloseTo(result.before.positionVector[axis], 4);
      expect(result.after.limitVector[axis]).toBeCloseTo(result.before.limitVector[axis], 4);
    }
  });
}

test('native remains the default; real scrollbar scrolling synchronizes both components', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => document.querySelector('#viewport').scrollTo({ left: 120, top: 210 }));
  await expect.poll(() => page.evaluate(() => amber.positionVector)).toEqual({ x: 120, y: 210 });
  expect(await page.evaluate(() => amber.options.renderer)).toBe('native');
});

test('transform plane preserves avoided elements and restores authored transforms after resize and destroy', async ({ page }) => {
  await setup(page, { renderer: 'transform' });
  const result = await page.evaluate(() => {
    amber.destroy();
    const viewport = document.querySelector('#viewport'), content = document.querySelector('#content');
    const tile = document.querySelector('#tile0'); tile.style.transform = 'scale(0.9)';
    const overlay = document.createElement('div'); overlay.setAttribute('data-amber-avoid', '');
    overlay.style.cssText = 'position:absolute;left:12px;top:15px;width:10px;height:10px;transform:rotate(10deg)';
    content.append(overlay);
    const original = overlay.getBoundingClientRect();
    const instance = new Amber({ wrapper: viewport, content, renderer: transform, orientation: 'both', autoRaf: false });
    instance.scrollTo({ x: 100, y: 200 }, { immediate: true });
    instance.resize();
    const after = overlay.getBoundingClientRect(), authored = tile.style.transform.includes('0.9');
    const newTile = document.createElement('div'); newTile.style.cssText = 'width:400px;height:300px';
    content.append(newTile); instance.resize();
    const inserted = instance.driver.tiles.some(record => record.element === newTile);
    newTile.remove(); instance.resize();
    const removed = !instance.driver.tiles.some(record => record.element === newTile);
    instance.destroy();
    return { dx: after.left - original.left, dy: after.top - original.top, authored, inserted, removed,
      tileTransform: tile.style.transform, overlayTransform: overlay.style.transform };
  });
  expect(result.dx).toBe(0); expect(result.dy).toBe(0);
  expect(result.authored && result.inserted && result.removed).toBe(true);
  expect(result.tileTransform).toBe('scale(0.9)'); expect(result.overlayTransform).toBe('rotate(10deg)');
});

test('native infinite keeps visible content continuous during real wheel-driven seam crossing', async ({ page }) => {
  await setup(page, { infinite: true, autoRaf: true });
  await page.evaluate(() => amber.scrollTo({ x: 1190, y: 890 }, { immediate: true }));
  const bounds = await page.locator('#viewport').boundingBox();
  await page.mouse.move(bounds.x + 80, bounds.y + 80);
  await page.mouse.wheel(80, 100);
  await expect.poll(() => page.evaluate(() => amber.isScrolling)).toBe(false);
  const result = await page.evaluate(() => ({ position: amber.positionVector,
    physical: { x: amber.driver.element.scrollLeft, y: amber.driver.element.scrollTop }, target: amber.targetVector }));
  expect(result.position.x).toBeGreaterThan(0); expect(result.position.x).toBeLessThan(100);
  expect(result.position.y).toBeGreaterThan(0); expect(result.position.y).toBeLessThan(100);
  expect(result.position).toEqual(result.target); expect(result.physical.x).toBeGreaterThan(1200);
});

test('vertical section progress drives a horizontal child with no second smoothing lag', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(() => {
    amber.destroy();
    const viewport = document.querySelector('#viewport'), content = document.querySelector('#content');
    const parent = new Amber({ wrapper: viewport, content, orientation: 'vertical', autoRaf: false });
    const track = document.createElement('div'), strip = document.createElement('div');
    track.style.cssText = 'width:100px;height:50px;overflow:auto'; strip.style.cssText = 'width:600px;height:50px';
    track.append(strip); document.querySelector('#tile0').append(track);
    const child = new Amber({ wrapper: track, content: strip, orientation: 'horizontal', autoRaf: false });
    const disconnect = parent.on('scroll', state => child.scrollTo({ x: Math.max(0, Math.min(1, (state.positionVector.y - 100) / 300)) * child.limitVector.x }, { immediate: true }));
    parent.scrollTo({ y: 250 }, { immediate: true });
    const forward = track.scrollLeft;
    parent.scrollTo({ y: 100 }, { immediate: true }); const backward = track.scrollLeft;
    disconnect(); child.destroy(); parent.destroy();
    return { forward, backward };
  });
  expect(result).toEqual({ forward: 250, backward: 0 });
});

for (const orientation of ['vertical', 'horizontal']) {
  test(`native infinite ${orientation}: seam displacement, resize fallback and teardown`, async ({ page }) => {
    await page.goto('/'); await page.waitForFunction(() => !!window.amber);
    const result = await page.evaluate(orientation => {
      mount({ renderer: 'native', orientation, infinite: true, autoRaf: false });
      const content = document.querySelector('#content'), viewport = document.querySelector('#viewport');
      const originals = [...content.children], edge = orientation === 'horizontal' ? 'left' : 'top';
      amber.scrollTo(amber.loopLength - .5, { immediate: true });
      const before = originals[0].getBoundingClientRect()[edge];
      amber.scrollTo(amber.loopLength + .5, { immediate: true });
      const delta = before - originals[0].getBoundingClientRect()[edge];
      const length = amber.loopLength;
      for (let i = 0; i < 20; i++) amber.resize();
      const resized = amber.loopLength;
      const retained = originals.every((el, i) => el === content.children[i]);
      const removed = originals.slice(1); removed.forEach(el => el.remove()); amber.resize();
      const fallback = !amber.isInfinite;
      content.append(...removed); amber.resize(); const recovered = amber.isInfinite;
      amber.destroy();
      const clean = viewport.querySelector('[aria-hidden="true"][data-amber-avoid]') === null;
      const replacement = new Amber({ wrapper: viewport, content }); replacement.destroy();
      return { delta, length, resized, retained, fallback, recovered, clean };
    }, orientation);
    expect(result.delta).toBeCloseTo(1, 3); expect(result.resized).toBeCloseTo(result.length, 3);
    expect(result.retained && result.fallback && result.recovered && result.clean).toBe(true);
  });
}

test('native infinite responds to external browser scroll without seam feedback or drift', async ({ page }) => {
  await setup(page, { infinite: true });
  await page.evaluate(() => {
    amber.scrollTo({ x: 1190, y: 890 }, { immediate: true });
    document.querySelector('#viewport').scrollBy({ left: 30, top: 35, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => Math.round(amber.positionVector.x))).toBe(20);
  await expect.poll(() => page.evaluate(() => Math.round(amber.positionVector.y))).toBe(25);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => amber.isScrolling)).toBe(false);
});

for (const renderer of ['native', 'transform']) {
  test(`${renderer}: nested native input, two-dimensional visibility and reduced motion`, async ({ page }) => {
    await setup(page, { renderer, observeSections: { threshold: .01 } });
    const result = await page.evaluate(() => {
      const entered = [];
      amber.on('sectionenter', entry => entered.push(entry.target.id));
      const nested = document.createElement('div'); nested.style.cssText = 'width:100px;height:60px;overflow:auto';
      const inner = document.createElement('div'); inner.style.cssText = 'width:500px;height:500px'; nested.append(inner);
      document.querySelector('#tile0').append(nested);
      const event = new WheelEvent('wheel', { deltaX: 50, deltaY: 50, bubbles: true, cancelable: true }); nested.dispatchEvent(event);
      const prevented = event.defaultPrevented, target = amber.targetVector;
      amber.scrollTo({ x: 400, y: 300 }, { immediate: true });
      return { prevented, target, entered };
    });
    expect(result.prevented).toBe(false); expect(result.target).toEqual({ x: 0, y: 0 });
    expect(result.entered).toContain('tile4'); expect(result.entered).not.toContain('tile3'); expect(result.entered).not.toContain('tile5');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => page.evaluate(() => amber.reducedMotion)).toBe(true);
    const state = await page.evaluate(() => { amber.scrollTo({ x: 100, y: 200 }); return amber.state; });
    expect(state.isScrolling).toBe(false); expect(state.positionVector).toEqual({ x: 100, y: 200 });
  });

  test(`${renderer}: vector snapping aligns both axes and partial immediate seeks preserve other motion`, async ({ page }) => {
    await setup(page, { renderer, snap: 'mandatory' });
    const result = await page.evaluate(() => {
      amber.scrollTo({ x: 390, y: 290 }, { immediate: true });
      amber.snap.pending = true; amber.snap.settle();
      for (let i = 0; i < 300; i++) amber.raf(i * 1000 / 60);
      const snapped = amber.positionVector;
      amber.scrollTo({ x: 800, y: 600 }); amber.scrollTo({ y: 100 }, { immediate: true });
      const target = amber.targetVector;
      for (let i = 0; i < 300; i++) amber.raf(i * 1000 / 60);
      return { snapped, target, position: amber.positionVector };
    });
    expect(result.snapped).toEqual({ x: 400, y: 300 });
    expect(result.target).toEqual({ x: 800, y: 100 }); expect(result.position).toEqual(result.target);
  });
}

test('document-native infinite scrolling recycles a full-page track and restores the DOM', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.amber);
  const result = await page.evaluate(() => {
    amber.destroy(); document.body.replaceChildren(); document.body.style.cssText = 'margin:0';
    const content = document.createElement('main'); content.style.cssText = 'display:flex;flex-direction:column';
    for (let i = 0; i < 4; i++) { const el = document.createElement('div'); el.style.cssText = 'height:100vh;flex:none'; content.append(el); }
    document.body.append(content);
    const instance = new Amber({ wrapper: window, content, plugins: amberPlugins, infinite: true, autoRaf: false });
    instance.scrollTo(instance.loopLength - 10, { immediate: true });
    const lastBottom = content.lastElementChild.getBoundingClientRect().bottom;
    const firstTop = content.firstElementChild.getBoundingClientRect().top;
    const active = instance.isInfinite;
    instance.destroy();
    return { active, gap: firstTop - lastBottom, children: document.body.children.length };
  });
  expect(result.active).toBe(true); expect(result.gap).toBeCloseTo(0, 3); expect(result.children).toBe(1);
});

for (const renderer of ['native', 'transform']) {
  test(`${renderer}: Home/End respect a horizontal native child inside a 2D parent`, async ({ page }) => {
    await setup(page, { renderer });
    const results = await page.evaluate(() => {
      const child = document.createElement('div');
      child.style.cssText = 'width:100px;height:80px;overflow-x:auto;overflow-y:hidden';
      const inner = document.createElement('div');
      inner.style.cssText = 'width:500px;height:40px';
      child.append(inner); document.querySelector('#tile0').append(child);
      return ['Home', 'End'].map(key => {
        amber.scrollTo({ x: 100, y: 100 }, { immediate: true });
        child.scrollLeft = 200;
        const send = () => {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          child.dispatchEvent(event);
          return event.defaultPrevented;
        };
        const middle = send(), before = amber.targetVector;
        child.scrollLeft = key === 'Home' ? 0 : child.scrollWidth - child.clientWidth;
        child.style.overscrollBehaviorX = 'contain';
        const contained = send();
        child.style.overscrollBehaviorX = 'auto';
        const edge = send();
        return { key, middle, before, contained, edge, after: amber.targetVector, limit: amber.limitVector };
      });
    });
    for (const result of results) {
      expect(result.middle).toBe(false);
      expect(result.before).toEqual({ x: 100, y: 100 });
      expect(result.contained).toBe(false);
      expect(result.edge).toBe(true);
      expect(result.after).toEqual(result.key === 'Home' ? { x: 0, y: 0 } : result.limit);
    }
  });
}
