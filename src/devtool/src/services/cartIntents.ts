import type { AppState, CartItem, CartState, IntentArgs } from '../state/types';
import { assetTitle } from '../domain/assets';
import { fromBase, gcd } from '../domain/quantities';
import type { SwapQuote } from '../domain/swapQuote';
import { resolveAsset, selectedOffer } from '../state/selectors';
import { buildArgsForAction, buildFillArgsForQuantity, buildOpenArgs, newIntentId } from './intents';

export interface CartValidationResult {
  ok: boolean;
  message?: string;
}

function sourceRef(item: CartItem): string {
  const txHash = item.args['utxo-tx-hash'];
  const txIndex = item.args['utxo-tx-index'];
  return txHash && txIndex ? `${txHash}#${txIndex}` : '';
}

function sourceLabelForCurrentAction(state: AppState, args: IntentArgs): string {
  const offered = state.assetInfo[state.forms.openOfferAssetKey];
  const asked = state.assetInfo[state.forms.openAskAssetKey];
  const offer = selectedOffer(state);
  const offerAsset = offer ? resolveAsset(state, offer.offerPolicyId, offer.offerAssetName) : offered;
  const askAsset = offer ? resolveAsset(state, offer.askPolicyId, offer.askAssetName) : asked;
  const action = state.action === 'open' ? 'Open' : state.action === 'fill' ? 'Fill' : 'Close';
  const offerAmount =
    offerAsset && args['offer-quantity'] ? `${fromBase(args['offer-quantity'], offerAsset.decimals)} ${assetTitle(offerAsset)}` : '';
  const askAmount =
    askAsset && args['ask-quantity'] ? `${fromBase(args['ask-quantity'], askAsset.decimals)} ${assetTitle(askAsset)}` : '';
  const pair = offerAsset && askAsset ? `${assetTitle(offerAsset)} → ${assetTitle(askAsset)}` : 'offer';
  if (state.action === 'open' && offerAmount && askAsset && state.forms.openAskAmount) {
    return `${action} ${offerAmount} → ${state.forms.openAskAmount} ${assetTitle(askAsset)}`;
  }
  return `${action} ${offerAmount || pair}${askAmount ? ` → ${askAmount}` : ''}`;
}

function pairForArgs(args: IntentArgs): CartItem['pair'] {
  const offerPolicyId = args['offer-policy-id'];
  const offerAssetName = args['offer-asset-name'];
  const askPolicyId = args['ask-policy-id'];
  const askAssetName = args['ask-asset-name'];
  if (!offerPolicyId || !askPolicyId) return undefined;
  return {
    offer: { policyId: offerPolicyId, assetNameHex: offerAssetName || '' },
    ask: { policyId: askPolicyId, assetNameHex: askAssetName || '' },
  };
}

export function createCartItemFromCurrentIntent(state: AppState): CartItem {
  const args = {
    ...buildArgsForAction(state),
  };
  const intentId = args['intent-id'] || newIntentId(state.action);
  args['intent-id'] = intentId;
  const pair = pairForArgs(args);
  const item = {
    id: `${state.action}-${intentId}`,
    name: state.action,
    args,
    selected: true,
    status: 'draft',
    createdAt: Date.now(),
    ...(state.selectedOrderId ? { sourceOfferId: state.selectedOrderId } : {}),
    sourceLabel: sourceLabelForCurrentAction(state, args),
    ...(pair ? { pair } : {}),
  } satisfies CartItem;
  return item;
}

function variedPrice(baseNumerator: string, baseDenominator: string, variancePercent: number) {
  const numerator = BigInt(baseNumerator || '0');
  const denominator = BigInt(baseDenominator || '1');
  if (numerator <= 0n || denominator <= 0n) {
    return { numerator: baseNumerator || '0', denominator: baseDenominator || '1' };
  }
  if (!variancePercent) {
    return { numerator: numerator.toString(), denominator: denominator.toString() };
  }
  const scale = 1_000_000n;
  // Random variance is a bounded UI factor; price arithmetic stays in bigint.
  const factor = BigInt(Math.max(1, Math.round((1 + (Math.random() * 2 - 1) * (variancePercent / 100)) * Number(scale))));
  const variedNumerator = numerator * factor;
  const variedDenominator = denominator * scale;
  const divisor = gcd(variedNumerator, variedDenominator);
  return {
    numerator: (variedNumerator / divisor).toString(),
    denominator: (variedDenominator / divisor).toString(),
  };
}

function variedQuantity(baseQuantity: string, variancePercent: number): string {
  const quantity = BigInt(baseQuantity || '0');
  if (quantity <= 0n) return baseQuantity || '0';
  if (!variancePercent) return quantity.toString();
  const scale = 1_000_000n;
  // Random variance is a bounded UI factor; quantity arithmetic stays in bigint.
  const factor = BigInt(Math.max(1, Math.round((1 + (Math.random() * 2 - 1) * (variancePercent / 100)) * Number(scale))));
  const varied = (quantity * factor) / scale;
  return (varied > 0n ? varied : 1n).toString();
}

