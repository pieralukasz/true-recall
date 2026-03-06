# Archiving Notes

**Archiving** removes a note and its cards from the review queue without deleting them. Useful for completed courses or topics you want to pause.

## What Archiving Does

| Effect | Before Archive | After Archive |
|--------|----------------|---------------|
| In review queue | ✅ Yes | ❌ No |
| In Dashboard | ✅ Visible | Hidden* |
| In statistics | ✅ Counted | ❌ Not counted |
| Cards exist | ✅ Yes | ✅ Yes |
| Can be restored | — | ✅ Yes |

*Archived notes can be shown by toggling "Show archived"

## Archiving a Note

### From Dashboard

1. Open Dashboard
2. Find the note
3. Right-click → Archive

### From Command

1. Open the note
2. Command Palette → "Archive current note"

### From Frontmatter

```yaml
---
archived: true
---
```

## Unarchiving a Note

### From Dashboard

1. Open Dashboard
2. Toggle "Show archived"
3. Find the archived note
4. Right-click → Unarchive

### From Command

1. Open the archived note
2. Command Palette → "Unarchive current note"

### From Frontmatter

Remove `archived: true` or set to `false`:

```yaml
---
archived: false
---
```

## Viewing Archived Notes

### In Dashboard

1. Open Dashboard
2. Toggle "Show archived" switch
3. Archived notes appear with archive icon

### In Card Browser

Filter by archived state:
1. Open Card Browser
2. Search: `archived:true`

## When to Archive

### Good Reasons to Archive

- Completed a course
- Topic no longer relevant
- Taking a break from a subject
- Reducing review load temporarily
- Seasonal topics (e.g., holiday-specific)

### When NOT to Archive

- Just want to reduce reviews → Adjust daily limits instead
- Cards are difficult → Use suspend or easier preset
- Temporary pause → Consider Easy Days feature

## Archive vs Other Options

| Action | Effect | Reversible |
|--------|--------|------------|
| Archive | Hide from reviews | ✅ Yes |
| Suspend | Pause individual cards | ✅ Yes |
| Delete | Remove permanently | ❌ No |
| Reduce limits | Fewer reviews | ✅ Yes |

## Archived Note Behavior

### Review Queue

Archived notes' cards:
- Are NOT included in due counts
- Do NOT appear in review sessions
- Keep their FSRS scheduling data

### Statistics

Archived cards:
- Are excluded from statistics
- Don't count toward retention calculations
- Are hidden from most charts

### Dashboard

Archived notes:
- Hidden by default
- Show when "Show archived" enabled
- Display archive icon

### Search

Archived notes:
- Still searchable in Card Browser
- Filter with `archived:true`

## Restoring Reviews After Archive

When you unarchive:

1. Cards return to review queue
2. Due dates are recalculated based on last review
3. May have accumulated backlog

### Handling Backlog

After unarchiving, you may have many due cards:

1. Use **Postpone** to spread them out
2. Or do a cram session
3. Or adjust daily limits temporarily

## Bulk Archiving

### Multiple Notes

1. Open Dashboard
2. Select multiple notes (Shift+Click)
3. Right-click → Archive

### By Project

Archive an entire project:

1. Assign all notes to a project
2. Archive each note
3. Or use frontmatter: set `archived: true` on all notes

## Tips

### 1. Use for Completed Courses

After finishing a course, archive those notes to reduce daily load.

### 2. Seasonal Archiving

Archive holiday-specific or seasonal content when not relevant.

### 3. Check Before Archiving

Review the note's cards before archiving to ensure you're caught up.

### 4. Unarchive Gradually

When bringing back archived content, unarchive in batches to avoid overwhelming review queue.

## Related Topics

- [Projects](./projects.md) — Organizing notes
- [Scheduling](../concepts/scheduling.md) — Review limits
- [Load Balancing](../scheduling/load-balancing.md) — Managing workload
