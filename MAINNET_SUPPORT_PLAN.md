# NeonSoup Mainnet Support Plan

Checked: 2026-07-16

This plan covers full mainnet enablement for the user-facing Frontend and keeps
the DevTool consistent. It treats protocol contract selection, mainnet provider
viability, wallet network enforcement, and public-alpha UX as release gates,
not optional follow-ups.

## Current Findings

- `src/common/config/appConfig.ts` and the DevTool config now expose mainnet
  through centralized `defaults.options.availableNetworks: ['preprod',
  'mainnet']`. `preprod` remains the default network.
- `walletUrlForCode` in `src/common/services/gcWallet.ts` already passes
  `state.options.network` into GameChanger UDC URL encoding, so wallet launch
  is network-tagged today. Every supported network still needs root GCScript
  `require` gates on every launched wallet script, including wallet connection,
  so wallet execution refuses the wrong network before any transaction
  build/sign/submit node or public-data return flow runs.
- `src/common/config/assets.ts` and the DevTool asset copy now keep the active
  mainnet allowlist conservative and verified: ADA, USDM, USDCx, NIGHT, HOSKY,
  GMBL, DIS, MIN, and SNEK. Unverified placeholder-like mainnet assets were not
  kept active.
- NeonSoup currently uses one-way beacon policy
  `c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209` and spending
  validator `1d6cff26bcab91d2061aad0bd259cbb7d76d25ced2eeaed5926a42ad` in
  `src/intents/lib/common.gcscript.jsonc` and `src/common/config/appConfig.ts`.
- The private mainnet MKII endpoint provided by the user is now usable without
  the earlier `NotInWhitelistError`. Manifest returned `networkTag: "mainnet"`
  and `cardano_graphql_mk2` version `0.4.1`; a tip query returned epoch `643`
  and tip block `13683456`. Do not commit the private endpoint URL; keep it in
  the user's private `.env`.
- The exact current `NeonSoup_GetOpenOfferCandidates` query returned live
  mainnet UTxOs for the current NeonSoup beacon policy
  `c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209`. One observed
  row was `0c8dda544ab8bfadfe497dde646654292d573c33e67a05c9deefd84dcf6c4b0e#0`
  with an inline datum and the current NeonSoup beacon tokens. This is direct
  evidence that the current NeonSoup validator set has mainnet liquidity to test
  against.
- The same open-offer query against the upstream audited protocol v1 one-way
  beacon `47cec2a1404ed91fc31124f29db15dc1aae77e0617868bcef351b8fd` returned
  an empty first page on this endpoint. For the first Public Alpha mainnet
  enablement, use the current NeonSoup validator set, not upstream v1, because
  it is more likely to expose testable on-chain liquidity.
- `fallen-icarus/cardano-swaps` PR #27, merged 2026-07-09, released a newer
  P2P Kernel validator set built for Plutus V3. Current `VERSIONS.md` lists
  protocol v2 Plutus V3 one-way beacon
  `4557249e92a42c371f494c32fcfbb31648ef14c4fb69056e56269af3` and spending
  validator `ef69e7b2174184c1a1e140f255af81bb6a8daf7d3796563ec7bdeccb`.
  The PR diff shows NeonSoup's current hashes were the prior protocol v2
  Plutus V2 hashes. The old validators are still operational and are the
  immediate mainnet alpha target; the Plutus V3 set is a migration path.
- `fallen-icarus/p2p-wallet` was inspected in `/tmp/p2p-wallet`. It imports the
  `cardano-swaps` package and performs pair-scoped one-way and two-way book
  queries. NeonSoup should move toward pair-scoped discovery for scale even
  though the current broad candidate query works.
- Mainnet `NeonSoup_GetAssetsById`/MKII `tokenAssets` and Koios `asset_info`
  checks returned registry/provider metadata for MIN, NIGHT, SNEK, HOSKY,
  GMBL, and DIS. A later live mainnet order-book probe exposed verified USDM
  metadata for policy
  `c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad` asset
  `0014df105553444d`, and a targeted MKII ticker lookup returned USDCx policy
  `1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e34` asset
  `5553444378`. Those are the active stablecoin entries.
- The current open-offer query works, but the response can be large because it
  fetches nested token asset metadata including `logo`. For mainnet scale,
  order-book discovery should avoid embedding large metadata fields and should
  cache or fetch asset metadata separately.

## Release Gate Summary

