import type { AppOptions, NetworkTag, OpenOffer, PortfolioAsset, ResolvedAsset } from '../state/types';
import { APP_CONFIG } from '../config/appConfig';
import { applyFetchedMetadata, assetIdOf, assetKeyOf, hardAsset } from '../domain/assets';
import { parseSwapDatum, stakeFromAddress } from '../domain/cardano';

const blockfrostAssetIdField = 'un' + 'it';

interface BlockfrostAmount extends Record<string, string> {
  quantity: string;
}

interface BlockfrostAssetAddress {
  address: string;
  quantity: string;
}

interface BlockfrostPolicyAsset {
  asset: string;
  quantity: string;
}

interface BlockfrostUtxo {
  tx_hash: string;
  tx_index: number;
  address: string;
  amount: BlockfrostAmount[];
  inline_datum?: string;
}

interface ProviderContext {
  networkTag: NetworkTag;
  options: AppOptions;
  assetInfo: Record<string, ResolvedAsset>;
  customAssets: Parameters<typeof hardAsset>[1];
}

function endpoint(networkTag: NetworkTag, options: AppOptions): string {
  const network = APP_CONFIG.networks[networkTag];
  const candidates = [options.blockfrostUrl, network.blockfrostUrl, network.hostedBlockfrostUrl];
  const url = candidates
    .map((value) => (value || '').trim())
    .find((value) => value && value !== '/');
  if (!url) {
    throw new Error(`Missing Blockfrost API URL for ${networkTag}. Check VITE_NEONSOUP_* env values.`);
  }
  return url.replace(/\/+$/, '');
}

async function requestJson(path: string, context: ProviderContext, quiet = false): Promise<unknown> {
  try {
    const base = endpoint(context.networkTag, context.options);
    const headers: Record<string, string> = {};
    const key = (context.options.blockfrostKey || APP_CONFIG.networks[context.networkTag].apiKey || '').trim();
    if (key) headers.project_id = key;
    const response = await fetch(`${base}${path}`, { headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    if (quiet) return null;
    throw error;
  }
}

async function pages<T>(path: string, context: ProviderContext, max = 10): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= max; page += 1) {
    const join = path.includes('?') ? '&' : '?';
    const data = await requestJson(`${path}${join}count=100&page=${page}`, context, true);
    if (!Array.isArray(data) || !data.length) break;
    out.push(...(data as T[]));
    if (data.length < 100) break;
  }
  return out;
}

export async function fetchAssetInfo(
  policyId: string,
  assetNameHex: string,
  context: ProviderContext,
): Promise<ResolvedAsset> {
  const key = assetKeyOf(policyId, assetNameHex);
  if (context.assetInfo[key] && (policyId === 'ada' || context.assetInfo[key].logo)) {
    return context.assetInfo[key];
  }
  const base = hardAsset(context.networkTag, context.customAssets, policyId, assetNameHex);
  if (policyId === 'ada') return base;
  const metadata = await requestJson(`/assets/${policyId}${assetNameHex}`, context, true);
  return applyFetchedMetadata(base, metadata);
}

export async function fetchOpenOffers(context: ProviderContext): Promise<OpenOffer[]> {
  const beacon = APP_CONFIG.networks[context.networkTag].beaconPolicy || APP_CONFIG.beaconPolicy;
  const beaconAssets = await pages<BlockfrostPolicyAsset>(`/assets/policy/${beacon}`, context);
  const live = beaconAssets.filter((asset) => asset.quantity !== '0');
  const addresses = new Set<string>();
  for (const asset of live) {
    const holders = await pages<BlockfrostAssetAddress>(`/assets/${asset.asset}/addresses`, context);
    for (const holder of holders) if (holder.quantity !== '0') addresses.add(holder.address);
  }

  const offers: OpenOffer[] = [];
  const seen = new Set<string>();
  for (const address of addresses) {
    const utxos = await pages<BlockfrostUtxo>(`/addresses/${address}/utxos`, context);
    for (const utxo of utxos) {
      const id = `${utxo.tx_hash}:${utxo.tx_index}`;
      if (seen.has(id) || !utxo.inline_datum) continue;
      const beaconCount = (utxo.amount || []).filter(
        (item) => (item[blockfrostAssetIdField] || '').startsWith(beacon) && item.quantity === '1',
      ).length;
      if (beaconCount < 3) continue;
      const datum = parseSwapDatum(utxo.inline_datum);
      if (!datum) continue;
      const offerAssetId = assetIdOf(datum.offerPolicyId, datum.offerAssetName);
      const lovelace = utxo.amount.find((item) => item[blockfrostAssetIdField] === 'lovelace')?.quantity || '0';
      const offered = utxo.amount.find((item) => item[blockfrostAssetIdField] === offerAssetId)?.quantity || '0';
      seen.add(id);
      offers.push({
        id,
        txHash: utxo.tx_hash,
        txIndex: String(utxo.tx_index),
        address: utxo.address,
        ownerStakeKeyHash: stakeFromAddress(utxo.address),
        utxoCoinQuantity: lovelace,
        utxoOfferQuantity: offered,
        ...datum,
      });
    }
  }
  return offers;
}

export async function fetchPortfolio(context: ProviderContext, address: string): Promise<PortfolioAsset[]> {
  const data = await requestJson(`/addresses/${address}`, context, true);
  const amount = data && typeof data === 'object' && 'amount' in data ? (data.amount as unknown) : null;
  if (!Array.isArray(amount)) return [];
  return Promise.all(
    amount.map(async (item) => {
      const entry = item as BlockfrostAmount;
      const entryAssetId = entry[blockfrostAssetIdField] || '';
      const policyId = entryAssetId === 'lovelace' ? 'ada' : entryAssetId.slice(0, 56);
      const assetNameHex = entryAssetId === 'lovelace' ? 'ada' : entryAssetId.slice(56);
      const info = await fetchAssetInfo(policyId, assetNameHex, context);
      return { ...info, quantity: entry.quantity, assetId: entryAssetId || info.assetId };
    }),
  );
}

export async function fetchConfirmedTransactionHashes(
  context: ProviderContext,
  txHashes: string[],
): Promise<string[]> {
  const unique = [...new Set(txHashes.filter(Boolean))];
  const results = await Promise.all(
    unique.map(async (txHash) => {
      const tx = await requestJson(`/txs/${txHash}`, context, true);
      return tx && typeof tx === 'object' ? txHash : '';
    }),
  );
  return results.filter(Boolean);
}
