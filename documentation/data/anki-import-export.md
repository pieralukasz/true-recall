# Anki Import/Export

True Recall can import flashcards from Anki `.apkg` files and export your cards back to Anki format.

## Importing from Anki

### Opening Import

Settings → Data & Backup → Anki Import/Export → Import .apkg

Or Command Palette → "Import Anki deck"

### Import Process

1. **Select file** — Choose `.apkg` file
2. **Preview** — See cards to import
3. **Configure** — Set options
4. **Import** — Process cards
5. **Review** — Check imported cards

### Import Options

| Option | Description |
|--------|-------------|
| Include scheduling | Import Anki intervals and review history |
| Import media | Include images and audio |
| Map note types | Match Anki types to True Recall types |
| Target project | Assign imported cards to project |

### Note Type Mapping

Anki note types are converted:

| Anki Type | True Recall Type |
|-----------|------------------|
| Basic | Basic |
| Basic (and reversed card) | Reversed |
| Cloze | Cloze |
| Image Occlusion | Image Occlusion |
| Custom | Creates new type |

### Scheduling Conversion

Anki uses SM-2, True Recall uses FSRS. Conversion:

| Anki Data | FSRS Equivalent |
|-----------|-----------------|
| Ease factor | Converted to stability |
| Interval | Used as initial interval |
| Lapses | Preserved |
| Review history | Converted to FSRS format |

### Media Files

Images and audio are:

1. Extracted from `.apkg`
2. Saved to vault attachments folder
3. Linked in cards

### Import Preview

Before importing, see:

- Number of cards
- Number of notes
- Note types found
- Media files included
- Any warnings

## Exporting to Anki

### Opening Export

Settings → Data & Backup → Anki Import/Export → Export .apkg

Or Command Palette → "Export to Anki"

### Export Options

| Option | Description |
|--------|-------------|
| Include scheduling | Export intervals and review history |
| Include media | Export images and audio |
| Deck name | Name for Anki deck |
| Filter | Export specific cards |

### Export Process

1. **Configure** — Set export options
2. **Select cards** — Choose what to export
3. **Export** — Create `.apkg` file
4. **Save** — Choose save location

### What Gets Exported

| Data | Exported? |
|------|-----------|
| Card content | ✅ Yes |
| Images | ✅ Yes |
| Audio | ✅ Yes |
| Intervals | ✅ Optional |
| Review history | ✅ Optional |
| FSRS parameters | ❌ Converted to SM-2 |
| Tags | ✅ Yes |
| Project → Deck | ✅ Yes |

### FSRS to SM-2 Conversion

FSRS data is approximated for Anki:

| FSRS | SM-2 Approximation |
|------|-------------------|
| Stability | → Ease factor |
| Difficulty | → Adjusts ease |
| Interval | Preserved |

Note: Some precision is lost in conversion.

## Import/Export Tips

### Before Importing

1. Backup your True Recall database
2. Note your current card counts
3. Consider creating a test project first

### After Importing

1. Run integrity check
2. Review imported cards in Card Browser
3. Check for missing media
4. Adjust note types if needed

### Before Exporting

1. Filter to specific cards if needed
2. Check media links work
3. Consider exporting per-project

### After Exporting

1. Test import in Anki
2. Verify card counts match
3. Check media displays correctly

## Troubleshooting

### Import Fails

1. Check `.apkg` file isn't corrupted
2. Try smaller deck first
3. Check console for errors
4. Update True Recall

### Missing Media After Import

1. Check vault attachments folder
2. Re-import with "Import media" enabled
3. Manually copy media from Anki collection

### Cards Look Wrong After Import

1. Check note type mapping
2. Edit templates in Note Type Manager
3. Adjust CSS styling

### Export File Too Large

1. Export without media
2. Export smaller batches
3. Compress media before export

### Anki Can't Open Export

1. Check Anki version (2.1+ required)
2. Re-export with different options
3. Try importing to fresh Anki profile

## Related Topics

- [Note Types](../concepts/note-types.md) — Customizing templates
- [Backup & Restore](./backup-restore.md) — Backup before importing
- [Integrity Check](./integrity-check.md) — Check after importing
