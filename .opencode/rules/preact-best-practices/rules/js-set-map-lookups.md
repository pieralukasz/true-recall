---
title: Use Set/Map for O(1) Lookups
impact: LOW
impactDescription: replaces O(N) Array.includes/find with O(1) Set.has/Map.get for repeated membership tests
tags: javascript, performance, Set, Map, data-structures, O(1)
---

## Use Set/Map for O(1) Lookups

`Array.includes()`, `Array.find()`, and `Array.indexOf()` scan the entire array — O(N). When a membership test or keyed lookup runs inside a render loop or event handler that fires frequently, replace it with a `Set` or `Map` for O(1) access.

**Incorrect (O(N) per lookup — bad when array grows):**

```tsx
function CardList({ cards, suspendedIds }: { cards: Card[]; suspendedIds: string[] }) {
  return (
    <ul>
      {cards.map(card => (
        // ❌ Array.includes scans suspendedIds on every card render
        <CardItem key={card.id} card={card} suspended={suspendedIds.includes(card.id)} />
      ))}
    </ul>
  )
}
```

**Correct (O(1) lookup — scales with list size):**

```tsx
function CardList({ cards, suspendedIds }: { cards: Card[]; suspendedIds: string[] }) {
  // ✅ Build the Set once — O(N) total, then O(1) per lookup
  const suspendedSet = useMemo(() => new Set(suspendedIds), [suspendedIds])

  return (
    <ul>
      {cards.map(card => (
        <CardItem key={card.id} card={card} suspended={suspendedSet.has(card.id)} />
      ))}
    </ul>
  )
}
```

**Map for keyed object lookups:**

```tsx
// ❌ O(N) per lookup
const getProject = (id: string) => projects.find(p => p.id === id)

// ✅ O(1) lookup
const projectMap = useMemo(
  () => new Map(projects.map(p => [p.id, p])),
  [projects]
)
const getProject = (id: string) => projectMap.get(id)
```

**When to create the Set/Map:**
- Computed once at the service layer when data changes (not on every render)
- Or `useMemo`'d in the component if the source array is a prop

Reference: [MDN — Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [MDN — Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
