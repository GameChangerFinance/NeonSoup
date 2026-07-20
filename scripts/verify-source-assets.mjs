import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import {
  distAssetRoot,
  distRoot,
  getRuntimeAssetOutputs,
  imageExtensions,
  isImage,
  isRaster,
  rawAssetRoot,
  root,
  runtimeAssetRoot,
  toAssetPath,
} from './asset-policy.mjs';

const staticAssetReferencePatterns = [
  /(?:\.\.\/assets|\/assets)\/[A-Za-z0-9._/-]+\.(?:avif|gif|ico|jpe?g|png|svg|webp)/g,
  /\$\{ASSET_BASE\}\/[A-Za-z0-9._/-]+\.(?:avif|gif|ico|jpe?g|png|svg|webp)/g,
];
const sourceReferenceRoots = ['src/landing', 'src/frontend', 'src/devtool'];
const sourceReferenceExtensions = new Set(['.css', '.html', '.js', '.ts', '.tsx']);
const markdownReferenceRoots = ['README.md', 'docs'];
const markdownImageReferencePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const allowedDistImagePrefixes = [`assets${sep}`, `app${sep}assets${sep}`, `devtool${sep}assets${sep}`];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return listFiles(path);
      if (entry.isFile()) return [path];
      return [];
    }),
  );

  return nested.flat();
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function fileSize(path) {
  return (await stat(path)).size;
}

async function hasMeaningfulAlpha(path) {
  const metadata = await sharp(path).metadata();
  if (!metadata.hasAlpha) return false;
  const alphaStats = await sharp(path).ensureAlpha().extractChannel('alpha').stats();
  return (alphaStats.channels[0]?.min ?? 255) < 255;
}

async function expectedOutputMap() {
  const expected = new Map();
  const rawFiles = await listFiles(rawAssetRoot);

  for (const rawFile of rawFiles) {
    const sourceRelativePath = toAssetPath(relative(rawAssetRoot, rawFile));
    for (const output of getRuntimeAssetOutputs(sourceRelativePath)) {
      expected.set(output.relativePath, { rawFile, sourceRelativePath, output });
    }
  }

  return expected;
}

async function verifyExpectedOutputs(expected, failures) {
  for (const [relativePath, entry] of expected) {
    const outputPath = resolve(runtimeAssetRoot, relativePath);
    if (!(await pathExists(outputPath))) {
      failures.push(`missing runtime asset src/assets/${relativePath}`);
      continue;
    }

    if (!isRaster(entry.rawFile) || !isRaster(outputPath)) continue;

    const [sourceMetadata, outputMetadata, sourceSize, outputSize, sourceHasMeaningfulAlpha] = await Promise.all([
      sharp(entry.rawFile).metadata(),
      sharp(outputPath).metadata(),
      fileSize(entry.rawFile),
      fileSize(outputPath),
      hasMeaningfulAlpha(entry.rawFile),
    ]);

    if (sourceMetadata.width !== outputMetadata.width || sourceMetadata.height !== outputMetadata.height) {
      failures.push(
        `src/assets/${relativePath} changed dimensions from ${sourceMetadata.width}x${sourceMetadata.height} to ${outputMetadata.width}x${outputMetadata.height}`,
      );
    }

    if (entry.output.expectOpaqueSource && sourceHasMeaningfulAlpha) {
      failures.push(`${entry.sourceRelativePath} was expected to be opaque but contains transparent pixels`);
    }

    if (sourceHasMeaningfulAlpha && !outputMetadata.hasAlpha && !entry.output.allowAlphaFlatten) {
      failures.push(`src/assets/${relativePath} lost alpha channel`);
    }

    if (!entry.output.compatibilityFallback && entry.output.minSavingsRatio) {
      const maxSize = Math.floor(sourceSize * (1 - entry.output.minSavingsRatio));
      if (outputSize > maxSize) {
        failures.push(`src/assets/${relativePath} is not meaningfully smaller than source (${outputSize} > ${maxSize} bytes)`);
      }
    }
  }
}

