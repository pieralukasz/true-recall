---
title: Reduce SVG Coordinate Precision
impact: LOW
impactDescription: reduces SVG string size and parse time; meaningful for icon-heavy UIs
tags: preact, svg, optimization, performance, coordinates
---

## Reduce SVG Coordinate Precision

SVG path data exported from design tools often contains coordinates with 6–10 decimal places that contribute no visible precision at screen resolution. Reducing to 1–2 decimal places can cut path string length by 30–50%, reducing parse time and memory allocation for SVG-heavy components.

**Incorrect (unnecessary precision from design tool export):**

```tsx
function DonutIcon() {
  return (
    <svg viewBox="0 0 24 24">
      {/* ❌ 6-decimal coordinates — no visible improvement at screen DPI */}
      <path d="M12.000000,2.000000 C6.477153,2.000000 2.000000,6.477153 2.000000,12.000000" />
    </svg>
  )
}
```

**Correct (1-decimal precision — visually identical):**

```tsx
function DonutIcon() {
  return (
    <svg viewBox="0 0 24 24">
      {/* ✅ Shorter string, same visual result */}
      <path d="M12,2 C6.5,2 2,6.5 2,12" />
    </svg>
  )
}
```

**Automation:** Use `svgo` to process SVG files automatically:

```bash
# Install svgo
npm install -D svgo

# Optimize a single file
npx svgo --precision=1 icon.svg

# Optimize a directory
npx svgo --precision=1 -f src/assets/icons/
```

**SVGO config for consistent optimization:**

```js
// svgo.config.js
export default {
  plugins: [
    { name: "preset-default" },
    { name: "convertPathData", params: { floatPrecision: 1 } },
    { name: "cleanupNumericValues", params: { floatPrecision: 1 } },
  ],
}
```

Reference: [SVGO — SVG Optimizer](https://github.com/svg/svgo)
