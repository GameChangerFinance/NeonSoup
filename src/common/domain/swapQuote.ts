import { ceilDiv, toBase } from './quantities';
import type { OpenOffer, OrderKind, ResolvedAsset } from '../state/types';

export type SwapQuoteSeverity = 'success' | 'warning' | 'danger' | 'muted';
export type MakerRemainderStatus = 'none' | 'valid' | 'below-min-remainder';

export interface SwapQuoteInput {
  offers: readonly OpenOffer[];
  offerAsset: ResolvedAsset | undefined;
  receiveAsset: ResolvedAsset | undefined;
  offerAmount: string;
  payUp: boolean;
  excludedUtxoRefs?: ReadonlySet<string> | readonly string[];
  slippageToleranceBps?: number;
  warningSlippageMultiplier?: number;
  payUpBps?: number;
}

export interface SwapPrice {
  numerator: bigint;
  denominator: bigint;
}

export interface SwapRouteSegment {
  offer: OpenOffer;
  orderKind: OrderKind;
  utxoRef: string;
  offerQuantity: bigint;
  baseOfferQuantity: bigint;
  roundUpOfferQuantity: bigint;
  askQuantity: bigint;
  baseAskQuantity: bigint;
  roundUpAskQuantity: bigint;
  availableOfferQuantity: bigint;
  makerRemainderQuantity: bigint;
  makerRemainderAskEquivalentQuantity: bigint;
  makerRemainderBps: number;
  makerRemainderStatus: MakerRemainderStatus;
  fillBps: number;
  routeBps: number;
  routeDisplayBps: number;
  inputShareBps: number;
  filledShareBps: number;
  outputShareBps: number;
  price: SwapPrice;
  priceDeviationBps: number;
  segmentSlippageBps: number;
  cumulativeSlippageBps: number;
  severity: SwapQuoteSeverity;
}

export interface SwapBookPolicySummary {
  count: number;
  offerQuantity: bigint;
}

export type SwapQuoteFilterReason = 'min-executable-offer' | 'pay-up';

export interface SwapFilteredOffer {
  offer: OpenOffer;
  reason: SwapQuoteFilterReason;
}

interface NormalizedSwapBook {
  pairMatches: OpenOffer[];
  rawCandidates: OpenOffer[];
  executable: OpenOffer[];
  candidates: OpenOffer[];
  filtered: SwapFilteredOffer[];
  skippedUnsupportedCount: number;
  bookMinExecutableFilteredCount: number;
  bookMinExecutableFilteredOfferQuantity: bigint;
  payUpSkippedCount: number;
  payUpFallback: boolean;
  rawBestPrice: SwapPrice | null;
  executableBestPrice: SwapPrice | null;
}

export interface SwapQuote {
  requestedInputQuantity: bigint;
  executionInputQuantity: bigint;
  roundUpInputQuantity: bigint;
  filledInputQuantity: bigint;
  outputQuantity: bigint;
  unfilledRequestedQuantity: bigint;
  unfilledExecutionQuantity: bigint;
  routeDisplayQuantity: bigint;
  rawCandidateCount: number;
  pairMatchCount: number;
  candidateCount: number;
  skippedUnsupportedCount: number;
  bookMinExecutableFilteredCount: number;
  bookMinExecutableFilteredOfferQuantity: bigint;
  filteredOffers: SwapFilteredOffer[];
  remainderAdjustmentCount: number;
  remainderBlockedCount: number;
  payUpSkippedCount: number;
  payUpFallback: boolean;
  segments: SwapRouteSegment[];
  rawBestPrice: SwapPrice | null;
  executableBestPrice: SwapPrice | null;
  lowestPrice: SwapPrice | null;
  bestPrice: SwapPrice | null;
  bestMeaningfulPrice: SwapPrice | null;
  effectivePrice: SwapPrice | null;
  marginalPrice: SwapPrice | null;
  weightedSlippageBps: number;
  marginalSlippageBps: number;
  coverageBps: number;
  severity: SwapQuoteSeverity;
}

function assetKeyOf(policyId: string, assetNameHex: string): string {
  return `${policyId}.${assetNameHex}`;
}

function openOfferKey(offer: Pick<OpenOffer, 'txHash' | 'txIndex'>): string {
  return `${offer.txHash}#${offer.txIndex}`;
}

