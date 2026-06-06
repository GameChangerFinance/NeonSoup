# Composability-First Execution Cleanup Plan

## Goal

Make every Open, Fill, and Close execution use the existing cart-item and
multi-intent composition pipeline.

A direct action must become a transient one-item composition. A Cart run must
remain a persisted multi-item composition. Both paths must use the same current
builders, wallet-code launcher, argument snapshots, and protocol lib fragments.

Remove the obsolete single-intent execution path and its supporting state,
types, helpers, UI, and documentation. Do not alter `src/intents/lib/*`.

## Target Execution Model

```text
current form / selected offer
        |
        v
createCartItemFromCurrentIntent(state)
        |
        v
CartItem[]
        |
        v
buildBundledGcscriptIntent(...) or buildParallelGcscriptIntent(...)
        |
        v
openWalletCode(state, composedCode)
        |
        v
returned neonsoupExecution receipt -> pending
        |
        v
positive network observation -> confirmed
```

- Direct Open, Fill, and Close run a transient `CartItem[]` containing one item.
- Cart `Run selected` runs selected persisted draft items.
- `createCartItemFromCurrentIntent(state)` remains the single existing adapter
  from current form/selected-offer state into the same `CartItem` input used by
  multi-intent execution. Direct execution must reuse it exactly; do not create
  a separate single-intent argument or selection path.
- Both honor the existing `state.cart.mode`.
- Bundle and parallel builders remain the only protocol execution GCScript
  assemblers used by the app.
- Connect Wallet and future special/non-composable intents remain outside the
  Cart protocol-composition pipeline, but use generic code-based wallet launch
  helpers that do not encode intent-specific purposes.
- The standalone built files under `dist/intents/` remain build artifacts, but
  the devtool does not load, execute, or expose them in Developer UI.

## Non-Negotiables

- Do not change `src/intents/lib/*` or protocol argument interfaces.
- Reuse `CartItem`, `createCartItemFromCurrentIntent`,
  `selectedCartItems`, `buildBundledGcscriptIntent`,
  `buildParallelGcscriptIntent`, `openWalletCode`, and the current Cart state.
- Do not create a replacement single-intent builder, wrapper, selection model,
  or compatibility path.
- Do not hardcode reusable GCScript execution/receipt parameter values inside
  generated `run` or `finally` objects. Pass them through GCScript `args` and
  resolve them with ISL `get('args...')`; resolve wallet-runtime results with
  ISL `get('cache...')`.
- Do not preserve obsolete state or helpers for hypothetical future use.
- Keep Connect Wallet behavior separate and working without making wallet
  helpers Connect-specific.
- Preserve the current working Connect Wallet feature and its app-state
  footprint, including connected wallet data, return capture, storage handling,
  UI behavior, and portfolio refresh behavior.
- Keep the three built top-level protocol intents and their source files as
  standalone build artifacts.
- Rebuild generated artifacts only after source cleanup is complete.
- Opening or redirecting to GameChanger Wallet must never mark a Cart item
  pending, completed, executed, or confirmed.
- Only a successfully returned structured NeonSoup execution export may move
  matching items from `draft` to `pending`.
- Only positive network confirmation may move matching items from `pending` to
  `confirmed`.

## 1. Normalize Protocol Execution

Update `src/devtool/src/App.tsx`.

- Generalize the current Cart execution flow so it accepts a supplied
  `CartItem[]` instead of only reading selected persisted Cart items.
- This must be the existing multi-intent execution flow adapted for both
  callers, not a new parallel single-intent runner or wrapper.
- The normalized multi-intent execution path must:
  - reject an empty item list;
  - select the existing bundle or parallel builder from `state.cart.mode`;
  - pass `state.cart.maxIntentsPerTransaction` to bundle mode;
  - launch the generated code through `openWalletCode`;
  - make no Cart lifecycle changes merely because the wallet popup/redirect was
    opened;
  - leave transient direct-run items out of Cart history.
- Direct Open, Fill, and Close buttons must call the shared path with:

  ```ts
  [createCartItemFromCurrentIntent(state)]
  ```

- Cart `Run selected` must continue using `selectedCartItems(state.cart)`,
  filter draft items, and pass them to that same normalized flow.
