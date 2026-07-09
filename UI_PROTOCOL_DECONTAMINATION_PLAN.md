# UI And Protocol Decontamination Plan

Main goal: clearly separate devtool UI from reusable protocol, provider,
wallet, GCScript, and domain helpers so NeonSoup can add a simplified
user-facing UI without copying or depending on devtool implementation details.

This is a critical cleanup, but it must be incremental. Do not rewrite working
protocol code, do not move code just for aesthetics, and do not split compact
readable logic into tiny functions unless the split creates reuse, a control
point, or a safer test seam.

## Current Baseline

Observed structure:

- `src/devtool/src/domain/` already contains useful shared logic for assets,
  quantities, orders, ownership, open-book freshness, transactions, and swap
  quotes.
- `src/devtool/src/services/providers/` already defines a normalized provider
  contract. MKII and Blockfrost mostly differ by transport and mapping.
- `src/devtool/src/state/` already has serializable reducer state and centralized
  persistence/version gating.
- `src/devtool/src/components/` is Bootstrap-first devtool UI.
- `src/devtool/src/App.tsx` currently mixes UI rendering, wallet-return
  orchestration, quote text formatting, warning policy, data refresh, chain
  reconciliation, direct-action execution, and view routing.
- `src/devtool/src/services/intents.ts` currently mixes protocol argument
  builders with browser return URL handling.
- `src/devtool/src/services/cartIntents.ts` creates Cart items but depends on
  full `AppState`, selector helpers, random/time sources, and UI-facing source
  labels.
- `src/devtool/src/services/intentExecution.ts` owns bundled and parallel
  GCScript composition. Keep this inspectable; avoid fragmenting the generated
  GCScript structure across many small functions.
- `OpenOffersTable`, `CartPanel`, `CartModal`, `OptionsPanel`, and `AppShell`
  accept full `AppState` and/or `dispatch`. That is acceptable for devtool UI
  today, but future UIs should not inherit that coupling.

Existing tests:

- `pnpm run test:swap-quote` compiles selected TypeScript files and runs
  domain/cart reconciliation tests in Node.
- `pnpm exec tsc -p ./src/devtool/tsconfig.json` typechecks the devtool.
- `pnpm run build` rebuilds protocol intents and the Vite devtool.

## Target Boundary

Create a framework-neutral reusable core that future UIs can consume directly.
The devtool should become one consumer of that core, not the owner of protocol
behavior.

Target ownership:

- `src/core/types/`: protocol, asset, provider, transaction, wallet receipt, and
  cart execution types that are not React-specific and not devtool-view-specific.
- `src/core/domain/`: pure deterministic helpers for quantities, assets, order
  rows, ownership, swap quotes, transaction classification, open-book freshness,
  and warning/label models that are shared across UIs.
- `src/core/providers/`: provider contracts, pagination helpers, and provider
  response mapping. Provider implementations must return normalized domain
  types and keep raw provider shapes private.
- `src/core/intents/`: pure protocol argument builders and Cart item builders.
  These should accept explicit typed inputs instead of the full devtool
  `AppState`.
- `src/core/gcscript/`: wallet execution composition for bundled and parallel
  Cart runs. Keep the composer readable and close to the final GCScript shape.
  Runtime adapters may inject return URLs, GC runtime, and virtual intent files.
- `src/core/wallet/`: wallet-return parsing and receipt normalization that does
  not touch `window`, `history`, or `localStorage`.
- `src/devtool/src/`: React state, Bootstrap components, devtool views,
  localStorage wiring, browser event listeners, popup/window behavior, and
  developer inspection surfaces.

Forbidden dependencies after cleanup:

- Core modules must not import React, ReactDOM, Bootstrap, component files,
  CSS, `useAppState`, `useAppDispatch`, or devtool-only view types.
- Core pure modules must not call `window`, `document`, `history`,
  `localStorage`, `window.open`, `window.location`, `window.confirm`, or
  `document.addEventListener`.
- Components should render prepared rows/data and call callbacks. They should
  not decide protocol action, ownership semantics, transaction evidence level,
  or Cart reconciliation status.
