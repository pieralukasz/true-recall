# Editor Stats & Quick Review

True Recall embeds learning metrics directly into your editing workflow. Instead of switching to a separate dashboard, you see card status, review forecasts, and per-note stats right where you write.

This document covers four features that work together:

| Feature | Where | What it does |
|---|---|---|
| **Status Bar** | Bottom of every tab | Global due/new/learning counts at a glance |
| **Dashboard Codeblocks** | Any note (opt-in) | Embeddable stats widget with 7-day forecast |
| **Donut Tooltip** | Hover on `[[link]]` donuts | Per-note retention, difficulty, review history |
| **Quick Review** | Flashcard Panel sidebar | Review cards without leaving the editor |

---

## 1. Status Bar Widget

The status bar shows a compact summary of your global card status at the bottom of every Obsidian tab.

```
                              42 due · 5 new · 3 lrn · 23 done · 85%
```

### What each value means

| Value | Description |
|---|---|
| **N due** | Review-state cards whose due date has passed (blue) |
| **N new** | Cards that have never been reviewed (green) |
| **N lrn** | Cards in learning or relearning steps (orange) |
| **N done** | Cards reviewed today |
| **N%** | Today's accuracy (Good + Easy / total reviews) |

Values that are zero are hidden automatically.

### Interaction

**Click** the status bar text to open the Custom Study modal — same as clicking the brain icon in the ribbon.

### Disabling

Settings > True Recall > Editor integration > **Show status bar widget** (toggle off).

---

## 2. Dashboard Codeblocks

Embed live stats directly in any markdown note using fenced code blocks.

### Global Dashboard

Add this to any note:

````markdown
```true-recall-dashboard
```
````

This renders a live widget showing:

```
┌─────────────────────────────────────────────┐
│ Today: 23 studied · 12m · 85% · 5d streak  │
├─────────────────────────────────────────────┤
│ This week:                                  │
│ Mon  ████████████ 42                        │
│ Tue  █████████ 31                           │
│ Wed  ██████████████ 52                      │
│ Thu  ████████ 28                            │
│ Fri  ██████ 19                              │
│ Sat  ███ 8                                  │
│ Sun  ████ 12                                │
├─────────────────────────────────────────────┤
│ 892 total · 156 due · 43 new · 12 learning │
└─────────────────────────────────────────────┘
```

**Top row** — today's session: cards studied, time, correct rate, current streak.

**Middle** — 7-day workload forecast. Each bar represents how many cards are due on that day. Helps you plan study time for the week.

**Bottom row** — global counts across all notes.

The widget updates automatically as you review cards — no need to refresh.

### Per-Note Stats

Add this inside a note that has flashcards:

````markdown
```true-recall-note-stats
```
````

This renders stats scoped to **this specific note's cards only**:

```
┌───────────────────────────────────────┐
│ 24 cards · 8 due · 3 new · 2 lrn     │
├───────────────────────────────────────┤
│ Mon ████ 8   Tue ██ 4   Wed ███ 6    │
│ Thu ██ 3     Fri █ 2    Sat ▏ 0      │
│ Sun █ 1                               │
└───────────────────────────────────────┘
```

**Requirement:** The note must have a `flashcard_uid` in its frontmatter (this is added automatically when you create flashcards for the note). If there's no UID, the widget shows nothing.

### Tips

- Put `true-recall-dashboard` in your daily note template for a morning overview.
- Put `true-recall-note-stats` at the top of study topic notes (e.g., "Spanish Vocabulary") to track per-topic progress.
- Both codeblocks work in both editing (live preview) and reading modes.

---

## 3. Donut Tooltip (Hover Stats)

When the **Show link status indicators** setting is enabled (it is by default), `[[links]]` to notes with flashcards show small donut charts with card counts.

**Hover over any donut chart for 300ms** to see a detailed tooltip:

```
┌──────────────────────────────────┐
│ Retention: 87%    Reviews: 142   │
│ Last: Jan 15      Lapses: 1.3   │
│ Difficulty: 4.2                  │
├──────────────────────────────────┤
│ Next 7d: ▃▅▇▃▂▁▃                │
└──────────────────────────────────┘
```

### Tooltip fields

