import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(root, 'dist');
const port = Number(process.env.PORT || 8081);
const host = process.env.HOST || '127.0.0.1';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendFile(response, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

function staticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^(\.\.(?:\/|\\|$))+/, '');
  const filePath = resolve(join(dist, normalized));
  return filePath.startsWith(`${dist}${sep}`) || filePath === dist ? filePath : null;
}

function resolveRequest(pathname) {
  if (pathname === '/favicon.ico') return resolve(dist, 'assets/logo/favicon.png');

  const direct = staticPath(pathname);
  if (direct && existsSync(direct)) {
    const stat = statSync(direct);
    if (stat.isFile()) return direct;
    if (stat.isDirectory()) {
      const index = resolve(direct, 'index.html');
      if (existsSync(index)) return index;
    }
  }

  if (pathname.startsWith('/app/')) return resolve(dist, 'app/index.html');
  if (pathname.startsWith('/devtool/')) return resolve(dist, 'devtool/index.html');
  return resolve(dist, 'index.html');
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }

  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    const filePath = resolveRequest(url.pathname);
    if (request.method === 'HEAD') {
      response.writeHead(existsSync(filePath) ? 200 : 404);
      response.end();
      return;
    }
    sendFile(response, filePath);
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${dist} at http://${host}:${port}/`);
});

server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
