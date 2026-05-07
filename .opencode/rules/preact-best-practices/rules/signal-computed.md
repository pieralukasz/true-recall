---
title: Use computed() for Derived State
impact: CRITICAL
impactDescription: single source of truth, lazy evaluation, auto-invalidation
tags: preact, signals, computed, derived-state, memoization
---

## Use computed() for Derived State

When state can be calculated from existing signals, use `computed()` rather than maintaining a separate signal that is manually kept in sync. Computed signals are lazy (only recalculate when accessed), automatically track their dependencies, and are read-only.

**Incorrect (duplicated state, manual sync required):**

```tsx
import { signal } from "@preact/signals-core"

const todos = signal([
  { text: "Buy milk", completed: false },
  { text: "Walk dog", completed: true },
])
const completedCount = signal(1)  // ❌ must be kept in sync manually

function toggleTodo(index: number) {
  const updated = todos.value.map((t, i) =>
    i === index ? { ...t, completed: !t.completed } : t
  )
  todos.value = updated
  completedCount.value = updated.filter(t => t.completed).length  // easy to forget
}
```

**Correct (single source of truth, auto-derived):**

```tsx
import { signal, computed } from "@preact/signals-core"

const todos = signal([
  { text: "Buy milk", completed: false },
  { text: "Walk dog", completed: true },
])
const completedCount = computed(() =>
  todos.value.filter(t => t.completed).length  // ✅ always consistent
)

function toggleTodo(index: number) {
  todos.value = todos.value.map((t, i) =>
    i === index ? { ...t, completed: !t.completed } : t
  )
  // completedCount updates automatically
}
```

Computed signals are also the correct replacement for `useMemo` in scenarios involving shared state — unlike `useMemo`, they work outside components and don't require a dependency array.

Reference: [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/)
