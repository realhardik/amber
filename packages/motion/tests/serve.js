import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { '.js': 'text/javascript', '.html': 'text/html' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname}`);
    if (!path.startsWith(root) || path.slice(root.length).split(sep).some(part => part.startsWith('.') || part === 'node_modules')) {
      response.writeHead(403).end(); return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'text/plain', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
}).listen(4174, '127.0.0.1');
