---
title: Build Index Maps for Repeated Lookups
impact: LOW
impactDescription: reduces repeated O(N) scans to a single O(N) build + O(1) lookups
tags: javascript, performance, Map, index, data-structures
---

## Build Index Maps for Repeated Lookups

When the same lookup (`find`, `filter`, `includes`) is repeated multiple times over the same array, build an index map once and reuse it. This converts multiple O(N) scans into one O(N) build followed by O(1) lookups.

**Incorrect (multiple redundant O(N) scans):**

```tsx
function getCardStats(cards: Card[], reviewLogs: ReviewLog[]) {
  return cards.map(card => ({
    card,
    // ❌ Scans reviewLogs once per card — O(N*M) total
    lastReview: reviewLogs.find(log => log.cardId === card.id),
    reviewCount: reviewLogs.filter(log => log.cardId === card.id).length,
  }))
}
```

**Correct (build index once, O(1) per lookup):**

```tsx
function getCardStats(cards: Card[], reviewLogs: ReviewLog[]) {
  // ✅ Build index: O(M) — one pass over reviewLogs
  const logsByCard = Map.groupBy(reviewLogs, log => log.cardId)
  // Falls back for older envs:
  // const logsByCard = reviewLogs.reduce((acc, log) => {
  //   const list = acc.get(log.cardId) ?? []
  //   return acc.set(log.cardId, [...list, log])
  // }, new Map<string, ReviewLog[]>())

  return cards.map(card => {
    const logs = logsByCard.get(card.id) ?? []  // ✅ O(1)
    return {
      card,
      lastReview: logs.at(-1),
      reviewCount: logs.length,
    }
  })
}
```

**Common patterns:**
- Group reviews by card ID → `Map.groupBy(logs, l => l.cardId)`
- Index notes by file path → `new Map(notes.map(n => [n.path, n]))`
- Group cards by deck → `Map.groupBy(cards, c => c.deckId)`

**When to build at the service layer vs component:**
- If the source data comes from a signal, build the index in a `computed()` — it recalculates lazily only when data changes
- If the source is a prop, `useMemo(() => buildIndex(prop), [prop])`

Reference: [Map.groupBy — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy)
