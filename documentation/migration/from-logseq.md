# Migrating from Logseq

This guide helps you transition from Logseq to True Recall.

## Key Differences

| Feature | Logseq | True Recall |
|---------|--------|-------------|
| App | Separate | Obsidian plugin |
| Flashcards | Built-in | Plugin-based |
| Algorithm | SM-2 | FSRS v6 |
| Card syntax | `#card` | `#flashcard` |
| Organization | Pages/blocks | Projects |
| AI features | None | Full AI support |

## Logseq Flashcard Syntax

### Basic Cards

Logseq uses `#card`:

```markdown
Question
- Answer
  #card
```

True Recall equivalent:
```markdown
Question
::Answer
#flashcard
```

### Cloze Cards

Logseq:
```markdown
This is {{cloze important}} text
```

True Recall:
```markdown
This is {{c1::important}} text
#flashcard
```

Note: True Recall requires numbered clozes.

### Reversed Cards

Logseq:
```markdown
Question
- Answer
  #card
  #reverse
```

True Recall:
```markdown
Question
:::Answer
#flashcard
```

## Exporting from Logseq

### Step 1: Export to Markdown

1. Open Logseq
2. Go to Settings → Export
3. Choose "Export Graph"
4. Select "Markdown"
5. Export to folder

### Step 2: Review Export

Check exported files:
- All pages present
- Images included
- Links converted

## Importing to Obsidian

### Step 1: Create Vault

1. Create new Obsidian vault
2. Or use existing vault

### Step 2: Copy Logseq Export

1. Copy exported Markdown files
2. Paste into vault
3. Let Obsidian index

### Step 3: Install True Recall

1. Install True Recall
2. Enable plugin
3. Configure settings

## Converting Syntax

### Manual Conversion

For each note with cards:

1. Find `#card` markers
2. Convert to `#flashcard`
3. Convert syntax:

| Logseq | True Recall |
|--------|-------------|
| `- Answer #card` | `::Answer #flashcard` |
| `{{cloze text}}` | `{{c1::text}} #flashcard` |
| `#reverse` | Use `:::` instead of `::` |

### Semi-Automated Conversion

Use find and replace:

1. Replace `#card` → `#flashcard`
2. Replace `{{cloze` → `{{c1::`
3. Manual review for edge cases

## Handling Logseq Features

### Outliner Format

Logseq uses bullet-based outliner:

```markdown
- Topic
  - Subtopic
    - Detail
      #card
      Answer
```

Convert to standard Markdown:
```markdown
## Topic

### Subtopic

Detail
::Answer
#flashcard
```

### Block References

Logseq block references:
- No direct equivalent
- Use Obsidian links: `[[note#heading]]`
- Or transclusion: `![[note#heading]]`

### Daily Notes

Logseq daily notes:
- Work in Obsidian too
- Add `project: Daily` for organization

### Properties

Logseq properties:
```markdown
:: property:: value
```

Convert to YAML frontmatter:
```yaml
---
property: value
---
```

## Post-Migration

### Step 1: Collect Cards

1. Open Flashcard Panel
2. See uncollected cards
3. Collect wanted cards

### Step 2: Organize into Projects

1. Add `project:` to frontmatter
2. Create project hierarchy
3. Assign FSRS presets

### Step 3: Review and Test

1. Test review sessions
2. Check all cards work
3. Verify scheduling

## Tips

### 1. Export Everything

Export all of Logseq, not just flashcards.

### 2. Keep Logseq During Transition

Don't delete Logseq until confident.

### 3. Batch Convert

Convert similar card types together.

### 4. Use AI Generation

For complex content, use AI to regenerate cards.

### 5. Review Conversion

Spot-check converted cards for errors.

## Common Issues

### Cards Not Detected

1. Ensure `#flashcard` tag present
2. Check syntax is correct
3. Refresh Flashcard Panel

### Clozes Not Numbered

1. Manually number: `{{c1::}}`, `{{c2::}}`
2. Or use AI to regenerate

### Formatting Lost

1. Some Logseq formatting doesn't transfer
2. Manually restore complex formatting
3. Use Markdown equivalents

## Related Topics

- [Basic Cards](../creation/basic-cards.md) — Card syntax
- [Cloze Deletions](../creation/cloze-deletions.md) — Cloze syntax
- [AI Generation](../creation/ai-generation.md) — Generate cards
- [Projects](../concepts/projects.md) — Organizing notes
