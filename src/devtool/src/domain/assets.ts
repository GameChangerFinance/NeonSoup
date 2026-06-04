import { APP_CONFIG } from '../config/appConfig';
import type { AssetMetadata, NetworkTag, ResolvedAsset } from '../state/types';
import { short, truncate } from './text';

export function unitOf(policyId: string, assetNameHex: string): string {
  return policyId === 'ada' && assetNameHex === 'ada' ? 'lovelace' : `${policyId}${assetNameHex}`;
}

export function assetKeyOf(policyId: string, assetNameHex: string): string {
  return policyId === 'ada' && assetNameHex === 'ada' ? 'ada' : `${policyId}.${assetNameHex}`;
}

export function assetTitle(asset: Pick<AssetMetadata, 'ticker' | 'label'>): string {
  return truncate(asset.ticker || asset.label || 'Unknown', 32);
}

export function assetLabel(asset: Partial<AssetMetadata>): string {
  return truncate(asset.label || asset.ticker || 'Unknown', 80);
}

export function assetDescription(asset: Partial<AssetMetadata>): string {
  return truncate(asset.description || '', 300);
}

export function normalizeTicker(value: unknown, fallback = ''): string {
  return truncate(typeof value === 'string' ? value : fallback, 32);
}

export function normalizeLogo(value: unknown): string {
  const logo = typeof value === 'string' ? value.trim() : '';
  if (!logo) return '';
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(logo)) return logo;
  if (/^https:\/\/[^\s"'<>]+$/i.test(logo)) return logo;
  if (/^ipfs:\/\/[a-z0-9/._-]+$/i.test(logo)) {
    return `https://ipfs.io/ipfs/${logo.slice('ipfs://'.length)}`;
  }
  if (/^[a-z0-9+/=\s]+$/i.test(logo) && logo.length < 200000) return `data:image/png;base64,${logo}`;
  return '';
}

export function normalizeAssetMetadata(asset: AssetMetadata): ResolvedAsset {
  const assetNameHex = asset.assetNameHex || asset.assetName || '';
  const policyId = asset.policyId || 'ada';
  const unit = unitOf(policyId, assetNameHex);
  return {
    ...asset,
    policyId,
    assetNameHex,
    assetId: asset.assetId || unit,
    assetKey: assetKeyOf(policyId, assetNameHex),
    unit,
    label: assetLabel(asset),
    ticker: normalizeTicker(asset.ticker || asset.label),
    description: assetDescription(asset),
    decimals: Number.isFinite(asset.decimals) ? Math.max(0, Math.trunc(asset.decimals)) : 0,
    logo: normalizeLogo(asset.logo),
    known: asset.known ?? true,
  };
}

export function configuredAssets(
  networkTag: NetworkTag,
  overrides: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>,
): Record<string, ResolvedAsset> {
  const network = APP_CONFIG.networks[networkTag];
  const merged = { ...network.assets, ...(overrides[networkTag] || {}) };
  return Object.fromEntries(
    Object.entries(merged).map(([key, asset]) => [key, normalizeAssetMetadata({ ...asset, known: true })]),
  );
}

export function hardAsset(
  networkTag: NetworkTag,
  overrides: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>,
  policyId: string,
  assetNameHex: string,
): ResolvedAsset {
  const configured = Object.values(configuredAssets(networkTag, overrides)).find(
    (asset) => asset.policyId === policyId && asset.assetNameHex === assetNameHex,
  );
  if (configured) return configured;
  return normalizeAssetMetadata({
    policyId,
    assetNameHex,
    label: policyId === 'ada' ? 'ADA' : short(assetNameHex || policyId, 8, 4),
    ticker: policyId === 'ada' ? 'ADA' : '',
    decimals: policyId === 'ada' ? 6 : 0,
    known: policyId === 'ada',
  });
}

export function applyFetchedMetadata(base: ResolvedAsset, fetched: unknown): ResolvedAsset {
  if (!fetched || typeof fetched !== 'object') return base;
  const record = fetched as Record<string, unknown>;
  const metadata =
    (record.metadata && typeof record.metadata === 'object' ? record.metadata : undefined) ||
    (record.onchain_metadata && typeof record.onchain_metadata === 'object' ? record.onchain_metadata : undefined);
  if (!metadata || typeof metadata !== 'object') {
    return {
      ...base,
      ...(typeof record.fingerprint === 'string' ? { fingerprint: record.fingerprint } : {}),
    };
  }
  const m = metadata as Record<string, unknown>;
  const decimals = Number(m.decimals);
  return {
    ...base,
    ...(typeof record.fingerprint === 'string' ? { fingerprint: record.fingerprint } : {}),
    registered: Boolean(record.metadata),
    label: base.known
      ? base.label
      : assetLabel({
          ...(typeof m.name === 'string' ? { label: m.name } : {}),
          ...(typeof m.ticker === 'string' ? { ticker: m.ticker } : {}),
        }),
    ticker: base.known ? base.ticker : normalizeTicker(m.ticker || m.name, base.ticker),
    description:
      base.description ||
      assetDescription({
        ...(typeof m.description === 'string' ? { description: m.description } : {}),
      }),
    decimals: base.known ? base.decimals : Number.isFinite(decimals) ? Math.max(0, Math.trunc(decimals)) : base.decimals,
    logo: base.logo || normalizeLogo(m.logo || m.image),
  };
}
