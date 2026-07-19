import { createOpenBookSnapshot, openBookSnapshotIsFresh } from '../src/domain/openBook';
import { assetMetadataWarningText } from '../src/domain/assetWarnings';
import { parseSwapDatum } from '../src/domain/cardano';
import {
  defaultMinExecutableOfferQuantity,
  defaultMinMakerRemainderQuantity,
  normalizeBaseUnitQuantity,
} from '../src/domain/assetPolicy';
import { quoteSwap, summarizeSwapBookPolicyFilters } from '../src/domain/swapQuote';
import { formatBalancePercent } from '../src/domain/uiFormat';
import type { OpenOffer, ResolvedAsset } from '../src/state/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const v2MainnetUsdmDatumHex =
  'd8799f581cc4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e2095820ad02cd8545df05b9982c030a26a93d51fcb3784ddf6381ffa3b5a9cb275c4ca5404058204bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a581cc48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad480014df105553444d582078972b4dafbb82894e044ca5bd262798316abb12cd9c2aaa1986ebf6ea35e039d8799f1913bd197a12ffd8799fd8799fd8799f5820763c06b46ac504a63fc4a77b44ac48b48a5bb334a594bedc07ab0b0166fca41dff00ffffd87a80ff';
const v1PreprodUsdmDatumHex =
  'd8799f581c47cec2a1404ed91fc31124f29db15dc1aae77e0617868bcef351b8fd582068821a75a63e555d1b1e41512a4071a0ec379136d2e0a6e9e77b5b65db37df33404058204bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a581cd4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7445553444d58202750c41544d0d20278f60e01a94716c58094e2c4b8d4fd69007f9a5f7bb7fa4bd8799f0103ffd87a80ff';

const mainnetUsdmDatum = parseSwapDatum(v2MainnetUsdmDatumHex, 'v2');
const preprodV1UsdmDatum = parseSwapDatum(v1PreprodUsdmDatumHex, 'v1');

assert(mainnetUsdmDatum?.offerPolicyId === 'ada', 'mainnet sample datum decodes ADA as the offered asset');
assert(mainnetUsdmDatum?.offerAssetName === 'ada', 'mainnet sample datum normalizes empty ADA asset name');
assert(
  mainnetUsdmDatum?.askPolicyId === 'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad',
  'mainnet sample datum decodes USDM ask policy',
);
assert(mainnetUsdmDatum?.askAssetName === '0014df105553444d', 'mainnet sample datum decodes USDM asset name');
assert(preprodV1UsdmDatum?.offerPolicyId === 'ada', 'preprod v1 sample datum decodes ADA as the offered asset');
assert(preprodV1UsdmDatum?.offerAssetName === 'ada', 'preprod v1 sample datum normalizes empty ADA asset name');
assert(
  preprodV1UsdmDatum?.askPolicyId === 'd4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7',
  'preprod v1 sample datum decodes USDM ask policy',
);
assert(preprodV1UsdmDatum?.askAssetName === '5553444d', 'preprod v1 sample datum decodes USDM asset name');
assert(preprodV1UsdmDatum?.priceNumerator === '1', 'preprod v1 sample datum decodes price numerator');
assert(preprodV1UsdmDatum?.priceDenominator === '3', 'preprod v1 sample datum decodes price denominator');
assert(preprodV1UsdmDatum?.previousInput === null, 'preprod v1 open datum has no previous input');
assert(parseSwapDatum(v1PreprodUsdmDatumHex, 'v2') === null, 'v2 parsing rejects the shorter audited v1 datum shape');

const offered: ResolvedAsset = {
  policyId: 'policy-a',
  assetNameHex: 'asset-a',
  assetKey: 'policy-a.asset-a',
  assetId: 'policy-aasset-a',
  label: 'Asset A',
  ticker: 'A',
  decimals: 0,
  minExecutableOfferQuantity: '0',
  minMakerRemainderQuantity: '0',
};

