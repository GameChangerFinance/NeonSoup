import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import sharp from 'sharp';
import {
  getGeneratedSiblingPaths,
  getRuntimeAssetOutputs,
  isImage,
  rawAssetRoot,
  runtimeAssetRoot,
  toAssetPath,
} from './asset-policy.mjs';

const runtimeAssetsReadme = `# Runtime Assets

This directory contains optimized runtime assets generated from the raw source files in \`assets/\`.

Regenerate these files with:

\`\`\`bash
pnpm run assets:optimize
\`\`\`

Do not edit generated optimized runtime assets by hand when the raw source in \`assets/\` is the intended source of truth; regenerate via the dev-only optimizer.
`;

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

async function hasMeaningfulAlpha(path) {
  const metadata = await sharp(path).metadata();
  if (!metadata.hasAlpha) return false;
  const alphaStats = await sharp(path).ensureAlpha().extractChannel('alpha').stats();
  return (alphaStats.channels[0]?.min ?? 255) < 255;
}

async function encodeImage(inputPath, output, sourceHasMeaningfulAlpha) {
  const image = sharp(inputPath);

  if (output.format === 'avif') {
    const pipeline = sourceHasMeaningfulAlpha ? image : image.removeAlpha();
    return pipeline.avif({ quality: 45, effort: 7 }).toBuffer();
  }

  if (output.format === 'jpeg') {
    const pipeline = sourceHasMeaningfulAlpha
      ? image.flatten({ background: output.flattenBackground || '#ffffff' })
      : image.removeAlpha();
    return pipeline.jpeg({ quality: 78, mozjpeg: true, progressive: true }).toBuffer();
  }

  if (output.format === 'webp') {
    const quality = output.role === 'brand-webp' ? 86 : 78;
    return image.webp({ quality, effort: 6, alphaQuality: 90 }).toBuffer();
  }

  if (output.format === 'png') {
    return image.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
  }

  return readFile(inputPath);
}

async function writeOutput(inputPath, output, sourceSize, sourceHasMeaningfulAlpha) {
  const outputPath = resolve(runtimeAssetRoot, output.relativePath);
  await mkdir(dirname(outputPath), { recursive: true });

  if (!isImage(inputPath) || output.format === 'copy') {
    await cp(inputPath, outputPath);
    return { outputPath, outputSize: (await stat(outputPath)).size };
  }

  if (output.expectOpaqueSource && sourceHasMeaningfulAlpha) {
    throw new Error(`${toAssetPath(relative(rawAssetRoot, inputPath))} was expected to be opaque but contains transparent pixels`);
  }

  const buffer = await encodeImage(inputPath, output, sourceHasMeaningfulAlpha);
  if (!output.compatibilityFallback && output.minSavingsRatio) {
    const maxSize = Math.floor(sourceSize * (1 - output.minSavingsRatio));
    if (buffer.length > maxSize) {
      throw new Error(
        `${output.relativePath} is not meaningfully smaller than source (${buffer.length} bytes > ${maxSize} byte target)`,
      );
    }
  }

  await writeFile(outputPath, buffer);
  return { outputPath, outputSize: buffer.length };
}

async function removeCoveredGeneratedSiblings(sourceRelativePath) {
  for (const sibling of getGeneratedSiblingPaths(sourceRelativePath)) {
    await rm(resolve(runtimeAssetRoot, sibling), { force: true });
  }
}

async function optimizeSourceAssets() {
  if (!(await pathExists(rawAssetRoot))) {
    throw new Error('Missing raw asset directory: assets/');
  }

  await mkdir(runtimeAssetRoot, { recursive: true });
  const files = await listFiles(rawAssetRoot);
  let outputCount = 0;
  let totalSourceBytes = 0;
  let totalOutputBytes = 0;

  for (const file of files) {
    const sourceRelativePath = toAssetPath(relative(rawAssetRoot, file));
    const sourceSize = (await stat(file)).size;
    const sourceHasMeaningfulAlpha = isImage(file) ? await hasMeaningfulAlpha(file) : false;
    const outputs = getRuntimeAssetOutputs(sourceRelativePath);

    await removeCoveredGeneratedSiblings(sourceRelativePath);

    for (const output of outputs) {
      const result = await writeOutput(file, output, sourceSize, sourceHasMeaningfulAlpha);
      outputCount += 1;
      totalSourceBytes += sourceSize;
      totalOutputBytes += result.outputSize;
      const savings = sourceSize > 0 ? Math.round((1 - result.outputSize / sourceSize) * 100) : 0;
      console.log(
        `${sourceRelativePath} -> ${output.relativePath} (${output.role}, ${sourceSize} -> ${result.outputSize} bytes, ${savings}% saved)`,
      );
    }
  }

  await writeFile(resolve(runtimeAssetRoot, 'README.md'), runtimeAssetsReadme);
  console.log(
    `Optimized ${files.length} source assets into ${outputCount} runtime files (${totalSourceBytes} -> ${totalOutputBytes} bytes).`,
  );
}

optimizeSourceAssets().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
