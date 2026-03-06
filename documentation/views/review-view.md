# Review View

The **Review View** is where you study flashcards using spaced repetition. This page covers the full review experience beyond the basics.

## Opening Review View

### From Commands

| Command | Action |
|---------|--------|
| Review flashcards from current note | Review active note's cards |
| Review today's new cards | Review all due cards |

### From Dashboard

Click **Study** on any project or note.

### From Flashcard Panel

Click **Review** button.

## Review States

### Active Review

Normal card-by-card study:

1. See question
2. Think or type answer
3. Reveal answer
4. Rate recall

### Waiting State

When no cards are due:

```
┌─────────────────────────────────────┐
│                                     │
│    No cards due right now           │
│                                     │
│    Next card in 2h 34m              │
│                                     │
│    [Study Ahead] [Close]            │
└─────────────────────────────────────┘
```

Options:
- **Study Ahead** — Review future cards (shorter intervals)
- **Close** — Return to previous view

### Session Complete

After finishing all due cards:

```
┌─────────────────────────────────────┐
│         Session Complete! 🎉        │
├─────────────────────────────────────┤
│  Cards reviewed: 42                 │
│  Time: 12 minutes                   │
│  Retention: 88%                     │
│                                     │
│  Rating breakdown:                  │
│  Again: 5   Hard: 8   Good: 25  Easy: 4 │
│                                     │
│  Next session: 8:00 AM tomorrow     │
├─────────────────────────────────────┤
│  [Review More]  [Close]             │
└─────────────────────────────────────┘
```

## Header Options

Configure what appears in the header:

Settings → General:

| Setting | Description |
|---------|-------------|
| Show review header | Display header at all |
| Show header stats | Badge counts in header |
| Show next review time | Intervals on answer buttons |

## Actions During Review

Press `?` or click the menu to see all actions:

### Card Actions

| Action | Key | Description |
|--------|-----|-------------|
| Edit | `E` | Edit card inline |
| Suspend | `!` | Remove from reviews |
| Bury card | `-` | Hide until tomorrow |
| Bury note | `=` | Hide all siblings until tomorrow |
| Move | `M` | Transfer to another note |
| Add flashcard | `A` | Create new card |
| Type-in mode | `T` | Toggle type-in |

### Session Actions

| Action | Key | Description |
|--------|-----|-------------|
| Undo | `Cmd/Ctrl+Z` | Undo last answer |
| Close | `Escape` | End session |

### Preset Actions

| Action | Key | Description |
|--------|-----|-------------|
| Change preset | `P` | Switch FSRS preset for card |

## Edit Toolbar

When editing a card inline:

```
┌─────────────────────────────────────────┐
│ [Bold] [Italic] [Link] [Image] [Code]  │
├─────────────────────────────────────────┤
│ What is the capital of France?          │
│                                         │
│ Paris                                   │
└─────────────────────────────────────────┘
```

Format card content with:
- **Bold**, *Italic*
- Links and images
- Code blocks
- Math

## Image Occlusion in Review

For image occlusion cards:

### Question Side

- Image shown with one region covered
- Other regions visible for context

### Answer Side

- Full image revealed
- Previously hidden region highlighted

## Audio Support

If cards contain audio:

- Speaker icon appears
- Click to play
- Auto-play on reveal (configurable)

## Undo

Made a mistake? Press `Cmd/Ctrl+Z` to undo:

- Card returns to queue
- FSRS parameters restored
- Can undo multiple times

## Session Persistence

If you close Obsidian mid-session:

- Progress is saved
- Session resumes where you left off
- No data loss

## Fullscreen vs Panel

Settings → General → Review mode:

### Fullscreen Mode

- Takes over main editor area
- Fewer distractions
- Recommended for focused study

### Side Panel Mode

- Opens in right sidebar
- Can see note while reviewing
- Good for quick sessions

## Related Topics

- [Review Interface](../review/review-interface.md) — Basic interface
- [Type-in Mode](../review/type-in-mode.md) — Type answers
- [Answering Cards](../review/answering-cards.md) — Rating system
- [Keyboard Shortcuts](../configuration/keyboard-shortcuts.md) — All shortcuts
