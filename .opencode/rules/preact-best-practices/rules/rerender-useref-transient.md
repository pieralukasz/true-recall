---
title: Use useRef for Transient Values
impact: MEDIUM
impactDescription: prevents re-renders for values that change frequently but don't affect the view
tags: preact, hooks, useRef, transient-values, optimization
---

## Use useRef for Transient Values

Store values in `useRef` when they change frequently but don't need to trigger a re-render — for example, scroll position, animation frame IDs, debounce timers, or the previous value of a prop. Unlike `useState`, updating a ref never causes a re-render.

**Incorrect (uses state for a value that doesn't affect the rendered output):**

```tsx
function ScrollTracker() {
  // ❌ Every scroll event triggers a re-render — usually 60+ times/sec
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  // scrollY is only used in the callback, not in the rendered output
  useEffect(() => {
    if (scrollY > 500) prefetchNextPage()
  }, [scrollY])
}
```

**Correct (ref holds the value, no re-renders):**

```tsx
function ScrollTracker() {
  const scrollY = useRef(0)

  useEffect(() => {
    const handler = () => {
      scrollY.current = window.scrollY  // ✅ no re-render
      if (scrollY.current > 500) prefetchNextPage()
    }
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])
}
```

Common cases for `useRef` over `useState`:
- Animation frame IDs and timer IDs
- Pointer/mouse position used only in event callbacks
- Accumulated values between renders (counters, accumulators)
- Previous prop/state values for comparison

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
