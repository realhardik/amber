import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { environment, element, amberMock } from './helpers.js';

test('production Motion and SVG retain validation, error classes and valid animation behavior', async () => {
  const { outputFiles } = await build({
    stdin: { contents: `export * from './index.js'; export * as svg from './svg.js';`,
      resolveDir: fileURLToPath(new URL('../src/', import.meta.url)) },
    bundle: true, format: 'esm', target: 'es2020', minify: true, write: false,
    define: { __AMBER_DEBUG__: 'false' },
  });
  const source = outputFiles[0].text;
  for (const text of ['__AMBER_DEBUG__', 'Animation needs at least', 'SVG morph needs matching', 'bindScroll needs a live']) {
    assert.ok(!source.includes(text), `Production bundle retained ${text}`);
  }
  const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const env = environment(), el = element(env);
  const options = { el, duration: 100, t: { o: [0, 1] }, scheduler: env.scheduler };
  const animation = new api.Animation(options);
  const amber = amberMock();
  for (const [action, kind, code] of [
    [() => new api.Animation(), TypeError, 'M001'],
    [() => new api.Animation({ ...options, easing: 'missing' }), TypeError, 'M002'],
    [() => new api.Animation({ ...options, onUpdate: true }), TypeError, 'M003'],
    [() => animation.play({ rev: 1 }), TypeError, 'M004'],
    [() => new api.Animation({ ...options, duration: NaN }), TypeError, 'M005'],
    [() => api.resetAll(), TypeError, 'M006'],
    [() => new api.Scheduler({}), TypeError, 'M010'],
    [() => new api.FrameRunner(() => {}).run(), Error, 'M011'],
    [() => api.bindScroll(null, animation), TypeError, 'M013'],
    [() => api.bindScroll(amber, animation, { start: 1, end: 1 }), RangeError, 'M018'],
    [() => api.svg.morphInterpolator('', 'M0 0'), TypeError, 'M019'],
    [() => api.svg.morphInterpolator('M0 0', 'M0 0 L1'), TypeError, 'M024'],
    [() => api.svg.morphInterpolator('M0 0 L1 1', 'M0 0 Q1 1 2 2'), TypeError, 'M026'],
    [() => new api.svg.Animation({ el, line: { dashed: '.00001 .00001' } }), RangeError, 'M030'],
    [() => new api.Animation({ ...options, t: { o: [1] } }), TypeError, 'M032'],
    [() => new api.Animation({ ...options, t: { x: { v: [0, 1], name: 'unknown' } } }), TypeError, 'M034'],
  ]) assert.throws(action, { name: kind.name, message: `Amber ${code}` });
  assert.equal(amber.listenerCount, 0);
  animation.seek(.5);
  assert.equal(Number(el.style.getPropertyValue('opacity')), .5);
  animation.destroy();
  env.scheduler.destroy();
});
