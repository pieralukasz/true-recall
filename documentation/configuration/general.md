# General Settings

Configure True Recall's general behavior in Settings → True Recall → General.

## Review Interface

### Review Mode

| Option | Description |
|--------|-------------|
| Fullscreen | Review takes over main editor area |
| Side panel | Review opens in right sidebar |

**Recommended:** Fullscreen for focused study.

### Show Review Header

Display header with close button, stats, and progress.

| Setting | Effect |
|---------|--------|
| Enabled | Header visible during review |
| Disabled | More screen space for cards |

### Show Header Stats

Display badge counts (New, Learn, Due) in review header.

### Show Next Review Time

Display predicted interval on answer buttons:
- `1d` (1 day)
- `2.5mo` (2.5 months)

### Continuous Custom Reviews

After completing a custom review, show "Next session" button instead of closing.

| Setting | Behavior |
|---------|----------|
| Enabled | Easy to start another custom session |
| Disabled | Return to previous view after completion |

### Default Type-in Mode

Type-in mode for new review sessions:

| Option | Description |
|--------|-------------|
| Off | Standard review (think answer) |
| Diff | Character-by-character comparison |
| AI | AI semantic grading |

## Editor Integration

### Show Link Status Indicators

Display inline flashcard counts next to `[[wiki links]]`:

```
[[Biology Notes]]  🟢3 🟠1 🔵10
```

Shows new/learning/review counts for the linked note.

### Show Status Bar Widget

Display global card counts in Obsidian's bottom status bar:

```
True Recall: Due 42 | New 15 | Learn 8
```

### Show Quick Review in Panel

Show collapsible quick-review section at top of Flashcard Panel.

## Day Boundary

### Next Day Starts At

Hour when "today" ends and "tomorrow" begins.

| Setting | Effect |
|---------|--------|
| 0 (midnight) | Day changes at 12 AM |
| 4 (default) | Day changes at 4 AM |
| 6 | Day changes at 6 AM |

**Recommended:** 4 AM (matches Anki behavior).

Why not midnight? Late-night studying (1 AM) counts as "today" with 4 AM boundary.

## Flashcard Collection

### Remove Content After Collecting

| Setting | Behavior |
|---------|----------|
| Disabled | Flashcard syntax remains in note |
| Enabled | Flashcard line removed after collection |

**Note:** Only removes the flashcard line, not the card from database.

## Settings Summary Table

| Setting | Default | Recommendation |
|---------|---------|----------------|
| Review mode | Fullscreen | Fullscreen |
| Show review header | On | On |
| Show header stats | On | On |
| Show next review time | On | On |
| Continuous custom reviews | On | On |
| Default type-in mode | Off | Off or AI |
| Link status indicators | On | On |
| Status bar widget | On | On |
| Quick review in panel | On | On |
| Next day starts at | 4 | 4 |
| Remove content after collecting | Off | Off |

## Related Topics

- [Review Interface](../review/review-interface.md) — Review view
- [Type-in Mode](../review/type-in-mode.md) — Type-in feature
- [Scheduling](../concepts/scheduling.md) — Day boundaries
