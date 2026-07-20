# Runtime Assets

This directory contains optimized runtime assets generated from the raw source files in `assets/`.

Regenerate these files with:

```bash
pnpm run assets:optimize
```

Do not edit generated optimized runtime assets by hand when the raw source in `assets/` is the intended source of truth; regenerate via the dev-only optimizer.
