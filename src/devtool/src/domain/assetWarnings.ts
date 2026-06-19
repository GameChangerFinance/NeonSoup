import type { ResolvedAsset } from '../state/types';

export function assetMetadataWarnings(asset: ResolvedAsset | undefined): string[] {
  if (!asset) return [];
  const warnings: string[] = [];
  if (asset.known === false) warnings.push('fallback metadata');
  if (asset.registered === false) warnings.push('unregistered asset');
  if (asset.decimalsKnown === false) warnings.push('precision unknown');
  return warnings;
}

export function assetMetadataWarningText(asset: ResolvedAsset | undefined): string {
  const warnings = assetMetadataWarnings(asset);
  return warnings.length ? `Warning: ${warnings.join(', ')}. Amounts may need manual verification.` : '';
}
