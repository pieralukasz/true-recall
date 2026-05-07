---
title: Choose Local State vs Signal by Scope
impact: MEDIUM
impactDescription: mismatched state scope causes either over-sharing (global signals for local UI) or under-sharing (useState for cross-component data)
tags: preact, signals, useState, useSignal, architecture, state-management
---

## Choose Local State vs Signal by Scope

Not all state is equal. Use the narrowest scope that correctly models the data:

| State type | Tool | Example |
|---|---|---|
| UI state local to one component | `useState` / `useSignal` | modal open, tab index, input value |
| State shared across a subtree | `useContext` + `useSignal` | theme, current user |
| Global application state | `signal()` module-level | auth token, card database version |
| Derived from other signals | `computed()` | filtered list, formatted date |

**Incorrect (global signal for purely local UI state):**

```tsx
// ❌ Global — any module can mutate this; creates hidden coupling
export const isModalOpen = signal(false)

function Modal() {
  return isModalOpen.value ? <div class="modal">...</div> : null
}
```

**Correct (local signal for local state):**

```tsx
function useModal() {
  const isOpen = useSignal(false)
  const open = () => (isOpen.value = true)
  const close = () => (isOpen.value = false)
  return { isOpen, open, close }
}

function Toolbar() {
  const { isOpen, open, close } = useModal()
  return (
    <>
      <button onClick={open}>Open</button>
      {isOpen.value && <Modal onClose={close} />}
    </>
  )
}
```

**Correct (global signal for cross-component data):**

```tsx
// ✅ Module-level signal — single source of truth for all views
export const dataVersion = signal(0)

// Any view anywhere subscribes without prop drilling
function SomeView() {
  // effect() from @preact/signals-core re-runs when dataVersion changes
  effect(() => { track(dataVersion); refresh() })
}
```

**Decision checklist:**
1. Is the state used by exactly one component? → `useState` or `useSignal`
2. Is the state used by a few nearby components? → pass as props or `useContext`
3. Is the state used by distant or many components? → module-level `signal()`
4. Is the state derived from other state? → `computed()` or derive during render

Reference: [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/)
