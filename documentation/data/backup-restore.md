# Backup & Restore

True Recall provides comprehensive backup options to protect your flashcard data and review history.

## Where Data is Stored

All True Recall data is stored in:

```
.true-recall/
├── true-recall-{device-id}.db    # SQLite database
└── backups/                       # Backup files
    ├── backup-2024-01-15-120000.db
    ├── backup-2024-01-14-120000.db
    └── ...
```

## Manual Backup

### Create Backup

Settings → Data & Backup → Manual backup → Create backup

Creates a timestamped backup file in `.true-recall/backups/`.

### When to Backup Manually

- Before major changes
- Before importing cards
- Before optimizing FSRS
- Before switching devices

## Automatic Backups

### On Plugin Load

Settings → Data & Backup → Automatic backup on load

Creates a backup each time Obsidian starts.

### Background Backups

Settings → Data & Backup → Background Backup

| Setting | Description |
|---------|-------------|
| Enable periodic backups | Auto-backup at intervals |
| Backup interval | Every 15/30/60/120/240 minutes |
| Activity-triggered | Backup after N reviews |
| Reviews before backup | Trigger threshold |

### Recommended Settings

```
☑ Enable periodic backups
Interval: Every 60 minutes
☑ Activity-triggered backup
Reviews before backup: 50
```

## Smart Retention

Instead of keeping all backups, use smart retention to keep useful backups while saving space.

Settings → Data & Backup → Smart Retention

| Tier | Setting | Description |
|------|---------|-------------|
| Hourly | 24 | Keep hourly backups for last 24 hours |
| Daily | 7 | Keep daily backups for last 7 days |
| Weekly | 4 | Keep weekly backups for last 4 weeks |

### How It Works

- **Hourly tier** — One backup per hour, keep last 24
- **Daily tier** — One backup per day, keep last 7 days
- **Weekly tier** — One backup per week, keep last 4 weeks

Older backups are automatically deleted.

## Restoring from Backup

### From Settings

Settings → Data & Backup → Manual backup → Restore...

1. Click "Restore..."
2. Select backup file from list
3. Preview backup info (date, card count)
4. Confirm restore
5. **Obsidian reloads** to apply changes

### What Gets Restored

- All flashcards
- Review history
- FSRS scheduling data
- Statistics
- Note types

### After Restore

1. Verify cards appear correctly
2. Check Dashboard for expected counts
3. Resume reviewing

## Backup Status

Settings → Data & Backup → Backup Status

Shows:
- Last backup time
- Next scheduled backup
- Reviews since last backup
- Total backup count

## Best Practices

### 1. Enable Background Backups

Don't rely on manual backups. Set up automatic backups.

### 2. Use Smart Retention

Keeps useful history without filling disk space.

### 3. Backup Before Major Changes

Create manual backup before:
- Importing large decks
- Running FSRS optimization
- Changing many settings

### 4. Test Restores Occasionally

Verify your backups work by doing a test restore.

### 5. External Backup

For extra safety, periodically copy `.true-recall/backups/` to external storage.

## Troubleshooting

### Backup Fails

1. Check disk space
2. Check file permissions
3. Try manual backup

### Restore Fails

1. Verify backup file isn't corrupted
2. Check Obsidian console for errors
3. Try an older backup

### Missing Backups

1. Check backup folder exists
2. Verify retention settings aren't too aggressive
3. Look for backups in wrong location

### After Restore, Cards Missing

1. Backup may be from before cards were created
2. Try a more recent backup
3. Check if cards were orphaned

## Related Topics

- [Device Databases](./device-databases.md) — Multi-device setup
- [Data Integrity](./integrity-check.md) — Verify database health
- [Anki Import/Export](./anki-import-export.md) — External backup options
