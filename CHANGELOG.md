# Changelog

## Unreleased

### Bug Fixes

- **"View plans" and "Upgrade" links open the real pricing page.** They pointed at `truerecall.com`, a domain True Recall does not use, so anyone curious about Pro landed nowhere. All Pro links now derive from the configured web URL
- **Mobile no longer stalls on "plugin is taking long to load" because of iCloud.** In Cloud Sync and single-device modes the per-device database now lives in `.true-recall/local.nosync/`, which iCloud does not sync. The desktop stops uploading a 60 MB file on every flush, iCloud stops producing conflict copies, and iOS can no longer evict the file the plugin must read at startup. Shared Vault mode keeps the database in `.true-recall/` as before. The file is moved automatically on the next start; if the move fails the old location keeps working
- **No full database rewrite on every startup or idle sync tick.** Loading a saved database, seeding builtin note types, refreshing their templates, writing the device label, empty sync transactions and unchanged sync watermarks no longer mark the database dirty. Before, the desktop rewrote a 60 MB file every minute while Cloud Sync idled, and Android froze with "Obsidian isn't responding" during the rewrite right after startup
- **What's New footer fits on phones.** The buttons wrap instead of running off the screen
- **A database moved out of iCloud keeps its contents on iOS.** The move to `.true-recall/local.nosync/` now copies the file and deletes the original only after the copy is verified. Renaming an evicted iCloud placeholder into a folder iCloud ignores left a file whose bytes could never be fetched; a file that cannot be read right now stays where it is
- **A second device no longer fails its first Cloud Sync with "FOREIGN KEY constraint failed".** The server pages changes by revision and a device pushes rows sorted by their timestamps, so a review log routinely arrived pages before the card it belongs to, and a card before its note. Such rows are now parked in the database until their parent arrives and applied right after, so a phone can download a collection it has never seen
- **The first Cloud Sync on a phone survives a dropped connection.** Progress is committed after every page pulled and every batch pushed, so a retry resumes where it stopped instead of sending and receiving the whole collection again

### Improvements

- **Pro is explained where you hit its limits.** The disabled Typed answers and Image Occlusion controls link to the docs page that lists exactly what Pro includes, and the toolbar's locked AI buttons mention the free Pro trial next to the bring-your-own-key option
- **A device that inherited Cloud Sync from the vault is told to sign in.** Settings travel with the vault, the sign-in does not; the Dashboard now shows a bar with a Sign in button when Cloud Sync is on but this device holds no session, and Settings → Integrations says the same instead of "Account required"
- **Cloud Sync polls every five minutes instead of every minute.** Syncs after each change, at startup and on foreground are unchanged; the timer only catches edits made on other devices, and the slower beat cuts request volume fivefold
- **Device limits.** A free account syncs 2 devices, Pro 5. The limit is checked at sign-in and a device that signs out frees its slot; Settings → Integrations explains this next to the Sign in button
- **Shared vault is marked legacy.** Its settings entry now says why Cloud Sync is the better choice: full-file uploads, conflict copies, slow downloads on phones, per-device setup
- **Sync errors are readable.** Tapping "Sync error" under the Dashboard shows the message and retries; Settings → Integrations → Sync shows the last result with a Sync now button
- **Start fresh on a device.** Settings → Data → Device database can delete this device's database so a connected device downloads the collection again on the next start
- **You can tell which plan you are on.** The Dashboard shows a one-time, dismissable bar for users without any AI key explaining what is free and where AI comes from; the empty Dashboard says the same; the What's New dialog states your current level (Free, BYOK or Pro) with a link to what Pro adds; and Settings → General → About gains a Plan row with View plans or Manage subscription

## 2.4.1 (2026-09-01)

Cloud Sync is now dependable. This release fixes every reliability gap found in a full review of the 2.4.0 sync path, from the server exchange down to on-device recovery. If you sync more than one device, update all of them.

### Bug Fixes

- **No more skipped changes between devices.** The server now serializes each account's sync exchanges, so two devices syncing at the same moment can no longer make each other's changes invisible
- **Pulled data is no longer echoed back.** Rows applied from the cloud are excluded from the next push. This also protects the upload watermark from devices with a fast clock, which could previously stop uploads silently
- **Every device converges after simultaneous edits.** The device tie-breaker now applies to conflicts pulled in any later sync, not only in the sync that pushed the losing edit
- **Interrupted syncs recover fully.** Daily stats rebuild and FSRS replay owed to changes applied before a network failure are completed by the next successful sync
- **Large collections always push.** Push batches are split by payload size, so an oversized request can no longer wedge sync permanently
- **Switching sync modes is safe mid-session.** Enabling Cloud Sync stops the shared-vault transport immediately; the two transports never run concurrently
- **Sign-out is verified.** If the server cannot revoke the device token, your session is kept and an error is shown instead of leaving a live credential behind
- **Session expiry is visible.** When the server rejects the device token, Settings shows the sign-in prompt again instead of a connected account that silently stops syncing

