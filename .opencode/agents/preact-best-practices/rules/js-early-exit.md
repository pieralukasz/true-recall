---
title: Return Early from Functions
impact: LOW
impactDescription: reduces nesting depth and makes the happy path easier to read
tags: javascript, code-quality, early-return, guard-clauses
---

## Return Early from Functions

Check preconditions and edge cases at the top of a function and return (or throw) early. This avoids deeply nested `if/else` blocks and keeps the main logic at a consistent indentation level.

**Incorrect (nested conditions — hard to follow):**

```typescript
function processCard(card: Card | null, userId: string | null): ReviewResult {
  if (card !== null) {
    if (userId !== null) {
      if (!card.suspended) {
        // actual logic buried 3 levels deep
        return scheduleReview(card, userId)
      } else {
        return { skipped: true, reason: "suspended" }
      }
    } else {
      throw new Error("userId required")
    }
  } else {
    throw new Error("card required")
  }
}
```

**Correct (guard clauses — flat structure):**

```typescript
function processCard(card: Card | null, userId: string | null): ReviewResult {
  if (card === null) throw new Error("card required")
  if (userId === null) throw new Error("userId required")
  if (card.suspended) return { skipped: true, reason: "suspended" }

  // ✅ Happy path at the top level — easy to read
  return scheduleReview(card, userId)
}
```

**In Preact components — early return for loading/empty states:**

```tsx
function CardDetail({ cardId }: { cardId: string }) {
  const card = useCardById(cardId)

  // ✅ Guard clauses before the main render
  if (!card) return <Spinner />
  if (card.deleted) return <DeletedState />

  return <CardView card={card} />
}
```

Early returns also work with async functions — `await` the critical resource and return early if absent before proceeding.

Reference: [Clean Code — Guard Clauses](https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html)
