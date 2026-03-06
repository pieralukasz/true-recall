# FSRS Algorithm

True Recall uses **FSRS v6** (Free Spaced Repetition Scheduler), a modern spaced repetition algorithm that significantly outperforms the classic SM-2 algorithm used by Anki.

## What is FSRS?

FSRS is a machine learning-based algorithm developed by Jarrett Ye. It models your memory using three components:

1. **Stability (S)** — How long a memory lasts before you're likely to forget
2. **Difficulty (D)** — How hard a card is to learn
3. **Retrievability (R)** — Current probability of successful recall

These parameters are updated after each review based on your rating (Again, Hard, Good, Easy).

## How FSRS Differs from SM-2

| Feature | FSRS | SM-2 (Anki) |
|---------|------|-------------|
| Parameters | 21 weights | 3 parameters |
| Adaptability | Learns from your data | Fixed formula |
| Retention target | Configurable | Not explicit |
| Interval calculation | Stability × retrievability | Ease factor based |
| Optimization | ML-based | Manual tuning |

FSRS typically achieves **10-20% better retention** with **15-20% fewer reviews** compared to SM-2.

## Core Concepts

### Stability

Stability is the time (in days) at which retrievability drops to 90% (or your desired retention). Higher stability = longer intervals.

Factors that increase stability:
- Successful recall (especially "Good" and "Easy")
- Multiple successful reviews
- Longer previous intervals

Factors that decrease stability:
- Forgetting ("Again" rating)
- Long gaps without review

### Difficulty

Difficulty represents how hard a card is to learn. Range: 0-10.

- **Low difficulty (0-3)** — Easy concepts, quick to memorize
- **Medium difficulty (4-6)** — Average difficulty
- **High difficulty (7-10)** — Challenging material, needs more reviews

Difficulty is updated after each review but stabilizes over time.

### Retrievability

Retrievability is the current probability you can recall the answer. It decreases over time according to the forgetting curve:

```
R = (1 + t/S × w)^-1
```

Where:
- R = Retrievability
- t = Days since last review
- S = Stability
- w = Parameter from FSRS weights

### Desired Retention

The target probability of recall you want to maintain. Default: 90%.

| Desired Retention | Effect |
|-------------------|--------|
| 85% | Fewer reviews, more forgetting |
| 90% (default) | Balanced |
| 95% | More reviews, less forgetting |

Higher retention = more work. 90% is optimal for most learners.

## The 21 FSRS Weights

FSRS uses 17-21 weights that control how the algorithm behaves:

| Weight Group | Purpose |
|--------------|---------|
| w[0-1] | Initial stability (from rating) |
| w[2-3] | Initial difficulty |
| w[4-5] | Difficulty update after review |
| w[6-7] | Stability update for hard/good |
| w[8] | Stability update for easy |
| w[9-10] | Stability after lapse |
| w[11-16] | Hard/good/easy stability multipliers |
| w[17-20] | Learning/relearning stability |

You can customize these weights, but **optimization** (see below) is recommended.

## FSRS States

Cards progress through states:

```
New → Learning → Review → (lapse) → Relearning → Review
         ↓                        ↓
       (suspend)              (suspend)
```

### New
- Never reviewed
- No stability/difficulty data yet
- Green badge

### Learning
- First few reviews (based on learning steps)
- Short intervals (minutes/hours)
- Orange badge

### Review
- Graduated from learning
- Longer intervals (days/months/years)
- Blue badge

### Relearning
- After a lapse (forgot in review)
- Similar to learning but faster
- Orange badge

## Interval Calculation

The next interval is calculated to maintain your desired retention:

```
Interval = S × (R_target / R_current - 1) / factor
```

With fuzz applied (±2.5% by default) to prevent bunching.

## Optimization

FSRS can optimize its weights based on your review history. This personalizes the algorithm to your learning patterns.

### Requirements

- **Minimum 400 reviews** per preset
- **Recommended 1000+ reviews** for best results
- Reviews should span multiple days

### How to Optimize

1. Go to Settings → True Recall → FSRS
2. Click **Optimize parameters**
3. Wait for optimization to complete
4. Review the suggested weights
5. Apply or discard

The optimizer uses your review history to find weights that would have maximized retention while minimizing reviews.

### When to Re-optimize

- After major changes in study habits
- When switching topics significantly
- Every few months for active learners

## FSRS Presets

Presets let you have different FSRS settings for different types of content:

| Preset | Use Case |
|--------|----------|
| Default | General learning |
| Intensive | Exam prep (higher daily limits) |
| Medical | Medical school (optimized for retention) |
| Languages | Vocabulary learning |

Each preset has its own:
- Desired retention
- Daily limits
- Learning steps
- FSRS weights

## Related Topics

- [Scheduling](./scheduling.md) — Day boundaries and learning steps
- [FSRS Optimization](../scheduling/fsrs-optimization.md) — Detailed optimization guide
- [FSRS Simulator](../views/fsrs-simulator.md) — Visualize FSRS behavior
- [FSRS Settings](../configuration/fsrs-settings.md) — Configuration options

## Further Reading

- [FSRS GitHub Repository](https://github.com/open-spaced-repetition/fsrs4anki)
- [FSRS Whitepaper](https://github.com/open-spaced-repetition/fsrs4anki/wiki/FSRS-v4-Whitepaper)
- [FSRS vs SM-2 Comparison](https://github.com/open-spaced-repetition/fsrs4anki/wiki/FSRS-v4-vs-SM-2)
