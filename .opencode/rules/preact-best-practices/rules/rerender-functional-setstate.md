---
title: Use Functional setState Updates
impact: CRITICAL
impactDescription: prevents stale closures and unnecessary callback recreations
tags: preact, hooks, useState, useCallback, callbacks, closures
---

## Use Functional setState Updates

When updating state based on its current value, use the functional update form of `setState` instead of directly referencing the state variable. This prevents stale closures, eliminates unnecessary dependencies in `useCallback`, and creates stable callback references.

**Incorrect (requires state as dependency, recreated on every change):**

```tsx
function TodoList() {
  const [items, setItems] = useState(initialItems)

  // Recreated every time items changes — unstable reference
  const addItems = useCallback((newItems: Item[]) => {
    setItems([...items, ...newItems])
  }, [items])  // ❌ items dependency causes recreations

  // Stale closure bug — always uses initial items value
  const removeItem = useCallback((id: string) => {
    setItems(items.filter(item => item.id !== id))
  }, [])  // ❌ missing dependency — silent bug
}
```

**Correct (stable callbacks, no stale closures):**

```tsx
function TodoList() {
  const [items, setItems] = useState(initialItems)

  const addItems = useCallback((newItems: Item[]) => {
    setItems(curr => [...curr, ...newItems])  // ✅ no dependencies
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(curr => curr.filter(item => item.id !== id))  // ✅ always fresh
  }, [])
}
```

**When direct updates are fine:**
- Setting to a static value: `setCount(0)`
- Setting from a prop/argument only: `setName(newName)`
- When state does not depend on its previous value

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
