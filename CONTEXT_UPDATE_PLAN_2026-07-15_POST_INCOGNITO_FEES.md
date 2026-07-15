# Context Update Plan

## General Guidance
- This is a plan only; do not execute these updates until the user explicitly asks in a later request.
- Source boundary: preserve durable lessons since `3fa579b docs: context files updated`, especially commits through `2663197 feat(frontend): add incognito execution, service fee UX and other improvements`.
- Preserve important info by moving/generalizing/specifying, never deleting.
- Avoid references to temporary plan files after extraction.
- Do not add items outside this plan while executing; avoid cross-contaminating generic skills with NeonSoup-only product details.
- Keep updates concise. Discard low-value styling minutiae already covered by existing context.

## Tasks
- Scan existing context first and skip duplicates, especially already-covered route-bar/booked-UTxO/cart collision lessons.
- Preserve the causal lessons from the latest work: privacy-first Incognito Mode, wallet-side credential discovery, service fee outputs, user-facing slippage blocking, and MKII bounded history fetching.
- Run a final contamination scan for misplaced app-specific text in generic skills and generic wallet/protocol rules trapped only in local `AGENTS.md`.

## `/home/zxpectre/.codex/skills/web-app/SKILL.md`
- Skip: NeonSoup-specific asset names, Cart Mode behavior, and protocol slippage terminology; those belong in local/project or protocol context.

## `/home/zxpectre/.codex/skills/gamechanger-wallet-gcscript/SKILL.md`
- Add/update: For privacy-preserving dapp flows, wallet scripts can gather user address/stake credentials wallet-side and return a reduced, user-agnostic execution payload when the dapp is not connected.
- Add/update: When the dapp cannot know whether a credential is key-hash or script-hash, resolve it wallet-side and assert exactly one expected credential source is present.
- Add/update: Use `autoProvision.workspaceNativeScript: true` and `autoOptionalSigners.nativeScript: true` always unless asked otherwise as generated transaction flows may require native-script signers, specially when user is a multisig/remote-controlled wallet.
- Add/update: Service-fee and other special outputs should be data-driven from args/config and use clear `idPattern` labels that identify the fee type without hardcoding execution-specific values.
- Add/update: For privacy-sensitive wallet/dapp work, prefer user-agnostic or reduced wallet returns when possible, and avoid retaining local traces after incognito/private execution.
- Skip: NeonSoup fee amounts and UI copy; those belong in local `AGENTS.md` or repo docs.

## `/home/zxpectre/.codex/skills/cardano-p2p-defi-kernel/SKILL.md`
- Add/update: Protocol integrations should distinguish service fees from trading/protocol fees and keep fee asset/quantity/address configurable per network.

- Skip: Frontend-specific toast, modal, and CyberNeko asset guidance.

## `/home/zxpectre/.codex/skills/cardano-graphql-mkii/SKILL.md`
- Add/update: For wallet history views, prefer bounded address-transaction queries and pagination/limits over broad transaction-by-hash refreshes that can timeout or overfetch.
- Add/update: Treat MKII timeout errors as query-shape/load issues to narrow and bound before changing app semantics; avoid assuming chain absence.
- Add/update: Keep address-history fetching separated from current-pair filtering when the product needs all recognized activity for a wallet.
- Skip: NeonSoup row labels and frontend table layout details.

## `AGENTS.md`
- Add/update under User Frontend Notes: Incognito Mode allows Swap/Open without a connected wallet when wallet-side GCScript can request the missing address data; user copy must state balances are unknown and values are user responsibility.
- Add/update under User Frontend Notes: Incognito execution must not persist user activity traces; after wallet launch/return, clear cart items or avoid adding direct actions to cart when no wallet is connected.
- Add/update under Swap Design/Frontend Notes: Frontend slippage policy is config-driven: warning at `tolerance * warningSlippageMultiplier`, danger/blocking at `tolerance`, zero tolerance blocks, and tolerances at or above max tolerance block.
- Add/update under Architecture/Config: Dapp behavioral defaults, thresholds, factors, fee config, toast timeout, network defaults, and mode defaults belong in `APP_CONFIG`.
- Add/update under Wallet/GCScript Notes: Service fee outputs are network-specific and reusable-data-driven; metadata may mention fee type/amount but wallet execution must rely on transaction body outputs.
- Add/update under History/Provider Notes: History refresh should use bounded MKII address transactions for all recognized wallet activity, not only the currently selected pair, and avoid unbounded overfetch that can trigger 30s timeouts.
- Add/update under Common Pitfalls: Do not use developer-facing “above warning threshold” logic to disable CTAs unless it is truly at/over the user max; do not leave old extreme-multiplier severity rules in the frontend.
- Avoid adding: exact temporary plan filenames, one-off screenshot symptoms, and low-level CSS asset choices already covered by design-system guidance.

- Add/update: User-facing financial UIs should separate warning thresholds from hard blocking thresholds. When a user-configured max tolerance is exceeded, use danger styling, a blocking alert, and disabled CTA.
- Add/update: Privacy/incognito UX should explain reduced app knowledge clearly, avoid retaining user-specific traces after execution, and avoid showing balance-dependent claims when no wallet is connected.
- Add/update: Toast durations and user-facing validation thresholds should be centralized in app config, not scattered in component code.

- Add/update: Order-book route “slippage” in user UIs is a price-impact tolerance over selected live offers; exceeding the user max is a hard UX stop, while an earlier warning band can be a softer pre-threshold indicator.
- Add/update: Incognito/user-agnostic execution must still preserve protocol correctness: wallet-side address/stake credential discovery is required for fill/open/close where datum/redeemer/signature logic needs it.

- Add/update: For privacy-sensitive wallet/dapp work, prefer user-agnostic or reduced wallet returns when possible, and avoid retaining local traces after incognito/private execution.

## `/home/zxpectre/.codex/AGENTS.md`

- Add/update: Configurable behavioral thresholds, timeouts and other parameters should have one central source of truth in all apps.
- Keep generic only; do not mention NeonSoup-specific files, fee values, or assets.

## Proposed Execution Order
1. `/home/zxpectre/.codex/skills/gamechanger-wallet-gcscript/SKILL.md`
2. `/home/zxpectre/.codex/skills/cardano-p2p-defi-kernel/SKILL.md`
3. `/home/zxpectre/.codex/skills/cardano-graphql-mkii/SKILL.md`
4. `/home/zxpectre/.codex/skills/web-app/SKILL.md`
5. `AGENTS.md`
6. `/home/zxpectre/.codex/AGENTS.md`
7. Run contamination/audit scans and trim duplicates.

