# Submission Extras Update Plan

## Goal

Integrate GameChanger Wallet transaction-level free-fail submission exports into
the NeonSoup devtool runtime composer and dapp-side receipt handling while
preserving NeonSoup's existing source-of-truth model:

- Wallet exports are hints and UX evidence only.
- Provider/API chain data remains the source of truth for confirmation,
  failure, ownership, transaction classification, and final app state.
- The update must be surgical and should not disturb the current Cart,
  transaction table, provider, or app-state architecture.

## Current Code Shape

- Runtime devtool execution is centralized in
  `src/devtool/src/services/intentExecution.ts`.
- `buildBundledGcscriptIntent()` groups one or more Cart items into one or more
  built transactions.
- `buildParallelGcscriptIntent()` builds one transaction per Cart item.
- Both paths share `baseScript()`, which adds the final `signTxs`, `submitTxs`,
  and `finally` receipt export.
- `receiptMacro()` currently exports only `items`, so any accepted receipt causes
  all matching Cart items to move to `pending`.
- Root-level static intents are managed separately and have already been updated
  manually. Do not edit `src/intents/**/*.gcscript.jsonc` as part of this plan.
- `src/intents/lib/*.gcscript.jsonc` are transaction-fragment libraries and must
  remain out of scope.

## Export Shape

Keep one normalized exported data design for bundled and parallel modes:

```txt
neonsoupExecution
- executionId
- itemCount
- groupCount
- txs[]
- items[]
```

`txs[]` is transaction/group-level submit evidence. `items[]` stays item-level
composition evidence. Every item references its group/transaction by existing
`groupId`/`groupIndex`, so bundle and parallel modes can share the same dapp
parser and reducer path.

Do not encode submission status separately per Cart item inside GCScript unless
there is a concrete reason. In a bundled transaction, all items share the same
ledger fate. In parallel mode, each item happens to have its own transaction,
but the exported shape should still be the same.

Suggested transaction record:

```txt
txs[]
- groupId
- groupIndex
- txHash
- status
- hasSubmitError
- hasContentionError
```

`status` is wallet submission state, not final chain truth. Current known values
are:

- `standBy`: not submitted yet, or user/wallet is manually managing state.
- `ready`: about to be submitted, including any UX grace period to cancel.
- `pending`: Ogmios/node accepted and validated the transaction; db-sync
  indexing is still pending.
- `stalled`: node resubmission is being rejected while db-sync has not indexed
  the already accepted transaction yet, or a similar indexing/status ambiguity.
- `confirmed`: wallet observed node and db-sync confirmation.
- `error`: node rejection, API failure, or network submission failure.

More status values may be added later. Treat `status` as an open string in app
types and UI. Do not use closed TypeScript unions or exhaustive status switches
for wallet submission state.

`hasSubmitError` is the dapp-side rejection/error flag. It must be derived from
`status === "error"` only. Do not infer rejection from the presence of `error`
or `errorDetail`, because those fields can appear on non-rejection statuses such
as `stalled`.

Keep heavy fields such as raw `error`, `errorDetail`, and `txHex` commented out
of the normal return unless explicitly needed for Developer inspection. Prefer
compact booleans and small status strings for wallet URL/export byte size.

## Runtime GCScript Changes

1. Update runtime `baseScript()` in `src/devtool/src/services/intentExecution.ts`.
2. Add `noFail: true` and `extras: true` to the single shared `submitTxs` node.
3. Extend `receiptMacro()` to export `txs[]` from `cache.submit.txsExtended`.
4. Keep `items[]` exported exactly as they are now for item mapping, expected output indexes,
   source UTxO hints, and Cart reconciliation.
5. Keep all submit handling outside item fragments to avoid duplicated script and
   export bytes.
6. Do not change any file under `src/intents/`. Root-level static intents were
   updated manually and are explicitly out of scope for this implementation.

## Dapp-State Rules

Submission extras are tentative only.

- A wallet-returned `status` may update visible temporary status or messages.
- It must not be treated as final confirmation.
- It must not replace provider/API reconciliation.
- It must not change transaction classification, ownership badges, offer
  existence, or final Cart item status without chain-backed evidence.
