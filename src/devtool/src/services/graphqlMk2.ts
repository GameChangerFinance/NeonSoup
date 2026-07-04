import { APP_CONFIG } from '../config/appConfig';
import { applyFetchedMetadata, assetIdOf, assetKeyOf, hardAsset } from '../domain/assets';
import { parseSwapDatum, stakeFromAddress } from '../domain/cardano';
import { isConfirmedChainTransaction, parseChainIncludedAt } from '../domain/transactions';
import type { AssetRef, OpenOffer, PortfolioAsset, ResolvedAsset } from '../state/types';
import { fetchAllPages, pageInfo } from './providers/pagination';
import {
  GRAPHQL_MK2_OPERATIONS,
  GRAPHQL_MK2_QUERIES,
  type GraphqlMk2OperationName,
} from './providers/graphqlMk2Queries';
import type {
  ChainTransaction,
  ChainTransactionOutput,
  NetworkProvider,
  PageRequest,
  PageResult,
  ProviderContext,
} from './providers/types';

const DEFAULT_PAGE = { limit: 250, offset: 0 } as const;
const MAX_PAGES = 20;
const TRANSACTION_BATCH_SIZE = 25;
const REQUEST_TIMEOUT_MS = 30_000;

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface Mk2Asset {
  assetId?: string | null;
  policyId?: string | null;
  assetName?: string | null;
  fingerprint?: string | null;
  decimals?: number | null;
  name?: string | null;
  ticker?: string | null;
  description?: string | null;
  logo?: string | null;
}

interface Mk2Token {
  assetId?: string | null;
  policyId?: string | null;
  assetName?: string | null;
  quantity?: string | null;
  asset?: Mk2Asset | null;
}

interface Mk2Utxo {
  txHash?: string | null;
  index?: string | number | null;
  address?: string | null;
  value?: string | null;
  datum?: { bytes?: string | null } | null;
  tokens?: Mk2Token[] | null;
}

interface Mk2Transaction {
  hash?: string | null;
  includedAt?: string | number | null;
  validContract?: boolean | null;
  inputs?: Mk2Input[] | null;
  outputs?: Mk2Utxo[] | null;
}

interface Mk2Input extends Mk2Utxo {
  sourceTxHash?: string | null;
  sourceTxIndex?: string | number | null;
}

function endpoint(context: ProviderContext): string {
  const url = APP_CONFIG.networks[context.networkTag].graphqlMk2Url.trim();
  if (!url) {
    throw new Error(`Missing Cardano GraphQL MKII URL for ${context.networkTag}. Check VITE_NEONSOUP_* env values.`);
  }
  return url.replace(/\/+$/, '');
}

