# Swap

NeonSoup Swap presents an AMM-like UI while routing against P2P DeFi Kernel
order UTxOs. The quote engine is shared by Frontend and DevTool, works in base
units with `bigint`, and applies display decimals only when rendering.

## Order-Book Layers

- `rawCanonicalBook`: all discovered protocol-valid pair order UTxOs, keyed by
  `txHash#index` and sorted deterministically by price then UTxO. This is the
  chain-backed source of truth for diagnostics and table rendering.
- `policyExecutableBook`: raw candidates after local routing policy filters:
  unsupported order type, wrong direction, below-minimum executable offer, and
  optional pay-up filtering. Cart-booked source UTxOs are also excluded before
  quote math when the UI is preparing additional Cart operations. This is the
  source for best executable price and slippage baselines.
- `route`: the selected fill path for the current user amount after
  maker-remainder decisions. This is the source for effective price, route bar
  segments, warnings, balance checks, and cart items.

Filtered raw orders do not participate in effective price, slippage, route
colors, or cart generation. They remain visible as diagnostics with their policy
reason.

## Cart-Booked UTxO Exclusion

Cart Mode lets users queue multiple Swap/Close operations before wallet launch.
Every Cart item that consumes a source order UTxO books that `txHash#index`
until the item is removed or app state is reconciled. The Cart is the single
source of truth for these booked source references.

Booked source UTxOs must be removed from available liquidity before all quote
and routing calculations for subsequent operations. This affects executable
depth, best executable price, effective final price, route segments, route-bar
denominator, slippage/price impact, user validation, CTA enablement, and
generated Cart item snapshots.

Excluding booked UTxOs must be equivalent to manually pre-filtering the raw
book. Do not change route denominator, segment category, or route-bar styling to
compensate for a booked-UTxO bug. New Cart items should not collide on the same
source UTxO; collision badges are only diagnostics for existing persisted or
unexpected state.

## Two-Way Swap Status

Current NeonSoup Swap execution routes one-way order UTxOs only.
Two-way swaps are represented in planning and future-facing order types, but are
currently treated as unsupported liquidity by the executable quote engine.

Future two-way support must add provider discovery, directional normalization,
and two-way-specific wallet protocol fragments/redeemers. Do not route a
two-way liquidity position through the one-way datum or redeemer shape.

## Per-Asset Policy Parameters

Both parameters are base-unit integer strings on each asset definition. `0` is
valid for coins and native assets and disables that policy independently.

- `minExecutableOfferQuantity`: book-level open-order consumption filter.
  Formula:
  `availableOfferQuantity < minExecutableOfferQuantity => exclude from policyExecutableBook`.
  This protects users from spam-sized order UTxOs, fee-inefficient routes, and
  API-heavy noise before quote math runs.

- `minMakerRemainderQuantity`: route-boundary partial-fill policy. Formula:
  `makerRemainderQuantity = availableOfferQuantity - routedOfferQuantity`.
  If the maker remainder is positive and below this value, the quote should
  round up to consume the full order when possible. If it cannot safely round
  up, the remaining user input becomes `unrouted-input`.

Default policy:

- ADA/tADA: `5_000_000` lovelace.
- Other assets: `0.01` display units converted to base units using asset
  decimals.

These values are local routing heuristics. They do not prove Cardano ledger
min-ADA safety; exact safety depends on the final continuing output size,
beacons, datum, accumulated ask assets, protocol parameters, and wallet builder.

### Why The Policy Is Split

Do not collapse these parameters back into one threshold. They answer different
questions and affect different parts of the quote:

- `minExecutableOfferQuantity` asks whether an order-book UTxO is worth
  considering at all. It protects users from fee-inefficient spam offers,
  protects API providers from noisy deep scans, and lets markets set custom
  minimum actionable depth.
- `minMakerRemainderQuantity` asks whether a selected partial fill would leave
  a maker-side remainder that should stay on-chain. It controls round-up or
  unrouted-input behavior at route boundaries.

Using one value for both caused price and UX regressions: tiny input slices were
blocked even when the maker remainder was valid, book-level filtering oscillated
with typed amount, and route bars mixed unrelated concepts. Keep book filtering,
route-boundary decisions, and UI summaries tied to their own fields.