- Remove the no-op direct-run call that creates and discards a Cart item.
- Remove imports and calls for the legacy non-connect `openWallet` path.

Do not add another custom execution service or helper around this. Reuse and
generalize the current multi-intent handler, current builders, and
`openWalletCode`. The only difference between direct and Cart execution is the
origin and persistence of the supplied `CartItem[]`.

If the user closes the wallet popup, cancels, or otherwise never returns a
successful NeonSoup execution export, persisted Cart items remain `draft`,
selected/relaunchable, and unchanged.

## 2. Purge Legacy Single-Intent Runtime State

Update `src/devtool/src/state/types.ts`, `src/devtool/src/state/reducer.ts`,
`src/devtool/src/App.tsx`, and related call sites.

Delete:

- `IntentSelection`
- `IntentBundle`
- `AppState.intentArgs`
- `AppState.intentBundle`
- `AppState.intents`
- `set-intent-args`
- `set-intent-bundle`
- `set-intents`
- `freshBundle`
- `bundleFromCart`
- intent-bundle mirroring from `withCart`
- initial-state intent template and intent-argument fields
- reducer resets that only clear `intentArgs`
- the effect that continuously derives and stores `state.intentArgs`
- unused `loading.intents` state if no call sites remain

Keep:

- `IntentTemplate` as the type for generated composed GCScript code.
- `IntentArgs` as the protocol argument snapshot type.
- `ActionMode` as the Open/Fill/Close action discriminator.
- `CartItem` and `CartState` as the protocol execution input/state model.

After the cleanup, forms and selected offers are editable preparation state;
`CartItem.args` is the immutable execution snapshot.

## 3. Simplify Intent Argument Creation

Update `src/devtool/src/services/intents.ts` and
`src/devtool/src/services/cartIntents.ts`.

Delete from `intents.ts`:

- `clone`
- `loadIntentTemplates`
- `buildIntentSelection`
- `prepareIntent`
- imports and types used only by those functions

Change argument builders so they no longer read `state.intentArgs` to preserve
intent IDs.

- Keep `createCartItemFromCurrentIntent(state)` as the shared existing adapter
  used by both Add-to-Cart and direct execution.
- Each call must produce a complete, fresh execution snapshot with a unique
  intent ID.
- Remove the `freshIntentId` option from `createCartItemFromCurrentIntent`; it
  becomes redundant once every snapshot creates its own execution identity.
- Preserve current Fill/Close source UTxO collision validation.
- Preserve `createBulkOpenCartItems` and its explicit bulk IDs.
- Delete `selectedSingleCartItem`; direct execution no longer reads a selected
  persisted Cart item and the helper has no valid caller.

Do not replace removed selection helpers with new equivalents.

## 4. Keep Wallet Helpers Generic And Purpose-Agnostic

Update `src/devtool/src/services/gcWallet.ts` and
`src/devtool/src/components/layout/AppShell.tsx`.

Keep and reuse:

- `walletUrlForCode`
- `openWalletUrl`
- `openWalletCode`
- wallet return capture/decoding helpers

Delete:

- the generic legacy `walletUrl(state, intent)` branch;
- the generic legacy `openWallet(state, intent)` branch;
- dependencies on `prepareIntent` and `state.intents`.

Retain Connect Wallet and allow future special intents by keeping generic
helpers that accept explicit GCScript code independently of its purpose.

- Special-intent code creation may remain separate from protocol Cart-item
  composition.
- Special intents must launch through generic `openWalletCode` or
  `walletUrlForCode`.
- Do not introduce `openConnectWallet`, `prepareConnectIntent`, or similarly
  purpose-specific wallet transport helpers.
- The current Connect button may create or retrieve its static code at the call
  site or through a generic static-intent source, then pass that code to the
  generic launcher.
- This cleanup must not remove or change the current Connect Wallet intent
  payload, exported return shape, `WalletConnection` state, `set-wallet`
  behavior, wallet-return decoding/capture, popup behavior, persisted wallet
  state, or refresh effects triggered by a connected address.
- Generic transport means only that the function opening/encoding explicit
  GCScript code is purpose-agnostic. Connect-specific intent construction and
  return interpretation remain valid where required by the feature.

