# Basic Concepts

Before diving deeper, understanding these core concepts will help you get the most out of True Recall.

## Flashcards

A **flashcard** is a learning unit with a question (front) and answer (back). True Recall supports several types:

| Type | Syntax | Description |
|------|--------|-------------|
| Basic | `Question :: Answer` | Simple Q&A card |
| Cloze | `{{c1::text}}` | Fill-in-the-blank |
| Reversed | `Question ::: Answer` | Creates two cards (Q→A and A→Q) |

Cards are stored in your notes and linked to the database for scheduling.

## FSRS Algorithm

**Free Spaced Repetition Scheduler (FSRS)** is a modern algorithm that predicts when you'll forget something and schedules reviews at the optimal time.

### Key FSRS Concepts

- **Stability** — How long you'll remember something before forgetting
- **Difficulty** — How hard a card is to learn
- **Retrievability** — Current probability of successful recall
- **Desired Retention** — Target recall probability (default: 90%)

When you answer a card, FSRS updates its predictions and schedules the next review.

### Card States

| State | Description |
|-------|-------------|
| **New** | Never reviewed (green) |
| **Learning** | First few reviews, short intervals (orange) |
| **Review** | Graduated to longer intervals (blue) |
| **Relearning** | Forgotten and being relearned (orange) |
| **Suspended** | Manually paused (red) |

## Note Types

**Note Types** are templates that define how flashcards are created from your notes, similar to Anki's note types.

Each note type has:
- **Fields** — Data slots (e.g., Front, Back, Extra)
- **Templates** — How fields are displayed on cards
- **CSS** — Styling for cards

Built-in note types include Basic, Cloze, and Image Occlusion.

## Projects

**Projects** organize your notes hierarchically. Each project can have its own FSRS preset, allowing different scheduling rules for different subjects.

Projects are defined in frontmatter:

```yaml
---
project: Biology/Anatomy
fsrs_preset: medical-school
---
```

Child notes inherit settings from parent projects.

## Day Boundaries

True Recall uses configurable **day boundaries** (default: 4 AM) to determine when cards become "due today." This matches Anki's behavior — if you review at 2 AM, it counts as the previous day.

Configure in Settings → General → "Next day starts at".

## Presets

A **Preset** is a collection of FSRS settings including:

- Desired retention percentage
- Daily new card limit
- Daily review limit
- Learning steps
- FSRS weights (21 parameters)

You can have multiple presets (e.g., "Intensive" for exam prep, "Casual" for general learning).

## The Review Loop

1. **Due cards** appear in your review queue
2. You **answer** each card
3. FSRS **schedules** the next review
4. **Statistics** track your progress

Daily limits prevent overload while ensuring consistent progress.

## Signals and Real-Time Updates

True Recall uses reactive signals to keep all views in sync. When you:

- Create a card → Dashboard and Panel update immediately
- Answer a card → Statistics refresh
- Change settings → All views reflect the change

No manual refresh needed.

## Next Steps

Now that you understand the basics, explore specific features:

- [Flashcards Deep Dive](../concepts/flashcards.md)
- [FSRS Algorithm](../concepts/fsrs-algorithm.md)
- [Note Types](../concepts/note-types.md)
- [Projects](../concepts/projects.md)
- [Scheduling](../concepts/scheduling.md)
