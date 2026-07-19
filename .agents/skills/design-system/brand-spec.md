# NeonSoup DEX Brand Spec

This spec reflects the current `index.html` landing implementation. Treat it as the canonical compact reference when building new NeonSoup web surfaces.

## Core Tokens

```css
:root {
  --ns-bg: oklch(10% 0.045 282);
  --ns-surface: oklch(16% 0.055 282 / 0.78);
  --ns-surface-strong: oklch(21% 0.07 286 / 0.9);
  --ns-fg: oklch(96% 0.018 215);
  --ns-muted: oklch(74% 0.055 238);
  --ns-border: oklch(75% 0.14 210 / 0.35);
  --ns-accent: oklch(82% 0.18 195);
  --ns-accent-2: oklch(73% 0.22 330);
  --ns-accent-3: oklch(61% 0.21 285);
  --ns-success: oklch(78% 0.16 155);
  --ns-warning: oklch(82% 0.17 80);
  --ns-danger: oklch(70% 0.2 25);
}
```

Dark theme is the default: violet/blue cyberpunk depth, cyan rails, magenta primary CTAs, readable glass. Light theme shifts to solarpunk kitchen brightness while preserving cyan rails and magenta action moments.

## Light Solarpunk Override

Light mode keeps the same violet/magenta brand voice, but pushes cyan and green cleaner and more vivid so the UI matches the bright CyberNeko and solarpunk rendered assets.

```css
[data-theme="light"] {
  --ns-bg: oklch(98% 0.028 170);
  --ns-surface: oklch(100% 0.018 170 / 0.78);
  --ns-surface-strong: oklch(100% 0.014 170 / 0.94);
  --ns-muted: oklch(42% 0.09 226);
  --ns-border: oklch(76% 0.17 176 / 0.58);
  --ns-accent: oklch(72% 0.22 178);
  --ns-accent-2: oklch(70% 0.22 326);
  --ns-success: oklch(67% 0.23 151);
  --ns-info: oklch(72% 0.21 190);
}
```

Use `--ns-success` for bright output values and served/confirmed states in light mode. It should visually sit close to the green value used for estimated served output.

## Fonts

- Display: `Archivo Black`, `Arial Black`, `Impact`, system sans-serif.
- Body: `Rajdhani`, `Sohne`, `Avenir Next`, system sans-serif.
- Mono: `IBM Plex Mono`, `JetBrains Mono`, `SFMono-Regular`, monospace.

Avoid returning to Orbitron or rounded geometric hero typography. The current voice is sharper, louder, and more punk.

## Layout Posture

- Use holomorphic HUD cards with interlaced texture, cyan rails, magenta glow, and asymmetric radii.
- Preserve the interlaced card background; do not simplify cards into plain glass boxes.
- Use `punk-mark` style labels. Do not use `holo-label`.
- Do not use bottom-left cutout decorations or ghost brand text such as `NEONSOUP / P2P`.
- Use magenta for the main action, cyan for rails/focus/secondary action, violet-blue for structural depth.
- Keep body text readable above all glow and background scene layers.

## CyberNeko, Kitchen, and Icon Rules

- CyberNekos are stateful product helpers, not random standalone decoration.
- Kitchen utilities are first-class brand/action assets for route cooking, execution, shared liquidity, and separator payloads.
- CyberNekos and kitchen utilities must share the same content-card CSS treatment: sizing, filter, opacity, pointer events, and stacking rules.
- Breakouts must render above sibling cards. Raise the parent card stacking context, not just the image.
- Give cards enough top/right/bottom padding so the art never overlaps the inner copy.
- Preserve the source image ratio and let art break out from card edges.
- The NeonSoup pot icon is the most important brand image. Use it as route/product emphasis and brand signal; in the current landing it anchors the Cook a route card rather than the no-silos quote card.
- The no-silos quote card uses the large kitchen station image from `assets/kitchen/`.

## P2P Soup Separator Export

The approved P2P soup separator is exported as reusable files:

- `p2p-soup-fluid-separator.css`
- `p2p-soup-fluid-separator.js`
- `p2p-soup-fluid-separator.html`

Behavior to preserve:

- Soup fluid is catapulted from the thrower pot interior into the catcher pot interior.
- Pot layers sandwich the flow: `empty_pot_bg.png`, then fluid/payload/mouth, then `empty_pot_fg.png`.
- Neon glares and glows must not be clipped.
- Fluid shapes are rounded drawn shapes, not clipped glow masks.
- Keywords render above surfing payload items.
- CyberNekos, kitchen utilities, token coins, and bubbles can ride the flow.
- On mobile/small tablet, pots are partly off-screen and decorative while fluid and keyword remain readable.

## Asset Map

- `assets/logo/icon.png`: updated NeonSoup pot icon.
- `assets/logo/logo.png`: NeonSoup wordmark.
- `assets/images/dark-bg.png`: dark cyberpunk background.
- `assets/images/light-bg.png`: light solarpunk background.
- `assets/images/empty_pot_bg.png`: P2P separator pot background.
- `assets/images/empty_pot_fg.png`: P2P separator pot foreground.
- `assets/cybernekos/*.png`: CyberNeko product helpers and separator riders.
- `assets/kitchen/*.png`: kitchen utilities, large quote-card art, and separator riders.

## Controls

- Native dropdowns must not be visually exposed.
- Use a custom cyber select shell with neon border, dark options, focus ring, keyboard-visible state, and a synchronized hidden/native select for form semantics.
- Buttons, fields, badges, and cards should be Bootstrap-friendly but visually NeonSoup-first.
