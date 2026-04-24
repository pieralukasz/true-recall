# Changelog

## 1.7.0 (2026-04-24)

### Features

- New **Plugin architecture** -- 12 built-in plugins with tier-based gating (free / BYOK / Pro), each independently toggleable from a new **Plugins** tab in settings: Image Occlusion, AI Flashcard Generation, Knowledge Base, Type-in Mode, Healing Flashcards, Link Status Indicators, Dashboard Codeblocks, Gamification Widgets, Status Bar Widget, AI Anki Import, Selection Toolbar, and Card Polish
- **Card Polish plugin** -- transform cards mid-review or inside the Add Flashcard modal: fix formatting, simplify wording, or run custom instructions. Per-preset auto-apply or preview, per-preset review hotkeys, optional source-note and related-card context
- **AI Flashcard Generation plugin** -- unified preset-driven generation from notes, selections, and highlights, with per-preset TTS and image post-processing, a Pro-hosted built-in preset, and custom presets with source-note context
- **Generation presets system** -- full CRUD for AI generation templates via the new **AI Generation** settings panel, CLI, and MCP. Each preset binds to a note type, owns a single free-form `prompt`, and optionally configures TTS voice / autoplay and image generation targets
- **Card Preview modal** -- click **Preview** on any Flashcard Panel card to see front and back with an interactive grading flow, smooth view-transition animations, and keyboard shortcuts
- **Basic Pro prompt overhaul** -- rewritten Pro generation prompt with 7 core rules and 6 few-shot examples, plus automatic injection of existing same-note cards so new generations avoid duplicating what you already have
- **CLI preset management** -- new commands `list_generation_presets`, `get_generation_preset`, `create_generation_preset`, `update_generation_preset`, `delete_generation_preset`, and `generate_flashcards_with_preset`
- **MCP preset tools** -- matching MCP tools expose the same preset CRUD and preset-based generation to AI assistants

### Improvements

- **Selection Toolbar is now a plugin** -- the floating toolbar extracts into its own plugin with its own activate/deactivate, and its config moves under the plugin's panel. The legacy `selectionToolbarEnabled` global setting is gone; toggle the plugin instead
- **Cmd/Ctrl-click a panel card to enter selection mode** -- quickly start bulk operations from the Flashcard Panel without the context menu
- **Wand button in Add Flashcard modal** -- dispatches a `card-polish` event so your Card Polish presets run in the modal, not just in review
- **Day rollover fixes UI immediately** -- at `dayStartHour` boundary, the status bar, dashboard, and panel now invalidate on window focus or tab visibility change, so due / new counts update without a manual refresh
- **Settings UI is reactive** -- `useSettings` and `usePreset` hooks subscribe to `settings:changed` so UI updates two-way when settings change from any source
- **Preview modal polish** -- compact button bar in preview mode, cleaner dividers, per-side body styling, and PRO badge pinned on the Basic Pro preset
- **AI parse tolerance** -- Card Polish and generation flows tolerate JSON embedded in prose or code fences (```json ... ```), and surface user-visible notices on parse failures instead of failing silently
- **Post-processing error surfacing** -- TTS and image post-processing errors invalidate the DataLayer and show a user-visible notice; audio playback errors are logged separately with context preserved
- **Preview disabled plugins** -- the Plugins tab now lets you expand any plugin's accordion to read its description and settings panel before flipping the enable toggle, and each plugin description is now 2-3 sentences covering the core capabilities

### Bug Fixes

- Fixed **CommandSuggestModal** and **PresetSuggestModal** resolving `null` when an item was selected -- choices are now correctly captured via `queueMicrotask`
- Fixed stale `defaultGenerationPresetId` after migration -- settings now self-heal when the referenced preset is gone
- Fixed **pin / wand icons** not rendering in the Add Flashcard modal -- `Clickable` now forwards its ref so `useIcon` can mount correctly
- Fixed Pro prompt not falling back when user custom prompt was empty
- Fixed CardAI apply flows so **"AI changes applied"** notifies only on actual mutations (not on silent `ReviewCardTarget` advances)
- Fixed **QuickNoteEditor** wand showing unhandled rejections -- `resolveSourceUid` now has a proper `.catch` with a user-visible notice
- Fixed stale UI when CardAI invalidation fires (DataLayer invalidation on TTS/image errors)

