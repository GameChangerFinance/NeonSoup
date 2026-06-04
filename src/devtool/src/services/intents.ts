import { APP_CONFIG } from '../config/appConfig';
import type { AppState, IntentArgs, IntentName, IntentSelection, IntentTemplate, OpenOffer } from '../state/types';
import { assetKeyOf, hardAsset } from '../domain/assets';
import { ceilDiv, fromBase, gcd, toBase } from '../domain/quantities';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function newIntentId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export async function loadIntentTemplates(): Promise<Partial<Record<IntentName, IntentTemplate>>> {
  const entries = await Promise.all(
    Object.entries(APP_CONFIG.intentFiles).map(async ([key, path]) => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load ${path}`);
      return [key, { code: await response.json() }] as const;
    }),
  );
  return {
    ...Object.fromEntries(entries),
    connect: {
      code: {
        type: 'script',
        title: 'Connect NeonSoup',
        description: 'Share public wallet data with NeonSoup.',
        exportAs: 'connect',
        return: { mode: 'last' },
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
      },
    },
  };
}

export function buildOpenArgs(state: AppState): IntentArgs {
  const assets = state.assetInfo;
  const offer = assets[state.forms.openOfferAssetKey];
  const ask = assets[state.forms.openAskAssetKey];
  if (!offer || !ask) return {};
  const offerQuantity = toBase(state.forms.openOfferAmount, offer.decimals);
  const askQuantity = toBase(state.forms.openAskAmount, ask.decimals);
  const priceFactor = offerQuantity > 0n && askQuantity > 0n ? gcd(askQuantity, offerQuantity) : 1n;
  const args: IntentArgs = {
    'offer-policy-id': offer.policyId,
    'offer-asset-name': offer.assetNameHex,
    'ask-policy-id': ask.policyId,
    'ask-asset-name': ask.assetNameHex,
    'offer-quantity': offerQuantity.toString(),
    'price-numerator': (askQuantity / priceFactor).toString(),
    'price-denominator': (offerQuantity > 0n ? offerQuantity / priceFactor : 1n).toString(),
    'owner-stake-keyhash': state.wallet?.stakeKeyHash || '',
    'intent-id': state.intentArgs.open['intent-id'] || newIntentId('open'),
  };
  return args;
}

export function buildFillArgs(state: AppState, offer: OpenOffer | null): IntentArgs {
  if (!offer) return {};
  const offeredAsset =
    state.assetInfo[assetKeyOf(offer.offerPolicyId, offer.offerAssetName)] ||
    hardAsset(state.options.network, state.customAssets, offer.offerPolicyId, offer.offerAssetName);
  const askAsset =
    state.assetInfo[assetKeyOf(offer.askPolicyId, offer.askAssetName)] ||
    hardAsset(state.options.network, state.customAssets, offer.askPolicyId, offer.askAssetName);
  const offerQuantity = toBase(state.forms.fillOfferAmount, offeredAsset.decimals);
  const askQuantity =
    offerQuantity > 0n
      ? ceilDiv(offerQuantity * BigInt(offer.priceNumerator), BigInt(offer.priceDenominator))
      : 0n;
  return {
    'offer-policy-id': offer.offerPolicyId,
    'offer-asset-name': offer.offerAssetName,
    'ask-policy-id': offer.askPolicyId,
    'ask-asset-name': offer.askAssetName,
    'price-numerator': offer.priceNumerator,
    'price-denominator': offer.priceDenominator,
    'utxo-tx-hash': offer.txHash,
    'utxo-tx-index': offer.txIndex,
    'utxo-coin-quantity': offer.utxoCoinQuantity,
    'utxo-offer-quantity': offer.utxoOfferQuantity,
    'offer-quantity': offerQuantity.toString(),
    'ask-quantity': askQuantity.toString(),
    'owner-stake-keyhash': offer.ownerStakeKeyHash || '',
    'intent-id': state.intentArgs.fill['intent-id'] || newIntentId(`${offer.txHash.slice(0, 8)}-${offer.txIndex}`),
  };
}

export function buildCloseArgs(state: AppState, offer: OpenOffer | null): IntentArgs {
  if (!offer) return {};
  return {
    'offer-policy-id': offer.offerPolicyId,
    'offer-asset-name': offer.offerAssetName,
    'ask-policy-id': offer.askPolicyId,
    'ask-asset-name': offer.askAssetName,
    'utxo-tx-hash': offer.txHash,
    'utxo-tx-index': offer.txIndex,
    'utxo-coin-quantity': offer.utxoCoinQuantity,
    'utxo-offer-quantity': offer.utxoOfferQuantity,
    'offer-address': state.wallet?.address || offer.address,
    'owner-stake-keyhash': offer.ownerStakeKeyHash || '',
    'intent-id': state.intentArgs.close['intent-id'] || newIntentId(`${offer.txHash.slice(0, 8)}-${offer.txIndex}`),
  };
}

export function selectedOffer(state: AppState): OpenOffer | null {
  return state.openOffers.find((offer) => offer.id === state.selectedOrderId) || null;
}

export function buildArgsForAction(state: AppState): IntentArgs {
  if (state.action === 'open') return buildOpenArgs(state);
  if (state.action === 'fill') return buildFillArgs(state, selectedOffer(state));
  return buildCloseArgs(state, selectedOffer(state));
}

export function buildIntentSelection(state: AppState): IntentSelection {
  return {
    id: `${state.action}-selection`,
    name: state.action,
    args: state.intentArgs[state.action],
    ...(state.selectedOrderId ? { sourceOfferId: state.selectedOrderId } : {}),
  };
}

export function prepareIntent(state: AppState, action = state.action): IntentTemplate['code'] {
  const template = state.intents[action]?.code;
  if (!template) throw new Error(`Intent ${action} is not loaded`);
  const code = clone(template);
  code.args = action === state.action ? state.intentArgs[action] : state.intentArgs[action] || code.args || {};
  code.returnURLPattern = cleanReturnUrl();
  return code;
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
  const askQuantity =
    offerQuantity > 0n
      ? ceilDiv(offerQuantity * BigInt(offer.priceNumerator), BigInt(offer.priceDenominator))
      : 0n;
  return askQuantity > 0n ? fromBase(askQuantity, askAsset.decimals) : '';
}
