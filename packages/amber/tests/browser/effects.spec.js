import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.amber);
});

for (const renderer of ['transform', 'native']) {
  for (const orientation of ['vertical', 'horizontal']) {
    test(`${renderer}/${orientation}: nested speed controls relative movement`, async ({ page }) => {
      const result = await page.evaluate(({ renderer, orientation }) => {
        const section = document.querySelector('#second');
        const slow = document.createElement('div');
        const fast = document.createElement('div');
        slow.dataset.amberSpeed = '0.6';
        fast.dataset.amberSpeed = '1.5';
        slow.style.cssText = 'position:absolute;top:100px;left:100px;width:20px;height:20px;translate:3px 4px;transform:scale(0.9)';
        fast.style.cssText = 'position:absolute;top:150px;left:150px;width:20px;height:20px';
        section.append(slow, fast);
        const original = slow.style.cssText;
        mount({ renderer, orientation, autoRaf: false });
        const from = 320;
        const distance = 60;
        const edge = orientation === 'vertical' ? 'top' : 'left';
        amber.scrollTo(from, { immediate: true });
        const slowBefore = slow.getBoundingClientRect()[edge];
        const fastBefore = fast.getBoundingClientRect()[edge];
        amber.scrollTo(from + distance, { immediate: true });
        const slowAfter = slow.getBoundingClientRect()[edge];
        const fastAfter = fast.getBoundingClientRect()[edge];
        const transformed = slow.style.transform;
        amber.destroy();
        return {
          slowDelta: slowAfter - slowBefore,
          fastDelta: fastAfter - fastBefore,
          distance,
          transformed,
          restored: slow.style.cssText === original,
        };
      }, { renderer, orientation });
      expect(result.slowDelta).toBeCloseTo(-result.distance * 0.6);
      expect(result.fastDelta).toBeCloseTo(-result.distance * 1.5);
      expect(result.transformed).toBe('scale(0.9)');
      expect(result.restored).toBe(true);
    });
  }

  test(`${renderer}: top and middle pins hold, release, reverse, and compose with parallax`, async ({ page }) => {
    const result = await page.evaluate(renderer => {
      const first = document.querySelector('#first');
      const second = document.querySelector('#second');
      const topPin = document.createElement('div');
      const middlePin = document.createElement('div');
      topPin.id = 'top-pin';
      topPin.dataset.amberSpeed = '0.5';
      topPin.style.cssText = 'position:absolute;top:80px;left:20px;width:80px;height:40px;translate:3px 4px;transform:scale(0.9)';
      middlePin.id = 'middle-pin';
      middlePin.style.cssText = 'position:absolute;top:80px;left:120px;width:80px;height:40px';
      first.append(topPin);
      second.append(middlePin);
      const topOriginal = topPin.style.cssText;
      mount({
        renderer,
        autoRaf: false,
        pin: [
          { target: '#top-pin', start: '#first', end: '#third', position: 'top', offset: 20 },
          { target: '#middle-pin', start: '#second', end: '#fourth', position: 'middle', offset: 10 },
        ],
      });
      const viewportTop = document.querySelector('#viewport').getBoundingClientRect().top + document.querySelector('#viewport').clientTop;
      const positions = [];
      for (const position of [500, 900, 500]) {
        amber.scrollTo(position, { immediate: true });
        const topRect = topPin.getBoundingClientRect();
        const middleRect = middlePin.getBoundingClientRect();
        positions.push({ top: topRect.top - viewportTop, middle: middleRect.top + middleRect.height / 2 - viewportTop });
      }
      const transform = topPin.style.transform;
      const expectedMiddle = amber.driver.viewportSize / 2 + 10;
      amber.destroy();
      return { positions, transform, restored: topPin.style.cssText === topOriginal, expectedMiddle };
    }, renderer);
    expect(result.positions[0].top).toBeCloseTo(20);
    expect(result.positions[0].middle).toBeCloseTo(result.expectedMiddle);
    expect(result.positions[1].top).toBeLessThan(20);
    expect(result.positions[1].middle).toBeCloseTo(result.expectedMiddle);
    expect(result.positions[2].top).toBeCloseTo(20);
    expect(result.positions[2].middle).toBeCloseTo(result.expectedMiddle);
    expect(result.transform).toBe('scale(0.9)');
    expect(result.restored).toBe(true);
  });
}

