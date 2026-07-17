import type { AppOptions, AssetRef, NetworkTag, OpenOffer, PortfolioAsset, ResolvedAsset } from '../state/types';
import { APP_CONFIG } from '../config/appConfig';
import { applyFetchedMetadata, assetIdOf, assetKeyOf, hardAsset } from '../domain/assets';
import { parseSwapDatum, stakeFromAddress } from '../domain/cardano';
import type { ChainTransaction, ChainTransactionOutput, NetworkProvider, ProviderContext } from './providers/types';

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

interface BlockfrostTransaction {
  hash?: string;
  block_time?: number;
  fees?: string;
  valid_contract?: boolean;
}

interface BlockfrostAddressTransaction {
  tx_hash?: string;
}

interface BlockfrostTransactionIo {
  address?: string;
  amount?: BlockfrostAmount[];
  tx_hash?: string;
  output_index?: number;
  data_hash?: string | null;
  inline_datum?: string | null;
}

interface BlockfrostTransactionUtxos {
  hash?: string;
  inputs?: BlockfrostTransactionIo[];
  outputs?: BlockfrostTransactionIo[];
}

function endpoint(networkTag: NetworkTag, options: AppOptions): string {
  const network = APP_CONFIG.networks[networkTag];
  const candidates = [options.providerUrl, options.blockfrostUrl, network.blockfrostUrl, network.hostedBlockfrostUrl];
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
  const beacon = APP_CONFIG.networks[context.networkTag].validator.beaconsPolicy.scriptHashHex;
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
      const askAssetId = assetIdOf(datum.askPolicyId, datum.askAssetName);
      const lovelace = utxo.amount.find((item) => item[blockfrostAssetIdField] === 'lovelace')?.quantity || '0';
      const offered = utxo.amount.find((item) => item[blockfrostAssetIdField] === offerAssetId)?.quantity || '0';
      const asked =
        askAssetId === 'lovelace'
          ? '0'
          : utxo.amount.find((item) => item[blockfrostAssetIdField] === askAssetId)?.quantity || '0';
      seen.add(id);
      offers.push({
        id,
        txHash: utxo.tx_hash,
        txIndex: String(utxo.tx_index),
        address: utxo.address,
        ownerStakeKeyHash: stakeFromAddress(utxo.address),
        utxoCoinQuantity: lovelace,
        utxoOfferQuantity: offered,
        utxoAskQuantity: asked,
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
  txHashes: readonly string[],
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

function mapTransactionIo(io: BlockfrostTransactionIo): ChainTransactionOutput {
  const amounts = io.amount || [];
  const lovelace = amounts.find((amount) => amount[blockfrostAssetIdField] === 'lovelace')?.quantity || '0';
  return {
    address: io.address || '',
    ownerStakeKeyHash: stakeFromAddress(io.address || ''),
    txHash: io.tx_hash || '',
    index: String(io.output_index ?? ''),
    value: lovelace,
    datumHex: io.inline_datum || '',
    tokens: amounts
      .filter((amount) => amount[blockfrostAssetIdField] !== 'lovelace')
      .map((amount) => {
        const assetId = amount[blockfrostAssetIdField] || '';
        return {
          policyId: assetId.slice(0, 56),
          assetNameHex: assetId.slice(56),
          quantity: amount.quantity,
        };
      }),
  };
}

async function fetchTransactions(context: ProviderContext, txHashes: readonly string[]): Promise<ChainTransaction[]> {
  const unique = [...new Set(txHashes.filter(Boolean))];
  const transactions = await Promise.all(
    unique.map(async (txHash) => {
      const [tx, utxos] = await Promise.all([
        requestJson(`/txs/${txHash}`, context, true),
        requestJson(`/txs/${txHash}/utxos`, context, true),
      ]);
      if (!tx || typeof tx !== 'object' || !utxos || typeof utxos !== 'object') return null;
      const transaction = tx as BlockfrostTransaction;
      const io = utxos as BlockfrostTransactionUtxos;
      return {
        hash: transaction.hash || io.hash || txHash,
        includedAt: (transaction.block_time || 0) * 1000,
        ...(transaction.fees ? { fee: transaction.fees } : {}),
        ...(typeof transaction.valid_contract === 'boolean' ? { validContract: transaction.valid_contract } : {}),
        inputs: (io.inputs || []).map(mapTransactionIo),
        outputs: (io.outputs || []).map(mapTransactionIo),
      } satisfies ChainTransaction;
    }),
  );
  return transactions.filter((transaction): transaction is ChainTransaction => Boolean(transaction));
}

async function fetchAddressTransactions(
  context: ProviderContext,
  address: string,
  limit = 50,
): Promise<ChainTransaction[]> {
  const safeLimit = Math.max(1, Math.min(250, Math.floor(limit) || 50));
  const pageCount = Math.max(1, Math.ceil(safeLimit / 100));
  const rows = await pages<BlockfrostAddressTransaction>(`/addresses/${address}/transactions?order=desc`, context, pageCount);
  const hashes = rows.map((row) => row.tx_hash || '').filter(Boolean).slice(0, safeLimit);
  return fetchTransactions(context, hashes);
}


async function fetchAssetsInfo(
  context: ProviderContext,
  assets: readonly AssetRef[],
): Promise<Record<string, ResolvedAsset>> {
  const unique = new Map(assets.map((asset) => [assetKeyOf(asset.policyId, asset.assetNameHex), asset]));
  const resolved: Record<string, ResolvedAsset> = {};
  for (const asset of unique.values()) {
    const info = await fetchAssetInfo(asset.policyId, asset.assetNameHex, context);
    resolved[info.assetKey] = info;
  }
  return resolved;
}

export const blockfrostProvider: NetworkProvider = {
  getAssetInfo: (context, policyId, assetNameHex) => fetchAssetInfo(policyId, assetNameHex, context),
  getAssetsInfo: fetchAssetsInfo,
  async getOpenOffers(context) {
    const data = await fetchOpenOffers(context);
    const assets = await fetchAssetsInfo(
      context,
      data.flatMap((offer) => [
        { policyId: offer.offerPolicyId, assetNameHex: offer.offerAssetName },
        { policyId: offer.askPolicyId, assetNameHex: offer.askAssetName },
      ]),
    );
    return { data, assets };
  },
  async getPortfolio(context, address) {
    const data = await fetchPortfolio(context, address);
    return { data, assets: Object.fromEntries(data.map((asset) => [asset.assetKey, asset])) };
  },
  getTransactions: fetchTransactions,
  getAddressTransactions: fetchAddressTransactions,
  getConfirmedTransactionHashes: fetchConfirmedTransactionHashes,
};
