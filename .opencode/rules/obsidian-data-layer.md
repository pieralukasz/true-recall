## Reactive Data Layer

All SQL-backed UI data in the Obsidian package flows through the DataLayer in `packages/obsidian/src/data`.

### Model

`SQL -> DataLayer cache -> Preact signals -> UI`

### Reading

- Components should use `useQuery(...)`
- Non-component code should use `getDataLayer().get(...)` or `.signal(...)`

### Writing

- UI writes should go through `mutate(...)`
- Core services emit mutation events which the plugin bridge maps to DataLayer invalidation

### Rules

- Do not create parallel in-memory copies of SQL-backed data outside the DataLayer cache
- Avoid bypassing the invalidation model for convenience
- Zustand is for UI state, not for card collections or canonical SQL-backed entities
- Review hot paths should preserve the existing patch-first approach instead of forcing broad reloads

### DataLayer lifecycle

- `DataLayer.register()` executes the loader callback immediately to populate the initial signal value
- `invalidateGroups(groups)` re-executes every loader whose registration includes a matching group
- If data a loader depends on is not ready at registration time, the signal will hold stale values until an invalidation reloads it

### Two invalidation paths

There are two separate mechanisms that trigger DataLayer invalidation. Both must stay in sync.

1. **Domain event bus → `wireDataLayer`** (`wire-data-layer.ts`)
   Core services emit typed domain events (`card:added`, `card:updated`, `card:removed`, `card:reviewed`, `cards:bulk`, `hierarchy:changed`, `settings:changed`). `wireDataLayer` maps each event to a set of query groups and calls `invalidateGroups`. This path handles background changes from core logic.

2. **UI-initiated `mutate(type, fn)`** (`mutate.ts`)
   UI code calls `mutate("card:suspended", () => { ... })` which wraps the write in a `DataLayer.mutate()` call. The `MUTATION_GROUPS` map in `queries.ts` determines which groups to invalidate. This path handles direct user actions in the plugin.

These maps are independent. `MUTATION_GROUPS` has types like `card:suspended`, `card:buried`, `cards:imported` that are NOT domain events and never flow through the event bus. `EVENT_TO_GROUPS` only handles actual domain events emitted via `bus.emit(...)`.

### Invalidation rules

- Always use `G.*` constants for group names, never hard-coded strings like `"cards"`
- When calling `invalidateGroups` after a hierarchy change, include at minimum: `G.CARDS`, `G.BROWSER`, `G.DASHBOARD`, `G.PANEL`, `G.REVIEW`
- Every `hierarchyService.invalidateGraph()` call must be paired with either `mutate("hierarchy:changed", () => {})` or an equivalent `dataLayer.invalidateGroups(...)` call — `invalidateGraph()` alone only clears the in-memory graph cache without notifying the DataLayer
- `FrontmatterIndexService.rebuildIndex()` uses `silent = true` internally, so it does not fire field-change callbacks and does not emit domain events — any code that calls `rebuildIndex()` must manually trigger DataLayer invalidation afterward

### FrontmatterIndex and enrichment timing

- Card enrichment (`SourceNoteService.enrichMeta/enrichCard`) resolves `sourceUid` → note path via `FrontmatterIndexService.getFileByValue()`
- The index is empty at plugin load time; it is populated by `rebuildIndex()` inside an `onLayoutReady` callback
- `DataLayer.register()` runs during `initializeCardStore()`, before `onLayoutReady` fires — so the initial signal values contain cards with empty `sourceNoteName` and `sourceNotePath`
- A second `onLayoutReady` callback in `PluginInitializers` invalidates `G.CARDS` after the index is populated to fix this
- Obsidian fires `onLayoutReady` callbacks in registration order, so registration order matters for correctness
- Any new code that reads enrichment data at startup must account for the index possibly being empty

### Query groups

| Group | Queries affected | When to invalidate |
|-------|------------------|--------------------|
| `G.CARDS` | `Q.ALL_META`, `Q.ARCHIVED_UIDS`, `Q.GLOBAL_COUNTS`, `Q.CARDS_BY_SOURCE`, `Q.NOTE_STATUS` | Any card CRUD, hierarchy change, settings change |
| `G.BROWSER` | Browser-specific queries | Card CRUD, bulk ops, hierarchy change |
| `G.DASHBOARD` | Dashboard-specific queries | Card CRUD, reviews, hierarchy change |
| `G.PANEL` | Panel-specific queries | Card CRUD, bulk ops |
| `G.REVIEW` | Review-specific queries | Suspend/bury/bulk ops, hierarchy change |
| `G.STATS` | Stats-specific queries | Card CRUD, reviews, bulk ops |
| `G.SETTINGS` | `Q.SETTINGS` | Settings change |
