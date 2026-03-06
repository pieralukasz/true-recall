# Sibling Dispersal

**Sibling Dispersal** spaces out cards from the same note so you don't see related cards too close together. This prevents context interference and improves independent recall.

## What are Siblings?

Siblings are cards generated from the same source:

| Note Type | Siblings |
|-----------|----------|
| Basic | 1 card (no siblings) |
| Cloze | Multiple clozes from same text |
| Reversed | 2 cards (Q→A and A→Q) |
| Image Occlusion | Multiple regions from same image |

## The Problem

Without dispersal, siblings might be due on the same day:

```
Note: "Capital of France is Paris"

Card 1 (Q→A): Due Monday
Card 2 (A→Q): Due Monday

Result: Seeing one gives away the answer to the other
```

## How Sibling Dispersal Works

Cards are spaced by a minimum interval:

```
Before:
Card 1: Due Monday
Card 2: Due Monday

After (3-day minimum):
Card 1: Due Monday
Card 2: Due Thursday (moved)
```

## Enabling Sibling Dispersal

Settings → FSRS → Sibling Dispersal

| Setting | Default | Description |
|---------|---------|-------------|
| Enable | Off | Activate sibling dispersal |
| Minimum interval | 3 days | Days between siblings |

### Recommended Minimum

| Minimum | Use Case |
|---------|----------|
| 1-2 days | Minimal spacing |
| 3-4 days | Standard (recommended) |
| 5-7 days | Strong spacing |
| 10+ days | Maximum separation |

## Dispersing Siblings

### Automatic

When enabled, siblings are automatically dispersed when:
- New cards are created
- Cards are answered

### Manual

Settings → FSRS → Disperse siblings now

Immediately spaces all siblings that are too close.

## What Gets Dispersed

| Card Type | Dispersed? |
|-----------|------------|
| Cloze cards | ✅ Yes |
| Reversed cards | ✅ Yes |
| Image occlusion | ✅ Yes |
| Basic cards | N/A (no siblings) |
| Learning cards | ❌ No (must graduate first) |

## Dispersal Rules

### Priority

When siblings are too close:

1. First-reviewed card keeps its due date
2. Later-reviewed cards are moved later
3. Movement limited to maintain retention

### Limits

Cards won't be moved more than:
- Their current interval
- Maximum dispersal window

## Preview Before Dispersing

Click "Disperse siblings now" to see:
- How many cards will be moved
- Average days moved
- Preview of new schedule

Confirm or cancel the changes.

## Tips

### 1. Use for Cloze Cards

Cloze notes with many clozes benefit most from dispersal.

### 2. Don't Over-Space

3-4 days is usually enough. Longer intervals delay reviews unnecessarily.

### 3. Check After Bulk Import

After importing many cards, run manual dispersal.

### 4. Combine with Load Balancing

Both features work together for optimal scheduling.

## Troubleshooting

### Siblings Still on Same Day

Some cards can't be dispersed:
- Learning cards (must graduate first)
- Cards with very short intervals
- When dispersal would violate retention

### Too Much Delay

Reduce minimum interval if reviews are too spread out.

### No Effect After Enabling

Run "Disperse siblings now" to apply immediately to existing cards.

## Related Topics

- [Cloze Deletions](../creation/cloze-deletions.md) — Cloze cards
- [Reversed Cards](../creation/reversed-cards.md) — Reversed cards
- [Image Occlusion](../creation/image-occlusion.md) — Image occlusion
- [Scheduling](../concepts/scheduling.md) — Review basics
