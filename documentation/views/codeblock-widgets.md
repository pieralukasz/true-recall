# CodeBlock Widgets

True Recall provides **25+ embeddable widgets** that you can add to any note using code blocks. Create custom dashboards, track progress, and visualize your learning.

## Basic Syntax

````markdown
```true-recall-<widget-name>
option: value
```
````

## Available Widgets

### Analytics Widgets

#### Health Widget
Shows overall collection health score.

````markdown
```true-recall-health
```
````

#### Heatmap Widget
Calendar heatmap of review activity.

````markdown
```true-recall-heatmap
days: 365
```
````

#### Comparison Widget
Compare stats between time periods.

````markdown
```true-recall-comparison
period1: last7days
period2: previous7days
```
````

#### Workload Widget
Review workload distribution.

````markdown
```true-recall-workload
days: 30
```
````

#### Streak Widget
Current and longest review streak.

````markdown
```true-recall-streak
```
````

### FSRS Widgets

#### True Retention Widget
True retention rate over time.

````markdown
```true-recall-retention
range: 30d
```
````

#### Forecast Widget
Future due cards prediction.

````markdown
```true-recall-forecast
days: 30
project: optional-project-name
```
````

#### Preset Info Widget
Display preset configuration.

````markdown
```true-recall-preset
preset: default
```
````

#### Problem Cards Widget
Leeches and difficult cards.

 ````markdown
```true-recall-problems
minLapses: 3
```
````

### Project Widgets

#### Dashboard Widget
Embedded project dashboard.

````markdown
```true-recall-dashboard
project: Medicine
showStats: true
```
````

#### Project Widget
Single project overview.

````markdown
```true-recall-project
project: Biology
```
````

#### Project Hub Widget
All projects overview.

````markdown
```true-recall-projects
```
````

#### Unassigned Notes Widget
Notes without project assignment.

````markdown
```true-recall-unassigned
```
````

### Note Widgets

#### Decay Widget
Memory decay visualization for a note.

````markdown
```true-recall-decay
note: [[Note Name]]
```
````

#### Note Health Widget
Per-note health metrics.

````markdown
```true-recall-note-health
note: [[Biology Notes]]
```
````

### Gamification Widgets

#### Progress Widget
Today's study progress.

````markdown
```true-recall-progress
```
````

#### Answer Streak Widget
Current answer streak during session.

````markdown
```true-recall-answer-streak
```
````

#### Ratings Widget
Rating distribution chart.

````markdown
```true-recall-ratings
range: 7d
```
````

#### Maturity Widget
Card maturity progress (young vs mature).

````markdown
```true-recall-maturity
```
````

#### Countdown Widget
Countdown to a goal date.

````markdown
```true-recall-countdown
goal: 2024-06-01
label: Exam Day
```
````

#### Achievements Widget
Achievement badges earned.

````markdown
```true-recall-achievements
```
````

#### Leaderboard Widget
Top performing notes.

````markdown
```true-recall-leaderboard
limit: 10
sortBy: retention
```
````

## Widget Options

### Common Options

| Option | Type | Description |
|--------|------|-------------|
| `project` | string | Filter by project |
| `note` | string | Filter by note (wiki-link) |
| `preset` | string | Filter by preset |
| `days` | number | Time range in days |
| `range` | string | Time range (7d, 30d, 90d, 1y) |
| `limit` | number | Maximum items to show |

### Project Filtering

Most widgets support project filtering:

````markdown
```true-recall-forecast
project: Medicine/Anatomy
days: 14
```
````

### Note Filtering

Some widgets can target specific notes:

````markdown
```true-recall-note-health
note: [[Flashcards/Biology]]
```
````

## Creating Custom Dashboards

Combine widgets in a single note:

````markdown
# Study Dashboard

## Today
```true-recall-progress
```

```true-recall-streak
```

## Forecast
```true-recall-forecast
days: 14
```

## Health
```true-recall-health
```

```true-recall-retention
range: 30d
```

## Projects
```true-recall-projects
```
````

## Widget Refresh

Widgets update:
- **On note open** — When you open the note
- **On data change** — When you review cards
- **Manual refresh** — Click the widget

## Responsive Design

Widgets adapt to:
- **Desktop** — Full-width layouts
- **Mobile** — Stacked layouts
- **Sidebar** — Compact views

## Tips

### 1. Create a Dashboard Note

Make a dedicated note with your favorite widgets for quick reference.

### 2. Use Project Widgets

Embed project-specific dashboards in project notes.

### 3. Track Goals

Use countdown widgets for exam dates and deadlines.

### 4. Monitor Health

Check health and retention widgets regularly.

### 5. Combine with Notes

Add context around widgets with regular markdown.

## Example: Exam Prep Dashboard

````markdown
# Medical Board Exam Prep

**Exam Date:** June 15, 2024

```true-recall-countdown
goal: 2024-06-15
label: Exam Day
```

## Daily Progress
```true-recall-progress
```

```true-recall-streak
```

## Forecast (Next 14 Days)
```true-recall-forecast
project: Medicine
days: 14
```

## Weak Areas
```true-recall-problems
minLapses: 3
project: Medicine
```

## Retention Trend
```true-recall-retention
range: 30d
project: Medicine
```

## Project Overview
```true-recall-dashboard
project: Medicine
showStats: true
```
````

## Related Topics

- [Dashboard](./dashboard.md) — Main dashboard view
- [Statistics](./statistics.md) — Detailed statistics
- [Projects](../concepts/projects.md) — Project organization
