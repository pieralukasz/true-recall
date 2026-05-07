---
title: signal() for Shared, useSignal() for Local State
impact: HIGH
impactDescription: correct scoping prevents unnecessary global state and GC pressure
tags: preact, signals, useSignal, global-state, local-state, scope
---

## signal() for Shared, useSignal() for Local State

Choose the correct signal creation API based on where the state needs to live:

- **`signal()` / `computed()`** — declared outside components for state shared between multiple components or between components and services
- **`useSignal()` / `useComputed()`** — declared inside components for state that is local to that component's lifecycle and should be garbage-collected when the component unmounts

**Incorrect (global signal for local UI state — memory never freed):**

```tsx
import { signal } from "@preact/signals"

// ❌ Leaks forever — never freed even after component unmounts
const isOpen = signal(false)

function Dropdown() {
  return (
    <div>
      <button onClick={() => isOpen.value = !isOpen.value}>Toggle</button>
      {isOpen.value && <ul>...</ul>}
    </div>
  )
}
```

**Correct (useSignal for component-local state):**

```tsx
import { useSignal } from "@preact/signals"

function Dropdown() {
  // ✅ Freed when Dropdown unmounts
  const isOpen = useSignal(false)
  return (
    <div>
      <button onClick={() => isOpen.value = !isOpen.value}>Toggle</button>
      {isOpen.value && <ul>...</ul>}
    </div>
  )
}
```

**Correct (global signal for shared/cross-component state):**

```typescript
// signals.ts — shared between views and services
export const dataVersion = signal(0)
export const lastMutation = signal<MutationInfo | null>(null)
```

`useSignal(x)` is equivalent to `useMemo(() => signal(x), [])` — it creates the signal once and returns the same instance on subsequent renders.

Reference: [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/)
