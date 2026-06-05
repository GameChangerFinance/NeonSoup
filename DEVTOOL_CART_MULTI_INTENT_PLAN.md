# Devtool Cart And Multi-Intent Plan

## Goal

Turn NeonSoup devtool from a single-selected-intent workflow into a composable
intent workflow with Cart support, without breaking the current Open, Fill,
Close, Connect Wallet, wallet return, provider, portfolio, and activity behavior.

This is a dapp-wide refactor, but it must stay incremental: the existing one
intent at a time Open/Fill/Close actions keep working with exactly one selected
intent at execution time, while the new Cart path stores prepared intent
selections for later bulk execution.

Future normalization target: once bundled/parallel GCScript generation is
implemented, every protocol execution path should pass through the same
CartItem-list pipeline, including normal single Open/Fill/Close runs. A normal
single run then becomes a one-item selected list passed to the chosen
bundle/parallel generator, preserving today's wallet behavior while making all
protocol flows composable-ready. Connect Wallet remains outside this protocol
intent pipeline.

## Non-Negotiables

- Keep current Open, Fill, Close direct `Run` behavior working.
- Keep normal direct Open/Fill/Close execution single-intent: exactly one
  selected Cart item is the execution source of truth for the current action.
- In this first implementation, direct Open/Fill/Close may keep the current
  single-intent wallet generation for compatibility. The future target is to
  route even those one-item runs through the bundled/parallel generation
  services once they are implemented.
- Keep Connect Wallet completely outside the Cart system. It must not create,
  read, select, mutate, or execute Cart items.
- Keep overall current working state of the dapp, only rewrite what's needed.
- Do not change GCScript intent argument interfaces.
- Do not change `src/intents/lib/*`.
- Keep generated intent/debug visibility in Developer view.
- Keep asset keys canonical as `policyId.assetNameHex`.
- Keep provider identifiers named `assetId`, matching Cardano GraphQL/MKII and GCScript standard `assetId`.
- Keep invalid form values allowed, with Bootstrap warning/danger notices.
- Do not solve final bundled/paralelized GCScript composition yet. Add only
  well-named service entry points that log received arguments.

## Terminology

- **Cart item**: a prepared intent selection stored for later. It has identity,
  action name, args snapshot, source context, created time, selected state, and
  execution status.
- **Selected cart item**: a cart item currently checked for execution. This is a
  flag on the Cart item, not a parallel item list in app state.
- **Single intent execution**: the current Open/Fill/Close direct run mode. It
  uses the same Cart item data model as the source of truth, but only one item is
  selected and executed for the current action.
- **Executed cart item**: a cart item already submitted/executed from the Cart.
  It stays in cart history, is automatically deselected, and can be hidden,
  removed, or purged by the user.
- **Cart execution mode**:
  - `bundle`: try to put selected intents into as few transactions as possible. 1 final GCScript intent for the wallet.
  - `parallel`: run each selected intent as its own transaction. 1 final GCScript intent for the wallet.
- **Max intents per transaction**: upper bound used by future bundling logic.
  Default: `20` to stress-test the practical cap as it is difficult to calculate beforehand.

## State Model

Update [types.ts](src/devtool/src/state/types.ts):

- Extend `ViewId` with `cart`.
- Add:
  - `CartExecutionMode = 'bundle' | 'parallel'`
  - `CartItem`
  - `CartState`

Proposed shape:

```ts
export interface CartItem {
  id: string;
  name: Exclude<IntentName, 'connect'>;
  args: IntentArgs;
  selected: boolean;
  status: 'draft' | 'executed' | 'failed';
  createdAt: number;
  executedAt?: number;
  sourceOfferId?: string;
  sourceLabel?: string;
  pair?: AssetPair;
}

export interface CartState {
  items: CartItem[];
  mode: CartExecutionMode;
  maxIntentsPerTransaction: number;
  modalOpen: boolean;
  showExecutedOnly: boolean;
}
```

Add `cart: CartState` to `AppState`.

Add reducer actions:

