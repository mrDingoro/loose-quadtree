import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const demo = fileURLToPath(new URL('../demo/', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  let path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname));
  if (path.endsWith('/')) {
    path += 'index.html';
  }
  const file = path.startsWith('/lib/') ? join(dist, path.slice(5)) : join(demo, path);
  if (!file.startsWith(demo) && !file.startsWith(dist)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(8080, () => console.log('Демо: http://localhost:8080'));
