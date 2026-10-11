import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/motion/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready);
});

for (const renderer of ['native', 'transform']) {
  for (const orientation of ['vertical', 'horizontal']) {
    test(`${renderer}/${orientation}: real Amber scroll seeks plugin and cleans up on destroy`, async ({ page }) => {
      const result = await page.evaluate(({ renderer, orientation }) => {
        if (orientation === 'horizontal') document.querySelector('main').style.flexDirection = 'row';
        const amber = createAmber({ renderer, orientation, wrapper: document.querySelector('#viewport'), content: document.querySelector('main'), autoRaf: false });
        const box = document.querySelector('#box');
        const a = new animation.Animation({ el: box, t: { x: { v: [0, 100], unit: 'px' }, o: [0, 1] } });
        const binding = animation.bindScroll(amber, a);
        amber.scrollTo(amber.limit / 2, { immediate: true });
        const middle = { opacity: getComputedStyle(box).opacity, transform: getComputedStyle(box).transform, progress: a.progress, running: a.raf.on };
        amber.scrollTo(amber.limit / 4, { immediate: true });
        const backwards = a.progress;
        amber.destroy(); binding.update();
        const detached = a.progress;
        a.destroy();
        return { middle, backwards, detached, restored: box.style.cssText };
      }, { renderer, orientation });
      expect(+result.middle.opacity).toBeCloseTo(.5);
      expect(result.middle.transform).toBe('matrix(1, 0, 0, 1, 50, 0)');
      expect(result.middle.running).toBe(false);
      expect(result.backwards).toBeCloseTo(.25);
      expect(result.detached).toBeCloseTo(.25);
      expect(result.restored).toBe('');
    });
  }
}

test('real requestAnimationFrame playback pauses, plays onward and reverses', async ({ page }) => {
  await page.evaluate(() => {
    window.a = new animation.Animation({ el: document.querySelector('#box'), t: { o: [0, 1] }, d: 400 });
    a.play();
  });
  await expect.poll(() => page.evaluate(() => a.progress)).toBeGreaterThan(.1);
  const paused = await page.evaluate(() => { a.pause(); return a.progress; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => a.progress)).toBe(paused);
  await page.evaluate(() => a.play());
  await expect.poll(() => page.evaluate(() => a.status)).toBe('finished');
  await page.evaluate(() => a.reverse());
  await expect.poll(() => page.evaluate(() => a.status)).toBe('finished');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#box')).opacity)).toBe('0');
});

for (const renderer of ['native', 'transform']) {
  test(`${renderer}: Motion binds independently to X and Y and wraps only the infinite axis`, async ({ page }) => {
    const result = await page.evaluate(renderer => {
      const viewport = document.querySelector('#viewport'), content = document.querySelector('main');
      viewport.style.cssText = 'width:200px;height:150px;overflow:auto';
      content.style.cssText = 'display:grid;grid-template-columns:repeat(3,300px);grid-auto-rows:250px;width:900px;height:750px';
      content.replaceChildren(...Array.from({ length: 9 }, () => {
        const tile = document.createElement('section'); tile.style.cssText = 'width:300px;height:250px';
        tile.append(document.createElement('span')); return tile;
      }));
      const amber = createAmber({ wrapper: viewport, content, renderer, orientation: 'both', infinite: { x: true }, autoRaf: false });
      const elements = content.querySelectorAll('span');
      const x = new animation.Animation({ el: elements[0], t: { o: [0, 1] } });
      const y = new animation.Animation({ el: elements[1], t: { o: [0, 1] } });
      animation.bindScroll(amber, x, { axis: 'x' }); animation.bindScroll(amber, y, { axis: 'y' });
      amber.scrollTo({ x: amber.loopLengthVector.x * 1.25, y: amber.limitVector.y * .75 }, { immediate: true });
      const first = { x: x.progress, y: y.progress, opacityX: getComputedStyle(elements[0]).opacity, opacityY: getComputedStyle(elements[1]).opacity };
      amber.scrollTo({ x: -amber.loopLengthVector.x * .25 }, { immediate: true });
      const reverse = { x: x.progress, y: y.progress };
      amber.destroy(); x.destroy(); y.destroy(); return { first, reverse };
    }, renderer);
    expect(result.first.x).toBeCloseTo(.25); expect(result.first.y).toBeCloseTo(.75);
    expect(+result.first.opacityX).toBeCloseTo(.25); expect(+result.first.opacityY).toBeCloseTo(.75);
    expect(result.reverse.x).toBeCloseTo(.75); expect(result.reverse.y).toBeCloseTo(.75);
  });
}

