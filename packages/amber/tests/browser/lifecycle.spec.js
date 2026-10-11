import { test, expect } from '@playwright/test';

for (const renderer of ['native', 'transform']) {
  test(`${renderer}: failed feature setup restores styles; failed refresh cleans effects and recovers`, async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!window.amber);
    const result = await page.evaluate(renderer => {
      amber.destroy();
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:300px;height:300px;position:relative;overflow:auto';
      const content = document.createElement('div');
      const first = document.createElement('section');
      const last = document.createElement('section');
      for (const panel of [first, last]) panel.style.cssText = 'height:500px;position:relative';
      const target = document.createElement('div');
      target.style.cssText = 'position:absolute;top:100px;width:20px;height:20px;translate:3px 4px;transform:scale(.9)';
      target.dataset.amberSpeed = '.5';
      first.append(target); content.append(first, last); wrapper.append(content); document.body.append(wrapper);
      const elements = [wrapper, content, first, last, target];
      const original = elements.map(element => element.style.cssText);
      let fail = true;
      const options = { wrapper, content, renderer: renderer === 'native' ? 'native' : transform,
        plugins: amberPlugins, autoRaf: false, pin: [{ target, start: first, end: last, endOffset: () => fail ? NaN : 0 }] };
      let setupError, resizeError;
      try { new Amber(options); } catch (error) { setupError = error.message; }
      const restored = elements.every((element, i) => element.style.cssText === original[i]);
      fail = false;
      const instance = new Amber(options);
      instance.scrollTo(200, { immediate: true });
      fail = true;
      try { instance.resize(); } catch (error) { resizeError = error.message; }
      const cleaned = instance.effects.records.size === 0 && instance.pins.records.length === 0 && instance.parallax.records.length === 0;
      fail = false;
      instance.resize();
      const recovered = instance.pins.records.length === 1 && instance.parallax.records.length === 1;
      instance.destroy();
      const finalRestored = elements.every((element, i) => element.style.cssText === original[i]);
      wrapper.remove();
      return { setupError, resizeError, restored, cleaned, recovered, finalRestored };
    }, renderer);
    expect(result.setupError).toMatch(/endOffset/);
    expect(result.resizeError).toMatch(/endOffset/);
    expect(result.restored).toBe(true);
    expect(result.cleaned).toBe(true);
    expect(result.recovered).toBe(true);
    expect(result.finalRestored).toBe(true);
  });
}