const received: ResolvedAsset = {
  policyId: 'policy-b',
  assetNameHex: 'asset-b',
  assetKey: 'policy-b.asset-b',
  assetId: 'policy-basset-b',
  label: 'Asset B',
  ticker: 'B',
  decimals: 0,
  minExecutableOfferQuantity: '0',
  minMakerRemainderQuantity: '0',
};

assert(defaultMinExecutableOfferQuantity('ada', 'ada', 6) === '5000000', 'ADA default executable offer threshold is 5 ADA/tADA');
assert(defaultMinMakerRemainderQuantity('ada', 'ada', 6) === '5000000', 'ADA default maker-remainder threshold is 5 ADA/tADA');
assert(defaultMinExecutableOfferQuantity('policy', 'asset', 6) === '10000', 'token default executable offer threshold is 0.01 display units');
assert(defaultMinMakerRemainderQuantity('policy', 'asset', 6) === '10000', 'token default maker-remainder threshold is 0.01 display units');
assert(normalizeBaseUnitQuantity('0', '123') === '0', 'explicit zero executable threshold is preserved');
assert(normalizeBaseUnitQuantity('000', '123') === '0', 'explicit zero maker-remainder threshold is preserved');

function order(
  id: string,
  priceNumerator: string,
  priceDenominator: string,
  quantity: string,
  orderKind: OpenOffer['orderKind'] = 'one-way',
): OpenOffer {
  return {
    id,
    orderKind,
    txHash: id.padEnd(64, '0').slice(0, 64),
    txIndex: '0',
    address: 'addr_test',
    ownerStakeKeyHash: 'stake',
    utxoCoinQuantity: '3000000',
    utxoOfferQuantity: quantity,
    utxoAskQuantity: '0',
    pairBeacon: 'pair',
    offerPolicyId: received.policyId,
    offerAssetName: received.assetNameHex,
    offerBeacon: 'offer',
    askPolicyId: offered.policyId,
    askAssetName: offered.assetNameHex,
    askBeacon: 'ask',
    priceNumerator,
    priceDenominator,
  };
}

const basic = quoteSwap({
  offers: [
    order('a', '2', '1', '5'),
    order('b', '3', '1', '5'),
    order('c', '1', '1', '100', 'two-way'),
    order('d', '1', '1', '100', 'future'),
  ],
  offerAsset: offered,
  receiveAsset: received,
  offerAmount: '13',
  payUp: false,
});

assert(basic.segments.length === 2, 'routes across two one-way orders');
assert(basic.skippedUnsupportedCount === 2, 'isolates unsupported/future matching orders');
assert(basic.filledInputQuantity === 13n, 'fills all offered input when enough depth exists');
assert(basic.outputQuantity === 6n, 'computes received quantity from ordered limit prices');
assert(basic.unfilledRequestedQuantity === 0n, 'does not report leftover for fully routed requested input');
assert(basic.segments[0]?.utxoRef.endsWith('#0'), 'uses txHash#index route keys');
assert(basic.segments[1]?.makerRemainderQuantity === 4n, 'partial order segment reports maker-side receive-asset remainder');
assert(basic.segments[1]?.makerRemainderStatus === 'valid', 'normal partial order remainder is valid maker-side liquidity');
assert(basic.segments[1]?.makerRemainderBps === 8000, 'maker-side remainder percentage uses the order offered amount as denominator');
assert(basic.segments[1]?.makerRemainderAskEquivalentQuantity === 12n, 'maker-side remainder has an input-equivalent display quantity');
assert(basic.routeDisplayQuantity === 25n, 'route display denominator includes execution input plus maker-remainder input equivalent');

const bookedExcluded = quoteSwap({
  offers: [order('a', '2', '1', '5'), order('b', '3', '1', '5')],
  offerAsset: offered,
  receiveAsset: received,
  offerAmount: '10',
  payUp: false,
  excludedUtxoRefs: new Set([`${'a'.padEnd(64, '0').slice(0, 64)}#0`]),
});

