import { test, expect } from '@playwright/test';

for (const renderer of ['native', 'transform']) {
  for (const orientation of ['vertical', 'horizontal', 'both']) {
    test(`${renderer}/${orientation}: vector renderers preserve scalar calls, partial targets and native offsets`, async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(() => !!window.amber);
      const result = await page.evaluate(({ renderer, orientation }) => {
        amber.destroy();
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;width:300px;height:300px;overflow:auto';
        const content = document.createElement('div');
        content.style.cssText = 'width:1000px;height:1000px';
        const panel = document.createElement('div');
        panel.style.cssText = 'position:relative;width:1000px;height:1000px';
        const target = document.createElement('div');
        target.style.cssText = 'position:absolute;left:400px;top:500px;width:10px;height:10px';
        panel.append(target); content.append(panel); wrapper.append(content); document.body.append(wrapper);
        wrapper.scrollTo({ left: 60, top: 80, behavior: 'instant' });
        const instance = new Amber({ wrapper, content, renderer: renderer === 'native' ? 'native' : transform,
          orientation, autoRaf: false });
        const initial = instance.positionVector;
        const axis = orientation === 'horizontal' ? 'x' : 'y';
        const other = axis === 'x' ? 'y' : 'x';
        instance.scrollTo(120, { immediate: true, offset: 5 });
        const scalar = instance.positionVector;
        const written = instance.driver.write(140);
        const driverScalar = { ...instance.driver.readVector() };
        instance.scrollTo({ [axis]: 120 }, { immediate: true, offset: { [axis]: 5 } });
        const vector = instance.positionVector;
        instance.scrollTo({ [axis]: 180 }, { immediate: true });
        const partial = instance.positionVector;
        const stored = instance.motion.positionVector;
        const destination = instance.driver.destinationVector(target);
        instance.scrollTo(target, { immediate: true, offset: -10 });
        const element = instance.positionVector;
        const nativeInactive = wrapper[other === 'x' ? 'scrollLeft' : 'scrollTop'];
        const stableState = stored === instance.motion.positionVector;
        const snapshot = instance.positionVector;
        instance.scrollTo(200, { immediate: true });
        instance.destroy();
        const restored = { x: wrapper.scrollLeft, y: wrapper.scrollTop };
        wrapper.remove();
        return { initial, scalar, written, driverScalar, vector, partial, destination, element, nativeInactive, stableState, snapshot, restored };
      }, { renderer, orientation });
      const axis = orientation === 'horizontal' ? 'x' : 'y';
      const other = axis === 'x' ? 'y' : 'x';
      expect(result.initial).toEqual({ x: orientation === 'vertical' ? 0 : 60, y: orientation === 'horizontal' ? 0 : 80 });
      expect(result.scalar[axis]).toBe(125);
      expect(result.written).toBe(140);
      expect(result.driverScalar).toEqual({ ...result.scalar, [axis]: 140 });
      expect(result.vector).toEqual(result.scalar);
      expect(result.partial[axis]).toBe(180);
      expect(result.partial[other]).toBe(result.initial[other]);
      expect(result.element[axis]).toBe(result.destination[axis] - 10);
      expect(result.snapshot).toEqual(result.element);
      expect(result.stableState).toBe(true);
      expect(result.restored[axis]).toBe(200);
      if (orientation !== 'both' && renderer === 'native') expect(result.nativeInactive).toBe(other === 'x' ? 60 : 80);
    });
  }
}
