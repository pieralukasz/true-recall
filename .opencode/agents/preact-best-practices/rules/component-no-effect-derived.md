---
title: Derive State During Render, Not in Effects
impact: MEDIUM
impactDescription: eliminates extra render cycles and desynchronized state caused by effect-driven updates
tags: preact, components, useEffect, derived-state, anti-pattern, signals
---

## Derive State During Render, Not in Effects

When a value can be computed from existing state, props, or signals, calculate it directly during render. Using `useEffect` to synchronize a separate state variable introduces an extra render cycle (render → effect → setState → render) and temporary inconsistency between the source and the derived value.

**Incorrect (extra render, temporary stale state):**

```tsx
function FilteredList({ items, filter }: { items: Item[]; filter: string }) {
  const [filtered, setFiltered] = useState<Item[]>([])

  // ❌ Runs after render — first render shows stale empty array
  useEffect(() => {
    setFiltered(items.filter(i => i.name.includes(filter)))
  }, [items, filter])

  return <ul>{filtered.map(i => <li key={i.id}>{i.name}</li>)}</ul>
}
```

**Correct (derived inline — always fresh, one render):**

```tsx
function FilteredList({ items, filter }: { items: Item[]; filter: string }) {
  // ✅ Computed every render, always consistent with input
  const filtered = items.filter(i => i.name.includes(filter))

  return <ul>{filtered.map(i => <li key={i.id}>{i.name}</li>)}</ul>
}
```

**For expensive derivations, use useMemo:**

```tsx
const filtered = useMemo(
  () => items.filter(i => i.name.includes(filter)),
  [items, filter]
)
```

**For signal-based derivations, use computed():**

```tsx
const filter = useSignal("")
const items = useSignal<Item[]>([])

// ✅ computed() is lazy — only recalculates when filter or items change
const filtered = useComputed(() =>
  items.value.filter(i => i.name.includes(filter.value))
)
```

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
