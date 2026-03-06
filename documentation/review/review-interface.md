# Review Interface

The **Review Interface** is where you study your flashcards using spaced repetition. This page covers the main review view, its components, and how to navigate it.

## Opening the Review View

### From Commands

- **Cmd/Ctrl + P** → "Review flashcards from current note"
- **Cmd/Ctrl + P** → "Review today's new cards"

### From Dashboard

1. Open Dashboard
2. Click **Study** on a project or note

### From Flashcard Panel

Click the **Review** button at the top of the panel.

## Review Layout

```
┌─────────────────────────────────────────────────┐
│ Header: [← Close] [New: 5] [Learn: 3] [Due: 12]│
├─────────────────────────────────────────────────┤
│                                                 │
│              [Card Content Area]                │
│                                                 │
│         Question text and/or image              │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│            [Show Answer] - Space                │
└─────────────────────────────────────────────────┘

After revealing answer:
┌─────────────────────────────────────────────────┐
│ Header: [← Close] [New: 4] [Learn: 2] [Due: 11]│
├─────────────────────────────────────────────────┤
│                                                 │
│              [Card Content Area]                │
│                                                 │
│         Question AND Answer visible             │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Again: <1m]  [Hard: <10m]  [Good: 1d]  [Easy: 4d] │
│    (1)           (2)          (3)        (4)    │
└─────────────────────────────────────────────────┘
```

## Header Components

### Badge Counts

| Badge | Color | Meaning |
|-------|-------|---------|
| **New** | Green | Cards never reviewed |
| **Learn** | Orange | Cards in learning phase |
| **Due** | Blue | Review cards due today |

Counts update after each answer.

### Progress Bar

Shows session progress (when header stats enabled).

### Close Button

Returns to previous view. Session state is saved.

## Card Content Area

### Question Side

- Shows the question/front of the card
- May include images, formatted text, math
- For image occlusion: image with one region hidden

### Answer Side

- Shows both question and answer
- Answer is highlighted or distinguished
- For image occlusion: full image with hidden region revealed

### Actions Toolbar

Press `?` during review to see available actions:

| Action | Key | Description |
|--------|-----|-------------|
| Edit | `E` | Edit card inline |
| Suspend | `!` | Suspend card (remove from reviews) |
| Bury card | `-` | Hide until tomorrow |
| Bury note | `=` | Hide all sibling cards until tomorrow |
| Move | `M` | Move card to different note |
| Add card | `A` | Add new card to current note |
| Type-in | `T` | Toggle type-in mode |
| Preset | `P` | Change FSRS preset for this card |
| Undo | `Cmd/Ctrl+Z` | Undo last answer |

## Answer Buttons

After revealing the answer, rate your recall:

### Again (1)

- **Meaning:** You didn't remember
- **Effect:** Card goes back to learning/relearning
- **Interval:** Resets to learning steps

### Hard (2)

- **Meaning:** You remembered with significant effort
- **Effect:** Shorter than normal interval
- **Interval:** Reduced from Good interval

### Good (3) - Space

- **Meaning:** You remembered correctly
- **Effect:** Normal FSRS interval
- **Interval:** As calculated by FSRS

### Easy (4)

- **Meaning:** You remembered instantly, no effort
- **Effect:** Longer than normal interval
- **Interval:** Increased from Good interval

### Interval Preview

Each button shows the next interval:
- `<1m` — Less than 1 minute
- `10m` — 10 minutes
- `1.2d` — 1.2 days
- `2.5mo` — 2.5 months

Intervals are calculated by FSRS based on your history.

## Session States

### Active

Normal review — cards are being shown.

### Waiting

No cards due right now. Shows:
- Countdown to next due card
- "Next card in X hours"

### Complete

All cards reviewed. Shows:
- Session statistics
- Time studied
- Retention rate
- Option to start another session

## Ending a Session

### Early Exit

Click close button or press Escape. Progress is saved.

### Session Complete

After reviewing all due cards, see the summary screen:

```
┌─────────────────────────────────────┐
│         Session Complete!           │
├─────────────────────────────────────┤
│  Cards reviewed: 25                 │
│  Time: 8 minutes                    │
│  Retention: 92%                     │
│                                     │
│  Again: 2  Hard: 3  Good: 18  Easy: 2│
├─────────────────────────────────────┤
│     [Review More]  [Close]          │
└─────────────────────────────────────┘
```

## Fullscreen vs Side Panel

Configure in Settings → General → Review mode:

| Mode | Description |
|------|-------------|
| **Fullscreen** | Takes over main editor area |
| **Side panel** | Opens in right sidebar |

Fullscreen is recommended for focused study.

## Related Topics

- [Type-in Mode](./type-in-mode.md) — Type answers during review
- [Answering Cards](./answering-cards.md) — Detailed rating explanation
- [Custom Sessions](./custom-sessions.md) — Filtered study sessions
- [Keyboard Shortcuts](../configuration/keyboard-shortcuts.md) — All shortcuts
