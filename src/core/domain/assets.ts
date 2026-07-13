import type { AssetMetadata } from '../types';

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

export function assetIdOf(policyId: string, assetNameHex: string): string {
  return policyId === 'ada' && assetNameHex === 'ada' ? 'lovelace' : `${policyId}${assetNameHex}`;
}

export function assetKeyOf(policyId: string, assetNameHex: string): string {
  return `${policyId}.${assetNameHex}`;
}

export function assetTitle(asset: Pick<AssetMetadata, 'ticker' | 'label'>): string {
  return truncate(asset.ticker || asset.label || 'Unknown', 32);
}
