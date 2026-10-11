import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Measure representative ESM consumers, rather than concatenating every dist file.
const root = fileURLToPath(new URL('../', import.meta.url));
const core = "export { default } from './packages/amber/src/index.js';";
const transform = "export { default as transform } from './packages/amber/src/transform.js';";
const infinite = "export { default as infinite } from './packages/amber/src/plugins/infinite.js';";
const entries = {
  core,
  transform: core + transform,
  nativeInfinite: core + infinite,
  full: core + transform
    + "export * from './packages/amber/src/plugins/effects.js';"
    + "export { default as snap } from './packages/amber/src/plugins/snap.js';"
    + infinite
    + "export { default as sections } from './packages/amber/src/plugins/sections.js';",
  motion: "export { animate } from './packages/motion/src/index.js';",
  svg: "export { animate } from './packages/motion/src/svg.js';",
};

const sizes = {};
for (const [name, contents] of Object.entries(entries)) {
  const result = await build({ stdin: { contents, resolveDir: root }, bundle: true,
    format: 'esm', target: 'es2020', minify: true, define: { __AMBER_DEBUG__: 'false' }, write: false });
  const bytes = result.outputFiles[0].contents;
  sizes[name] = { minified: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
}
console.log(JSON.stringify(sizes, null, 2));
