import { normalizePortfolioAssets } from '../domain/assets';
import { normalizeOpenOffers } from '../domain/orders';
import type { AppState, OpenOffer, PortfolioAsset, ResolvedAsset } from '../state/types';
import { blockfrostProvider } from './blockfrost';
import { graphqlMk2Provider } from './graphqlMk2';
import type { ChainTransaction, NetworkProvider, ProviderContext, ProviderDataResult } from './providers/types';

const PROVIDERS: Record<AppState['options']['provider'], NetworkProvider> = {
  blockfrost: blockfrostProvider,
  graphqlMk2: graphqlMk2Provider,
};

function context(state: AppState): ProviderContext {
  return {
    networkTag: state.options.network,
    options: state.options,
    assetInfo: state.assetInfo,
    customAssets: state.customAssets,
  };
}

function provider(state: AppState): NetworkProvider {
  return PROVIDERS[state.options.provider];
}

export async function loadAssetInfo(
  state: AppState,
  policyId: string,
  assetNameHex: string,
): Promise<ResolvedAsset> {
  return provider(state).getAssetInfo(context(state), policyId, assetNameHex);
}

export async function loadOpenOffers(state: AppState): Promise<ProviderDataResult<OpenOffer[]>> {
  const result = await provider(state).getOpenOffers(context(state));
  return {
    ...result,
    data: normalizeOpenOffers(result.data),
  };
}

export async function loadPortfolio(state: AppState, address: string): Promise<ProviderDataResult<PortfolioAsset[]>> {
  const result = await provider(state).getPortfolio(context(state), address);
  return { ...result, data: normalizePortfolioAssets(result.data) };
}

export async function loadConfirmedTransactionHashes(state: AppState, txHashes: string[]): Promise<string[]> {
  return provider(state).getConfirmedTransactionHashes(context(state), txHashes);
}

export async function loadTransactions(state: AppState, txHashes: readonly string[]): Promise<ChainTransaction[]> {
  return provider(state).getTransactions(context(state), txHashes);
}
