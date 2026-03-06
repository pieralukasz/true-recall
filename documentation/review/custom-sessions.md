# Custom Sessions

**Custom Sessions** let you create filtered review sessions with specific parameters. Instead of reviewing all due cards, you can focus on particular subsets.

## Opening Custom Session

### From Dashboard

1. Open Dashboard
2. Right-click a project or note
3. Select **Custom session**

### From Review View

1. Start any review session
2. Click the menu (⋯)
3. Select **Custom session**

### From Command

Command Palette → "Custom study session"

## Custom Session Options

### Filters

| Filter | Description |
|--------|-------------|
| **Project** | Limit to specific project |
| **Note** | Limit to specific note(s) |
| **State** | New, Learning, Review, or All |
| **Tags** | Filter by card tags |
| **Preset** | Only cards using specific preset |
| **Date Range** | Cards created within range |
| **Due Only** | Only due cards, or include future |

### Limits

| Setting | Description |
|---------|-------------|
| **Max cards** | Maximum cards in session |
| **Max new** | Maximum new cards |
| **Max time** | Time limit (optional) |

### Order

| Option | Description |
|--------|-------------|
| **Random** | Shuffle cards |
| **Due first** | Oldest due cards first |
| **New first** | New cards before reviews |

## Session Types

### Today's Cards

Review all cards due today with normal limits.

### Preview New

Preview new cards without scheduling them. Good for:
- Reviewing AI-generated cards before committing
- Checking a note's flashcards

### Cram

Extra practice that doesn't affect scheduling. See [Cramming](./cramming.md).

### Study Ahead

Review cards due in the future. Intervals are shortened but not reset.

### Review Forgotten

Only cards you've lapsed on recently.

### Review by Tag

Filter cards by tags like `#important` or `#exam`.

## Custom Session Modal

```
┌─────────────────────────────────────┐
│        Custom Study Session         │
├─────────────────────────────────────┤
│                                     │
│  Session type: [Dropdown ▼]         │
│                                     │
│  Filters:                           │
│  ☑ Project: Biology                 │
│  ☐ Tags: [Enter tags...]            │
│  ☐ State: [All ▼]                   │
│                                     │
│  Limits:                            │
│  Max cards: [100]                   │
│  Max new: [20]                      │
│  ☐ Time limit: [30] minutes         │
│                                     │
│  Order: [Random ▼]                  │
│                                     │
├─────────────────────────────────────┤
│         [Start Session]             │
└─────────────────────────────────────┘
```

## Use Cases

### Exam Prep

```
Session type: Review
Project: Biology/Final Exam
State: All
Max cards: 100
Order: Random
```

### Preview New Cards

```
Session type: Preview New
Project: Today's Notes
(No scheduling changes)
```

### Focus on Weak Areas

```
Session type: Review Forgotten
Time range: Last 7 days
Max cards: 50
```

### Quick Review

```
Session type: Today's Cards
Max time: 15 minutes
Max cards: Unlimited
```

## After Custom Session

When you finish a custom session:

1. See session summary
2. Option to start another custom session
3. Or return to Dashboard

Enable "Continuous custom reviews" in Settings → General to show "Next session" button after completion.

## Tips

### 1. Use Projects for Study Topics

Organize notes into projects, then create custom sessions per project.

### 2. Preview Before Committing

Use Preview mode for AI-generated cards before they affect your schedule.

### 3. Time-Box Your Sessions

Set a time limit to avoid marathon sessions.

### 4. Mix It Up

Use random order to prevent memorizing card sequence.

## Related Topics

- [Cramming](./cramming.md) — Practice without affecting schedule
- [Projects](../concepts/projects.md) — Organizing notes
- [Dashboard](../views/dashboard.md) — Starting point for sessions
