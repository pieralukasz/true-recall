---
title: Limit useLayoutEffect to DOM Measurements
impact: MEDIUM
impactDescription: useLayoutEffect blocks paint; using it unnecessarily delays first render
tags: preact, hooks, useLayoutEffect, useEffect, DOM, measurements
---

## Limit useLayoutEffect to DOM Measurements

`useLayoutEffect` fires synchronously after DOM mutations but *before* the browser paints. This is useful for reading DOM measurements (scroll position, element dimensions) and applying synchronous corrections that would otherwise cause a flash. For everything else, use `useEffect`, which runs asynchronously after paint without blocking the browser.

**Incorrect (useLayoutEffect used for data fetching — blocks paint unnecessarily):**

```tsx
function Dashboard() {
  const [data, setData] = useState(null)

  // ❌ Blocks painting until fetch completes — useEffect is correct here
  useLayoutEffect(() => {
    fetchDashboardData().then(setData)
  }, [])

  return <div>{data ? <Chart data={data} /> : <Spinner />}</div>
}
```

**Correct (useLayoutEffect only for DOM measurements):**

```tsx
function Tooltip({ targetRef }: { targetRef: RefObject<HTMLElement> }) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  // ✅ Must run synchronously to position tooltip before paint
  useLayoutEffect(() => {
    if (!targetRef.current || !tooltipRef.current) return
    const { bottom, left } = targetRef.current.getBoundingClientRect()
    tooltipRef.current.style.top = `${bottom}px`
    tooltipRef.current.style.left = `${left}px`
  })

  return <div ref={tooltipRef} class="tooltip" />
}
```

**Decision guide:**
- Reading/writing DOM layout (width, height, position) → `useLayoutEffect`
- Syncing external store, fetching data, setting up listeners → `useEffect`
- Setting signal values or state from props → derive during render instead

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