- Provider response shapes must not leak into components, reducers, or Cart
  builders.
- Wallet receipts, submitted hashes, and confirmed chain transactions must stay
  separate evidence levels.

Allowed dependencies:

- Devtool UI may import core.
- Devtool state may adapt core types into UI state.
- Browser adapters may call browser APIs and then pass normalized data into
  core helpers.
- GCScript composer may use a small runtime adapter for GC build/validate and
  virtual file loading, but the main bundled/parallel structure should remain in
  one readable module.

## Non-Goals

- Do not build the final user-facing UI in this cleanup.
- Do not recreate the old `src/frontend` single-file app.
- Do not modify any file under `src/intents/`. The GCScript source intents,
  protocol fragments, and protocol signatures must be kept verbatim.
- Do not change public intent argument names, generated protocol semantics, or
  wallet-facing protocol signatures.
- Do not introduce a centralized matcher, batcher, custom indexer, or trusted
  backend.
- Do not add tests for code that is deliberately removed.
- Do not add a dependency unless the existing checks cannot cover the risk.

## Refactoring Rules

- Preserve working code that already meets the desired boundary.
- Prefer wrappers/adapters around existing code before large moves.
- Move one boundary at a time and keep each diff reviewable.
- Keep exported names and call signatures stable until their callers are moved.
  If a breaking rename is needed, update all call sites and docs in the same
  change.
- Use `bigint` for asset quantities, lovelace, prices, and UTxO values. Convert
  to `number` only for bounded UI-only values such as percentages.
- Keep canonical keys:
  - UTxOs: `txHash#index`
  - assets: `policyId.assetNameHex`
  - ADA: `ada.ada`
- Keep warning-based devtool validation. Bad values are useful for protocol and
  wallet debugging.
- Keep GCScript generation data-driven. Runtime-specific values must enter
  through args and cache references, not hardcoded reusable structures.
- Treat `src/intents/` as read-only for this cleanup. Any compatibility wrapper
  or UI/core adapter must conform to the existing GCScript intent signatures
  exactly.

## Phase 1: Safety Net First

Goal: add characterization coverage before changing ownership boundaries.

Tasks:

- Add tests for pure intent argument builders:
  - open args convert display amounts to base units and reduce price ratios.
  - fill args use ceiling ask math.
  - fill and close args preserve `utxo-ask-quantity`, defaulting to `"0"`.
  - close args preserve owner stake key hash and offer address semantics.
  - same-asset accounting remains warned/rejected where currently unsupported.
- Add tests for Cart item builders:
  - direct open/fill/close items keep immutable `args` snapshots.
  - swap quote segments produce fill Cart items with stable `pair`,
    `sourceOfferId`, and source UTxO references.
  - duplicate source UTxOs are rejected for draft fill/close items.
  - draft/history visibility remains unchanged.
- Add tests for wallet receipt parsing:
  - valid `neonsoupExecution` receipts are accepted.
  - duplicate item IDs, duplicate tx groups, malformed output roles, and missing
    tx hashes are rejected.
  - wallet receipt evidence produces submitted/failed rows, never confirmed rows.
- Add tests for GCScript composition shape before any cleanup:
  - bundle mode fetches `getCurrentAddress` once at root.
  - fill/close imported args read `offer-address` from `cache.myAddress`.
  - `utxo-ask-quantity` is present for fill/close when older Cart snapshots omit
    it.
  - bundle mode creates one `buildTx` per group, then one `signTxs` and one
    `submitTxs`.
  - parallel mode creates one `buildTx` per item, then one `signTxs` and one
    `submitTxs`.
  - `submitTxs` keeps `extras: true` and `noFail: true`.
  - no extra isolation wrapper moves root cache paths like `cache.myAddress`.
- Add a lightweight architecture-boundary test or script that fails if future
  `src/core/**` modules import React, CSS, components, devtool app state hooks,
  or browser storage/window APIs.

Suggested commands after Phase 1:

```text
pnpm run test:swap-quote
pnpm exec tsc -p ./src/devtool/tsconfig.json
```

