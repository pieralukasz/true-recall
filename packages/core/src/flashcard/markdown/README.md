# Markdown flashcards

Enable **Settings → True Recall → Data & backup → Markdown flashcards** and press **Apply Markdown settings**. The feature is off by default. This is separate from the existing `#type/...` card-block format.

Tag a note with `#flashcards` (on a separate paragraph) or `tags: [flashcards]` in YAML frontmatter:

```md
#flashcards

What is the capital of France?
??
Paris

bonjour
???
hello
```

`??` creates one card; `???` creates both directions with separate schedules. Both separators and the tag can be changed in settings. Separators must occupy an entire line. Fields support Markdown and multiple consecutive lines; a blank line separates cards. Fenced code examples are ignored. Empty answers, duplicate markers and ambiguous blocks stop that note's import instead of removing existing cards.

Cards are imported at startup and after file creation, edits and renames, with a short debounce. **True Recall: Sync Markdown flashcards** scans tagged notes manually. Notes can be authored in any editor; True Recall synchronizes them while Obsidian is running or when it next opens.

## Identity and editing

True Recall adds the usual `flashcard_uid` to the source note and one hidden HTML comment directly after each answer. The comment contains a stable UUID. Keep it with the answer when editing or reordering cards within the note. Renaming or moving the whole file preserves identity and schedules.

Edit Markdown cards in their source note. That text is authoritative: an edit made only in the card browser is replaced on the next source synchronization. When duplicating a card, remove its hidden comment so the copy receives a new ID. When copying a whole file, also remove its `flashcard_uid`. Moving a block to a different source note requires a new marker; the importer rejects IDs belonging to another source instead of overwriting its cards.

Removing a whole card block (including its comment) removes its cards from review. Restoring that block, including its original comment, restores the same cards and their progress. Changing between normal and reversed separators preserves the forward card and restores the reverse card's progress if it existed before. Removing the opt-in tag or disabling this feature leaves existing cards intact. A card explicitly deleted in the card browser is not resurrected by a scan.

If separators are changed, update the corresponding source text. A marker with an unrecognized separator is reported as an error. Do not detach markers from their answers with a blank line.

## Portable scheduling

**Store scheduling inside notes** includes each direction's FSRS state in the hidden comment: due date, stability, difficulty, review/lapse counts, state, learning step, last review, interval, suspension/burial, creation time and update time. Reviews and scheduling operations update these comments. They stay invisible in normal Markdown rendering and remain editable in source mode.

SQLite remains the working database in both modes. With in-note scheduling enabled, a fresh database can reconstruct cards and their current FSRS state from the notes. When importing into an existing database, newer scheduling wins; an equal timestamp keeps the local version. Review-log history, aggregate statistics and FSRS presets remain in the database and still require normal backups/sync. Keep device clocks accurate when syncing notes between devices.

With in-note scheduling disabled, only card IDs are added. Existing schedule comments are preserved, but their schedules are neither imported nor updated. This makes switching the feature off non-destructive.
