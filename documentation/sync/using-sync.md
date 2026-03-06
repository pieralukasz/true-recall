# Using Cloud Sync

Once Cloud Sync is set up, this guide covers daily usage and best practices for keeping your data synchronized.

## Daily Workflow

### Automatic Sync

With auto-sync enabled:

1. Open Obsidian → Sync starts
2. Make changes → Queued for sync
3. Complete reviews → Sync triggers
4. Close Obsidian → Final sync

### Manual Sync

Trigger sync manually:

1. Settings → Cloud Sync → Sync now
2. Or use command: "Sync now"

## Multi-Device Usage

### Recommended Pattern

1. **Morning (Device A)**
   - Open Obsidian
   - Auto-sync downloads overnight changes
   - Study session

2. **Evening (Device B)**
   - Open Obsidian
   - Auto-sync downloads day's changes
   - Evening review

### Switching Devices

Before switching:

1. Sync current device
2. Wait for completion
3. Open on new device
4. Sync downloads latest

## Sync Indicators

### Status Bar

Shows sync status:
- ✓ Synced
- ⟳ Syncing...
- ⚠ Sync error

### Dashboard

Sync status card shows:
- Last sync time
- Pending changes
- Device count

## What Syncs

### Synchronized

| Data | Synced |
|------|--------|
| Flashcards | ✅ |
| Review history | ✅ |
| FSRS scheduling | ✅ |
| Note types | ✅ |
| Projects | ✅ |

### Not Synchronized

| Data | Local Only |
|------|------------|
| Plugin settings | ✅ |
| Device name | ✅ |
| Backup settings | ✅ |
| UI preferences | ✅ |

## Conflict Handling

### When Conflicts Occur

1. Both warning appears
2. LWW resolves automatically
3. Check affected cards manually

### Reviewing Conflicts

In Card Browser:

1. Search: `conflict:true`
2. Review cards with conflicts
3. Edit if needed

## Offline Scenarios

### Short Offline (Hours)

- Changes queue locally
- Sync when online
- Usually no issues

### Long Offline (Days+)

- More potential conflicts
- Review after syncing
- May need manual merge

### Best Practice

If you know you'll be offline:

1. Sync before going offline
2. Avoid creating duplicate cards
3. Sync as soon as online

## Sync Performance

### Factors Affecting Speed

| Factor | Impact |
|--------|--------|
| Collection size | Larger = slower |
| Pending changes | More = slower |
| Internet speed | Faster = better |
| First sync | Slowest |

### Optimizing Sync

1. Sync regularly (smaller batches)
2. Good internet connection
3. Don't queue thousands of changes

## Sync Frequency

### Recommended Settings

| Setting | Recommended |
|---------|-------------|
| Auto sync | Enabled |
| Sync interval | 15-30 minutes |
| Sync on start | Enabled |
| Sync on review | Enabled |

### Why Frequent Sync?

- Smaller batches
- Fewer conflicts
- More up-to-date across devices

## Multiple Vaults

### Same Account, Different Vaults

Each vault is independent:

- Separate sync state
- Separate device ID
- Can't merge vaults

### Best Practice

Use one vault with projects instead of multiple vaults.

## Troubleshooting Daily Sync

### "Sync taking too long"

1. Check pending changes count
2. Let it complete
3. Sync more frequently going forward

### "Changes not appearing on other device"

1. Sync both devices
2. Check sync completed
3. Check same account signed in

### "Duplicate cards appeared"

1. May be from conflict resolution
2. Delete duplicates in Card Browser
3. Sync again

### "Data reverted to old version"

1. LWW conflict resolution
2. Check for conflicts
3. May need to re-apply changes

## Related Topics

- [Cloud Sync Setup](./setup.md) — Initial setup
- [Backup & Restore](../data/backup-restore.md) — Local backups
- [Statistics](../views/statistics.md) — Check sync impact on stats
