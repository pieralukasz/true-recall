# Statistics

The **Statistics View** provides detailed analytics about your learning progress, retention rates, and review patterns.

## Opening Statistics

- **Ribbon icon** — Click the bar chart icon
- **Command** — Cmd/Ctrl + P → "Open statistics panel"

## Statistics Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Stats] [NL Query]                    [1W] [1M] [3M] [1Y] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Today's Stats                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Reviewed: 42  |  Retention: 88%  |  Time: 12 min       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Future Due (Next 30 days)                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         [Bar chart showing forecast]                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Reviews Over Time                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         [Line chart showing review history]             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Retention Rate                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         [Chart showing retention trend]                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Card Counts by State                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  New: 45  |  Learning: 12  |  Review: 230  |  Susp: 5  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Collection Health                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Health Score: 87/100                                   ││
│  │  Young: 45%  |  Mature: 52%  |  Suspended: 3%          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Time Range Selector

Top-right corner:

| Range | Description |
|-------|-------------|
| **1W** | Last 7 days |
| **1M** | Last 30 days |
| **3M** | Last 90 days |
| **1Y** | Last year |
| **All** | All time |

Charts update based on selected range.

## Today's Stats

Quick summary of today's activity:

| Metric | Description |
|--------|-------------|
| Reviewed | Cards reviewed today |
| Retention | Percentage answered Good/Easy |
| Time | Total study time |

## Future Due Chart

Forecast of upcoming reviews:

- X-axis: Days ahead
- Y-axis: Number of cards due
- Hover: See exact count per day

Use to plan study sessions and identify busy periods.

## Reviews Over Time

Historical review activity:

- Shows cards reviewed per day
- Highlights trends and patterns
- Compare with goals

## Retention Rate

Your recall accuracy over time:

- **True Retention** — Calculated using FSRS formula
- **Target line** — Your desired retention setting
- **Trend** — Improving or declining

## Rating Distribution

Breakdown of your answers:

| Rating | Color | Description |
|--------|-------|-------------|
| Again | Red | Forgotten |
| Hard | Yellow | Difficult |
| Good | Blue | Correct |
| Easy | Green | Instant |

Helps identify if you're being too harsh or lenient.

## Card Counts by State

Current collection breakdown:

| State | Description |
|-------|-------------|
| New | Never reviewed |
| Learning | In initial phase |
| Review | Graduated cards |
| Suspended | Manually paused |

## Collection Health

Overall health score (0-100):

Factors:
- Percentage of mature cards
- Retention rate
- Review consistency
- Lapse rate

| Score | Health |
|-------|--------|
| 90-100 | Excellent |
| 75-89 | Good |
| 60-74 | Fair |
| <60 | Needs attention |

## Note Performance Table

Top and bottom performing notes:

| Column | Description |
|--------|-------------|
| Note | Source note name |
| Cards | Card count |
| Retention | Retention rate |
| Lapses | Total lapses |
| Last Review | Most recent review |

Click a note to open it.

## Creation Source Chart

How cards were created:

| Source | Description |
|--------|-------------|
| AI | AI-generated |
| Manual | Hand-written |
| Import | From Anki/other |

## Calendar Heatmap

Year view of review activity:

- Each day is a square
- Color intensity = review count
- Hover for details
- Streak tracking

## Natural Language Query

The NL Query tab lets you ask questions:

### Examples

| Query | Result |
|-------|--------|
| "Show cards I got wrong yesterday" | Lists forgotten cards |
| "How many new cards this week?" | Count of new cards |
| "Which notes have the worst retention?" | Ranked list |
| "Cards created in the last 3 days" | Recent cards |

### Using NL Query

1. Click **NL Query** tab
2. Type your question
3. Press Enter
4. Results appear below

Requires AI configuration (API key or subscription).

## Interactive Charts

All charts are interactive:

- **Hover** — See detailed values
- **Click** — Drill down to cards
- **Drag** — Select range

For example, click a bar in "Future Due" to preview those cards.

## Tips

### 1. Check Daily

Review stats after each session to track progress.

### 2. Watch Retention

If retention drops below target, consider:
- Reducing new cards per day
- Reviewing difficult cards more
- Adjusting desired retention setting

### 3. Use NL Query

Ask specific questions instead of hunting through charts.

### 4. Identify Problem Notes

Check Note Performance for consistently difficult notes.

## Related Topics

- [FSRS Algorithm](../concepts/fsrs-algorithm.md) — How retention is calculated
- [Dashboard](./dashboard.md) — Daily overview
- [Natural Language Queries](../ai/natural-language-queries.md) — AI queries
