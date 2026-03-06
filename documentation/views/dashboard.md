# Dashboard

The **Dashboard** is your command center for True Recall. It shows today's workload, project hierarchy, all notes with flashcards, and a review heatmap.

## Opening the Dashboard

- **Ribbon icon** — Click the dashboard icon (layout-grid)
- **Command** — Cmd/Ctrl + P → "Open dashboard"

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Today: Due 42 | New 15 | Learn 8]  Est. 25 min   [Study] │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search notes and projects...                            │
├─────────────────────────────────────────────────────────────┤
│  [Projects] [Notes]                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project Tree / Note List                                   │
│                                                             │
│  ┌─ Biology (120 cards, 15 due)                            │
│  │  ├─ Anatomy (45 cards, 8 due)                           │
│  │  └─ Physiology (75 cards, 7 due)                        │
│  ├─ Chemistry (80 cards, 12 due)                           │
│  └─ Physics (60 cards, 15 due)                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Calendar Heatmap]                                         │
│  ░░▓░▓▓░▓▓▓░░▓▓▓▓░▓▓░░▓▓▓▓▓░▓░░▓▓░                        │
└─────────────────────────────────────────────────────────────┘
```

## Top Action Bar

### Today's Stats

| Badge | Meaning |
|-------|---------|
| **Due** | Review cards due today |
| **New** | New cards available |
| **Learn** | Cards in learning phase |

### Estimated Time

Predicted time to complete today's reviews (based on average review time).

### Study Button

Start reviewing all due cards across all projects.

## Search

The search bar filters:

- **Projects** — By name
- **Notes** — By title or path

Results update as you type.

## Projects Tab

Shows hierarchical project tree:

### Project Row

```
┌─ Biology ─────────────────────────────────────────┐
│  120 cards | 15 due | Preset: medical-school  ▶  │
└───────────────────────────────────────────────────┘
```

- **Card count** — Total cards in project (including children)
- **Due count** — Cards due today
- **Preset indicator** — Click to change preset

### Project Actions

Right-click a project:

| Action | Description |
|--------|-------------|
| Study | Start review for this project |
| Custom session | Configure filtered session |
| Expand/Collapse | Toggle children visibility |
| Set preset | Change FSRS preset |

### Project Hierarchy

Expand parent projects to see children:

```
▼ Medicine (500 cards, 42 due)
  ├─ Anatomy (120 cards, 15 due)
  │  ├─ Upper Body (45 cards, 8 due)
  │  └─ Lower Body (75 cards, 7 due)
  ├─ Physiology (180 cards, 12 due)
  └─ Pharmacology (200 cards, 15 due)
```

## Notes Tab

Shows all notes with flashcards:

### Note Row

```
┌─ Neural Networks Basics ──────────────────────────┐
│  15 cards | 3 new, 2 learning, 10 review         │
│  Project: AI/ML | Preset: default            ▶   │
└───────────────────────────────────────────────────┘
```

### Note Columns

| Column | Description |
|--------|-------------|
| Title | Note name |
| Cards | Total flashcards |
| Status | New/Learning/Review breakdown |
| Project | Assigned project |
| Preset | FSRS preset |

### Note Actions

Right-click a note:

| Action | Description |
|--------|-------------|
| Study | Review cards from this note |
| Custom session | Configure session |
| Go to note | Open in editor |
| Archive | Exclude from reviews |
| Detach from project | Remove project assignment |
| Select | Multi-select for bulk actions |

### Note Sorting

Click column headers to sort:
- By card count
- By due count
- By name
- By project

### Archive Toggle

Toggle "Show archived" to see/hide archived notes.

## Calendar Heatmap

Bottom of dashboard shows review activity:

```
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
░░▓░▓▓░▓▓▓░░▓▓▓▓░▓▓░░▓▓▓▓▓░▓░░▓▓░
```

- **Empty (░)** — No reviews
- **Light (▓)** — Few reviews
- **Dark (█)** — Many reviews

Hover a day to see exact count.

## Bottom Action Bar

When items are selected:

| Button | Action |
|--------|--------|
| Study | Review selected items |
| Archive | Archive selected notes |
| Move | Move to different project |
| Delete | Delete selected cards |

## Dashboard Widgets in Notes

Embed dashboard views in any note:

````markdown
```true-recall-dashboard
project: Medicine
showStats: true
```
````

See [CodeBlock Widgets](./codeblock-widgets.md) for all options.

## Tips

### 1. Start Here Daily

Make the dashboard your first stop each day to see what's due.

### 2. Use Projects for Organization

Group related notes into projects for focused study sessions.

### 3. Check the Heatmap

The heatmap motivates consistent daily reviews.

### 4. Search Before Creating

Use search to find if you already have cards on a topic.

## Related Topics

- [Projects](../concepts/projects.md) — Project organization
- [Card Browser](./card-browser.md) — Browse all cards
- [Statistics](./statistics.md) — Detailed analytics
- [CodeBlock Widgets](./codeblock-widgets.md) — Embeddable widgets
