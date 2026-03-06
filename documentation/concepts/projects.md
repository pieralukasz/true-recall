# Projects

**Projects** organize your notes into hierarchical groups, similar to decks in Anki. Each project can have its own FSRS preset, allowing different scheduling rules for different subjects.

## What are Projects?

Projects are hierarchical collections of notes defined in frontmatter. They enable:

- **Organization** — Group related notes together
- **Per-project settings** — Different FSRS presets per subject
- **Inheritance** — Child projects inherit settings from parents
- **Dashboard views** — See project-level statistics

## Project Hierarchy

Projects support hierarchical paths using `/` as separator:

```
Medicine
├── Anatomy
│   ├── Upper Body
│   └── Lower Body
├── Physiology
└── Pharmacology
```

Child projects inherit FSRS preset from their parent unless overridden.

## Defining Projects

Projects are defined in note frontmatter:

### Single Project

```yaml
---
project: Biology
---
```

### Nested Project

```yaml
---
project: Medicine/Anatomy/Upper Body
---
```

### Multiple Projects

```yaml
---
projects:
  - Biology/Genetics
  - Medicine/Anatomy
---
```

## Project Dashboard

Open the Dashboard (Cmd/Ctrl + P → "Open dashboard") to see the Projects tab:

### Project Tree

- Expandable hierarchy
- Per-project card counts
- Study time estimates
- Preset indicators

### Project Actions

- **Study** — Start review for all notes in project
- **Custom Session** — Configure filtered session
- **View Notes** — See all notes in project

## FSRS Presets per Project

Each project can have its own FSRS preset:

### Setting Project Preset

```yaml
---
project: Medicine
fsrs_preset: medical-school
---
```

### Inheritance

Notes inherit presets from their project hierarchy:

1. Note's own `fsrs_preset` (highest priority)
2. Parent project's preset
3. Grandparent project's preset
4. Default preset

### Example

```yaml
# In project-settings.md
---
project: Medicine
fsrs_preset: medical-school  # All Medicine/* notes use this
---

# In anatomy-notes.md
---
project: Medicine/Anatomy
# Inherits medical-school preset from Medicine
---

# In intensive-anatomy.md
---
project: Medicine/Anatomy
fsrs_preset: intensive  # Overrides to intensive
---
```

## Project Statistics

In the Dashboard, click a project to see:

- **Total cards** — All cards in project (including children)
- **Due today** — Cards scheduled for today
- **New cards** — Unreviewed cards
- **Retention rate** — Average retention
- **Study time** — Estimated time to complete

## Creating Projects

Projects don't need to be explicitly created — they emerge from notes that reference them.

However, you can create a "project note" to:

1. Define project-level settings
2. Add project description
3. Embed project dashboard widget

```markdown
---
project: Medicine
fsrs_preset: medical-school
---

# Medicine Study Materials

This project contains all my medical school flashcards.

```true-recall-dashboard
project: Medicine
```
```

## Project Widgets

Embed project views in any note using code blocks:

### Project Dashboard Widget

````markdown
```true-recall-dashboard
project: Medicine
```
````

### Project Stats Widget

````markdown
```true-recall-project
project: Medicine/Anatomy
showStats: true
```
````

### Forecast Widget

````markdown
```true-recall-forecast
project: Medicine
days: 30
```
````

## Unassigned Notes

Notes without a `project` field appear in **Unassigned** in the dashboard.

To assign them:

1. Open the note
2. Add `project: YourProject` to frontmatter
3. Or use the Dashboard → right-click note → Assign to project

## Project vs Tags

| Feature | Projects | Tags |
|---------|----------|------|
| Hierarchy | ✅ Nested | ❌ Flat |
| FSRS presets | ✅ Per-project | ❌ |
| Inheritance | ✅ Child inherits | ❌ |
| Dashboard | ✅ Project tree | ❌ |

Use **projects** for organization and scheduling, **tags** for categorization.

## Bulk Assignment

Assign multiple notes to a project:

1. Open Dashboard
2. Select multiple notes (shift-click)
3. Right-click → Assign to project
4. Choose project

## Removing from Project

To remove a note from its project:

1. Open the note
2. Remove the `project` field from frontmatter
3. Or use Dashboard → right-click → Detach from project

## Best Practices

1. **Start broad** — Create top-level projects first (e.g., "Work", "Personal", "Study")
2. **Go deep** — Add sub-projects as needed (e.g., "Study/Medicine/Anatomy")
3. **Use presets wisely** — Different subjects may need different scheduling
4. **Review hierarchy** — Occasionally reorganize if structure becomes unwieldy
5. **Document projects** — Create project notes with descriptions

## Related Topics

- [Presets](../organization/presets.md) — FSRS preset configuration
- [Dashboard](../views/dashboard.md) — Main dashboard documentation
- [Widgets](../views/codeblock-widgets.md) — Embeddable widgets
