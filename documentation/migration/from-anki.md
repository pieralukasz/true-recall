# Migrating from Anki

This guide helps you move your flashcards from Anki to True Recall.

## Before You Start

### What Transfers

| Data | Transfers |
|------|-----------|
| Cards | ✅ |
| Note types | ✅ |
| Images | ✅ |
| Audio | ✅ |
| Review history | ✅ |
| Intervals | ✅ (converted to FSRS) |
| Decks | ✅ (become projects) |
| Tags | ✅ |
| Addons | ❌ |
| Card styling | Partial (basic CSS) |

### What Doesn't Transfer

- Anki addons
- Advanced card styling
- Anki-specific features (filtered decks, etc.)
- Some LaTeX rendering differences

## Step-by-Step Migration

### Step 1: Export from Anki

1. Open Anki
2. Select deck(s) to export
3. File → Export
4. Choose format: **Anki Deck Package (.apkg)**
5. Check "Include scheduling information"
6. Check "Include media"
7. Export

### Step 2: Import to True Recall

1. Open True Recall Settings
2. Go to Data & Backup
3. Click "Import .apkg"
4. Select your exported file
5. Review the preview

### Step 3: Configure Import Options

| Option | Recommendation |
|--------|----------------|
| Include scheduling | ✅ Yes (preserve history) |
| Import media | ✅ Yes |
| Map note types | Review mappings |
| Target project | Optional |

### Step 4: Review Note Type Mappings

Anki note types map to True Recall types:

| Anki Type | True Recall Type |
|-----------|------------------|
| Basic | Basic |
| Basic (reversed) | Reversed |
| Cloze | Cloze |
| Image Occlusion | Image Occlusion |
| Custom types | Creates new type |

For custom types:
1. Review field mappings
2. Check template conversion
3. Adjust if needed

### Step 5: Complete Import

1. Click "Import"
2. Wait for processing
3. Check completion summary
4. Review imported cards

### Step 6: Post-Import Checks

1. **Run integrity check** — Settings → Data → Check now
2. **Browse cards** — Open Card Browser, review
3. **Check media** — Verify images/audio work
4. **Test review** — Do a short review session

## Converting SM-2 to FSRS

Anki uses SM-2, True Recall uses FSRS. The conversion:

### Interval Conversion

| Anki | True Recall |
|------|-------------|
| Ease factor (2.5) | Stability (calculated) |
| Interval | Preserved initially |
| Lapses | Preserved |

### What Happens

1. Anki intervals converted to FSRS stability
2. First review with FSRS adjusts based on your rating
3. Over time, FSRS learns your patterns

### First Few Days

- Intervals may feel slightly different
- FSRS adapts after a few reviews
- Give it 1-2 weeks to calibrate

## Handling Media

### Images

- Extracted from .apkg
- Saved to vault attachments folder
- Links updated in cards

### Audio

- Extracted similarly
- May need manual verification
- Check playback works

### Large Media Files

If .apkg is very large:
1. Consider exporting without media first
2. Then manually copy media folder
3. Re-link in True Recall

## Deck to Project Mapping

Anki decks become True Recall projects:

```
Anki:
├── Biology
│   ├── Anatomy
│   └── Physiology

True Recall:
├── Biology (project)
│   ├── Anatomy (project)
│   └── Physiology (project)
```

### After Import

Assign notes to projects:
1. Notes get `project:` frontmatter
2. Or assign manually from Dashboard

## Common Issues

### Cards Missing

1. Check note type mapping
2. Some types may not import fully
3. Run integrity check

### Images Not Showing

1. Check vault attachments folder
2. Re-import with media option
3. Manually copy media

### Intervals Seem Wrong

1. SM-2 to FSRS conversion is approximate
2. Give FSRS time to learn
3. Run FSRS optimization after 400+ reviews

### Templates Look Different

1. Anki templates use different syntax
2. Review in Note Type Manager
3. Adjust CSS as needed

## Tips

### 1. Start with a Test Deck

Import one deck first to test the process.

### 2. Backup Before Import

Create a True Recall backup before importing.

### 3. Keep Anki for a While

Keep your Anki deck until you're confident in True Recall.

### 4. Run FSRS Optimization

After 400+ reviews in True Recall, optimize FSRS parameters.

## Related Topics

- [Anki Import/Export](../data/anki-import-export.md) — Technical details
- [FSRS Optimization](../scheduling/fsrs-optimization.md) — Tune FSRS
- [Note Types](../concepts/note-types.md) — Customize templates
