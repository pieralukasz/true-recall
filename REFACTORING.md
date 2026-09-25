# Architecture and responsibility boundaries

This refactor separates editor state, application workflows, persistence, and UI
integration across the six areas identified in the audit. Existing plugin entry
points and FlashcardManager methods remain available as delegating APIs.

## Quick Note Editor

The editor lives in `packages/obsidian/src/modals/study/quick-note-editor`.

- `QuickNoteEditorApp.tsx` composes the action bar, formatting tools, fields, and
  footer.
- `hooks/useQuickNoteEditor.ts` owns the draft reducer, note type selection,
  source selection, and field management.
- `hooks/useQuickNotePersistence.ts` coordinates saving and the mobile Done action.
- `hooks/useQuickNoteUndo.ts` connects Save & Add to the command history.
- `hooks/useQuickNoteAI.ts` owns the temporary assistant target and its window.
- `hooks/useQuickNoteShortcuts.ts` registers keyboard handlers on the owning document.
- `domain/quick-note-state.ts` defines draft transitions, field mapping, and pins.
- `domain/quick-note-validation.ts` derives dirty state and save eligibility.
- `components/QuickNoteFooter.tsx` renders the footer.

The reducer is the single definition of draft transitions. A synchronous ref
tracks the same transitions because CodeMirror can commit its live value and
submit before Preact renders again. It does not hold a second, independently
managed form. Dirty state and save eligibility are computed from the draft.

Changing note types retains matching fields and carries the first nonempty value
into an empty primary field. Save & Add clears unpinned fields and the comment.
Undo is intercepted only when the creation command is still the next command
and the user has not edited the draft.

The refactor also closes several timing gaps:

- A failed mobile save leaves the modal open with its draft.
- Keyboard saves obey the source picker requirement.
- Completing a save or undo does not overwrite newer typing.
- Creation undo restores the user comment as well as the fields.
- Closing the editor prevents a pending AI context read from opening its window.

## Review

`packages/obsidian/src/views/review` now contains focused collaborators:

| Module | Responsibility |
| --- | --- |
| `ReviewView` | Obsidian lifecycle, dependency composition, keyboard and UI wiring |
| `ReviewSessionOrchestrator` | Preparing and starting queues, finishing sessions, top-up |
| `TypeInController` | Typed answers, reveal and grading flow, rating eligibility |
| `ReviewPresenter` | Mapping session state and adapters to ReviewApp props |
| `ReviewSessionSubscriptions` | Incremental mutations and notifications from other sessions |
| `ReviewPresetController` | Preset resolution, cache, and changes |
| `ReviewSourceNavigator` | Source lookup, grading context, and navigation |
| `ReviewActionsMenu` | Native card action menu |

The session store remains under `features/study/store`. Its composition function
delegates to `review-session-actions`, `review-queue-actions`,
`review-edit-actions`, and `review-selectors`. Initial state and review result
construction live in `review-state`. Queue transitions still use the existing
`review-queue.engine`.

Card actions under `features/study/ui/review/handlers` are split into
`CardLifecycleActions`, `CardEditingActions`, and `CardCreationActions`.
`CardActionContext` centralizes command selection, preview refresh, and removal
from temporary decks. `CardActionsHandler` preserves its existing public methods.

The patch-first mutation path, sibling handling, command undo, and pending
learning queue semantics are preserved. Type-in now rejects a late grading
result after resetting the session, including when the new session shows the
same card ID. Top-up rejects non-finite counts before building a queue.

## Flashcard panel

`packages/obsidian/src/views/panel` splits the sidebar adapter by concern:

| Module | Responsibility |
| --- | --- |
| `FlashcardPanelView` | Obsidian lifecycle, header actions, mobile pane menu, Preact mount, public API for `PluginEventHandlers` |
| `PanelSourceController` | Which note is shown: active note, review source, restored or pinned note |
| `PanelDataLoader` | Card info, uncollected blocks, highlights; debounced reloads and editor rescans; stale-result guard |
| `panel-refresh-policy` | Whether a data change needs a reload (FSRS ratings while following a review do not) |
| `PanelActions` | Open note, delete all with undo, copy to clipboard, CSV export |
| `features/library/ui/panel/utils/panel-csv` | CSV serializer, shared with `usePanelActions` |