Thresholds affect price because filtered offers are excluded from executable
best price, effective price, slippage, route colors, and cart generation.
Therefore they must be explicit, per-asset, configurable, and visible in the
book diagnostics. They are not cosmetic labels.

## Glossary

- `requestedInputQuantity`: amount typed by the user, converted to base units.
  Formula: `toBase(userInput, offerAsset.decimals)`.

- `executionInputQuantity`: amount the protocol route intends to spend after
  any minimum-remainder round-up. This is the canonical input for quote math,
  balance checks, route segment percentages, and cart generation.
  Formula: `requestedInputQuantity + roundUpInputQuantity`.

- `roundUpInputQuantity`: extra input suggested by the quote engine to fully
  consume the current order when a partial fill would leave a maker remainder
  below `minMakerRemainderQuantity`.
  Formula: `executionInputQuantity - requestedInputQuantity`.

- `baseAskQuantity`: part of a route segment paid by the user's typed amount
  before any minimum-remainder round-up.

- `roundUpAskQuantity`: part of a route segment paid by the extra round-up
  input.

- `baseOfferQuantity`: receive-asset output attributable to
  `baseAskQuantity`.

- `roundUpOfferQuantity`: receive-asset output attributable to
  `roundUpAskQuantity`.

- `filledInputQuantity`: input actually consumed by selected route segments.
  Formula: `sum(segment.askQuantity)`.

- `makerRemainderQuantity`: receive-asset liquidity left in a maker order after
  a partial fill. It is denominated in `receiveAsset`, not `offerAsset`.
  Formula: `segment.availableOfferQuantity - segment.offerQuantity`.

- `makerRemainderAskEquivalentQuantity`: input-asset amount that would be needed
  to consume `makerRemainderQuantity` at the segment price. This is used only to
  size maker-remainder visualization beside input-denominated segments.
  Formula:
  `ceil(makerRemainderQuantity * segment.price.numerator / segment.price.denominator)`.

- `makerRemainderBps`: maker-side remainder share of the order's original
  offered liquidity. Formula:
  `makerRemainderQuantity / segment.availableOfferQuantity * 10000`.

- `makerRemainderStatus`: `none` when the order is fully consumed, `valid` when
  the remaining maker-side liquidity can stay in the order, and
  `below-min-remainder` when the remainder is below
  `minMakerRemainderQuantity`.

- `unfilledRequestedQuantity`: part of the user's typed amount that cannot be
  routed at the current book depth or maker-remainder boundary. Formula:
  `requestedInputQuantity - min(filledInputQuantity, requestedInputQuantity)`.

- `unfilledExecutionQuantity`: part of the execution amount not consumed by the
  route. Formula: `executionInputQuantity - filledInputQuantity`.

- `routeDisplayQuantity`: route-bar denominator. Formula:
  `executionInputQuantity + sum(segment.makerRemainderAskEquivalentQuantity)`.
  It exists only for coherent visualization of user input, round-up input, and
  adjacent maker-side liquidity on one bar.

- `outputQuantity`: total received amount from selected order UTxOs.
  Formula: `sum(segment.offerQuantity)`.

- `effectivePrice`: actual route price after all selected fills.
  Formula: `filledInputQuantity / outputQuantity`.

- `rawBestPrice`: best price in the raw canonical book before policy filters.
  This is diagnostic only.

- `executableBestPrice`: best price after local executable-policy filters and
  pay-up filters. This is the quote baseline.

- `lowestPrice`: UI alias for `executableBestPrice`.

- `weightedSlippageBps`: effective route deviation from
  `executableBestPrice`. Formula:
  `max(0, effectivePrice / executableBestPrice - 1) * 10000`.

- `marginalSlippageBps`: last selected segment price deviation from
  `executableBestPrice`.

- `segmentSlippageBps`: individual segment price deviation from
  `executableBestPrice`. This belongs in debug detail or tooltips.

- `cumulativeSlippageBps`: route price deviation after including each segment
  from cheapest to deepest. This drives segment color because it matches the
  user's effective route at each boundary.

- `bookMinExecutableFilteredCount`: count of on-chain order UTxOs excluded from
  `policyExecutableBook` because their available offered amount is below
  `minExecutableOfferQuantity`.

