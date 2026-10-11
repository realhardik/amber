import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium, firefox, webkit } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const consumer = resolve(process.argv[2] ?? join(root, '.release/consumer'));
const requireConsumer = createRequire(join(consumer, 'package.json'));
const report = { packages: {}, angular: null, browsers: {} };
for (const name of ['amber-scroll', 'amber-motion']) {
  const packageRoot = join(consumer, 'node_modules', name);
  const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  for (const file of ['LICENSE', 'README.md', 'ERRORS.md']) assert.ok((await readFile(join(packageRoot, file))).length);
  for (const [subpath, entry] of Object.entries(pkg.exports)) {
    const specifier = name + (subpath === '.' ? '' : subpath.slice(1));
    await import(pathToFileURL(requireConsumer.resolve(specifier)).href);
    assert.ok((await readFile(join(packageRoot, entry.types))).length);
  }
  report.packages[name] = { version: pkg.version, entryPoints: Object.keys(pkg.exports).length };
}
report.angular = JSON.parse(await readFile(join(consumer, 'node_modules/@angular/core/package.json'), 'utf8')).version;
const { outputFiles } = await build({
  stdin: { contents: await readFile(join(root, 'tests/release/angular-app.js'), 'utf8'), resolveDir: consumer },
  bundle: true, write: false, format: 'esm', target: 'es2022',
});
const html = '<!doctype html><html><head><base href="/"></head><body><app-root></app-root><script type="module" src="/app.js"></script></body></html>';
const server = createServer((request, response) => {
  const script = request.url === '/app.js';
  response.writeHead(200, { 'Content-Type': script ? 'text/javascript' : 'text/html' });
  response.end(script ? outputFiles[0].contents : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/tests/anchors-history`);
      await page.waitForFunction(() => window.releaseState && window.releaseRouter);
      await page.evaluate(() => releaseState.amber.scrollTo(40, { immediate: true }));
      await page.locator('#jump').click();
      const clicked = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, target: releaseState.amber.target }));
      assert.deepEqual(clicked, { path: '/tests/anchors-history', hash: '#target', target: 200 });
      await page.evaluate(() => {
        for (let time = 0; releaseState.amber.isScrolling && time < 10000; time += 1000 / 60) releaseState.amber.raf(time);
      });
      const settled = await page.evaluate(() => ({ position: releaseState.amber.position, opacity: +document.querySelector('#box').style.opacity,
        svgProgress: releaseState.svg.progress, shape: document.querySelector('#shape').getAttribute('d') }));
      assert.equal(settled.position, 200);
      assert.equal(settled.opacity, .5);
      assert.equal(settled.svgProgress, .5);
      assert.match(settled.shape, /15/);
      await page.goBack();
      await page.waitForFunction(() => location.hash === '' && releaseState.amber.position === 40);
      await page.evaluate(() => releaseRouter.navigateByUrl('/other'));
      await page.locator('#other').waitFor();
      assert.deepEqual(await page.evaluate(() => destroyedReleaseState), { amber: true, animation: true, svg: true });
      await page.evaluate(() => releaseRouter.navigateByUrl('/tests/anchors-history'));
      await page.waitForFunction(() => !releaseState.amber.isDestroyed && document.querySelector('#viewport'));
      assert.deepEqual(errors, []);
      report.browsers[name] = 'passed: nested-route anchors, Back restoration, Motion/SVG, route teardown/remount';
      console.log(`${name}: packed Angular integration passed`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
const output = join(root, '.release/smoke-report.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
