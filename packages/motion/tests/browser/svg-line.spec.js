import { test, expect } from '@playwright/test';

const cases = [
  { name: 'partial dash', d: 'M20 80 H250', dashed: '40 60', cap: 'butt' },
  { name: 'partial gap', d: 'M20 80 H290', dashed: '40 60', cap: 'butt' },
  { name: 'odd pattern and round caps', d: 'M20 80 H250', dashed: '17 9 5', cap: 'round' },
  { name: 'dotted curve', d: 'M20 100 C80 0 220 160 290 40', dashed: '0 12', cap: 'round' },
  { name: 'cubic curve and square caps', d: 'M20 100 C80 0 220 160 290 40', dashed: '14 8', cap: 'square' },
  { name: 'closed arc', d: 'M160 20 A60 60 0 1 1 159.999 20 Z', dashed: '14 8', cap: 'round' },
  { name: 'closed solid path', d: 'M40 120 L160 20 L280 120 Z', cap: 'round' },
  { name: 'normalized dashed path', d: 'M20 80 H250', dashed: '4 6', pathLength: 23, cap: 'butt' },
  { name: 'normalized solid curve', d: 'M20 100 C80 0 220 160 290 40', pathLength: 1, cap: 'round' },
  { name: 'path shorter than first dash', d: 'M20 80 H43', dashed: '40 60', cap: 'square' },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/motion/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => {
    // Rasterize real SVG in each browser; CSS values alone cannot detect cap dots,
    // repeated tails or a pathLength scaling error in the painted stroke.
    window.raster = async svg => {
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 160;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, 320, 160).data;
      } finally { URL.revokeObjectURL(url); }
    };
    window.makeSvg = spec => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '320'); svg.setAttribute('height', '160');
      svg.setAttribute('viewBox', '0 0 320 160');
      const path = document.createElementNS(svg.namespaceURI, 'path');
      for (const [key, value] of Object.entries({ d: spec.d, fill: 'none', stroke: 'black', 'stroke-width': 4,
        'stroke-linecap': spec.cap ?? 'butt', ...(spec.pathLength ? { pathLength: spec.pathLength } : {}) })) {
        path.setAttribute(key, value);
      }
      svg.append(path); document.body.prepend(svg);
      return { svg, path };
    };
    window.coverage = pixels => pixels.reduce((sum, value, i) => sum + (i % 4 === 3 ? value : 0), 0);
    window.markup = path => {
      const copy = path.cloneNode(true);
      // Removing the last inline property may leave an inert style="" attribute.
      if (!copy.style.cssText) copy.removeAttribute('style');
      return copy.outerHTML;
    };
  });
});

for (const entry of ['src', 'dist']) {
  for (const spec of cases) {
    test(`${entry}: ${spec.name} paints exact endpoints and reversible intermediate strokes`, async ({ page }) => {
      const result = await page.evaluate(async ({ entry, spec }) => {
        const { Animation } = await import(`/motion/${entry}/svg.js`);
        const { svg, path } = makeSvg(spec), original = markup(path);
        const reference = svg.cloneNode(true);
        reference.firstElementChild.setAttribute('stroke-dasharray', spec.dashed ?? 'none');
        const expected = await raster(reference);
        const animation = new Animation({ el: path, line: { dashed: spec.dashed } });
        const states = [];
        let forward;
        for (const progress of [0, .1, .5, 1, .5, 0]) {
          animation.seek(progress);
          const pixels = await raster(svg);
          if (progress === .5 && !forward) forward = pixels;
          states.push({ progress, coverage: coverage(pixels),
            mismatch: progress === 1 ? pixels.reduce((n, value, i) => n + (value !== expected[i]), 0) : 0,
            reverseMismatch: progress === .5 ? pixels.reduce((n, value, i) => n + (value !== forward[i]), 0) : 0 });
        }
        animation.destroy();
        return { states, expected: coverage(expected), restored: markup(path) === original };
      }, { entry, spec });
      expect(result.expected).toBeGreaterThan(0);
      expect(result.states[0].coverage).toBe(0);
      expect(result.states[2].coverage).toBeGreaterThan(0);
      expect(result.states[3].mismatch).toBe(0);
      expect(result.states[4].reverseMismatch).toBe(0);
      expect(result.states[5].coverage).toBe(0);
      expect(result.restored).toBe(true);
    });
  }

  test(`${entry}: normalized and unnormalized straight paths paint the correct reveal boundary`, async ({ page }) => {
    const result = await page.evaluate(async entry => {
      const { Animation } = await import(`/motion/${entry}/svg.js`);
      const samples = [];
      for (const normalized of [false, true]) {
        const { svg, path } = makeSvg({ d: 'M20 80 H250', pathLength: normalized ? 23 : undefined });
        const animation = new Animation({ el: path, line: { dashed: normalized ? '4 6' : '40 60' } });
        for (const progress of [.25, .5, .75]) {
          animation.seek(progress);
          const pixels = await raster(svg), offset = (1 - progress) * 230;
          const errors = [];
          for (let x = 0; x < 230; x++) {
            const distance = x + .5, phase = (offset + distance) % 100;
            // Avoid antialiased edges; compare visible ink against independent
            // path-distance intervals for the requested 40-on/60-off pattern.
            if (Math.abs(distance - progress * 230) < 2 || Math.min(phase, Math.abs(phase - 40), 100 - phase) < 2) continue;
            const painted = pixels[(80 * 320 + 20 + x) * 4 + 3] > 128;
            const expected = distance < progress * 230 && phase < 40;
            if (painted !== expected) errors.push(x);
          }
          samples.push({ normalized, progress, errors });
        }
        animation.destroy(); svg.remove();
      }
      return samples;
    }, entry);
    for (const sample of result) expect(sample.errors, JSON.stringify(sample)).toEqual([]);
  });

  test(`${entry}: real playback, reset and destroy preserve fill and inherited stroke opacity`, async ({ page }) => {
    await page.evaluate(async entry => {
      const { Animation } = await import(`/motion/${entry}/svg.js`);
      const { svg, path } = makeSvg({ d: 'M40 120 L160 20 L280 120 Z', cap: 'round' });
      svg.style.strokeOpacity = '.35';
      path.setAttribute('fill', 'red');
      window.drawing = { svg, path, original: markup(path),
        animation: new Animation({ el: path, duration: 100, line: { dashed: '0 12' } }) };
    }, entry);
    expect(await page.evaluate(async () => {
      const pixels = await raster(drawing.svg);
      return { fill: pixels[(80 * 320 + 160) * 4], opacity: getComputedStyle(drawing.path).strokeOpacity };
    })).toEqual({ fill: 255, opacity: '0' });
    await page.evaluate(() => drawing.animation.play());
    await expect.poll(() => page.evaluate(() => drawing.animation.status)).toBe('finished');
    expect(await page.evaluate(() => getComputedStyle(drawing.path).strokeOpacity)).toBe('0.35');
    await page.evaluate(() => drawing.animation.reverse());
    await expect.poll(() => page.evaluate(() => drawing.animation.status)).toBe('finished');
    expect(await page.evaluate(() => getComputedStyle(drawing.path).strokeOpacity)).toBe('0');
    expect(await page.evaluate(() => {
      drawing.animation.seek(.5).reset();
      const hidden = getComputedStyle(drawing.path).strokeOpacity === '0';
      drawing.animation.destroy();
      return { hidden, opacity: getComputedStyle(drawing.path).strokeOpacity,
        restored: markup(drawing.path) === drawing.original };
    })).toEqual({ hidden: true, opacity: '0.35', restored: true });
  });
}