test('parallax reacts to late and changed speed attributes while direct panels remain structural', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const section = document.querySelector('#second');
    const target = document.createElement('div');
    target.style.cssText = 'position:absolute;top:100px;width:20px;height:20px';
    section.append(target);
    mount({ autoRaf: false });
    target.dataset.amberSpeed = '0.5';
    section.dataset.amberSpeed = '0.2';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    amber.scrollTo(250, { immediate: true });
    const before = target.getBoundingClientRect().top;
    amber.scrollTo(350, { immediate: true });
    const active = target.getBoundingClientRect().top - before;
    const sectionTranslate = section.style.translate;
    target.dataset.amberSpeed = 'invalid';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const resetBefore = target.getBoundingClientRect().top;
    amber.scrollTo(400, { immediate: true });
    const reset = target.getBoundingClientRect().top - resetBefore;
    return { active, reset, sectionTranslate };
  });
  expect(result.active).toBeCloseTo(-50);
  expect(result.reset).toBeCloseTo(-50);
  expect(result.sectionTranslate).toBe('');
});

test('transform parallax keeps its speed after its parent section exits', async ({ page }) => {
  const delta = await page.evaluate(() => {
    const target = document.createElement('div');
    target.dataset.amberSpeed = '0.2';
    target.style.cssText = 'position:absolute;top:350px;width:20px;height:20px';
    document.querySelector('#first').append(target);
    mount({ autoRaf: false });
    amber.scrollTo(430, { immediate: true });
    const before = target.getBoundingClientRect().top;
    amber.scrollTo(480, { immediate: true });
    return target.getBoundingClientRect().top - before;
  });
  expect(delta).toBeCloseTo(-10);
});

test('missing pins stay dormant and invalid selectors fail clearly', async ({ page }) => {
  const result = await page.evaluate(() => {
    amber.destroy();
    let invalid = '';
    try { new Amber({ renderer: transform, plugins: amberPlugins, pin: [{ target: '[', start: '#first', end: '#third' }] }); }
    catch (error) { invalid = `${error.name}: ${error.message}`; }
    const valid = new Amber({ renderer: transform, plugins: amberPlugins, pin: [{ target: '#later', start: '#first', end: '#third' }] });
    const dormant = valid.pins.records.length;
    valid.destroy();
    return { invalid, dormant };
  });
  expect(result.invalid).toContain('SyntaxError: Amber: invalid pin.target selector');
  expect(result.dormant).toBe(0);
});

for (const renderer of ['transform', 'native']) {
  test(`${renderer}: parallax returns to identical positions after an offscreen round trip`, async ({ page }) => {
    const result = await page.evaluate(renderer => {
      const target = document.createElement('div');
      target.dataset.amberSpeed = '.8';
      target.style.cssText = 'position:absolute;top:100px;width:20px;height:20px';
      document.querySelector('#second').append(target);
      mount({ renderer, autoRaf: false });
      const samples = [];
      for (const position of [0, 20, 600, 1200, 0, 20]) {
        amber.scrollTo(position, { immediate: true });
        samples.push(target.getBoundingClientRect().top);
      }
      return samples;
    }, renderer);
    expect(result[4]).toBeCloseTo(result[0], 2);
    expect(result[5]).toBeCloseTo(result[1], 2);
  });
}

test('infinite parallax has identical layer positions on successive laps in either direction', async ({ page }) => {
  const result = await page.evaluate(() => {
    const target = document.createElement('div');
    target.dataset.amberSpeed = '.8';
    target.style.cssText = 'position:absolute;top:100px;width:20px;height:20px';
    document.querySelector('#second').append(target);
    mount({ infinite: true, autoRaf: false });
    const length = amber.loopLength;
    const samples = [];
    for (const position of [0, 20, 1100, length - 1, length, length + 20, length - 1, 1100, 20, 0]) {
      amber.scrollTo(position, { immediate: true });
      samples.push(target.getBoundingClientRect().top);
    }
    return samples;
  });
  expect(result[4]).toBeCloseTo(result[0], 2);
  expect(result[5]).toBeCloseTo(result[1], 2);
  expect(result[8]).toBeCloseTo(result[1], 2);
  expect(result[9]).toBeCloseTo(result[0], 2);
});

