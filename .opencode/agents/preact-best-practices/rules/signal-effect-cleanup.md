---
title: Always Dispose effect()
impact: CRITICAL
impactDescription: prevents memory leaks and stale subscriptions accumulating over time
tags: preact, signals, effect, cleanup, memory-leaks, lifecycle
---

## Always Dispose effect()

`effect()` returns a dispose function that unsubscribes all tracked signals and runs any cleanup returned from the callback. Always call it when the effect is no longer needed — in component `onClose()`, in `onunload()`, or when the owning context is destroyed.

**Incorrect (effect keeps running after component is closed):**

```typescript
import { effect } from "@preact/signals-core"
import { dataVersion } from "./signals"

class MyView {
  onOpen() {
    // ❌ No disposer stored — runs forever
    effect(() => {
      void dataVersion.value
      this.refresh()
    })
  }
}
```

**Correct (effect is tied to component lifecycle):**

```typescript
import { effect } from "@preact/signals-core"
import { dataVersion } from "./signals"

class MyView {
  private disposer?: () => void

  onOpen() {
    this.disposer = effect(() => {
      void dataVersion.value  // subscribe
      this.scheduleRefresh()
    })
  }

  onClose() {
    this.disposer?.()  // ✅ unsubscribes, frees memory
  }
}
```

When the callback itself creates side effects (event listeners, connections), also return a cleanup function from inside the effect:

```typescript
effect(() => {
  const handler = () => console.log(name.value)
  window.addEventListener("resize", handler)
  return () => window.removeEventListener("resize", handler)  // inner cleanup
})
```

Reference: [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/)