The final API must allow arbitrary explicit GCScript code to be launched while
making Open, Fill, and Close use the Cart-item composition pipeline by
construction.

## 5. Improve Wallet-Facing Intent And Transaction Text

Update `src/devtool/src/services/intentExecution.ts`.

The generated root intent title, transaction titles, tags, and auxiliary-data
messages must describe what the user is being asked to execute. Current text
such as `Open 5`, `1. Open`, or an opaque generated group ID does not provide
enough information in GameChanger Wallet transaction history or confirmation
dialogs.

Reuse existing `CartItem` fields and args:

- `name`
- `sourceLabel`
- `pair`
- `offer-quantity`
- `ask-quantity`
- `utxo-tx-hash`
- `utxo-tx-index`

Do not add a parallel display-data model. Add only small formatting functions
inside `intentExecution.ts` where necessary to convert existing execution items
into wallet-facing text.

Use the existing `sourceLabel` field as the item-level friendly execution
summary. Improve `createCartItemFromCurrentIntent` and
`createBulkOpenCartItems` so `sourceLabel` captures useful human-readable
action, pair, and amount text using the asset/quantity helpers they already
use. The composer should prefer `sourceLabel` instead of rebuilding UI display
knowledge or adding new display-only fields.

### Root GCScript Titles

Use friendly NeonSoup titles based on the execution contents:

- transient or persisted one-item Open: `🍲 NeonSoup Open Offer`
- one-item Fill: `🍲 NeonSoup Fill Offer`
- one-item Close: `🍲 NeonSoup Close Offer`
- multiple items: `🍲 NeonSoup Cart`

Bundle and parallel mode are implementation/execution details and should not be
the primary user-facing root title.

### Transaction Titles

Each `buildTx.title` must summarize the transaction contents rather than only
showing an action and count.

Examples:

- one Open: `🍲 NeonSoup Open ADA → USDM offer`
- one Fill: `🍲 NeonSoup Fill ADA → USDM offer`
- one Close: `🍲 NeonSoup Close ADA → USDM offer`
- mixed transaction: `🍲 NeonSoup Cart · 5/25`
- several same-pair/same-action items: `🍲 NeonSoup Cart · 5/25`

For Cart transactions, `5/25` means this transaction contains 5 of the 25 total
Cart intents being executed. For parallel execution, each transaction title
uses `1/25`.

Use friendly asset labels already captured through `sourceLabel`. Otherwise use
compact canonical asset identifiers derived from `CartItem.pair` or args. Do
not introduce network/provider lookups during composition.

Keep titles short enough but human friendly for wallet transaction-history rows. Put detailed
amounts, source UTxOs, and item-by-item information in metadata messages.

### Auxiliary Metadata Messages

Replace opaque/group-only metadata such as:

```text
🍲 NeonSoup composed tx
Group open-15-...
1. Open
2. Open
```

with friendly, useful summaries such as:

```text
🍲 NeonSoup Cart
Opening 5/25 ADA → USDM offers
Group ad3f...b5c1
1. Open 8.82 ADA → 13.63 USDM
   Item 4c82...91ae
2. Open 10.64 ADA → 13.63 USDM
   Item 80fb...7d12
3. Open 10.96 ADA → 13.63 USDM
   Item a930...ca71
```

For Fill and Close items, include the compact source UTxO:

```text
1. Fill 8.82 ADA → 13.63 USDM · 59e9...68d2#0
   Item f13a...01d9
2. Close 10.96 USDM → 13.63 ADA · a16d...40c1#1
   Item b882...e40a
```

Requirements:

- Use `🍲 NeonSoup Cart` as the first line for multi-item executions.
- For one-item executions, use the matching friendly action title:
  `🍲 NeonSoup Open Offer`, `🍲 NeonSoup Fill Offer`, or
  `🍲 NeonSoup Close Offer`.
- The second line summarizes the current transaction using
  `items in this transaction / total execution items`, action, and pair when
  those values are consistent. Examples:
  - `Opening 5/25 ADA → USDM offers`
  - `Filling 1/25 ADA → USDM offers`
  - `Executing 5/25 Cart intents` for mixed actions or pairs.
- Each numbered line should reuse the item's improved `sourceLabel`, prefixed
  with its number, and append compact source UTxO when applicable.
