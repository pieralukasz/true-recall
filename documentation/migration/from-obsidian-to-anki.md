# Migrating from Obsidian to Anki

If you're using the "Obsidian to Anki" plugin, this guide helps you transition to True Recall.

## Comparison

| Feature | Obsidian to Anki | True Recall |
|---------|------------------|-------------|
| Lives in Obsidian | ✅ | ✅ |
| Separate Anki app | ✅ Required | ❌ Not needed |
| AI generation | ❌ | ✅ |
| Type-in mode | ❌ | ✅ |
| Image occlusion | ❌ | ✅ |
| Inline editing | ❌ | ✅ |
| FSRS algorithm | ❌ (uses Anki's SM-2) | ✅ |
| Note types | Limited | Full support |

## Key Differences

### Card Storage

| Plugin | Storage |
|--------|---------|
| Obsidian to Anki | Cards synced to Anki |
| True Recall | Cards in Obsidian + SQLite |

### Workflow

| Obsidian to Anki | True Recall |
|------------------|-------------|
| Write in Obsidian | Write in Obsidian |
| Sync to Anki | Review in Obsidian |
| Review in Anki | No sync needed |

## Migration Steps

### Step 1: Install True Recall

1. Install True Recall plugin
2. Enable it
3. Keep Obsidian to Anki for now

### Step 2: Export from Anki

Since your cards are in Anki:

1. Open Anki
2. Select decks from Obsidian to Anki
3. File → Export → .apkg
4. Include scheduling and media

### Step 3: Import to True Recall

1. True Recall Settings → Import .apkg
2. Select exported file
3. Configure import
4. Complete import

### Step 4: Verify Import

1. Check card counts
2. Review cards in Card Browser
3. Test a review session

### Step 5: Transition Period

Keep both plugins for a while:

1. New cards → Create in True Recall
2. Old cards → Review both places
3. Gradually phase out Obsidian to Anki

### Step 6: Disable Obsidian to Anki

When comfortable:

1. Disable Obsidian to Anki plugin
2. Remove Anki scheduled reviews
3. Use True Recall exclusively

## Converting Syntax

### Basic Cards

Both use similar syntax:

```
Obsidian to Anki:
Question
?
Answer

True Recall:
Question
::Answer
```

You can keep existing syntax — True Recall auto-detects.

### Cloze

Both support cloze:

```
{{c1::text}}
```

No conversion needed.

### Tags

| Obsidian to Anki | True Recall |
|------------------|-------------|
| #tag | #flashcard #tag |
| Tags in Anki | Tags in database |

Add `#flashcard` tag to existing cards.

## Handling Existing Notes

### Option 1: Import and Keep

Import from Anki, keep both sets of cards.

### Option 2: Replace

Import from Anki, remove Obsidian to Anki cards.

### Option 3: Gradual

Import from Anki, gradually convert notes.

## Project Mapping

Anki decks become projects:

1. Import assigns `project:` frontmatter
2. Review in Dashboard
3. Adjust as needed

## Tips

### 1. Keep Anki as Backup

Don't delete your Anki collection until confident.

### 2. Add flashcard Tag

Add `#flashcard` to existing card syntax in notes.

### 3. Review Syntax Compatibility

Most syntax is compatible, but check edge cases.

### 4. Use the Flashcard Panel

The panel shows both collected and uncollected cards.

## Related Topics

- [Migrating from Anki](./from-anki.md) — Anki migration details
- [Basic Cards](../creation/basic-cards.md) — Card syntax
- [Cloze Deletions](../creation/cloze-deletions.md) — Cloze syntax
