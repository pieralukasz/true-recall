# Editor Integration

True Recall integrates with Obsidian's editor to show flashcard status and provide quick actions.

## Link Status Indicators

### What They Show

Inline indicators next to `[[wiki links]]` showing the linked note's flashcard status:

```
[[Biology Notes]]  🟢3 🟠1 🔵10
```

| Badge | Color | Meaning |
|-------|-------|---------|
| 🟢 | Green | New cards |
| 🟠 | Orange | Learning cards |
| 🔵 | Blue | Review cards |

### Enabling

Settings → General → Show link status indicators

### Display Modes

| Mode | Description |
|------|-------------|
| Text | Numbers only (3/1/10) |
| Donut chart | Small pie chart |
| Both | Chart + numbers |

Configure in Settings → General.

### Hover Tooltip

Hover over a link to see detailed stats:

```
Biology Notes
─────────────
Total cards: 14
New: 3 | Learning: 1 | Review: 10
Due today: 8
Last review: 2 hours ago
```

### Click Actions

Click the status indicator to:
- Open Flashcard Panel for that note
- Or start review for that note

## Status Bar Widget

### What It Shows

Global card counts in Obsidian's bottom status bar:

```
📚 42 | 15 | 8
```

| Section | Meaning |
|---------|---------|
| 📚 | True Recall icon |
| 42 | Due today |
| 15 | New cards |
| 8 | Learning cards |

### Enabling

Settings → General → Show status bar widget

### Click Action

Click the status bar widget to:
- Open Dashboard
- Or start today's review

### Colors

Numbers change color based on state:

| State | Color |
|-------|-------|
| Due > 0 | Blue |
| Due = 0, New > 0 | Green |
| All = 0 | Gray |

## Reading Mode Integration

### Source Highlighting

In reading mode, source text for flashcards is highlighted:

```
┌─────────────────────────────────────┐
│ The mitochondria is the powerhouse   │
│ of the cell.                         │
│ └─ 📝 Flashcard source              │
└─────────────────────────────────────┘
```

### Hover Information

Hover over highlighted text to see:
- Associated cards
- Card states
- Quick actions

## Selection Toolbar

### When It Appears

When you select text in the editor.

### Toolbar Buttons

| Button | Action |
|--------|--------|
| Basic | Generate Q&A card |
| Cloze | Generate cloze |
| Reversed | Generate reversed card |
| Auto | AI chooses type |
| IO | Image occlusion |
| Edit | Open in editor |
| Quick+ | Quick add |

### Enabling

Settings → AI → Selection toolbar

## Quick Review in Panel

### What It Shows

Collapsible section at top of Flashcard Panel showing one due card.

### Actions

| Button | Action |
|--------|--------|
| Show | Reveal answer |
| Edit | Edit card |
| Rate | Answer the card |

### Enabling

Settings → General → Show quick review in panel

## CodeBlock Widgets

### Embeddable Widgets

Use code blocks to embed True Recall widgets in notes:

````markdown
```true-recall-dashboard
project: Biology
```
````

### Available Widgets

- Dashboard
- Forecast
- Health
- Heatmap
- Progress
- Streak
- And more...

See [CodeBlock Widgets](../views/codeblock-widgets.md) for full list.

## Tips

### 1. Use Status Bar for Quick Check

Glance at status bar to see if you have due cards.

### 2. Click Links to Review

Click link indicators to quickly review a specific note's cards.

### 3. Use Selection Toolbar

Select text and use toolbar for fastest card creation.

### 4. Embed Widgets in Notes

Create custom dashboards with embedded widgets.

## Related Topics

- [Flashcard Panel](../views/flashcard-panel.md) — Panel details
- [Selection Toolbar](../creation/selection-toolbar.md) — Toolbar usage
- [CodeBlock Widgets](../views/codeblock-widgets.md) — Embeddable widgets
- [Dashboard](../views/dashboard.md) — Main dashboard
