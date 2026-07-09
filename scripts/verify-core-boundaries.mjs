import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const coreDir = join(root, 'src/core');

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
    else if (entry.isFile() && path.endsWith('.ts')) out.push(path);
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

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
