import type { OpenOffer, OrderKind, ResolvedAsset } from '../state/types';
import { assetTitle } from './assets';
import { currentOutputOwnerBadge, type OwnershipBadge } from './ownership';
import { fromBase, ratioDecimal } from './quantities';

export interface OpenOfferRow {
  offer: OpenOffer;
  key: string;
  utxoRef: string;
  offeredAsset: ResolvedAsset;
  askAsset: ResolvedAsset;
  offeredAmount: string;
  offeredTitle: string;
  formattedRate: string;
  ownerBadge: OwnershipBadge | null;
}

export function openOfferKey(offer: Pick<OpenOffer, 'txHash' | 'txIndex'>): string {
  return `${offer.txHash}#${offer.txIndex}`;
}

export function normalizeOrderKind(kind: OpenOffer['orderKind']): OrderKind {
  if (kind === 'one-way' || kind === 'two-way' || kind === 'future' || kind === 'unknown') return kind;
  return 'one-way';
}

export function normalizeOpenOffers(offers: readonly OpenOffer[]): OpenOffer[] {
  const normalized = new Map<string, OpenOffer>();
  offers.forEach((offer) => {
    const key = openOfferKey(offer);
    normalized.set(key, { ...offer, id: key, orderKind: normalizeOrderKind(offer.orderKind) });
  });
  return [...normalized.values()].sort(
    (a, b) => a.txHash.localeCompare(b.txHash) || Number(a.txIndex) - Number(b.txIndex),
  );
}

export function composeOpenOfferRows(
  offers: readonly OpenOffer[],
  walletStakeKeyHash: string | undefined,
  resolve: (policyId: string, assetNameHex: string) => ResolvedAsset,
): OpenOfferRow[] {
  return normalizeOpenOffers(offers).map((offer) => {
    const offeredAsset = resolve(offer.offerPolicyId, offer.offerAssetName);
    const askAsset = resolve(offer.askPolicyId, offer.askAssetName);
    return {
      offer,
      key: openOfferKey(offer),
      utxoRef: `${offer.txHash}#${offer.txIndex}`,
      offeredAsset,
      askAsset,
      offeredAmount: fromBase(offer.utxoOfferQuantity, offeredAsset.decimals),
      offeredTitle: assetTitle(offeredAsset),
      formattedRate: ratioDecimal(offer.priceNumerator, offer.priceDenominator || '1'),
      ownerBadge: currentOutputOwnerBadge(offer, walletStakeKeyHash),
    };
  });
}