## Phase 2: Extract Shared Types Without Rewriting Behavior

Goal: stop future UIs from importing `src/devtool/src/state/types.ts` just to
use protocol/domain types.

Tasks:

- Create core type modules for reusable types currently mixed into
  `state/types.ts`:
  - network/provider: `NetworkTag`, `NetworkProviderKind`
  - assets: `AssetRef`, `AssetMetadata`, `ResolvedAsset`, `AssetPair`
  - orders: `OpenOffer`, `OpenBookSnapshot`, `OrderKind`
  - transactions: `ProtocolTransaction`, `ProtocolAction`
  - cart/intent execution: `IntentArgs`, `GcscriptArgs`, `CartItem`,
    `CartState`, `CartExecutionMode`, receipt/output types
  - wallet: `WalletConnection`
- Leave devtool-only types in `src/devtool/src/state/types.ts`:
  - `ViewId`, `TradeTab`, `NoticeTone`, `AppOptions`, `FormState`, `Notice`,
    `AppState`, `AppAction`
- Re-export moved core types from `state/types.ts` temporarily to avoid a
  single massive import churn.
- Gradually update pure modules to import reusable types from core directly.
  Components may continue through devtool types until their props are cleaned.

Acceptance:

- Future UI code can import domain/protocol/cart/provider types without pulling
  in `AppState` or React state.
- Devtool typecheck still passes.

## Phase 3: Extract Pure Domain And Presentation Helpers

Goal: preserve the useful existing domain layer and add only missing reusable
helpers currently trapped in `App.tsx` or components.

Keep mostly as-is, or move with minimal edits:

- `assets.ts`
- `assetPolicy.ts`
- `assetWarnings.ts`
- `cardano.ts`
- `openBook.ts`
- `orders.ts`
- `ownership.ts`
- `quantities.ts`
- `swapQuote.ts`
- `transactions.ts`
- `uiFormat.ts`

Extract from `App.tsx` and `SwapRouteBar.tsx` into reusable domain/presentation
helpers only where reused or likely reusable:

- price text formatting for swap quotes.
- inverse price text formatting.
- quote summary text.
- book policy summary text.
- swap warning model from quote, wallet, pair, balance, and freshness inputs.
- open/fill warning models if the future UI will show the same safety messages.

Do not extract tiny one-off JSX layout decisions. Keep Bootstrap layout inside
devtool components.

Acceptance:

- Quote math remains in `quoteSwap`.
- Route-bar denominators and labels still follow `docs/SWAP.md`.
- Components render formatted data but do not recompute protocol accounting.

## Phase 4: Decontaminate Intent And Cart Builders

Goal: make protocol argument and Cart snapshot creation reusable without
requiring the devtool `AppState`.

Tasks:

- Split `services/intents.ts` into:
  - pure core argument builders that accept explicit inputs;
  - a devtool adapter that reads `AppState` and calls the pure builders;
  - browser return URL cleanup in a wallet/browser adapter, not in protocol
    argument code.
- Keep the existing exported devtool functions during migration:
  `buildOpenArgs`, `buildFillArgs`, `buildFillArgsForQuantity`,
  `buildCloseArgs`, `buildArgsForAction`, `fillAskAmount`.
- Split `services/cartIntents.ts` similarly:
  - pure core Cart item builders accept args, assets, selected offer, quote,
    timestamps, and ID generator as explicit inputs;
  - devtool adapter preserves current behavior and labels.
- Inject time/random sources into tests where stable output is needed. Do not
  over-engineer ID generation in production code.
- Keep `visibleCartItems`, `selectedCartItems`, and validation helpers pure and
  reusable.

Acceptance:

- A future UI can build open/fill/close/swap Cart items without constructing
  devtool `AppState`.
- Existing devtool direct actions remain transient one-item Cart compositions.
- Persisted Cart snapshots keep the same shape unless a deliberate state
  version bump is planned.

## Phase 5: Stabilize GCScript Composition

Goal: preserve the working bundled/parallel execution path while making it
consumable by any UI.

Tasks:

