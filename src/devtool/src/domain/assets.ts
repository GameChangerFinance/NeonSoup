import { APP_CONFIG } from '../config/appConfig';
import type { AssetMetadata, NetworkTag, PortfolioAsset, ResolvedAsset } from '../state/types';
import {
  defaultMinExecutableOfferQuantity,
  defaultMinMakerRemainderQuantity,
  normalizeBaseUnitQuantity,
} from './assetPolicy';
import { short, truncate } from './text';

export function assetIdOf(policyId: string, assetNameHex: string): string {
  return policyId === 'ada' && assetNameHex === 'ada' ? 'lovelace' : `${policyId}${assetNameHex}`;
}

export function assetKeyOf(policyId: string, assetNameHex: string): string {
  return `${policyId}.${assetNameHex}`;
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
  const policyId = asset.policyId || 'ada';
  const rawAssetNameHex = asset.assetNameHex ?? asset.assetName ?? (policyId === 'ada' ? 'ada' : '');
  const assetNameHex = policyId === 'ada' && (!rawAssetNameHex || rawAssetNameHex === 'lovelace') ? 'ada' : rawAssetNameHex;
  const assetId = asset.assetId || assetIdOf(policyId, assetNameHex);
  const decimalsKnown = asset.decimalsKnown ?? Number.isFinite(asset.decimals);
  const decimals = decimalsKnown ? Math.max(0, Math.trunc(asset.decimals)) : 0;
  return {
    ...asset,
    policyId,
    assetNameHex,
    assetId,
    assetKey: assetKeyOf(policyId, assetNameHex),
    label: assetLabel(asset),
    ticker: normalizeTicker(asset.ticker || asset.label),
    description: assetDescription(asset),
    decimals,
    decimalsKnown,
    minExecutableOfferQuantity: normalizeBaseUnitQuantity(
      asset.minExecutableOfferQuantity,
      defaultMinExecutableOfferQuantity(policyId, assetNameHex, decimals),
    ),
    minMakerRemainderQuantity: normalizeBaseUnitQuantity(
      asset.minMakerRemainderQuantity,
      defaultMinMakerRemainderQuantity(policyId, assetNameHex, decimals),
    ),
    logo: normalizeLogo(asset.logo),
    known: asset.known ?? true,
  };
}

export function normalizeAssetRecord(assets: Record<string, AssetMetadata>): Record<string, ResolvedAsset> {
  const normalizedAssets: Record<string, ResolvedAsset> = {};
  for (const [sourceKey, asset] of Object.entries(assets)) {
    const normalized = normalizeAssetMetadata({ ...asset, known: asset.known ?? true });
    if (normalizedAssets[normalized.assetKey]) {
      throw new Error(`Duplicate asset definition for ${normalized.assetKey} from ${sourceKey}.`);
    }
    normalizedAssets[normalized.assetKey] = normalized;
  }
  return normalizedAssets;
}

export function normalizeAssetMetadataRecord(assets: Record<string, AssetMetadata>): Record<string, AssetMetadata> {
  return Object.fromEntries(
    Object.values(assets).map((asset) => {
      const normalized = normalizeAssetMetadata(asset);
      const { assetKey: _assetKey, ...metadata } = normalized;
      return [normalized.assetKey, metadata];
    }),
  );
}

export function configuredAssets(
  networkTag: NetworkTag,
  overrides: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>,
): Record<string, ResolvedAsset> {
  const network = APP_CONFIG.networks[networkTag];
  const merged = { ...network.assets, ...(overrides[networkTag] || {}) };
  return normalizeAssetRecord(merged);
}

export function hardAsset(
  networkTag: NetworkTag,
  overrides: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>,
  policyId: string,
  assetNameHex: string,
): ResolvedAsset {
  const configured = configuredAssets(networkTag, overrides)[assetKeyOf(policyId, assetNameHex)];
  if (configured) return configured;
  return normalizeAssetMetadata({
    policyId,
    assetNameHex,
    label: policyId === 'ada' ? 'ADA' : short(assetNameHex || policyId, 8, 4),
    ticker: policyId === 'ada' ? 'ADA' : '',
    decimals: policyId === 'ada' ? 6 : 0,
    decimalsKnown: policyId === 'ada',
    known: policyId === 'ada',
  });
}

export function applyFetchedMetadata(base: ResolvedAsset, fetched: unknown): ResolvedAsset {
  if (!fetched || typeof fetched !== 'object') return base;
  const record = fetched as Record<string, unknown>;
  const metadata =
    (record.metadata && typeof record.metadata === 'object' ? record.metadata : undefined) ||
    (record.onchain_metadata && typeof record.onchain_metadata === 'object' ? record.onchain_metadata : undefined) ||
    record;
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
    decimalsKnown: base.known || Number.isFinite(decimals) || Boolean(base.decimalsKnown),
    logo: base.logo || normalizeLogo(m.logo || m.image),
  };
}

export function normalizePortfolioAssets(assets: readonly PortfolioAsset[]): PortfolioAsset[] {
  const quantities = new Map<string, bigint>();
  const normalized = new Map<string, PortfolioAsset>();
  assets.forEach((asset) => {
    const item = normalizeAssetMetadata(asset);
    quantities.set(item.assetKey, (quantities.get(item.assetKey) || 0n) + BigInt(asset.quantity || '0'));
    normalized.set(item.assetKey, { ...item, quantity: '0' });
  });
  return [...normalized.values()]
    .map((asset) => ({ ...asset, quantity: (quantities.get(asset.assetKey) || 0n).toString() }))
    .sort((a, b) => a.assetKey.localeCompare(b.assetKey));
}