assert(bookedExcluded.rawCandidateCount === 1, 'booked UTxOs are excluded before raw route candidate math');
assert(bookedExcluded.segments.length === 1, 'booked UTxOs are not routed as swap segments');
assert(bookedExcluded.segments[0]?.offer.id.startsWith('b'), 'router skips booked UTxOs and routes through the next available order');
assert(bookedExcluded.outputQuantity === 3n, 'route output is recalculated after booked UTxO exclusion');
assert(bookedExcluded.effectivePrice?.numerator === 9n, 'effective price uses only the remaining routed liquidity');

const boundaryBook = [order('ba', '1', '1', '100'), order('bb', '2', '1', '100'), order('bc', '3', '1', '100')];
const bookedBoundaryRef = `${'ba'.padEnd(64, '0').slice(0, 64)}#0`;
const excludedBoundary = quoteSwap({
  offers: boundaryBook,
  offerAsset: offered,
  receiveAsset: { ...received, minMakerRemainderQuantity: '10' },
  offerAmount: '95',
  payUp: false,
  excludedUtxoRefs: [bookedBoundaryRef],
});
const prefilteredBoundary = quoteSwap({
  offers: boundaryBook.filter((item) => `${item.txHash}#${item.txIndex}` !== bookedBoundaryRef),
  offerAsset: offered,
  receiveAsset: { ...received, minMakerRemainderQuantity: '10' },
  offerAmount: '95',
  payUp: false,
});

assert(excludedBoundary.outputQuantity === prefilteredBoundary.outputQuantity, 'booked-UTxO exclusion matches prefiltered book output at route boundaries');
assert(excludedBoundary.routeDisplayQuantity === prefilteredBoundary.routeDisplayQuantity, 'booked-UTxO exclusion matches prefiltered book route-bar denominator');
assert(excludedBoundary.unfilledRequestedQuantity === prefilteredBoundary.unfilledRequestedQuantity, 'booked-UTxO exclusion matches prefiltered book unavailable input');
assert(excludedBoundary.segments.map((segment) => segment.utxoRef).join(',') === prefilteredBoundary.segments.map((segment) => segment.utxoRef).join(','), 'booked-UTxO exclusion preserves normal route segment selection');

const paidUp = quoteSwap({
  offers: [order('a', '100', '100', '100'), order('b', '1005', '1000', '100'), order('c', '102', '100', '100')],
  offerAsset: offered,
  receiveAsset: received,
  offerAmount: '102',
  payUp: true,
  payUpBps: 100,
});

assert(paidUp.segments[0]?.offer.id.startsWith('c'), 'pay-up skips cheaper orders inside the configured premium band');
assert(paidUp.payUpSkippedCount === 2, 'pay-up reports skipped cheaper orders');
assert(paidUp.filteredOffers.filter((item) => item.reason === 'pay-up').length === 2, 'pay-up filtered offers stay out of route math');
assert(paidUp.segments[0]?.priceDeviationBps === 0, 'pay-up baseline excludes filtered cheaper orders');
assert(paidUp.outputQuantity === 100n, 'pay-up route still computes executable output');

const payUpFallback = quoteSwap({
  offers: [order('a', '100', '100', '100'), order('b', '1005', '1000', '100')],
  offerAsset: offered,
  receiveAsset: received,
  offerAmount: '100',
  payUp: true,
  payUpBps: 100,
});

assert(payUpFallback.payUpFallback, 'pay-up falls back to cheapest route when the premium band would remove all liquidity');
assert(payUpFallback.segments[0]?.offer.id.startsWith('a'), 'pay-up fallback preserves executable cheapest liquidity');

const minimumExecutableAsset: ResolvedAsset = { ...received, minExecutableOfferQuantity: '2' };
const minExecutableFiltered = quoteSwap({
  offers: [order('below', '1', '1', '1'), order('ok', '1', '1', '4')],
  offerAsset: offered,
  receiveAsset: minimumExecutableAsset,
  offerAmount: '4',
  payUp: false,
});