test('SVG morph, stroke draw, clip-path and rotation produce valid browser output', async ({ page }) => {
  const result = await page.evaluate(() => {
    const path = document.querySelector('#path');
    const a = new svgAnimation.Animation({ el: path, m: { end: 'M0 0 L80 20 L50 80 Z' }, l: { start: 0, end: 100 } });
    a.seek(.5);
    const box = document.querySelector('#box');
    const b = new animation.Animation({ el: box, t: { c: [100, 0], r: [0, 90], o: [0, 1] } });
    b.seek(.5);
    const values = { d: path.getAttribute('d'), length: path.getTotalLength(), dash: parseFloat(getComputedStyle(path).strokeDashoffset), clip: getComputedStyle(box).clipPath, opacity: getComputedStyle(box).opacity, transform: getComputedStyle(box).transform };
    a.destroy(); b.destroy();
    return { ...values, restored: path.getAttribute('d') };
  });
  expect(result.d).toBe('M 0 0 L 90 10 L 50 90 Z');
  expect(result.length).toBeGreaterThan(0);
  expect(result.dash).toBeGreaterThan(0);
  expect(result.clip).toBe('inset(50% 0% 0%)');
  expect(result.opacity).toBe('0.5');
  expect(result.transform).toContain('0.707107');
  expect(result.restored).toBe('M0 0 L100 0 L50 100 Z');
});

test('infinite progress wraps and plugin transforms coexist with pin/parallax on a parent', async ({ page }) => {
  const result = await page.evaluate(() => {
    const amber = createAmber({ infinite: true, autoRaf: false });
    const a = new animation.Animation({ el: document.querySelector('#inner'), t: { x: { v: [0, 100], unit: 'px' } } });
    animation.bindScroll(amber, a);
    amber.scrollTo(amber.loopLength + amber.loopLength / 4, { immediate: true });
    const progress = a.progress;
    amber.destroy(); a.destroy();
    const pin = document.querySelector('#pin');
    pin.dataset.amberSpeed = '.6';
    const b = createAmber({ autoRaf: false, pin: [{ target: pin, start: document.querySelectorAll('section')[1], end: document.querySelectorAll('section')[3] }] });
    const child = document.querySelector('#inner');
    const c = new animation.Animation({ el: child, t: { s: [1, 2] } });
    animation.bindScroll(b, c, { destroyAnimation: true });
    b.scrollTo(700, { immediate: true });
    const translated = pin.style.translate, scaled = child.style.transform;
    b.destroy();
    return { progress, translated, scaled, destroyed: c.destroyed, restored: child.style.transform };
  });
  expect(result.progress).toBeCloseTo(.25);
  expect(result.translated).not.toBe('');
  expect(result.scaled).toContain('scale(');
  expect(result.destroyed).toBe(true);
  expect(result.restored).toBe('');
});

test('reduced-motion browser preference settles time and scroll animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await page.evaluate(() => {
    const a = new animation.Animation({ el: document.querySelector('#box'), t: { o: [0, 1] }, d: 500 });
    a.play();
    const amber = createAmber({ autoRaf: false });
    animation.bindScroll(amber, a);
    amber.scrollTo(50, { immediate: true });
    const state = { progress: a.progress, running: a.raf.on };
    amber.destroy(); a.destroy(); return state;
  });
  expect(result).toEqual({ progress: 1, running: false });
});

test('resetAll restores CSS and SVG and freezes infinite-scroll bindings until explicitly played', async ({ page }) => {
  const result = await page.evaluate(() => {
    const amber = createAmber({ infinite: true, autoRaf: false });
    const box = document.querySelector('#box'), path = document.querySelector('#path');
    const original = path.getAttribute('d');
    const a = new animation.Animation({ targets: box, properties: { x: [10, 110, 'px'], o: [0, 1] } });
    const b = new svgAnimation.Animation({ targets: path, morph: { end: 'M0 0 L80 20 L50 80 Z' }, line: {} });
    const binding = animation.bindScroll(amber, a);
    b.seek(.7);
    amber.scrollTo(amber.loopLength * .5, { immediate: true });
    animation.resetAll([a, b]);
    amber.scrollTo(amber.loopLength * 1.25, { immediate: true });
    binding.update();
    const reset = { opacity: getComputedStyle(box).opacity, transform: getComputedStyle(box).transform,
      path: path.getAttribute('d'), progress: a.progress, statuses: [a.status, b.status] };
    binding.play();
    const caughtUp = a.progress;
    amber.destroy(); a.destroy(); b.destroy();
    return { reset, caughtUp, original };
  });
  expect(result.reset).toEqual({ opacity: '0', transform: 'matrix(1, 0, 0, 1, 10, 0)',
    path: result.original, progress: 0, statuses: ['paused', 'paused'] });
  expect(result.caughtUp).toBeCloseTo(.25);
});

test('core destroy completes all plugin cleanups even when one fails', async ({ page }) => {
  const result = await page.evaluate(() => {
    const amber = createAmber({ autoRaf: false });
    const calls = [];
    amber.on('destroy', () => { calls.push('first'); throw Error('expected'); });
    amber.on('destroy', () => calls.push('second'));
    let error;
    try { amber.destroy(); } catch (caught) { error = caught.name; }
    const replacement = createAmber({ autoRaf: false }); replacement.destroy();
    return { calls, error, destroyed: amber.isDestroyed };
  });
  expect(result).toEqual({ calls: ['first', 'second'], error: 'AggregateError', destroyed: true });
});
