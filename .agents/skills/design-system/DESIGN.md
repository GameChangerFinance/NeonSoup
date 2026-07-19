# NeonSoup DEX Design System

> Category: Product design system
> Surface: Responsive web, DEX app UI, landing pages, Bootstrap 5 component layer
> Canonical applied reference: `../index.html`

## 1. Product Context

NeonSoup is a peer-to-peer execution layer for Cardano DeFi. The product voice is self-sovereign, inspectable, forkable, and street-ready: users cook open intents on their own devices, route through shared liquidity, and review sealed transactions in wallet without exclusive frontends, centralized order books, batchers, or siloed liquidity lanes.

The current visual system is **rebel kawaii cyberpunk**. It should feel like a neon soup counter run by cypherpunks: bold, anti-capture, practical, friendly, and a little riotous without becoming messy.

## 2. Current Visual Direction

Use the live landing page as the current source of truth. The direction is no longer generic futuristic glass. It is **holomorphic cyberpunk**:

- Dark violet/blue city depth with cyan rails and restrained magenta action/glow.
- Interlaced hologram panels, scan planes, and screen-like glass surfaces.
- Punk-mark labels for short rebel protocol statements.
- Kawaii CyberNekos and kitchen utility art as product-state helpers that may break out from cards.
- The updated NeonSoup pot icon as a primary brand artifact, not a secondary logo.
- Scroll-linked P2P soup separators where fluid is catapulted from one pot interior into another pot interior.

Avoid passive SaaS polish. The system needs visible cypherpunk values: no silos, no middlemen, no exclusive frontends, user-owned execution, forkable frontends, shared liquidity.

## 3. Color Tokens

Use OKLCH tokens from `colors_and_type.css`.

Dark theme:

```css
--ns-bg: oklch(10% 0.045 282);
--ns-surface: oklch(16% 0.055 282 / 0.78);
--ns-surface-strong: oklch(20% 0.06 282 / 0.88);
--ns-fg: oklch(96% 0.018 215);
--ns-muted: oklch(74% 0.055 238);
--ns-border: oklch(75% 0.14 210 / 0.34);
--ns-accent: oklch(82% 0.18 195);
--ns-accent-2: oklch(72% 0.24 326);
--ns-violet: oklch(56% 0.18 285);
```

Light theme:

```css
--ns-bg: oklch(98% 0.028 170);
--ns-surface: oklch(100% 0.018 170 / 0.78);
--ns-surface-strong: oklch(100% 0.014 170 / 0.94);
--ns-fg: oklch(23% 0.08 282);
--ns-muted: oklch(42% 0.09 226);
--ns-border: oklch(76% 0.17 176 / 0.58);
--ns-accent: oklch(72% 0.22 178);
--ns-accent-2: oklch(70% 0.22 326);
--ns-success: oklch(67% 0.23 151);
--ns-info: oklch(72% 0.21 190);
```

Semantic colors:

- `--ns-success`: cooked, signed, confirmed, delivered.
- `--ns-warning`: simulation, route uncertainty, wallet review.
- `--ns-danger`: failed route, wallet rejection, stale quote.
- `--ns-info`: scanning, discovery, protocol note.

Accent budget:

- Cyan is the rail, focus, and system signal color; in light mode it should stay vivid and pure, not greyed out.
- Magenta is the primary CTA color and rebel/punk emphasis.
- Green is the light-mode output/success signal and should sit close to the bright estimated-served value.
- Violet/blue are the structural foundation.
- Do not use full-page magenta/purple gradients or neon floods.

## 4. Typography

Current stacks:

```css
--ns-font-display: "Archivo Black", "Arial Black", Impact, system-ui, sans-serif;
--ns-font-body: "Rajdhani", "Sohne", "Avenir Next", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--ns-font-mono: "IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", ui-monospace, monospace;
```

Rules:

- Use Archivo Black for hero and section headlines. It is bold and punk; avoid overly geometric display faces for NeonSoup.
- Use Rajdhani for body and lead copy. Avoid rounded, childish body copy.
- Use IBM Plex Mono for labels, route IDs, dropdown options, metadata, and badges.
- Hero title gradients must use no more than two colors.
- Do not add generated ghost text behind headlines, such as `NEONSOUP / P2P`.

Type scale:

- Hero: `clamp(3.25rem, 9vw, 8.2rem)`.
- Section: `clamp(2.25rem, 5vw, 4.9rem)`.
- Quote/manifesto: `clamp(2.2rem, 5.2vw, 5.8rem)`.
- Card titles: `1.2rem` to `1.7rem`.
- Labels: `0.74rem` to `0.84rem`, uppercase mono with positive tracking.

