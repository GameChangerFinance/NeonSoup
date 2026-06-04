import type { AppState, OpenOffer, PortfolioAsset, ResolvedAsset } from '../state/types';
import { fetchAssetInfo, fetchOpenOffers, fetchPortfolio } from './blockfrost';
import { fetchGraphqlMk2OpenOffers, fetchGraphqlMk2Portfolio } from './graphqlMk2';

function context(state: AppState) {
  return {
    networkTag: state.options.network,
    options: state.options,
    assetInfo: state.assetInfo,
    customAssets: state.customAssets,
  };
}

export async function loadAssetInfo(
  state: AppState,
  policyId: string,
  assetNameHex: string,
): Promise<ResolvedAsset> {
  return fetchAssetInfo(policyId, assetNameHex, context(state));
}

export async function loadOpenOffers(state: AppState): Promise<OpenOffer[]> {
  if (state.options.provider === 'graphqlMk2') return fetchGraphqlMk2OpenOffers();
  return fetchOpenOffers(context(state));
}

export async function loadPortfolio(state: AppState, address: string): Promise<PortfolioAsset[]> {
  if (state.options.provider === 'graphqlMk2') return fetchGraphqlMk2Portfolio();
  return fetchPortfolio(context(state), address);
}