### Improvements

- **Smoother grading while syncing.** The duplicate-card scan now runs only when a sync actually pulled changes, removing a whole-collection scan after nearly every review
- **Newsletter, one click away.** The What's New dialog now has a Subscribe button for the learning newsletter

## 2.4.0 (2026-08-31)

Cloud Sync gives every True Recall account a direct, incremental path between devices. Notes, note types, cards and review history move independently of the vault files, while deterministic review replay and duplicate merging keep concurrent study sessions convergent. Shared-vault sync remains available for people who prefer iCloud, Obsidian Sync or another file provider.

### Features

- **Account-backed Cloud Sync.** Sign in through the True Recall website, return directly to Obsidian on desktop or mobile, and enable sync from Settings → Integrations
- **Incremental two-way exchange** for notes, note types, cards and review logs, including tombstones, paginated cursors and per-device provenance
- **Deterministic conflict handling.** Concurrent reviews are replayed through FSRS and duplicate cards converge instead of multiplying
- **Device-aware sessions** stored in Obsidian SecretStorage, with explicit sign-out and server-side revocation

### Improvements

- **Settings polish:** more consistent spacing, control widths, button placement and responsive layouts across the settings app
- **Cloud status:** account, progress, last-sync result and actionable errors are visible without opening developer tools

### Bug Fixes

- **CSS compatibility:** flattened `color-mix()` fallbacks retain their original hue in Obsidian versions and themes that need the postprocessed color
- **Mobile authorization:** production links use the canonical `www.truerecall.app` host so Android returns to Obsidian without losing the exchange request to a redirect

### Compatibility

- Minimum Obsidian version is now **1.11.4**, required for secure session storage through the official SecretStorage API

## 2.3.2 (2026-08-30)

This maintenance release clears the actionable Obsidian plugin review findings, refreshes vulnerable dependencies, and keeps startup responsive while cross-device sync runs in the background.

### Bug Fixes

- **sync:** defer the startup merge until the workspace layout is ready, so large or cloud-hosted databases do not block Obsidian from loading
- **storage:** use Obsidian's per-vault data APIs for device identity and typed-answer state, with one-time migration of existing local data

### Improvements

- **compatibility:** adopt searchable settings definitions, popout-safe timers, supported CSS directives, and current settings migrations
- **dependencies:** update and constrain transitive packages to clear the dependency vulnerability scan
- **review:** soften the typed-answer field styling

## 2.3.1 (2026-08-30)

### Features

- **fsrs:** keep load-balanced due previews monotonic across ratings
- **presets:** disabled flag hides Card Polish presets from run surfaces

### Improvements

- **review:** minimal type-in field and boxless assessment panel

### Bug Fixes

- **grading:** enforce a single verdict-JSON contract for type-in grading

## 2.3.0 (2026-08-23)

Typed answers get a real assessment this release: grading was rebuilt around a teacher verdict, with its own model setting and its own panel in review. Notes also start keeping score of their own edits, separating what you rewrote by hand from what the AI rewrote. And the plugin no longer hangs on load on a device that has never opened the vault before, which is what made it unusable on a phone.

### Features

**Type-in review**

- **Teacher-verdict grading.** Typed answers are assessed as a verdict instead of a bare similarity score, with a redesigned assessment panel and reworked rating buttons and keyboard flow
- **A separate grading model**, configured on its own in AI provider settings rather than borrowed from generation
- **Context excerpts feed the grader**, so the assessment sees the surrounding note instead of the field alone

**Cards**

- **Per-note edit counters**, split between what you rewrote by hand and what AI rewrote. They move only when the content actually changes, so saving an untouched field on blur does not read as an edit
- **Edits and AI Edits columns** in the card browser, sortable and hidden by default, plus `prop:edits` and `prop:aiedits` in search
- **Counters merge with MAX across devices** rather than last-writer-wins: they are tallies no single device owns, so LWW would drop the other device's edits
- **Exposed through the local API and the CLI**, where `edit_source` lets an agent mark its own rewrites as AI