assert(minExecutableFiltered.bookMinExecutableFilteredCount === 1, 'filters order UTxOs below the minimum executable offer quantity');
assert(minExecutableFiltered.bookMinExecutableFilteredOfferQuantity === 1n, 'reports filtered below-minimum liquidity amount');
assert(minExecutableFiltered.filteredOffers[0]?.reason === 'min-executable-offer', 'minimum executable filtering is normalized before route math');
assert(minExecutableFiltered.segments.length === 1, 'does not route through below-minimum executable liquidity');
assert(minExecutableFiltered.pairMatchCount === 2, 'live pair-match count includes below-policy open orders for market visibility');
assert(minExecutableFiltered.rawCandidateCount === 2, 'keeps raw canonical candidates separate from policy executable candidates');
assert(minExecutableFiltered.candidateCount === 1, 'policy executable candidates exclude below-minimum offers');

const adaAsset: ResolvedAsset = {
  policyId: 'ada',
  assetNameHex: 'ada',
  assetKey: 'ada.ada',
  assetId: 'lovelace',
  label: 'ADA',
  ticker: 'ADA',
  decimals: 6,
  minExecutableOfferQuantity: '0',
  minMakerRemainderQuantity: '1000000',
};
const adaSafe = quoteSwap({
  offers: [
    {
      ...order('ada', '1', '1', '1500000'),
      offerPolicyId: adaAsset.policyId,
      offerAssetName: adaAsset.assetNameHex,
    },
  ],
  offerAsset: offered,
  receiveAsset: adaAsset,
  offerAmount: '1000000',
  payUp: false,
});

assert(adaSafe.requestedInputQuantity === 1000000n, 'preserves the raw ADA-boundary user amount');
assert(adaSafe.executionInputQuantity === 1500000n, 'rounds ADA-boundary input to consume the full order');
assert(adaSafe.roundUpInputQuantity === 500000n, 'reports the ADA-boundary round-up amount');
assert(adaSafe.outputQuantity === 1500000n, 'fills ADA orders fully when a partial fill would leave sub-min-coin change');
assert(adaSafe.remainderAdjustmentCount === 1, 'reports route round-up for maker-remainder safety');
assert(adaSafe.remainderBlockedCount === 0, 'does not classify rounded route as blocked');
assert(adaSafe.unfilledRequestedQuantity === 0n, 'rounded ADA route does not leave requested input left over');

const partialRoute = quoteSwap({
  offers: [order('p1', '1', '1', '10'), order('p2', '1', '1', '5')],
  offerAsset: offered,
  receiveAsset: received,
  offerAmount: '20',
  payUp: false,
});

assert(partialRoute.segments[0]?.inputShareBps === 5000, 'first route segment width reflects input share');
assert(partialRoute.segments[1]?.inputShareBps === 2500, 'second route segment width reflects input share');
assert(partialRoute.unfilledRequestedQuantity === 5n, 'partial route reports offered amount not filled');

const smallFillValidRemainder = quoteSwap({
  offers: [order('u1', '1', '1', '210'), order('u2', '2', '1', '100'), order('u3', '3', '1', '100')],
  offerAsset: offered,
  receiveAsset: { ...received, minMakerRemainderQuantity: '21' },
  offerAmount: '250',
  payUp: false,
});

assert(smallFillValidRemainder.segments.length === 2, 'small partial fills route when the maker remainder stays above the configured minimum');
assert(smallFillValidRemainder.outputQuantity === 230n, 'valid small partial fills contribute to output math');
assert(smallFillValidRemainder.remainderBlockedCount === 0, 'valid maker remainder does not block the route');
assert(smallFillValidRemainder.unfilledRequestedQuantity === 0n, 'valid small partial fill does not create artificial leftover input');
assert(smallFillValidRemainder.segments[1]?.makerRemainderQuantity === 80n, 'maker remainder threshold is evaluated against remaining maker liquidity');

