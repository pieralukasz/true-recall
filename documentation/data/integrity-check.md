# Database Integrity Check

The **Integrity Check** scans your database for issues like orphaned cards, missing references, and corrupted data.

## Common Issues

| Issue | Description |
|-------|-------------|
| Orphaned cards | Cards without source notes |
| Orphaned notes | Notes without note types |
| Missing review logs | Logs without matching cards |
| Duplicate UIDs | Multiple notes with same UID |
| Corrupted records | Malformed database entries |

## Running Integrity Check

Settings → Data & Backup → Database Integrity → Check now

### Check Process

1. Click "Check now"
2. Scans database (usually takes seconds)
3. Report shows found issues
4. Option to repair

## Check Report

```
┌─────────────────────────────────────────┐
│  Integrity Check Results                │
├─────────────────────────────────────────┤
│  ✓ Cards: 1,234                         │
│  ✓ Notes: 89                            │
│  ✓ Review logs: 5,678                   │
│                                         │
│  Issues found:                          │
│  ⚠ Orphaned cards: 3                    │
│  ⚠ Orphaned notes: 1                    │
│  ⚠ Duplicate UIDs: 0                    │
│                                         │
│  [Repair All]  [Export Report]          │
└─────────────────────────────────────────┘
```

## Repairing Issues

### Automatic Repair

Click "Repair All" to fix found issues:

| Issue | Repair Action |
|-------|---------------|
| Orphaned cards | Delete or reassign |
| Orphaned notes | Reassign to default type |
| Missing review logs | Delete orphaned logs |
| Duplicate UIDs | Generate new UIDs |

### Manual Review

For some issues, you can choose:

- **Keep** — Leave as-is
- **Delete** — Remove the record
- **Reassign** — Link to existing entity

## When to Run Integrity Check

### Recommended Times

- After importing from Anki
- After plugin updates
- If noticing unexpected behavior
- Monthly as maintenance

### Signs You Need It

- Cards appearing that shouldn't exist
- Missing cards
- Statistics seem wrong
- Errors in console

## What Gets Checked

### Cards

| Check | Description |
|-------|-------------|
| Source note exists | Card's source note is valid |
| Note type valid | Card's note type exists |
| FSRS data valid | Scheduling data is coherent |
| No duplicates | No identical cards |

### Notes

| Check | Description |
|-------|-------------|
| Note type assigned | Has a valid note type |
| UID unique | No duplicate flashcard_uid |
| Fields valid | Required fields present |

### Review Logs

| Check | Description |
|-------|-------------|
| Card exists | Referenced card exists |
| Rating valid | Rating is 1-4 |
| Timestamp valid | Review time is reasonable |

## After Repair

1. Review Dashboard for changes
2. Check affected notes
3. Resume normal use

## Troubleshooting

### Check Fails to Complete

1. Database may be locked
2. Close review sessions
3. Restart Obsidian
4. Try again

### Repair Doesn't Fix Issue

1. Run check again
2. Check for file permissions
3. Try restoring from backup
4. Check console for errors

### Data Lost After Repair

1. Restore from backup
2. Run check again with more caution
3. Export report before repairing

## Related Topics

- [Backup & Restore](./backup-restore.md) — Restore if needed
- [Anki Import](./anki-import-export.md) — Common source of issues
- [Device Databases](./device-databases.md) — Multiple databases
