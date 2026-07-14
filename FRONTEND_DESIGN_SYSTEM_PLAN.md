# Frontend Design System Application Plan

Purpose: apply `.agents/skills/design-system` to `./src/frontend` while preserving the production NeonSoup DEX behavior, data flow, routing, wallet integration, cart semantics, route math, and mobile-first layout.

This plan is implementation guidance only. Do not mock data, do not replace production text with placeholder copy, and do not link runtime assets directly from `.agents/skills/design-system`.

## Non-Negotiable Constraints

- Preserve 100% current functionality in `src/frontend`, including React Router pages, wallet connect/disconnect, Cart Mode, swap/open validations, history, modals, toasts, tooltips, route bar math, app state compatibility, and all shared `src/common` behavior.
- Preserve most of the existing layout and responsive mobile-first UX. Treat the current frontend as the production app, not as a prototype to replace.
- Do not change core routing/quote math, swap segment calculations, cart UTxO booking, wallet receipt processing, provider queries, or app-state schema while applying visuals.
- Do not mock any data, metrics, chain state, wallet state, or transaction text.
- Do not use the P2P soup separator for now.
- Clone required design-system assets into `src/frontend/public/assets`; do not reference `.agents/skills/design-system/**` from app code or CSS.
- Keep `src/core` UI-agnostic and keep `src/frontend` independent from `src/devtool`.
- Preserve numeric input `step` values exactly, including asset-decimal-aware amount controls.
- Preserve `switch-btn` animations verbatim, only adapt colors and normalize borders and filters.
- Preserve Bootstrap Icons as the icon system.

## Source References To Apply

- Design rules: `.agents/skills/design-system/DESIGN.md`
- Compact brand spec: `.agents/skills/design-system/brand-spec.md`
- Token/component layer: `.agents/skills/design-system/colors_and_type.css`
- Applied reference: `.agents/skills/design-system/example.html`

Use the design system as a visual layer over the current DEX app, not as a new landing page or prototype.

## Asset Migration

Create `src/frontend/public/assets` and clone only the assets needed by the implementation:

- `logo/icon.png` and `logo/logo.png` for brand surfaces.
- `images/dark-bg.png` for dark theme page background.
- `images/light-bg.png` for light theme page background.
- Selected `cybernekos/*.png` and `kitchen/*.png` for friendly helper art in tooltips, dialogs, success/error states, relevant empty/loading states, and route/open/cart/action contexts where the filename meaning matches the UI action.
- Prefer `cybernekos/*.png` over `kitchen/*.png` in most friendly helper moments because CyberNekos are warmer, cuter, and better suited for user guidance. Use kitchen assets only when they are the strongest visual match for the specific action or idea.

Initial suggested asset mapping:

- Route/swap guidance: prefer CyberNekos `lens-inspection_U.png`, `order-tablet_O.png`, `soup-scale_J.png`, `ladle-stir_X.png`; use kitchen `measuring_spoon_A.png` or `strainer_ladle_A.png` only when the UI is explaining route measurement/filtering more clearly than a helper character can.
- Wallet review and submitted states: prefer CyberNekos `order-complete_P.png`, `receipt-sorting_S.png`, `serving-cloche_AQ.png`, `happy-wave_C.png`; use kitchen `coin_bowl_A.png` only for a very specific value/asset receipt moment.
- Error/warning states: prefer CyberNekos `worried-sweat_E.png`, `crying-error_F.png`, `dizzy-ko_G.png`, `facepalm_AH.png`; avoid kitchen assets unless the error is specifically about discarded/cleaned-up action context, where `scrap_bin_A.png` may fit.
- Empty, loading, or calm states: prefer CyberNekos `sitting-calm_D.png`, `sleepy-yawn_B.png`, `yawning-paw_AF.png`, `peeking-counter_A.png`; use kitchen `empty_bowl_A.png` or `lidded_bowl_A.png` only when the empty state is literally about no offers, no history, or nothing ready to execute.
- Cart and bundled actions: prefer CyberNekos `delivery-cart_AW.png`, `tray-carry_AZ.png`, `receipt-sorting_S.png`, `conveyor-belt_T.png`; use kitchen `bento_cube_A.png` only to explain bundled action grouping.
- Open offers and markets: prefer CyberNekos `specials-board_AU.png`, `menu-pointer_R.png`, `prep-counter_AS.png`, `data-wall_AY.png`; use kitchen `specials_board_A.png` only when a static board object communicates market/open-offer state better than a character.

