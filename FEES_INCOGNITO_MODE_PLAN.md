# Fees And Incognito Mode Implementation Plan

## Goal

Add configurable NeonSoup service fees and an Incognito Mode wallet flow while preserving the existing Cart/composer architecture, DevTool compatibility, user-facing frontend behavior, and P2P DeFi Kernel protocol semantics.

Incognito Mode means the dapp can launch Open Offer and Swap actions without a connected wallet in app state. The wallet script asks GameChanger Wallet for the current address once, derives the needed address/staking data inside GCScript, reuses it across the generated transaction code, and returns only user-agnostic submission status back to NeonSoup.

## Non-Negotiables

- Do not create a second source of truth or app state to track Incognito Mode. Use a centralized helper returning a boolean after checking !state.wallet?.address.
- Do not create a second direct execution path. Direct actions and Cart runs must continue using the shared Cart/composer flow.
- Do not pass user address, stake key hash, balances, item IDs, amounts, pairs, tx hashes, or source UTxOs back to the dapp in Incognito Mode.
- Do not expose Incognito Mode as a fake wallet connection. It is a privacy mode for wallet-launched actions when no wallet is connected in app state.
- Do not weaken real invalid-action blocking. If data needed for a safe action is unavailable, halt implementation and ask the user.
- Keep all asset quantities and fee quantities BigNum/base-unit safe. Display units from env must be converted using asset decimals before GCScript composition.
- Do not try to determine on the dapp side whether the user's staking credential
  is a key hash or script hash. That would defeat Incognito Mode. The wallet
  intent must derive and validate the usable staking credential inside
  GCScript.

## Staking Credential Protocol Finding

Checked sources:

- `$cardano-p2p-defi-kernel` protocol reference: Cardano-Swaps follows the
  CIP-0089 distributed DApp pattern and builds each user swap address from the
  swap spending script payment credential plus the user's staking credential.
  The public protocol wording says the output must have a valid staking
  credential and owner actions require staking credential approval.
- Cardano-Swaps README public protocol description likewise says users get
  sovereign addresses using their own staking credentials, and owner
  create/update/close actions are restricted by staking credential approval.
- `src/intents/lib/common.gcscript.jsonc` builds the personal DApp address with `stakePubKeyHashHex`.
- `src/intents/lib/close.gcscript.jsonc` sets `requiredSigners` to `owner-stake-keyhash`.

Conclusion:

- Protocol-level support appears credential-generic: a valid staking credential
  can be key-based or script-based.
- Current NeonSoup GCScript support is key-stake-specific in places. That is an
  implementation gap, not proof that the protocol forbids script staking
  credentials.

Implementation plan:

- Use `getCurrentAddress` plus `getAddressInfo(get('cache.myAddress'))`.
- In the root GCScript macro, derive:
  - `stakingKeyHash` from `cache.myAddressInfo.stakingKeyHash`;
  - `stakingScriptHash` from `cache.myAddressInfo.stakingScriptHash`;
  - `walletStakeCredentialHash` as `join(stakingKeyHash,stakingScriptHash)`.
- Add an `assert()` before any transaction-building node to prove exactly one
  staking credential hash is present:
  - reject when both `stakingKeyHash` and `stakingScriptHash` are empty;
  - reject when both are non-empty;
  - continue only when exactly one is non-empty.
- The assertion should be explicit, for example:
  ```text
  assert(
    or(
      and(not(isEmptyString(stakingKeyHash)),isEmptyString(stakingScriptHash)),
      and(isEmptyString(stakingKeyHash),not(isEmptyString(stakingScriptHash)))
    ),
    'Wallet staking credential is ambiguous or unavailable'
  )
  ```
- Use the wallet-derived credential for all action types that need the user's
  staking credential: Open, Fill/Swap, and Close. Do not pass the user's stake
  credential through dapp args in Incognito Mode.
- For DApp address construction, plan to pass both wallet-side fields to
  GameChanger `buildAddress` where supported:
  - `stakePubKeyHashHex` receives `stakingKeyHash`;
  - `stakeScriptHashHex` receives `stakingScriptHash`;
  - because the assertion guarantees one side is empty, the wallet can select
    the valid credential without the dapp knowing which one it is.
- For `requiredSigners` or signer-like fields, use the wallet-derived
  `walletStakeCredentialHash` where the active wallet API accepts either a key
  hash or native-script based script hash.
- If GameChanger Wallet cannot accept both empty/non-empty address credential
  fields or cannot use a native-script based credential in a required signer
  path, halt and ask before falling back to key-only Incognito behavior.

## Configuration And Env Vars