const roundedBoundary = quoteSwap({
  offers: [order('r1', '1', '1', '100'), order('r2', '2', '1', '100')],
  offerAsset: offered,
  receiveAsset: { ...received, minMakerRemainderQuantity: '10' },
  offerAmount: '95',
  payUp: false,
});

assert(roundedBoundary.requestedInputQuantity === 95n, 'quote preserves the raw user-requested input');
assert(roundedBoundary.executionInputQuantity === 100n, 'quote uses the rounded protocol-safe input for downstream math');
assert(roundedBoundary.roundUpInputQuantity === 5n, 'quote exposes the rounded input amount for UI warnings');
assert(roundedBoundary.routeDisplayQuantity === 100n, 'rounded full-fill route display denominator equals execution input when no maker remainder remains');
assert(roundedBoundary.segments[0]?.baseAskQuantity === 95n, 'rounded segment preserves user-requested input separate from round-up input');
assert(roundedBoundary.segments[0]?.roundUpAskQuantity === 5n, 'rounded segment exposes the per-segment round-up input');
assert(roundedBoundary.segments[0]?.baseOfferQuantity === 95n, 'rounded segment preserves user-requested output separate from round-up output');
assert(roundedBoundary.segments[0]?.roundUpOfferQuantity === 5n, 'rounded segment exposes the output attributable to round-up');
assert(roundedBoundary.remainderAdjustmentCount === 1, 'quote reports that one route boundary required input round-up');
assert(roundedBoundary.filledInputQuantity === 100n, 'rounded quote fills the whole order at the boundary');
assert(roundedBoundary.outputQuantity === 100n, 'rounded quote consumes the whole order instead of leaving a below-minimum maker remainder');
assert(roundedBoundary.unfilledRequestedQuantity === 0n, 'rounded quote does not leave artificial unrouted requested input');
assert(roundedBoundary.segments.length === 1, 'rounded quote does not skip ahead after resolving the boundary');
assert(roundedBoundary.segments[0]?.makerRemainderQuantity === 0n, 'rounded boundary leaves no maker-side below-minimum remainder');
assert(roundedBoundary.segments[0]?.makerRemainderStatus === 'none', 'fully consumed rounded boundary reports no maker-side remainder');

const cumulativeRoute = quoteSwap({
  offers: [order('m1', '100', '100', '100'), order('m2', '102', '100', '100'), order('m3', '110', '100', '100')],
  offerAsset: offered,
  receiveAsset: received,
  offerAmount: '312',
  payUp: false,
  slippageToleranceBps: 120,
});

assert(cumulativeRoute.segments[0]?.segmentSlippageBps === 0, 'first segment has no per-order slippage');
assert(cumulativeRoute.segments[1]?.segmentSlippageBps === 200, 'second segment keeps per-order slippage for tooltip detail');
assert(cumulativeRoute.segments[1]?.cumulativeSlippageBps === 100, 'second segment color uses cumulative route slippage');
assert(cumulativeRoute.segments[2]?.cumulativeSlippageBps === 400, 'cumulative route slippage does not regress deeper in the book');
assert(cumulativeRoute.segments[1]?.severity === 'warning', 'segment severity follows cumulative slippage threshold');
assert(cumulativeRoute.segments[2]?.severity === 'danger', 'deep segment severity follows cumulative slippage threshold');

const policySummary = summarizeSwapBookPolicyFilters([order('below2', '1', '1', '1'), order('ok2', '1', '1', '4')], offered, minimumExecutableAsset);
assert(policySummary.count === 1, 'book-level policy summary counts below-minimum offers across the canonical pair book');
assert(policySummary.offerQuantity === 1n, 'book-level policy summary reports filtered receive-asset amount');

