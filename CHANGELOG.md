# Changelog

## 1.9.5 (2026-06-03)

### Features

- **settings:** new "Learn how to learn" newsletter — subscribe from Settings → General to get learning essays and release updates

### Improvements

- **dashboard:** extracted today progress segment calculation (more accurate progress bar split)

### Bug Fixes

- escape key handling in editors
- cloze sibling scoping
- selection toolbar AI gating

## 1.9.4 (2026-05-28)

### Features

- **obsidian:** use filled play triangle on dashboard study buttons
- **metrics:** add young/mature split and range picker to workload forecast
- **obsidian:** migrate note type + card types editors to popout views
- update
- **obsidian:** open quick note editor in popout window
- **fsrs:** balance newly scheduled reviews
- add width settings

### Improvements

- **fsrs:** use deviation threshold for load balance recommendation

### Bug Fixes

- **plugin-review:** strip Tailwind @supports color-mix wrappers in post-build
- **plugin-review:** replace color-mix with relative-color and drop Tailwind preflight

## 1.9.3 (2026-05-21)

### Features

- **Per-preset output language** — every generation preset (including the built-in ones) now exposes an **Output language** dropdown. Pick a target language once and the suffix is appended to the system prompt for both streaming and chunked generation, so you no longer need to bake "Reply in Polish" into every prompt or fork a built-in just to switch languages.

### Improvements

- **LM Studio and Custom keys unlock Selection Toolbar generation** — the panel empty-state and selection actions used to check only Pro / OpenRouter keys, silently locking out LM Studio and Custom-provider users. Both now route through the shared `hasAIKey` helper.
- **Obsidian reviewer CSS warnings eliminated** — removed remaining `:has()`, `mjx-container`, and `text-decoration` warnings and shipped a fresh `styles.css`.

### Bug Fixes

- **Plugin correctly declares itself desktop-only** — `manifest.json` now sets `isDesktopOnly: true` to match actual runtime requirements (SQLite WASM, filesystem-backed backups, native fetch streaming). Mobile was never validated; users no longer get a misleading install on iOS/Android.

## 1.9.2 (2026-05-19)

### Improvements