## 5. Holomorphic Cards

Glassmorphism in NeonSoup means **holomorphism**: projected screens, hologram scanlines, transparent cyber panels, and layered HUD edges.

Card posture:

- Use interlaced scan texture on card surfaces.
- Use asymmetric radii such as `34px 10px 38px 16px`, not generic uniform rounded cards.
- Use cyan/magenta rails and corner brackets as details.
- Keep panels readable with scrims and strong foreground contrast.
- Do not use bottom-left clipped card masks. They were rejected.
- Do not use `holo-label` styling. It was rejected. Use `punk-mark` labels instead.

Core classes:

- `ns-card`: standard holomorphic surface.
- `ns-hud-card`: stronger projected glass panel.
- `ns-punk-mark`: magenta rebel label shape.
- `ns-icon-quote`: full-width manifesto/quote card; reserve the left side for copy when a large kitchen breakout sits on the right.

## 6. CyberNekos, Kitchen Assets, and Icon Usage

CyberNekos are recurring cozy kawaii helpers. They must be stateful, not random decoration.

Use CyberNekos for:

- Route prep and wallet review.
- Shared liquidity / no-batcher / user-first principles.
- Architecture and protocol guidance.
- Quote, CTA, support, and success moments.

Use kitchen assets for:

- Soup-routing utilities, preparation, and execution metaphors.
- Protocol/action cards where an object communicates the action better than a mascot.
- The large no-silos quote-card breakout image.
- Soup separator payloads, mixed with CyberNekos and token coins.

Breakout rules:

- CyberNekos and kitchen utilities may break out of card edges because the PNGs have transparent backgrounds.
- CyberNekos and kitchen utilities must share the same CSS/styling treatment on content cards: sizing, filter, opacity, pointer events, and stacking logic.
- Breakout art must render above sibling cards. Raise the parent card stacking order, not only the image `z-index`.
- Add enough internal padding so breakout art does not cover text.
- Preserve the `894×666` aspect ratio.
- Avoid standalone floating CyberNekos detached from product context.

NeonSoup icon rules:

- `assets/logo/icon.png` is the most important brand image; use it as route/product emphasis and brand signal, not as the current no-silos quote-card breakout.
- Use it as a primary manifesto or quote artifact, not just a tiny nav logo.
- It may break out from a card corner like a mascot.
- In icon quote cards, let text span the full horizontal card width; the icon should not consume a text column.

## 7. Controls and Forms

Inputs and dropdowns must match the cyberpunk UI. Native browser dropdown styling is not acceptable when visible.

Use:

- Hidden native select for state/accessibility when needed.
- Custom `.ns-cyber-select` trigger and option list.
- Interlaced option panels, cyan/magenta border rails, dark surface, and mono labels.
- Visible focus states with cyan outlines.

Do not ship white system dropdown menus or unstyled native selects.

## 8. Layout and Responsive Behavior

Responsive web targets:

- Desktop: 1180px max shell, two-column hero, product module beside story.
- Tablet: card grids collapse before they squeeze.
- Mobile: one-column flow, full-width CTAs, readable panels, no horizontal scroll.

Card grids:

- When CyberNekos or kitchen utilities cross card boundaries, set explicit parent-card z-order so earlier breakouts render above later sibling cards.
- Keep `overflow: visible` on breakout surfaces.
- Add right/bottom padding to text cards with breakout art.

Background:

- Dark mode uses `assets/images/dark-bg.png`.
- Light mode uses `assets/images/light-bg.png`.
- Background imagery should sit behind overlays and scrims, never directly under small text.

## 9. Components

Required component families:

- Brand header with icon, wordmark, product nav, and theme toggle.
- Magenta primary CTAs and cyan ghost/secondary CTAs.
- Punk marks for short protocol statements.
- Holomorphic HUD cards and interlaced product modules.
- Route kitchen controls with editable amount, styled priority dropdown, output estimate, readiness meter, route ID, and copy action.
- Principle cards with CyberNeko/kitchen breakouts and protected text padding.
- Icon quote / manifesto band using the NeonSoup pot or a large kitchen breakout when it better fits the message.
- CTA card with CyberNeko breakout.
- P2P soup separator module with pot backgrounds/foregrounds, scroll-linked fluid, token coins, CyberNeko/kitchen riders, bubbles, and optional subliminal keyword.

Bootstrap alignment:

