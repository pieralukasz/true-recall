# FSRS Simulator

The **FSRS Simulator** lets you visualize how FSRS scheduling works by simulating review sequences. Perfect for understanding the algorithm and experimenting with parameters.

## Opening the Simulator

- **Command** — Cmd/Ctrl + P → "Open FSRS simulator"

## Simulator Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Controls                                                    │
│  Rating sequence: [Good] [Good] [Again] [Good] [Easy]      │
│  [+ Add Rating] [▶ Simulate] [↺ Reset]                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Simulation Chart                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │   1.0 ┤                                                ││
│  │       │     ╭────╮                                     ││
│  │   0.8 ┤    ╱      ╲     ╭───╮                          ││
│  │       │   ╱        ╲   ╱     ╲                         ││
│  │   0.6 ┤  ╱          ╲ ╱       ╲   ╭────                ││
│  │       │ ╱            ╲         ╲ ╱                     ││
│  │   0.4 ┤╱              ╲         ╲                      ││
│  │       │                ╲         ╲                     ││
│  │   0.2 ┤                 ╲         ╲╮                   ││
│  │       │                  ╲         ╲╲                  ││
│  │   0.0 ┼──┬──┬──┬──┬──┬──┬─╳─┬──┬──┬─╳─┬──┬──┬──┬──    ││
│  │       0  1  2  3  4  5  6  7  8  9  10 11 12 13 14     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Metric: [Retention ▼]  [Log scale]  [Animate]             │
├─────────────────────────────────────────────────────────────┤
│  Parameters                                                 │
│  Desired Retention: [0.90]                                 │
│  Max Interval: [36500]                                     │
│  [Reset Weights] [Undo] [Redo]                             │
│                                                             │
│  FSRS Weights (21 parameters)                              │
│  w0: [0.4]  w1: [0.6]  w2: [0.2]  ...                      │
├─────────────────────────────────────────────────────────────┤
│  Results                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Review │ Rating │ Interval │ Stability │ Retrievability ││
│  │   1    │ Good   │   1d     │   2.5     │    0.90        ││
│  │   2    │ Good   │   3d     │   5.2     │    0.90        ││
│  │   3    │ Again  │   0d     │   1.8     │    0.00        ││
│  │   4    │ Good   │   1d     │   2.1     │    0.90        ││
│  │   5    │ Easy   │   5d     │   8.5     │    0.95        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Controls Panel

### Rating Sequence

Build a review sequence:

1. Click rating buttons (Again, Hard, Good, Easy)
2. Each click adds to the sequence
3. Sequence shows at top

### Actions

| Button | Action |
|--------|--------|
| **+ Add Rating** | Add rating to sequence |
| **▶ Simulate** | Run the simulation |
| **↺ Reset** | Clear sequence |

## Simulation Chart

Visualizes the simulated reviews:

### Metrics

| Metric | Description |
|--------|-------------|
| **Retention** | Probability of recall (0-1) |
| **Stability** | Memory stability in days |
| **Retrievability** | Current recall probability |

Select metric with dropdown.

### Chart Elements

- **Lines** — Metric value over time
- **Markers (✕)** — Review events
- **Dips** — Forgetting (Again ratings)
- **Rises** — Strengthening (Good/Easy ratings)

### Options

| Option | Effect |
|--------|--------|
| **Log scale** | Use logarithmic Y-axis |
| **Animate** | Animate the simulation |

## Parameters Panel

### Basic Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Desired Retention | 0.90 | Target recall probability |
| Max Interval | 36500 | Maximum interval in days |

### FSRS Weights

21 weight sliders for fine control:

| Weight Group | Purpose |
|--------------|---------|
| w[0-1] | Initial stability |
| w[2-3] | Initial difficulty |
| w[4-5] | Difficulty update |
| w[6-16] | Stability multipliers |
| w[17-20] | Learning stability |

### Weight Actions

| Button | Action |
|--------|--------|
| **Reset Weights** | Restore default weights |
| **Undo** | Undo last change |
| **Redo** | Redo undone change |

## Results Table

Shows each simulated review:

| Column | Description |
|--------|-------------|
| Review | Review number |
| Rating | Your rating |
| Interval | Days until next review |
| Stability | Memory stability |
| Retrievability | Recall probability |

## Use Cases

### Understanding FSRS

1. Create a sequence: Good, Good, Good
2. Simulate
3. Watch stability grow and intervals increase

### Seeing Lapse Effects

1. Create: Good, Good, Again, Good
2. Simulate
3. See how "Again" resets progress

### Comparing Ratings

1. Create: Good, Good, Good
2. Simulate, note intervals
3. Reset, create: Easy, Easy, Easy
4. Compare — Easy gives longer intervals

### Testing Parameters

1. Adjust desired retention to 0.95
2. Simulate same sequence
3. Compare intervals — higher retention = more reviews

## Tips

### 1. Start Simple

Begin with short sequences (3-5 ratings) to understand patterns.

### 2. Compare Scenarios

Run the same sequence with different parameters to see effects.

### 3. Use Log Scale

For long sequences, log scale makes changes visible.

### 4. Watch Retrievability

The dips show when you're likely to forget.

## Related Topics

- [FSRS Algorithm](../concepts/fsrs-algorithm.md) — Algorithm explanation
- [FSRS Optimization](../scheduling/fsrs-optimization.md) — Optimizing parameters
- [FSRS Settings](../configuration/fsrs-settings.md) — Configuration
