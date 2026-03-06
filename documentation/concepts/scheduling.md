# Scheduling

True Recall uses FSRS v6 to schedule flashcard reviews. This page explains how scheduling works, including day boundaries, learning steps, and interval calculation.

## The Scheduling System

When you answer a card, True Recall:

1. Records your rating (Again, Hard, Good, Easy)
2. Updates the card's FSRS parameters (stability, difficulty)
3. Calculates the next review date
4. Schedules the card for that date

The goal: Show you the card right before you'd forget it.

## Day Boundaries

### What is a Day Boundary?

The **day boundary** determines when "today" ends and "tomorrow" begins. By default, this is **4:00 AM** (like Anki).

### Why 4 AM?

Many people study late at night. With a midnight cutoff:
- A 1 AM review counts as "tomorrow"
- Your "today's reviews" becomes confusing

With 4 AM cutoff:
- 1 AM still counts as "today"
- Only reviews after 4 AM are "tomorrow"

### Configuring Day Boundary

Settings → General → "Next day starts at"

Range: 0-23 (hour of day)

### Impact on Scheduling

Cards due "today" are those with due dates before the next day boundary.

Example (4 AM boundary):
- Current time: Monday 2 PM
- Cards due: All cards with due date before Tuesday 4 AM

## Learning Steps

### What are Learning Steps?

**Learning steps** are the intervals used for new cards during their initial learning phase.

Default: `[1, 10]` minutes

This means:
1. First review: See again in 1 minute
2. Second review: See again in 10 minutes
3. After second step: Graduate to "Review" state

### Relearning Steps

**Relearning steps** apply when you forget a review card (lapse).

Default: `[10]` minutes

After a lapse:
1. Card enters "Relearning" state
2. Review again in 10 minutes
3. If successful, return to "Review" state

### Configuring Steps

Settings → FSRS → Learning steps / Relearning steps

Format: Comma-separated minutes

Examples:
- `1, 10` — Two steps
- `1, 10, 60` — Three steps
- `1` — Single step

### Step vs Graduating Interval

After completing all learning steps, cards "graduate" to the Review state. The first review interval is calculated by FSRS based on your performance during learning.

## Interval Calculation

FSRS calculates intervals to maintain your **desired retention** (default: 90%).

### The Formula

```
Interval = Stability × ln(Desired Retention) / ln(Retrievability)
```

With constraints:
- Minimum: 1 day
- Maximum: Your configured maximum (default: 100 years)

### Fuzz

To prevent cards from bunching on the same day, a small random factor is applied:

- Default: ±2.5% of the interval
- Can be disabled in settings

### Interval Modifiers by Rating

| Rating | Effect on Interval |
|--------|-------------------|
| Again | Reset to learning/relearning |
| Hard | Shorter interval than Good |
| Good | Standard FSRS interval |
| Easy | Longer interval than Good |

## Review Order

### New Card Order

Settings → FSRS → New card order

Options:
- **Random** — Shuffle new cards
- **Oldest first** — By position in file
- **Newest first** — By position in file (reversed)

### Review Order

Settings → FSRS → Review order

Options:
- **By due date** — Oldest due first
- **Random** — Shuffle due cards
- **Due date, then random** — Due date primary, random secondary
- **By retrievability** — Cards most likely to be forgotten first
- **Most lapses** — Cards you've forgotten most often
- **Relative overdueness** — How overdue relative to interval
- **Lowest stability** — Cards with weakest memory first
- **Order added** — Creation order

### New/Review Mix

Settings → FSRS → New/review mix

Options:
- **Mix with reviews** — Interleave new and review cards
- **Show after reviews** — All reviews first, then new cards
- **Show before reviews** — All new cards first, then reviews

## Daily Limits

### New Cards Per Day

Maximum new cards introduced daily. Default: 20.

Higher values = faster learning but more future reviews.

### Reviews Per Day

Maximum review cards per day. Default: 200.

Set to 0 for unlimited. This is a soft limit — due cards remain due.

### Timebox

Optional: Set a time limit per session. When reached, you're notified but can continue.

## Easy Days

Reduce workload on specific days (e.g., weekends):

Settings → FSRS → Easy Days

Configure:
- Which days to reduce (Sun-Sat)
- Workload multiplier (default: 50%)

Cards scheduled for easy days are redistributed to other days.

## Scheduled Breaks

Schedule vacation periods where reviews are redistributed:

Settings → FSRS → Scheduled Breaks

Add breaks with:
- Start date
- End date
- Redistribution option (before/after)

## Scheduling Tools

### Reschedule

Recalculate all intervals with current FSRS weights:

Settings → FSRS → Preview reschedule

Useful after:
- Optimizing parameters
- Changing desired retention
- Importing cards

### Postpone

Push all due cards forward:

Settings → FSRS → Postpone

Enter days to delay. Useful when overwhelmed with backlog.

### Advance

Pull future cards to today:

Negative postpone value. Useful when you want extra practice.

## Timezones

True Recall uses your device's local timezone. The day boundary is applied in your local time.

If you travel across timezones:
- Reviews remain scheduled for the same absolute time
- Day boundary shifts to new timezone

## Related Topics

- [FSRS Algorithm](./fsrs-algorithm.md) — How FSRS works
- [Load Balancing](../scheduling/load-balancing.md) — Distribute workload
- [Easy Days](../scheduling/easy-days.md) — Reduced review days
- [Scheduled Breaks](../scheduling/scheduled-breaks.md) — Vacation handling
