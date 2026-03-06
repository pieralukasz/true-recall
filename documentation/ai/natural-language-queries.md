# Natural Language Queries

True Recall's **Natural Language Query (NLQ)** feature lets you ask questions about your flashcard statistics in plain English. No need to navigate menus or understand complex filters.

## Opening NLQ

### From Statistics View

1. Open Statistics panel
2. Click the **NL Query** tab

## How It Works

1. Type a question in natural language
2. AI interprets your question
3. True Recall queries the database
4. Results appear below

## Example Queries

### Card-Related Queries

| Query | Result |
|-------|--------|
| "Show cards I got wrong yesterday" | List of forgotten cards |
| "Cards I haven't reviewed in 2 weeks" | Dormant cards |
| "New cards created this week" | Recent additions |
| "Cards with more than 3 lapses" | Difficult cards |

### Statistics Queries

| Query | Result |
|-------|--------|
| "How many cards did I review today?" | Count with breakdown |
| "What's my retention rate this month?" | Percentage |
| "Which day had the most reviews?" | Date and count |
| "Average cards per day last week" | Average calculation |

### Note-Related Queries

| Query | Result |
|-------|--------|
| "Which notes have the worst retention?" | Ranked list |
| "Notes I haven't studied recently" | List with dates |
| "Show me notes in the Biology project" | Filtered list |

### Project Queries

| Query | Result |
|-------|--------|
| "How many cards in Medicine project?" | Count |
| "Projects with most due cards" | Ranked list |
| "Show project hierarchy" | Tree view |

## Query Interface

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 [Type your question here...                    ] [Ask]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Results for: "Cards I got wrong yesterday"                │
│                                                             │
│  Found 5 cards:                                            │
│                                                             │
│  1. What is the powerhouse of the cell?                    │
│     Source: [[Cell Biology]]                               │
│     [View Card] [Review Now]                               │
│                                                             │
│  2. Which organelle contains DNA?                          │
│     Source: [[Cell Biology]]                               │
│     [View Card] [Review Now]                               │
│                                                             │
│  ... 3 more cards                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Result Actions

Depending on the query type, you can:

| Action | Description |
|--------|-------------|
| View Card | Open card in browser |
| Review Now | Start review with these cards |
| Go to Note | Open source note |
| Export | Save results |

## Query Tips

### Be Specific

```
✅ Good: "Cards I got wrong in Biology project yesterday"
❌ Vague: "bad cards"
```

### Use Time References

```
✅ "Cards created in the last 7 days"
✅ "Reviews from yesterday"
✅ "Cards due this week"
```

### Combine Filters

```
✅ "New cards in Medicine project with more than 2 lapses"
```

### Ask Follow-ups

After initial results, ask:
- "Show me the source notes for these"
- "How many of these are cloze cards?"
- "Create a review session with these"

## Supported Query Types

### Time-Based

- "today", "yesterday"
- "this week", "last week"
- "this month", "last month"
- "in the last N days"
- Specific dates

### State-Based

- "new", "learning", "review"
- "suspended", "due"
- "forgotten", "lapsed"

### Metric-Based

- "retention rate"
- "lapses", "interval"
- "stability", "difficulty"

### Entity-Based

- "cards", "notes", "projects"
- "presets", "tags"

## Limitations

- Requires AI configuration (API key or subscription)
- Complex queries may need clarification
- Very specific filters might not work
- Network required

## Troubleshooting

### Query Not Understood

1. Rephrase the question
2. Be more specific
3. Break into multiple queries

### No Results Found

1. Check if matching data exists
2. Adjust time range
3. Broaden the query

### Slow Response

1. Large result sets take longer
2. Add more filters to narrow results

## Related Topics

- [Statistics](../views/statistics.md) — Statistics view
- [Card Browser](../views/card-browser.md) — Manual card filtering
- [AI Settings](../configuration/ai-settings.md) — AI configuration
