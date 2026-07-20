import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

function googleAnalyticsPlugin(measurementId: string) {
  return {
    name: 'neonsoup-google-analytics',
    transformIndexHtml() {
      if (!measurementId) return [];
      return [
        {
          tag: 'script',
          attrs: {
            async: true,
            src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
          },
          injectTo: 'head',
        },
        {
          tag: 'script',
          children: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)});
`,
          injectTo: 'head',
        },
      ];
    },
  };
}

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

const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function devSharedAssetsMiddleware() {
  return {
    name: 'neonsoup-dev-shared-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url || '';
        if (!url.startsWith('/assets/')) {
          next();
          return;
        }
        const fileName = decodeURIComponent(url.slice('/assets/'.length).split('?')[0] || '');
        if (!fileName || fileName.includes('..') || fileName.startsWith('/')) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        try {
          const file = await readFile(resolve(process.cwd(), 'src/assets', fileName));
          response.setHeader('content-type', ASSET_CONTENT_TYPES[extname(fileName).toLowerCase()] || 'application/octet-stream');
          response.end(file);
        } catch {
          response.statusCode = 404;
          response.end('Asset not found');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = resolve(process.cwd());
  const env = loadEnv(mode, envDir, '');
  const configuredGoogleAnalyticsId = env.NEONSOUP_GOOGLE_ANALYTICS_ID?.trim() || '';
  const googleAnalyticsId = /^[A-Z0-9-]+$/.test(configuredGoogleAnalyticsId) ? configuredGoogleAnalyticsId : '';

  return {
    root: 'src/devtool',
    base: mode === 'production' ? '/devtool/' : '/',
    envDir,
    plugins: [react(), googleAnalyticsPlugin(googleAnalyticsId), devIntentMiddleware(), devSharedAssetsMiddleware()],
    build: {
      target: 'esnext',
      outDir: '../../dist/devtool',
      emptyOutDir: true,
    },
    server: {
      port: 8081,
    },
  };
});
