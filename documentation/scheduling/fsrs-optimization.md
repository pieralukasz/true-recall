# FSRS Optimization

**FSRS Optimization** analyzes your review history to find the best FSRS parameters for your learning patterns. This personalizes the algorithm to you.

## How Optimization Works

1. Export your review history
2. FSRS algorithm finds weights that would have maximized retention
3. Minimized review count while hitting retention target
4. Returns optimized 17-21 weight parameters

## Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Total reviews | 400 | 1000+ |
| Review span | 2 weeks | 1 month+ |
| Rating variety | Some lapses | Mixed ratings |

### Why These Requirements?

- **Review count** — More data = better optimization
- **Review span** — Need cards at various intervals
- **Rating variety** — Algorithm learns from different ratings

## Running Optimization

Settings → FSRS → Parameters section → Optimize parameters

### Optimization Process

1. Click "Optimize parameters"
2. Wait for analysis (may take a few minutes)
3. Review results:
   - Current weights
   - Optimized weights
   - Predicted improvement
4. Apply or discard

### What Gets Optimized

The 17-21 FSRS weights that control:
- Initial stability (new cards)
- Difficulty estimation
- Stability after review
- Stability after lapse
- Interval multipliers

## Understanding Results

### Log Loss

Lower is better. Measures prediction accuracy.

### Retention Comparison

| Metric | Description |
|--------|-------------|
| Predicted retention | What model predicts |
| Actual retention | Your real retention |
| Difference | Accuracy of prediction |

### Review Count Prediction

How many reviews the optimized weights would save.

## When to Optimize

### Good Times

- After 1000+ reviews
- When starting a new topic
- Every 2-3 months
- After changing study habits

### Not Recommended

- With fewer than 400 reviews
- If all ratings are the same
- If review history is very recent

## After Optimization

### Apply Weights

Click "Apply" to use optimized weights.

### Reschedule (Optional)

Settings → FSRS → Preview reschedule

Recalculates all intervals with new weights.

### Monitor Results

Check statistics over the next few weeks:
- Retention rate
- Review count
- Comfort level

## Optimization Tips

### 1. Be Consistent Before Optimizing

Use the same rating patterns for a few weeks before optimizing.

### 2. Don't Optimize Too Often

Monthly or quarterly is usually enough.

### 3. Compare Results

If new weights feel worse, you can reset to defaults.

### 4. Preset-Specific Optimization

Each preset is optimized separately. Optimize presets for different topics.

## Resetting to Defaults

If optimization doesn't improve things:

Settings → FSRS → Reset to defaults

Restores the standard FSRS weights.

## Advanced: Custom Weights

Manually edit weights:

Settings → FSRS → Custom FSRS weights

Enter 17, 19, or 21 comma-separated values.

### When to Use Custom Weights

- You have weights from external optimizer
- Fine-tuning specific parameters
- Research purposes

### Finding Weights

Use the [FSRS4Anki Optimizer](https://github.com/open-spaced-repetition/fsrs4anki) for more detailed analysis.

## Troubleshooting

### "Not enough reviews"

Accumulate more reviews before optimizing.

### Optimization Fails

1. Check for corrupted review history
2. Run database integrity check
3. Try again later

### Weights Seem Wrong

1. Don't apply immediately
2. Compare predicted vs actual
3. If unsure, reset to defaults

### No Improvement Shown

Your current weights might already be optimal, or you need more review data.

## Related Topics

- [FSRS Algorithm](../concepts/fsrs-algorithm.md) — How FSRS works
- [Presets](../organization/presets.md) — Preset configuration
- [FSRS Simulator](../views/fsrs-simulator.md) — Test parameters
- [FSRS Settings](../configuration/fsrs-settings.md) — Settings reference
