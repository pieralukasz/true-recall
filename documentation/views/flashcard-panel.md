# Flashcard Panel

The **Flashcard Panel** is a sidebar view that shows flashcards for the currently active note. It's your hub for managing cards within a note.

## Opening the Panel

- **Command** — Cmd/Ctrl + P → "Open flashcard panel"
- The panel opens in the right sidebar

## Panel Layout

```
┌─────────────────────────────────────┐
│  [Note Name]          [⋯] [Refresh] │
├─────────────────────────────────────┤
│  Status: 3 new | 2 learning | 10 review │
│                        [Review]     │
├─────────────────────────────────────┤
│  Quick Review                       │
│  ┌─────────────────────────────────┐│
│  │ [Card preview - due now]        ││
│  │ What is the capital of France?  ││
│  │              [Show] [Edit]       ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  Flashcards (15)                    │
│  ┌─────────────────────────────────┐│
│  │ 🟢 What is photosynthesis?      ││
│  │    The process by which...      ││
│  │              [Edit] [Delete]     ││
│  ├─────────────────────────────────┤│
│  │ 🔵 What is the powerhouse...    ││
│  │    Mitochondria                 ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  Uncollected (2)                    │
│  ┌─────────────────────────────────┐│
│  │ What is ATP? :: Adenosine...    ││
│  │              [Collect] [Ignore]  ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  [+ Add] [✨ Generate]              │
└─────────────────────────────────────┘
```

## Header Section

### Note Title

Shows the current note name. Click to navigate to note.

### Menu (⋯)

| Option | Action |
|--------|--------|
| Refresh | Reload cards from note |
| Copy all | Copy card content |
| Export | Export to Anki/CSV |

### Status Bar

Shows card counts by state:
- 🟢 New
- 🟠 Learning
- 🔵 Review

### Review Button

Start review session for this note's cards.

## Quick Review Section

Shows one card that's due right now:

- **Question** — Card front
- **Show** — Reveal answer
- **Edit** — Edit card inline

Answer and rate without opening full review view.

Enable in Settings → General → "Show quick review in panel".

## Flashcards Section

### Card List

All collected cards for this note:

| Badge | State |
|-------|-------|
| 🟢 | New |
| 🟠 | Learning |
| 🔵 | Review |
| 🔴 | Suspended |

### Card Actions

Hover a card to see actions:

| Action | Description |
|--------|-------------|
| Edit | Open card editor |
| Delete | Remove card |
| Suspend | Pause reviews |
| Move | Transfer to another note |

### Selection Mode

Click the checkbox to enter selection mode:
- Select multiple cards
- Bulk actions appear at bottom

### Context Menu

Right-click a card:

| Option | Action |
|--------|--------|
| Edit | Open editor |
| Copy | Copy card content |
| Move | Move to another note |
| Change type | Change note type |
| Delete | Remove card |
| Suspend | Pause reviews |

## Uncollected Section

Cards written in the note but not yet in the database:

### Collecting Cards

1. See uncollected cards listed
2. Click **Collect** to add to database
3. Or **Collect All** for batch collection

### Ignoring Cards

Click **Ignore** to dismiss without collecting.

## Image Occlusion Group

If the note has image occlusion cards, they appear grouped:

```
┌─────────────────────────────────────┐
│  🖼️ anatomy-diagram.png             │
│  5 occlusion cards                  │
│  [View] [Edit]                      │
└─────────────────────────────────────┘
```

## Bottom Actions

### Add Button

Create a new flashcard manually:

1. Click **+ Add**
2. Enter question and answer
3. Select note type
4. Save

### Generate Button

Use AI to generate cards:

1. Click **✨ Generate**
2. Choose source:
   - Current note content
   - Selected text
   - Highlights
3. Review generated cards
4. Collect wanted cards

## Panel Sync

The panel automatically syncs with:

- **Active note** — Switching notes updates the panel
- **Review session** — Shows currently reviewed card
- **Edits** — Changes reflect immediately

## Mobile

On mobile, the panel is optimized for touch:

- Swipe to delete cards
- Tap to expand
- Bottom sheet for actions

## Tips

### 1. Keep Panel Open

Leave the panel open while editing notes to see card status.

### 2. Quick Review for Single Cards

Use quick review instead of full session for just a few cards.

### 3. Collect Regularly

Don't let uncollected cards pile up — collect as you write.

### 4. Use Selection Mode

Bulk edit or delete multiple cards at once.

## Related Topics

- [Basic Cards](../creation/basic-cards.md) — Creating cards
- [Review Interface](../review/review-interface.md) — Full review view
- [AI Generation](../creation/ai-generation.md) — Generate cards with AI
