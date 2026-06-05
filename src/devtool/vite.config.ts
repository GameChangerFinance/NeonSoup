import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function devIntentMiddleware() {
  return {
    name: 'neonsoup-dev-intents',
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

export default defineConfig({
  root: 'src/devtool',
  envDir: '../..',
  plugins: [react(), devIntentMiddleware()],
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
  },
  server: {
    port: 8081,
  },
});