- Include the internal composition group ID and each intent item ID for
  traceability, but never expose their full long values in user-facing text.
- Truncate long IDs and hashes consistently as `ad3f...b5c1`: first 4
  characters, three dots, and last 4 characters.
- Apply that same truncation format to group IDs, intent item IDs, transaction
  hashes, UTxO transaction hashes, and other long identifiers when displayed in
  wallet-facing titles or metadata.
- Keep full IDs unchanged internally. Truncation is display-only.
- Keep metadata within Cardano transaction metadata string-size limits by
  splitting long content into safe short strings and limiting item detail when
  necessary.
- Preserve exact transaction semantics; this is display metadata only.

### Composer Inputs

Improve the existing `CartItem.sourceLabel` at Cart-item creation time using
the existing asset resolution and quantity formatting helpers. Do not add a
second display snapshot, pass full `AppState` into low-level composer text
formatting, or perform provider requests from the composer.

Verify wallet-facing text for:

- direct one-item Open, Fill, and Close;
- one-item Cart runs;
- same-action/same-pair multi-item Cart runs;
- mixed-action or mixed-pair Cart runs;
- bundle groups split by `maxIntentsPerTransaction`;
- parallel transactions.
- traceability entries for group IDs, item IDs, and source UTxOs using the
  required `ad3f...b5c1` truncation format.

## 6. Return Rich Structured Execution Receipts

Update `src/devtool/src/services/intentExecution.ts` and wallet-return
interpretation in `src/devtool/src/App.tsx` or its existing return-handling
module.

Every generated final NeonSoup protocol GCScript, including transient one-item
direct runs, bundled Cart runs, and parallel Cart runs, must export a
structured execution receipt.

Use one consistent export name, such as:

```text
neonsoupExecution
```

The export is the machine-readable contract between the generated GCScript and
the devtool. Do not infer composed execution state by recursively searching
arbitrary wallet return fields.

The root `finally` result must be produced only after the generated submit step
successfully completes. A returned receipt means the wallet execution reached
the submission stage; it does not mean the transactions are confirmed on-chain.

### Compact URL Return Contract

The wallet return URL must never carry signed transaction CBOR. The current
shape that returns `exports.neonsoupCart.txs` from `cache.sign` is forbidden and
must be removed.

Keep signed transaction CBOR internal to the generated GCScript:

```text
buildTx -> signTxs -> submitTxs
                    |
                    +-> cache.sign is used only by submitTxs
```

After submit, compose the final exported receipt declaratively inside GCScript
with a root `macro` and ISL references.

Pass all composer-known execution, group, item, source, role, count, index, and
other receipt parameter data into the generated root GCScript through `args`.
This includes composition-only parameters such as `"mode": "bundle"` or
`"mode": "parallel"`, even though `mode` must not be returned in the final
receipt. Pass root args explicitly into nested group scripts where those
scripts need them. The reusable composer derives this argument object from its
current execution inputs; the example values below illustrate generated args
and must not become fixed constants in the composer implementation.

Every value emitted by `finally.run` must resolve through ISL:

- composer-known parameter data: `get('args...')`;
- wallet-runtime build results: `get('cache...')`.

Do not place generated IDs, group IDs, item IDs, intent IDs, action types,
counts, indexes, source UTxOs, output roles, labels, modes, or other reusable
execution parameters as hardcoded literal values inside `finally.run`.

Illustrative generated shape:

```jsonc
{
  "args": {
    "mode": "bundle",
    "execution-id": "full-execution-id",
    "item-count": 1,
    "group-count": 1,
    "groups": {
      "0": {
        "group-id": "full-group-id",
        "group-index": 0,
        "group-count": 1,
        "items": {
          "0": {
            "item-id": "full-item-id",
            "intent-id": "full-intent-id",
            "type": "open",
            "item-index": 0,
            "group-item-index": 0,
            "output-role": "openedOffer"
          }
        }
      }
    }
  },
  "exportAs": "neonsoupExecution",
  "return": { "mode": "last" },
  "run": {
    "group0": {
      "type": "script",
      "args": "{get('args.groups.0')}",
      "run": {
        "build": {
          "type": "buildTx",
          "tx": "{get('cache.tx')}"
        }
      }
    },
    "sign": {
      "type": "signTxs",
      "txs": ["{get('cache.group0.txHex')}"]
    },
    "submit": {
      "type": "submitTxs",
      "mode": "noWait",
      "txs": "{get('cache.sign')}"
    },
    "finally": {
      "type": "macro",
      "run": {
        "executionId": "{get('args.execution-id')}",
        "itemCount": "{get('args.item-count')}",
        "groupCount": "{get('args.group-count')}",
        "groups": [
          {
            "groupId": "{get('args.groups.0.group-id')}",
            "groupIndex": "{get('args.groups.0.group-index')}",
            "groupCount": "{get('args.groups.0.group-count')}",
            "txHash": "{get('cache.group0.txHash')}",
            "items": [
              {
                "itemId": "{get('args.groups.0.items.0.item-id')}",
                "intentId": "{get('args.groups.0.items.0.intent-id')}",
                "type": "{get('args.groups.0.items.0.type')}",
                "itemIndex": "{get('args.groups.0.items.0.item-index')}",
                "groupItemIndex": "{get('args.groups.0.items.0.group-item-index')}",
                "outputs": [
                  {
                    "role": "{get('args.groups.0.items.0.output-role')}",
                    "index": "{get('cache.group0.indexMap.offerWithBeacons')}"
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  }
}
```

Use the actual existing build-result cache paths exposed by the composed
wrapper. For example, use `cache.group0.txHash` only if the group wrapper
returns the `buildTx` result at that path; otherwise reference the actual
`cache.<buildStep>.txHash` path. Verify these paths against generated script
structure and wallet context rather than assuming them.

The final export must not contain:

- `schemaVersion`;
- execution `mode`;
- `cache.sign`;
- a `txs` or `txHex` field;
- signed or unsigned transaction CBOR;
- full transaction bodies, witnesses, or build inputs;
- wallet cache/context dumps;
- redundant copies of the same group transaction hash on every item/output.

Keep the receipt readable but compact. Its URL size must scale with execution
metadata and item count, not transaction-body size. Store each built
transaction hash once on its group. Output references from that transaction
should contain only semantic role and output index; their full UTxO is derived
as `<group.txHash>#<output.index>`.

GCScript/ISL is declarative and does not provide normal imperative loops or
conditionals. Generate the final receipt object/arrays in the existing
TypeScript composer, generate matching root argument data, then use a `macro`
result containing only targeted ISL `get('args...')` and `get('cache...')`
references. Do not add protocol-lib changes or a custom wallet-return
postprocessor to construct data that the final composed script can return
directly.

### Receipt Shape

The receipt must contain enough data to reconcile every transaction and intent
item without relying on current UI selection or mutable forms:

```ts
interface NeonSoupExecutionReceipt {
  executionId: string;
  itemCount: number;
  groupCount: number;
  groups: Array<{
    groupId: string;
    groupIndex: number;
    groupCount: number;
    txHash: string;
    items: Array<{
      itemId: string;
      intentId: string;
      type: 'open' | 'fill' | 'close';
      itemIndex: number;
      groupItemIndex: number;
      sourceOfferId?: string;
      sourceUtxo?: {
        txHash: string;
        index: string;
      };
      outputs: Array<{
        role: 'openedOffer' | 'remainingOffer' | 'filledOffer' | 'closedFunds';
        index: string;
      }>;
    }>;
  }>;
}
```

Exact TypeScript organization may be adjusted to existing conventions, but the
returned information must remain equivalent.

Requirements:

- Return full, untruncated IDs and hashes in the machine-readable receipt.
- Use truncation only for user-facing metadata/title text.
- Include every selected input item, even when multiple items share one bundled
  transaction.
- Include stable global item index and group-local item index.
- Include group ID, group index, and total group count.
- Include each item ID and its protocol `intent-id`.
- Include exact action type: Open, Fill, or Close.
- Include source offer/UTxO identity for Fill and Close.
- Include built transaction hash for each group/parallel transaction.
- Include output UTxO references and semantic output roles when the build index
  map exposes them:
  - Open: opened offer UTxO.
  - Fill: taker/fill output and remaining continuing offer UTxO.
  - Close: returned/closed funds output.