Update `.env.example`, `src/common/config/appConfig.ts`, and DevTool mirrored config if still present.

Use one address env var per network, shared by all service fee types:

- `VITE_NEONSOUP_PREPROD_SERVICE_FEE_ADDRESS=`
- `VITE_NEONSOUP_MAINNET_SERVICE_FEE_ADDRESS=`

Use network-specific fee asset and quantity env vars:

- `VITE_NEONSOUP_PREPROD_BUNDLE_SWAP_SERVICE_FEE_POLICY_ID=ada`
- `VITE_NEONSOUP_PREPROD_BUNDLE_SWAP_SERVICE_FEE_ASSET_NAME=ada`
- `VITE_NEONSOUP_PREPROD_BUNDLE_SWAP_SERVICE_FEE_QUANTITY=1`
- `VITE_NEONSOUP_PREPROD_PARALLEL_SWAP_SERVICE_FEE_POLICY_ID=ada`
- `VITE_NEONSOUP_PREPROD_PARALLEL_SWAP_SERVICE_FEE_ASSET_NAME=ada`
- `VITE_NEONSOUP_PREPROD_PARALLEL_SWAP_SERVICE_FEE_QUANTITY=2`
- Matching `MAINNET_*` variables with empty or production-ready defaults.

Implementation notes:

- Store service fee config under `APP_CONFIG.networks[networkTag].serviceFees`.
- Keep fee quantities in display units in env, then normalize to base-unit strings with the configured asset decimals before composing GCScript.
- If the fee address is missing or fee quantity is empty/zero, treat the corresponding service fee as disabled.
- Preserve the same config source for Frontend and DevTool.

## Fee Composition

Update `src/core/gcscript/composer.ts` and related core types.

Add composer inputs:

- `serviceFees` resolved for the current network and execution mode.
- `privacyMode: 'connected' | 'incognito'`.

Bundle mode:

- Add one service-fee output per Swap action group in each bundled transaction.
- If one bundled transaction includes several fills belonging to the same Swap action, charge one bundled swap fee for that action group, not one fee per fill.
- If one bundled transaction includes multiple Swap actions, add one fee output per Swap action.

Parallel mode:

- Add the parallel swap service fee for Swap actions.
- Preserve the same semantic rule: one fee per Swap action group, not per individual fill UTxO.
- Verify whether current parallel grouping maps one Swap action to one transaction. If not, explicitly preserve "one fee per Swap action" and avoid accidental overcharging.

Fee output shape:

- Use the shared service-fee address.
- Add the configured asset as ADA coin or native token.
- Include `idPattern` compatible with the existing generated output ids, e.g. `{join('-', get('args.groups.N.group-id'), 'bundleSwapServiceFee')}` or equivalent stable pattern.
- Include a receipt/output role only if useful for internal reconciliation; never leak this in Incognito Mode returns.

## Metadata Message

Update `metadataMsgFor` / receipt args in `src/core/gcscript/composer.ts`.

For every transaction that includes a service-fee output, include:

- fee type: `bundle-swap-service-fee` or `parallel-swap-service-fee`;
- fee amount in display units;
- fee asset ticker or canonical asset id;
- keep metadata concise and non-sensitive.

Do not include user address, stake key hash, balances, or Incognito-private information in metadata.

## Incognito GCScript Flow

Connected mode:

- Keep current connected behavior and current richer execution receipt.
- The dapp may pass connected wallet address/stake credential as today.

Incognito mode:

- Trigger when no wallet address is connected in app state. Do not trigger or
  branch based on whether the dapp has a key-hash-looking stake value; the dapp
  must not decide whether the wallet staking credential is key-based or
  script-based.
- Root script must call:
  - `myAddress: { type: 'getCurrentAddress' }`
  - `myAddressInfo: { type: 'macro', run: "{getAddressInfo(get('cache.myAddress'))}" }`
- Root script must derive these wallet-side values before importing Open, Fill,
  or Close fragments:
  - `stakingKeyHash`: `{get('cache.myAddressInfo.stakingKeyHash')}`;
  - `stakingScriptHash`: `{get('cache.myAddressInfo.stakingScriptHash')}`;
  - `walletStakeCredentialHash`: `{join(get('cache.stakingKeyHash'),get('cache.stakingScriptHash'))}` or equivalent local cache paths.
- Assert with ISL before transaction construction:
  - address is Cardano/Shelley/base or otherwise compatible with the protocol;
  - exactly one of `stakingKeyHash` and `stakingScriptHash` is non-empty;
  - neither both-empty nor both-present states are allowed;
  - reject enterprise/reward/pointer/no-stake addresses for Open Offer because
    Cardano-Swaps requires a valid staking credential on the personal DApp
    address.
