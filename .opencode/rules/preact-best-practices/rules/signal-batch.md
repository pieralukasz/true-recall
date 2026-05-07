---
title: Batch Multiple Signal Writes
impact: CRITICAL
impactDescription: collapses N sequential signal updates into a single re-render
tags: preact, signals, batch, performance, state
---

## Batch Multiple Signal Writes

When multiple signals need to be updated together, wrap the writes in `batch()`. Without batching, each signal write triggers its own flush cycle. With batching, all updates commit atomically after the outermost batch completes, causing at most one re-render.

**Incorrect (two separate flushes, two re-renders):**

```tsx
import { signal } from "@preact/signals-core"

const todos = signal<string[]>([])
const inputText = signal("")

function addTodo() {
  todos.value = [...todos.value, inputText.value]  // flush 1
  inputText.value = ""                              // flush 2
}
```

**Correct (one flush, one re-render):**

```tsx
import { signal, batch } from "@preact/signals-core"

const todos = signal<string[]>([])
const inputText = signal("")

function addTodo() {
  batch(() => {
    todos.value = [...todos.value, inputText.value]
    inputText.value = ""
  })
}
```

Batches are nestable — updates only flush after the outermost batch completes. Reading a modified signal *inside* a batch reflects its new value immediately (reads are not deferred, only writes are coalesced).

For the `notifyCardChange()` pattern used in this project, `batch()` is the mechanism that makes the `lastMutation` + `dataVersion` update atomic.

Reference: [Signals — Preact Guide](https://preactjs.com/guide/v10/signals/)