- `bookMinExecutableFilteredOfferQuantity`: sum of offered amounts removed by
  the book-level executable-offer filter.

- `remainderAdjustmentCount`: count of quote-specific route boundaries where
  the engine rounded input up to consume an order fully and avoid a
  below-minimum maker remainder.

- `remainderBlockedCount`: count of quote-specific route boundaries that could
  not satisfy the maker-remainder policy. These create
  `unfilledRequestedQuantity`.

- `payUpSkippedCount`: count of cheaper executable orders intentionally skipped
  by the opt-in contention-premium mode.

- `payUpFallback`: true when pay-up mode would remove all available liquidity,
  so the quote falls back to the cheapest executable route.

## Continuing Output Min-ADA Policy

The real safety question for a partial fill is whether the projected continuing
maker UTxO remains ledger-valid without requiring the taker to donate ADA. The
continuing output contains the same swap address, beacons, updated inline datum,
remaining offered asset, accumulated ask asset, and lovelace. Its required
minimum ADA is output-size dependent.

Ideal policy:

1. If the on-chain open order is not min-ADA safe for its current value, filter
   it out as malformed or unsafe.
2. If the fill consumes the order fully, route it because no maker-side offered
   remainder must be preserved.
3. Otherwise, project the continuing output after the fill.
4. If the projected continuing output is min-ADA safe using the order's own
   lovelace, route it.
5. If the projected continuing output needs extra ADA from the taker and the
   order offered asset is coin, round up to a full fill when balance and UX
   policy allow; otherwise stop and expose `unrouted-input`.
6. If the projected continuing output needs extra ADA from the taker and the
   order offered asset is a native token, treat the order as coin-expensive for
   this route, skip/filter it, and continue with the canonical book order when
   execution semantics allow.

NeonSoup currently delegates exact transaction construction to GameChanger
Wallet. The dapp does not have the final serialized tx body, final output sizes,
coin selection, fee balancing, or wallet-specific min-UTxO adjustment details.
Therefore `projectedContinuingOutputMinAdaSafe` cannot be exact on the dapp side
unless NeonSoup implements the same min-UTxO calculation for projected script
outputs and mirrors the wallet builder's value layout.

Until exact projected min-ADA checks are implemented, use conservative
dapp-side thresholds as route suggestions, re-quote before wallet launch, and
let GC reject or rebalance invalid transactions. The UI must describe route
round-up and unrouted input as local safety margins, not exact ledger proofs.

## Fill And Close Value Accounting

One-way swap execution must account for role quantities separately from asset
identity. A Plutus trace such as `offer_taken * price <= ask_given` can be a
continuing-output value bug even when quote rounding is correct. In the
multi-transaction bundled-cart failure investigated on 2026-07-03, each
`ask-quantity` satisfied:

```txt
ask_quantity = ceil(offer_taken * price_numerator / price_denominator)
```

The risk was that the continuing swap output used only the new ask payment
instead of preserving ask value already accumulated in the consumed order UTxO.
For a partial fill, the continuing output must use:

```txt
continuing_ask_quantity = consumed_utxo_ask_quantity + new_ask_quantity
remaining_offer_quantity = consumed_utxo_offer_quantity - offer_taken
```

Do not model these values as one asset-keyed object. ADA/tADA coin convention
can collide with role keys such as `ada-ada`, and a map can overwrite coin,
offer, or ask quantities even when the semantic roles differ. Keep these roles
separate:

```txt
current coin value
current offered-asset value
current asked-asset value
new offered-asset delta
new asked-asset delta
offer side kind: coin or token
ask side kind: coin or token
```

Then select output rows by role and asset kind:

- ADA/tADA offer, token ask: subtract the offered ADA from the continuing coin
  value and add accumulated plus new ask token to the ask token row.
- Token offer, ADA/tADA ask: keep the remaining offered token row and add the
  paid ADA to the continuing coin value.
- Token offer, token ask: keep coin value unchanged, subtract the offered token,
  and add accumulated plus new ask token.
- Same-asset orders are ambiguous for current integration accounting and should
  be rejected by preflight unless intentionally supported.