**Editor**

- **Mod+U and Mod+Shift+C work in the embedded editors.** The formatting toolbar advertised both, but Obsidian ships no underline command and the cloze wrap is a True Recall concept, so neither shortcut reached a handler
- **A #card button in the selection toolbar** that highlights the selection and tags it, so highlights waiting to become cards stay findable in search

### Bug Fixes

- **The plugin no longer hangs on load on a device without its own database.** Startup ran the full device discovery and then awaited the database selection modal, both inside onload, and Obsidian withholds the rest of its startup until onload resolves. Discovery was equally costly on its own: it read every candidate database file in full and deserialized it into SQLite purely to report a card count. Card counts are now opt-in per call and skipped above 24 MB, and the modal waits for the workspace to be ready
- **Bulk card polish asks before spending.** It queued one paid AI request per selected card with no prompt, while the bulk delete right next to it asks first

## 2.2.0 (2026-08-20)

True Recall runs on phones now, and it stops assuming there is only one of you. The desktop-only guard is gone, review, the panel, the dashboard and the quick editor all have real phone layouts, and the database merges work from two devices by replaying the review log instead of letting whoever saved last overwrite the other. Persistence was hardened alongside it: writes land atomically and a truncated file is salvaged on load rather than costing you a session. The review queue also gained R-Mode, a continuous ranking by retrievability in which nothing is ever late.

### Features

**Mobile**

- **Mobile platform unlocked.** The plugin loads on phones and tablets, with a central capability matrix deciding what each form factor gets instead of scattered platform checks
- **Review on a phone.** A grade bar integrated with the view header, the answer sitting directly under the separator, inline today counts, and a single overflow menu in place of a crowded toolbar
- **Current-note flashcards in the panel** are fully usable on a phone, with a dedicated mobile header
- **Quick editor mobile save flow** with a sticky footer and an explicit Done button
- **Simplified statistics on phones**, dropping the chart density a phone screen cannot show honestly
- **Non-streaming fallback for AI requests on mobile**, so a request that cannot stream still completes
- **Quick-access commands** for the common actions, with dead UI paths removed

**Cross-device sync**

- **Sync coordinator** with foreground sync and per-device locks, so two devices no longer race each other into the same database file
- **Deterministic FSRS replay from the review log.** Concurrent reviews merge by replaying scheduling from the log instead of last-write-wins, so grading the same card on two devices converges on one correct state
- **Duplicate cards created concurrently converge** instead of accumulating
- **Background merge** when the remote database changes, plus reporting of changed card ids so open views refresh precisely rather than wholesale
- **Review provenance columns and a preview review kind** in the schema, with a version gate and null-safe remote binds
- **Device id lives only in device-local storage**, so it never travels with the synced database
- **Save and sync status chip** on the dashboard

**Review and cards**

- **R-Mode.** An alternative queue that replaces due dates with a continuous ranking by retrievability: a card is either worth reviewing right now or it is not, with a comfort mix, a retrievability ceiling and generation policy controls
- **Custom study top-ups, review comments and card moves** during a session, with top-up failures handled instead of ending the session
- **Undo across every editing path.** Adding, editing, deleting, moving and switching note type are all undoable, undo of a delete revives the card, and Cmd+Z after Save and Add restores the fields
- **Delete shortcut in review sessions**, and review and lapse counts shown on the answer side
- **Card Polish in the panel**: a polish preset list on the card detail, a wand button that opens the AI workspace on the selected card, and a bulk polish action over a whole selection, backed by a preset API and CLI commands

**AI and generation**

- **gemini-3.7-flash is the default BYOK model**
- **Image embeds survive chunking when the AI works on a selection**, so a question about the image still sees it
- **allowEmptyAnswer preset flag** for one-sided cards
- **Backups stay out of iCloud transfer** by living in a .nosync folder

### Bug Fixes

