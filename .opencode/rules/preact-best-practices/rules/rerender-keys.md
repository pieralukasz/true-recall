---
title: Use Stable Unique Keys in Lists
impact: CRITICAL
impactDescription: prevents incorrect component reuse and unnecessary remount/unmount cycles
tags: preact, keys, reconciliation, lists, performance
---

## Use Stable Unique Keys in Lists

When rendering lists, always provide a stable, unique `key` prop derived from the item's identity — not its array index. Preact's reconciler uses `key` to determine whether to reuse an existing DOM node or create a new one. Incorrect keys cause wrong data to appear in reused components and silent state corruption.

**Incorrect (index as key — breaks on reorder/insert/delete):**

```tsx
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        // ❌ If item is inserted at position 0, all subsequent
        // components get wrong keys and may show stale state
        <TodoItem key={index} todo={todo} />
      ))}
    </ul>
  )
}
```

**Correct (stable ID as key):**

```tsx
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        // ✅ Key tracks identity regardless of position
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  )
}
```

**When index keys are acceptable:** Only when the list is truly static (never reordered, never has items inserted in the middle, never has items deleted except from the end) AND items have no internal state. In practice, use IDs.

If items have no stable ID, generate one when they are created (`crypto.randomUUID()`) and store it with the item, rather than generating it during render.

Reference: [Keys in lists — Preact documentation](https://preactjs.com/guide/v10/components/)
