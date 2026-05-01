---
title: Never Use createRef in Function Components
impact: HIGH
impactDescription: createRef creates a new object on every render; useRef reuses the same object for the lifetime of the component
tags: preact, hooks, useRef, createRef, anti-pattern
---

## Never Use createRef in Function Components

`createRef()` is designed for class components — it allocates a new ref object on every call. In function components, use `useRef()` instead, which returns the same stable object across all renders.

**Incorrect (new ref object on every render):**

```tsx
import { createRef } from "preact"

function InputWithFocus() {
  // ❌ Creates a new { current: null } object on every render
  const inputRef = createRef<HTMLInputElement>()

  const focusInput = () => inputRef.current?.focus()

  return <input ref={inputRef} onClick={focusInput} />
}
```

**Correct (stable ref across renders):**

```tsx
import { useRef } from "preact/hooks"

function InputWithFocus() {
  // ✅ Same object returned on every render
  const inputRef = useRef<HTMLInputElement>(null)

  const focusInput = () => inputRef.current?.focus()

  return <input ref={inputRef} onClick={focusInput} />
}
```

`createRef` is only appropriate in class components where the instance persists between renders. For any function component, always use `useRef`.

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
