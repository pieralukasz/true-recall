# Device Databases

True Recall supports multiple device databases, allowing you to work on different machines or maintain separate study profiles.

## How Device Databases Work

Each device has its own SQLite database:

```
.true-recall/
├── true-recall-device1.db
├── true-recall-device2.db
└── true-recall-device3.db
```

The active database is determined by the device ID stored in `.true-recall/device-id`.

## Current Device

Settings → Data & Backup → Device Database

Shows:
- **Device ID** — Unique identifier
- **Device name** — Optional friendly name
- **Database path** — File location

### Naming Your Device

1. Enter a name like "work-laptop" or "phone"
2. Click Save
3. Name appears in device list

## Switching Devices

### From Settings

Settings → Data & Backup → Device Database → Switch...

1. Click "Switch..."
2. Select from available devices
3. Or import from another location
4. Obsidian reloads with new database

### Use Cases

- Switching between work and personal devices
- Testing a configuration
- Using someone else's database

## Importing a Database

### From File

1. Settings → Device Database → Switch...
2. Click "Import from file"
3. Select `.db` file
4. Choose to create new device or replace existing

### From Another Vault

If you have True Recall in multiple vaults:

1. Copy the `.db` file from other vault
2. Use "Import from file"
3. Select the copied file

## Multiple Profiles

Use device databases to maintain separate profiles:

| Profile | Use Case |
|---------|----------|
| Personal | Personal learning |
| Work | Professional development |
| Study | Academic courses |
| Test | Experimentation |

### Creating a Profile

1. Switch to new device
2. Enter profile name
3. Start with empty database or import

### Switching Profiles

Switch devices to change profiles.

## Database Conflicts

If you use the same database on multiple devices without cloud sync:

### Warning Signs

- Reviews appear that you didn't do
- Missing reviews
- Inconsistent statistics

### Solutions

1. Use Cloud Sync for automatic sync
2. Or manually manage (one device at a time)
3. Or keep completely separate databases

## Backup and Devices

Backups are stored per-device:

```
.true-recall/backups/
├── device1/
│   ├── backup-2024-01-15.db
│   └── ...
└── device2/
    ├── backup-2024-01-15.db
    └── ...
```

## Tips

### 1. Name Devices Descriptively

Use names like "macbook-work", "iphone", "ipad-personal".

### 2. Don't Edit Database Files Directly

Use True Recall's interface to avoid corruption.

### 3. Backup Before Switching

Create backup before switching to a different device database.

### 4. Use Cloud Sync Instead

For syncing between devices, Cloud Sync is easier than manual switching.

## Troubleshooting

### Can't Switch Devices

1. Close all review sessions
2. Try again
3. Restart Obsidian if needed

### Database Not Found

1. Check `.true-recall/` folder
2. Verify file exists
3. Check file permissions

### After Switch, Data Missing

1. You may have switched to a different/empty database
2. Switch back to original device
3. Check backup folder

## Related Topics

- [Backup & Restore](./backup-restore.md) — Database backups
- [Cloud Sync](../sync/setup.md) — Automatic syncing
- [Data Integrity](./integrity-check.md) — Check database health