- Layer `colors_and_type.css` after Bootstrap 5.
- Keep Bootstrap class consumption possible for buttons, forms, badges, and alerts.
- Prefer `ns-` classes for NeonSoup-specific behavior.

## 10. P2P Soup Fluid Separator

The P2P soup separator is a reusable scroll-linked brand animation exported from the current landing page into:

- `p2p-soup-fluid-separator.css`
- `p2p-soup-fluid-separator.js`
- `p2p-soup-fluid-separator.html`

It is canonical because the live `index.html` animation is currently approved. Preserve its behavior exactly unless the landing page is intentionally revised first.

Behavior rules:

- The soup fluid is catapulted from the interior of the thrower pot and disappears into the interior of the catcher pot.
- Each pot must be layered as background pot image, flow/payload/mouth layer, then foreground pot image.
- Neon glare and background gradients must remain unclipped; separator containers use visible overflow.
- Fluid shapes are rounded shape elements, not glow-clipped masks.
- Optional keywords sit above surfing items in the stack.
- Surfing items include CyberNekos, kitchen utilities, rounded token coins, and bubbles.
- On small mobile/tablet widths, pots become partly off-screen and decorative; the fluid and keyword remain dominant.
- Payloads scale down with viewport width so they never compete with the keyword.

Reusable contract:

- Add the SVG defs once per page from `p2p-soup-fluid-separator.html`.
- Add one or more `.p2p_soup_fluid_separator` sections with optional `data-direction`, `data-variant`, and `data-p2p-soup-fluid-separator-keyword`.
- Load `p2p-soup-fluid-separator.css` and `p2p-soup-fluid-separator.js`.
- Asset paths may be overridden through `window.p2p_soup_fluid_separator_config`.

## 11. Motion and Interaction

Motion should feel like a real product:

- Buttons lift 2px on hover.
- Dropdowns open with a short opacity/translate transition.
- Theme selection persists with `localStorage`.
- Route cooking updates route status, estimate, readiness, route badge, and route ID.
- Reveal transitions respect `prefers-reduced-motion`.

Avoid constant pulsing, random floating mascots, and decorative motion that does not communicate state.

## 12. Voice and Copy

Use:

- Direct cypherpunk language.
- Concrete product words: open intents, shared liquidity, wallet review, user signed, forkable, UDC, Cardano, route simulation.
- Kitchen metaphors when they clarify execution and routing.

Avoid:

- Generic "next-gen DeFi" filler.
- Fake metrics.
- Overly cute language in warning/error/transaction states.
- Dense protocol claims without a user benefit.

## 13. Asset Map

Canonical assets:

- `assets/logo/icon.png`: primary NeonSoup pot icon.
- `assets/logo/logo.png`: NeonSoup wordmark.
- `assets/images/dark-bg.png`: dark cyberpunk soup-street scene.
- `assets/images/light-bg.png`: light solarpunk scene.
- `assets/images/empty_pot_bg.png`: separator pot background layer.
- `assets/images/empty_pot_fg.png`: separator pot foreground layer.
- `assets/kitchen/*.png`: kitchen utilities and action props for cards and separator payloads.
- `assets/kitchen/kitchen_station_B.png`: large no-silos quote-card breakout.
- `assets/cybernekos/peeking-counter_A.png`: shared liquidity / counter access.
- `assets/cybernekos/hologram-wave_AO.png`: composability / protocol projection.
- `assets/cybernekos/order-tablet_O.png`: wallet review / order prep.
- `assets/cybernekos/soup-machine_AP.png`: architecture / protocol machine.
- `assets/cybernekos/serving-soup_AD.png`: CTA / served route / testnet soup.
- `assets/cybernekos/*.png`: all available pets to express actions or emotions for cards and separator payloads.

## 14. Anti-patterns

Do not:

- Use unstyled native dropdowns.
- Use bottom-left clipped card decorations.
- Use `holo-label` styling.
- Use standalone floating CyberNekos detached from a section.
- Let CyberNekos or kitchen utilities overlap body copy.
- Let sibling cards cover CyberNeko or kitchen breakouts.
- Clip separator neon glows with a masked/cropped container.
- Place separator keywords below surfing payload items.
- Use geometric/rounded hero or lead type.
- Use ghost generated text behind hero titles.
- Use multi-color text gradients beyond two colors.
- Use loose decorative hero boxes that read as stray cards.
- Replace NeonSoup with generic monochrome SaaS.
- Use emoji as feature icons.
- Invent fake DEX metrics.
- Render design-process controls as product UI.
