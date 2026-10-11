import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const path = resolve(root, `.${pathname === "/" ? "/tests/fixtures/index.html" : pathname}`);
    const relative = path.slice(root.length);
    if (!path.startsWith(root) || relative.split(sep).some(part => part.startsWith(".") || part === "node_modules")) {
      response.writeHead(403).end("Forbidden"); return;
    }
    if (!(await stat(path)).isFile()) { response.writeHead(404).end("Not found"); return; }
    response.writeHead(200, { "Content-Type": `${types[extname(path)] ?? "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store" });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Amber development fixture: http://127.0.0.1:${port}`));
