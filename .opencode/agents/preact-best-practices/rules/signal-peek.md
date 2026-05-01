---
title: Use .peek() to Read Without Subscribing
impact: MEDIUM
impactDescription: prevents accidental subscriptions in write-only contexts
tags: preact, signals, peek, untracked, subscriptions
---

## Use .peek() to Read Without Subscribing

When reading a signal's current value inside an `effect()` or computed but you deliberately do NOT want to subscribe to future changes, use `.peek()` (for a single signal) or `untracked()` (for multiple signals). This avoids creating a dependency that would cause the effect to re-run when that signal changes.

**Incorrect (accidentally subscribes to `count`, re-runs effect on every count change):**

```typescript
import { signal, effect } from "@preact/signals-core"

const count = signal(0)
const multiplier = signal(2)

effect(() => {
  // Only want to re-run when multiplier changes,
  // but count.value creates an accidental subscription
  const result = count.value * multiplier.value
  console.log("multiplier changed, result:", result)
})
```

**Correct (.peek() reads count without subscribing):**

```typescript
import { signal, effect } from "@preact/signals-core"

const count = signal(0)
const multiplier = signal(2)

effect(() => {
  // ✅ Re-runs only when multiplier changes
  const result = count.peek() * multiplier.value
  console.log("multiplier changed, result:", result)
})
```

For multiple signals, use `untracked()`:

```typescript
import { untracked } from "@preact/signals-core"

effect(() => {
  const result = untracked(() => count.value + offset.value) * multiplier.value
})
```

**When NOT to use `.peek()`:** Most effects *should* subscribe to all signals they read. Reserve `.peek()` for cases where a value is needed for a computation but the effect's purpose is to respond to a *different* signal changing.

Reference: [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/)
