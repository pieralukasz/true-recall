---
title: useTransition/useDeferredValue Are No-ops in Preact
impact: MEDIUM
impactDescription: avoids confusion when porting React code — these hooks exist in preact/compat but do nothing
tags: preact, hooks, useTransition, useDeferredValue, compat, react-compat
---

## useTransition/useDeferredValue Are No-ops in Preact

React's concurrent-mode hooks (`useTransition`, `useDeferredValue`, `startTransition`) are **stub no-ops** in Preact — they exist in `preact/compat` for compatibility with React libraries but provide no deferred-rendering benefit. Preact's renderer is synchronous, so there is no concurrent scheduler to defer work to.

**Incorrect (expecting deferred rendering behavior):**

```tsx
import { useTransition } from "react"  // or preact/compat

function SearchResults({ query }: { query: string }) {
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<Result[]>([])

  const handleSearch = (q: string) => {
    // ❌ In Preact this is synchronous — isPending is always false
    // No UI benefit over a plain setState call
    startTransition(() => {
      setResults(expensiveFilter(allItems, q))
    })
  }

  return isPending ? <Spinner /> : <ResultList items={results} />
}
```

**Correct (Preact alternative: signals + synchronous batching):**

```tsx
import { signal, computed } from "@preact/signals-core"
import { useSignal } from "@preact/signals"

function SearchResults() {
  const query = useSignal("")

  // computed() is lazy and only recalculates when query changes
  const results = useComputed(() => expensiveFilter(allItems, query.value))

  // For truly heavy work, run in a worker or chunk with requestIdleCallback
  return (
    <>
      <input onInput={(e) => (query.value = e.currentTarget.value)} />
      <ResultList items={results.value} />
    </>
  )
}
```

**For genuine deferral in Preact:**
- Web Workers for CPU-heavy computation
- `requestIdleCallback` / `requestAnimationFrame` for chunked work
- Virtual scrolling for large lists
- `computed()` signals for lazy derived state

Reference: [Preact/compat differences — Preact Guide](https://preactjs.com/guide/v10/switching-to-preact/)
