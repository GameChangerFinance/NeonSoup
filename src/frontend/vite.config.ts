import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function devIntentMiddleware() {
  return {
    name: 'neonsoup-frontend-intents',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url || '';
        if (!url.startsWith('/intents/')) {
          next();
          return;
        }
        const fileName = decodeURIComponent(url.slice('/intents/'.length).split('?')[0] || '');
        if (!fileName.endsWith('.gcscript.json') || fileName.includes('..') || fileName.includes('/')) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        try {
          const file = await readFile(resolve(process.cwd(), 'dist/intents', fileName), 'utf8');
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(file);
        } catch {
          response.statusCode = 404;
          response.end('Intent not built');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = resolve(process.cwd());
  loadEnv(mode, envDir, '');

  return {
    root: 'src/frontend',
    envDir,
    plugins: [react(), devIntentMiddleware()],
    build: {
      outDir: '../../dist/frontend',
      emptyOutDir: true,
    },
    server: {
      port: 8082,
    },
  };
});
