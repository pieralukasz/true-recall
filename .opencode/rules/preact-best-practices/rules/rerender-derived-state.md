---
title: Calculate Derived State During Rendering
impact: MEDIUM
impactDescription: eliminates extra render cycles caused by synchronizing state in effects
tags: preact, hooks, useState, useEffect, derived-state, anti-pattern
---

## Calculate Derived State During Rendering

When a value can be computed from existing state or props, calculate it during render rather than storing it in a separate `useState` and syncing it in a `useEffect`. The effect approach introduces an extra render cycle and is harder to follow.

**Incorrect (state synchronization via useEffect):**

```tsx
function CardList({ cards }: { cards: Card[] }) {
  const [dueCards, setDueCards] = useState<Card[]>([])

  // ❌ Extra render cycle: first render with stale dueCards,
  // then effect runs, then re-render with updated dueCards
  useEffect(() => {
    setDueCards(cards.filter(c => c.dueDate <= Date.now()))
  }, [cards])

  return <ul>{dueCards.map(c => <CardItem key={c.id} card={c} />)}</ul>
}
```

**Correct (derived during render, always consistent):**

```tsx
function CardList({ cards }: { cards: Card[] }) {
  // ✅ Always in sync, no extra render, no effect needed
  const dueCards = cards.filter(c => c.dueDate <= Date.now())

  return <ul>{dueCards.map(c => <CardItem key={c.id} card={c} />)}</ul>
}
```

If the derivation is expensive, wrap it in `useMemo`:

```tsx
const dueCards = useMemo(
  () => cards.filter(c => c.dueDate <= Date.now()),
  [cards]
)
```

For state derived from *signals*, use `computed()` instead — it has the same lazy evaluation semantics and works outside components.

Reference: [Hooks — Preact Guide](https://preactjs.com/guide/v10/hooks/)