const bookPolicyLowDepth = quoteSwap({
  offers: [order('below3', '1', '1', '1'), order('ok3', '1', '1', '100')],
  offerAsset: offered,
  receiveAsset: minimumExecutableAsset,
  offerAmount: '4',
  payUp: false,
});
const bookPolicyHighDepth = quoteSwap({
  offers: [order('below3', '1', '1', '1'), order('ok3', '1', '1', '100')],
  offerAsset: offered,
  receiveAsset: minimumExecutableAsset,
  offerAmount: '40',
  payUp: false,
});
assert(bookPolicyLowDepth.bookMinExecutableFilteredCount === 1, 'book-level executable-offer filtering is stable for shallow quotes');
assert(bookPolicyHighDepth.bookMinExecutableFilteredCount === 1, 'book-level executable-offer filtering is stable for deeper quotes');

const zeroExecutableThreshold = quoteSwap({
  offers: [order('zero', '1', '1', '1')],
  offerAsset: offered,
  receiveAsset: { ...received, minExecutableOfferQuantity: '0' },
  offerAmount: '1',
  payUp: false,
});
assert(zeroExecutableThreshold.bookMinExecutableFilteredCount === 0, 'zero minimum executable threshold disables book-level filtering');
assert(zeroExecutableThreshold.outputQuantity === 1n, 'zero minimum executable threshold keeps tiny executable offers routable');

const zeroMakerRemainderThreshold = quoteSwap({
  offers: [order('zero-rem', '1', '1', '100')],
  offerAsset: offered,
  receiveAsset: { ...received, minMakerRemainderQuantity: '0' },
  offerAmount: '99',
  payUp: false,
});
assert(zeroMakerRemainderThreshold.remainderAdjustmentCount === 0, 'zero maker-remainder threshold disables route round-up');
assert(zeroMakerRemainderThreshold.segments[0]?.makerRemainderQuantity === 1n, 'zero maker-remainder threshold allows tiny maker remainders');
assert(zeroMakerRemainderThreshold.segments[0]?.makerRemainderAskEquivalentQuantity === 1n, 'maker remainder input equivalent is available for route-bar sizing');
assert(zeroMakerRemainderThreshold.routeDisplayQuantity === 100n, 'route display includes adjacent maker liquidity without changing execution input');

const unsupportedOnly = quoteSwap({
  offers: [order('x', '1', '1', '10', 'unknown')],
  offerAsset: offered,
  receiveAsset: received,
  offerAmount: '10',
  payUp: false,
});

assert(unsupportedOnly.segments.length === 0, 'unsupported order types never enter executable route');
assert(unsupportedOnly.skippedUnsupportedCount === 1, 'unsupported matching orders remain visible to diagnostics');

const snapshot = createOpenBookSnapshot('graphqlMk2', 'preprod', 2, 1_000);
assert(openBookSnapshotIsFresh(snapshot, 'graphqlMk2', 'preprod', 1_500, 1_000), 'fresh snapshot is usable');
assert(!openBookSnapshotIsFresh(snapshot, 'blockfrost', 'preprod', 1_500, 1_000), 'provider fallback cannot reuse another provider snapshot');
assert(!openBookSnapshotIsFresh(snapshot, 'graphqlMk2', 'mainnet', 1_500, 1_000), 'network mismatch isolates snapshots');
assert(!openBookSnapshotIsFresh(snapshot, 'graphqlMk2', 'preprod', 3_000, 1_000), 'stale snapshots force refresh');

assert(formatBalancePercent(0) === '0%', 'formats empty balance progress explicitly');
assert(formatBalancePercent(0.005) === '<0.01%', 'keeps tiny non-zero balances visible');
assert(formatBalancePercent(0.125) === '0.125%', 'keeps sub-one-percent precision');
assert(formatBalancePercent(123.456) === '123.5%', 'rounds regular balance progress for UI display');

assert(assetMetadataWarningText(offered) === '', 'known configured assets do not show precision warnings');
assert(
  assetMetadataWarningText({ ...offered, known: false, decimalsKnown: false }).includes('precision unknown'),
  'fallback assets show precision warning in the pair picker',
);
assert(
  assetMetadataWarningText({ ...offered, registered: false }).includes('unregistered asset'),
  'explicitly unregistered assets show a pair-picker warning',
);
