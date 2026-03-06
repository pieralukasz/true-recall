# Frontmatter Fields Reference

True Recall uses YAML frontmatter to store metadata about notes and their flashcards.

## Basic Syntax

```yaml
---
field_name: value
another_field: value
---
```

## True Recall Fields

### flashcard_uid

**Purpose:** Unique identifier linking note to its flashcards.

**Type:** String (auto-generated UUID)

**Example:**
```yaml
---
flashcard_uid: abc123-def456-ghi789
---
```

**Notes:**
- Auto-added when first card is collected
- Must be unique across vault
- Don't modify unless you know what you're doing

### project

**Purpose:** Assign note to a project.

**Type:** String (project path)

**Example:**
```yaml
---
project: Medicine/Anatomy
---
```

**Notes:**
- Creates project hierarchy with `/`
- Used for organization and preset inheritance
- Optional — unassigned notes appear in "Unassigned"

### projects

**Purpose:** Assign note to multiple projects.

**Type:** Array of strings

**Example:**
```yaml
---
projects:
  - Biology/Genetics
  - Medicine/Anatomy
---
```

**Notes:**
- Alternative to single `project` field
- Card counts aggregate across projects

### fsrs_preset

**Purpose:** Set FSRS preset for this note's cards.

**Type:** String (preset name)

**Example:**
```yaml
---
fsrs_preset: medical-school
---
```

**Notes:**
- Overrides project preset
- Must match existing preset name
- Case-sensitive

### archived

**Purpose:** Exclude note from reviews.

**Type:** Boolean

**Example:**
```yaml
---
archived: true
---
```

**Notes:**
- Archived notes hidden from Dashboard (by default)
- Cards not included in review queue
- Reversible — set to `false` or remove

## Field Priority

When multiple fields could apply:

| Priority | Source |
|----------|--------|
| 1 (highest) | Note's `fsrs_preset` |
| 2 | Immediate project's preset |
| 3 | Parent project's preset |
| 4 | Default preset |

## Complete Example

```yaml
---
flashcard_uid: abc123-def456-ghi789
project: Medicine/Anatomy/Upper Body
fsrs_preset: intensive
archived: false
tags:
  - biology
  - exam-prep
created: 2024-01-15
---

# Upper Body Anatomy

Flashcard content here...
```

## Field Interactions

### project + fsrs_preset

```yaml
---
project: Medicine
fsrs_preset: casual  # Overrides Medicine's preset
---
```

### archived + project

```yaml
---
project: Medicine
archived: true  # Note archived, still in project but excluded from reviews
---
```

### Multiple projects

```yaml
---
projects:
  - Medicine/Anatomy
  - Biology/Systems
---
# Cards count toward both projects
```

## Common Patterns

### Course Notes

```yaml
---
project: Courses/Biology 101
fsrs_preset: exam-prep
---
```

### Reference Material

```yaml
---
project: Reference
archived: true  # Keep for reference, don't review
---
```

### Daily Notes

```yaml
---
project: Daily/2024
# No preset — uses default
---
```

### Shared Notes

```yaml
---
project: Shared/Team Knowledge
fsrs_preset: casual
---
```

## Editing Frontmatter

### In Obsidian

1. Open note
2. Click "..." at top right
3. Select "Edit frontmatter"
4. Modify fields
5. Save

### Manually

1. Open note in edit mode
2. Find `---` delimiters at top
3. Edit YAML content
4. Save

### Programmatically

Use Templater or other plugins to set frontmatter dynamically.

## Troubleshooting

### flashcard_uid Conflicts

If two notes have same UID:

1. Run integrity check
2. Duplicate UID detected
3. Repair generates new UID

### Invalid YAML

If frontmatter has syntax errors:

1. Obsidian shows warning
2. Fix YAML syntax
3. Reload note

### Missing Fields

If expected fields missing:

1. Cards may not link to note
2. Run integrity check
3. Manually add fields

## Related Topics

- [Projects](../concepts/projects.md) — Project organization
- [Presets](../organization/presets.md) — FSRS presets
- [Archiving](../organization/archiving.md) — Archive behavior
- [Data Integrity](../data/integrity-check.md) — Check for issues