The public methods (`handleFileChange`, `isFollowingReview`,
`clearReviewFollowState`, `syncWithReviewState`) and the persisted view state
(`{ file }`) are unchanged. The panel store and its UI hooks are unchanged.

Source states and transitions:

| Event | Result |
| --- | --- |
| Open, review active | Source of the current review card |
| Open, no review | Restored note, else active note, else (mobile) last opened markdown note |
| Review starts or moves to a card from another note | That note, `isFollowingReview` on |
| Review ends | Active note, following off |
| Card without a source, or its note no longer exists | Active note, following off |
| Workspace file change | That file; on mobile a non-file tab keeps the pinned note |
| View state restored after open | That note, unless the panel follows a review |

Subscriptions and timers: the review store subscription and the DataLayer
effect are owned by the controller and loader and disposed in `onClose`; the
`editor-change` listener is registered through the view, so Obsidian drops it
when the view unloads. The reload (100 ms) and rescan (500 ms) timers are
cleared on close.

Loads are ordered by the panel's `renderVersion`. Every load bumps it, also
those that end early for a non-markdown or deleted note, and closing the view
invalidates loads still in flight. An editor rescan never bumps the version, so
a full load started meanwhile wins, and a rescan whose note is no longer shown
is dropped.

Behaviour changes, each covered by a test in
`tests/views/panel/flashcard-panel-view.test.ts` marked "Regression" that
failed against the previous implementation:

- A review card whose source note was deleted no longer leaves the panel in
  follow mode showing an unrelated note (with "Open Source Note" and FSRS reload
  suppression active).
- A persisted view state applied after `onOpen` no longer replaces the review
  source. Obsidian calls `setState` after opening a view, so this happened when
  the panel was restored during a review.
- Switching from a note to a non-markdown file, or closing the panel, while a
  load was in flight no longer publishes the old note's cards.
- A slow editor rescan no longer writes one note's uncollected count to another.
- Header actions are rebuilt only when status or file change. The selector
  returned a new object each time, so every store change (review, search) used
  to remove and re-add them.

Tests: `flashcard-panel-view.test.ts` characterizes the view against an in-memory
app, store and DataLayer (`panel-test-harness.ts`), including desktop and mobile,
start and end of review, rapid switching, close during load, reopening, and the
refresh policy. `panel-actions.test.ts` and `panel-csv.test.ts` cover delete with
undo, clipboard, and CSV escaping of commas, quotes, and line breaks.

Remaining risks:

- Undo after "Delete all" calls `commandService.undo()`, which undoes the most
  recent command, not necessarily the deletion. Six places use this pattern;
  it needs a command-scoped undo in `CommandService`.
- `usePanelActions` keeps its own delete, copy, and export handlers for the
  in-panel menu, which duplicate `PanelActions`. Merging them means passing
  `PanelActions` into the Preact tree.
- `PluginEventHandlers.updatePanelView` still decides when to leave or
  re-enter follow mode on leaf changes; it only calls the public API.
- Not yet exercised in a running Obsidian: desktop and mobile panel while
  switching notes and during a review, restore after restart, header actions.

## Plugin bootstrap

`main.ts` remains the Obsidian facade. The implementation lives in
`packages/obsidian/src/plugin/runtime`:

- `PluginRuntime` orders startup and owns the shared-vault sync lifecycle.
- `StorageLifecycle` constructs the core app and its platform adapters.
- `SyncLifecycle` owns device lock, background scheduler, coordinator wiring,
  and cloud sync initialization.
- `FeatureRegistry` registers views, commands, settings, and event handlers.
- `ViewNavigator` opens plugin views and editors.
- `StudySessionLauncher` validates and launches review sessions.
- `TemporaryStudyDeckService` creates, rebuilds, and manages custom study decks.
- `ImportExportCoordinator` coordinates import and export dialogs.
- `NoteActions` implements actions against the active note.
- `createAssistantService` composes assistant execution and presentation.