async function verifyNoUnexpectedRuntimeImages(expected, failures) {
  if (!(await pathExists(runtimeAssetRoot))) return;
  const expectedPaths = new Set(expected.keys());
  const runtimeFiles = await listFiles(runtimeAssetRoot);

  for (const file of runtimeFiles.filter(isImage)) {
    const relativePath = toAssetPath(relative(runtimeAssetRoot, file));
    if (!expectedPaths.has(relativePath)) {
      failures.push(`unexpected runtime image src/assets/${relativePath}`);
    }
  }
}

async function verifyStaticAssetReferences(failures) {
  for (const referenceRoot of sourceReferenceRoots) {
    if (!(await pathExists(referenceRoot))) continue;
    const files = (await listFiles(referenceRoot)).filter((file) => sourceReferenceExtensions.has(extname(file).toLowerCase()));

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const matches = staticAssetReferencePatterns.flatMap((pattern) => source.match(pattern) || []);
      for (const match of matches) {
        const relativePath = match.replace(/^.*?(?:\/assets\/|ASSET_BASE\}\/)/, '');
        if (!(await pathExists(resolve(runtimeAssetRoot, relativePath)))) {
          failures.push(`${toAssetPath(file)} references missing runtime asset ${match}`);
        }
      }
    }
  }
}

async function listMarkdownFiles(path) {
  if (!(await pathExists(path))) return [];
  const pathStat = await stat(path);
  if (pathStat.isFile()) return extname(path).toLowerCase() === '.md' ? [path] : [];
  return (await listFiles(path)).filter((file) => extname(file).toLowerCase() === '.md');
}

async function verifyMarkdownImageReferences(failures) {
  const files = (await Promise.all(markdownReferenceRoots.map(listMarkdownFiles))).flat();

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const matches = [...source.matchAll(markdownImageReferencePattern)];
    for (const match of matches) {
      const imagePath = match[1] || '';
      if (/^(?:https?:|data:|#)/i.test(imagePath)) continue;

      const normalized = toAssetPath(imagePath.replace(/^\.\//, ''));
      if (!normalized.startsWith('src/assets/')) {
        failures.push(`${toAssetPath(file)} uses non-runtime Markdown image ${imagePath}`);
        continue;
      }

      const absolutePath = resolve(root, normalized);
      if (!(await pathExists(absolutePath))) {
        failures.push(`${toAssetPath(file)} references missing Markdown image ${imagePath}`);
      }
    }
  }
}

async function verifyDistImages(expected, failures) {
  if (!(await pathExists(distRoot))) return;

  const distFiles = await listFiles(distRoot);
  for (const file of distFiles.filter((candidate) => imageExtensions.has(extname(candidate).toLowerCase()))) {
    const relativePath = relative(distRoot, file);
    if (!allowedDistImagePrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      failures.push(`unapproved dist image output ${toAssetPath(relativePath)}`);
    }
  }

  if (!(await pathExists(distAssetRoot))) return;

  const expectedPaths = new Set(expected.keys());
  const distAssetFiles = (await listFiles(distAssetRoot)).filter(isImage);
  for (const file of distAssetFiles) {
    const relativePath = toAssetPath(relative(distAssetRoot, file));
    if (!expectedPaths.has(relativePath)) {
      failures.push(`unexpected dist asset image dist/assets/${relativePath}`);
    }
  }
}

const failures = [];
const expected = await expectedOutputMap();
await verifyExpectedOutputs(expected, failures);
await verifyNoUnexpectedRuntimeImages(expected, failures);
await verifyStaticAssetReferences(failures);
await verifyMarkdownImageReferences(failures);
await verifyDistImages(expected, failures);

if (failures.length > 0) {
  console.error(`Source asset verification failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}

console.log(`Source asset verification passed for ${expected.size} runtime assets.`);
