import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dist = resolve(root, 'dist');

await Promise.all([
  rm(resolve(dist, 'frontend'), { recursive: true, force: true }),
  rm(resolve(dist, 'app'), { recursive: true, force: true }),
  rm(resolve(dist, 'devtool'), { recursive: true, force: true }),
  rm(resolve(dist, 'assets'), { recursive: true, force: true }),
  rm(resolve(dist, 'licenses'), { recursive: true, force: true }),
  rm(resolve(dist, 'index.html'), { force: true }),
  rm(resolve(dist, 'landing.css'), { force: true }),
  rm(resolve(dist, 'p2p-soup-fluid-separator.css'), { force: true }),
  rm(resolve(dist, 'p2p-soup-fluid-separator.js'), { force: true }),
  rm(resolve(dist, '_redirects'), { force: true }),
  rm(resolve(dist, '.htaccess'), { force: true }),
]);
