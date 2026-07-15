---
name: neonsoup-dex-design-system
description: Generate NeonSoup DEX product UI, landing pages, and Bootstrap-friendly components from the current rebel kawaii cyberpunk design system.
user-invocable: true
---

# NeonSoup DEX Design System Skill

Use this skill when building NeonSoup DEX landing pages, product screens, app UI, design-system specimens, decks, or Bootstrap-based components.

## Required Context

Before building, read:

1. `DESIGN.md`
2. `brand-spec.md`
3. `colors_and_type.css`
4. The current applied reference at `example.html` when available

## Product Premise

NeonSoup is a peer-to-peer execution layer for Cardano DeFi. Users create open intents on their own devices, access shared liquidity, and review wallet-sealed transactions without siloed liquidity, middlemen, exclusive frontends, centralized order books, or batcher dependence.

## Current Visual Direction

The current system is rebel kawaii cyberpunk, not generic futuristic SaaS.

Use:

- Dark cyberpunk soup-shop depth for product energy.
- Light solarpunk kitchen brightness for calmer surfaces.
- `Archivo Black` for display headlines.
- `Rajdhani` for body and UI text.
- `IBM Plex Mono` for protocol labels and readouts.
- Magenta for primary action.
- Cyan for rails, focus, and secondary action.
- Violet/blue depth as the dark structural base.
- Holomorphic HUD cards with interlaced texture.
- CyberNekos as stateful product helpers.
- The NeonSoup pot icon as the primary manifesto/quote-card breakout image.

Avoid:

- Orbitron or rounded geometric hero typography.
- `holo-label` badges.
- `NEONSOUP / P2P` ghost text.
- Bottom-left clipped card decorations.
- Unstyled native dropdowns.
- Random mascot stickers.
- Mascots covered by sibling cards.
- Mascots covering inner card text.
- Fake protocol metrics and generic SaaS claims.

## Build Rules

- Load `colors_and_type.css` after Bootstrap 5 when Bootstrap is present.
- Use `ns-` classes for cards, buttons, fields, badges, custom selects, mascot breakouts, and icon quote cards.
- Hide native select chrome and mirror it with the custom cyber select pattern.
- Keep cards readable above scene imagery and glow layers.
- Preserve the interlaced card texture.
- Use `punk-mark` labels for section tags and module labels.
- Give mascot cards enough internal padding before placing breakout art.
- Raise the parent card z-index when a mascot overlaps neighboring cards.
- Tooltip, dialog, and helper art may aesthetically overflow cards, modals, or
  tooltips, but verify z-index, clipping, scroll containers, and sibling
  overlap so the art does not cover copy, controls, or adjacent cards.
- Keep full-width copy in the pot-icon quote/manifesto card and position the icon as a corner breakout.
- Add real interaction for routing, filtering, dropdowns, copy actions, validation, theme changes, or wallet review when the screen includes those actions.

## Useful Assets

- Primary icon: `assets/logo/icon.png`
- Wordmark/logo: `assets/logo/logo.png`
- Dark scene: `assets/images/dark-bg.png`
- Light scene: `assets/images/light-bg.png`
- CyberNekos: `assets/cybernekos/*.png`

## Quality Gate

Before handoff:

- Confirm no exposed native dropdown styling remains.
- Confirm CyberNekos are above sibling cards when overlapping.
- Confirm CyberNekos do not cover card copy.
- Confirm the pot icon breaks out from a meaningful quote or manifesto card.
- Confirm primary action hierarchy is magenta first, cyan second.
- Confirm typography uses Archivo Black, Rajdhani, and IBM Plex Mono.
- Confirm the artifact does not expose design-process controls or fake metadata as product UI.
- Confirm responsive layouts do not horizontally overflow at mobile widths.
