# NeonSoup Devtool

This is the experimental NeonSoup developer tool dapp. It is used to test the
P2P DeFi Kernel order book, GameChanger Wallet GCScript intents, asset metadata,
wallet return handling, and protocol UX. It is not the production NeonSoup DEX
frontend.

## Commands

```text
pnpm install
pnpm build
pnpm serve
pnpm exec tsc -p ./src/devtool/tsconfig.json
```

The build writes the Vite app to `dist/` and keeps built protocol intents under
`dist/intents/`. Vite inlines `VITE_*` environment variables into
`dist/assets/`; do not commit built assets produced with private provider URLs or
API tokens.

## Environment

Copy the repo root `.env.example` to `.env` for local development.

Supported variables:

```text
VITE_NEONSOUP_PREPROD_BLOCKFROST_URL=
VITE_NEONSOUP_PREPROD_BLOCKFROST_KEY=
VITE_NEONSOUP_MAINNET_BLOCKFROST_URL=
VITE_NEONSOUP_MAINNET_BLOCKFROST_KEY=
VITE_NEONSOUP_PREPROD_GRAPHQL_MK2_URL=
VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_URL=
VITE_NEONSOUP_BUILD_TAG=
```

The Options view can still override provider URL/API key at runtime in browser
localStorage. Source defaults should stay secret-free.

The persisted app-state version uses SemVer build metadata:
`package.json` version + `VITE_NEONSOUP_BUILD_TAG` (for example
`0.0.1+20260604010551`). When that string
changes, the app shows an update banner and stops persisting old state until the
user replaces incompatible local state with current defaults.

## Structure

- `src/config/`: app, network, and trusted asset defaults
- `src/state/`: serializable reducer/context app state
- `src/services/`: wallet, intent loading, storage, and network providers
- `src/domain/`: Cardano, asset, text, and quantity helpers
- `src/components/`: Bootstrap 5 UI components

The app is intentionally pair-driven and context-aware: actions from tables
should navigate to Trade and prefill the selected pair/action. Keep forms
warning-based rather than hard-blocking invalid values; this is a protocol
debugging tool.

## Views

- `Trade`: pair selector, Open/Fill/Close forms, generated action state, and pair
  offers.
- `Orders`: open offer table with Fill/Close actions.
- `Activity`: protocol UTxO activity and wallet-return transactions, with
  current-network Cardanoscan links.
- `User`: portfolio, user's open offers, and protocol transaction history.
- `Options`: network/provider settings, UI flags, and custom asset definitions.
- `Developer`: protocol intent links, generated intent preview, captured wallet
  return data, intent bundle, and app state.

## UI And Data Rules

- The Asset Pair selector is the first step for protocol work and should remain
  prominent.
- Use Bootstrap alert tones correctly: `danger` for errors, `warning` for risky
  invalid-but-allowed input, `success` for completed actions, and `info` for
  neutral status.
- Inputs should warn rather than block when values exceed balances/offers.
- UTxO copy buttons must copy `<txHash>#<index>`.
- Asset metadata priority is: user overrides, app defaults, fetched metadata,
  then safe fallback identifiers.
- Fetched token metadata is untrusted. Keep strings truncated and only render
  safe icon formats.
- Configured assets and user overrides are keyed by canonical
  `policyId.assetNameHex` strings. ADA is `ada.ada`; native assets with an empty
  asset name use `policyId.`. Do not use friendly aliases as dataset keys.
- Use `assetId` for provider/GC asset identifiers such as `lovelace` or
  `policyId + assetNameHex`.
- Do not add one-off migrations for old localStorage fields. Change the app
  version/build tag and rely on the centralized update banner for incompatible
  state shapes.

## Future Work Notes

- Cardano GraphQL MKII is scaffolded as a provider option and is expected to
  become the default network provider later; Blockfrost remains the current
  working provider.
- State is shaped for future intent composability. The current UI edits one
  selected action at a time, but intent bundles should remain first-class so
  future multi-fill swaps and bulk order creation can compose several protocol
  intents.
