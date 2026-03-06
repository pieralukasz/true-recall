# Migrating from RemNote

This guide helps you transition from RemNote to True Recall.

## Key Differences

| Feature | RemNote | True Recall |
|---------|---------|-------------|
| App | Separate | Obsidian plugin |
| Flashcards | Inline | Inline + database |
| Algorithm | SM-2 | FSRS v6 |
| Note organization | Rem hierarchy | Projects |
| AI features | Limited | Full AI support |
| Open format | Proprietary | Markdown |

## Exporting from RemNote

### Option 1: Markdown Export

1. Open RemNote
2. Go to Settings → Export
3. Choose "Markdown"
4. Export all documents
5. Save to folder

### Option 2: PDF + Manual

For complex documents:
1. Export as PDF
2. Manually recreate in Obsidian
3. Use AI generation for cards

## RemNote Syntax Conversion

### Basic Cards

| RemNote | True Recall |
|---------|-------------|
| `Question::Answer` | `Question :: Answer` |
| `Question:::Answer` | `Question ::: Answer` (reversed) |

Add `#flashcard` tag:
```
Question::Answer #flashcard
```

Or convert:
```
Question::Answer
     ↓
Question
::Answer
#flashcard
```

### Cloze Cards

| RemNote | True Recall |
|---------|-------------|
| `{{text}}` | `{{c1::text}}` |
| `{{text}}` (second) | `{{c2::text}}` |

RemNote auto-numbers clozes; True Recall requires explicit numbers.

### Multi-line Cards

RemNote:
```
Question::
• Point 1
• Point 2
```

True Recall:
```
Question
::
- Point 1
- Point 2
#flashcard
```

## Importing to Obsidian

### Step 1: Create Vault

1. Create new Obsidian vault
2. Or add to existing vault

### Step 2: Copy RemNote Export

1. Copy exported Markdown files
2. Paste into vault folder
3. Let Obsidian index

### Step 3: Install True Recall

1. Install True Recall
2. Enable plugin
3. Configure settings

### Step 4: Convert Syntax

For each note:

1. Add `#flashcard` tags
2. Convert `::` to `::` with newlines
3. Number cloze deletions
4. Collect cards

### Automated Conversion (Optional)

Create a script to:
1. Find `Question::Answer` patterns
2. Convert to True Recall format
3. Add `#flashcard` tags

## Handling RemNote Features

### Document Hierarchy

RemNote's hierarchy becomes:
- Obsidian folders
- True Recall projects

### PDF Annotations

RemNote PDF annotations:
1. Export PDFs separately
2. Recreate annotations in Obsidian
3. Or use Obsidian PDF++ plugin

### Rems with Images

Images in RemNote:
1. Export includes images
2. Copy to vault attachments
3. Update image links

### Portals and References

RemNote portals/references:
1. No direct equivalent
2. Use Obsidian transclusion: `![[note]]`
3. Or embed widgets

## Post-Migration

### Step 1: Review Imported Cards

1. Open Flashcard Panel
2. Check uncollected cards
3. Collect wanted cards

### Step 2: Organize into Projects

1. Add `project:` frontmatter
2. Or assign from Dashboard

### Step 3: Run FSRS Optimization

After 400+ reviews:
1. Settings → FSRS → Optimize
2. Personalize algorithm

## Tips

### 1. Export Everything First

Before migrating, export all RemNote content.

### 2. Keep RemNote During Transition

Keep RemNote access until confident in True Recall.

### 3. Use AI Generation

Instead of manually converting, use AI to generate cards from your notes.

### 4. Start Fresh

Consider starting fresh for some content rather than converting everything.

## Related Topics

- [Basic Cards](../creation/basic-cards.md) — Card syntax
- [Cloze Deletions](../creation/cloze-deletions.md) — Cloze syntax
- [AI Generation](../creation/ai-generation.md) — Generate cards with AI
- [Projects](../concepts/projects.md) — Organizing notes