Startup order remains core initialization, device/store initialization, sync
wiring, then feature registration. Existing `PluginInitializers` continues to
provide device/store setup; the new modules do not reorder its layout-ready
callbacks. Startup sync remains deferred until layout readiness. The local API
retains its platform and unload guards.

## Assistant

`AssistantService` is a facade over queue and thread operations.

Execution and persistence live under `services/assistant`:

- `AssistantRepository` resolves task/thread persistence and invalidates queries.
- `AssistantThreadService` creates and updates conversations.
- `AssistantQueueRunner` claims tasks, streams progress, and records completion,
  failure, or cancellation.
- `AssistantWorkflowRunner` selects free-form, generation, polish, or fact-check
  execution.
- `FactCheckWorkflow`, `GenerationWorkflow`, and `CardPolishWorkflow` implement
  the respective workflows.
- `AssistantResultApplier` writes accepted changes and returns notification data.
- `apply-pending-proposals` belongs to the application service layer. Its former
  UI module re-exports it for compatibility.

`features/assistant/ui/AssistantCompletionPresenter` presents workflow results,
offers draft actions, and opens the review UI. The plugin runtime injects the
completion, error, and confirmation callbacks; workflow and queue modules do not
open dialogs directly.

`streaming-flashcard-adapter` implements the small streaming interface explicitly.
It converts file references to paths before calling the core frontmatter API,
and normalizes optional question/answer values. This replaces the double type
assertion that hid the mismatch.

## FlashcardManager

The existing manager delegates to services in `packages/core/src/flashcard`:

| Service | Responsibility |
| --- | --- |
| `NoteCreationService` | Creating notes and generated cards |
| `NoteMutationService` | Field/comment updates and note type changes |
| `ImageOcclusionReconciler` | Image occlusion fields and card reconciliation |
| `CardLifecycleService` | Cascade deletion and reviewed-card bookkeeping |
| `CardAssignmentService` | Assigning cards to source notes |

Public parameter/result types live in `flashcard.types.ts` and are re-exported
from the manager module. Dependencies read the current store and repository so
later `setStore`, event bus wiring, and session persistence wiring continue to
work. Query and repository APIs retain their existing specialized services.

## ProjectsTab

`ProjectsTab` renders selection controls and composes `ProjectTree`.
`useProjectsTabModel` supplies expansion, filtering, virtualization, selection,
bulk operations, drag-and-drop, and the shared `ProjectActions` object.

`ProjectRow` and `ProjectNoteRow` render individual rows.
`useProjectRowActions` and `useProjectNoteActions` build their contextual
actions. `ProjectDropZones` renders the root drop target. Note row keys now use
the project and note paths to distinguish identical note names.

## Package boundaries and verification

The note-priority tests import the existing core dashboard types. The forget
integration test now lives in the Obsidian package because it exercises panel
badges. Obsolete Obsidian imports/mocks were also removed from core tests.
`packages/core/tests/architecture/platform-boundary.test.ts` guards that boundary.

Verification performed:

- Full Vitest suite: **282 files, 3246 tests passed**.
- Biome check for all 83 files changed or added by this refactor: passed.
- Production build, including TypeScript checking: passed.
- `git diff --check`: passed.

Commands:

```sh
bun run test --maxWorkers=4
VAULT='' bun run build
```

The HTTP integration tests require permission to listen on localhost.
Bun loads the repository's `.env`, so an explicitly empty `VAULT` is needed for
a build without installation. Unsetting the variable alone allows the configured
vault target to be loaded again. The initial production build refreshed the
configured development plugin in the Learning vault.

New regression tests cover draft transitions, immediate editor commits,
duplicate submission, save failures, creation undo, edits during asynchronous
operations, the streaming adapter, type-in grading, top-up, bootstrap order,
and the core package boundary.

Interactive Obsidian smoke testing remains useful for keyboard handling in
popout windows, mobile keyboard layout, and dragging project rows; those surfaces
were not exercised in a running Obsidian UI during this change.
