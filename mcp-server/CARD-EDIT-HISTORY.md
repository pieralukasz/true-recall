# Persistent local card edit history

`list_card_edits` lists **events**, not cards with lifetime edit counters. `get_card_edit_history --card-id <id>` resolves the card's owning note. Basic/reversed/cloze siblings share fields and therefore share one history and the same retention allowance.

```sh
true-recall list_card_edits --since 2026-10-10 --until 2026-10-17 --edit-source ai --limit 50 --offset 0
true-recall get_card_edit_history --card-id <id> --edit-source manual
```

Both tools are read-only, available in CLI and MCP, and use dedicated authenticated local GET endpoints (`/card-edits`, `/cards/:id/edit-history`). The SQL query endpoint can remain disabled. `since` is inclusive, `until` exclusive; dates mean local midnight, ISO timestamps must specify a timezone. `edit_source` accepts `manual`, `ai`, `system`; `source_uid` filters the source UID saved at the edit, not the note's later location. Pages report `total`, `count`, `hasMore`, `limit`, `offset`, retention and `historyStartsAt` (activation time on this database).

## Stored data and retention

Local SQLite table `card_edit_history` stores a unique edit ID, deterministic sequence, note ID, timestamp, writing device ID when available, source, source UID, full before/after fields, and the before/after note type/template snapshot. The first edit captures its real previous fields; **there is no retroactive/preinstallation history**. Same-field saves, including reordered JSON keys, neither add events nor increment edit counters.

Defaults in `CARD_EDIT_HISTORY_RETENTION`:

- newest **50 events per note content owner** (thus 50 shared events for each sibling card);
- newest **10,000 events globally**;
- maximum **90 days**, with the exact cutoff included.

Append pruning shares the content transaction. Startup prunes age/global limits and persists the upgrade/pruning; read-only queries exclude aged events even if nothing has been edited since startup. Equal timestamps are ordered by the local sequence, newest first. Retention removes only history rows, never cards, notes, reviews or counters. Full local database exports/backups naturally include the history table.

The schema is additive and idempotent, does not change the device-sync schema version or cloud contract. An old plugin can open the database and ignores this table; restoring old plugin files stops capture. For lossless rollback/restore, keep a full database backup as well. Edits made while running an old build cannot be recovered into history later.

## Rendering and ownership

`fieldsBefore`/`fieldsAfter` are authoritative. Each event's `cards` contains historical Q/A reconstructed using the **saved** note type/template and each currently attached card's ordinal/cloze index; `current` is separate, latest rendered Q/A. Basic, reversed, cloze and custom text templates use the existing template renderer. This is content-owner history, **not evidence that a current sibling card existed at that historical time**. A removed/missing historical template or image-occlusion rendering is explicitly `supported: false`; raw Front is never presented as every card's historical question. Global events remain readable after cards are deleted (then `cards` may be empty); per-card reads require a current card.

## Captured and excluded paths

Captured once per changed note: `NoteActions.update` with fields; card/manual editor writes through `CardWriteActions.writeNoteFields`; AI Apply/assistant edits with source `ai`; command Undo/Redo and AI-proposal Undo with source `system`; Markdown card-content changes via the existing note write path (manual); user note-type field remaps when fields change. Content, counters and event insertion are atomic, including nested transactions. FSRS scheduling remains untouched.

Intentionally excluded: initial note/card creation and imports, raw remote upserts (`NoteActions.upsertRowFromRemote`, `CardWriteActions.upsertFromRemote`), schema/field-key migrations (`renameFieldKey`), note-type definition/refresh writes, metadata-only changes, scheduling/reviews, deletion/restoration without field changes. Remote replacement is not relabelled as manual/AI. No history rows are uploaded through Cloud Sync or merged from another device; existing cloud/device sync selects its explicit note/type/card/review entities only. No UI, cron or external retention task is added.

`list_edited_cards` keeps its previous semantics: current card text, lifetime shared counters, date bounds on the latest content edit. It still requires the SQL endpoint and cannot prove which author made an edit within a period; use the new event tools for that question.