`utxo-ask-quantity` is the compatibility argument that carries the consumed
UTxO's accumulated asked-asset amount. It must default to `"0"` through provider
normalization, intent arguments, top-level wallet wrappers, and persisted Cart
snapshots so older or direct execution paths do not produce `undefined` before
wallet `buildTx`.

Close of a partially filled one-way order must return both sides of the maker's
value: remaining offer value and accumulated ask value. This is close-specific
value movement; it should not be hidden inside generic shared helpers.

Shared GCScript code may own selectors such as `assetKind`, but swap/fill and
close fragments own their own value movement. Do not place flow-specific
`remainingADA`, `continuingAsk`, or close-return math in common helpers. The
current open flow creates a fresh UTxO with `prev_input = None`; it is not an
update and should not receive consumed-UTxO preservation math. A true same-pair
update is a separate owner flow.

## Fallen Icarus p2p-wallet Context

Fallen Icarus' p2p-wallet is stricter and more precise around continuing output
min-ADA:

- It calculates min-UTxO for the projected swap output before adding an
  execution.
- It uses a 5 ADA heuristic specifically for ADA-selling swaps in the visible
  order book.
- It does not treat tiny native-token quantities as ledger-invalid by
  themselves; the real issue is whether preserving the continuing output needs
  extra ADA.

This supports NeonSoup's split policy:

- `minExecutableOfferQuantity` can match the p2p-wallet 5 ADA heuristic for
  ADA/tADA while remaining configurable per market.
- `minMakerRemainderQuantity` controls route boundary behavior without
  pretending that token-size alone proves ledger safety.
- A future GC preflight or dapp-side min-UTxO estimator can refine these local
  heuristics without changing the UI model.

### Practical Differences From p2p-wallet

p2p-wallet is a wallet transaction builder. It can project the exact continuing
swap output, call its min-UTxO calculation, and warn when the execution needs
more ADA. NeonSoup is currently a dapp delegating final transaction construction
to GameChanger Wallet, so it cannot exactly prove `projectedContinuingOutput`
min-ADA safety without duplicating wallet builder logic.

NeonSoup therefore uses configurable local heuristics:

- The 5 ADA/tADA default follows p2p-wallet's visible-book heuristic for
  ADA-selling swaps, but is configurable instead of hardcoded.
- Native-token thresholds are economic/UX filters, not Cardano ledger validity
  claims. Tiny token quantities are not invalid by themselves; the relevant
  ledger question is whether the output has enough ADA for its serialized size.
- Exact min-ADA handling should eventually move to a wallet preflight/build
  quote or a dapp-side estimator that mirrors the wallet builder.

## Route Bar

The route bar is a categorized debugging bar. It may show both user-input
segments and maker-order liquidity segments, so every segment tooltip must state
the category, asset, amount, and denominator.

Booked Cart source UTxO exclusion is a pre-route book filter. After those UTxOs
are removed from the candidate book, the denominator, segment math, and segment
categories must remain identical to the DevTool-compatible route behavior.
Never change route-bar math to hide a booked-UTxO exclusion bug.

- Filled input segments use `segment.baseAskQuantity / routeDisplayQuantity`.
- Minimum-remainder round-up uses
  `segment.roundUpAskQuantity / routeDisplayQuantity`.
- Unrouted input uses `unfilledRequestedQuantity / routeDisplayQuantity`.
- Maker remainder uses
  `segment.makerRemainderAskEquivalentQuantity / routeDisplayQuantity`.

This keeps execution math, balance checks, visible route percentages, and cart
items aligned while preserving what the user originally typed. Because maker
remainder is not user input, it must remain muted and clearly labeled as
maker-side liquidity. Its tooltip must show both the natural receive-asset
amount and the input-equivalent value used for visual sizing.

### Progress-Bar And Label Regression Rules

- Never render assets with different denominators in the same bar without an
  explicit common display denominator.
- The Swap route bar common denominator is `routeDisplayQuantity`, not
  `executionInputQuantity` and not maker-side receive-asset quantity.
- `Order filled/offered` must use total routed output for that order:
  `segment.offerQuantity / segment.availableOfferQuantity`. If round-up fully
  consumes the order, the label must show `100%`.