Mainnet is not ready to enable in production until all of these are true:

1. Mainnet contract hashes are selected, verified, and configured per network.
2. Mainnet MKII calls for assets, order books, and transactions return bounded
   data or empty result sets from the selected endpoint.
3. Approved mainnet assets are verified and trimmed to real stablecoins and
   important liquid assets only.
4. Mainnet order books for enabled asset combinations can be fetched in
   bounded, selected-pair-scoped queries and quote performance is acceptable.
5. GameChanger Wallet root scripts enforce selected network on every supported
   network and enforce connected address/stake credential when not in Incognito
   Mode.
6. Frontend and DevTool both expose consistent network support, but only the
   user Frontend shows the Public Alpha disclaimer flow on first load as a welcome modal.

## Phase 1: Network And Contract Configuration

- Replace the single global `APP_CONFIG.beaconPolicy` usage with per-network
  protocol deployment config:
  - `oneWay.beaconPolicy`
  - `oneWay.spendingValidator`
  - `oneWay.referenceInputs.beaconPolicy`
  - `oneWay.referenceInputs.spendingValidator`
  - `protocolVersion`
  - `plutusVersion`
  - `auditStatus`
  - `deploymentStatus`
- Keep preprod values as the existing NeonSoup deployment.
- For the first mainnet Public Alpha, configure mainnet to use the current
  NeonSoup validator set because live mainnet UTxOs were observed for it:
  - one-way beacon policy:
    `c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209`
  - one-way spending validator:
    `1d6cff26bcab91d2061aad0bd259cbb7d76d25ced2eeaed5926a42ad`
  - Plutus version: V2
  - status: operational old protocol v2 set, Public Alpha target
- Keep the upstream audited protocol v1 and newer protocol v2 Plutus V3 hashes
  in documentation or a `knownProtocolDeployments` map, but do not make them the
  active alpha target unless liquidity and wallet compatibility are rechecked:
  - upstream audited v1 one-way beacon:
    `47cec2a1404ed91fc31124f29db15dc1aae77e0617868bcef351b8fd`
  - upstream audited v1 one-way spending validator:
    `01fa36465dfe36e26c21fdbf720e4bdafcc0b86bb5367fca46012f56`
  - new Plutus V3 v2 one-way beacon:
    `4557249e92a42c371f494c32fcfbb31648ef14c4fb69056e56269af3`
  - new Plutus V3 v2 one-way spending validator:
    `ef69e7b2174184c1a1e140f255af81bb6a8daf7d3796563ec7bdeccb`
- Update `src/intents/lib/common.gcscript.jsonc` so curated deployment
  constants are selected by wallet/network tags using the multi-network
  GCScript pattern, but do not pass deployment constants through dapp args.
  The wrapper/root script should call `getNetworkInfo` once, derive
  `networkKey = join('-', dltTag, networkTag)`, and pass only `dltTag` and
  `networkTag` through args to nested reusable fragments. The constants
  themselves should live in GCScript `data` or `macro` constant definitions
  keyed by values such as `cardano-preprod` and `cardano-mainnet`.
- The common fragment should expose a selected deployment object with the same
  shape for every supported network, for example:

```jsonc
{
  "deploymentConstants": {
    "type": "macro",
    "run": {
      "cardano-preprod": {
        "oneWay": {
          "beaconPolicy": "<preprod-beacon-policy>",
          "spendingValidator": "<preprod-spending-validator>",
          "referenceInputs": {
            "beaconPolicy": { "txHash": "<tx>", "index": 0 },
            "spendingValidator": { "txHash": "<tx>", "index": 1 }
          },
          "lang": "plutus_v2"
        }
      },
      "cardano-mainnet": {
        "oneWay": {
          "beaconPolicy": "c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209",
          "spendingValidator": "1d6cff26bcab91d2061aad0bd259cbb7d76d25ced2eeaed5926a42ad",
          "referenceInputs": {
            "beaconPolicy": { "txHash": "<mainnet-ref-tx>", "index": 0 },
            "spendingValidator": { "txHash": "<mainnet-ref-tx>", "index": 1 }
          },
          "lang": "plutus_v2"
        }
      }
    }
  },
  "networkKey": {
    "type": "macro",
    "run": "{ join('-',get('args.dltTag'),get('args.networkTag')) }"
  },
  "selectedDeployment": {
    "type": "macro",
    "run": "{ get(join('.','cache.deploymentConstants',get('cache.networkKey'))) }"
  }
}
```

