# NeonSoup DEX Design System

This package is the reusable design-system source for the current NeonSoup landing page in `../index.html`.

NeonSoup is a peer-to-peer Cardano DeFi execution layer with a rebel, kawaii, cyberpunk product voice: open intents, shared liquidity, wallet-sealed execution, no silos, no middlemen, no exclusive frontends.

## Start Here

- `DESIGN.md`: full design-system guidance and anti-regression rules.
- `brand-spec.md`: compact token, type, layout, mascot, and control rules.
- `brand.json`: structured palette, typography, voice, imagery, and component metadata.
- `colors_and_type.css`: reusable CSS tokens, Bootstrap bridges, and `ns-` component classes.
- `p2p-soup-fluid-separator.css`: reusable P2P soup separator styling extracted from the current landing page.
- `p2p-soup-fluid-separator.js`: reusable P2P soup separator module extracted from the current landing page.
- `p2p-soup-fluid-separator.html`: minimal SVG defs + section markup for embedding the separator.
- `assets/logo/icon.png`: primary pot icon; use as product/route-card emphasis or brand mark.
- `assets/logo/logo.png`: wordmark/logo asset.
- `assets/cybernekos/*.png`: CyberNeko state helpers.
- `assets/kitchen/*.png`: semantic kitchen utility/action assets for cards and separator payload riders.
- `assets/images/dark-bg.png`: dark cyberpunk soup-shop scene.
- `assets/images/light-bg.png`: light solarpunk scene.

## Current Visual System

The current system is not the older rounded-futuristic version. It uses:

- `Archivo Black` display type for loud rebel headlines.
- `Rajdhani` body/UI type for sharp readable product copy.
- `IBM Plex Mono` for protocol labels and state readouts.
- Magenta as the primary action color.
- Cyan as the rail, focus, and secondary action color.
- Light-theme cyan/green values are intentionally more vivid and pure than the dark mode equivalents.
- Violet/blue depth for the dark cyberpunk canvas.
- Holomorphic HUD cards with interlaced texture, asymmetric radii, neon rails, and restrained glow.
- `punk-mark` labels instead of `holo-label` badges.
- CyberNekos, kitchen utilities, and the pot icon as breakout brand art that can escape card boundaries when content is protected.

## Hard Rules

- Do not reintroduce `NEONSOUP / P2P` ghost text.
- Do not use `holo-label`.
- Do not use bottom-left cutout decorations.
- Do not use unstyled native dropdowns.
- Do not let CyberNekos or kitchen utility art sit under sibling cards.
- Do not let breakout art overlap a card's headline or body text.
- Do not treat the pot icon as a small generic logo badge; it is the hero brand artifact.
- Do not use fake protocol metrics or generic SaaS claims.

## Component Guidance

Use `colors_and_type.css` after Bootstrap 5 or as the standalone token layer.

Recommended primitives:

- `.ns-card`, `.ns-hud-card`, `.ns-module-card` for holomorphic cards.
- `.ns-punk-mark` for mono rebel labels.
- `.ns-btn`, `.ns-btn-primary`, `.ns-btn-secondary` for actions.
- `.ns-field` for inputs and textareas.
- `.ns-native-select`, `.ns-cyber-select`, `.ns-cyber-select-trigger`, `.ns-cyber-options`, `.ns-cyber-option` for styled dropdowns.
- `.ns-mascot-card`, `.ns-mascot-breakout`, `.ns-kitchen-breakout` for CyberNeko and kitchen card breakouts.
- `.ns-icon-quote` for the full-width manifesto/quote card pattern; use large kitchen artwork for quote-card breakouts when the copy needs the full left side.
- `.p2p_soup_fluid_separator` for the reusable scroll-linked pot-to-pot soup animation.

## Mascot and Icon Layering

CyberNekos and kitchen utility art must be layered as part of the card system:

1. The card owns the stacking context.
2. The parent card gets a higher `z-index` when the breakout overlaps sibling cards.
3. The breakout image gets an above-content `z-index`.
4. The card gets enough top/right padding to protect text.
5. The section or grid must allow visible overflow where breakouts are intended.

The pot icon uses the same breakout logic. In the current landing page it is used as the larger Cook a route card breakout. The no-silos quote card uses a large kitchen station breakout and lets copy occupy the released left side.

## P2P Soup Separator

The separator animation is a reusable module and should be preserved as-is:

- The flow is a fluid catapulted from the thrower pot interior into the catcher pot interior.
- Pot foreground/background layers sandwich the flow and payload layers for depth.
- Keywords render above surfing payloads.
- Kitchen utilities, CyberNekos, token coins, and bubbles ride the flow.
- On mobile and small tablets the pots are partly off-screen; the fluid and keyword stay dominant.
- Do not crop glows; all separator containers must allow visible overflow.
- Use `p2p-soup-fluid-separator.css`, `p2p-soup-fluid-separator.js`, and `p2p-soup-fluid-separator.html` as the canonical reusable export.

## Reuse Workflow

1. Read `DESIGN.md` and `brand-spec.md`.
2. Load `colors_and_type.css`.
3. Use `../index.html` as the current reference implementation.
4. Build with product-real modules: route kitchen, wallet review, pool readiness, intent timeline, styled selects, status cards, and CyberNeko helpers.
5. Check the hard rules before handoff.

## Verification Checklist

- The page has no exposed native dropdown styling.
- Mascots and the pot icon are never clipped by their own card.
- Mascots that overlap neighboring cards are visually above those neighbors.
- Quote/manifesto text spans the available card width.
- P2P soup separator fluid appears from the thrower pot interior and disappears into the catcher pot interior on desktop, tablet, and mobile.
- Primary CTAs read as magenta, with cyan used for rails and focus.
- Typography uses Archivo Black, Rajdhani, and IBM Plex Mono.
- No stale Orbitron direction, `holo-label`, ghost text, or weak geometric hero styling remains.