| Field | Description |
|---|---|
| **Retention** | Percentage of successful recalls (correct reviews / total reviews) |
| **Reviews** | Total number of reviews across all cards in that note |
| **Last** | Date of the most recent review |
| **Lapses** | Average number of times cards were forgotten (rated "Again") |
| **Difficulty** | Average FSRS difficulty rating (1 = easy, 10 = hard) |
| **Next 7d** | Sparkline showing how many cards from this note are due each day for the next 7 days |

The sparkline uses block characters (▁▂▃▄▅▆▇█) — taller blocks mean more cards due on that day.

### When does the tooltip appear?

- Only on `[[wiki-links]]` that point to notes containing flashcards
- Only when **Show link status indicators** is enabled in settings
- After a 300ms hover delay (to avoid flickering)
- The tooltip disappears when you move the mouse away

---

## 4. Quick Review Widget

The Quick Review widget appears at the top of the **Flashcard Panel** (sidebar). It lets you review a few cards without opening a full review session.

### Collapsed state

When collapsed, it shows a single-line summary:

```
┌─ Quick Review ─────────────── 8 due  3 new  2 lrn  ▼ ─┐
└────────────────────────────────────────────────────────┘
```

Click to expand.

### Expanded state — question

```
┌─ Quick Review ─────────────── 8 due  3 new  2 lrn  ▲ ─┐
│                                                         │
│  Q: What is the capital of France?                      │
│                                                         │
│              [ Show Answer ]                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Expanded state — answer revealed

```
┌─ Quick Review ─────────────── 8 due  3 new  2 lrn  ▲ ─┐
│                                                         │
│  Q: What is the capital of France?                      │
│  ─────────────────────────────────────────────────────  │
│  A: Paris                                               │
│                                                         │
│      [Again]  [Hard]  [Good]  [Easy]                    │
│       <1m      6m      10m     4d                       │
│                                                         │
│                 7 remaining                              │
└─────────────────────────────────────────────────────────┘
```

### How it works

1. **Open the Flashcard Panel** (sidebar) on a note that has flashcards.
2. The Quick Review widget appears at the top, showing how many cards are due.
3. **Click the header** to expand/collapse (state is remembered across sessions).
4. Click **Show Answer** to reveal the answer.
5. Rate the card using one of four buttons:
   - **Again** — you forgot; card rescheduled to a very short interval
   - **Hard** — recalled with difficulty; shorter interval
   - **Good** — normal recall; standard interval progression
   - **Easy** — effortless recall; longer interval
6. The interval preview (e.g., "10m", "4d") shows when the card will be due next.
7. After rating, the next card appears automatically.
8. When all cards are reviewed: **"All caught up!"**

### Card priority

Cards are shown in this order:
1. **Learning/Relearning** cards that are due right now (short-interval cards you're actively learning)
2. **Review** cards that are past their due date
3. **New** cards that have never been seen

### What it does NOT do

- It does **not** create a formal review session (no session stats, no session summary screen).
- It does **not** have keyboard shortcuts (the panel doesn't capture keyboard focus).
- It **hides automatically** when a formal review session is active (to avoid conflicts).
- Suspended and buried cards are excluded.

### Disabling

Settings > True Recall > Editor integration > **Show quick review in panel** (toggle off).

---

## Settings Reference

These settings are under **Settings > True Recall > Editor integration**:

| Setting | Default | Description |
|---|---|---|
| **Show link status indicators** | On | Display inline donut charts next to `[[links]]` (existing setting — tooltips are part of this) |
| **Show status bar widget** | On | Display global card counts in the bottom status bar |
| **Show quick review in panel** | On | Show the collapsible quick-review section in the Flashcard Panel |

Dashboard codeblocks have no setting — they're opt-in by adding the code block to a note. Remove the code block to remove the widget.

---

## Suggested Workflow

### Morning check

1. Open your daily note.
2. Glance at the status bar: **"42 due · 5 new"**.
3. If you have a `true-recall-dashboard` codeblock in the daily note, see the weekly forecast.
4. Click the status bar to start a full review session, or use Quick Review in the sidebar for a quick 5-minute session.

### While writing

1. As you edit a note with `[[links]]` to flashcard notes, the donut charts show which linked notes need review.
2. Hover a donut to see retention and difficulty — decide if that topic needs more attention.
3. Click a donut to start a focused review of that specific note's cards.

### Per-topic tracking

1. Add `true-recall-note-stats` to the top of each study topic note.
2. See at a glance how many cards are due, how many are new, and what the week looks like for that topic.
