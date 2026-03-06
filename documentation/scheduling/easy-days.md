# Easy Days

**Easy Days** reduce your review workload on specific days of the week. Perfect for weekends, busy days, or maintaining work-life balance.

## How Easy Days Work

On configured easy days:

- Target reviews reduced by a percentage (default: 50%)
- Cards due on easy days are redistributed
- FSRS intervals adjusted to account for reduced load

## Enabling Easy Days

Settings → FSRS → Easy Days → Configure

### Configuration Modal

| Setting | Description |
|---------|-------------|
| Weekdays | Select which days (Sun-Sat) |
| Specific dates | One-time easy days |
| Workload multiplier | Percentage of normal load (default: 50%) |

### Example Configuration

```
Recurring weekdays:
☑ Sunday (50% load)
☐ Monday
☐ Tuesday
☐ Wednesday
☐ Thursday
☐ Friday
☑ Saturday (50% load)

Specific dates:
2024-03-17 (St. Patrick's Day - 25% load)
2024-12-25 (Christmas - 0% load)
```

## Workload Multiplier

The multiplier determines what percentage of normal reviews you'll see:

| Multiplier | Effect |
|------------|--------|
| 100% | Normal load (easy day disabled) |
| 75% | Reduced by 25% |
| 50% | Half the normal reviews |
| 25% | Minimal reviews |
| 0% | No reviews (day off) |

### Choosing a Multiplier

- **50%** — Good for weekends, maintain some reviews
- **25%** — Very light days, minimal commitment
- **0%** — Complete break, no reviews

## Card Redistribution

Cards that would be due on easy days are moved:

### Direction

Cards are moved to:
- Adjacent non-easy days
- Earlier is preferred over later

### Limits

Cards won't be moved more than:
- 3 days early
- 3 days late

If a card can't be redistributed within limits, it remains on the easy day.

## Specific Dates

Add one-time easy days for:

- Holidays
- Travel days
- Events
- Exams (light review before)

### Adding Specific Dates

1. In Easy Days modal
2. Click "Add specific date"
3. Enter date (YYYY-MM-DD)
4. Set multiplier
5. Save

### Example Specific Dates

```
2024-03-15: 25% (Day before exam)
2024-03-16: 0% (Exam day)
2024-04-10: 50% (Travel day)
2024-12-25: 0% (Christmas)
2024-12-26: 25% (Day after Christmas)
```

## Applying Easy Days

After configuration:

1. Click **Apply now** to redistribute immediately
2. Or wait for automatic application (daily)

### Preview

Before applying, see how cards will be redistributed.

## Combining with Other Features

### Load Balancing

Easy days are considered when balancing:
- Easy days have reduced target
- Balancing distributes around easy days

### Scheduled Breaks

Both can be used:
- Scheduled breaks for longer periods
- Easy days for recurring days

## Monitoring

### Dashboard

Easy days show reduced due counts.

### Statistics

Future Due chart shows dips on easy days.

## Tips

### 1. Start with Weekends

Configure Saturday and Sunday as easy days first.

### 2. Don't Go to 0%

Maintaining some reviews (even 25%) helps retention better than complete breaks.

### 3. Plan Ahead

Add specific dates for known events in advance.

### 4. Review on Easy Days

Even on easy days, try to complete the reduced load.

## Troubleshooting

### Cards Still Due on Easy Day

Cards might remain if:
- Can't be moved within limits
- Already reviewed recently
- Learning cards (not redistributable)

### Too Many Cards Moved

Reduce the number of easy days or increase multiplier.

### Forgot to Apply

Click "Apply now" to redistribute immediately.

## Related Topics

- [Load Balancing](./load-balancing.md) — Distribute workload
- [Scheduled Breaks](./scheduled-breaks.md) — Longer breaks
- [Scheduling](../concepts/scheduling.md) — Review basics
