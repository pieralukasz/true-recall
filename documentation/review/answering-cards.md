# Answering Cards

When you review a flashcard, you rate how well you remembered it. This rating determines when you'll see the card next. This page explains the rating system and how it affects scheduling.

## The Rating System

True Recall uses four ratings:

| Rating | Meaning | Typical Interval Effect |
|--------|---------|------------------------|
| **Again** | Forgot completely | Reset to learning |
| **Hard** | Remembered with difficulty | Shorter interval |
| **Good** | Remembered correctly | Normal interval |
| **Easy** | Remembered instantly | Longer interval |

## Keyboard Shortcuts

| Key | Rating |
|-----|--------|
| `1` | Again |
| `2` | Hard |
| `3` or `Space` | Good |
| `4` | Easy |

## How Ratings Affect Scheduling

### FSRS Updates

After each rating, FSRS updates the card's parameters:

1. **Stability** — How long you'll remember it
2. **Difficulty** — How hard the card is
3. **Retrievability** — Current recall probability

### Interval Calculation

The next interval depends on:

- Your rating (Again/Hard/Good/Easy)
- Current stability
- Desired retention setting
- FSRS weights

### Rating Effects

#### Again

- **Stability:** Decreases significantly
- **Difficulty:** Increases
- **State:** Moves to Relearning
- **Interval:** Reset to relearning steps (default: 10 min)

Use when you completely forgot or got it wrong.

#### Hard

- **Stability:** Slight decrease or small increase
- **Difficulty:** Increases slightly
- **Interval:** Shorter than Good would be

Use when you remembered but struggled significantly.

#### Good

- **Stability:** Increases based on FSRS calculation
- **Difficulty:** Minor adjustment
- **Interval:** Standard FSRS interval

Use when you remembered correctly with reasonable effort.

#### Easy

- **Stability:** Increases more than Good
- **Difficulty:** Decreases
- **Interval:** Longer than Good would be

Use when you remembered instantly with no effort.

## Interval Preview

Each button shows the predicted next interval:

```
[Again: <1m]  [Hard: <10m]  [Good: 1.2d]  [Easy: 4d]
```

### Interval Notation

| Notation | Meaning |
|----------|---------|
| `<1m` | Less than 1 minute |
| `5m` | 5 minutes |
| `1.5h` | 1.5 hours |
| `2d` | 2 days |
| `1.2mo` | 1.2 months |
| `1y` | 1 year |

### Fuzz

Intervals have small random variation (±2.5%) to prevent cards from bunching on the same day.

## Being Honest with Ratings

Accurate ratings improve FSRS predictions.

### Common Mistakes

| Mistake | Effect |
|---------|--------|
| Rating Good when you forgot | FSRS overestimates your memory |
| Rating Easy too often | Intervals become too long |
| Rating Hard to avoid forgetting | More reviews than needed |
| Rating Again when you knew it | FSRS underestimates your memory |

### Best Practice

Rate based on your actual recall, not what you "should" know:

- **Again** — You didn't remember
- **Hard** — Significant effort, maybe some doubt
- **Good** — Correct, normal effort
- **Easy** — Instant, automatic recall

## Learning Phase

New cards go through learning steps:

### Default Steps: [1, 10]

1. First review → See again in 1 minute
2. Second review → See again in 10 minutes
3. Graduate → Move to Review state

### Learning Ratings

During learning, ratings work slightly differently:

| Rating | Effect |
|--------|--------|
| Again | Restart learning steps |
| Hard | Repeat current step |
| Good | Advance to next step |
| Easy | Graduate immediately |

## Review Phase

Once cards graduate, they enter the Review state:

### Review Ratings

| Rating | Effect |
|--------|--------|
| Again | Lapse → Relearning |
| Hard | Shorter interval |
| Good | Standard interval |
| Easy | Longer interval |

### Lapses

A **lapse** is when you forget a review card (rating "Again"):

1. Card moves to Relearning state
2. Goes through relearning steps (default: 10 min)
3. After relearning, returns to Review with reduced stability

## Rating Strategy by Card Age

### New Cards

Be strict. If you're unsure, rate Hard or Again to reinforce.

### Young Cards (Learning)

Use Good to graduate. Use Easy only if truly instant.

### Mature Cards (Review)

Rate honestly. Mature cards with good history will recover quickly from lapses.

## Related Topics

- [FSRS Algorithm](../concepts/fsrs-algorithm.md) — How FSRS works
- [Scheduling](../concepts/scheduling.md) — Learning steps and intervals
- [Review Interface](./review-interface.md) — Review view overview
