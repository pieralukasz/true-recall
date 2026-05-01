---
title: Pass Signal Directly to JSX
impact: CRITICAL
impactDescription: bypasses Virtual DOM diffing entirely — updates DOM in nanoseconds
tags: preact, signals, performance, vdom, jsx
---

## Pass Signal Directly to JSX

When a signal's value is used as text content or a DOM attribute in JSX, pass the signal object itself rather than accessing `.value`. Preact intercepts the signal and wires it directly to the DOM node, bypassing the Virtual DOM diff cycle completely.

**Incorrect (triggers full component re-render on every change):**

```tsx
import { signal } from "@preact/signals-core"

const count = signal(0)

function Counter() {
  // Accessing .value subscribes the component — whole component re-renders
  return <p>Count: {count.value}</p>
}
```

**Correct (DOM text node updates directly, no re-render):**

```tsx
import { signal } from "@preact/signals"

const count = signal(0)

function Counter() {
  // Pass the signal object — Preact patches the DOM node directly
  return <p>Count: {count}</p>
}
```

This optimization works for any position in JSX where a string would normally appear: text content, attribute values, and style values. The signal must come from `@preact/signals` (not `@preact/signals-core`) for the JSX interception to be available in components.

For component-local signals, use `useSignal()`:

```tsx
import { useSignal } from "@preact/signals"

function Counter() {
  const count = useSignal(0)
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => count.value++}>+</button>
    </div>
  )
}
```

Reference: [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/)