- Keep the bundled/parallel GCScript construction in one inspectable module.
  The final script shape should remain readable top-to-bottom.
- Separate only these boundaries if needed:
  - source composition object;
  - virtual file source loading;
  - GC runtime build call;
  - browser return URL provider.
- Do not split `mechanicalTxFor`, group construction, or receipt construction
  into many tiny helpers beyond what improves auditability.
- Keep reusable script structures data-driven through `args.items`,
  `args.groups`, and `cache` references.
- Keep root-scoped `getCurrentAddress` once and pass it into imported fragments.
- Keep `submitTxs` receipt export shape stable.
- Do not edit source JSONC intents under `src/intents/`; the composer and future
  UI/core adapters must keep consuming the existing intent files and signatures
  as-is.

Suggested commands after GCScript or intent changes:

```text
pnpm run build:open
pnpm run build:close
pnpm run build:swap
pnpm run build:cart
pnpm exec gamechanger-cli validate -f ./dist/intents/open.gcscript.json -o /tmp/neonsoup-open.report.json
pnpm exec gamechanger-cli validate -f ./dist/intents/close.gcscript.json -o /tmp/neonsoup-close.report.json
pnpm exec gamechanger-cli validate -f ./dist/intents/swap.gcscript.json -o /tmp/neonsoup-swap.report.json
```

Acceptance:

- Bundled and parallel execution output remains equivalent except for deliberate
  adapter separation.
- Composition tests protect cache paths, receipt shape, and submit semantics.
- Humans can still audit the generated GCScript structure from one file.

## Phase 6: Separate Browser And Storage Adapters

Goal: keep core reusable outside the current devtool browser shell.

Tasks:

- Move wallet-return parsing into a pure helper that accepts decoded data and
  returns `WalletConnection | null` and/or normalized execution receipt data.
- Keep these browser-only behaviors in devtool adapters:
  - reading `window.location.href`;
  - decoding `result` URL params;
  - writing and clearing `localStorage`;
  - `history.replaceState`;
  - popup close attempts;
  - `window.open` and `window.location.href` wallet launch.
- Make wallet URL creation accept explicit network, URL pattern, and code
  inputs rather than full `AppState`.
- Keep stored-state version gating centralized. Do not add ad hoc migrations
  for old devtool state shapes.

Acceptance:

- Core wallet helpers can be unit-tested in Node.
- Browser behavior remains in devtool-specific services.
- Wallet URL pattern override rules stay enforced by centralized option
  handling.

## Phase 7: Keep Provider Contracts UI-Neutral

Goal: provider selection changes transport and response mapping only.

Tasks:

- Keep `NetworkProvider` returning normalized domain types.
- Narrow `ProviderContext` so it contains provider/runtime config instead of
  full devtool `AppOptions` when practical.
- Keep MKII and Blockfrost raw response interfaces private to their provider
  modules.
- Keep pagination helpers reusable and deterministic.
- Add provider mapping tests with local fixtures:
  - `utxoAskQuantity` defaults to `"0"`.
  - order IDs normalize to `txHash#index`.
  - asset metadata resolves to canonical `policyId.assetNameHex` keys.
  - transaction inclusion evidence maps to `includedAt > 0`.
  - invalid contract transactions classify as failed chain evidence.

Acceptance:

- Future UIs can choose a provider through the same interface.
- React components never see raw MKII or Blockfrost shapes.
- Provider fallback remains explicit, not silent.

## Phase 8: Thin The Devtool UI

Goal: keep the devtool working while making it a consumer of reusable core
models.

Tasks:

- Convert table components to accept prepared row data and explicit callbacks
  instead of full `AppState` where it reduces coupling:
  - `OpenOffersTable`: accept rows, selected ID, policy status map, fill/close
    callbacks.
  - `CartPanel`: accept cart view model, callbacks, and confirmation callback
    rather than dispatching raw actions internally.
  - `CartModal`: remain a devtool wrapper around `CartPanel`.
  - `OptionsPanel`: may stay devtool-specific because it edits devtool runtime
    options.