- **License switched to PolyForm Strict 1.0.0** — replaced the custom source-available license with the canonical [PolyForm Strict 1.0.0](https://polyformproject.org/licenses/strict/1.0.0/) text so GitHub's license detector can recognize the repository. The restrictions are equivalent (noncommercial use only, no redistribution, no modifications, no competing products). Commercial licensing remains available — see the `## License` section in the README.

## 1.9.1 (2026-05-19)

### Bug Fixes

- **No more dynamic `<script>` tags during Anki import/export** — replaced `jszip` with `fflate` in the `.apkg` builder and parser, eliminating the four dynamic script-element creations the Obsidian reviewer flagged (root cause was jszip's bundled `immediate` polyfill)

### Improvements

- **Signed release artifacts** — the GitHub Actions release workflow now generates build provenance attestations for `main.js` and `styles.css` via `actions/attest-build-provenance@v2`, so downloads can be verified against the upstream build
- **Explicit source-available license** — added the SPDX identifier `LicenseRef-True-Recall-Source-Available-1.0` to the `LICENSE` header and `package.json`, and expanded the License section in `README.md` to clarify the terms

## 1.9.0 (2026-05-16)

### Improvements

- **Selection Toolbar promoted to first plugin** in the Plugins tab so the most-used entry point sits at the top of the list
- **"Open Simulator" button no longer wraps** in the FSRS visualization settings section
- **README documents periodic timers and on-demand network calls** so anyone auditing the plugin can see at a glance what runs in the background and when (all timers are local-only file writes; network calls are limited to a one-time release-notes fetch and opt-in AI features)

### Bug Fixes

- **`fundingUrl` repointed to GitHub Sponsors** — the previous Buy Me a Coffee URL was returning HTTP 404 in the Obsidian Community Portal automated review
- **`sqlite3.wasm` no longer uploaded as a release asset** — the SQLite WebAssembly module is statically embedded into `main.js` by esbuild; shipping the standalone file in the release archive was redundant and tripped the portal's "unexpected files" check

### Breaking Changes & Migration

- **Gamification Widgets plugin removed** — the six widgets (Achievements, Answer Streak, Countdown, Maturity, Progress, Ratings) and their codeblock processors are gone. Replace any `{achievements}`, `{progress}`, `{streak}`, `{countdown}`, `{maturity}`, or `{ratings}` codeblocks with equivalents from the Dashboard Codeblocks or Status Bar Widget plugins

## 1.8.1 (2026-05-09)

### Bug Fixes

- **ui:** toggle switches don't respond to clicks

## 1.8.0 (2026-05-07)

### Features

- **LM Studio as a first-class AI provider** — LM Studio joins Pro / OpenRouter / Custom in the **AI Provider** dropdown with auto-discovered models, configurable base URL, and an optional API key
- **Per-plugin LM Studio model overrides** — AI Flashcard Generation and Card Polish each expose their own LM Studio model selector, with fallback to the global LM Studio model when no override is set
- **Generation preset context options** — two new opt-in toggles per preset, **Include source note** and **Include related cards**, enrich the prompt with the host note's body and sibling cards from the same note
- **Card Polish moved to BYOK** — Card Polish now activates with any AI key (OpenRouter BYOK, LM Studio, Custom, or Pro), not just Pro
- **Card AI: SPLIT mode** — the system prompt now recognizes three explicit modes (`EDIT`, `SPAWN`, `SPLIT`); presets with "split / decompose / break apart" wording correctly decompose one card into N atomic cards instead of rewriting the source
- **Card AI: inline-edit preview** — the preview modal now uses an embedded CodeMirror editor for every field. Tweak proposed edits and new cards before clicking Accept
- **Card AI: "Delete after applying" toggle** — when an AI run produces multiple new cards (typically SPLIT), the source card is shown alongside an opt-in delete toggle
- **Card AI: note-type aware prompts** — requests now ship the note type's name and field schema to the LLM, reducing field-name mistakes for custom note types
- **Image-click toolbar configuration** — the image-click toolbar (open in IO editor, quick-add, etc.) now has its own button-configuration section in `Settings → True Recall → Plugins → Selection Toolbar`
- **Type-in grading context** — the AI grader now sees the source note and related cards when scoring typed answers, reducing false negatives on context-dependent questions
- **FSRS preset picker in dashboard** — "Set FSRS preset" is now exposed directly on the note context menu (previously only on projects)

### Improvements

- **Targeted review session updates** — mid-session card mutations no longer trigger a full session rebuild; the engine applies a targeted mutation that preserves card position and response timing
- **Review session refactor** — review logic split into a platform-agnostic `ReviewSessionEngine` and an Obsidian-side `ReviewSessionController`. Visible side-effects: leech notifications respect Anki-style thresholds (8 / 12 / 16 lapses), and cramming sessions no longer show phantom "leech suspended" toasts
- **Card AI runtime moved to plugins/shared** — card-ai service, runner, prompts, and context collection moved out of `@true-recall/core` so non-plugin code (CLI, MCP) no longer pulls in plugin-only logic

### Bug Fixes

- Fixed Card Polish auto-apply not preserving cursor position after a rewrite
- Fixed selection toolbar URLs not normalizing in non-review mutation flows
- Fixed code blocks in question content losing their block layout in the review view
- Fixed scoped per-preset progress reporting on the dashboard / review snapshots and removed the stale project `healthPct` metric
- Fixed CI release pipeline regression where the changelog extractor's awk range exited at the start heading

### Breaking Changes & Migration

- **TTS post-processing removed** — the entire text-to-speech pipeline (OpenAI voices, autoplay, per-note synthesis) is gone. Generation presets no longer carry `tts` config; existing entries are dropped during settings migration
- **Card Healing plugin removed** — the "Healing Flashcards" plugin (auto-generate corrective cards from lapse patterns) is gone. Card AI's SPLIT mode covers most decomposition use-cases; for repair, use Card Polish presets
- **Image post-processing removed from generation presets** — the per-preset image generation step is gone. Generation presets no longer carry an `image` config; existing entries are dropped during settings migration
- **`providerType` is now the source of truth** — the AI provider is selected explicitly via a `providerType` field (`pro` / `openrouter` / `lmstudio` / `custom`). For users upgrading from 1.7, `providerType` is derived from your existing `proKey` / `openRouterApiKey`, and `aiTier` is kept in sync automatically

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

