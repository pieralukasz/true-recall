---
paths:
  - "src/features/study/**"
---

# Review Mode Architecture (`src/features/study/ui/review/`)

Component-based architecture with state machine pattern:

```
src/features/study/ui/review/
├── ReviewView.ts          # Main orchestrator
├── ReviewApp.tsx           # Preact rendering
├── helpers/               # Pure helper functions
│   └── session-helpers.ts # Card filtering, queue building
└── handlers/              # Event/action handlers
    ├── CardActionsHandler.ts  # Suspend, bury, move, etc.
    └── KeyboardHandler.ts     # Keyboard shortcuts
```

## Key Patterns

1. **State Machine for Session Flow** (`review.state.ts`):
   ```typescript
   type SessionPhase =
       | { type: "idle" }
       | { type: "active"; card: FSRSFlashcardItem }
       | { type: "waiting"; timeUntilDue: number }
       | { type: "complete"; stats: ReviewSessionStats };
   ```

2. **Memoized Badge Counts** — O(1) access, updated incrementally on each answer.

3. **Render Memoization** — Skip re-renders when `cardId` and `badgeCounts` unchanged.

4. **Component Extraction** — Components receive callbacks, not direct service access.

5. **Helper Functions** — Pure, testable: `filterActiveCards()`, `buildSourceUidToProjectsMap()`.

## When Refactoring Large Views
1. Render methods >50 LOC → extract to components
2. Multiple if/else state checks → discriminated union (state machine)
3. O(N) operations per render → memoize or cache
4. Pure logic → helper functions with tests