async function requestGraphql<TResult, TVariables>(
  context: ProviderContext,
  operationName: GraphqlMk2OperationName,
  query: string,
  variables: TVariables,
): Promise<TResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(context), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operationName, query, variables }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = (await response.json()) as GraphqlResponse<TResult>;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message || 'Unknown GraphQL error').join('; '));
    }
    if (!payload.data) throw new Error('Response did not include data.');
    return payload.data;
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : 'unknown error';
    throw new Error(`${operationName} failed: ${message}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

function resolveMk2Asset(context: ProviderContext, asset: Mk2Asset): ResolvedAsset | null {
  const policyId = asset.policyId || '';
  const assetNameHex = asset.assetName || '';
  if (!policyId) return null;
  const base = hardAsset(context.networkTag, context.customAssets, policyId, assetNameHex);
  const resolved = applyFetchedMetadata(base, asset);
  const hasMetadata = Boolean(asset.name || asset.ticker || asset.description || asset.logo || asset.decimals != null);
  return { ...resolved, registered: resolved.registered || hasMetadata };
}

function nestedAssets(context: ProviderContext, tokens: readonly Mk2Token[]): Record<string, ResolvedAsset> {
  const assets: Record<string, ResolvedAsset> = {};
  tokens.forEach((token) => {
    if (!token.asset) return;
    const asset = resolveMk2Asset(context, token.asset);
    if (asset) assets[asset.assetKey] = asset;
  });
  return assets;
}

function tokenQuantity(tokens: readonly Mk2Token[], assetId: string): string {
  return tokens.find((token) => token.assetId === assetId)?.quantity || '0';
}

function validBeaconTokens(tokens: readonly Mk2Token[], beaconPolicy: string, datum: NonNullable<ReturnType<typeof parseSwapDatum>>) {
  const required = [datum.pairBeacon, datum.offerBeacon, datum.askBeacon].map((name) => `${beaconPolicy}${name}`);
  const beacons = tokens.filter((token) => token.policyId === beaconPolicy);
  return (
    beacons.length === 3 &&
    beacons.every((token) => token.quantity === '1') &&
    required.every((assetId) => beacons.filter((token) => token.assetId === assetId).length === 1)
  );
}

function mapOpenOffer(context: ProviderContext, utxo: Mk2Utxo): OpenOffer | null {
  const txHash = utxo.txHash || '';
  const txIndex = utxo.index == null ? '' : String(utxo.index);
  const address = utxo.address || '';
  const datum = parseSwapDatum(utxo.datum?.bytes || '');
  const tokens = utxo.tokens || [];
  const beaconPolicy = APP_CONFIG.networks[context.networkTag].beaconPolicy || APP_CONFIG.beaconPolicy;
  if (!txHash || !txIndex || !address || !datum || !validBeaconTokens(tokens, beaconPolicy, datum)) return null;
  const offerAssetId = assetIdOf(datum.offerPolicyId, datum.offerAssetName);
  const askAssetId = assetIdOf(datum.askPolicyId, datum.askAssetName);
  return {
    id: `${txHash}:${txIndex}`,
    txHash,
    txIndex,
    address,
    ownerStakeKeyHash: stakeFromAddress(address),
    utxoCoinQuantity: utxo.value || '0',
    utxoOfferQuantity: offerAssetId === 'lovelace' ? utxo.value || '0' : tokenQuantity(tokens, offerAssetId),
    utxoAskQuantity: askAssetId === 'lovelace' ? '0' : tokenQuantity(tokens, askAssetId),
    ...datum,
  };
}

function mapTransactionOutput(utxo: Mk2Utxo, source = false): ChainTransactionOutput {
  const txHash = source && 'sourceTxHash' in utxo ? String((utxo as Mk2Input).sourceTxHash || '') : utxo.txHash || '';
  const index =
    source && 'sourceTxIndex' in utxo
      ? String((utxo as Mk2Input).sourceTxIndex ?? '')
      : String(utxo.index ?? '');
  return {
    address: utxo.address || '',
    ownerStakeKeyHash: stakeFromAddress(utxo.address || ''),
    txHash,
    index,
    value: utxo.value || '0',
    datumHex: utxo.datum?.bytes || '',
    tokens: (utxo.tokens || []).map((token) => ({
      policyId: token.policyId || '',
      assetNameHex: token.assetName || '',
      quantity: token.quantity || '0',
    })),
  };
}

function mapTransaction(transaction: Mk2Transaction): ChainTransaction | null {
  if (!transaction.hash) return null;
  return {
    hash: transaction.hash,
    includedAt: parseChainIncludedAt(transaction.includedAt),
    ...(typeof transaction.validContract === 'boolean' ? { validContract: transaction.validContract } : {}),
    inputs: (transaction.inputs || []).map((input) => mapTransactionOutput(input, true)),
    outputs: (transaction.outputs || []).map((output) => mapTransactionOutput(output)),
  };
}

async function fetchOpenOfferPage(context: ProviderContext, page: PageRequest): Promise<PageResult<Mk2Utxo>> {
  const result = await requestGraphql<{ utxos?: Mk2Utxo[] | null }, PageRequest & { beaconPolicyId: string }>(
    context,
    GRAPHQL_MK2_OPERATIONS.openOffers,
    GRAPHQL_MK2_QUERIES.openOffers,
    {
      ...page,
      beaconPolicyId: APP_CONFIG.networks[context.networkTag].beaconPolicy || APP_CONFIG.beaconPolicy,
    },
  );
  const items = Array.isArray(result.utxos) ? result.utxos : [];
  return { items, page: pageInfo(page, items.length) };
}

async function fetchAddressUtxoPage(
  context: ProviderContext,
  address: string,
  page: PageRequest,
): Promise<PageResult<Mk2Utxo>> {
  const result = await requestGraphql<{ utxos?: Mk2Utxo[] | null }, PageRequest & { address: string }>(
    context,
    GRAPHQL_MK2_OPERATIONS.addressUtxos,
    GRAPHQL_MK2_QUERIES.addressUtxos,
    { ...page, address },
  );
  const items = Array.isArray(result.utxos) ? result.utxos : [];
  return { items, page: pageInfo(page, items.length) };
}

async function getAssetsInfo(
  context: ProviderContext,
  requested: readonly AssetRef[],
): Promise<Record<string, ResolvedAsset>> {
  const assets: Record<string, ResolvedAsset> = {};
  const native = new Map<string, AssetRef>();
  requested.forEach((asset) => {
    const key = assetKeyOf(asset.policyId, asset.assetNameHex);
    const cached = context.assetInfo[key];
    if (cached) assets[key] = cached;
    else if (asset.policyId === 'ada') assets[key] = hardAsset(context.networkTag, context.customAssets, 'ada', 'ada');
    else native.set(assetIdOf(asset.policyId, asset.assetNameHex), asset);
  });

  const ids = [...native.keys()];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const assetIds = ids.slice(offset, offset + 100);
    const result = await requestGraphql<{ tokenAssets?: Mk2Asset[] | null }, { limit: number; offset: number; assetIds: string[] }>(
      context,
      GRAPHQL_MK2_OPERATIONS.assetsById,
      GRAPHQL_MK2_QUERIES.assetsById,
      { limit: assetIds.length, offset: 0, assetIds },
    );
    (result.tokenAssets || []).forEach((asset) => {
      const resolved = resolveMk2Asset(context, asset);
      if (resolved) assets[resolved.assetKey] = resolved;
    });
  }

  native.forEach((asset) => {
    const key = assetKeyOf(asset.policyId, asset.assetNameHex);
    if (!assets[key]) assets[key] = hardAsset(context.networkTag, context.customAssets, asset.policyId, asset.assetNameHex);
  });
  return assets;
}

async function getAssetInfo(context: ProviderContext, policyId: string, assetNameHex: string): Promise<ResolvedAsset> {
  const key = assetKeyOf(policyId, assetNameHex);
  const assets = await getAssetsInfo(context, [{ policyId, assetNameHex }]);
  return assets[key] || hardAsset(context.networkTag, context.customAssets, policyId, assetNameHex);
}

async function getOpenOffers(context: ProviderContext) {
  const result = await fetchAllPages(DEFAULT_PAGE, (page) => fetchOpenOfferPage(context, page), {
    maxPages: MAX_PAGES,
    keyOf: (utxo) => `${utxo.txHash || ''}#${utxo.index ?? ''}`,
  });
  if (result.page.truncated) {
    throw new Error(`${GRAPHQL_MK2_OPERATIONS.openOffers} reached the ${MAX_PAGES}-page safety cap.`);
  }
  const data = result.items.map((utxo) => mapOpenOffer(context, utxo)).filter((offer): offer is OpenOffer => Boolean(offer));
  const nested = Object.assign({}, ...result.items.map((utxo) => nestedAssets(context, utxo.tokens || [])));
  const pairAssets = await getAssetsInfo(
    { ...context, assetInfo: { ...context.assetInfo, ...nested } },
    data.flatMap((offer) => [
      { policyId: offer.offerPolicyId, assetNameHex: offer.offerAssetName },
      { policyId: offer.askPolicyId, assetNameHex: offer.askAssetName },
    ]),
  );
  return { data, assets: { ...nested, ...pairAssets } };
}

