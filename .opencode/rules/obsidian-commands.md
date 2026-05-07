## Command System and Undo

The Obsidian plugin uses a command-pattern undo/redo system in `packages/obsidian/src/commands`.

### Architecture

- `CommandService` (`command-service.ts`) maintains an undo/redo stack of `Command` objects
- Each `Command` declares a `mutationType` (key into `MUTATION_GROUPS`) and implements `execute()` + `undo()`
- Commands can be `deferred` — meaning the DB write is scheduled via `setTimeout(0)` to let the UI update first

### Non-deferred commands

`CommandService` wraps both execute and undo in `mutate(command.mutationType, fn)`, which handles DataLayer invalidation automatically. The command only needs to do the DB write inside `execute()`/`undo()`.

### Deferred commands

`CommandService` calls `command.execute(ctx)` / `command.undo(ctx)` directly WITHOUT the `mutate()` wrapper. The command itself is responsible for DataLayer invalidation, either by:
- Calling `mutateReviewGrade()` (for review answer grading with incremental patch)
- Calling `mutate()` directly
- Relying on `updateCardFSRS()` emitting a `"card:updated"` domain event → wireDataLayer → invalidation

If a deferred command's undo is called before the setTimeout fires, `cancelPendingWrite()` returns true and the undo typically only needs to restore queue state (no DB revert needed since no write happened).

### Rules for writing commands

- Non-deferred: just do the DB write — `mutate()` wrapper handles invalidation
- Deferred: the command MUST invalidate the DataLayer itself in both execute and undo paths
- When undoing card operations, consider side-effects beyond FSRS data:
  - `daily_reviewed_cards` (used by `countByState` to filter panel header counts)
  - Review queue state (managed by `ReviewUndoHook`)
  - Session stats (decremented by `removeLastReview`)
- Raw SQL operations (`bulkSuspend`, `bulkUnsuspend`, `bulkForget`) bypass the CardRepository and do NOT emit domain events — they rely on the `mutate()` wrapper for invalidation

### Panel header counts and `reviewedToday`

`NormalHeader` calls `countByState(cardsWithFsrs, reviewedToday, ...)` to compute the new/learning/review badges. `countByState` skips non-learning cards that appear in `reviewedToday`:

```
if (!isLearning && reviewedToday?.has(card.id)) continue;
```

After undo, the card's FSRS state reverts but `reviewedToday` may still contain the card ID. This causes the card to vanish from header counts. When undoing reviews:
- `removeLastReview()` removes from `daily_reviewed_cards` if `previousState === State.New` (the card's first-ever review)
- Known limitation: for Review-state cards reviewed for the first time today, undo does NOT remove from `daily_reviewed_cards` because we cannot distinguish first vs subsequent same-day review. The `daily_reviewed_cards` table has one entry per card per day, not per review.

### Hooks

- `ReviewUndoHook` (`hooks/review-undo-hook.ts`) runs `beforeUndo` for `review:*` commands
- It handles queue restoration for review answer undo (re-inserting the card, unburying siblings)
- Other review action commands (suspend, bury, forget) handle their own queue restoration in their `undo()` method