for (const renderer of ['transform', 'native']) {
  test(`${renderer}: vertical infinite pins hold, repeat each lap, and reject seam wrap`, async ({ page }) => {
    const result = await page.evaluate(renderer => {
      const first = document.querySelector('#first');
      const pin = document.createElement('div');
      pin.id = 'loop-pin';
      pin.style.cssText = 'position:absolute;top:80px;left:20px;width:80px;height:40px';
      first.append(pin);
      mount({
        renderer,
        infinite: true,
        autoRaf: false,
        pin: [{ target: '#loop-pin', start: '#first', end: '#third', position: 'top', offset: 20 }],
      });
      const viewportTop = document.querySelector('#viewport').getBoundingClientRect().top
        + document.querySelector('#viewport').clientTop;
      const length = amber.loopLength;
      const sample = position => {
        amber.scrollTo(position, { immediate: true });
        return pin.getBoundingClientRect().top - viewportTop;
      };
      const held = sample(500);
      const heldNextLap = sample(500 + length);
      const released = sample(length - 40);
      // The first panel is recycled into the viewport before the seam itself.
      // Its child must already be reset to its ordinary flow position there.
      const reentered = sample(length - 200);
      // Once the loop returns to the first section, the released pin must no
      // longer carry its previous-lap compensation and should be natural again.
      const reset = sample(0);
      // Verify the same reset during an actual smoothed seam crossing, not
      // only immediate seeks. The incoming first panel begins at length - 200.
      amber.scrollTo(length - 260, { immediate: true });
      amber.scrollTo(length + 120);
      const continuous = [];
      for (let frame = 0; frame < 180; frame++) {
        amber.raf(frame * 1000 / 60);
        const phase = amber.position;
        if (phase > length - 220 && phase < length - 100) {
          continuous.push(Math.abs((pin.getBoundingClientRect().top - viewportTop) - (length - phase + 80)));
        }
      }
      amber.destroy();
      let wrapError = '';
      const fourth = document.querySelector('#fourth');
      const seamPin = document.createElement('div');
      seamPin.id = 'seam-pin';
      seamPin.style.cssText = 'position:absolute;top:80px;left:20px;width:80px;height:40px';
      fourth.append(seamPin);
      try {
        mount({
          renderer,
          infinite: true,
          autoRaf: false,
          pin: [{ target: '#seam-pin', start: '#fourth', end: '#first', position: 'top', offset: 20 }],
        });
      } catch (error) {
        wrapError = error.message;
      }
      return { held, heldNextLap, released, reentered, reset, continuous, wrapError, infinite: length > 0 };
    }, renderer);
    expect(result.infinite).toBe(true);
    expect(result.held).toBeCloseTo(20, 1);
    expect(result.heldNextLap).toBeCloseTo(result.held, 1);
    expect(result.released).not.toBeCloseTo(20, 0);
    expect(result.reentered).toBeCloseTo(280, 1);
    expect(result.reset).toBeCloseTo(80, 1);
    expect(result.continuous.length).toBeGreaterThan(0);
    expect(Math.max(...result.continuous)).toBeLessThan(1);
    expect(result.wrapError).toContain('cannot wrap the infinite seam');
  });

  test(`${renderer}: pins retain author geometry while looping`, async ({ page }) => {
    const result = await page.evaluate(renderer => {
      const first = document.querySelector('#first');
      const second = document.querySelector('#second');
      const translated = document.createElement('div');
      const scaled = document.createElement('div');
      const parallaxed = document.createElement('div');
      translated.id = 'translated-loop-pin';
      scaled.id = 'scaled-loop-pin';
      parallaxed.id = 'parallax-loop-pin';
      parallaxed.dataset.amberSpeed = '.8';
      translated.style.cssText = 'position:absolute;top:80px;left:20px;width:80px;height:40px;translate:0 15px';
      scaled.style.cssText = 'position:absolute;top:100px;left:120px;width:80px;height:40px;transform:scale(1.5)';
      parallaxed.style.cssText = 'position:absolute;top:160px;left:240px;width:40px;height:30px';
      first.append(translated, parallaxed); second.append(scaled);
      mount({
        renderer,
        infinite: true,
        autoRaf: false,
        pin: [
          { target: '#translated-loop-pin', start: '#first', end: '#third', position: 'top', offset: 20 },
          { target: '#scaled-loop-pin', start: '#second', end: '#fourth', position: 'middle', offset: 10 },
          { target: '#parallax-loop-pin', start: '#first', end: '#third', position: 'top', offset: 20 },
        ],
      });
      const viewport = document.querySelector('#viewport');
      const viewportTop = viewport.getBoundingClientRect().top + viewport.clientTop;
      amber.scrollTo(600, { immediate: true });
      const firstLap = {
        translated: translated.getBoundingClientRect().top - viewportTop,
        center: scaled.getBoundingClientRect().top + scaled.getBoundingClientRect().height / 2 - viewportTop,
      };
      amber.scrollTo(600 + amber.loopLength, { immediate: true });
      const secondLap = {
        translated: translated.getBoundingClientRect().top - viewportTop,
        center: scaled.getBoundingClientRect().top + scaled.getBoundingClientRect().height / 2 - viewportTop,
      };
      amber.scrollTo(amber.loopLength - 200, { immediate: true });
      const parallaxPinReset = amber.effects.records.get(parallaxed).values.get('pin:y');
      const expectedCenter = amber.driver.viewportSize / 2 + 10;
      amber.destroy();
      return { firstLap, secondLap, parallaxPinReset, expectedCenter };
    }, renderer);
    expect(result.firstLap.translated).toBeCloseTo(20, 1);
    expect(result.firstLap.center).toBeCloseTo(result.expectedCenter, 1);
    expect(result.secondLap.translated).toBeCloseTo(result.firstLap.translated, 1);
    expect(result.secondLap.center).toBeCloseTo(result.firstLap.center, 1);
    expect(result.parallaxPinReset).toBe(0);
  });
}
