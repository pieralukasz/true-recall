---
paths:
  - "src/**"
---

# Reactive Data Notifications (`src/shared/services/signals.ts`)

Uses `@preact/signals-core` for all data-change notifications. No EventBus, no Zustand isStale pattern.

## Signals
- `dataVersion` — bumped on ANY card data change (coarse)
- `lastMutation` — detailed mutation info (type, cardId, changes)
- `settingsVersion` — bumped when plugin settings change
- `syncVersion` — bumped after cloud sync completes

## Producing changes
```typescript
import { notifyCardChange } from "../../shared/services/signals";
notifyCardChange({ type: "added", cardId, sourceNoteName });
notifyCardChange({ type: "updated", cardId, changes: { fsrs: true } });
notifyCardChange({ type: "bulk", cardIds: ids, action: "suspend" });
```

## Consuming changes
```typescript
import { effect } from "@preact/signals-core";
import { dataVersion, track } from "../../shared/services/signals";

// In onOpen()
this.signalDisposer = effect(() => {
    track(dataVersion);
    this.scheduleRefresh();
});

// In onClose() — always dispose
this.signalDisposer?.();
```

## Rules
1. Call `notifyCardChange()` after every card mutation
2. Use `track()` to read signal values in effects (avoids ESLint `no-unused-expressions`)
3. Always dispose effects in `onClose()` via `SubscriptionManager` or manual disposer
4. Views: `effect()` -> `scheduleRefresh()` (debounced) -> `loadData()` — never call `loadData()` directly from signals