- **Crash-safe database writes.** The flush wrote in place, so an interruption mid-write truncated the file and took the session with it. Writes are atomic now, and load salvages a truncated file from its temp and backup copies instead of starting empty. The restore and device-import paths write the live database the same way
- **Undo tombstones the review log entry**, so an undone review no longer feeds scheduling
- **Statistics rebuild respects dayStartHour boundaries** and skips previews
- **Frontmatter index rebuilds once the metadata cache finishes its initial scan**, instead of indexing a half-populated cache at startup
- **The hierarchy graph is invalidated when a project or child note is renamed**
- **Assistant threads unstick** when their active task is deleted or reaches a terminal state
- **Undo and redo edits persist in live preview**, and Shift+Cmd+Z is ignored where it used to fire twice
- **Quick editor popout keeps its size** via min and max bounds rather than setResizable
- **Dashboard lag after reviews** is gone (#50)
- **FK backfill actually runs**: hasRow always returned true, so the migration silently skipped
- **Duplicate native tooltips removed**, and lapse counts are formatted in note stats

### Improvements

- **Descendant-project lookup extracted into a tested helper** in preset options
- **The default problem-card limit is raised to 50**
- **CodeMirror packages bumped** and the code adapted to Obsidian 1.13 types

## 2.0.0 (2026-07-26)

The AI side of True Recall was a collection of separate surfaces — Card Polish had its own preset menu and preview modal, generation had another, the Knowledge Chat a third. 2.0 replaces all of them with one assistant that keeps its work in threads you can review later. Alongside that: Anki-style Custom Study, a daily target that follows your actual pace, and FSRS load balancing that spreads an overdue backlog instead of dumping it on one day.

### Breaking changes

- **RAG / Knowledge Base removed.** The Knowledge Chat view, the knowledge-base plugin, the `/rag/*` API routes, the assistant's `search_knowledge` tool and every `rag*` setting are gone — the subsystem will be rebuilt from scratch later. Existing RAG tables are left in place (nothing is dropped), and evidence already attached to saved assistant threads still renders
- **The legacy Card Polish UI is retired.** Its anchored preset menu, preview modal and presenter are deleted; the review ✨ action now opens the shared AI workspace in card-polish mode. Preset ids, command ids and hotkeys are unchanged, so saved presets and keybindings keep working
- **✨ now requires both the Card Polish and AI Assistant plugins enabled.** A disabled AI family no longer offers its presets inside the workspace, and the mode navigation hides it

### Features

- **AI assistant with threads and an inbox** — every AI request becomes a thread you can apply, reject or retry from a dedicated inbox view, instead of a modal that loses its result when you close it. Reviewed conversations stay in place and pending drafts survive
- **Dockable Ask AI panel** — a sidebar home for the AI workspace that outlives a single question. Its subject follows what you are studying (the card under review, otherwise the open note) and holds still while you have draft text in the composer, so grading mid-sentence cannot swap the subject out from under you
- **Fast preset surface** — running a saved instruction is now one click: a keyboard-navigable preset list with Apply/Preview badges and a custom-instruction field directly underneath. A preset marked auto-apply lands its change immediately and keeps the thread as history; anything that conflicts falls back to the inbox rather than being dropped
- **Generated-card draft review** — approve AI-generated cards per thread or inbox-wide, with the assistant available alongside the quick note editor
- **Custom Study (Anki-style)** — six modes: increase today's new-card limit, increase today's review limit, review forgotten cards, review ahead, preview new cards, and study by card state or tag (with tag include/exclude). Builds a temporary filtered deck that shows up as its own card on the dashboard
- **Conscious daily target** — a daily-target picker with pace chips and a catch-up preview, with the suggested target anchored to the pace you actually sustain rather than a fixed number
- **FSRS load balancing overhaul** — auto or manual load-balance target, overdue backlog spread across upcoming days instead of piling onto today, per-review Anki-style fuzz balancing, a replay-based parameter optimizer, and per-project balance plus workload forecast
- **Ink embeds render in review and note editors** — handwritten drawing and writing embeds from the Ink plugin now display on cards
- **Hide tab bar** — a `Hide tab bar` toggle under Appearance plus a bindable "Toggle tab bar" command. Scoped to the main window, so sidebar tabs stay visible
- **Baseline card quality rules for every non-Pro prompt** — the Pro prompt already banned ordinal/meta questions, multi-answer cards and long answers; those rules now apply to the basic builtin preset and to BYOK/user presets too, and preset instructions can explicitly override them. Settings migration also refreshes persisted builtin prompts, so older installs finally receive prompt improvements instead of keeping whatever text they were first seeded with
- **BRAT beta channel** — opt into beta builds via `X.Y.Z-beta.N` tags cut from `pre-release`, without prereleases leaking into normal Obsidian updates
- **FSRS preset and load-balance control from the API, CLI and MCP server** — read and update scheduling presets, set the load-balance target, and query per-project balance and forecast from outside Obsidian

### Improvements

- **toolbar:** the builtin basic and Pro generation buttons are collapsed into a single button
- **assistant:** one Apply action that always dismisses the workspace, instead of several that behaved differently
- **assistant:** the split-card procedure is now spelled out explicitly in the system prompt, so decomposition produces atomic cards more reliably
- **performance:** review grading batches its data-layer patches and handles card removal incrementally instead of rebuilding the whole session
- **performance:** hidden views no longer recompute, and content-only edits skip full cache invalidation
- **the plugin registry shows deprecation badges** for plugins superseded by the assistant
- removed dead code and consolidated duplicated helpers across core services

### Bug Fixes

- **assistant:** typing in an AI proposal field froze Obsidian — every keystroke rewrote the whole thread into SQLite and re-rendered every embedded editor. Edits are now debounced and flushed on blur, unmount and Apply, so nothing is lost
- **anki:** `.apkg` export actually converts content and media filenames now
- **anki:** one-way basic cards export under a single-template model instead of generating a phantom reverse card
- **anki:** corrected scheduling and export mappings plus several converter edge cases
- **cards:** editing the original of a reversed pair no longer flips it
- **cards:** duplicate detection compares whole questions, and AI dedupe is real rather than approximate
- **persistence:** restore-from-backup is protected, and cloze notes no longer fragment
- **persistence:** five verified correctness fixes from a full persistence audit
- **review:** closed four undo/race gaps found in the data-layer audit
- **commands:** undo restores every card the command actually wrote, not just the primary one
- **sync:** note and note-type rows are merged, with the watermark taken from observed rows
- **stats:** timezone-safe streak math, correct weekday and day bucketing in workload forecasts, and filter-aware fast paths
- **storage:** the default project folder is honored in every creation flow, and the Anki media preview path is aligned
- **notes:** the target folder is created before a note is written into it
- **deletion:** card cleanup runs before the frontmatter index clears, so deletes no longer leave orphans
- **panel:** cloze-syntax detection stopped alternating results on repeated calls
- **api:** hardened the local API server lifecycle and input validation
- **ui:** fixed Tailwind variant class ordering in popout windows

### Maintenance

- resolved the Obsidian automated plugin review findings at their root: `setCssStyles()` instead of direct style assignment, `createDiv`/`createEl` helpers instead of `createElement`, `FileManager.trashFile()` (which respects the user's deletion preference) instead of `Vault.trash()`, `activeDocument` instead of `document` for popout compatibility, and `@floating-ui/dom` declared where it is used
- cleared the full ESLint type-safety cluster (`no-unsafe-*`, `no-misused-promises`, enum comparisons, `await-thenable`), all 67 `react-hooks/exhaustive-deps` findings, all 17 `no-deprecated` findings, and sentence-case UI text
- decoupled scanner-visible code from ambient Node types, and fixed monorepo dependency resolution so the MCP server is linted too
- removed dead deprecated APIs instead of suppressing the lint that flagged them

## 1.9.10 (2026-07-10)

### Features

- Added configurable storage locations — set a custom attachment folder (pasted images, Image Occlusion, AI-generated images, and Anki import media), plus defaults for the Anki import and new-project folders

### Bug Fixes

- Fixed sub-projects always being created at vault root instead of alongside their parent project

## 1.9.9 (2026-06-25)

### Maintenance

- pass the Obsidian automated plugin review: use `setCssStyles()` instead of direct style assignment, load the desktop API server's Node `http` module lazily behind a `Platform.isDesktop` guard, and describe the remaining ESLint disable directives (no user-facing changes)
- raise `minAppVersion` to 1.8.7 to match the Obsidian APIs the plugin already uses (`Notice.messageEl`, `App.loadLocalStorage`/`saveLocalStorage`)

## 1.9.8 (2026-06-25)

### Maintenance

- internal tooling: scope the ESLint configuration so the automated plugin review completes without aborting (no user-facing changes)

## 1.9.7 (2026-06-14)

### Features

- **dashboard:** per-project study scheduling actions, with a header toggle to show or hide them

### Improvements

- backing up large libraries no longer freezes Obsidian for a few seconds
- the database file no longer grows without bound — it reclaims space after you delete a lot of cards
- smoother startup: the automatic backup now runs shortly after launch instead of during load

### Bug Fixes

- the card order set in an FSRS preset now actually applies (it was using the global setting); all ordering options are now offered the same way in settings and in the preset dialog

## 1.9.6 (2026-06-03)

### Bug Fixes

- fixed contrast of tinted UI elements (buttons, badges, highlights) so they stay readable across light and dark themes
- cleaned up plugin stylesheets to resolve Obsidian plugin reviewer warnings — no visual changes expected

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
