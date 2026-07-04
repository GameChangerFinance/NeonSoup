# Multi-Tx Bundled Cart Price Failure Minimal Fix Plan

Date: 2026-07-04

Related report: `MULTI_TX_BUNDLED_CART_PRICE_FAILURE_REPORT.md`

## Goal

Fix bundled one-way swap fill value accounting without changing the working
open flow, without adding a broad transaction-value abstraction, and without
using asset-keyed maps that can overwrite ADA/tADA coin values.

The immediate bug is that the continuing swap output can under-report the ask
asset already accumulated in the consumed UTxO. The dangerous follow-up bug is
that a naive `utxo-ask-quantity` map can double count or overwrite ADA/tADA
because GameChanger represents testnet ADA/tADA with the same coin convention:

```json
{ "policyId": "ada", "assetNameHex": "ada" }
```

## Constraints

- Keep the current composable intent design.
- Keep `common.gcscript.jsonc` limited to shared identity normalization.
- Keep fill/swap-specific value movement inside `lib/swap.gcscript.jsonc`.
- Keep close-specific value movement inside `lib/close.gcscript.jsonc`.
- Do not use one asset-keyed object for semantic role quantities when offer,
  ask, and coin can all resolve to `ada-ada`.
- Preserve BigNum string arithmetic in GCScript.
- Preserve backward compatibility by defaulting new quantity args to `"0"`.
- Do not modify full-fill behavior in this fix.
- Do not turn the existing open intent into an update intent.
- Make all one-way swap intent fragments rely on the shared
  `common.assetKind` selector for coin/token classification. Open should not
  grow UTxO-preservation math, but it should not introduce its own separate
  coin/token classification either.
- Keep the Cart UI change minimal and state-compatible. The existing persisted
  boolean can be reused, but the visible label and filtering semantics must
  change so the default view shows draft items and the toggle shows non-draft
  execution/history statuses.

## Minimal Fix Shape

1. Add a shared asset-kind selector in `src/intents/lib/common.gcscript.jsonc`.

   This should classify each side as `coin` only when the pair is exactly
   `ada/ada`; all other assets are `token`.

   ```jsonc
   "assetKind": {
     "type": "macro",
     "run": {
       "offer": {
         "{join('-', get('args.offer-policy-id'), get('args.offer-asset-name'))}": "token",
         "ada-ada": "coin"
       },
       "ask": {
         "{join('-', get('args.ask-policy-id'), get('args.ask-asset-name'))}": "token",
         "ada-ada": "coin"
       }
     }
   }
   ```

   This map stores only selectors, not quantities. If keys collide, the result
   is still only `coin` or `token`; no money value is lost.

2. Add `utxo-ask-quantity` to consumed-UTxO args for fill and close.

   Required paths:

   - `src/devtool/src/state/types.ts`: add optional `utxoAskQuantity` to the
     normalized open-offer row.
   - Provider mappers: populate it from the consumed UTxO value for the ask
     asset when ask is a non-coin token; use `"0"` when ask is coin.
   - `src/devtool/src/domain/orders.ts`: default missing values to `"0"`.
   - `src/devtool/src/services/intents.ts`: pass
     `"utxo-ask-quantity": offer.utxoAskQuantity || "0"` in fill and close
     args.
   - `src/intents/swap.gcscript.jsonc`: add default arg and pass-through.
   - `src/intents/close.gcscript.jsonc`: add default arg and pass-through.
   - Cart composition: pass through each fill/close item's
     `utxo-ask-quantity`, defaulting to `"0"` for older snapshots.

