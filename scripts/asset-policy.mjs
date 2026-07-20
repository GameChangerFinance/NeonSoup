import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const rawAssetRoot = resolve(root, 'assets');
export const runtimeAssetRoot = resolve(root, 'src/assets');
export const distRoot = resolve(root, 'dist');
export const distAssetRoot = resolve(root, 'dist/assets');

export const imageExtensions = new Set(['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
export const rasterExtensions = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp']);
export const generatedExtensions = ['.avif', '.jpeg', '.jpg', '.png', '.webp'];

export function toAssetPath(path) {
  return path.split(/[\\/]+/).join('/');
}

function replaceExtension(path, extension) {
  return `${path.slice(0, -extname(path).length)}${extension}`;
}

export function isImage(path) {
  return imageExtensions.has(extname(path).toLowerCase());
}

export function isRaster(path) {
  return rasterExtensions.has(extname(path).toLowerCase());
}

export function getRuntimeAssetOutputs(sourceRelativePath) {
  const sourcePath = toAssetPath(sourceRelativePath);
  const extension = extname(sourcePath).toLowerCase();

  if (!isImage(sourcePath)) {
    return [{ relativePath: sourcePath, format: 'copy', role: 'copy' }];
  }

  if (sourcePath === 'images/dark-bg.png') {
    return [
      {
        relativePath: replaceExtension(sourcePath, '.jpg'),
        format: 'jpeg',
        role: 'background-jpeg',
        flattenBackground: '#120a22',
        allowAlphaFlatten: true,
        minSavingsRatio: 0.35,
      },
    ];
  }

  if (sourcePath === 'images/light-bg.png') {
    return [
      {
        relativePath: replaceExtension(sourcePath, '.jpg'),
        format: 'jpeg',
        role: 'background-jpeg',
        flattenBackground: '#f7fff8',
        allowAlphaFlatten: true,
        minSavingsRatio: 0.35,
      },
    ];
  }

  if (sourcePath === 'logo/favicon.png') {
    return [
      {
        relativePath: sourcePath,
        format: 'png',
        role: 'favicon-png',
        compatibilityFallback: true,
      },
    ];
  }

  if (sourcePath === 'logo/logo.png' || sourcePath === 'logo/icon.png') {
    return [
      {
        relativePath: sourcePath,
        format: 'png',
        role: 'compatibility-png',
        compatibilityFallback: true,
      },
      {
        relativePath: replaceExtension(sourcePath, '.webp'),
        format: 'webp',
        role: 'brand-webp',
        minSavingsRatio: 0.08,
      },
    ];
  }

  if (extension === '.png' || extension === '.jpg' || extension === '.jpeg' || extension === '.webp') {
    return [
      {
        relativePath: replaceExtension(sourcePath, '.webp'),
        format: 'webp',
        role: 'transparent-art',
        minSavingsRatio: 0.08,
      },
    ];
  }

  return [{ relativePath: sourcePath, format: 'copy', role: 'copy' }];
}

export function getGeneratedSiblingPaths(sourceRelativePath) {
  const sourcePath = toAssetPath(sourceRelativePath);
  const extension = extname(sourcePath);
  if (!extension) return [sourcePath];

  const stem = sourcePath.slice(0, -extension.length);
  return generatedExtensions.map((generatedExtension) => `${stem}${generatedExtension}`);
}
