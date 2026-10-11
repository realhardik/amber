import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.amber);
});

async function settle(page) {
  await page.waitForTimeout(200);
  await page.evaluate(() => { for (let i = 0; i < 300; i++) amber.raf(i * 1000 / 60); });
}

for (const orientation of ['vertical', 'horizontal']) {
  test(`${orientation}: proximity snaps nearby edges and leaves distant positions alone`, async ({ page }) => {
    await page.evaluate(orientation => mount({ orientation, snap: 'proximity', autoRaf: false }), orientation);
    const edge = orientation === 'vertical' ? 420 : 560;
    await page.evaluate(edge => {
      amber.scrollTo(edge - 40, { immediate: true });
      document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
    }, edge);
    await settle(page);
    expect(await page.evaluate(() => amber.position)).toBe(edge);
    await page.evaluate(() => {
      amber.scrollTo(220, { immediate: true });
      document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
    });
    await settle(page);
    expect(await page.evaluate(() => amber.position)).toBeCloseTo(225);
  });

  test(`${orientation}: infinite panels cover both seam directions with bounded state`, async ({ page }) => {
    const errors = await page.evaluate(orientation => {
      mount({ orientation, infinite: true, autoRaf: false });
      const errors = [];
      const edge = orientation === 'vertical' ? 'top' : 'left';
      const end = orientation === 'vertical' ? 'bottom' : 'right';
      for (let step = -100; step < 100; step++) {
        amber.scrollTo(step * 101.25, { immediate: true });
        if (amber.position < 0 || amber.position >= amber.loopLength) errors.push('unbounded');
        const bounds = amber.driver.bounds;
        const spans = [...document.querySelector('#content').children].map(el => {
          const r = el.getBoundingClientRect();
          return [r[edge] - bounds[edge], r[end] - bounds[edge]];
        }).filter(([a,b]) => b > 0 && a < amber.driver.viewportSize).sort((a,b) => a[0]-b[0]);
        let covered = 0;
        for (const [a,b] of spans) { if (a > covered + 0.1) errors.push('gap'); covered = Math.max(covered,b); }
        if (covered < amber.driver.viewportSize - 0.1) errors.push('uncovered');
      }
      return errors;
    }, orientation);
    expect(errors).toEqual([]);
  });
}

test('avoid children stay stationary, retain styles and can rejoin dynamically', async ({ page }) => {
  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    const overlay = document.createElement('div');
    overlay.setAttribute('data-amber-avoid', '');
    overlay.style.cssText = 'position:absolute;top:10px;left:10px;transform:translateX(2px)';
    main.append(overlay);
    amber.resize();
    const before = overlay.getBoundingClientRect().top;
    const style = overlay.style.cssText;
    amber.scrollTo(600, { immediate: true });
    const after = overlay.getBoundingClientRect().top;
    const unchanged = style === overlay.style.cssText;
    amber.destroy();
    const restored = style === overlay.style.cssText;
    const instance = new Amber({ renderer: transform, plugins: amberPlugins, snap: 'proximity' });
    overlay.removeAttribute('data-amber-avoid');
    instance.resize();
    instance.scrollTo(100, { immediate: true });
    const joined = overlay.getBoundingClientRect().top;
    instance.destroy();
    return { before, after, unchanged, restored, joined };
  });
  expect(result.after).toBe(result.before);
  expect(result.unchanged && result.restored).toBe(true);
  expect(result.joined).toBeCloseTo(result.before - 100);
});

test('programmatic navigation and stop cancel pending proximity snapping', async ({ page }) => {
  await page.evaluate(() => {
    mount({ snap: 'proximity', autoRaf: false });
    amber.scrollTo(390, { immediate: true });
    document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
    amber.scrollTo(385, { immediate: true });
  });
  await settle(page);
  expect(await page.evaluate(() => amber.position)).toBe(385);
  await page.evaluate(() => {
    document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
    amber.stop();
  });
  await settle(page);
  expect(await page.evaluate(() => amber.position)).toBe(385);
});

test('new wheel input interrupts an active snap from the current position', async ({ page }) => {
  const result = await page.evaluate(() => {
    mount({ snap: 'proximity', autoRaf: false });
    amber.scrollTo(390, { immediate: true });
    amber.snap.pending = true;
    amber.snap.settle();
    amber.raf(0);
    const position = amber.position;
    document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', { deltaY: -10, bubbles: true, cancelable: true }));
    return { position, target: amber.target };
  });
  expect(result.target).toBeCloseTo(result.position - 5);
});

test('infinite proximity snaps across the seam, and destroy clears its timer', async ({ page }) => {
  await page.evaluate(() => {
    mount({ snap: 'proximity', infinite: true, autoRaf: false });
    amber.scrollTo(amber.loopLength - 30, { immediate: true });
    document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
  });
  await settle(page);
  expect(await page.evaluate(() => amber.position)).toBe(0);
  expect(await page.evaluate(() => {
    document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
    amber.destroy();
    return amber.snap.timer;
  })).toBe(null);
});


for (const orientation of ['vertical', 'horizontal']) {
  test(`${orientation}: configurable snap radius includes boundary and supports zero`, async ({ page }) => {
    const results = await page.evaluate(orientation => {
      return [[50, 50], [50, 51], [100, 80], [0, 1]].map(([snapDistance, gap]) => {
        mount({ orientation, snap: 'proximity', snapDistance, autoRaf: false });
        const edge = orientation === 'vertical' ? 420 : 560;
        amber.scrollTo(edge - gap, { immediate: true });
        amber.snap.pending = true;
        amber.snap.settle();
        for (let i = 0; i < 300; i++) amber.raf(i * 1000 / 60);
        return edge - amber.position;
      });
    }, orientation);
    expect(results).toEqual([0, 51, 0, 1]);
  });
}
