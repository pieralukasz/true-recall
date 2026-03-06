# Projects

**Projects** organize your notes into hierarchical groups, similar to Anki decks. Each project can have its own FSRS preset for customized scheduling.

See also: [Projects concept](../concepts/projects.md) for fundamentals.

## Creating Projects

Projects are created implicitly when you assign notes to them:

```yaml
---
project: Biology
---
```

This creates a "Biology" project containing this note.

## Project Hierarchy

Use `/` to create nested projects:

```yaml
---
project: Medicine/Anatomy/Upper Body
---
```

Creates:
```
Medicine/
└── Anatomy/
    └── Upper Body/ (this note)
```

## Assigning Notes to Projects

### In Frontmatter

```yaml
---
project: Biology
---
```

### From Dashboard

1. Open Dashboard
2. Right-click a note
3. Select "Assign to project"
4. Choose or type project name

### Bulk Assignment

1. Open Dashboard
2. Select multiple notes (Shift+Click)
3. Right-click → Assign to project

## Project Dashboard

The Projects tab in Dashboard shows:

### Project Tree

```
▼ Medicine (500 cards, 42 due)
  ├─ Anatomy (120 cards, 15 due)
  │  ├─ Upper Body (45 cards, 8 due)
  │  └─ Lower Body (75 cards, 7 due)
  ├─ Physiology (180 cards, 12 due)
  └─ Pharmacology (200 cards, 15 due)

  Chemistry (80 cards, 10 due)
  Physics (60 cards, 8 due)
```

### Project Row Information

| Column | Description |
|--------|-------------|
| Name | Project name |
| Cards | Total card count |
| Due | Cards due today |
| Preset | Active FSRS preset |
| Expand | Toggle children |

## Project Actions

Right-click a project:

| Action | Description |
|--------|-------------|
| Study | Review all cards in project |
| Custom session | Configure filtered session |
| Set preset | Change FSRS preset |
| Collapse/Expand | Toggle visibility |
| Create sub-project | Add child project |

## FSRS Presets per Project

Each project can use a different FSRS preset:

### Setting Preset

```yaml
---
project: Medicine
fsrs_preset: medical-school
---
```

Or from Dashboard:
1. Click the preset indicator on project row
2. Select from dropdown

### Preset Inheritance

Notes inherit presets from their project hierarchy:

1. Note's own `fsrs_preset` (highest priority)
2. Immediate project's preset
3. Parent project's preset
4. Default preset

### Example Inheritance

```
Medicine (preset: medical-school)
├── Anatomy (no preset set)
│   └── Note A (no preset) → Uses "medical-school"
├── Physiology (preset: intensive)
│   └── Note B (no preset) → Uses "intensive"
└── Pharmacology
    └── Note C (preset: casual) → Uses "casual"
```

## Project Statistics

Click a project to see:

| Stat | Description |
|------|-------------|
| Total cards | All cards in project + children |
| Due today | Cards scheduled for today |
| New cards | Unreviewed cards |
| Retention | Average retention rate |
| Study time | Estimated time to complete |

## Unassigned Notes

Notes without a `project` field appear under **Unassigned** in Dashboard.

### Finding Unassigned Notes

1. Open Dashboard
2. Look for "Unassigned" section
3. Or use filter: `project:none`

### Assigning Unassigned Notes

1. Select notes in Dashboard
2. Right-click → Assign to project
3. Or add `project:` to frontmatter manually

## Project Notes

Create dedicated notes for projects:

```markdown
---
project: Medicine
fsrs_preset: medical-school
---

# Medicine Study Materials

This project contains all my medical school flashcards.

## Topics Covered
- Anatomy
- Physiology
- Pharmacology

## Progress
```true-recall-dashboard
project: Medicine
```

## Weak Areas
```true-recall-problems
project: Medicine
minLapses: 3
```
```

## Moving Notes Between Projects

1. Open the note
2. Change `project` field in frontmatter
3. Or use Dashboard → Right-click → Move to project

## Removing from Project

1. Remove `project` field from frontmatter
2. Or use Dashboard → Right-click → Detach from project

## Best Practices

### 1. Start with Broad Categories

```
Study/
├── Medicine/
├── Languages/
└── Programming/
```

### 2. Add Depth as Needed

```
Study/
├── Medicine/
│   ├── Anatomy/
│   │   ├── Upper Body/
│   │   └── Lower Body/
│   └── Physiology/
```

### 3. Use Presets Strategically

- **Intensive** for exam prep
- **Default** for general learning
- **Casual** for low-priority topics

### 4. Create Project Notes

Add context and widgets to project notes for quick overview.

### 5. Review Regularly

Check Dashboard to see which projects need attention.

## Related Topics

- [Presets](./presets.md) — FSRS preset configuration
- [Dashboard](../views/dashboard.md) — Project overview
- [Projects Concept](../concepts/projects.md) — Fundamentals
