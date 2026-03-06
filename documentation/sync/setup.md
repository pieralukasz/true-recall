# Cloud Sync Setup

True Recall Cloud Sync keeps your flashcards synchronized across multiple devices using Supabase backend.

## Prerequisites

- True Recall account (sign up at truerecall.app)
- Active subscription (cloud sync is a premium feature)
- Internet connection

## Setting Up Cloud Sync

### Step 1: Sign In

1. Settings → True Recall → Cloud Sync
2. Click "Sign in"
3. Enter your True Recall credentials
4. Authorize the connection

### Step 2: Initial Sync

After signing in:

1. Choose sync direction:
   - **Upload** — Send local data to cloud
   - **Download** — Replace local with cloud data
   - **Merge** — Combine both (recommended)

2. First sync processes all cards
3. May take a few minutes for large collections

### Step 3: Configure Sync Settings

| Setting | Description |
|---------|-------------|
| Auto sync | Sync automatically on changes |
| Sync interval | How often to sync (minutes) |
| Sync on start | Sync when Obsidian opens |
| Sync on review | Sync after completing reviews |

## Sync Status

The Cloud Sync tab shows:

| Status | Description |
|--------|-------------|
| Connected | Sync is active |
| Syncing... | Sync in progress |
| Last sync | Time of last successful sync |
| Pending changes | Local changes not yet synced |

## Authentication

### Using True Recall Account

The simplest option — uses your True Recall subscription:

1. Sign in with True Recall credentials
2. No additional configuration needed
3. Included with subscription

### Using Custom Supabase (Advanced)

For self-hosting:

1. Create Supabase project
2. Configure RPC functions (see developer docs)
3. Enter Supabase URL and key
4. Test connection

## Conflict Resolution

Cloud Sync uses **Last-Write-Wins (LWW)**:

- Most recent change wins
- Based on timestamp
- Millisecond precision

### When Conflicts Happen

- Same card edited on two devices
- Both devices offline, then sync
- Rapid successive changes

### Resolution

1. Later timestamp wins
2. Earlier change is preserved in history
3. No data loss, but may need manual review

## Sync Queue

Changes are queued for sync:

| Change Type | Synced |
|-------------|--------|
| Card created | ✅ |
| Card edited | ✅ |
| Card deleted | ✅ |
| Review completed | ✅ |
| Settings changed | ❌ (local) |

## Offline Mode

### Working Offline

- All changes saved locally
- Sync queue builds up
- Sync when back online

### Syncing After Offline

1. Connect to internet
2. Open True Recall
3. Auto-sync triggers
4. All queued changes upload

## Tips

### 1. Sync Regularly

Don't stay offline for extended periods to minimize conflicts.

### 2. Sync Before Major Changes

Manually sync before bulk operations.

### 3. Check Status

Periodically verify sync is working.

### 4. Use Auto Sync

Let the system sync automatically rather than manually.

## Troubleshooting

### "Not authenticated"

1. Sign out and sign back in
2. Check subscription is active
3. Verify internet connection

### Sync Fails

1. Check internet connection
2. Try manual sync
3. Sign out and sign in again
4. Check console for errors

### Conflicts Appear

1. Review affected cards
2. Manual edit if needed
3. Sync again

### Slow Sync

1. Large collections take longer
2. Check internet speed
3. First sync is slowest

## Related Topics

- [Using Sync](./using-sync.md) — Daily sync workflow
- [Backup & Restore](../data/backup-restore.md) — Local backups
- [Device Databases](../data/device-databases.md) — Multiple devices
