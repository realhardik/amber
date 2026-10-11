import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = join(root, 'node_modules/typescript/bin/tsc');
const build = join(root, 'scripts/build-dist.mjs');
function buildPackage(name) {
  const result = spawnSync(process.execPath, [build, name], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Distribution build failed (${result.status}).`);
}
function check(args) {
  const result = spawnSync(process.execPath, [compiler, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Type check failed (${result.status}).`);
}
buildPackage('amber');
buildPackage('motion');
check(['-p', 'tests/types/tsconfig.json']);
check(['-p', 'tests/types/tsconfig.json', '--module', 'ESNext', '--moduleResolution', 'Bundler']);

// Check the declarations in isolation: Motion must not require its optional peer.
const isolated = mkdtempSync(join(tmpdir(), 'amber-motion-types-'));
try {
  const packageDir = join(isolated, 'node_modules/amber-motion');
  mkdirSync(packageDir, { recursive: true });
  cpSync(join(root, 'packages/motion/package.json'), join(packageDir, 'package.json'));
  cpSync(join(root, 'packages/motion/dist'), join(packageDir, 'dist'), { recursive: true });
  cpSync(join(root, 'tests/types/standalone.ts'), join(isolated, 'standalone.ts'));
  writeFileSync(join(isolated, 'package.json'), '{"type":"module"}\n');
  check(['--strict', '--noEmit', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(isolated, 'standalone.ts')]);
} finally {
  rmSync(isolated, { recursive: true, force: true });
}
console.log('Type declarations passed: NodeNext, Bundler, standalone Motion without amber-scroll.');
