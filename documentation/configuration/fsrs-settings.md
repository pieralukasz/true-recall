# FSRS Settings

Configure FSRS scheduling in Settings → True Recall → FSRS.

## Presets Section

### Active Preset

Select which preset to configure. Each preset has independent settings.

### Preset Actions

| Button | Action |
|--------|--------|
| New | Create copy of current preset |
| Delete | Delete preset (not available for Default) |
| Rename | Change preset name |

## Algorithm Section

### Desired Retention

Target probability of recall (70-99%).

| Value | Effect |
|-------|--------|
| 85% | Fewer reviews, more forgetting |
| 90% (default) | Balanced |
| 95% | More reviews, less forgetting |

**Recommended:** 90% for most learners.

### Maximum Interval

Longest possible interval in days.

| Value | Description |
|-------|-------------|
| 365 (1 year) | Conservative |
| 3650 (10 years) | Moderate |
| 36500 (100 years) | Default |

**Recommended:** Keep default (no practical limit).

## Daily Limits Section

### New Cards Per Day

Maximum new cards introduced daily.

| Value | Workload |
|-------|----------|
| 10 | Light |
| 20 (default) | Moderate |
| 50 | Heavy |

**Note:** More new cards = more future reviews.

### Reviews Per Day

Maximum reviews per day.

| Value | Effect |
|-------|--------|
| 0 | Unlimited |
| 100 | Light |
| 200 (default) | Moderate |
| 500 | Heavy |

This is a soft limit — due cards remain due.

## Learning Steps Section

### Learning Steps (Minutes)

Intervals for new cards.

| Value | Meaning |
|-------|---------|
| 1, 10 (default) | See again in 1 min, then 10 min |
| 1, 10, 60 | Three learning steps |
| 1 | Single step |

### Relearning Steps (Minutes)

Intervals after lapses (forgotten cards).

| Value | Meaning |
|-------|---------|
| 10 (default) | See again in 10 minutes |
| 1, 10 | Two relearning steps |

## Display Order Section

### New Card Order

How new cards are ordered:

| Option | Description |
|--------|-------------|
| Random | Shuffle new cards |
| Oldest first | By position in file |
| Newest first | Reverse file order |

### Review Order

How due cards are ordered:

| Option | Description |
|--------|-------------|
| By due date | Oldest due first |
| Random | Shuffle |
| Due date, then random | Primary + secondary sort |
| By retrievability | Lowest recall probability first |
| Most lapses | Cards you forget most |
| Relative overdueness | How overdue relative to interval |
| Lowest stability | Weakest memories first |
| Order added | Creation order |

**Recommended:** By due date or By retrievability.

### New/Review Mix

How new and review cards are interleaved:

| Option | Description |
|--------|-------------|
| Mix with reviews | Interleave (default) |
| Show after reviews | Reviews first, then new |
| Show before reviews | New first, then reviews |

## Parameters Section

### FSRS Weights

17-21 parameters controlling FSRS behavior.

**Recommended:** Use optimization rather than manual editing.

### Optimize Parameters

Analyze review history to find optimal weights.

Requirements:
- 400+ reviews minimum
- 1000+ recommended

### Reset to Defaults

Restore default FSRS weights.

## Load Balance Section

### Enable Load Balancing

Automatically distribute reviews to prevent spikes.

| Setting | Default | Description |
|---------|---------|-------------|
| Enable | Off | Activate load balancing |
| Target daily reviews | 100 | Target count |
| Maximum deviation | 20% | Tolerance before rebalancing |

### Balance Workload Now

Manually trigger load balancing for next 30 days.

## Easy Days Section

### Configure Easy Days

Reduce reviews on specific weekdays or dates.

Opens modal to configure:
- Recurring weekdays (Sun-Sat)
- Specific dates
- Workload multiplier (default: 50%)

### Apply Now

Apply easy day scheduling immediately.

## Sibling Dispersal Section

### Enable Sibling Dispersal

Space out sibling cards (from same note).

| Setting | Default | Description |
|---------|---------|-------------|
| Enable | Off | Activate dispersal |
| Minimum sibling interval | 3 days | Days between siblings |

### Disperse Siblings Now

Manually disperse siblings that are too close.

## Scheduled Breaks Section

### Add Scheduled Break

Schedule vacation/break periods for review redistribution.

Each break:
- Start date
- End date
- Redistribution (Before/After/Both)

## Bulk Operations Section

### Preview Reschedule

Recalculate all intervals with current FSRS weights.

Shows preview before applying.

### Postpone

Push all due cards forward by N days.

## Related Topics

- [FSRS Algorithm](../concepts/fsrs-algorithm.md) — How FSRS works
- [FSRS Optimization](../scheduling/fsrs-optimization.md) — Optimizing parameters
- [Load Balancing](../scheduling/load-balancing.md) — Distribute workload
- [Easy Days](../scheduling/easy-days.md) — Reduce specific days