3. Replace `lib/swap.gcscript.jsonc` fill value math with role-based math.

   Do not build a value map like this:

   ```jsonc
   "currentUtxo": {
     "ada-ada": "{get('args.utxo-coin-quantity')}",
     "{offerKey}": "{get('args.utxo-offer-quantity')}",
     "{askKey}": "{get('args.utxo-ask-quantity')}"
   }
   ```

   That can overwrite values when offer or ask is coin.

   Instead, keep role quantities separate:

   ```jsonc
   "coinDelta": {
     "type": "macro",
     "run": {
       "offerTaken": {
         "coin": "{get('args.offer-quantity')}",
         "token": "0"
       },
       "askPaid": {
         "coin": "{get('args.ask-quantity')}",
         "token": "0"
       }
     }
   },
   "remainingADA": {
     "type": "macro",
     "run": "{subBigNum(addBigNum(get('args.utxo-coin-quantity'), get(join('.','cache','coinDelta','askPaid',get('cache.dependencies.assetKind.ask')))), get(join('.','cache','coinDelta','offerTaken',get('cache.dependencies.assetKind.offer'))))}"
   },
   "remainingOffer": {
     "type": "macro",
     "run": "{subBigNum(get('args.utxo-offer-quantity'), get('args.offer-quantity'))}"
   },
   "continuingAsk": {
     "type": "macro",
     "run": "{addBigNum(get('args.utxo-ask-quantity'), get('args.ask-quantity'))}"
   },
   "tokenOutputQuantity": {
     "type": "macro",
     "run": {
       "remainingOffer": {
         "coin": "0",
         "token": "{get('cache.remainingOffer')}"
       },
       "askDeposit": {
         "coin": "0",
         "token": "{get('cache.continuingAsk')}"
       }
     }
   }
   ```

   Output rows then select by asset kind:

   ```jsonc
   {
     "policyId": "ada",
     "assetNameHex": "ada",
     "quantity": "{get('cache.remainingADA')}"
   },
   {
     "policyId": "{get('cache.dependencies.normalized.forTx.offer-policy-id')}",
     "assetNameHex": "{get('cache.dependencies.normalized.forTx.offer-asset-name')}",
     "quantity": "{get(join('.','cache','tokenOutputQuantity','remainingOffer',get('cache.dependencies.assetKind.offer')))}"
   },
   {
     "policyId": "{get('cache.dependencies.normalized.forTx.ask-policy-id')}",
     "assetNameHex": "{get('cache.dependencies.normalized.forTx.ask-asset-name')}",
     "quantity": "{get(join('.','cache','tokenOutputQuantity','askDeposit',get('cache.dependencies.assetKind.ask')))}"
   }
   ```

4. Add minimal preflight assertions in `lib/swap.gcscript.jsonc`.

   Assertions should protect against malformed or missing values before
   `plutusData` and `buildTx`:

   ```txt
   utxo-coin-quantity is string and >= 0
   utxo-offer-quantity is string and >= 0
   utxo-ask-quantity is string and >= 0
   offer-quantity is string and > 0
   ask-quantity is string and >= 0
   offer-quantity <= utxo-offer-quantity
   offer asset key != ask asset key
   ```

   The same-asset assertion is intentionally minimal. It avoids ambiguous role
   accounting for `ADA/ADA`, token/token same-asset orders, and any malformed
   self-swap input until the protocol integration deliberately supports such
   cases.