- Add an early assertion that `selectedDeployment` exists for the wallet's
  `dltTag/networkTag`; unsupported wallet networks must fail before any datum,
  redeemer, reference-input, mint, or `buildTx` logic runs.
- Preserve source intent argument compatibility by adding safe defaults at
  every wrapper/composer entry. Do not move curated deployment values into
  user-controlled args.
- Rebuild generated `dist/intents/*.gcscript.json` after changing any intent
  source.

Acceptance:

- DevTool and Frontend both classify protocol outputs by the active network's
  beacon policy.
- Open, Fill/Swap, Close, Cart, and wallet connection GCScript generated for
  every supported network uses the selected deployment constants for that
  network.
- Preprod keeps current behavior; mainnet uses the selected current NeonSoup
  mainnet alpha hashes.
- The Plutus V3 validator set is documented as a future migration, not mixed
  into the alpha execution path.

## Phase 2: Mainnet MKII Provider Verification

- Configure `VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_URL` only in the user's private
  `.env`. Do not commit the private endpoint URL to `.env.example`, source, or
  docs.
- Keep runtime values in variables. Do not interpolate UI-selected assets,
  offsets, hashes, or order options into query text.
- Keep all root list requests bounded with `range`, `limit`, and `offset`.
- Apply provider query optimizations to every enabled network, not only
  mainnet. Preprod and future networks should use the same bounded pagination,
  metadata splitting, cache keys, and normalized response contracts.
- Record these live checks as the current baseline:
  - manifest check returned `networkTag: mainnet`
  - tip query returned epoch `643`, block `13683456`
  - `NeonSoup_GetOpenOfferCandidates` returned live rows for the selected
    current NeonSoup beacon policy
  - the same query against upstream v1 returned an empty bounded result set
  - sample asset metadata lookup returned MIN, NIGHT, SNEK, HOSKY, GMBL, and
    DIS, but not the sampled USDM or USDCx ids
- Rerun these bounded checks after implementation for every enabled network in
  `availableNetworks`:
  - approved asset metadata lookup for ADA equivalents, USDM, DJED, USDCx, and
    each enabled liquid asset
  - open offer candidate fetch for the selected network's one-way beacon policy
  - selected-pair order book fetches for representative enabled asset
    combinations in both directions
  - transaction-by-hash lookup for at least one known NeonSoup/Cardano-Swaps
    transaction on that network when a known hash is available
- Inspect `extensions.explain.operations` for order-book queries. Confirm the
  SQL uses bounded ranges and relation filters over `TokenInOutput` and `Datum`
  as expected.

Acceptance:

- Mainnet provider calls return data or empty bounded result sets, not
  `NotInWhitelistError`.
- Empty order books are handled as normal no-liquidity states.
- Any timeout, very large response, or high-latency query has a concrete
  narrowed query replacement before mainnet is enabled, and the same query
  contract remains valid for every enabled network.

## Phase 3: Approved Mainnet Assets And Open Pair Discovery

- Keep the existing asset definition format and canonical map keys:
  `Record<string, AssetMetadata>` keyed by `policyId.assetNameHex`, with ADA as
  `ada.ada`. Do not disrupt DevTool, persisted app state, provider
  normalization, or existing asset selectors.
- Add only an optional asset classification field if needed, such as
  `tag?: 'coin' | 'stablecoin' | 'mainstream' | 'community' | 'experimental'`.
  Existing consumers must work when the tag is absent.
- Classify `MAINNET_ASSETS` through that optional tag:
  - `coin`: ADA
  - `stablecoin`: official USDM and USDCx only after project-owned or
    registry-backed identity evidence is found; DJED/USDA/iUSD only if still
    active, liquid, and independently verified
  - `mainstream`: MIN, SNEK, NIGHT, and other high-liquidity assets after
    verification
  - `community`: HOSKY, GMBL, DIS, and other user-requested/community assets
    after registry/provider confirmation
  - `experimental`: hidden from user Frontend by default but visible in DevTool
    for testing
- Verify every enabled mainnet asset by canonical key
  `policyId.assetNameHex`; do not trust ticker labels alone.
- Use this initial mainnet asset target table. `assetId` is
  `policyId + assetNameHex`; app map keys stay `policyId.assetNameHex`.