Use assets meaningfully and sparingly. They should support the user’s current action or state, not become random decoration.

Transparent asset overflow rules:

- Let CyberNeko and kitchen PNGs overflow aesthetically outside card, dialog, and tooltip borders when it improves friendliness, but never let art cover actionable controls, amounts, warnings, or important copy.
- Use a shared asset helper class for these breakouts with `pointer-events: none`, stable dimensions/aspect ratio, responsive max size, and theme-aware drop shadow/glow.
- Keep parent card/dialog/tooltip surfaces `overflow: visible` only where the breakout is intentional; avoid changing scroll containers or table wrappers that need clipping.
- Raise the parent surface stacking context when an asset overlaps neighboring cards or containers. Do not rely only on the image `z-index`, because sibling cards and modal layers can still cover it.
- For tooltips rendered through a portal/floating layer, keep mascot/kitchen art inside the same high-z-index floating root so modal boxes and scroll panes cannot clip it.
- Verify overlapping states on mobile and desktop, especially adjacent cards, modals, drawers, and tooltip edges.

## CSS And Theme Work

Update `src/frontend/src/styles/theme.css` and `src/frontend/src/styles/app.css` in a controlled way:

- Replace current font stacks with design-system fonts: Archivo Black for display, Rajdhani for body/UI, IBM Plex Mono for protocol labels/readouts.
- Map current app variables (`--bg`, `--panel`, `--text`, `--cyan`, `--pink`, etc.) to design-system `--ns-*` tokens so existing component classes keep working.
- Support both existing `[data-bs-theme='light']` and design-system `[data-theme='light']` behavior if the app currently uses Bootstrap theme attributes.
- Add dark background image from `/assets/images/dark-bg.png` and light background image from `/assets/images/light-bg.png` behind readable scrims.
- Preserve high-contrast token-box backgrounds, modal readability, and current hover/click border highlights.
- Add holomorphic card treatment with interlaced texture, cyan rails, magenta glows, and asymmetric radii only where it improves important interactive regions.
- Apply neon glows to primary CTA buttons and important icon/action buttons without washing out disabled states.
- Keep modal and tooltip surfaces opaque enough in light and dark themes to avoid background bleed.
- Keep CSS small and theme-oriented. Avoid broad Bootstrap duplication.

## Component Application Targets

Apply the design system by decorating existing frontend primitives instead of replacing them.

### Shell, Nav, And Wallet

- Keep the current responsive shell, mobile drawer, route links, hidden future routes, and wallet group behavior.
- Use the cloned wordmark/icon assets as brand surfaces without causing the previous double-logo mobile bug.
- Apply design-system card/nav hover glow to nav items and wallet controls.
- Preserve wallet connected state, truncated address/name/type pill, connect CTA color, and disconnect button visibility.
- Add/keep rich tooltip content on connect, wallet widget, and disconnect. Tooltip text may use up to 15% cyber-kitchen terminology only where it clarifies the action.

### Swap And Open

- Preserve the current Swap and Open page structure and production form logic.
- Token boxes should keep their contrasted background, asset dropdown function, quick-fill buttons, and numeric input step.
- CTA buttons may receive design-system magenta/cyan glow, but disabled/invalid behavior must remain obvious.
- Preserve user-facing labels and warnings as much as possible. Do not reintroduce developer-facing wording.
- On Open, keep the current different-from-Swap layout and price/request two-way editing behavior.

### Route Bar

- Treat the route bar as high risk.
- Do not change the quote/route math or segment construction.
- Preserve the existing semantic segment meaning and separation.
- Apply design-system styling only at the final render/CSS layer:
  - normal fill segments keep the current semantic green/cyan idea with subtle gradients;
  - remainder/change/min-cleanup segments stay visually distinct from normal fills;
  - unavailable final segment remains the only striped unavailable segment;
  - borders between segments must stay clear at all widths.
