---
title: Animate Wrapper div, Not SVG Element
impact: LOW
impactDescription: CSS transforms on SVG foreignObject or SVG root can be inconsistent across browsers; a wrapper div is reliably composited by the GPU
tags: preact, animation, svg, css, performance, transform
---

## Animate Wrapper div, Not SVG Element

CSS transforms (`transform`, `scale`, `rotate`, `translate`) applied directly to an `<svg>` root element are composited inconsistently across browsers — some browsers paint the SVG on every frame rather than promoting it to a GPU layer. Wrapping the SVG in a `<div>` (or `<span>` for inline) and applying the transform to the wrapper ensures reliable GPU compositing and smooth 60fps animation.

**Incorrect (transform on SVG root — may jank in Firefox/Safari):**

```tsx
// ❌ SVG elements may not be GPU-composited reliably
function DonutChart({ progress }: { progress: number }) {
  return (
    <svg
      class="ep:transition-transform ep:hover:scale-110"
      viewBox="0 0 36 36"
    >
      <circle ... />
    </svg>
  )
}
```

**Correct (transform on wrapper div — always GPU-composited):**

```tsx
// ✅ The div gets its own compositing layer; SVG is repainted only when content changes
function DonutChart({ progress }: { progress: number }) {
  return (
    <div class="ep:inline-flex ep:transition-transform ep:hover:scale-110">
      <svg viewBox="0 0 36 36">
        <circle ... />
      </svg>
    </div>
  )
}
```

**Additional animation performance rules:**
- Animate only `transform` and `opacity` — both are composited without repaint
- Avoid animating `width`, `height`, `top`, `left` — they trigger layout reflow
- Use `will-change: transform` sparingly (only when animation is imminent) — it costs GPU memory

Reference: [CSS Compositing — MDN](https://developer.mozilla.org/en-US/docs/Web/Performance/CSS_JavaScript_animation_performance)