5. Fix `lib/close.gcscript.jsonc` for partially filled orders using the same
   naming style and `common.assetKind`.

   `close.gcscript.jsonc` is likely incomplete for partially filled orders
   because close should return accumulated ask value as well as remaining offer
   value.

   Keep the close math local to the close fragment. Reuse `common.assetKind`
   for coin/token selection and mirror the swap naming convention where it
   makes sense:

   ```jsonc
   "returnADA": {
     "type": "macro",
     "run": "{get('args.utxo-coin-quantity')}"
   },
   "tokenOutputQuantity": {
     "type": "macro",
     "run": {
       "remainingOffer": {
         "coin": "0",
         "token": "{get('args.utxo-offer-quantity')}"
       },
       "askDeposit": {
         "coin": "0",
         "token": "{get('args.utxo-ask-quantity')}"
       }
     }
   }
   ```

   The close output should explicitly include:

   ```jsonc
   {
     "policyId": "ada",
     "assetNameHex": "ada",
     "quantity": "{get('cache.returnADA')}"
   },
   {
     "policyId": "{get('cache.dependencies.normalized.forTx.offer-policy-id')}",
     "assetNameHex": "{get('cache.dependencies.normalized.forTx.offer-asset-name')}",
     "quantity": "{get(join('.','cache','tokenOutputQuantity','remainingOffer',get('cache.dependencies.assetKind.offer')))}"
   },
   {
     "policyId": "{get('cache.dependencies.normalized.forTx.ask-policy-id')}",
     "assetNameHex": "{get('cache.dependencies.normalized.forTx.ask-asset-name')}",
     "quantity": "{get(join('.','cache','tokenOutputQuantity','askDeposit',get('cache.dependencies.assetKind.ask')))}"
   }
   ```

   This covers:

   ```txt
   ADA/tADA offer: returned through returnADA
   ADA/tADA ask: accumulated ask already included in returnADA
   token offer: returned through remainingOffer token row
   token ask: returned through askDeposit token row
   ```

   Add close preflight assertions parallel to swap:

   ```txt
   utxo-coin-quantity is string and >= 0
   utxo-offer-quantity is string and >= 0
   utxo-ask-quantity is string and >= 0
   offer asset key != ask asset key
   ```

   Keep the existing close redeemers, witnesses, mint burn quantities,
   `requiredSigners`, and output naming conventions. The close patch should only
   change value accounting and pass-through args.

6. Keep current open behavior stable while sharing `common.assetKind`.

   Current `open.gcscript.jsonc` already imports `common.gcscript.jsonc`, so it
   will receive the shared `assetKind` selector once common is updated. Do not
   add UTxO-preservation math to open because it creates a new UTxO and has no
   consumed swap value to preserve.

   For consistency, avoid adding any open-local coin/token classifier. If open
   later needs preflight validation or becomes part of a true update/replace
   flow, it must use `cache.dependencies.assetKind` rather than duplicating the
   classification logic.

7. Defer true update intent changes.

   The current `open.gcscript.jsonc` is not an update intent. Per the
   Cardano-Swaps model, update is a distinct owner flow:

   ```txt
   Update same pair: SpendWithStake + UpdateSwaps
   Close or pair change: SpendWithMint + CreateOrCloseSwaps
   ```

   Do not apply UTxO-preservation math to current open. If a true update intent
   is added later, it should reuse `common.assetKind` but own its value math.

8. Update the Cart status filter toggle.

   The current UI has a `Show confirmed only` toggle. Replace that behavior
   with a toggle that switches between:

   ```txt
   default off: show draft Cart items only
   toggle on: show every non-draft status, including pending, confirmed, failed
   ```

   Keep this intentionally small:

   - `src/devtool/src/services/cartIntents.ts`: update `visibleCartItems()` so
     `false` means `status === "draft"` and `true` means
     `status !== "draft"`.
   - `src/devtool/src/state/reducer.ts`: update the internal
     `cartVisibleItems()` helper with the same semantics.
   - `src/devtool/src/components/cart/CartPanel.tsx`: change the toggle label
     from `Show confirmed only` to a clear non-draft/history label, such as
     `Show execution history`.
   - `CartPanel.tsx`: update empty-state copy so it no longer says
     `Show confirmed only`.
   - Leave `CartState.showConfirmedOnly` and the existing
     `set-cart-show-confirmed-only` action name in place for now to avoid a
     persisted-state migration and broader reducer churn. The UI copy should no
     longer expose the old meaning.

   This is a UI filtering change only. Do not change selection rules,
   execution rules, item statuses, reconciliation, or purge behavior in the same
   patch.

## Three-Round Challenge And Refinement

### Iteration 1: Collision Audit

Initial risk:

The first tempting fix is a normalized asset-value map:

```jsonc
"currentUtxo": {
  "ada-ada": "{get('args.utxo-coin-quantity')}",
  "{offerKey}": "{get('args.utxo-offer-quantity')}",
  "{askKey}": "{get('args.utxo-ask-quantity')}"
}
```

Real-value emulation:

```txt
Case A: ADA offer, USDM ask
utxoCoin=9,129,051
utxoOffer=9,129,051
utxoAsk=0
offerTaken=9,129,051
askPaid=2,501,754

offerKey=ada-ada
askKey=d4fe...-5553444d
```

The map has two `ada-ada` entries. Depending on object overwrite behavior,
`utxoCoin` can be replaced by `utxoOffer`, or the reverse. In this specific case
the numbers happen to match, hiding the bug.

```txt
Case B: partially filled ADA offer, USDM ask
utxoCoin=7,580,669
utxoOffer=7,580,669
utxoAsk=547,997
offerTaken=1,996,093
askPaid=547,997
```

Again the ADA coin and ADA offer role collide. The plan must not rely on this
coincidence.

Refinement:

Do not store role quantities under asset keys. Store only `coin`/`token`
selectors in common. Keep `utxo-coin-quantity`, `utxo-offer-quantity`, and
`utxo-ask-quantity` as separate role values.

### Iteration 2: ADA/tADA And Both-Coin Audit

Risk:

GameChanger represents ADA and testnet ADA/tADA through the same coin
convention. Treating tADA as a native token would double count or omit ADA in
wallet tx arrays.

Real-value emulation:

```txt
Case C: token offer, ADA/tADA ask
utxoCoin=2,000,000
utxoOffer=100
utxoAsk=0
offerTaken=25
askPaid=1,500,000

offerKind=token
askKind=coin
remainingADA=2,000,000 + 1,500,000 - 0 = 3,500,000
remainingOfferRow=100 - 25 = 75
askDepositRow=0
```

This is correct: ask ADA enters coin ADA only.

```txt
Case D: ADA/tADA offer, token ask
utxoCoin=9,000,000
utxoOffer=9,000,000
utxoAsk=300
offerTaken=2,000,000
askPaid=100

offerKind=coin
askKind=token
remainingADA=9,000,000 + 0 - 2,000,000 = 7,000,000
remainingOfferRow=0
askDepositRow=300 + 100 = 400
```

This is correct: offered ADA leaves coin ADA, token ask accumulates separately.

```txt
Case E: ADA/tADA offer, ADA/tADA ask
utxoCoin=5,000,000
utxoOffer=5,000,000
utxoAsk=0
offerTaken=1,000,000
askPaid=1,000,000

offerKind=coin
askKind=coin
remainingADA=5,000,000 + 1,000,000 - 1,000,000 = 5,000,000
remainingOfferRow=0
askDepositRow=0
```

The math does not corrupt values, but same-asset swaps are semantically
ambiguous and should be rejected by preflight for now.

Refinement:

Add a minimal same-asset assertion. Do not attempt to support same-asset orders
as part of this bug fix.

### Iteration 3: Missing Args, Close/Update, And Over-Engineering Audit

Risk 1: missing `utxo-ask-quantity`.

Old cart snapshots and direct fill flows may not include the new arg. If the
GCScript uses it directly, `addBigNum(undefined, ask)` can fail before wallet
balancing UX.

Refinement:

Every pass-through layer must default it to `"0"`:

```txt
provider normalization -> OpenOffer.utxoAskQuantity || "0"
fill args -> "utxo-ask-quantity": offer.utxoAskQuantity || "0"
top-level swap default -> "utxo-ask-quantity": "0"
cart item pass-through -> default "0"
```

Risk 2: moving too much into `common.gcscript.jsonc`.

If common starts computing `remainingADA` or `continuingAsk`, open, swap, close,
and future update would inherit assumptions that are not valid for all flows.

Refinement:

Common only gets `assetKind`. It does not get value arithmetic. Swap and close
both use `common.assetKind`, but each fragment owns its own value movement:

```txt
swap: current value plus/minus fill deltas, then recreate protocol UTxO
close: current value returned to owner, then burn beacons
open: no consumed UTxO, no preservation math
```

Risk 3: applying this to current open.

Current open mints beacons and creates a new UTxO with `prev_input = None`. It
does not preserve an existing UTxO and should not receive `utxo-*` accounting.

Refinement:

Do not modify open value math for this bug. Note that a future true update
intent should reuse `assetKind` and have its own update-specific value logic.

Risk 4: close still has a related accounting gap.

Close should return accumulated ask value. Leaving it as a follow-up would mean
the shared `utxo-ask-quantity` argument and `common.assetKind` selector are
introduced for fill but not used consistently by the owner-close path.

Refinement:

Include a close-specific value-accounting patch in this plan, but keep it
minimal:

```txt
do not change close redeemers
do not change close beacon burn logic
do not change requiredSigners
do not change close output idPattern naming
only add explicit ADA return and token offer/ask return rows
```

This keeps close aligned with the same design pattern while avoiding a broader
owner-flow refactor.

## Final Minimal Implementation Order

1. Add `assetKind` selector to `common.gcscript.jsonc`.
2. Add `utxoAskQuantity` to normalized offer data and provider mappers.
3. Pass `utxo-ask-quantity` through fill/close args, top-level swap/close, and
   cart composition with default `"0"`.
4. Replace only the fill value math in `lib/swap.gcscript.jsonc` with
   role-based `coinDelta`, `remainingADA`, `remainingOffer`, `continuingAsk`,
   and `tokenOutputQuantity`.
5. Update `lib/close.gcscript.jsonc` to return explicit `returnADA`,
   remaining offer token value, and accumulated ask token value using
   `common.assetKind`.
6. Add minimal fill and close preflight assertions.
7. Rebuild and validate the swap and close intents.
8. Update Cart filtering so the default view is draft-only and the toggle shows
   non-draft statuses.
9. Run TypeScript and frontend build checks because devtool provider and intent
   argument generation are touched.

## Verification Plan

Commands:

```bash
pnpm exec tsc -p ./src/devtool/tsconfig.json
pnpm run build:swap
pnpm run build:close
pnpm exec gamechanger-cli validate -f ./dist/intents/swap.gcscript.json -o /tmp/neonsoup-swap-validate.json
pnpm exec gamechanger-cli validate -f ./dist/intents/close.gcscript.json -o /tmp/neonsoup-close-validate.json
pnpm run build
pnpm run test:swap-quote
git diff --check
```

Manual fixture checks:

```txt
ADA/tADA offer, token ask:
remainingADA = utxoCoin - offerTaken
ask token row = utxoAsk + askPaid

token offer, ADA/tADA ask:
remainingADA = utxoCoin + askPaid
offer token row = utxoOffer - offerTaken

token offer, token ask:
remainingADA = utxoCoin
offer token row = utxoOffer - offerTaken
ask token row = utxoAsk + askPaid

same asset on both sides:
preflight rejects before buildTx

Close ADA/tADA offer, token ask:
returnADA = utxoCoin
remaining offer token row = 0
ask token row = utxoAsk

Close token offer, ADA/tADA ask:
returnADA = utxoCoin
remaining offer token row = utxoOffer
ask token row = 0

Close token offer, token ask:
returnADA = utxoCoin
remaining offer token row = utxoOffer
ask token row = utxoAsk

Cart filter default:
visible items have status draft only

Cart filter toggled:
visible items have status pending, confirmed, failed, or any future non-draft
status, but not draft
```

## Deferred Follow-Ups

- Add a true update intent only after confirming the exact active validator
  redeemers and beacon-policy redeemer constructors.
- Add fixture-level tests for direct fill and bundled-cart fill once the current
  GCScript build/test harness supports stable wallet-context fixtures.