- Show base and round-up portions separately:
  `baseAskQuantity -> baseOfferQuantity` and
  `roundUpAskQuantity -> roundUpOfferQuantity`.
- Below-minimum maker remainders should become a clean-execution round-up when
  the route can safely consume the order, or leave only the truly unavailable
  input as unrouted/unavailable. This boundary should not produce a
  developer-facing end-user warning when the DevTool-compatible route can
  execute.
- Maker remainder is not part of user input. Show its natural receive-asset
  amount plus `makerRemainderAskEquivalentQuantity` used only for bar sizing.
- Balance bars use wallet balance as denominator. Route bars use route display
  quantity. Do not reuse a percent helper without confirming the denominator.
- The quote summary, effective price, and slippage use route execution math
  only; book-filtered offers and maker remainders must not leak into those
  totals.

### Color Treatment

- Fill segments use cumulative route slippage, not isolated segment slippage.
- The effective price card and quote summary use the same global route severity:
  success within tolerance, warning beyond tolerance, danger beyond the severe
  threshold.
- Round-up segments keep a muted fill but use the same severity-colored border
  as the route segment that caused them.
- Maker-remainder/change, clean-execution round-up, and unavailable-liquidity
  segments must remain visually distinct. Maker-remainder and unavailable
  segments stay muted; only truly unavailable input should use the unavailable
  treatment.
- Avoid gradients for route severity. Use solid theme success, warning, danger,
  and muted colors so price risk remains readable.

### Route Segment Categories

Every visual segment in the route bar has a category, amount, share, and
tooltip explanation.

- `fill`: input consumed by an executable order UTxO. These segments use the
  cumulative route slippage color.
- `remainder-roundup`: extra input included by the quote engine to consume the
  current order fully and avoid a below-minimum maker remainder. This is not
  part of the raw typed amount, but it is part of `executionInputQuantity`.
- `unrouted-input`: part of the typed amount that is not routed because the
  next route boundary cannot satisfy the maker-remainder policy.
- `unavailable`: part of the typed amount that is not routed because there is
  no more executable order-book depth.
- `maker-remainder`: receive-asset liquidity left in the maker order after a
  partial fill. This is not part of the user's offered input.

Future route categories should follow the same shape instead of adding passive
bar spans: category name, human explanation, base-unit amount, denominator
share, and an inspectable tooltip.

## Execution Modes And Contention

Bundle mode is the default because it is cheaper and atomic: all selected fills
either succeed together or fail together. This saves wallet/service fees but a
single contended UTxO can invalidate the whole bundle.

Parallel mode is opt-in best effort: one transaction per fill or group can allow
most orders to succeed in a fast-moving market. It costs more and can produce
partial completion, so the UI must describe it as higher execution assurance,
not better price.

Pay-up mode is local contention routing. It intentionally skips cheaper orders
within the configured pay-up band and starts at a worse-priced order to reduce
UTxO contention. The executable best price and slippage baseline must be based
on the post-pay-up executable book so skipped cheap orders do not make the route
look artificially bad.

## Current App Limitations

- Wallet submission extras are captured as tentative UX evidence when a
  submitted transaction is accepted or rejected. API/provider chain data remains
  the source of truth for final confirmation, failure, and transaction
  classification.
- Wallet receipts, provider-visible hashes, and confirmed chain transactions
  are distinct evidence levels. A Cart item should stay pending until the
  normalized chain transaction has explicit confirmation evidence; a wallet
  `pending` status or provider hash lookup is not enough to mark it confirmed.
- Current wallet behavior can return after rejected submissions without
  blocking script execution, which naturally removes the old zero-quantity
  full-fill devex blocker for fully consumed orders.
- Full-fill handling remains a separate protocol-integration boundary. Do not
  silently emit a zero-offer continuing UTxO; either handle the full-fill path
  deliberately or keep the limitation explicit until wallet/protocol support is
  proven.
- Cart filtering is draft-first by default. The history toggle should show
  non-draft statuses such as pending, confirmed, and failed while preserving
  persisted field names until a deliberate state migration is needed.
- Wallet-launching actions are temporarily disabled until a wallet is connected
  because some intents fail when the user address is undefined. This is not a
  desired long-term requirement; future user-agnostic intent execution should
  remove this guard.