function normalizeOrderKind(kind: OpenOffer['orderKind']): OrderKind {
  if (kind === 'one-way' || kind === 'two-way' || kind === 'future' || kind === 'unknown') return kind;
  return 'one-way';
}

function positiveBigInt(value: string | undefined): bigint {
  try {
    const parsed = BigInt(value || '0');
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

function priceOf(offer: OpenOffer): SwapPrice {
  return {
    numerator: positiveBigInt(offer.priceNumerator),
    denominator: positiveBigInt(offer.priceDenominator),
  };
}

function comparePrice(a: OpenOffer, b: OpenOffer): number {
  const left = priceOf(a);
  const right = priceOf(b);
  const comparison = left.numerator * right.denominator - right.numerator * left.denominator;
  if (comparison < 0n) return -1;
  if (comparison > 0n) return 1;
  return openOfferKey(a).localeCompare(openOfferKey(b));
}

function priceDeviationBps(price: SwapPrice | null, baseline: SwapPrice | null): number {
  if (!price || !baseline || baseline.numerator <= 0n || baseline.denominator <= 0n || price.denominator <= 0n) {
    return 0;
  }
  const delta = price.numerator * baseline.denominator - baseline.numerator * price.denominator;
  if (delta <= 0n) return 0;
  const bps = (delta * 10_000n) / (baseline.numerator * price.denominator);
  return Number(bps > 1_000_000n ? 1_000_000n : bps);
}

function shareBps(value: bigint, total: bigint): number {
  if (total <= 0n || value <= 0n) return 0;
  const bps = (value * 10_000n) / total;
  return Number(bps > 10_000n ? 10_000n : bps);
}

export function percentToBps(value: number | string | undefined, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(0, Math.min(500_000, Math.round(parsed * 100)));
}

export function severityForSlippage(slippageBps: number, toleranceBps: number, warningMultiplier: number): SwapQuoteSeverity {
  if (slippageBps <= 0) return 'success';
  if (toleranceBps <= 0) return 'danger';
  if (slippageBps >= toleranceBps) return 'danger';
  if (slippageBps >= toleranceBps * warningMultiplier) return 'warning';
  return 'success';
}

export function summarizeSwapBookPolicyFilters(
  offers: readonly OpenOffer[],
  offerAsset: ResolvedAsset | undefined,
  receiveAsset: ResolvedAsset | undefined,
): SwapBookPolicySummary {
  const normalized = normalizeSwapBook({ offers, offerAsset, receiveAsset, payUp: false, excludedUtxoRefs: undefined, payUpBps: 0 });
  const filtered = normalized.filtered.filter((item) => item.reason === 'min-executable-offer');
  return {
    count: filtered.length,
    offerQuantity: filtered.reduce((total, item) => total + positiveBigInt(item.offer.utxoOfferQuantity), 0n),
  };
}

function isExecutableOneWaySwap(offer: OpenOffer, offerAsset: ResolvedAsset, receiveAsset: ResolvedAsset): boolean {
  return (
    normalizeOrderKind(offer.orderKind) === 'one-way' &&
    assetKeyOf(offer.offerPolicyId, offer.offerAssetName) === receiveAsset.assetKey &&
    assetKeyOf(offer.askPolicyId, offer.askAssetName) === offerAsset.assetKey &&
    priceOf(offer).numerator > 0n &&
    priceOf(offer).denominator > 0n &&
    positiveBigInt(offer.utxoOfferQuantity) > 0n
  );
}

function payUpSorted(candidates: OpenOffer[], payUpBps: number): { offers: OpenOffer[]; skippedCount: number; fallback: boolean } {
  const sorted = [...candidates].sort(comparePrice);
  const [cheapest] = sorted;
  if (!cheapest || payUpBps <= 0) return { offers: sorted, skippedCount: 0, fallback: false };
  const cheapestPrice = priceOf(cheapest);
  const firstAllowedIndex = sorted.findIndex((offer) => priceDeviationBps(priceOf(offer), cheapestPrice) > payUpBps);
  if (firstAllowedIndex < 0) return { offers: sorted, skippedCount: 0, fallback: true };
  return {
    offers: sorted.slice(firstAllowedIndex),
    skippedCount: firstAllowedIndex,
    fallback: false,
  };
}

function normalizeSwapBook({
  offers,
  offerAsset,
  receiveAsset,
  payUp,
  excludedUtxoRefs,
  payUpBps,
}: {
  offers: readonly OpenOffer[];
  offerAsset: ResolvedAsset | undefined;
  receiveAsset: ResolvedAsset | undefined;
  payUp: boolean;
  excludedUtxoRefs: ReadonlySet<string> | readonly string[] | undefined;
  payUpBps: number;
}): NormalizedSwapBook {
  if (!offerAsset || !receiveAsset) {
    return {
      pairMatches: [],
      rawCandidates: [],
      executable: [],
      candidates: [],
      filtered: [],
      skippedUnsupportedCount: 0,
      bookMinExecutableFilteredCount: 0,
      bookMinExecutableFilteredOfferQuantity: 0n,
      payUpSkippedCount: 0,
      payUpFallback: false,
      rawBestPrice: null,
      executableBestPrice: null,
    };
  }
  const excludedRefs = excludedUtxoRefs instanceof Set ? excludedUtxoRefs : new Set(excludedUtxoRefs || []);
  const pairMatches = offers.filter(
    (offer) =>
      !excludedRefs.has(openOfferKey(offer)) &&
      assetKeyOf(offer.offerPolicyId, offer.offerAssetName) === receiveAsset.assetKey &&
      assetKeyOf(offer.askPolicyId, offer.askAssetName) === offerAsset.assetKey,
  );
  const executable = pairMatches.filter((offer) => isExecutableOneWaySwap(offer, offerAsset, receiveAsset));
  const rawCandidates = [...executable].sort(comparePrice);
  const minExecutableOfferQuantity = positiveBigInt(receiveAsset.minExecutableOfferQuantity);
  const filtered: SwapFilteredOffer[] = [];
  const minExecutableFiltered = executable.filter((offer) => {
    const belowMinimum =
      minExecutableOfferQuantity > 0n && positiveBigInt(offer.utxoOfferQuantity) < minExecutableOfferQuantity;
    if (belowMinimum) filtered.push({ offer, reason: 'min-executable-offer' });
    return belowMinimum;
  });
  const minExecutableFilteredKeys = new Set(minExecutableFiltered.map(openOfferKey));
  const policyExecutable = executable.filter((offer) => !minExecutableFilteredKeys.has(openOfferKey(offer))).sort(comparePrice);
  const payUpResult = payUp ? payUpSorted(policyExecutable, payUpBps) : { offers: policyExecutable, skippedCount: 0, fallback: false };
  if (payUp && payUpResult.skippedCount) {
    policyExecutable.slice(0, payUpResult.skippedCount).forEach((offer) => filtered.push({ offer, reason: 'pay-up' }));
  }
  const candidates = payUpResult.offers.sort(comparePrice);
  return {
    pairMatches,
    rawCandidates,
    executable,
    candidates,
    filtered,
    skippedUnsupportedCount: pairMatches.length - executable.length,
    bookMinExecutableFilteredCount: minExecutableFiltered.length,
    bookMinExecutableFilteredOfferQuantity: minExecutableFiltered.reduce((total, offer) => total + positiveBigInt(offer.utxoOfferQuantity), 0n),
    payUpSkippedCount: payUpResult.skippedCount,
    payUpFallback: payUpResult.fallback,
    rawBestPrice: rawCandidates[0] ? priceOf(rawCandidates[0]) : null,
    executableBestPrice: candidates[0] ? priceOf(candidates[0]) : null,
  };
}

function emptyQuote(requestedInputQuantity: bigint): SwapQuote {
  return {
    requestedInputQuantity,
    executionInputQuantity: requestedInputQuantity,
    roundUpInputQuantity: 0n,
    filledInputQuantity: 0n,
    outputQuantity: 0n,
    unfilledRequestedQuantity: requestedInputQuantity,
    unfilledExecutionQuantity: requestedInputQuantity,
    routeDisplayQuantity: requestedInputQuantity,
    rawCandidateCount: 0,
    pairMatchCount: 0,
    candidateCount: 0,
    skippedUnsupportedCount: 0,
    bookMinExecutableFilteredCount: 0,
    bookMinExecutableFilteredOfferQuantity: 0n,
    filteredOffers: [],
    remainderAdjustmentCount: 0,
    remainderBlockedCount: 0,
    payUpSkippedCount: 0,
    payUpFallback: false,
    segments: [],
    rawBestPrice: null,
    executableBestPrice: null,
    lowestPrice: null,
    bestPrice: null,
    bestMeaningfulPrice: null,
    effectivePrice: null,
    marginalPrice: null,
    weightedSlippageBps: 0,
    marginalSlippageBps: 0,
    coverageBps: 0,
    severity: 'muted',
  };
}

export function quoteSwap({
  offers,
  offerAsset,
  receiveAsset,
  offerAmount,
  payUp,
  excludedUtxoRefs,
  slippageToleranceBps = 50,
  warningSlippageMultiplier = 0.7,
  payUpBps = 100,
}: SwapQuoteInput): SwapQuote {
  const requestedInputQuantity = offerAsset ? toBase(offerAmount, offerAsset.decimals) : 0n;
  const base = emptyQuote(requestedInputQuantity);
  if (!offerAsset || !receiveAsset || requestedInputQuantity <= 0n) return base;

  const normalized = normalizeSwapBook({ offers, offerAsset, receiveAsset, payUp, excludedUtxoRefs, payUpBps });
  const minMakerRemainderQuantity = positiveBigInt(receiveAsset.minMakerRemainderQuantity);
  const routeCandidates = normalized.candidates;
  let executionInputQuantity = requestedInputQuantity;
  let remainingInput = requestedInputQuantity;
  let remainderAdjustmentCount = 0;
  let remainderBlockedCount = 0;
  const rawSegments: SwapRouteSegment[] = [];

  for (const offer of routeCandidates) {
    if (remainingInput <= 0n) break;
    const price = priceOf(offer);
    const availableOfferQuantity = positiveBigInt(offer.utxoOfferQuantity);
    const fullAskQuantity = ceilDiv(availableOfferQuantity * price.numerator, price.denominator);
    let offerQuantity =
      remainingInput >= fullAskQuantity
        ? availableOfferQuantity
        : (remainingInput * price.denominator) / price.numerator;
    if (offerQuantity <= 0n) break;
    let baseOfferQuantity = offerQuantity;
    let roundUpOfferQuantity = 0n;
    let roundUpAskQuantity = 0n;
    let makerRemainderQuantity = availableOfferQuantity - offerQuantity;
    if (
      minMakerRemainderQuantity > 0n &&
      makerRemainderQuantity > 0n &&
      makerRemainderQuantity < minMakerRemainderQuantity &&
      fullAskQuantity > remainingInput
    ) {
      const roundUpInput = fullAskQuantity - remainingInput;
      executionInputQuantity += roundUpInput;
      remainingInput += roundUpInput;
      offerQuantity = availableOfferQuantity;
      roundUpOfferQuantity = offerQuantity - baseOfferQuantity;
      roundUpAskQuantity = roundUpInput;
      makerRemainderQuantity = 0n;
      remainderAdjustmentCount += 1;
    }
    if (
      minMakerRemainderQuantity > 0n &&
      makerRemainderQuantity > 0n &&
      makerRemainderQuantity < minMakerRemainderQuantity
    ) {
      remainderBlockedCount += 1;
      break;
    }

    const askQuantity = ceilDiv(offerQuantity * price.numerator, price.denominator);
    if (askQuantity <= 0n || askQuantity > remainingInput) break;
    const baseAskQuantity = askQuantity > roundUpAskQuantity ? askQuantity - roundUpAskQuantity : 0n;
    const makerRemainderAskEquivalentQuantity =
      makerRemainderQuantity > 0n ? ceilDiv(makerRemainderQuantity * price.numerator, price.denominator) : 0n;
    remainingInput -= askQuantity;
    rawSegments.push({
      offer,
      orderKind: normalizeOrderKind(offer.orderKind),
      utxoRef: openOfferKey(offer),
      offerQuantity,
      baseOfferQuantity,
      roundUpOfferQuantity,
      askQuantity,
      baseAskQuantity,
      roundUpAskQuantity,
      availableOfferQuantity,
      makerRemainderQuantity,
      makerRemainderAskEquivalentQuantity,
      makerRemainderBps: shareBps(makerRemainderQuantity, availableOfferQuantity),
      makerRemainderStatus:
        makerRemainderQuantity <= 0n
          ? 'none'
          : minMakerRemainderQuantity > 0n && makerRemainderQuantity < minMakerRemainderQuantity
            ? 'below-min-remainder'
            : 'valid',
      fillBps: shareBps(offerQuantity, availableOfferQuantity),
      routeBps: 0,
      routeDisplayBps: 0,
      inputShareBps: 0,
      filledShareBps: 0,
      outputShareBps: 0,
      price,
      priceDeviationBps: 0,
      segmentSlippageBps: 0,
      cumulativeSlippageBps: 0,
      severity: 'muted',
    });
  }

  const filledInputQuantity = executionInputQuantity - remainingInput;
  const filledRequestedQuantity =
    filledInputQuantity > requestedInputQuantity ? requestedInputQuantity : filledInputQuantity;
  const unfilledRequestedQuantity = requestedInputQuantity - filledRequestedQuantity;
  const makerRemainderDisplayQuantity = rawSegments.reduce(
    (total, segment) => total + segment.makerRemainderAskEquivalentQuantity,
    0n,
  );
  const routeDisplayQuantity = executionInputQuantity + makerRemainderDisplayQuantity;
  const outputQuantity = rawSegments.reduce((total, segment) => total + segment.offerQuantity, 0n);
  const effectivePrice =
    filledInputQuantity > 0n && outputQuantity > 0n
      ? { numerator: filledInputQuantity, denominator: outputQuantity }
      : null;
  const marginalPrice = rawSegments[rawSegments.length - 1]?.price || null;
  const weightedSlippageBps = priceDeviationBps(effectivePrice, normalized.executableBestPrice);
  const marginalSlippageBps = priceDeviationBps(marginalPrice, normalized.executableBestPrice);
  const severity =
    outputQuantity > 0n ? severityForSlippage(weightedSlippageBps, slippageToleranceBps, warningSlippageMultiplier) : 'muted';

  return {
    requestedInputQuantity,
    executionInputQuantity,
    roundUpInputQuantity: executionInputQuantity - requestedInputQuantity,
    filledInputQuantity,
    outputQuantity,
    unfilledRequestedQuantity,
    unfilledExecutionQuantity: remainingInput,
    routeDisplayQuantity,
    rawCandidateCount: normalized.rawCandidates.length,
    pairMatchCount: normalized.pairMatches.length,
    candidateCount: normalized.candidates.length,
    skippedUnsupportedCount: normalized.skippedUnsupportedCount,
    bookMinExecutableFilteredCount: normalized.bookMinExecutableFilteredCount,
    bookMinExecutableFilteredOfferQuantity: normalized.bookMinExecutableFilteredOfferQuantity,
    filteredOffers: normalized.filtered,
    remainderAdjustmentCount,
    remainderBlockedCount,
    payUpSkippedCount: normalized.payUpSkippedCount,
    payUpFallback: normalized.payUpFallback,
    rawBestPrice: normalized.rawBestPrice,
    executableBestPrice: normalized.executableBestPrice,
    lowestPrice: normalized.executableBestPrice,
    bestPrice: normalized.executableBestPrice,
    bestMeaningfulPrice: normalized.executableBestPrice,
    effectivePrice,
    marginalPrice,
    weightedSlippageBps,
    marginalSlippageBps,
    coverageBps: shareBps(filledRequestedQuantity, requestedInputQuantity),
    severity,
    segments: (() => {
      let cumulativeInput = 0n;
      let cumulativeOutput = 0n;
      return rawSegments.map((segment) => {
        cumulativeInput += segment.askQuantity;
        cumulativeOutput += segment.offerQuantity;
        const cumulativePrice =
          cumulativeInput > 0n && cumulativeOutput > 0n
            ? { numerator: cumulativeInput, denominator: cumulativeOutput }
            : null;
        const segmentSlippageBps = priceDeviationBps(segment.price, normalized.executableBestPrice);
        const cumulativeSlippageBps = priceDeviationBps(cumulativePrice, normalized.executableBestPrice);
        return {
          ...segment,
          routeBps: shareBps(segment.askQuantity, executionInputQuantity),
          routeDisplayBps: shareBps(segment.askQuantity, routeDisplayQuantity),
          inputShareBps: shareBps(segment.askQuantity, executionInputQuantity),
          filledShareBps: shareBps(segment.askQuantity, filledInputQuantity),
          outputShareBps: shareBps(segment.offerQuantity, outputQuantity),
          priceDeviationBps: segmentSlippageBps,
          segmentSlippageBps,
          cumulativeSlippageBps,
          severity: severityForSlippage(cumulativeSlippageBps, slippageToleranceBps, warningSlippageMultiplier),
        };
      });
    })(),
  };
}
