# Scheduled Breaks

**Scheduled Breaks** let you plan vacation periods or time off where reviews are redistributed to other days. Unlike Easy Days, breaks are one-time or finite periods.

## When to Use Scheduled Breaks

- Vacations
- Business trips
- Exam periods (light review)
- Any planned time away from studying

## Adding a Break

Settings → FSRS → Scheduled Breaks → Add scheduled break

### Break Configuration

| Field | Description |
|-------|-------------|
| Start date | First day of break (YYYY-MM-DD) |
| End date | Last day of break (YYYY-MM-DD) |
| Redistribution | Before, After, or Both |

### Example Break

```
Start: 2024-03-20
End: 2024-03-27
Redistribution: Before
```

Cards due March 20-27 are moved to days before the break.

## Redistribution Options

### Before

Cards are moved to days before the break starts.

```
Break: March 20-27
Cards due March 20-27 → Moved to March 15-19
```

Best for:
- Preparing before leaving
- Getting ahead on reviews

### After

Cards are moved to days after the break ends.

```
Break: March 20-27
Cards due March 20-27 → Moved to March 28-31
```

Best for:
- Catching up after return
- Avoiding pre-break cramming

### Both

Cards split between before and after.

```
Break: March 20-27
Half of cards → March 15-19
Half of cards → March 28-31
```

Best for:
- Long breaks
- Balancing workload

## Managing Breaks

### Viewing Breaks

Settings → FSRS → Scheduled Breaks

Shows list of configured breaks with dates and status.

### Editing a Break

1. Click on the break
2. Modify dates or redistribution
3. Save

### Deleting a Break

1. Click on the break
2. Click Delete
3. Cards return to original dates

## Break Overlap

If breaks overlap with Easy Days:

- Scheduled break takes priority
- Easy day settings ignored for those dates

## Before the Break

### Prepare in Advance

1. Add break at least a week before
2. Cards redistribute automatically
3. Review the increased load before break

### Pre-Break Session

Consider a cram session to get ahead before leaving.

## After the Break

### Catching Up

If you chose "After" or "Both" redistribution:

- Expect higher load on return
- Consider increasing daily limits temporarily

### Reviewing Missed Cards

Any cards that couldn't be redistributed:
- Remain due during break
- Will be waiting when you return

## Tips

### 1. Plan Early

Add breaks as soon as you know about them.

### 2. Use "Both" for Long Breaks

For breaks longer than a week, split the redistribution.

### 3. Check Dashboard Before Leaving

See what your pre-break or post-break load looks like.

### 4. Consider Easy Days Too

Add Easy Days for weekends during longer breaks.

## Example Scenarios

### Week Vacation

```
Start: 2024-04-01
End: 2024-04-07
Redistribution: Both

Effect:
- Half of April 1-7 cards → Late March
- Half of April 1-7 cards → Early April
```

### Exam Week (Light Review)

```
Start: 2024-05-13
End: 2024-05-17
Redistribution: After

Effect:
- All May 13-17 cards → After May 17
- Focus on exam, catch up after
```

### Business Trip

```
Start: 2024-06-10
End: 2024-06-12
Redistribution: Before

Effect:
- All June 10-12 cards → June 7-9
- Clear queue before trip
```

## Troubleshooting

### Cards Still Due During Break

Some cards can't be moved:
- Learning cards with short intervals
- Cards already at minimum interval
- Cards where redistribution would exceed limits

### Too Many Cards Before/After

Reduce the break length or use "Both" redistribution.

### Forgot to Add Break

Add it now and apply — cards will be redistributed immediately.

## Related Topics

- [Easy Days](./easy-days.md) — Recurring reduced days
- [Load Balancing](./load-balancing.md) — Distribute workload
- [Scheduling](../concepts/scheduling.md) — Review basics
