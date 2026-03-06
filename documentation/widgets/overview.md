# Widgets Reference

True Recall provides 25+ embeddable widgets that you can add to any note using code blocks. Create custom dashboards, track progress, and visualize your learning.

## Basic Syntax

````markdown
```true-recall-<widget-name>
option: value
```
````

## Complete Widget List

### Analytics Widgets

#### true-recall-health
Collection health score and metrics.

````markdown
```true-recall-health
```
````

Shows:
- Health score (0-100)
- Young vs mature ratio
- Suspension rate

---

#### true-recall-heatmap
Calendar heatmap of review activity.

````markdown
```true-recall-heatmap
days: 365
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| days | 365 | Days to show |

---

#### true-recall-comparison
Compare stats between time periods.

````markdown
```true-recall-comparison
period1: last7days
period2: previous7days
```
````

Options:
| Option | Description |
|--------|-------------|
| period1 | First period |
| period2 | Second period |

---

#### true-recall-workload
Review workload distribution.

````markdown
```true-recall-workload
days: 30
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| days | 30 | Days to analyze |

---

#### true-recall-streak
Review streak information.

````markdown
```true-recall-streak
```
````

Shows:
- Current streak
- Longest streak
- Streak calendar

---

#### true-recall-leaderboard
Top performing notes.

````markdown
```true-recall-leaderboard
limit: 10
sortBy: retention
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| limit | 10 | Notes to show |
| sortBy | retention | Sort criteria |

---

### FSRS Widgets

#### true-recall-retention
True retention rate over time.

````markdown
```true-recall-retention
range: 30d
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| range | 30d | Time range |

---

#### true-recall-forecast
Future due cards prediction.

````markdown
```true-recall-forecast
days: 30
project: optional-project
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| days | 30 | Days to forecast |
| project | all | Filter by project |

---

#### true-recall-preset
Display preset configuration.

````markdown
```true-recall-preset
preset: default
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| preset | default | Preset to display |

---

#### true-recall-problems
Leeches and difficult cards.

````markdown
```true-recall-problems
minLapses: 3
project: optional
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| minLapses | 3 | Minimum lapses |
| project | all | Filter by project |

---

### Project Widgets

#### true-recall-dashboard
Embedded project dashboard.

````markdown
```true-recall-dashboard
project: Medicine
showStats: true
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| project | all | Project to show |
| showStats | true | Show statistics |

---

#### true-recall-project
Single project overview.

````markdown
```true-recall-project
project: Biology
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| project | required | Project name |

---

#### true-recall-projects
All projects overview.

````markdown
```true-recall-projects
```
````

Shows hierarchical project tree with stats.

---

#### true-recall-unassigned
Notes without project assignment.

````markdown
```true-recall-unassigned
```
````

---

### Note Widgets

#### true-recall-decay
Memory decay visualization.

````markdown
```true-recall-decay
note: [[Note Name]]
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| note | current | Target note |

---

#### true-recall-note-health
Per-note health metrics.

````markdown
```true-recall-note-health
note: [[Biology Notes]]
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| note | current | Target note |

---

### Gamification Widgets

#### true-recall-progress
Today's study progress.

````markdown
```true-recall-progress
```
````

Shows:
- Reviews completed
- Goal progress
- Time studied

---

#### true-recall-answer-streak
Current answer streak.

````markdown
```true-recall-answer-streak
```
````

Shows consecutive correct answers.

---

#### true-recall-ratings
Rating distribution chart.

````markdown
```true-recall-ratings
range: 7d
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| range | 7d | Time range |

---

#### true-recall-maturity
Card maturity progress.

````markdown
```true-recall-maturity
```
````

Shows young → mature progression.

---

#### true-recall-countdown
Countdown to goal date.

````markdown
```true-recall-countdown
goal: 2024-06-01
label: Exam Day
```
````

Options:
| Option | Default | Description |
|--------|---------|-------------|
| goal | required | Target date |
| label | Countdown | Display label |

---

#### true-recall-achievements
Achievement badges earned.

````markdown
```true-recall-achievements
```
````

---

## Creating Custom Dashboards

### Study Dashboard

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
````

### Project Dashboard

````markdown
# {{project}} Overview

```true-recall-dashboard
project: {{project}}
```

## Weak Areas
```true-recall-problems
project: {{project}}
minLapses: 2
```

## Retention
```true-recall-retention
range: 30d
```
````

### Exam Prep Dashboard

````markdown
# Exam Prep

```true-recall-countdown
goal: 2024-06-15
label: Final Exam
```

## Progress
```true-recall-progress
```

## Problem Cards
```true-recall-problems
minLapses: 2
```

## Retention Trend
```true-recall-retention
range: 14d
```
````

## Widget Options Reference

### Common Options

| Option | Type | Description |
|--------|------|-------------|
| project | string | Filter by project |
| note | string | Filter by note |
| preset | string | Filter by preset |
| days | number | Time range in days |
| range | string | Time range (7d, 30d, 90d, 1y) |
| limit | number | Maximum items |

### Time Range Values

| Value | Description |
|-------|-------------|
| 7d | Last 7 days |
| 14d | Last 14 days |
| 30d | Last 30 days |
| 90d | Last 90 days |
| 1y | Last year |
| all | All time |

## Tips

### 1. Combine Widgets

Stack multiple widgets for comprehensive views.

### 2. Use Project Filtering

Target widgets to specific projects for focused dashboards.

### 3. Create Templates

Use Templater to create note templates with widgets.

### 4. Mobile Considerations

Some widgets adapt for mobile; test on all devices.

### 5. Performance

Too many widgets can slow note loading. Limit to 5-10 per note.

## Related Topics

- [Dashboard](../views/dashboard.md) — Main dashboard
- [Statistics](../views/statistics.md) — Detailed statistics
- [Projects](../concepts/projects.md) — Project organization
