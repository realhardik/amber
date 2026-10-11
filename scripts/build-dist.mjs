import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { transform } from 'esbuild';

const names = { amber: 'amber', motion: 'motion' };
const selected = process.argv[2];

if (!names[selected]) throw new Error('Usage: node scripts/build-dist.mjs <amber|motion>');

const packageRoot = join(import.meta.dirname, '..', 'packages', names[selected]);
const sourceRoot = join(packageRoot, 'src');
const outputRoot = join(packageRoot, 'dist');

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

rmSync(outputRoot, { recursive: true, force: true });
for (const input of files(sourceRoot)) {
  const output = join(outputRoot, relative(sourceRoot, input));
  mkdirSync(dirname(output), { recursive: true });
  if (!input.endsWith('.js')) {
    cpSync(input, output);
    continue;
  }
  const result = await transform(readFileSync(input, 'utf8'), {
    format: 'esm',
    target: 'es2020',
    minify: true,
    define: { __AMBER_DEBUG__: 'false' },
    sourcemap: 'external',
    sourcefile: relative(packageRoot, input),
  });
  writeFileSync(output, `${result.code}\n//# sourceMappingURL=${relative(dirname(output), `${output}.map`)}\n`);
  writeFileSync(`${output}.map`, result.map);
}
