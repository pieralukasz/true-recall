---
title: Combine Multiple Array Iterations
impact: LOW
impactDescription: replaces N passes over the array with one, halving memory allocations for intermediate arrays
tags: javascript, performance, reduce, iteration, array
---

## Combine Multiple Array Iterations

Chaining multiple `.filter()`, `.map()`, or `.reduce()` calls creates an intermediate array after each step. For large arrays or hot paths, combine them into a single `.reduce()` or a `for...of` loop.

**Incorrect (three passes, two intermediate arrays):**

```typescript
function getDueCardStats(cards: Card[]): { count: number; totalEase: number } {
  const now = Date.now()

  const dueCards = cards.filter(c => c.dueDate <= now)        // pass 1 → array
  const eases = dueCards.map(c => c.fsrs.difficulty)          // pass 2 → array
  const totalEase = eases.reduce((sum, e) => sum + e, 0)      // pass 3

  return { count: dueCards.length, totalEase }
}
```

**Correct (one pass, no intermediate arrays):**

```typescript
function getDueCardStats(cards: Card[]): { count: number; totalEase: number } {
  const now = Date.now()

  let count = 0
  let totalEase = 0

  for (const card of cards) {
    if (card.dueDate > now) continue
    count++
    totalEase += card.fsrs.difficulty
  }

  return { count, totalEase }
}
```

**Alternative with reduce (functional style):**

```typescript
const { count, totalEase } = cards.reduce(
  (acc, card) => {
    if (card.dueDate > now) return acc
    return { count: acc.count + 1, totalEase: acc.totalEase + card.fsrs.difficulty }
  },
  { count: 0, totalEase: 0 }
)
```

**When chaining is fine:**
- Small arrays (<100 items) in non-hot paths — readability wins
- When the intermediate array is needed for other purposes
- When a library (lodash, ramda) provides lazy evaluation under the hood

Reference: [MDN — Array.prototype.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