- `hasSubmitError` may drive tentative failed/requeueable UX because it is the
  wallet's explicit submission error signal.
- `error` and `errorDetail`, if later exposed for Developer inspection, must not
  drive rejection logic by themselves.

Keep the existing provider reconciliation path as the final authority:

- `applyWalletReturn()` may capture and display submission evidence.
- `reconcileChainTransactions()` and provider-loaded open-book state decide what
  is confirmed, failed, closed, filled, or still pending.
- `hasSubmitError` evidence can mark a transaction/item as tentative failed or
  relaunchable, but final transaction history should still prefer API evidence.

## Special Error Hints

Special error booleans such as `hasContentionError` are wallet-provided hints.
Show them to users when present because contention and related errors are
expected in a no-batcher/no-backend execution model.

Guidelines:

- Display `hasContentionError` as a specific tentative wallet submit hint.
- Keep the generic submit error decision tied to `hasSubmitError`.
- Add future special booleans without redesigning receipt shape.
- Do not treat a special hint as chain truth; it explains the wallet's current
  submission observation only.

## Frontend Changes

1. Extend `ExecutionReceipt` types in `src/devtool/src/state/types.ts` with a
   normalized `txs[]` section.
2. Update `executionReceiptFromWalletReturn()` to validate both `txs[]` and
   `items[]`.
3. Keep parser strict: `txs[]` is required and older `items[]`-only receipts
   are invalid.
4. Update reducer behavior so `hasSubmitError` is the only wallet-exported
   condition that creates tentative failed/requeueable UX.
5. Add lightweight UI display for tentative submission status where it already
   fits: Cart rows, transaction rows, or Developer JSON.
6. Keep API/provider reconciliation untouched except where it needs to ignore or
   supersede tentative wallet status.
7. Remove `showTemporaryFullFillProtocolAlert()` and all call sites in
   `src/devtool/src/App.tsx`.
8. Remove any docs/UI wording that says fully filled order transactions are
   currently broken.

## Documentation Updates

Update `docs/SWAP.md` and `src/devtool/README.md` narrowly:

- Remove the old full-fill limitation.
- Explain that current wallet behavior can freely return after rejected
  submissions, allowing the dapp to show tentative submission errors while API
  data remains authoritative.
- Mention that wallet-side transaction building/submission now naturally avoids
  the old zero-quantity devex blocker for fully filled orders.
- Keep wording clear that API/chain observation is still required for final
  confirmation.

## Cleanup

- Remove dead alert helper code and imports.
- Remove stale comments that describe fully-filled fills as unsupported.
- Avoid adding localStorage migrations.
- Avoid duplicating receipt normalization logic in React components.
- Prefer small helper functions in `intentExecution.ts` if they make the
  `txs[]` export and parser clearer.

## Verification

Run narrow checks first:

```txt
pnpm exec tsc -p ./src/devtool/tsconfig.json
pnpm run build:devtool
```

Manual checks:

- Bundle mode with multiple fills returns one `txs[]` record per built
  transaction group.
- Parallel mode returns the same export shape, with one transaction group per
  item.
- A `status: "error"` transaction returns to the dapp and does not block receipt
  capture.
- A `hasSubmitError: true` transaction is shown as tentative wallet evidence,
  not final chain state.
- Non-error statuses such as `stalled` may display their status but must not be
  treated as rejected even if `error` or `errorDetail` exists in wallet extras.
- `hasContentionError` displays as a specific expected contention hint when
  wallet suggests it.
- Confirmed chain data still wins over wallet-return hints.
- Fully filled order flows no longer show the temporary warning alert.

## Non-Goals

- Do not redesign Cart state.
- Do not add item-level submission status in GCScript.
- Do not change provider contracts unless needed to keep existing reconciliation
  working.
- Do not introduce a second wallet execution path for direct actions.
- Do not treat wallet submit extras as canonical transaction truth.
- Do not edit `src/intents/**/*.gcscript.jsonc`.
