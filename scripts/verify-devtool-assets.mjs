import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;
const assetsPath = join(repoRoot, 'src/devtool/src/config/assets.ts');
const sourceRoot = join(repoRoot, 'src/devtool/src');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

function field(block, name) {
  const match = block.match(new RegExp(`${name}: '([^']*)'`));
  return match?.[1] || '';
}

const assetsSource = readFileSync(assetsPath, 'utf8');
const entryPattern = /^  '([^']+)': \{([\s\S]*?)^  \},/gm;
const seen = new Set();
let checked = 0;
let match;

while ((match = entryPattern.exec(assetsSource))) {
  const [, key, block] = match;
  const preprodIndex = assetsSource.lastIndexOf('export const PREPROD_ASSETS', match.index);
  const mainnetIndex = assetsSource.lastIndexOf('export const MAINNET_ASSETS', match.index);
  const network = mainnetIndex > preprodIndex ? 'mainnet' : 'preprod';
  const policyId = field(block, 'policyId');
  const assetNameHex = field(block, 'assetNameHex');
  const expected = `${policyId}.${assetNameHex}`;
  const networkKey = `${network}:${expected}`;

  if (!policyId) throw new Error(`${key} is missing policyId`);
  if (assetNameHex === undefined) throw new Error(`${key} is missing assetNameHex`);
  if (key !== expected) throw new Error(`${key} must be keyed as ${expected}`);
  if (seen.has(networkKey)) throw new Error(`Duplicate ${network} asset key ${expected}`);
  seen.add(networkKey);
  checked += 1;
}

if (!seen.has('preprod:ada.ada') || !seen.has('mainnet:ada.ada')) {
  throw new Error('ADA must be keyed as ada.ada on every network');
}
if (checked < 10) throw new Error(`Only checked ${checked} asset definitions`);

for (const path of walk(sourceRoot)) {
  const source = readFileSync(path, 'utf8');
  const oldProviderName = ['u', 'n', 'i', 't'].join('');
  const oldProviderTitle = `${oldProviderName[0].toUpperCase()}${oldProviderName.slice(1)}`;
  const oldProviderPattern = new RegExp(
    `\\\\b${oldProviderName}\\\\b|\\\\b${oldProviderTitle}\\\\b|\\\\.${oldProviderName}\\\\b|${oldProviderName}Of`,
  );
  if (oldProviderPattern.test(source)) {
    throw new Error(`Forbidden provider field name found in ${path}`);
  }
}

console.log(`Verified ${checked} canonical asset definitions.`);
