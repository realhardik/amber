import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.amber);
});

for (const orientation of ['vertical', 'horizontal']) {
  test(`${orientation}: navigation to a descendant of a culled panel uses stable geometry`, async ({ page }) => {
    const result = await page.evaluate(orientation => {
      const target = document.createElement('div');
      target.style.cssText = 'position:absolute;top:60px;left:60px;width:20px;height:20px';
      document.querySelector('#third').append(target);
      mount({ orientation, autoRaf: false });
      amber.scrollTo(50, { immediate: true });
      amber.scrollTo(100, { immediate: true });
      amber.scrollTo(target, { immediate: true });
      const edge = orientation === 'horizontal' ? 'left' : 'top';
      return target.getBoundingClientRect()[edge] - amber.driver.bounds[edge];
    }, orientation);
    expect(result).toBeCloseTo(0, 2);
  });
}

for (const orientation of ['vertical', 'horizontal', 'both']) {
  test(`${orientation}: transform end includes the content offset`, async ({ page }) => {
    const result = await page.evaluate(orientation => {
      amber.destroy();
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;width:500px;height:500px;overflow:auto';
      const content = document.createElement('div');
      content.style.cssText = 'width:1000px;height:1000px;margin:40px 0 0 30px';
      const panel = document.createElement('div');
      panel.style.cssText = 'width:1000px;height:1000px';
      content.append(panel); wrapper.append(content); document.body.append(wrapper);
      const instance = new Amber({ wrapper, content, renderer: transform, orientation, autoRaf: false });
      instance.scrollTo('end', { immediate: true });
      const rect = panel.getBoundingClientRect(), bounds = instance.driver.bounds;
      const result = { limits: instance.limitVector, right: rect.right - bounds.right, bottom: rect.bottom - bounds.bottom };
      instance.destroy(); wrapper.remove();
      return result;
    }, orientation);
    if (orientation !== 'vertical') {
      expect(result.limits.x).toBe(530);
      expect(result.right).toBeCloseTo(0, 2);
    }
    if (orientation !== 'horizontal') {
      expect(result.limits.y).toBe(540);
      expect(result.bottom).toBeCloseTo(0, 2);
    }
  });
}

for (const renderer of ['native', 'transform']) {
  for (const infinite of [false, true]) {
    test(`${renderer}/${infinite ? 'loop' : 'finite'}: pins compensate for ancestor and own parallax`, async ({ page }) => {
      const result = await page.evaluate(({ renderer, infinite }) => {
        const parent = document.createElement('div');
        parent.dataset.amberSpeed = '.75';
        parent.style.cssText = 'position:absolute;top:100px;left:20px;width:200px;height:200px';
        const targets = [1, .8].map((speed, index) => {
          const target = document.createElement('div');
          target.dataset.amberSpeed = String(speed);
          target.style.cssText = `position:absolute;top:100px;left:${index * 80}px;width:60px;height:40px`;
          parent.append(target);
          return target;
        });
        document.querySelector('#first').append(parent);
        mount({ renderer, infinite, autoRaf: false, pin: targets.map(target => ({
          target, start: '#first', end: '#third', offset: 20,
        })) });
        const positions = [400, 600, 500];
        if (infinite) positions.push(500 + amber.loopLength);
        const held = positions.map(position => {
          amber.scrollTo(position, { immediate: true });
          return targets.map(target => target.getBoundingClientRect().top - amber.driver.bounds.top);
        });
        let released = null;
        if (!infinite) {
          amber.scrollTo(900, { immediate: true });
          released = targets.map(target => target.getBoundingClientRect().top - amber.driver.bounds.top);
          amber.scrollTo(500, { immediate: true });
          held.push(targets.map(target => target.getBoundingClientRect().top - amber.driver.bounds.top));
        }
        return { held, released };
      }, { renderer, infinite });
      for (const sample of result.held) for (const top of sample) expect(top).toBeCloseTo(20, 1);
      if (result.released) for (const top of result.released) expect(top).toBeLessThan(20);
    });
  }
}

