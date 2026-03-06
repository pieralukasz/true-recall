# CSV Export

Export your flashcards to CSV or TSV format for analysis, backup, or importing into other applications.

## Opening CSV Export

Settings → Data & Backup → Anki Import/Export → Export CSV

Or Command Palette → "Export as CSV/TSV"

## Export Options

| Option | Description |
|--------|-------------|
| Format | CSV (comma) or TSV (tab) |
| Include header | Add column names row |
| Include scheduling | Export FSRS data |
| Filter | Export specific cards |

## Export Columns

### Basic Columns

| Column | Description |
|--------|-------------|
| `id` | Unique card ID |
| `question` | Card front/question |
| `answer` | Card back/answer |
| `source_note` | Path to source note |
| `note_type` | Card type name |
| `state` | New/Learning/Review/Suspended |

### Scheduling Columns (Optional)

| Column | Description |
|--------|-------------|
| `due` | Due date (ISO format) |
| `interval` | Current interval (days) |
| `stability` | FSRS stability |
| `difficulty` | FSRS difficulty |
| `retrievability` | Current recall probability |
| `lapses` | Number of lapses |
| `reviews` | Total review count |

### Additional Columns

| Column | Description |
|--------|-------------|
| `created` | Card creation date |
| `last_review` | Most recent review |
| `preset` | FSRS preset name |
| `project` | Project name |
| `tags` | Card tags |

## Export Process

1. **Configure** — Set format and options
2. **Filter** — Select cards to export (optional)
3. **Export** — Generate file
4. **Save** — Choose location

## Filtering Export

### By State

Export only specific card states:

- New cards only
- Review cards only
- Suspended cards only

### By Project

Export cards from specific project:

```
Filter: project = "Medicine"
```

### By Note Type

Export specific card types:

```
Filter: note_type = "Cloze"
```

### By Date

Export cards created or reviewed in date range:

```
Filter: created >= "2024-01-01"
Filter: last_review >= "2024-01-15"
```

## Use Cases

### Analysis in Excel/Sheets

1. Export with scheduling data
2. Open in spreadsheet
3. Analyze patterns (lapses, intervals, etc.)

### External Backup

1. Export all cards
2. Save to cloud storage
3. Human-readable backup

### Migration

1. Export from True Recall
2. Transform data if needed
3. Import to another system

### Reporting

1. Export filtered subset
2. Create custom reports
3. Share progress with others

## Tips

### 1. Use TSV for Text with Commas

If card content contains commas, use TSV format.

### 2. Include Header Always

Headers make the file self-documenting.

### 3. Export Regularly

Periodic exports provide additional backup.

### 4. Filter for Analysis

Don't export everything when analyzing specific subsets.

## Troubleshooting

### File Too Large

1. Export without scheduling columns
2. Filter to specific cards
3. Split into multiple exports

### Encoding Issues

1. CSV uses UTF-8 encoding
2. If characters appear wrong, specify UTF-8 when opening
3. Use TSV as alternative

### Excel Doesn't Open Properly

1. Import manually: Data → From Text/CSV
2. Specify delimiter (comma or tab)
3. Set encoding to UTF-8

### Missing Columns

1. Check export options
2. Enable "Include scheduling" for FSRS data
3. Some columns require specific data

## Related Topics

- [Anki Import/Export](./anki-import-export.md) — Anki format
- [Statistics](../views/statistics.md) — Built-in analysis
- [Card Browser](../views/card-browser.md) — Browse and filter cards