- Move data refresh/reconciliation orchestration out of `App.tsx` only where it
  creates reusable control points:
  - open-book refresh;
  - portfolio refresh;
  - pending transaction reconciliation;
  - wallet return application.
- Keep page layout and Bootstrap decisions in devtool components.
- Avoid creating many new components just to reduce line count. Split only when
  repeated views or reusable workflows are clearer.

Acceptance:

- `App.tsx` is mostly view composition and event wiring.
- Devtool UI still behaves the same.
- Future user UI can reuse core operations without importing devtool components.

## Phase 9: Cleanup Outdated Code, Docs, And Styles

Goal: remove stale material only after replacements are working and covered.

Tasks:

- Remove unused exports after call sites are migrated.
- Remove duplicated selectors such as multiple `selectedOffer` implementations
  once one canonical helper exists.
- Remove dead TODOs only when the underlying issue is fixed or moved to an
  active plan.
- Clean docs that describe obsolete behavior:
  - `README.md`
  - `src/devtool/README.md`
  - `docs/SWAP.md` only when swap behavior changes.
- Clean CSS only for classes no longer referenced by current devtool UI. Do not
  redesign the devtool during this cleanup.
- Leave generated `dist/assets/` alone unless running the build intentionally
  regenerates it.

Acceptance:

- No commented-out dead code remains.
- No removed behavior has a new regression test.
- Docs match the current architecture and current limitations.

## Phase 10: Future UI Readiness Check

Goal: prove that a new UI can consume the core without pulling devtool code.

Tasks:

- Add a tiny compile-only consumer test that imports from the intended core
  entrypoint and performs these operations:
  - resolve assets;
  - quote a swap;
  - create swap Cart items;
  - compose an execution source or wallet intent request;
  - parse an execution receipt.
- Add or document a core entrypoint for future UIs, such as:

```text
src/core/index.ts
```

- Ensure that entrypoint does not export devtool React state, Bootstrap
  components, localStorage helpers, or devtool view names.

Acceptance:

- A future UI can start from the core entrypoint and its own state/rendering
  layer.
- Devtool remains one consumer, not the canonical UI architecture.

## Suggested Implementation Order

1. Add characterization tests for current behavior.
2. Extract/re-export reusable types.
3. Extract missing pure formatting/warning helpers from `App.tsx`.
4. Convert intent and Cart builders to explicit-input core helpers with devtool
   wrappers.
5. Stabilize GCScript composition tests, then separate only runtime/browser
   adapter concerns.
6. Narrow provider context and add provider mapping tests.
7. Thin devtool components that pass full state/dispatch.
8. Clean dead exports, stale docs, and unused styles.
9. Add the future UI core-consumer compile check.

## Verification Matrix

Run the narrowest check after each phase, then broaden when touching shared
behavior.

```text
pnpm run test:swap-quote
pnpm exec tsc -p ./src/devtool/tsconfig.json
pnpm run test:devtool-assets
pnpm run build
```

Source intent files are out of scope:

```text
do not modify src/intents/
```

When touching runtime GCScript composition:

```text
pnpm run test:swap-quote
pnpm exec tsc -p ./src/devtool/tsconfig.json
pnpm run build:devtool
```

When touching providers:

```text
pnpm run test:swap-quote
pnpm exec tsc -p ./src/devtool/tsconfig.json
```

Live provider checks should be explicit and dated when they are needed. Do not
silently treat live network availability as a unit-test requirement.

## Done Criteria

The goal is complete when:

- Reusable protocol/domain/provider/wallet/intent code is importable without
  React, Bootstrap, devtool view state, or browser storage/window APIs.
- Devtool UI imports reusable code through the same public core modules a future
  UI would use.
- GCScript bundled and parallel execution remains data-driven, root-cache-safe,
  and covered by shape tests.
- Core tests cover preserved behavior before cleanup removes old code.
- Devtool typecheck and relevant tests pass.
- `pnpm run build` passes after shared behavior changes.
- Documentation states that `src/devtool/` is a consumer/devtool shell, not the
  final user-facing UI or the owner of protocol semantics.