| Category | Ticker | Policy id | Asset name hex | Decimals | Verification state |
| --- | --- | --- | --- | --- | --- |
| coin | ADA | `ada` | `ada` | 6 | Cardano native coin |
| mainstream | MIN | `29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6` | `4d494e` | 6 | Koios token registry metadata: `Minswap`, URL `https://minswap.org/`, fingerprint `asset1d9v7aptfvpx7we2la8f25kwprkj2ma5rp6uwzv` |
| mainstream | NIGHT | `0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa` | `4e49474854` | 6 | Koios token registry metadata: `NIGHT`, URL `https://midnight.network` |
| mainstream | SNEK | `279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f` | `534e454b` | 0 | MKII and Koios token registry metadata: `Snek`, URL `https://www.snek.com/`, fingerprint `asset108xu02ckwrfc8qs9d97mgyh4kn8gdu9w8f5sxk` |
| community | HOSKY | `a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235` | `484f534b59` | 0 | MKII and Koios token registry metadata: `HOSKY Token`, URL `https://hosky.io`, fingerprint `asset17q7r59zlc3dgw0venc80pdv566q6yguw03f0d9` |
| community | GMBL | `2b0a04a7b60132b1805b296c7fcb3b217ff14413991bf76f72663c30` | `67696d62616c` | 6 | MKII and Koios token registry metadata: `gimbal`, URL `https://gimbalabs.com/gimbal-token`, fingerprint `asset1seuf4pwhwdxqtrsz4axfwtrp94gkdlhcyat9nn` |
| community | DIS | `5612bee388219c1b76fd527ed0fa5aa1d28652838bcab4ee4ee63197` | `446973636f696e` | 8 | MKII and Koios token registry metadata: `discoin`, ticker `DIS`, fingerprint `asset16wnanv4xfv3cvz02yjeaqza5eae48dhj5lmxvu`; project URL metadata is malformed as `https://discoin/`, so keep Frontend enablement conservative |
| stablecoin | USDM | pending | pending | 6 expected | Do not use current sampled candidate until official Mehen/project-owned source or token registry/chain-index metadata confirms policy id, asset name hex, decimals, and fingerprint |
| stablecoin | USDCx | pending | pending | 6 expected | Do not use current sampled candidate until official bridge/project-owned source or token registry/chain-index metadata confirms policy id, asset name hex, decimals, and fingerprint |

- Correct current source asset rows before enabling mainnet:
  - `src/common/config/assets.ts` and `src/devtool/src/config/assets.ts`
    currently list a different HOSKY policy, GMBL asset name, and DIS
    policy/name than the verified table above. Replace those rows only after
    the app-level mainnet gate is ready.
  - The current USDM and USDCx candidates must remain disabled or pending until
    official source evidence is found; do not show them in the user Frontend
    based on ticker or friendly label. Use a service like taptools or cardanoscan to check for missing data but still verify.
- Remove or hide placeholder-looking policies until verified.
- Do not add a pair-policy allowlist for the user Frontend. Let users attempt
  arbitrary combinations from the verified enabled asset list so the UI can
  expose missing-liquidity states and help foster new liquidity.
- Keep no-liquidity, insufficient-depth, and stale-book states clear and
  user-facing. Pair availability should be learned from bounded provider
  discovery, not from a static frontend pair list.
- Keep DevTool broader but label unverified assets clearly and keep warnings
  non-blocking there.

Acceptance:

- User Frontend only shows verified approved assets, but does not statically
  block combinations between those assets.
- DevTool can test additional assets without weakening Frontend allowlist
  safety.
- Asset metadata fetches do not leak raw provider shapes into React components.

## Phase 4: Order-Book Scale And Routing Viability

- Replace protocol-wide open-offer scans with pair-scoped discovery wherever
  possible:
  - compute one-way pair beacon for selected offer/ask direction
  - query by active network beacon policy plus pair beacon asset name
  - paginate with deterministic `limit`, `offset`, `range`, and canonical
    `txHash#index` deduplication
- Keep raw canonical book, executable policy book, and route layers separate.
- Remove large nested asset metadata fields such as `asset.logo` from open-book
  discovery responses. Fetch metadata separately through cached asset metadata
  lookups.
- Measure mainnet pair fetch size and latency for representative enabled asset
  combinations, especially ADA/stablecoin, ADA/mainstream, and
  community/mainstream routes.
- If current MKII cannot efficiently filter by pair beacon, add a provider
  TODO/blocker for a price-aware or pair-scoped view before enabling broad
  mainnet markets.
