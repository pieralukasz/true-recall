---
title: Use Lazy State Initialization
impact: MEDIUM
impactDescription: avoids re-running expensive computations on every render
tags: preact, hooks, useState, lazy-initialization, performance
---

## Use Lazy State Initialization

When the initial state value requires an expensive computation, pass a function to `useState` rather than calling the computation directly. The function is only called once — on mount — instead of on every render.

**Incorrect (expensive computation runs on every render):**

```tsx
function SearchResults() {
  // ❌ parseQueryString runs on every re-render, not just the first
  const [filters, setFilters] = useState(parseQueryString(window.location.search))

  return <ResultsList filters={filters} />
}
```

**Correct (computation only runs once):**

```tsx
function SearchResults() {
  // ✅ Function is called once on mount, result stored in state
  const [filters, setFilters] = useState(() => parseQueryString(window.location.search))

  return <ResultsList filters={filters} />
}
```

This pattern applies to any expensive operation used as initial state: parsing, sorting, reading from `localStorage`, building lookup maps, etc.

```tsx
// ✅ Reading from localStorage once
const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "dark")

// ✅ Building an initial lookup map
const [index, setIndex] = useState(() =>
  new Map(initialItems.map(item => [item.id, item]))
)
```

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