- Derive each expected output UTxO from its group-level `txHash` and output
  `index`; do not repeat the transaction hash inside every output.
- Do not alter protocol lib fragments to produce the receipt. Build the receipt
  at the final composed-script layer using known Cart items, group structure,
  `buildTx.txHash`, and `buildTx.indexMap`.
- Keep `cache.sign` available only to `submitTxs`; never expose it through
  `finally`, `exportAs`, or the wallet return URL.
- Pass all reusable receipt parameter data through root/nested GCScript args and
  read it from `finally` with ISL `get('args...')`; use `get('cache...')` only
  for wallet-runtime results.
- Do not return `schemaVersion` or execution `mode`. `mode` remains an internal
  GCScript argument when needed to construct bundle/parallel execution.
- Preserve the raw captured wallet return in Developer/App State for debugging.

### Partial And Missing Results

- Opening the wallet does not update item lifecycle state.
- No returned receipt means no item lifecycle update.
- If a valid receipt contains only some expected groups/items, update only the
  explicitly returned items and leave all others relaunchable.
- Reject or warn on malformed receipts, duplicate item IDs, missing transaction
  hashes, or receipt items that cannot be matched.
- Do not mark unmatched Cart items pending through positional assumptions.
- Connect Wallet and other special-intent exports must continue through their
  existing independent interpretation and must not be mistaken for a NeonSoup
  protocol execution receipt.

## 7. Reconcile Cart And Protocol State From Receipts

Update `src/devtool/src/state/types.ts`, `src/devtool/src/state/reducer.ts`,
wallet-return handling, Cart UI, transaction/activity rendering, and network
refresh reconciliation.

### Cart Item Lifecycle

Replace the inaccurate launch-time `executed` behavior with:

```text
draft -> pending -> confirmed
  |         |
  +-------> failed
```

- `draft`: prepared and relaunchable; no successful execution receipt exists.
- `pending`: a valid returned receipt reports submission, but network
  confirmation is not yet observed.
- `confirmed`: positive network data confirms the submitted transaction/result.
- `failed`: execution or later network reconciliation positively reports
  failure; relaunchable.

Rules:

- Never mark Cart items `pending` or `confirmed` when calling
  `openWalletCode`.
- On a valid returned receipt, match persisted Cart items by full `itemId` and
  move only matching returned items to `pending`.
- For transient direct-run items that do not exist in persisted Cart state,
  create/update the existing protocol transaction/activity record from the
  receipt so `opening`, `filling`, or `closing` state is still visible without
  inventing a Cart history entry.
- Store the returned transaction hash, group ID/index, receipt time, and
  relevant output/source UTxO references on matching Cart items or in the
  existing transaction record used to reconcile them.
- Pending and confirmed items should be deselected by default.
- Draft and failed items remain relaunchable.
- Pending items are not complete. Permit an explicit requeue/relaunch action
  with a clear duplicate/double-spend warning; do not silently relaunch pending
  submissions.
- Confirmed items are completed history and must not be relaunched without
  creating a new Cart item.
- Remove `mark-cart-items-executed` and replace it with receipt-driven lifecycle
  actions.
- Rename `executedAt` and “Show/Purge executed” UI to confirmed/pending-aware
  terminology consistent with the final state model.

### Pending Protocol Operations

Reuse and enrich the existing protocol transaction/activity state rather than
creating a disconnected second execution-history system.

The returned receipt must allow the app to immediately represent:

- submitted transaction groups as `pending`;
- newly opening offers as `opening`;
- existing source offers as `filling` or `closing`;
- each pending operation's item ID, intent ID, group ID, transaction hash,
  source UTxO, and expected output UTxOs.

Derive offer-facing pending labels by matching receipt item source/output UTxOs
against loaded offers and transaction records. Do not mutate provider-returned
`OpenOffer` objects into a second source of truth.

### Network Confirmation

- Refresh offers/transactions after a valid returned receipt.
- Reconcile pending operations only from positive network evidence.
- Open becomes confirmed when the expected opened-offer output is observed.
- Fill becomes confirmed when the submitted transaction/expected continuation
  output is positively observed.
- Close becomes confirmed when the submitted transaction is positively
  observed as confirmed.
