# FSRS Presets

**Presets** are collections of FSRS settings that you can assign to projects and notes. Use different presets for different learning contexts.

## What is a Preset?

A preset contains:

| Setting | Description |
|---------|-------------|
| Desired retention | Target recall probability |
| New cards/day | Daily new card limit |
| Reviews/day | Daily review limit |
| Learning steps | Initial review intervals |
| Relearning steps | Post-lapse intervals |
| FSRS weights | 17-21 algorithm parameters |

## Default Preset

True Recall includes a "Default" preset with sensible defaults:

- Desired retention: 90%
- New cards/day: 20
- Reviews/day: 200
- Learning steps: 1, 10 minutes
- Relearning steps: 10 minutes

This preset cannot be deleted.

## Managing Presets

### Opening Preset Settings

Settings → FSRS → Presets section

### Creating a New Preset

1. Click **New** button
2. Enter preset name
3. Configure settings
4. Save

New presets are copies of the currently selected preset.

### Editing a Preset

1. Select preset from dropdown
2. Modify settings
3. Changes save automatically

### Deleting a Preset

1. Select preset
2. Click **Delete**
3. Confirm deletion

Note: Default preset cannot be deleted. Notes using deleted preset fall back to Default.

## Preset Settings

### Algorithm Settings

| Setting | Range | Description |
|---------|-------|-------------|
| Desired retention | 70-99% | Target recall rate |
| Maximum interval | Days | Longest possible interval |

### Daily Limits

| Setting | Description |
|---------|-------------|
| New cards/day | Max new cards to introduce |
| Reviews/day | Max reviews per day (0 = unlimited) |

### Learning Steps

| Setting | Format | Description |
|---------|--------|-------------|
| Learning steps | `1, 10` | Minutes for new cards |
| Relearning steps | `10` | Minutes after lapse |

### Display Order

| Setting | Options |
|---------|---------|
| New card order | Random, Oldest first, Newest first |
| Review order | Due date, Random, Retrievability, etc. |
| New/review mix | Mix, Reviews first, New first |

### FSRS Weights

Advanced: Customize the 17-21 FSRS weight parameters.

See [FSRS Optimization](../scheduling/fsrs-optimization.md) for parameter tuning.

## Example Presets

### Exam Prep (Intensive)

```yaml
Name: exam-prep
Desired retention: 92%
New cards/day: 50
Reviews/day: 300
Learning steps: 1, 5, 10
```

For intensive study periods before exams.

### Maintenance (Casual)

```yaml
Name: casual
Desired retention: 85%
New cards/day: 5
Reviews/day: 50
Learning steps: 1, 10
```

For low-priority topics you want to maintain.

### Language Learning

```yaml
Name: language
Desired retention: 90%
New cards/day: 30
Reviews/day: 150
Learning steps: 1, 5, 10, 30
```

For vocabulary with more learning steps.

### Medical School

```yaml
Name: medical
Desired retention: 95%
New cards/day: 40
Reviews/day: 200
Learning steps: 1, 10
```

For high-stakes medical knowledge.

## Assigning Presets

### To a Note

```yaml
---
fsrs_preset: exam-prep
---
```

### To a Project

```yaml
---
project: Medicine
fsrs_preset: medical
---
```

All notes in this project inherit "medical" preset unless they specify their own.

### From Dashboard

1. Open Dashboard
2. Click preset indicator on project/note row
3. Select from dropdown

### From Review

Press `P` during review to change the current card's preset.

## Preset Inheritance

Presets are resolved in this order:

1. **Note's own preset** — `fsrs_preset` in frontmatter
2. **Project's preset** — From project definition
3. **Parent project's preset** — Up the hierarchy
4. **Default preset** — Fallback

### Example

```
Medicine (preset: medical)
├── Anatomy (preset: intensive)
│   └── Note A (no preset) → Uses "intensive"
├── Physiology (no preset)
│   └── Note B (no preset) → Uses "medical"
└── Pharmacology
    └── Note C (preset: casual) → Uses "casual"
```

## Preset Statistics

In preset settings, you can see:

| Stat | Description |
|------|-------------|
| Card count | Cards using this preset |
| Review count | Total reviews |
| Last optimized | When weights were last optimized |

## Changing Presets

When you change a note's preset:

- Existing cards keep their FSRS data
- New reviews use new preset settings
- No immediate rescheduling happens

To reschedule all cards with new preset:
Settings → FSRS → Preview reschedule

## Related Topics

- [FSRS Algorithm](../concepts/fsrs-algorithm.md) — How FSRS works
- [FSRS Optimization](../scheduling/fsrs-optimization.md) — Optimizing weights
- [Projects](./projects.md) — Project organization
- [FSRS Settings](../configuration/fsrs-settings.md) — Settings reference