for (const snap of [false, 'mandatory']) {
  test(`native scroll completion ${snap ? 'snaps before finishing' : 'emits once'}`, async ({ page }) => {
    await page.evaluate(snap => {
      mount({ renderer: 'native', smoothTouch: false, snap, autoRaf: true });
      window.completions = [];
      amber.on('scrollend', state => completions.push(state.position));
      document.querySelector('#viewport').scrollTop = 350;
    }, snap);
    await expect.poll(() => page.evaluate(() => completions.length)).toBe(1);
    const position = await page.evaluate(() => completions[0]);
    expect(position).toBeCloseTo(snap ? 420 : 350, 1);
    // An old native completion timer must not emit again after Amber's own writes.
    await page.waitForTimeout(220);
    expect(await page.evaluate(() => completions.length)).toBe(1);
  });
}

test('native completion is canceled by stop, scrollTo, and destroy', async ({ page }) => {
  const result = await page.evaluate(async () => {
    mount({ renderer: 'native', autoRaf: false });
    let count = 0;
    amber.on('scrollend', () => count++);
    const viewport = document.querySelector('#viewport');
    viewport.scrollTop = 200;
    amber.handleNativeScroll();
    amber.stop();
    await new Promise(resolve => setTimeout(resolve, 220));
    const stopped = count;
    amber.start();
    viewport.scrollTop = 250;
    amber.handleNativeScroll();
    amber.scrollTo(300, { immediate: true });
    await new Promise(resolve => setTimeout(resolve, 220));
    viewport.scrollTop = 350;
    amber.handleNativeScroll();
    amber.destroy();
    const timerAfterDestroy = amber.nativeScrollEndTimer;
    await new Promise(resolve => setTimeout(resolve, 220));
    return { stopped, count, timerAfterDestroy };
  });
  expect(result).toEqual({ stopped: 0, count: 1, timerAfterDestroy: null });
});

test('resize emits when viewport and content grow equally', async ({ page }) => {
  const result = await page.evaluate(() => {
    mount({ autoRaf: false });
    const limit = amber.limit;
    let count = 0;
    amber.on('resize', () => count++);
    document.querySelector('#viewport').style.height = '420px';
    document.querySelector('#fourth').style.height = '520px';
    amber.resize();
    return { limit, nextLimit: amber.limit, count };
  });
  expect(result.nextLimit).toBe(result.limit);
  expect(result.count).toBe(1);
});

for (const preexisting of [false, true]) {
  test(`native infinite scrollbar hiding restores ownership (existing attribute: ${preexisting})`, async ({ page }) => {
    const result = await page.evaluate(preexisting => {
      amber.destroy();
      const viewport = document.querySelector('#viewport');
      if (preexisting) viewport.setAttribute('data-amber-hide-scrollbar', 'author');
      const originalWidth = viewport.style.getPropertyValue('scrollbar-width');
      const originalRules = document.querySelectorAll('style[data-amber-hide-scrollbar]').length;
      mount({ renderer: 'native', infinite: true, hideScrollbar: true, autoRaf: false });
      const style = [...document.querySelectorAll('style[data-amber-hide-scrollbar]')].at(-1);
      const during = { looping: amber.isInfinite, marked: viewport.hasAttribute('data-amber-hide-scrollbar'),
        width: viewport.style.getPropertyValue('scrollbar-width'), css: style?.textContent };
      amber.destroy();
      return { during, originalWidth, originalRules, afterWidth: viewport.style.getPropertyValue('scrollbar-width'),
        afterAttribute: viewport.getAttribute('data-amber-hide-scrollbar'),
        afterRules: document.querySelectorAll('style[data-amber-hide-scrollbar]').length };
    }, preexisting);
    expect(result.during.looping).toBe(true);
    expect(result.during.marked).toBe(true);
    expect(result.during.width).toBe('none');
    expect(result.during.css).toContain('[data-amber-hide-scrollbar]::-webkit-scrollbar');
    expect(result.during.css).not.toMatch(/html|body/);
    expect(result.afterAttribute).toBe(preexisting ? 'author' : null);
    expect(result.afterWidth).toBe(result.originalWidth);
    expect(result.afterRules).toBe(result.originalRules);
  });
}