- Do not treat temporary source-offer absence or provider failure alone as
  confirmation.
- Once confirmed, update matching Cart items and transaction/activity records
  and remove transient `opening`, `filling`, or `closing` indicators.
- Keep pending records available across reloads so confirmation can be
  reconciled later.

## 8. Remove Obsolete Developer UI

Update `src/devtool/src/App.tsx`.

Remove these Developer sections:

- Protocol Intents / Protocol Library
- Generated Intent
- Selected Cart Items
- Cart State
- Intent Bundle

Delete the now-unused file:

- `src/devtool/src/components/intents/GeneratedIntentPanel.tsx`

Remove its imports, props, wallet URL copy behavior, and all related call sites.
GameChanger Wallet will be the inspection and editing surface for the exact
GCScript being sent.

Keep these Developer sections:

- Captured Wallet Return
- App State

Remove the Developer UI dependency on `APP_CONFIG.intentFiles`. Keep
`APP_CONFIG.intentFiles` only if build tooling or another real runtime caller
still requires it; otherwise remove it during the obsolete-code scan.

## 9. Add A Reusable JSON Viewer

Create one reusable JSON viewer component under
`src/devtool/src/components/common/`.

This is the only new shared UI abstraction required by this cleanup because the
Developer view has multiple real JSON-display call sites.

The component must:

- accept an unknown JSON-compatible value;
- format it with `JSON.stringify(value, null, 2)`;
- render using the existing `json-scroll` visual treatment;
- reuse the existing `CopyIcon` and its clipboard behavior;
- place the copy icon button at the top-right;
- reserve enough top/right padding so the icon does not overlap JSON text or
  the vertical scrollbar;
- remain readable in both themes;
- expose an accessible copy label.

Use it for:

- Captured Wallet Return
- App State

Do not create a second clipboard helper. Extend `CopyIcon` only as narrowly as
needed for positioned/icon-button styling.

Do not force `StateRecoveryBoundary` error text through the JSON viewer because
it is not JSON data.

## 10. Remove Stale Cart UI And Types

Update `src/devtool/src/components/cart/CartPanel.tsx` and related state only
where the code is demonstrably obsolete.

- Remove the alerts claiming bundle and parallel composition are only
  scaffolded.
- Keep and actively use `failed` as a relaunchable receipt/network lifecycle
  state.
- Add clear draft, pending, confirmed, and failed presentation.
- Keep current Cart selection, persisted history, bundle/parallel mode, maximum
  group size, and lifecycle-aware history controls.
- Do not redesign the Cart or change protocol behavior in this cleanup.

## 11. Documentation Cleanup

Update current documentation so it describes the normalized architecture.

Required files:

- `src/devtool/README.md`
- `AGENTS.md`
- `DEVTOOL_CART_MULTI_INTENT_PLAN.md`, either:
  - update it into an accurate historical/completed plan; or
  - remove it if it no longer provides useful current guidance.

Remove statements that say:

- generated single intents are a current app execution path;
- intent bundles are first-class app state;
- final cart composition is pending;
- Developer exposes generated intent, Cart state, selected Cart items, or Intent
  Bundle;
- Developer exposes downloadable Protocol Intents or Protocol Library files.

Document:

- all Open/Fill/Close runs use the composition pipeline;
- direct runs are transient one-item compositions;
- Cart runs are persisted multi-item compositions;
- Connect Wallet and future special intents remain separate from Cart
  composition but use generic explicit-code wallet helpers without changing
  Connect Wallet state, return capture, or working behavior;
- wallet-facing titles and metadata describe the actual user actions.
- wallet return receipts drive pending state, while network observations drive
  confirmation;
- closing/cancelling the wallet before a receipt leaves Cart items relaunchable.
- generated protocol GCScripts export compact `neonsoupExecution` receipts
  assembled with GCScript macro/ISL `get(...)`, never hardcode returned
  parameter values, and never return transaction CBOR.

Do not alter protocol docs or argument contracts.

## 12. Expected Final Code Shape

After cleanup:

- `intentExecution.ts` is the only protocol transaction GCScript assembly path.
- `cartIntents.ts` is the only conversion layer from UI preparation state to
  executable protocol intent snapshots.
- `gcWallet.ts` launches explicit generated code and the separate Connect
  intent.
