import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadEnv } from 'vite';

const root = resolve(new URL('..', import.meta.url).pathname);
const source = resolve(root, 'src/landing/index.html');
const target = resolve(root, 'dist/index.html');

function getGoogleAnalyticsId() {
  const env = loadEnv('production', root, '');
  const configuredId = env.NEONSOUP_GOOGLE_ANALYTICS_ID?.trim() || '';

  if (!/^[A-Z0-9-]+$/.test(configuredId)) return '';
  return configuredId;
}

function renderGoogleAnalytics(measurementId) {
  if (!measurementId) return '';
  return `    <script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', ${JSON.stringify(measurementId)});
    </script>
`;
}

function normalizeLandingHtmlForDist(html) {
  return html
    .replaceAll('href="./styles.css"', 'href="/landing.css"')
    .replaceAll('href="./p2p-soup-fluid-separator.css"', 'href="/p2p-soup-fluid-separator.css"')
    .replaceAll('src="./p2p-soup-fluid-separator.js"', 'src="/p2p-soup-fluid-separator.js"')
    .replaceAll('href="../assets/', 'href="/assets/')
    .replaceAll('src="../assets/', 'src="/assets/')
    .replaceAll('content="../assets/', 'content="/assets/');
}

function normalizeLandingAssetPathsForDist(sourceText) {
  return sourceText.replaceAll('../assets/', '/assets/');
}

await mkdir(dirname(target), { recursive: true });
const googleAnalytics = renderGoogleAnalytics(getGoogleAnalyticsId());
const html = normalizeLandingHtmlForDist(await readFile(source, 'utf8'));
await writeFile(target, googleAnalytics ? html.replace('  </head>', `${googleAnalytics}  </head>`) : html);
await copyFile(resolve(root, 'src/landing/_redirects'), resolve(root, 'dist/_redirects'));
await copyFile(resolve(root, 'src/landing/.htaccess'), resolve(root, 'dist/.htaccess'));
await writeFile(
  resolve(root, 'dist/landing.css'),
  normalizeLandingAssetPathsForDist(await readFile(resolve(root, 'src/landing/styles.css'), 'utf8')),
);
await copyFile(resolve(root, 'src/landing/p2p-soup-fluid-separator.css'), resolve(root, 'dist/p2p-soup-fluid-separator.css'));
await writeFile(
  resolve(root, 'dist/p2p-soup-fluid-separator.js'),
  normalizeLandingAssetPathsForDist(await readFile(resolve(root, 'src/landing/p2p-soup-fluid-separator.js'), 'utf8')),
);
