---
title: Cache Property Access in Loops
impact: LOW
impactDescription: avoids repeated property chain traversal inside hot loops
tags: javascript, performance, loops, property-access, optimization
---

## Cache Property Access in Loops

Accessing a deeply nested property chain (`a.b.c.d`) inside a loop re-traverses the chain on every iteration. Cache the value (or the intermediate object) in a local variable before the loop.

**Incorrect (deep access re-traversed on every iteration):**

```typescript
for (let i = 0; i < cards.length; i++) {
  // ❌ cards.length is re-read every iteration in non-V8 engines
  // ❌ this.state.review.queue traversed 3 levels every iteration
  if (this.state.review.queue[i].dueDate <= Date.now()) {
    this.state.review.queue[i].scheduled = true
  }
}
```

**Correct (cache the chain and length):**

```typescript
const queue = this.state.review.queue   // ✅ cache reference
const now = Date.now()                   // ✅ cache timestamp (stable in loop)
const len = queue.length                 // ✅ cache length (optional in V8 but good habit)

for (let i = 0; i < len; i++) {
  if (queue[i].dueDate <= now) {
    queue[i].scheduled = true
  }
}
```

**In functional iteration:**

```typescript
// ❌ Re-reads signal.value on every card
cards.forEach(card => {
  if (card.dueDate <= signal.value) doWork(card)
})

// ✅ Read once before the loop
const threshold = signal.value
cards.forEach(card => {
  if (card.dueDate <= threshold) doWork(card)
})
```

**When this matters:**
- Arrays of 1,000+ items processed synchronously
- Hot event handlers (scroll, resize, pointermove)
- Tight parsing loops in service methods

For typical UI rendering loops (tens to low hundreds of items), the overhead is negligible and readability takes priority.

Reference: [V8 — Understanding V8's Bytecode](https://medium.com/dailyjs/understanding-v8s-bytecode-317d46c94775)