async function getPortfolio(context: ProviderContext, address: string) {
  const result = await fetchAllPages(DEFAULT_PAGE, (page) => fetchAddressUtxoPage(context, address, page), {
    maxPages: MAX_PAGES,
    keyOf: (utxo) => `${utxo.txHash || ''}#${utxo.index ?? ''}`,
  });
  if (result.page.truncated) {
    throw new Error(`${GRAPHQL_MK2_OPERATIONS.addressUtxos} reached the ${MAX_PAGES}-page safety cap.`);
  }
  const quantities = new Map<string, bigint>();
  const refs = new Map<string, AssetRef>();
  const nested = Object.assign({}, ...result.items.map((utxo) => nestedAssets(context, utxo.tokens || [])));

  result.items.forEach((utxo) => {
    quantities.set('ada.ada', (quantities.get('ada.ada') || 0n) + BigInt(utxo.value || '0'));
    refs.set('ada.ada', { policyId: 'ada', assetNameHex: 'ada' });
    (utxo.tokens || []).forEach((token) => {
      const policyId = token.policyId || '';
      const assetNameHex = token.assetName || '';
      if (!policyId) return;
      const key = assetKeyOf(policyId, assetNameHex);
      quantities.set(key, (quantities.get(key) || 0n) + BigInt(token.quantity || '0'));
      refs.set(key, { policyId, assetNameHex });
    });
  });

  const assets = await getAssetsInfo(
    { ...context, assetInfo: { ...context.assetInfo, ...nested } },
    [...refs.values()],
  );
  const data: PortfolioAsset[] = [...quantities.entries()].map(([key, quantity]) => ({
    ...(assets[key] || hardAsset(context.networkTag, context.customAssets, refs.get(key)?.policyId || 'ada', refs.get(key)?.assetNameHex || 'ada')),
    quantity: quantity.toString(),
  }));
  return { data, assets: { ...nested, ...assets } };
}

