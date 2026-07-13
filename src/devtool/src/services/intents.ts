import type { AppState, IntentArgs, IntentTemplate, OpenOffer } from '../state/types';
import { assetKeyOf, hardAsset } from '../domain/assets';
import { fromBase, toBase } from '../domain/quantities';
import {
  askQuantityForFill,
  buildCloseIntentArgs,
  buildFillIntentArgsForQuantity,
  buildOpenIntentArgs,
} from '../../../core/intents/args';

export function newIntentId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${Date.now()}-${random.slice(0, 8)}`;
}

export function connectIntent(): IntentTemplate['code'] {
  return {
    type: 'script',
    title: 'Connect NeonSoup',
    description: 'Share public wallet data with NeonSoup.',
    exportAs: 'connect',
    return: { mode: 'last' },
    returnURLPattern: cleanReturnUrl(),
    run: {
      name: { type: 'getName' },
      address: { type: 'getCurrentAddress' },
      addressInfo: {
        type: 'macro',
        run: "{getAddressInfo(get('cache.address'))}",
      },
      stakingKey: { type: 'getStakingPublicKey' },
      finally: {
        type: 'macro',
        run: {
          name: "{get('cache.name')}",
          address: "{get('cache.address')}",
          addressInfo: "{get('cache.addressInfo')}",
          stakeKeyHash: "{get('cache.stakingKey.pubKeyHashHex')}",
        },
      },
    },
  };
}

export function buildOpenArgs(state: AppState): IntentArgs {
  const assets = state.assetInfo;
  const offer = assets[state.forms.openOfferAssetKey];
  const ask = assets[state.forms.openAskAssetKey];
  return buildOpenIntentArgs({
    offer,
    ask,
    offerAmount: state.forms.openOfferAmount,
    askAmount: state.forms.openAskAmount,
    ownerStakeKeyHash: state.wallet?.stakeKeyHash || '',
    intentId: newIntentId('open'),
  });
}

export function buildFillArgs(state: AppState, offer: OpenOffer | null): IntentArgs {
  if (!offer) return {};
  const offeredAsset =
    state.assetInfo[assetKeyOf(offer.offerPolicyId, offer.offerAssetName)] ||
    hardAsset(state.options.network, state.customAssets, offer.offerPolicyId, offer.offerAssetName);
  const offerQuantity = toBase(state.forms.fillOfferAmount, offeredAsset.decimals);
  return buildFillArgsForQuantity(state, offer, offerQuantity);
}

export function buildFillArgsForQuantity(state: AppState, offer: OpenOffer | null, offerQuantity: bigint): IntentArgs {
  return buildFillIntentArgsForQuantity({
    offer,
    offerQuantity,
    intentId: offer ? newIntentId(`${offer.txHash.slice(0, 8)}-${offer.txIndex}`) : '',
  });
}

export function buildCloseArgs(state: AppState, offer: OpenOffer | null): IntentArgs {
  return buildCloseIntentArgs({
    offer,
    ownerAddress: state.wallet?.address || offer?.address || '',
    intentId: offer ? newIntentId(`${offer.txHash.slice(0, 8)}-${offer.txIndex}`) : '',
  });
}

export function selectedOffer(state: AppState): OpenOffer | null {
  return state.openOffers.find((offer) => offer.id === state.selectedOrderId) || null;
}

export function buildArgsForAction(state: AppState): IntentArgs {
  if (state.action === 'open') return buildOpenArgs(state);
  if (state.action === 'fill') return buildFillArgs(state, selectedOffer(state));
  return buildCloseArgs(state, selectedOffer(state));
}

export function cleanReturnUrl(): string {
  const url = new URL(window.location.href);
  url.search = '';
  return `${url.origin}${url.pathname}${url.hash}`;
}

export function fillAskAmount(state: AppState): string {
  const offer = selectedOffer(state);
  if (!offer) return '';
  const offeredAsset =
    state.assetInfo[assetKeyOf(offer.offerPolicyId, offer.offerAssetName)] ||
    hardAsset(state.options.network, state.customAssets, offer.offerPolicyId, offer.offerAssetName);
  const askAsset =
    state.assetInfo[assetKeyOf(offer.askPolicyId, offer.askAssetName)] ||
    hardAsset(state.options.network, state.customAssets, offer.askPolicyId, offer.askAssetName);
  const offerQuantity = toBase(state.forms.fillOfferAmount, offeredAsset.decimals);
  const askQuantity = askQuantityForFill(offer, offerQuantity);
  return askQuantity > 0n ? fromBase(askQuantity, askAsset.decimals) : '';
}
