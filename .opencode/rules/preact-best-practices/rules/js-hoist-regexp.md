---
title: Hoist RegExp Creation Outside Loops
impact: LOW
impactDescription: prevents re-compiling the same regular expression on every iteration
tags: javascript, performance, regexp, optimization, hoisting
---

## Hoist RegExp Creation Outside Loops

`new RegExp(...)` and regex literals defined inside a loop or function that is called frequently compile the pattern on every invocation. Move regex definitions to module scope (or outer function scope if the pattern depends on a closed-over variable) so they are compiled once.

**Incorrect (RegExp compiled on every iteration):**

```typescript
function filterByTag(cards: Card[], tag: string): Card[] {
  return cards.filter(card => {
    // ❌ new RegExp compiled on every card in the list
    const tagPattern = new RegExp(`\\b${tag}\\b`, "i")
    return tagPattern.test(card.tags.join(" "))
  })
}
```

**Correct (RegExp compiled once per call):**

```typescript
function filterByTag(cards: Card[], tag: string): Card[] {
  // ✅ Compiled once for this call, reused for all cards
  const tagPattern = new RegExp(`\\b${tag}\\b`, "i")
  return cards.filter(card => tagPattern.test(card.tags.join(" ")))
}
```

**Even better (static pattern at module scope):**

```typescript
// ✅ Compiled once at module load — never recompiled
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g
const HEADING_RE = /^#{1,6}\s/m

function extractLinks(markdown: string): string[] {
  return [...markdown.matchAll(WIKILINK_RE)].map(m => m[1])
}
```

**When the pattern is dynamic** (contains a variable), compile it outside the inner loop — once per outer call — not once per iteration:

```typescript
// ✅ One compile per search, not one per item
function search(items: string[], query: string): string[] {
  const re = new RegExp(escapeRegExp(query), "i")
  return items.filter(item => re.test(item))
}
```

Reference: [MDN — RegExp constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/RegExp)
