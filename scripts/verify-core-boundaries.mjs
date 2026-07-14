import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const coreDir = join(root, 'src/core');
const commonDir = join(root, 'src/common');
const devtoolDir = join(root, 'src/devtool');
const frontendDir = join(root, 'src/frontend');

const forbiddenImportPatterns = [
  /from\s+['"]react(?:\/[^'"]*)?['"]/,
  /from\s+['"]react-dom(?:\/[^'"]*)?['"]/,
  /from\s+['"]bootstrap(?:\/[^'"]*)?['"]/,
  /from\s+['"][^'"]*components[^'"]*['"]/,
  /from\s+['"][^'"]*styles[^'"]*['"]/,
  /from\s+['"][^'"]*\.css['"]/,
  /from\s+['"][^'"]*state\/appState['"]/,
  /from\s+['"][^'"]*devtool[^'"]*['"]/,
  /import\s+['"][^'"]*\.css['"]/,
];

const forbiddenRuntimePatterns = [
  /\bwindow\./,
  /\bdocument\./,
  /\blocalStorage\b/,
  /\bhistory\./,
  /\bwindow\.open\b/,
  /\bwindow\.location\b/,
  /\bdocument\.addEventListener\b/,
];

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(path));
    else if (entry.isFile() && (path.endsWith('.ts') || path.endsWith('.tsx'))) out.push(path);
  }
  return out;
}

const failures = [];

for (const file of await files(coreDir)) {
  const source = await readFile(file, 'utf8');
  const rel = relative(root, file);
  [...forbiddenImportPatterns, ...forbiddenRuntimePatterns].forEach((pattern) => {
    if (pattern.test(source)) failures.push(`${rel}: forbidden core dependency or runtime API: ${pattern}`);
  });
}

async function checkUiBoundary(dir, forbiddenPatterns) {
  try {
    for (const file of await files(dir)) {
      const source = await readFile(file, 'utf8');
      const rel = relative(root, file);
      forbiddenPatterns.forEach((pattern) => {
        if (pattern.test(source)) failures.push(`${rel}: forbidden UI boundary dependency: ${pattern}`);
      });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await checkUiBoundary(commonDir, [/from\s+['"][^'"]*devtool[^'"]*['"]/, /from\s+['"][^'"]*frontend[^'"]*['"]/]);
await checkUiBoundary(devtoolDir, [/from\s+['"][^'"]*frontend[^'"]*['"]/]);
await checkUiBoundary(frontendDir, [/from\s+['"][^'"]*devtool[^'"]*['"]/]);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
