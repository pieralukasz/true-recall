# Card Browser

The **Card Browser** is a powerful view for managing all your flashcards. Search, filter, sort, and perform bulk operations on your card collection.

## Opening the Card Browser

- **Command** — Cmd/Ctrl + P → "Open card browser"

## Browser Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 [Search...]  [Filters ▼]  [Sort ▼]  [⚙️ Columns]  [View]   │
├─────────────────────────────────────────────────────────────────┤
│ Facets           │                    Cards                     │
│                  │                                              │
│ ▼ State          │  ┌────────────────────────────────────────┐ │
│   New (45)       │  │ Q: What is photosynthesis?             │ │
│   Learning (12)  │  │ A: Process by which plants...          │ │
│   Review (230)   │  │ State: Review | Due: Tomorrow          │ │
│   Suspended (5)  │  └────────────────────────────────────────┘ │
│                  │  ┌────────────────────────────────────────┐ │
│ ▼ Card Type      │  │ Q: Capital of France                   │ │
│   Basic (180)    │  │ A: Paris                               │ │
│   Cloze (67)     │  │ State: New | Created: Today            │ │
│   IO (45)        │  └────────────────────────────────────────┘ │
│                  │                                              │
│ ▼ Source Note    │         [Card Preview Panel]                │
│   Biology (120)  │                                              │
│   Chemistry (80) │  Question: What is photosynthesis?          │
│   Physics (60)   │  Answer: The process by which plants...     │
│                  │  Source: [[Biology Notes]]                  │
│ ▼ Preset         │  Created: 2024-01-15                        │
│   Default (200)  │  Reviews: 12 | Lapses: 2                    │
│   Medical (92)   │                                              │
│                  │                                              │
├─────────────────────────────────────────────────────────────────┤
│  3 selected: [Suspend] [Delete] [Move] [Change Type]           │
└─────────────────────────────────────────────────────────────────┘
```

## Toolbar

### Search

Full-text search across all cards:

- Search in questions and answers
- Use query syntax for advanced filters

### Search Syntax

| Query | Matches |
|-------|---------|
| `photosynthesis` | Cards containing "photosynthesis" |
| `state:new` | New cards only |
| `state:review` | Review cards only |
| `preset:medical` | Cards using "medical" preset |
| `project:Biology` | Cards in Biology project |
| `due:today` | Cards due today |
| `due:overdue` | Overdue cards |
| `created:7d` | Created in last 7 days |
| `lapses:>3` | More than 3 lapses |

Combine with space: `state:new project:Biology`

### Filters Dropdown

Quick filter presets:

| Filter | Effect |
|--------|--------|
| Due today | Only today's due cards |
| New cards | Only new cards |
| Suspended | Only suspended cards |
| Orphaned | Cards without source notes |

### Sort Dropdown

| Sort | Order |
|------|-------|
| Due date | Earliest first |
| Created | Newest first |
| Random | Shuffled |
| Lapses | Most lapses first |
| Interval | Longest first |

### Columns Button

Choose visible columns:

- Question (always shown)
- Answer
- State
- Due date
- Interval
- Lapses
- Source note
- Preset
- Created date

### View Toggle

- **Table view** — Row-based list
- **Grid view** — Card-based grid

## Facets Sidebar

Filter cards by clicking facets:

### State

- New
- Learning
- Review
- Suspended

### Card Type

- Basic
- Cloze
- Image Occlusion
- Reversed

### Source Note

Shows notes with card counts. Click to filter.

### Preset

Filter by FSRS preset.

### Project

Filter by project hierarchy.

## Card List

### Row Actions

Hover a card row:

| Action | Description |
|--------|-------------|
| Select | Click checkbox to select |
| Edit | Click to open editor |
| Preview | Shows in preview panel |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Enter` | Edit card |
| `Space` | Toggle selection |
| `Ctrl/Cmd+A` | Select all |
| `Escape` | Clear selection |

### Multi-Select

- **Click** — Select single card
- **Shift+Click** — Select range
- **Ctrl/Cmd+Click** — Toggle selection

## Card Preview Panel

When a card is selected, preview shows:

- Full question and answer
- Source note link
- FSRS statistics
- Review history
- Edit/Delete actions

## Bulk Actions Bar

When cards are selected:

| Action | Description |
|--------|-------------|
| Suspend | Pause reviews for selected |
| Unsuspend | Resume reviews |
| Delete | Remove selected cards |
| Move | Transfer to another note |
| Change Type | Change note type |
| Change Preset | Assign different preset |

## Orphaned Cards

Cards whose source note was deleted appear in "Orphaned" facet.

### Handling Orphaned Cards

1. Filter by "Orphaned"
2. Review each card
3. Options:
   - **Delete** — Remove permanently
   - **Move** — Transfer to existing note
   - **Keep** — Card remains without source

## Tips

### 1. Use Search Syntax

Combine filters for precise results: `state:review lapses:>2 due:overdue`

### 2. Bulk Suspend

Select multiple cards → Suspend to pause without deleting.

### 3. Find Weak Cards

Sort by "Lapses" to find cards you keep forgetting.

### 4. Clean Up Regularly

Check orphaned cards occasionally and resolve them.

### 5. Export Selection

Select cards → Export to CSV for external analysis.

## Related Topics

- [Flashcards](../concepts/flashcards.md) — Card concepts
- [Dashboard](./dashboard.md) — Overview view
- [Statistics](./statistics.md) — Analytics
