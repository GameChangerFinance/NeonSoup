import type { AppState, CartItem, CartState, IntentArgs } from '../state/types';
import { assetTitle } from '../domain/assets';
import { fromBase, gcd } from '../domain/quantities';
import type { SwapQuote } from '../domain/swapQuote';
import { resolveAsset, selectedOffer } from '../state/selectors';
import { buildArgsForAction, buildFillArgsForQuantity, buildOpenArgs, newIntentId } from './intents';
import {
  bookedSourceRefs as bookedSourceRefsCore,
  createCartItemSnapshot,
  pairForArgs,
  selectedCartItems as selectedCartItemsCore,
  sourceRef as sourceRefCore,
  validateCartItemsCanBeAdded as validateCartItemsCanBeAddedCore,
  visibleCartItems as visibleCartItemsCore,
  type CartValidationResult,
} from '../../core/intents/cart';

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

export function createCartItemFromCurrentIntent(state: AppState): CartItem {
  const args = {
    ...buildArgsForAction(state),
  };
  const intentId = args['intent-id'] || newIntentId(state.action);
  const pair = pairForArgs(args);
  return createCartItemSnapshot({
    action: state.action,
    args,
    intentId,
    createdAt: Date.now(),
    ...(state.selectedOrderId ? { sourceOfferId: state.selectedOrderId } : {}),
    sourceLabel: sourceLabelForCurrentAction(state, args),
    ...(pair ? { pair } : {}),
  });
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
  const swapActionId = newIntentId('swap-action');
  return quote.segments
    .filter((segment) => segment.offerQuantity > 0n)
    .map((segment) => {
      const args = buildFillArgsForQuantity(state, segment.offer, segment.offerQuantity);
      const intentId = args['intent-id'] || newIntentId(`swap-${segment.offer.txHash.slice(0, 8)}`);
      args['intent-id'] = intentId;
      args['swap-action-id'] = swapActionId;
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
  return selectedCartItemsCore(cart);
}

export function bookedSourceRefs(cart: CartState): Set<string> {
  return bookedSourceRefsCore(cart);
}

export function sourceRef(item: Pick<CartItem, 'args'>): string {
  return sourceRefCore(item);
}

export function visibleCartItems(cart: CartState): CartItem[] {
  return visibleCartItemsCore(cart);
}

export function validateCartItemsCanBeAdded(cart: CartState, items: CartItem[]): CartValidationResult {
  return validateCartItemsCanBeAddedCore(cart, items);
}