- Verify the bar progresses smoothly when increasing amount step by step and only jumps when a new UTxO segment enters the route or final unavailable segment appears.

### Tooltips, Toasts, And Dialogs

- Keep the existing rich tooltip portal/floating behavior so modals and scroll containers do not clip tooltips.
- Increase friendliness with small contextual CyberNeko or kitchen assets where appropriate, especially tooltips and dialogs, but do not reduce readability.
- Preserve all production text and labels unless a small wording adjustment improves user understanding.
- Keep less-important toasts auto-hide behavior and important warning/error dialogs prominent.
- Add design-system success/warning/error visual tones and asset choices according to state.

### Markets, Portfolio, Orders, History, Cart

- Preserve current table/list columns, sorting, refresh buttons, copy buttons, explorer links, and modals.
- Apply table/card visual treatment without hiding important amounts or forcing horizontal scrollbars except where genuinely tabular on mobile.
- Use CyberNeko/kitchen helpers only in empty, loading, warning, or detail-modal contexts where the asset meaning fits the screen.
- Cart collision badges must keep normalized rich tooltips, not native `title`.

## Text And Voice Rules

- Preserve current production labels and messages as much as possible.
- Keep the frontend friendly AMM-like DEX voice: direct, simple, and user-facing.
- Do not add fake metrics, fake protocol claims, or generic SaaS filler.
- Use cyber-kitchen language only when it improves comprehension. Maximum target: about 15% of tooltip/dialog phrasing that includes mascot/kitchen assets.
- Never use cyber-kitchen terminology in vain or in serious failure states where clarity matters more.

## Implementation Order

1. Snapshot current behavior with targeted checks and screenshots before visual edits.
2. Clone selected assets into `src/frontend/public/assets` with stable paths.
3. Add design-system tokens to `theme.css`, mapped to existing frontend variables to avoid component churn.
4. Apply background images and page/shell/card/button glow treatments in CSS.
5. Decorate wallet/nav/token-box/CTA/modal/tooltip primitives while preserving markup behavior.
6. Apply route-bar CSS only after confirming no quote/route construction code is touched.
7. Add contextual asset hooks to tooltips, dialogs, toasts, and selected empty/loading/detail states.
8. Tune light theme readability and modal opacity.
9. Verify dark, light, mobile, tablet, and desktop screenshots.
10. Run frontend build/typecheck and inspect for asset path or bundle errors.

## Verification Plan

Run checks after implementation:

- `pnpm run build:frontend`
- Browser smoke test for routes: Swap, Open, Markets, My Orders, Portfolio, History, Options modal/page.
- Dark and light theme visual checks.
- Mobile viewport check around 360x800 and desktop around 1366x768.
- Tooltip checks inside normal pages, modals, and scroll containers to confirm no clipping.
- Route bar regression check with increasing amounts across UTxO thresholds.
- Wallet connect widget visual-state check: disconnected, connected, wallet type pill, disconnect tooltip.
- Numeric input check: existing `step` values unchanged.
- Switch button check: click rotation preserved; no hover rotation regression.
- Confirm no runtime references to `.agents/skills/design-system`.
- Confirm no P2P soup separator files/classes/scripts are imported.

## Files Expected To Change

- `src/frontend/src/styles/theme.css`
- `src/frontend/src/styles/app.css`
- `src/frontend/src/App.tsx`
- `src/frontend/public/assets/**`

Possible only if needed:

- `src/frontend/src/main.tsx` for theme attribute compatibility or CSS import order.
- Small focused frontend-only helper/component extraction if repeated asset-backed dialog/tooltip rendering becomes hard to audit.

Do not change unless a real functional bug is found:

- `src/common/domain/swapQuote*`
- `src/common/services/cartIntents*`
- `src/common/services/networkProvider*`
- `src/core/**`
- `src/devtool/**`

## Handoff Notes

- This is a production frontend reskin and polish pass, not a prototype build.
- The highest-risk area is the route bar. Treat CSS-only changes as the default and require explicit justification for any TypeScript changes in that path.
- The desired end state is still the existing simplified AMM-like NeonSoup DEX, now visually aligned with the rebel kawaii cyberpunk design system.
