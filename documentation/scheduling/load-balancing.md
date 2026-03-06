# Load Balancing

**Load Balancing** distributes your review workload evenly across days, preventing overwhelming spikes and creating a consistent study schedule.

## The Problem

Without load balancing, reviews can bunch up:

```
Mon: 20 reviews
Tue: 15 reviews
Wed: 150 reviews ← Overwhelming!
Thu: 10 reviews
Fri: 200 reviews ← Another spike!
```

This happens because:
- Many cards were learned on the same day
- FSRS calculated similar intervals
- Intervals converge over time

## How Load Balancing Works

Load balancing redistributes cards to smooth out workload:

```
Before:  Mon: 20  Tue: 15  Wed: 150  Thu: 10  Fri: 200
After:   Mon: 75  Tue: 80  Wed: 85   Thu: 80  Fri: 75
```

Cards are moved slightly earlier or later to balance the load, while maintaining FSRS-predicted retention.

## Enabling Load Balancing

Settings → FSRS → Load Balance section

| Setting | Default | Description |
|---------|---------|-------------|
| Enable load balancing | Off | Activate automatic balancing |
| Target daily reviews | 100 | Desired reviews per day |
| Maximum deviation | 20% | Allow this much variation |

## Configuration

### Target Daily Reviews

Your ideal daily review count. The system tries to distribute reviews to hit this target.

Consider:
- How much time you can study daily
- Your current average reviews
- Your comfort level

### Maximum Deviation

How much variation from target is acceptable before rebalancing.

- **Low (10%)** — Stricter, more frequent adjustments
- **Medium (20%)** — Balanced approach
- **High (50%)** — More tolerant, fewer adjustments

## Manual Balancing

### Balance Now

Settings → FSRS → Balance workload now

Immediately redistributes reviews for the next 30 days.

### Preview Before Applying

1. Click "Balance workload now"
2. See preview of changes
3. Confirm or cancel

## When Load Balancing Activates

Automatic balancing runs when:

1. A day exceeds target by more than deviation
2. Multiple consecutive days are below target
3. Significant imbalance detected

You can also trigger manually anytime.

## What Gets Balanced

| Card Type | Balanced? |
|-----------|-----------|
| Review cards | ✅ Yes |
| New cards | ❌ No |
| Learning cards | ❌ No |
| Suspended cards | ❌ No |

Only review cards with calculated intervals are adjusted.

## How Much Cards Move

Cards are moved within limits to preserve retention:

- Maximum advance: 20% of interval
- Maximum delay: 20% of interval

Example: A card due in 10 days might be moved to 8-12 days.

## Combining with Other Features

### Easy Days

Load balancing respects easy days:
- Easy days have reduced target
- Cards are shifted away from easy days

### Scheduled Breaks

Load balancing works with breaks:
- Cards are moved around break periods
- Break days excluded from balancing

## Monitoring

### Statistics View

Check "Future Due" chart to see balanced workload.

### Dashboard

Review count estimates reflect balanced load.

## Tips

### 1. Set Realistic Target

Base target on your actual capacity, not aspirational goals.

### 2. Check After Major Changes

After importing cards or changing presets, run manual balance.

### 3. Combine with Easy Days

Use both features for weekends or busy days.

### 4. Review Preview

Always check the preview before applying major changes.

## Troubleshooting

### Still Seeing Spikes

1. Increase deviation tolerance
2. Run manual balance
3. Check for cards with very short intervals

### Too Many Cards Moved

1. Reduce target daily reviews
2. Increase maximum deviation
3. Balance less frequently

### Cards Due Too Early

Load balancing never moves cards before they're due. Early cards are from other causes (FSRS optimization, rescheduling).

## Related Topics

- [Easy Days](./easy-days.md) — Reduce specific days
- [Scheduled Breaks](./scheduled-breaks.md) — Vacation handling
- [Scheduling](../concepts/scheduling.md) — Review basics
