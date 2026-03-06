# Flashcards

Flashcards are the core learning unit in True Recall. This page explains how flashcards work, where they're stored, and how they connect to your notes.

## What is a Flashcard?

A flashcard has two sides:

- **Front (Question)** — What you see first
- **Back (Answer)** — What you reveal after thinking

When you review, you see the front, try to recall the answer, then reveal the back and rate your memory.

## Card Types

### Basic Cards

The simplest type — one question, one answer.

```markdown
What is photosynthesis?
::The process by which plants convert sunlight into energy
```

### Cloze Deletions

Fill-in-the-blank cards. Multiple clozes create multiple cards.

```markdown
The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell.
```

This creates two cards:
1. "The ___ is the powerhouse of the cell" → mitochondria
2. "The mitochondria is the ___ of the cell" → powerhouse

### Reversed Cards

Creates two cards — one in each direction.

```markdown
Capital of France
:::Paris
```

Creates:
1. "Capital of France?" → Paris
2. "Paris?" → Capital of France

Useful for vocabulary, definitions, and bidirectional learning.

### Image Occlusion

Create cards from images by hiding regions.

```markdown
![[anatomy-diagram.png]]
#flashcard-io
regions: [[100,100,200,150]], [[300,200,400,280]]
```

Each region becomes a separate card testing that part of the image.

## Where Flashcards Live

### In Your Notes

Flashcards are written directly in your Obsidian notes using markdown syntax. This means:

- Cards are version-controlled with your notes
- You can edit cards in your favorite editor
- Cards stay close to the source material

### In the Database

When you "collect" a flashcard, True Recall:

1. Parses the markdown syntax
2. Creates a database entry with scheduling data
3. Links the card to its source note via `flashcard_uid`

The database (`.true-recall/true-recall-{id}.db`) stores:
- FSRS scheduling data (due date, stability, difficulty)
- Review history
- Statistics

## The Collection Process

New flashcard lines aren't immediately added to the review queue. They must be **collected**:

1. Write a flashcard in your note
2. Open the Flashcard Panel
3. Click **Collect** on uncollected cards
4. Cards are now scheduled for review

### Why Collection?

Collection lets you:
- Review cards before adding them
- Batch-add multiple cards at once
- Prevent accidental cards from appearing in reviews

### Auto-Collection

Enable "Remove content after collecting" in Settings → General to clean up your notes after collection.

## Source Notes and UIDs

Each note with flashcards gets a unique `flashcard_uid` in its frontmatter:

```yaml
---
flashcard_uid: abc123-def456
---
```

This UID links:
- Cards to their source note
- Review history to the originating content
- Statistics to specific notes

## Card States

| State | Color | Description |
|-------|-------|-------------|
| New | Green | Never reviewed |
| Learning | Orange | In initial learning phase |
| Review | Blue | Graduated to longer intervals |
| Relearning | Orange | Lapsed, being relearned |
| Suspended | Red | Manually paused |

## Editing Flashcards

### From the Panel

1. Open Flashcard Panel
2. Click the edit icon on any card
3. Modify question/answer
4. Save changes

### From the Source

Edit the markdown in your note. Changes sync to the database automatically when you save.

### In Review

Press `E` during review to edit the current card inline.

## Deleting Flashcards

- **From Panel** — Click trash icon → confirm
- **From Source** — Delete the markdown line, card is marked orphaned
- **During Review** — Press `!` to suspend, or use actions menu

Deleted cards are removed from the database but the source markdown remains (unless you delete it too).

## Bulk Operations

In the Card Browser:

1. Select multiple cards (shift-click, ctrl-click)
2. Use bulk actions:
   - Suspend/Unsuspend
   - Delete
   - Change note type
   - Move to different note
   - Change preset

## Related Concepts

- [Cloze Deletions](../creation/cloze-deletions.md) — Detailed cloze syntax
- [Image Occlusion](../creation/image-occlusion.md) — Creating cards from images
- [Note Types](./note-types.md) — Customizing card templates
- [Scheduling](./scheduling.md) — How reviews are scheduled