- Confirm quote performance on large books:
  - no UI lockups on mobile
  - no unbounded root list requests
  - route computation remains BigInt-based
  - booked Cart source UTxOs are excluded before quote math

Acceptance:

- Fetching a selected enabled asset combination does not require scanning the
  entire mainnet Cardano-Swaps protocol book.
- Swap, Markets, My Orders, and History remain responsive on mobile and desktop.

## Phase 5: Wallet Network, Address, And Stake Enforcement

- Keep UDC URL encoding with `network: state.options.network`; this already
  exists in `src/common/services/gcWallet.ts`.
- Add GCScript root `require` on every launched wallet-facing GCScript for
  every supported network, not only mainnet:
  - runtime cart composer in `src/core/gcscript/composer.ts`
  - top-level `src/intents/open.gcscript.jsonc`
  - top-level `src/intents/swap.gcscript.jsonc`
  - top-level `src/intents/close.gcscript.jsonc`
  - top-level `src/intents/cart.gcscript.jsonc`
  - wallet connection/public-data intent
  - any future launched wrapper or generated script that can reach the wallet
    directly
- Implement these as root-level GCScript `require` arguments on the launched
  `type: "script"` objects. Do not rely only on later `run` macros for the
  hard network/address/stake gates, because the goal is to halt before any
  wallet-visible public-data return or transaction construction path proceeds.
- Treat wallet connection as a supported launched GCScript, not as an exception.
  Its root `require` must enforce the selected network before returning wallet
  public data to the dapp.
- Requirements to enforce:
  - wallet `dltTag` equals the dapp-selected DLT tag
  - wallet `networkTag` equals the dapp-selected network tag
  - the selected `dltTag/networkTag` key exists in the curated deployment
    constants map when the script uses protocol constants
  - when not in Incognito Mode, wallet current address equals the connected app
    wallet address
  - when not in Incognito Mode, wallet stake key hash equals the connected app
    stake key hash
- In Incognito Mode:
  - still require selected network
  - fetch current address/stake credential wallet-side once at root
  - do not require equality against app-known wallet fields because no connected
    wallet is intentionally retained
- Keep `getCurrentAddress` and any stake/address info read root-scoped and pass
  values into imported fragments. Do not re-fetch per item or wrap imports in
  extra cache isolation.
- Fetch `getNetworkInfo` once at the root/wrapper, derive `dltTag` and
  `networkTag`, assert they match app-selected values, and pass those tags to
  nested fragments through args. Do not pass selected deployment constants
  through args.
- Do not add weird  human-readable failure messages for DLT/network/address/stake
  mismatch, this is handled by the wallet when using 'require' feature.
- Validate built strict JSON, not just JSONC sources.

Acceptance:

- Launching any supported-network intent from a wallet context on a different
  DLT or network fails before public-data return or `buildTx`.
- Launching a connected-wallet intent from a different address/stake credential
  fails before buildTx.
- Wallet connection returns no connected state when the wallet network does not
  match the dapp-selected network.
- Incognito wallet launches still work without persisting activity traces.

## Phase 6: Public Alpha Frontend UX

- Add a Frontend-only mainnet Public Alpha disclaimer modal.
- Modal requirements:
  - show `/assets/cybernekos/goggles-cleaning_Y.png` at the top center,
    overflowing the modal border
  - explain NeonSoup is currently `Public Alpha`
  - explain it is open source and intended to gather early feedback, especially
    feedback from the Gimbalabs Hackathon Piece Of Pie
  - explain it may be unstable
  - explain NeonSoup is not responsible for early testing
  - explain the software is offered as-is and users must understand this
  - explain deployments may go offline without notice during early development
  - require explicit acknowledgement before mainnet actions are enabled
- Persist acknowledgement per app version and network, not globally forever.
- Show the modal when switching to mainnet and before first mainnet wallet
  launch if acknowledgement is missing.
- Keep DevTool consistent on network support but do not block developer testing
  behind the user-facing disclaimer. Use a DevTool warning instead.

Acceptance:

- A user cannot run a mainnet Frontend action until acknowledging the Public
  Alpha disclaimer.
- The disclaimer is readable in dark and light themes and centered in viewport
  on mobile and desktop.

## Phase 7: Alert Truncation And Full-Text Modal

- Create a reusable alert component in `src/common` if both shells can consume
  it cleanly; otherwise implement Frontend first and adapt DevTool `FormAlert`
  with the same behavior.
