---
title: Always Return Cleanup from useEffect
impact: HIGH
impactDescription: prevents memory leaks, zombie event listeners, and stale callbacks after unmount
tags: preact, hooks, useEffect, cleanup, memory-leak
---

## Always Return Cleanup from useEffect

Any `useEffect` that sets up a subscription, event listener, timer, or external resource must return a cleanup function. Preact calls the cleanup when the component unmounts or before re-running the effect. Forgetting cleanup causes memory leaks and stale callbacks that can mutate unmounted component state.

**Incorrect (listener and timer never cleaned up):**

```tsx
function LiveClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    // ❌ interval keeps firing after component unmounts
    const id = setInterval(() => setTime(new Date()), 1_000)
    // no return — interval leaks
  }, [])

  useEffect(() => {
    // ❌ listener stays attached after unmount
    window.addEventListener("focus", handleFocus)
  }, [])
}
```

**Correct (cleanup always returned):**

```tsx
function LiveClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1_000)
    return () => clearInterval(id)  // ✅ cleared on unmount
  }, [])

  useEffect(() => {
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)  // ✅
  }, [])
}
```

**Signal effects also need cleanup:**

```tsx
// effect() from @preact/signals-core returns a disposer — always call it
const dispose = effect(() => {
  track(dataVersion)
  scheduleRefresh()
})

// In onClose / useEffect return:
return () => dispose()
```

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
