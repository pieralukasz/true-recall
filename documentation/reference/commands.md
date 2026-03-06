# Commands Reference

All True Recall commands accessible via Command Palette (Cmd/Ctrl + P).

## View Commands

| Command | Description |
|---------|-------------|
| Open dashboard | Open the main dashboard view |
| Open flashcard panel | Open the sidebar panel for current note |
| Open card browser | Open the card browser for all flashcards |
| Open statistics panel | Open the statistics view |
| Open FSRS simulator | Open the FSRS interval simulator |

## Review Commands

| Command | Description |
|---------|-------------|
| Review flashcards from current note | Start review session for active note |
| Review today's new cards | Start review of all due cards |

## Card Management Commands

| Command | Description |
|---------|-------------|
| Import flashcards | Open the import studio for AI generation |
| Create image occlusion card | Open image occlusion editor |
| Manage note types | Open note type manager |
| Add flashcard uid to current note | Add `flashcard_uid` to frontmatter |

## Data Commands

| Command | Description |
|---------|-------------|
| Create database backup | Manually create backup |
| Import Anki deck (.apkg) | Import from Anki |
| Export to Anki (.apkg) | Export to Anki format |
| Export as CSV/TSV | Export to spreadsheet format |

## Note Management Commands

| Command | Description |
|---------|-------------|
| Set FSRS preset for current note | Set preset via frontmatter |
| Archive current note | Archive note (exclude from reviews) |
| Unarchive current note | Remove archive flag |

## Utility Commands

| Command | Description |
|---------|-------------|
| Undo last flashcard action | Undo most recent operation |
| Insert project dashboard | Insert dashboard code block |
| Create master dashboard note | Create new dashboard note |

## Migration Commands

| Command | Description |
|---------|-------------|
| Migrate legacy projects to parents | Migration utility |
| Migrate flashcards to block format | Convert inline to block format |

## Command Details

### Open Dashboard

Opens the main dashboard showing:
- Today's card counts
- Project tree
- Note list
- Calendar heatmap

Shortcut: Recommended `Cmd/Ctrl + D`

### Open Flashcard Panel

Opens sidebar panel showing:
- Cards for current note
- Uncollected cards
- Quick actions

### Review Flashcards from Current Note

Starts review session limited to:
- Cards from the active markdown file
- Respects daily limits

### Review Today's New Cards

Starts review session with:
- All due cards across all notes
- New cards up to daily limit
- Learning cards

### Create Image Occlusion Card

Opens image occlusion editor:
- Select image from vault
- Draw occlusion regions
- Generate cards

### Import Flashcards

Opens Import Studio:
- Paste or type content
- AI generates cards
- Preview and import

### Manage Note Types

Opens Note Type Manager:
- View all note types
- Create/edit/delete types
- Configure templates

### Create Database Backup

Immediately creates backup:
- Timestamped file
- Stored in `.true-recall/backups/`

### Import Anki Deck

Opens Anki import wizard:
- Select `.apkg` file
- Configure options
- Preview and import

### Export to Anki

Opens Anki export dialog:
- Configure options
- Select cards
- Create `.apkg` file

### Export as CSV/TSV

Opens CSV export dialog:
- Choose format
- Select columns
- Export file

### Set FSRS Preset for Current Note

Opens preset selector:
- Choose preset
- Adds `fsrs_preset:` to frontmatter

### Archive Current Note

Adds `archived: true` to frontmatter:
- Note excluded from reviews
- Cards hidden from Dashboard

### Unarchive Current Note

Removes `archived: true`:
- Note returns to review queue
- Cards visible in Dashboard

### Undo Last Flashcard Action

Undoes most recent operation:
- Card creation/deletion
- Rating
- Move
- Edit

### Insert Project Dashboard

Inserts code block:
````markdown
```true-recall-dashboard
```
````

Customize with options.

### Create Master Dashboard Note

Creates new note with:
- Dashboard widget
- Common widgets pre-configured

## Related Topics

- [Keyboard Shortcuts](../configuration/keyboard-shortcuts.md) — Set shortcuts
- [Context Menus](./context-menus.md) — Right-click actions