- Pass root-scoped values into imported intent args:
  - `offer-address` from `cache.myAddress`;
  - the wallet-derived `walletStakeCredentialHash` wherever the fragment needs
    the user's owner staking credential;
  - both raw wallet-side hash fields where the fragment/buildAddress needs to
    distinguish `stakePubKeyHashHex` from `stakeScriptHashHex`.
- Do not put these user-specific values in root `args`.
- Do not re-fetch address/stake data inside each item or group.

Reduced Incognito return payload:

```json
{
  "txs": [
    {
      "status": "...",
      "hasSubmitError": true,
      "hasContentionError": false
    }
  ]
}
```

Use `submitTxs` with `extras: true`, `noFail: true`, and `txsExtended` as today, but map only the allowed booleans/status into the exported payload.

Halt condition:

- If any current Frontend action needs a value that can only come from connected app state and cannot be safely obtained inside GCScript, stop and ask the user before implementing a workaround.

## Frontend UX

Update `src/frontend` only through shared/common helpers where appropriate.

Mode detection:

- Add a derived `isIncognitoMode = !state.wallet?.address`.
- Do not use missing `stakeKeyHash` as a frontend signal for Incognito Mode or
  credential type. Script-staked wallets may not provide a key hash, and the
  credential type must stay wallet-side.
- In Incognito Mode, allow action CTAs for Open Offer and Swap if form data is otherwise complete.
- Keep balance-based validation muted or rewritten because the dapp intentionally does not know the user's balance.

Navigation:

- In Incognito Mode, show Open Offer in nav items.

Alerts:

- All alerts currently saying `Connect a wallet before...` or `Connect a wallet to show...` must become `info` alerts.
- Use `/assets/cybernekos/incognito_half_A.png`.
- Copy must say NeonSoup is currently using Incognito Mode, where NeonSoup does not know the user's address or balance while still allowing wallet-side execution.

Connect button:

- Keep the yawn cyberneko asset for the tooltip.
- Replace the wallet icon with an Incognito Mode Bootstrap Icon.
- Tooltip must include bold `Incognito Mode` text and explain that connecting gives NeonSoup address/balance visibility, while remaining disconnected launches actions privately through GameChanger Wallet.

Open Offer and Swap tooltips/instructions:

- In Incognito Mode, clarify that the user must set values carefully because NeonSoup cannot validate against their wallet balance.
- Use warning text color inside tooltip/descriptive copy for this warning.
- Preserve existing friendly tooltip design and portal behavior.

Swap stats:

- Add a service-fee stat next to existing Swap stats.
- Show configured fee amount and asset for the current mode.
- Add a tooltip explaining this is a NeonSoup service fee, separate from Cardano network fees and route price/price impact.
- If fee is disabled, render `No service fee` or omit the stat consistently with existing stat design.

## Shared State And Types

Update shared/common types rather than shell-specific copies where possible:

- service fee config type;
- normalized fee amount type;
- composer privacy mode;
- reduced Incognito return type;
- wallet return parsing so Incognito payloads are accepted without producing developer-facing errors.

Ensure DevTool keeps working:

- DevTool can remain connected-first and may keep richer debug receipt behavior.
- If DevTool can trigger Incognito composition, make the behavior explicit; otherwise default it to connected mode.

## Native-Script Signer Transaction Options

Implementation details:

- Add the native-script signer/provisioning options to every final `buildTx`
  transaction, for every action type: Open, Fill/Swap, and Close.
- This is intentional even when a transaction uses a key credential. It keeps
  every generated transaction ready for native-script based required signatures
  without requiring the dapp to know the credential type.
- Required options:
  ```json
  {
    "autoProvision": {
      "workspaceNativeScript": true
    },
    "autoOptionalSigners": {
      "nativeScript": true
    }
  }
  ```
- Follow the existing option shape demonstrated in
  `src/intents/utils/deploy.gcscript.jsonc`.
- In bundled Cart execution, merge these options into every bundled
  transaction's `options` without dropping existing options such as
  `collateralCoinSelection`.
- In parallel execution, add the options to every built transaction.
- In single/direct transient Cart execution, add the options through the same
  shared composer path.
- Validate built strict JSON and at least one wallet build path for:
  - Open includes both native-script options;
  - Fill/Swap includes both native-script options;
  - Close includes both native-script options;
  - bundled transactions preserve the options after composition;
  - key-hash wallets still build normally with the options present.

## Tests And Verification

Run narrow checks first:

- Typecheck core/common/frontend.
- Validate generated GCScript JSON after building intents/composed examples if available.
- Add or update unit tests around:
  - display-unit to base-unit service fee conversion;
  - bundle fee count per Swap action group;
  - parallel fee count per Swap action group;
  - metadata fee message generation;
  - incognito receipt reduction;
  - connected receipt unchanged.
  - wallet-side staking credential derivation joins `stakingKeyHash` and
    `stakingScriptHash` only after asserting exactly one is present.
  - Incognito Open passes key/script stake fields wallet-side without exposing
    them through dapp args.
  - Open, Fill/Swap, and Close all add `autoProvision.workspaceNativeScript`
    and `autoOptionalSigners.nativeScript`.

Manual/browser checks:

- Frontend disconnected state shows Incognito alert copy and asset.
- Open Offer appears in nav in Incognito Mode.
- Swap stats show service fee and tooltip.
- Connected wallet behavior remains unchanged.
- Incognito launch does not include address/stake credential in generated args.
- Incognito wallet return does not store user-specific traces.

GCScript validation checks:

- Build/validate final strict JSON or runtime-composed GCScript snapshots.
- Inspect built JSON for:
  - exactly one root `getCurrentAddress` in Incognito Mode;
  - `getAddressInfo(get('cache.myAddress'))`;
  - exactly-one-stake-credential assertion before transaction construction;
  - `walletStakeCredentialHash` derived with `join(stakingKeyHash,stakingScriptHash)` or equivalent cache paths;
  - no address/stake in args;
  - service-fee output ids;
  - fee metadata message;
  - reduced final export payload.

## History Timeout Fix

Bug to address during implementation:

```text
Could not refresh History: NeonSoup_GetAddressTransactions failed: timed out after 30000ms
```

Known failing address:

```text
addr_test1qpcs5lstha2gnvufz9wpdaegsv4ulj7n22x5jsy603m7ym9dqwj2u3djrag0mene2cm9elu5mdqmcz9zc2rzgq7c5g6qmyrsv7
```

If the copied address differs from the actual wallet address, reproduce with the
exact address from app state before changing query logic.

Current likely cause:

- `src/common/services/providers/graphqlMk2Queries.ts` uses
  `NeonSoup_GetAddressTransactions` with an `_or` over `inputs.address` and
  `outputs.address`, ordered by `INCLUDED_AT_DESC`.
- The query asks only for hashes, but the provider still has to search input and
  output relations for the whole address history before the app can hydrate the
  returned hashes.
- On addresses with many transactions, this can time out before
  `historyFetchLimit` helps.

Fix plan:

- Reproduce the timeout against the configured MKII endpoint with the exact
  address, operation name, variables, and a small limit such as `10`.
- Inspect `extensions.explain.operations` for the address-history query shape
  if the endpoint can return plans.
- Replace the single expensive `_or` relation query with bounded,
  independently paginated queries:
  - recent transactions where the address appears in outputs;
  - recent transactions where the address appears in inputs;
  - merge/dedupe by tx hash client-side;
  - sort newest first;
  - cap the final result by the internal history limit.
- Prefer relation shapes or root entities that are indexed by address/UTxO
  identity if MKII exposes a faster address transaction table/view.
- Keep fetch caps internal. Do not expose this tuning in user Options.
- Add abort/retry behavior per page so a slow input-side scan does not discard
  already fetched output-side history.
- Show an info notice for partial History refreshes instead of replacing the
  whole view with a failure when one side times out.
- Keep chain-backed transaction hydration and protocol classification unchanged:
  after hashes are fetched, use the existing normalized transaction hydration
  path and do not infer action/price from metadata.
- Add regression coverage for dedupe, newest-first sorting, partial result
  handling, and low-limit bounded fetches.

## Documentation Updates

Update:

- `.env.example` with network-specific fee variables and comments.
- `README.md` or frontend docs if env setup is documented there.
- `docs/SWAP.md` with NeonSoup service fee behavior once implemented.
- Local `AGENTS.md` only if a new hard-won implementation rule emerges.

## Proposed Execution Order

1. Add service fee config types and `APP_CONFIG` env parsing.
2. Add service fee normalization helpers and tests.
3. Extend composer inputs for service fees and privacy mode without changing behavior.
4. Add fee output generation, idPattern, metadata message, and receipt mapping.
5. Add Incognito root wallet-data derivation and reduced return payload.
6. Wire frontend mode detection, alert copy/assets, nav behavior, tooltips, and Swap fee stat.
7. Build/validate GCScript artifacts and run typechecks.
8. Update docs after behavior is verified.
