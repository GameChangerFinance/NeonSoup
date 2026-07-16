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
  validateCartItemsCanBeAdded as validateCartItemsCanBeAddedCore,
  visibleCartItems as visibleCartItemsCore,
  type CartValidationResult,
} from '../../../core/intents/cart';

function safeBigInt(value: string | undefined, fallback = 0n): bigint {
  try {
    return BigInt(value || fallback.toString());
  } catch {
    return fallback;
  }
}

function openAskQuantity(args: IntentArgs): bigint {
  const explicitAsk = args['ask-quantity'];
  if (explicitAsk) return safeBigInt(explicitAsk);
  const offerQuantity = safeBigInt(args['offer-quantity']);
  const numerator = safeBigInt(args['price-numerator']);
  const denominator = safeBigInt(args['price-denominator'], 1n);
  return denominator > 0n ? (offerQuantity * numerator) / denominator : 0n;
}

function sourceLabelForArgs(state: AppState, action: AppState['action'], args: IntentArgs): string {
  const offerAsset = args['offer-policy-id']
    ? resolveAsset(state, args['offer-policy-id'], args['offer-asset-name'] || '')
    : undefined;
  const askAsset = args['ask-policy-id']
    ? resolveAsset(state, args['ask-policy-id'], args['ask-asset-name'] || '')
    : undefined;
  const actionLabel = action === 'open' ? 'Open' : action === 'fill' ? 'Fill' : 'Close';
  const offerQuantity = args['offer-quantity'];
  const askQuantity = action === 'open' ? openAskQuantity(args).toString() : args['ask-quantity'];
  const offerAmount =
    offerAsset && offerQuantity ? `${fromBase(offerQuantity, offerAsset.decimals)} ${assetTitle(offerAsset)}` : '';
  const askAmount = askAsset && askQuantity ? `${fromBase(askQuantity, askAsset.decimals)} ${assetTitle(askAsset)}` : '';
  const pair = offerAsset && askAsset ? `${assetTitle(offerAsset)} → ${assetTitle(askAsset)}` : 'offer';
  return `${actionLabel} ${offerAmount || pair}${askAmount ? ` → ${askAmount}` : ''}`;
}

function sourceLabelForCurrentAction(state: AppState, args: IntentArgs): string {
  const offer = selectedOffer(state);
  if (!offer) {
    return sourceLabelForArgs(state, state.action, args);
  }
  return sourceLabelForArgs(state, state.action, {
    ...args,
    'offer-policy-id': args['offer-policy-id'] || offer.offerPolicyId,
    'offer-asset-name': args['offer-asset-name'] || offer.offerAssetName,
    'ask-policy-id': args['ask-policy-id'] || offer.askPolicyId,
    'ask-asset-name': args['ask-asset-name'] || offer.askAssetName,
  });
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
    return {
      id: `open-${intentId}`,
      name: 'open',
      args,
      selected: true,
      status: 'draft',
      createdAt: Date.now(),
      sourceLabel: sourceLabelForArgs(state, 'open', args),
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
  return selectedCartItemsCore(cart);
}

export function bookedSourceRefs(cart: CartState): Set<string> {
  return bookedSourceRefsCore(cart);
}

export function visibleCartItems(cart: CartState): CartItem[] {
  return visibleCartItemsCore(cart);
}

export function validateCartItemsCanBeAdded(cart: CartState, items: CartItem[]): CartValidationResult {
  return validateCartItemsCanBeAddedCore(cart, items);
}
