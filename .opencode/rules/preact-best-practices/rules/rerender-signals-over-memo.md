---
title: Prefer Signals Over memo for Shared State
impact: CRITICAL
impactDescription: signals eliminate re-renders at the source; memo only reduces their cost
tags: preact, signals, memo, useMemo, shared-state, optimization
---

## Prefer Signals Over memo for Shared State

In Preact, `memo` lives in `preact/compat` (not core) because the Preact team considers signals a fundamentally better solution for the problems `memo` is typically used to solve. When state is shared between components, use signals — they eliminate re-renders entirely rather than just making them cheaper.

**Incorrect (using memo to avoid re-renders caused by shared state):**

```tsx
import { memo, useState } from "preact/compat"

// Parent holds state, must pass down as props, memo only helps if props don't change
const CardBadge = memo(function CardBadge({ count }: { count: number }) {
  return <span>{count}</span>
})

function Panel({ cardCount }: { cardCount: number }) {
  return (
    <div>
      <CardBadge count={cardCount} />
      <OtherExpensiveContent />
    </div>
  )
}
```

**Correct (signal bypasses the component tree entirely):**

```tsx
import { signal } from "@preact/signals"

// State lives in a signal, no prop drilling needed
export const cardCount = signal(0)

function CardBadge() {
  // Only this component re-renders (actually: only the text node updates)
  return <span>{cardCount}</span>
}

function Panel() {
  return (
    <div>
      <CardBadge />
      <OtherExpensiveContent />  {/* never re-renders due to cardCount changes */}
    </div>
  )
}
```

`memo` is still appropriate for pure presentational components that receive complex object props from a parent that re-renders frequently for unrelated reasons. But reach for signals first when the problem is shared state causing cascading re-renders.

Reference: [Should I use memo? — preactjs/preact Discussion](https://github.com/preactjs/preact/discussions/4116)