export function createBulkOpenCartItems(
  state: AppState,
  count: number,
  priceVariancePercent: number,
  offerVariancePercent: number,
): CartItem[] {
  const safeCount = Math.max(0, Math.floor(count));
  const baseArgs = buildOpenArgs(state);
  const offerAsset = state.assetInfo[state.forms.openOfferAssetKey];
  const askAsset = state.assetInfo[state.forms.openAskAssetKey];
  const pair =
    baseArgs['offer-policy-id'] && baseArgs['ask-policy-id']
      ? {
          offer: {
            policyId: baseArgs['offer-policy-id'],
            assetNameHex: baseArgs['offer-asset-name'] || '',
          },
          ask: {
            policyId: baseArgs['ask-policy-id'],
            assetNameHex: baseArgs['ask-asset-name'] || '',
          },
        }
      : undefined;

  return Array.from({ length: safeCount }, (_, index) => {
    const intentId = `bulk-open-${Date.now()}-${index + 1}`;
    const price = variedPrice(
      baseArgs['price-numerator'] || '0',
      baseArgs['price-denominator'] || '1',
      priceVariancePercent,
    );
    const args: IntentArgs = {
      ...baseArgs,
      'intent-id': intentId,
      'offer-quantity': variedQuantity(baseArgs['offer-quantity'] || '0', offerVariancePercent),
      'price-numerator': price.numerator,
      'price-denominator': price.denominator,
    };
    const askQuantity =
      args['offer-quantity'] && BigInt(args['price-denominator'] || '0') > 0n
        ? (BigInt(args['offer-quantity']) * BigInt(args['price-numerator'] || '0')) /
          BigInt(args['price-denominator'] || '1')
        : 0n;
    return {
      id: `open-${intentId}`,
      name: 'open',
      args,
      selected: true,
      status: 'draft',
      createdAt: Date.now(),
      sourceLabel:
        offerAsset && askAsset && args['offer-quantity']
          ? `Open ${fromBase(args['offer-quantity'], offerAsset.decimals)} ${assetTitle(offerAsset)} → ${fromBase(askQuantity, askAsset.decimals)} ${assetTitle(askAsset)}`
          : 'Open offer',
      ...(pair ? { pair } : {}),
    } satisfies CartItem;
  });
}

export function createSwapCartItems(state: AppState, quote: SwapQuote): CartItem[] {
  return quote.segments
    .filter((segment) => segment.offerQuantity > 0n)
    .map((segment) => {
      const args = buildFillArgsForQuantity(state, segment.offer, segment.offerQuantity);
      const intentId = args['intent-id'] || newIntentId(`swap-${segment.offer.txHash.slice(0, 8)}`);
      args['intent-id'] = intentId;
      const receivedAsset = resolveAsset(state, segment.offer.offerPolicyId, segment.offer.offerAssetName);
      const paidAsset = resolveAsset(state, segment.offer.askPolicyId, segment.offer.askAssetName);
      return {
        id: `fill-${intentId}`,
        name: 'fill',
        args,
        selected: true,
        status: 'draft',
        createdAt: Date.now(),
        sourceOfferId: segment.offer.id,
        sourceLabel: `Swap ${fromBase(segment.askQuantity, paidAsset.decimals)} ${assetTitle(paidAsset)} → ${fromBase(segment.offerQuantity, receivedAsset.decimals)} ${assetTitle(receivedAsset)}`,
        pair: {
          offer: {
            policyId: segment.offer.offerPolicyId,
            assetNameHex: segment.offer.offerAssetName,
          },
          ask: {
            policyId: segment.offer.askPolicyId,
            assetNameHex: segment.offer.askAssetName,
          },
        },
      } satisfies CartItem;
    });
}

export function selectedCartItems(cart: CartState): CartItem[] {
  return cart.items.filter((item) => item.selected);
}

export function visibleCartItems(cart: CartState): CartItem[] {
  return cart.showConfirmedOnly
    ? cart.items.filter((item) => item.status === 'confirmed')
    : cart.items.filter((item) => item.status !== 'confirmed');
}

export function validateCartItemsCanBeAdded(cart: CartState, items: CartItem[]): CartValidationResult {
  const existingIds = new Set(cart.items.map((item) => item.id));
  for (const item of items) {
    if (existingIds.has(item.id)) {
      return { ok: false, message: `Intent ${item.id} is already in the Cart.` };
    }
    existingIds.add(item.id);
  }

  const activeRefs = new Map<string, string>();
  for (const item of cart.items) {
    if (item.status !== 'draft' || (item.name !== 'fill' && item.name !== 'close')) continue;
    const ref = sourceRef(item);
    if (ref) activeRefs.set(ref, item.id);
  }
  for (const item of items) {
    if (item.name !== 'fill' && item.name !== 'close') continue;
    const ref = sourceRef(item);
    if (ref && activeRefs.has(ref)) {
      return { ok: false, message: `Source UTxO ${ref} is already used by another draft Cart item.` };
    }
    if (ref) activeRefs.set(ref, item.id);
  }

  return { ok: true };
}