- `AppState` has Cart state but no intent templates, intent args, selections, or
  intent bundle compatibility state.
- Direct buttons and Cart execution share the same composer and wallet launch.
- Generated protocol GCScripts return rich execution receipts whose parameter
  values come from GCScript args via ISL `get(...)`.
- Signed transaction CBOR remains internal to wallet sign/submit steps and is
  never exported through the return URL.
- Cart and activity lifecycle changes are receipt-driven and
  network-confirmed, never wallet-launch-driven.
- Developer contains only Captured Wallet Return and App State.
- No `GeneratedIntentPanel`, `prepareIntent`, `selectedSingleCartItem`,
  `IntentSelection`, `IntentBundle`, `state.intents`, `state.intentArgs`, or
  `state.intentBundle` remains.

## 13. Verification

Run narrow checks first:

```text
pnpm exec tsc -p ./src/devtool/tsconfig.json
pnpm run build:devtool
```

Then run generated-intent checks:

```text
pnpm run build:intents
pnpm exec gamechanger-cli validate -f ./dist/intents/open.gcscript.json
pnpm exec gamechanger-cli validate -f ./dist/intents/close.gcscript.json
pnpm exec gamechanger-cli validate -f ./dist/intents/swap.gcscript.json
pnpm build
```

Required behavioral verification:

1. Direct Open launches a one-item composed GCScript.
2. Direct Fill launches a one-item composed GCScript.
3. Direct Close launches a one-item composed GCScript.
4. Direct runs do not add transient items to persisted Cart history.
5. Cart bundle mode still executes one and multiple selected items.
6. Cart parallel mode still executes one and multiple selected items.
7. Connect Wallet still works independently.
8. Direct and Cart-generated wallet titles clearly identify NeonSoup and the
   actual action.
9. Transaction metadata contains useful pair/action/amount/source summaries and
   compact traceability IDs.
10. Group IDs, item IDs, and long hashes use the exact `ad3f...b5c1`
    display-only truncation format.
11. Connect Wallet preserves its current intent result, app state, persistence,
    popup return, and refresh behavior.
12. Both Developer JSON viewers copy their exact displayed JSON.
13. Copy buttons do not overlap JSON content or scrollbars on desktop/mobile.
14. Opening and closing/cancelling the wallet without a returned receipt leaves
    Cart items draft and relaunchable.
15. A valid returned receipt marks only its matching Cart items pending.
16. A partial returned receipt leaves unmatched items draft and relaunchable.
17. Returned receipts include full execution/group/item/intent IDs,
    transaction hashes, source UTxOs, action types, indexes, and expected output
    UTxOs.
18. Decoded wallet exports contain `neonsoupExecution` and do not contain
    `neonsoupCart.txs`, `schemaVersion`, execution `mode`, `txs`, `txHex`,
    signed/unsigned CBOR, full transaction bodies, or witnesses.
19. Every `finally.run` receipt value is sourced through ISL `get('args...')`
    or `get('cache...')`; reusable execution parameter values are not hardcoded
    inside the macro.
20. Bundle/parallel mode, group IDs, item data, source data, roles, counts, and
    indexes are passed through generated GCScript args.
21. Receipt output references reuse their group transaction hash and contain
    only semantic role/index data needed to derive expected UTxOs.
22. Return payload size scales with receipt metadata rather than signed
    transaction size and remains substantially smaller than the previous CBOR
    export for bundle and parallel runs.
23. Wallet signing and submission still work because `cache.sign` remains
    internal and is passed unchanged to `submitTxs`.
24. Pending Open/Fill/Close operations appear as opening/filling/closing before
    network confirmation.
25. Positive network observations move matching pending Cart items and
    transactions to confirmed.
26. Provider errors or temporary source-offer absence do not falsely confirm
    operations.

Final source scan must return no obsolete single-intent footprint:

```text
rg -n "GeneratedIntentPanel|prepareIntent|selectedSingleCartItem|IntentSelection|IntentBundle|intentBundle|intentArgs|state\\.intents|set-intents|set-intent-args|set-intent-bundle|Protocol Intents|Protocol Library" src/devtool/src
```

Review the final diff to confirm `src/intents/lib/*` is untouched.