async function getConfirmedTransactionHashes(context: ProviderContext, txHashes: readonly string[]): Promise<string[]> {
  const unique = [...new Set(txHashes.filter(Boolean))];
  const confirmed: string[] = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    const result = await requestGraphql<
      { transactions?: Array<{ hash?: string | null; includedAt?: string | number | null }> | null },
      { limit: number; offset: number; txHashes: string[] }
    >(
      context,
      GRAPHQL_MK2_OPERATIONS.confirmedTransactions,
      GRAPHQL_MK2_QUERIES.confirmedTransactions,
      { limit: batch.length, offset: 0, txHashes: batch },
    );
    (result.transactions || []).forEach((transaction) => {
      if (
        transaction.hash &&
        isConfirmedChainTransaction({ includedAt: parseChainIncludedAt(transaction.includedAt) })
      ) {
        confirmed.push(transaction.hash);
      }
    });
  }
  return confirmed;
}

async function getTransactions(context: ProviderContext, txHashes: readonly string[]): Promise<ChainTransaction[]> {
  const unique = [...new Set(txHashes.filter(Boolean))];
  const transactions: ChainTransaction[] = [];
  for (let offset = 0; offset < unique.length; offset += TRANSACTION_BATCH_SIZE) {
    const batch = unique.slice(offset, offset + TRANSACTION_BATCH_SIZE);
    const result = await requestGraphql<
      { transactions?: Mk2Transaction[] | null },
      { limit: number; offset: number; txHashes: string[] }
    >(context, GRAPHQL_MK2_OPERATIONS.transactionsByHash, GRAPHQL_MK2_QUERIES.transactionsByHash, {
      limit: batch.length,
      offset: 0,
      txHashes: batch,
    });
    (result.transactions || []).forEach((transaction) => {
      const mapped = mapTransaction(transaction);
      if (mapped) transactions.push(mapped);
    });
  }
  return transactions;
}

export const graphqlMk2Provider: NetworkProvider = {
  getAssetInfo,
  getAssetsInfo,
  getOpenOffers,
  getPortfolio,
  getTransactions,
  getConfirmedTransactionHashes,
};
