import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

test('production consumers retain validation and error classes with compact diagnostics', async () => {
  const { outputFiles } = await build({
    stdin: { contents: `export { default } from './index.js'; export { default as snap } from './plugins/snap.js';`,
      resolveDir: fileURLToPath(new URL('../../src/', import.meta.url)) },
    bundle: true, format: 'esm', target: 'es2020', minify: true, write: false,
    define: { __AMBER_DEBUG__: 'false' },
  });
  const source = outputFiles[0].text;
  assert.ok(!source.includes('damping must be greater'));
  assert.ok(!source.includes('snapDistance must be'));
  const { default: Amber, snap } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const [options, kind, code] of [
    [{ damping: 0 }, RangeError, 'A007'],
    [{ snap: 'mandatory' }, TypeError, 'A003'],
    [{ renderer: 'bad' }, TypeError, 'A001'],
    [{}, Error, 'A014'],
  ]) assert.throws(() => new Amber(options), { name: kind.name, message: `Amber ${code}` });
  assert.throws(() => new Amber({ plugins: [snap], snapDistance: -1 }), { name: 'TypeError', message: /^Amber A\d{3}$/ });
});