- `add-cart-item`
- `add-cart-items`
- `remove-cart-item`
- `remove-cart-items`
- `clear-cart`
- `purge-executed-cart-items`
- `toggle-cart-item`
- `select-all-visible-cart-items`
- `deselect-all-cart-items`
- `set-cart-item-selected`
- `set-cart-items-selected`
- `mark-cart-items-executed`
- `set-cart-mode`
- `set-cart-max-intents-per-transaction`
- `set-cart-modal-open`
- `set-cart-show-executed-only`

Keep `intentBundle` for Developer/debug compatibility for now, but treat `cart`
as the source of truth for multi-intent execution. `intentBundle` can mirror
selected cart items after cart changes until later cleanup.

## Services

Create [cartIntents.ts](src/devtool/src/services/cartIntents.ts).

Required functions:

```ts
export function createCartItemFromCurrentIntent(state: AppState, options?: { freshIntentId?: boolean }): CartItem;
export function createBulkOpenCartItems(
  state: AppState,
  count: number,
  priceVariancePercent: number,
  offerVariancePercent: number,
): CartItem[];
export function selectedCartItems(cart: CartState): CartItem[];
export function visibleCartItems(cart: CartState): CartItem[];
export function selectedSingleCartItem(cart: CartState): CartItem | null;
```

Rules:

- Cart item `id` must be unique and based on intent id where possible.
- If an item already exists with the same `id`, reject the addition and show a
  Bootstrap warning.
- For Fill and Close, also validate source UTxO uniqueness. There must not be
  two active draft cart items trying to consume the same `<txHash>#<index>`.
- Do not dedupe by assets, amounts, or price. Those collisions are intentional
  for bulk-open and custom carts.
- `selectedSingleCartItem` is for normal direct Open/Fill/Close execution. It
  must return a result only when exactly one active item is selected.
- Connect Wallet is not a cart intent and must not pass through these helpers.

Create [intentExecution.ts](src/devtool/src/services/intentExecution.ts).

Required placeholder functions:

```ts
export function buildBundledGcscriptIntent(args: {
  state: AppState;
  items: CartItem[];
  maxIntentsPerTransaction: number;
}): IntentTemplate['code'] {
  console.log('buildBundledGcscriptIntent', args);
  throw new Error('Bundled multi-intent execution is not implemented yet.');
}

export function buildParallelGcscriptIntent(args: {
  state: AppState;
  items: CartItem[];
}): IntentTemplate['code'] {
  console.log('buildParallelGcscriptIntent', args);
  throw new Error('Parallel multi-intent execution is not implemented yet.');
}
```

These two functions must be the only place where final protocol execution
GCScript is assembled in the future. That includes multi-item Cart runs and
one-item direct Open/Fill/Close runs after the future normalization switch.

Current first implementation behavior:

- Cart `Run` calls the right placeholder based on cart mode.
- Catch the placeholder error and show a Bootstrap `warning` or `info` notice
  saying multi-intent execution is scaffolded but not implemented.
- Do not open the wallet from Cart `Run` until one of those functions returns a
  real intent.
- Once real execution exists, successful launch/submission should mark submitted
  selected items as `executed`, set `executedAt`, and deselect them. Placeholder
  failures must not mark items executed.

## Components

Add [CartPanel.tsx](src/devtool/src/components/cart/CartPanel.tsx).

Responsibilities:

- Reusable in Cart view and Cart modal.
- Design like a typical cart with a compact toolbar, item rows, selected count,
  total count, and clear bulk actions.
- Render cart item table/list with multi-selection:
  - row checkbox
  - select all visible checkbox/action
  - action badge
  - status badge: draft, executed, failed
  - source label / pair summary
  - compact args summary
  - created time
  - executed time when relevant
  - remove button for each row
- Render cart controls near the `Run` button:
  - `Bundle` switch
  - `Max intents per transaction` numeric input
  - `Run selected`
  - `Select all`
  - `Deselect all`
  - `Remove selected`
  - `Purge executed`
  - `Show executed only` toggle
- Render empty state.
- Use Bootstrap components/classes directly; no React-Bootstrap.
- Keep table/JSON sections inside existing scroll-panel/json-scroll patterns.

View behavior:

- Default view shows pending items only so the cart reads as actionable work.
- `Show executed only` toggles to executed/history visibility only.
- Executed items are deselected by default and are not included in `Run
  selected` unless the user explicitly shows history and reselects them.
- Manual removal is permanent from app state and persisted storage.
- `Purge executed` removes all executed/history items.
- `Remove selected` removes currently selected visible items, not hidden ones.

Add [CartModal.tsx](src/devtool/src/components/cart/CartModal.tsx).

Responsibilities:

- Bootstrap modal markup driven by `state.cart.modalOpen`.
- Reuse `CartPanel`.
- Close on backdrop/close button by dispatching `set-cart-modal-open`.

App shell updates:

- Add Cart nav item/view.
- Add cart icon button next to theme toggle in
  [AppShell.tsx](src/devtool/src/components/layout/AppShell.tsx).
- Badge the cart button with selected/total item count.
- Do not add new icon dependencies unless one already exists. Prefer a small
  inline Bootstrap-friendly icon/text fallback if no icon library exists.

## Trade UI Changes

Current action buttons: Open, Fill, Close.

Add cart buttons next to direct run buttons:

- Open form:
  - `Open offer` remains direct wallet run.
  - Add an icon-only add-to-Cart button next to it.
  - Each Open add-to-Cart click must create a fresh `intent-id` so users can
    repeat the same amount and price several times.
- Fill form:
  - `Fill offer` remains direct wallet run.
  - Add an icon-only add-to-Cart button next to it.
- Close form:
  - `Close offer` remains direct wallet run.
  - Add an icon-only add-to-Cart button next to it.
- Developer `GeneratedIntentPanel` run area:
  - Add an icon-only add-to-Cart button next to `Run` where the current action
    can be captured.

Behavior:

- Add-to-Cart snapshots the current generated args via `buildArgsForAction(state)`.
- The new cart item is selected by default.
- The new cart item status is `draft`.
- Show success notice: `Intent added to Cart.`
- Do not mutate current form/action selection.
- Do not open wallet.
- Direct Open/Fill/Close `Run` must prepare or refresh one selected Cart item
  for the current action and execute that single item only.
- First implementation may keep using the current direct single-intent wallet
  path after preparing that one selected item.
- Future normalization must route that one selected item through
  `buildBundledGcscriptIntent` or `buildParallelGcscriptIntent`, with a one-item
  `items` array.
- Direct Open/Fill/Close `Run` must not execute multiple selected items from the
  persisted Cart; multi-selection execution belongs only to Cart `Run selected`.
- Connect Wallet remains a separate wallet intent path and must not show an
  add-to-Cart action, use Cart state, or be affected by Cart modal/history
  behavior.

## Bulk-Open Tab

Inside Trade, replace the action button group with Bootstrap tabs:

- `Open`
- `Fill`
- `Close`
- `Bulk-Open`

Keep `state.action` for Open/Fill/Close. Add a separate local or state field for
active trade tab only if necessary. Prefer state if the tab affects generated
intent/cart behavior.

Bulk-Open UI:

- Same asset-pair and Open amount/price inputs as Open.
- Additional fields:
  - `N number of offers to open`
  - `R price variance percent`
  - `R2 offer amount variance percent`
- Default:
  - `N = 2` or `3` for safe testing. Recommended: `3`.
  - `R = 0`
  - `R2 = 0`
- Button:
  - `Open offers` with add/cart icons.
- On click:
  - Generate N cart items.
  - For each item, clone current Open args and vary price and offer quantity:
    - `randomFactor` is a random number in `[-1, 1]`.
    - `adjustedAsk = baseAsk * (1 + randomFactor * R / 100)`.
    - `adjustedOffer = baseOffer * (1 + randomFactor * R2 / 100)`.
    - Keep integer base-unit quantities.
    - Ensure all required GCScript args are present.
  - All generated items are selected by default.
  - Open the Cart modal automatically.

Important: if R is zero, every generated item should use the same base price.

## Intent Args Rules

Cart items must store complete args, not references to mutable form state.

For Open:

- Always include `price-numerator` and `price-denominator` and other required args. 
- Never allow undefined args to reach GCScript. Missing-balance UX happens at
  `buildTx`; undefined `plutusData` args fail too early.

For Fill and Close:

- Snapshot the selected UTxO and owner stake hash at add-to-cart time.
- Cart should surface if source order is no longer present in live open offers,
  but do not delete the item automatically.
- Always include other required args.
- Validate source UTxO uniqueness. Two active draft Fill/Close cart items cannot
  consume the same `<txHash>#<index>`.

For Fill:
- Always include `price-numerator` and `price-denominator` and other required args. 

## Wallet Execution Integration

Keep [gcWallet.ts](src/devtool/src/services/gcWallet.ts) direct-run flow for
single intents.

Add a future-friendly entry point:

```ts
export async function openWalletWithIntent(state: AppState, code: IntentTemplate['code']): Promise<void>
```

For this plan's implementation, only use it if bundled/parallel placeholder
functions later return real code. Until then, Cart `Run` should log and display
the scaffolded-not-implemented notice.

## Developer View

Update Developer view to show:

- Current generated single intent as today.
- Cart state JSON.
- Selected cart items JSON.
- Existing intent bundle JSON as an editable/debug override surface. Developer
  view may override everything for advanced testing, but normal app execution
  treats selected Cart items as the source of truth.
- Make clear in debug labels that direct Open/Fill/Close execution is the
  single-selected-item path, while Cart execution is the multi-selected-item
  path. Connect Wallet should be visible only as the independent generated
  connect intent, not as a Cart item.

## Persistence And Versioning

Cart state is meaningful app/session state and should be persisted with existing
stored app state.

Because this changes persisted state shape:

- No one-off migration.
- Bump `VITE_NEONSOUP_BUILD_TAG` locally or document that users will see the
  centralized app-state update banner when the build tag changes.
- Keep SemVer build metadata format: `0.0.1+tag`.

## Styling

- Use the current Bootstrap-first dark/light theme.
- Keep Cart modal compact and table-like, not a marketing card.
- Cart icon button should match existing small round nav icon buttons.
- Use Bootstrap alert tones correctly:
  - success: added to cart
  - warning: selected cart item has stale/missing source order
  - info: multi-intent execution is scaffolded
  - danger: impossible state/error
  - executed/history rows should be visually quieter than active draft rows

## Verification

After implementation:

1. `pnpm run test:devtool-assets`
2. `pnpm exec tsc -p ./src/devtool/tsconfig.json`
3. Browser smoke test:
   - Open app.
   - Add Open to Cart.
   - Add Fill to Cart from Pair Offers.
   - Add Close to Cart from owned offer.
   - Open Cart modal from nav icon.
   - Toggle item selection.
   - Select all, deselect all, remove selected.
   - Toggle `Show executed only` and purge executed items.
   - Switch bundle on/off.
   - Change max intents per transaction.
   - Click Cart Run and confirm placeholder function logs correct arguments and
     UI shows scaffolded notice.
   - Bulk-Open with N=3/R=0 and confirm 3 selected cart items are added.
   - Bulk-Open with R>0 and confirm price args differ without undefined values.
4. Run the full devtool build after typecheck because Cart touches shared
   frontend behavior and wallet-intent loading.

## Resolved Design Decisions

- Duplicate cart items are rejected by unique cart item id, based on intent id
  where possible.
- Fill and Close additionally reject active draft cart collisions on the same
  source UTxO.
- Duplicate assets, amounts, and prices are allowed. This is required for
  bulk-open and custom cart scenarios.
- Cart survives wallet return reloads through persisted app state.
- Completed/submitted cart items are not auto-removed. They become `executed`,
  are deselected, and remain available in history until the user removes or
  purges them.
- Cart UI defaults to active draft items. Users can toggle executed/history
  visibility and purge executed items.
- Normal (current single intent mode) execution uses selected Cart items as source of truth but only 1 selected item at a time. Developer view remains an advanced override/debug surface.
- Future normalization will route even that one selected item through the same
  bundled/parallel final intent generation used by Cart runs.
- Connect wallet intent is independent from the cart system and must remain exactly as it works now.
