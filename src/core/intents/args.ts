import type { IntentArgs, OpenOffer, ResolvedAsset } from '../types';
import { ceilDiv, gcd, toBase } from '../domain/quantities';

export interface OpenIntentArgsInput {
  offer: ResolvedAsset | undefined;
  ask: ResolvedAsset | undefined;
  offerAmount: string;
  askAmount: string;
  ownerStakeKeyHash: string;
  intentId: string;
}

export interface FillIntentArgsInput {
  offer: OpenOffer | null;
  offerQuantity: bigint;
  intentId: string;
}

export interface CloseIntentArgsInput {
  offer: OpenOffer | null;
  ownerAddress: string;
  intentId: string;
}

export function askQuantityForFill(offer: OpenOffer, offerQuantity: bigint): bigint {
  return offerQuantity > 0n
    ? ceilDiv(offerQuantity * BigInt(offer.priceNumerator), BigInt(offer.priceDenominator))
    : 0n;
}

export function buildOpenIntentArgs({
  offer,
  ask,
  offerAmount,
  askAmount,
  ownerStakeKeyHash,
  intentId,
}: OpenIntentArgsInput): IntentArgs {
  if (!offer || !ask) return {};
  const offerQuantity = toBase(offerAmount, offer.decimals);
  const askQuantity = toBase(askAmount, ask.decimals);
  const priceFactor = offerQuantity > 0n && askQuantity > 0n ? gcd(askQuantity, offerQuantity) : 1n;
  return {
    'offer-policy-id': offer.policyId,
    'offer-asset-name': offer.assetNameHex,
    'ask-policy-id': ask.policyId,
    'ask-asset-name': ask.assetNameHex,
    'offer-quantity': offerQuantity.toString(),
    'price-numerator': (askQuantity / priceFactor).toString(),
    'price-denominator': (offerQuantity > 0n ? offerQuantity / priceFactor : 1n).toString(),
    'owner-stake-keyhash': ownerStakeKeyHash,
    'intent-id': intentId,
  };
}

export function buildFillIntentArgsForQuantity({
  offer,
  offerQuantity,
  intentId,
}: FillIntentArgsInput): IntentArgs {
  if (!offer) return {};
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
    'utxo-ask-quantity': offer.utxoAskQuantity || '0',
    'offer-quantity': offerQuantity.toString(),
    'ask-quantity': askQuantityForFill(offer, offerQuantity).toString(),
    'owner-stake-keyhash': offer.ownerStakeKeyHash || '',
    'intent-id': intentId,
  };
}

export function buildCloseIntentArgs({ offer, ownerAddress, intentId }: CloseIntentArgsInput): IntentArgs {
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
    'utxo-ask-quantity': offer.utxoAskQuantity || '0',
    'offer-address': ownerAddress || offer.address,
    'owner-stake-keyhash': offer.ownerStakeKeyHash || '',
    'intent-id': intentId,
  };
}
