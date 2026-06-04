import { assetKeyOf, configuredAssets, hardAsset } from '../domain/assets';
import type { AppState, OpenOffer, PortfolioAsset, ResolvedAsset } from './types';

export function assetMap(state: AppState): Record<string, ResolvedAsset> {
  return {
    ...configuredAssets(state.options.network, state.customAssets),
    ...state.assetInfo,
  };
}

export function resolveAsset(state: AppState, policyId: string, assetNameHex: string): ResolvedAsset {
  const key = assetKeyOf(policyId, assetNameHex);
  return assetMap(state)[key] || hardAsset(state.options.network, state.customAssets, policyId, assetNameHex);
}

export function selectedOffer(state: AppState): OpenOffer | null {
  return state.openOffers.find((offer) => offer.id === state.selectedOrderId) || null;
}

export function isKnownAsset(state: AppState, policyId: string, assetNameHex: string): boolean {
  return Boolean(resolveAsset(state, policyId, assetNameHex).known);
}

export function visibleOffers(state: AppState): OpenOffer[] {
  return state.openOffers.filter((offer) => {
    const ownerMatch =
      !state.options.ownerOnly ||
      Boolean(state.wallet?.stakeKeyHash && offer.ownerStakeKeyHash === state.wallet.stakeKeyHash);
    const knownMatch =
      !state.options.hideUnknownOffers ||
      (isKnownAsset(state, offer.offerPolicyId, offer.offerAssetName) &&
        isKnownAsset(state, offer.askPolicyId, offer.askAssetName));
    return ownerMatch && knownMatch;
  });
}

export function visiblePortfolio(state: AppState): PortfolioAsset[] {
  return state.options.hideUnknownPortfolio
    ? state.portfolio.filter((asset) => asset.known)
    : state.portfolio;
}

export function balanceOf(state: AppState, policyId: string, assetNameHex: string): bigint {
  return BigInt(
    state.portfolio.find((asset) => asset.policyId === policyId && asset.assetNameHex === assetNameHex)?.quantity ||
      '0',
  );
}
