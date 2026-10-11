import { test, expect } from '@playwright/test';

for (const renderer of ['native', 'transform']) {
  test(`${renderer} nested input chains only at a settled boundary`, async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!window.Amber);
    const result = await page.evaluate(renderer => {
      mount({ autoRaf: false });
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;height:120px;width:240px;overflow:auto;overscroll-behavior:contain';
      wrapper.tabIndex = 0;
      const content = document.createElement('div');
      content.style.cssText = 'display:flex;flex-direction:column';
      for (let i = 0; i < 3; i++) {
        const panel = document.createElement('div');
        panel.style.cssText = 'height:120px;flex:none';
        content.append(panel);
      }
      wrapper.append(content);
      amber.driver.content.firstElementChild.append(wrapper);
      const child = new Amber({ wrapper, content, renderer: renderer === 'transform' ? transform : 'native', plugins: amberPlugins, scrollChain: true, autoRaf: false });
      const wheel = deltaY => wrapper.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
      amber.scrollTo(100, { immediate: true });
      child.scrollTo('end', { immediate: true });
      wheel(120);
      const end = { parent: amber.target, child: child.target, limit: child.limit };
      amber.scrollTo(100, { immediate: true });
      wheel(-120);
      const reverse = { parent: amber.target, child: child.target };
      child.scrollTo(0, { immediate: true });
      wheel(-120);
      const start = amber.target;
      amber.scrollTo(100, { immediate: true });
      child.scrollTo('end', { immediate: true });
      wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      const keyboard = amber.target;
      child.destroy(); wrapper.remove();
      return { end, reverse, start, keyboard };
    }, renderer);
    expect(result.end.parent).toBeGreaterThan(100);
    expect(result.end.child).toBe(result.end.limit);
    expect(result.reverse.parent).toBe(100);
    expect(result.reverse.child).toBeLessThan(result.end.limit);
    expect(result.start).toBeLessThan(100);
    expect(result.keyboard).toBeGreaterThan(100);
  });
}

test('a touch can cross from a nested scroller to its parent without a new gesture', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.Amber);
  const result = await page.evaluate(() => {
    mount({ autoRaf: false });
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;height:120px;width:240px;overflow:hidden';
    const content = document.createElement('div');
    const panel = document.createElement('div');
    panel.style.height = '500px';
    content.append(panel); wrapper.append(content); amber.driver.content.firstElementChild.append(wrapper);
    const child = new Amber({ wrapper, content, scrollChain: true, autoRaf: false });
    amber.scrollTo(100, { immediate: true });
    const send = (type, y) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const point = { identifier: 1, target: wrapper, clientX: 50, clientY: y };
      Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
      wrapper.dispatchEvent(event);
    };
    send('touchstart', 100); send('touchmove', 80);
    const inside = amber.target;
    child.scrollTo('end', { immediate: true });
    send('touchmove', 60);
    const outside = amber.target;
    send('touchmove', 80);
    const reversed = { parent: amber.target, child: child.target, limit: child.limit };
    send('touchend', 80);
    child.destroy(); wrapper.remove();
    return { inside, outside, reversed };
  });
  expect(result.inside).toBe(100);
  expect(result.outside).toBeGreaterThan(100);
  expect(result.reversed.parent).toBe(result.outside);
  expect(result.reversed.child).toBeLessThan(result.reversed.limit);
});