- On medium/small/mobile screens, alert body text must clamp:
  - one line for compact/topbar/toast-like alerts
  - two lines for page/form alerts
  - trailing ellipsis via CSS line clamp
- Show a small `more` button only when text is likely long or measured as
  clamped.
- Clicking `more` opens a viewport-centered modal with:
  - `/assets/cybernekos/goggles-cleaning_Y.png` top center, overflowing border
  - full alert text
  - close button
  - scrollbars only on the text body when long
- Do not use native `title`; keep behavior keyboard accessible.
- Verify mobile widths and document overflow with rendered dimensions.

Acceptance:

- Long alerts no longer push mobile layouts or overlap adjacent controls.
- Full text is available through the modal.
- Modal content scrolls internally without body/page overflow.

## Phase 8: Frontend And DevTool Consistency

- Centralize network enablement and listing on
  `APP_CONFIG.defaults.options.availableNetworks`. This list is the single
  source of truth for which networks DevTool, Frontend, provider setup, asset
  selectors, disclaimer logic, and wallet launch paths may expose.
- `availableNetworks: ['preprod', 'mainnet']` is now enabled after implementing
  the core gates in phases 1-5.
- Default remains `preprod`.
- Do not add separate shell-local network allowlists, duplicated nav lists, or
  one-off mainnet flags. Any future network must be added through the same
  `availableNetworks` path plus matching provider, asset, deployment, and
  GCScript support.
- Ensure both shells use shared network/provider state from `src/common`.
- Ensure both shells consume the same active network contract config and asset
  metadata.
- Update `.env.example`:
  - set `VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_URL` to a dummy example, not to
    any private/internal endpoint. These endpoints are reserved for
    online/internal deployment, not for third-party developers. Do not leak them
    anywhere in the repo; they belong only in the user's private `.env` file.
  - keep secret keys blank
  - document mainnet service fee env variables if used
- Keep Frontend hiding internal provider/debug knobs unless explicitly
  requested; DevTool may expose them.

Acceptance:

- Switching networks resets or isolates provider snapshots, cart routing state,
  wallet history, and open-book caches.
- No preprod UTxO, datum, reference script, or unintended beacon policy is used
  after switching to mainnet.

## Verification Commands

Run after implementation:

```txt
pnpm exec tsc -p ./src/frontend/tsconfig.json
pnpm exec tsc -p ./src/devtool/tsconfig.json
pnpm run build:frontend
pnpm run build
pnpm exec gamechanger-cli validate -f ./dist/intents/open.gcscript.json -o /tmp/neonsoup-open-validate.json
pnpm exec gamechanger-cli validate -f ./dist/intents/swap.gcscript.json -o /tmp/neonsoup-swap-validate.json
pnpm exec gamechanger-cli validate -f ./dist/intents/close.gcscript.json -o /tmp/neonsoup-close-validate.json
```

Live provider checks:

```txt
curl -sS "$VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_MANIFEST_URL"
Mainnet tip query against the private VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_URL
NeonSoup_GetAssetsById/tokenAssets for approved mainnet assets
NeonSoup_GetOpenOfferCandidates for current NeonSoup mainnet one-way beacon policy
Selected-pair open-book fetches for representative enabled asset combinations
Confirmed transaction lookup for known mainnet NeonSoup/Cardano-Swaps transaction hashes
Repeat equivalent bounded provider checks for every network in availableNetworks
```

Browser checks:

```txt
pnpm run dev:frontend
Desktop and mobile screenshots for:
- mainnet disclaimer modal
- long alert clamp and more modal
- network switch
- swap quote no-liquidity state
- wallet launch blocked before disclaimer acknowledgement
```

## Do Not Ship Mainnet If

- Mainnet MKII stops accepting required NeonSoup operations or returns
  unbounded/slow responses for required order-book paths.
- Mainnet contracts are not explicitly selected per network.
- Stablecoin policy ids, asset name hex values, decimals, or issuer authenticity
  are unverified.
- Order-book queries require broad protocol-wide scans for selected enabled
  asset combinations.
- Wallet root scripts do not enforce selected DLT/network on every supported
  network and every launched GCScript, including wallet connection.
- Wallet root scripts do not enforce connected address/stake credential outside
  Incognito Mode.
- Any network is exposed outside the centralized `availableNetworks` list.
- Public Alpha acknowledgement is missing from the user Frontend.