### Pro-gating Changes

- **Per-plugin tiers** -- plugins declare `free`, `byok`, or `pro`; the **Plugins** tab shows a Pro badge on Pro-only plugins and gates activation accordingly

### Breaking Changes & Migration

- **Generation preset shape flattened** -- `GenerationPreset` drops `fields` (per-field config), `customPrompt` (renamed to `prompt`), and `isPinned`; adds `builtin` and `image`; renames `isPro` -> `requiresPro`. Settings migration lossy-merges legacy preset fields into the new flat `prompt` field
- **`flashcardGeneration` settings bucket removed** -- the legacy bucket is dropped by migration; generation config now lives on each preset
- **Built-in presets are now locked** -- you can't edit or delete built-in presets from the UI; copy one to customize
- **`cardPolish.presets` renamed to `userPresets`** -- built-in polish presets are dropped and replaced by the shared Card Polish plugin defaults; migration happens automatically on first run
- **`selectionToolbarEnabled` setting removed** -- toggle the **Selection Toolbar** plugin instead

## 1.6.2 (2026-04-09)

### Features

- Cross-device sync on startup -- new toggle in settings to automatically sync your flashcard database when the plugin loads
- Archived cards filter in Statistics -- toggle to include or exclude archived projects from FSRS stats, workload forecasts, and dashboard counts
- Smarter knowledge search -- RAG search now supports temporal filtering, source grouping, and improved chunking for better results
- Per-note CLI commands -- `note_stats` and `note_cards` let you inspect card counts, states, and scheduling details for individual notes

### Bug Fixes

- Sync reliability -- restored last-write-wins guards for sync upsert methods, preventing potential data overwrites during cross-device sync
- Review images -- images in the review view are now properly centered
- JSON parsing -- added error handling for malformed JSON in card data, with clearer error messages for missing cards

### Improvements

- Review queue internals -- modularized queue construction and standardized error handling across review services
- Import organization -- configured biome import groups across all packages

## 1.6.0 (2026-04-03)

### Features

- Added Note Review -- schedule entire notes for spaced repetition with a toggle, with configurable frontmatter display and editable content during review
- Added Selection Toolbar -- select multiple flashcards across any view for bulk AI actions, with configurable editor and global toolbars, drag-to-reorder, and custom command support
- Added Anki Import mapping phase -- manually map fields between Anki and True Recall with AI-assisted classification, dropped fields tracking, and HTML-to-Markdown conversion
- Added project management actions to the Dashboard -- export, create sub-projects, dissolve, and delete projects via context menu; assign notes to projects; bulk selection
- Added explicit project marker -- convert any note into a project in-place using `project: true` frontmatter
- Added custom review keybindings -- remap Space, Again, Hard, and Easy to your preferred keys
- Added note creation modal with project assignment and folder picker
- Enabled Knowledge Base for all Pro users
- Added Claude Code Skill download link in settings

### Bug Fixes

- Fixed daily reviewed stats incorrectly counting cards when reverting a new card review
- Fixed dissolve not removing the `project: true` marker from explicit projects
- Fixed silent failures when deleting a project -- errors are now surfaced
- Fixed note archived status not always populating, causing incorrect context menus
- Fixed frontmatter index not syncing before dashboard invalidation, causing stale project data
- Fixed dashboard not reacting to manual `project` frontmatter changes

### Improvements

- Renamed Local API setting from "Local API (MCP)" to "Local API"
- Improved review UI performance with incremental state patching instead of full reloads
- Anki imports now create the full deck hierarchy with standardized leaf node naming
- Fixed data layer invalidation race conditions for more reliable cache updates

