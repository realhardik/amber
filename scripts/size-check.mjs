import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const config = {
  amber: { directory: 'amber', maximumGzipBytes: 24_000 },
  motion: { directory: 'motion', maximumGzipBytes: 8_000 },
};
const selected = process.argv[2];
const packageConfig = config[selected];
if (!packageConfig) throw new Error('Usage: node scripts/size-check.mjs <amber|motion>');

const root = join(import.meta.dirname, '..', 'packages', packageConfig.directory, 'dist');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}

const source = Buffer.concat(files(root).sort().map(file => readFileSync(file)));
const gzipBytes = gzipSync(source, { level: 9 }).length;
console.log(`${selected}: ${source.length} minified bytes / ${gzipBytes} gzip bytes (budget ${packageConfig.maximumGzipBytes})`);
if (gzipBytes > packageConfig.maximumGzipBytes) {
  throw new Error(`${selected} exceeds its gzip budget by ${gzipBytes - packageConfig.maximumGzipBytes} bytes.`);
}
