import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.amber);
});

test('2D parallax keeps moving correctly after its parent tile is culled', async ({ page }) => {
  const result = await page.evaluate(() => {
    const target = document.createElement('div');
    target.dataset.amberSpeed = '.2';
    target.style.cssText = 'position:absolute;top:350px;width:20px;height:20px';
    document.querySelector('#first').append(target);
    mount({ orientation: 'both', autoRaf: false });
    const tops = [500, 600, 700, 500].map(y => {
      amber.scrollTo({ y }, { immediate: true });
      return target.getBoundingClientRect().top;
    });
    target.removeAttribute('data-amber-speed');
    amber.resize();
    return { tops, markedAfterRemoval: !!amber.driver.tiles[0].hasParallax };
  });
  expect(result.tops[1] - result.tops[0]).toBeCloseTo(-20, 2);
  expect(result.tops[2] - result.tops[1]).toBeCloseTo(-20, 2);
  expect(result.tops[3]).toBeCloseTo(result.tops[0], 2);
  expect(result.markedAfterRemoval).toBe(false);
});

for (const [orientation, axis] of [['vertical', 'y'], ['horizontal', 'x'], ['both', 'x'], ['both', 'y']]) {
  test(`${orientation}/${axis}: offset infinite tracks have no gaps when recycling in either direction`, async ({ page }) => {
    const results = await page.evaluate(({ orientation, axis }) => {
      amber.destroy();
      const horizontal = axis === 'x';
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;width:300px;height:300px;overflow:auto';
      const content = document.createElement('div');
      content.style.cssText = `display:flex;flex-direction:${horizontal ? 'row' : 'column'};width:${horizontal ? 1200 : 300}px;height:${horizontal ? 300 : 1200}px;margin-${horizontal ? 'left' : 'top'}:40px`;
      for (let i = 0; i < 3; i++) {
        const panel = document.createElement('div');
        panel.style.cssText = `flex:none;width:${horizontal ? 400 : 300}px;height:${horizontal ? 300 : 400}px`;
        content.append(panel);
      }
      wrapper.append(content); document.body.append(wrapper);
      const instance = new Amber({ wrapper, content, renderer: transform, plugins: amberPlugins,
        orientation, infinite: orientation === 'both' ? { [axis]: true } : true, autoRaf: false });
      const start = horizontal ? 'left' : 'top', end = horizontal ? 'right' : 'bottom';
      const results = [-1201, -400, -1, 0, 399, 400, 439, 440, 441, 1199, 1200, 1600].map(position => {
        instance.scrollTo(orientation === 'both' ? { [axis]: position } : position, { immediate: true });
        const edge = instance.driver.bounds[start];
        const ranges = [...content.children].map(panel => {
          const rect = panel.getBoundingClientRect();
          return [rect[start] - edge, rect[end] - edge];
        }).sort((a, b) => a[0] - b[0]);
        let covered = 0;
        for (const [from, to] of ranges) {
          if (to <= 0 || from >= 300) continue;
          if (from > covered + .01) break;
          covered = Math.max(covered, to);
        }
        return { position, covered, infinite: instance.infiniteAxes[axis] };
      });
      instance.destroy(); wrapper.remove();
      return results;
    }, { orientation, axis });
    for (const result of results) {
      expect(result.infinite).toBe(true);
      expect(result.covered, `coverage at ${result.position}`).toBeGreaterThanOrEqual(300);
    }
  });
}

for (const managedWheel of [false, true]) {
  test(`nested vertical scrolling leaves the parent's horizontal wheel, key, and touch usable (capture: ${managedWheel})`, async ({ page }) => {
    const result = await page.evaluate(managedWheel => {
      document.querySelector('#content').style.width = '1200px';
      mount({ orientation: 'both', autoRaf: false, managedWheel, wheelMultiplier: 1, touchMultiplier: 1 });
      const wrapper = document.querySelector('#nested');
      const child = new Amber({ wrapper, orientation: 'vertical', autoRaf: false, wheelMultiplier: 1 });
      const wheel = new WheelEvent('wheel', { deltaX: 50, bubbles: true, cancelable: true });
      wrapper.dispatchEvent(wheel);
      const wheelTarget = amber.targetVector;
      wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      const keyTarget = amber.targetVector;
      const sendTouch = (type, x) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        const point = { identifier: 1, clientX: x, clientY: 50 };
        Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
        wrapper.dispatchEvent(event);
      };
      sendTouch('touchstart', 100); sendTouch('touchmove', 80);
      const touchTarget = amber.targetVector;
      const childTarget = child.target;
      sendTouch('touchend', 80);
      // Shared vertical input still belongs to the child.
      const beforeVertical = amber.targetVector;
      wrapper.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));
      const afterVertical = amber.targetVector;
      const childVertical = child.target;
      child.destroy();
      return { wheelTarget, keyTarget, touchTarget, childTarget, prevented: wheel.defaultPrevented,
        beforeVertical, afterVertical, childVertical };
    }, managedWheel);
    expect(result.wheelTarget).toEqual({ x: 50, y: 0 });
    expect(result.prevented).toBe(true);
    expect(result.keyTarget.x).toBeGreaterThan(result.wheelTarget.x);
    expect(result.touchTarget).toEqual({ x: 20, y: 0 });
    expect(result.childTarget).toBe(0);
    expect(result.afterVertical).toEqual(result.beforeVertical);
    expect(result.childVertical).toBe(40);
  });
}

test('a horizontal child retains mapped vertical wheel input during parent capture', async ({ page }) => {
  const result = await page.evaluate(() => {
    mount({ orientation: 'both', autoRaf: false, managedWheel: true });
    const wrapper = document.querySelector('#nested');
    document.querySelector('#nested-inner').style.width = '1000px';
    const child = new Amber({ wrapper, orientation: 'horizontal', wheelGesture: 'both', wheelMultiplier: 1, autoRaf: false });
    wrapper.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));
    const result = { parent: amber.targetVector, child: child.target };
    child.destroy();
    return result;
  });
  expect(result).toEqual({ parent: { x: 0, y: 0 }, child: 40 });
});
