/**
 * FSRS Context for AI Agents
 * Comprehensive FSRS (Free Spaced Repetition Scheduler) documentation
 * for natural language query systems and AI assistants
 *
 * This module provides detailed context about FSRS terminology, card states,
 * scheduling logic, and common query patterns to help AI systems generate
 * accurate SQL queries and explanations.
 */

/**
 * Full FSRS context for AI system prompts
 * Comprehensive documentation (~600 words)
 */
export const FSRS_CONTEXT_FOR_AI = `
## FSRS Spaced Repetition System

FSRS (Free Spaced Repetition Scheduler) is an algorithm that predicts when you'll forget a card
and schedules reviews accordingly. It uses 21 parameters to model memory and learning patterns.

### Card States (Critical)

Cards progress through states based on learning progress:

- **State 0 (New)**: Never reviewed. IMPORTANT: New cards are NEVER "due" - they are "available"
  for first-time study but tracked separately with daily limits (default 20/day).
  SQL: \`state = 0\` means the card has never been seen.

- **State 1 (Learning)**: Currently learning with short intervals (e.g., 1min, 10min).
  Uses exact timestamp-based scheduling. Due when \`due <= current_time\`.
  SQL: \`state = 1\` for cards in initial learning steps.

- **State 2 (Review)**: Graduated cards with longer intervals (days/weeks/months).
  Uses day-based scheduling with 4 AM boundary (configurable). Due when \`due < tomorrow_4am\`.
  SQL: \`state = 2\` for cards that have passed learning and are in review phase.

- **State 3 (Relearning)**: Failed review cards being re-learned with short intervals.
  Same scheduling as Learning state. Due when \`due <= current_time\`.
  SQL: \`state = 3\` for cards that lapsed and need relearning.

### Maturity Levels (Review Cards Only)

Review cards (state 2) are classified by interval length:

- **Young Cards**: \`state = 2 AND scheduled_days < 21\`
  Cards with intervals less than 21 days (not yet mastered)

- **Mature Cards**: \`state = 2 AND scheduled_days >= 21\`
  Cards with intervals 21+ days (considered mastered)

### Day Boundaries (Critical for "Due" Queries)

The system uses Anki-style day boundaries (default 4 AM):
- Before 4 AM, you're still in "yesterday"
- At 4:00 AM, the day rolls over and new reviews become available
- Review cards (state 2) use day-based scheduling: due if \`due < tomorrow_4am\`
- Learning cards (states 1, 3) use exact timestamps: due if \`due <= now\`

### FSRS Parameters

- **stability**: Predicted days until 90% retention. Low stability (<2 days) = problematic.
- **difficulty**: Card difficulty (0-10 scale). Higher = harder to remember.
- **lapses**: Times the card was failed (rating 1). High lapses (>3) = problem card.
- **reps**: Total number of reviews (all ratings).
- **scheduled_days**: Current interval in days. For Review cards, this determines maturity.

### Review Ratings

When reviewing, users rate their recall:
- **1 (Again)**: Complete failure, card goes to relearning (state 3)
- **2 (Hard)**: Difficult recall, shorter interval
- **3 (Good)**: Normal recall, standard interval
- **4 (Easy)**: Easy recall, longer interval

### Common Query Patterns

**"Due today" queries** (EXCLUDE state 0):
\`\`\`sql
-- Correct: Excludes new cards
WHERE state != 0 AND date(due) <= date('now')

-- Wrong: Includes new cards
WHERE date(due) <= date('now')
\`\`\`

**"New cards" queries**:
\`\`\`sql
WHERE state = 0 AND suspended = 0
\`\`\`

**"Mature cards" queries**:
\`\`\`sql
WHERE state = 2 AND scheduled_days >= 21 AND suspended = 0
\`\`\`

**"Problem cards" queries**:
\`\`\`sql
WHERE suspended = 0 AND (lapses > 3 OR stability < 2.0 OR state = 3)
\`\`\`

**Active cards filter** (always apply):
\`\`\`sql
WHERE suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now'))
\`\`\`

### Common Misconceptions

1. **"New cards are due"** - WRONG. New cards are "available" but never "due".
   They have separate daily limits (newCardsPerDay) from reviews (reviewsPerDay).

2. **"All cards with due date in the past are due"** - WRONG for new cards.
   Use \`state != 0\` to exclude them from "due" counts.

3. **"Young vs Mature is based on ease"** - WRONG. It's based on interval length
   (scheduled_days), not ease or difficulty. 21-day threshold is the standard.

4. **"Due date is always timestamp-based"** - WRONG. Review cards (state 2) use
   day-based scheduling with 4 AM boundaries. Learning cards use exact timestamps.

### Card Lifecycle

\`\`\`
New (0) → [First review] → Learning (1) → [Graduate] → Review (2) → [Fail] → Relearning (3)
                                                ↓
                                         [Pass] → Review (2)
                                                ↓
                                    [scheduled_days >= 21] → Mature
\`\`\`

### Daily Limits

- **newCardsPerDay** (default 20): Maximum new cards to introduce per day
- **reviewsPerDay** (default 200): Maximum review cards to study per day
- These are separate quotas - new cards don't count against review limit

### SQL Safety

- ONLY use SELECT queries - never INSERT, UPDATE, DELETE
- Always include LIMIT clause (max 100 rows recommended)
- Use date('now') for "today", datetime('now') for exact timestamp
- Test queries with LIMIT 1 first if uncertain
`;

/**
 * Quick reference for abbreviated contexts
 * Essential facts (~150 words)
 */
export const FSRS_QUICK_REFERENCE = `
FSRS Card States:
- 0=New (never "due", always available, separate daily limit)
- 1=Learning (due at exact timestamp)
- 2=Review (due by day with 4 AM boundary)
- 3=Relearning (due at exact timestamp)

Maturity: state=2 AND scheduled_days >= 21 = Mature, <21 = Young

Parameters:
- stability: days until 90% retention
- difficulty: 0-10 scale, higher = harder
- lapses: failure count, >3 = problem card
- scheduled_days: current interval

CRITICAL: "Due today" queries MUST exclude state 0 (new cards).
SQL: WHERE state != 0 AND date(due) <= date('now')

Day boundary: 4 AM (configurable). Review cards due before tomorrow's 4 AM.
Daily limits: 20 new/day, 200 reviews/day (defaults, configurable).
`;

/**
 * Common SQL query examples
 * Demonstrates correct patterns for typical questions
 */
export const FSRS_SQL_EXAMPLES = [
	// Due cards (exclude new)
	`-- How many cards are due today?
SELECT COUNT(*) as due_count
FROM cards
WHERE state != 0  -- EXCLUDE new cards
  AND suspended = 0
  AND (buried_until IS NULL OR buried_until <= datetime('now'))
  AND date(due) <= date('now')`,

	// New cards count
	`-- How many new cards do I have?
SELECT COUNT(*) as new_count
FROM cards
WHERE state = 0
  AND suspended = 0
  AND (buried_until IS NULL OR buried_until <= datetime('now'))`,

	// Mature cards
	`-- Show me my mature cards
SELECT id, question, scheduled_days, stability, difficulty
FROM cards
WHERE state = 2
  AND scheduled_days >= 21
  AND suspended = 0
ORDER BY scheduled_days DESC
LIMIT 20`,

	// Problem cards
	`-- What are my problem cards?
SELECT id, question, lapses, stability, state
FROM cards
WHERE suspended = 0
  AND (lapses > 3 OR stability < 2.0 OR state = 3)
ORDER BY lapses DESC, stability ASC
LIMIT 20`,

	// Learning progress today
	`-- How many cards did I review today?
SELECT COUNT(*) as reviews_today
FROM review_log
WHERE date(reviewed_at, 'localtime') = date('now', 'localtime')`,

	// Card maturity breakdown
	`-- What's my card distribution?
SELECT
  SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new_cards,
  SUM(CASE WHEN state IN (1, 3) THEN 1 ELSE 0 END) as learning,
  SUM(CASE WHEN state = 2 AND scheduled_days < 21 THEN 1 ELSE 0 END) as young,
  SUM(CASE WHEN state = 2 AND scheduled_days >= 21 THEN 1 ELSE 0 END) as mature
FROM cards
WHERE suspended = 0
  AND (buried_until IS NULL OR buried_until <= datetime('now'))`,

	// Average retention rate
	`-- What's my success rate?
SELECT
  ROUND(AVG(CASE WHEN rating >= 3 THEN 100.0 ELSE 0.0 END), 1) as success_rate,
  COUNT(*) as total_reviews
FROM review_log
WHERE reviewed_at >= datetime('now', '-30 days')`,

	// Cards created vs reviewed today
	`-- Today's learning activity
SELECT
  (SELECT COUNT(*) FROM cards
   WHERE date(datetime(created_at/1000, 'unixepoch', 'localtime')) = date('now', 'localtime')) as created_today,
  (SELECT COUNT(*) FROM review_log
   WHERE date(reviewed_at, 'localtime') = date('now', 'localtime')) as reviewed_today`,
];

/**
 * Get FSRS context formatted for a specific use case
 */
export function getFsrsContext(format: "full" | "quick" | "examples"): string {
	switch (format) {
		case "full":
			return FSRS_CONTEXT_FOR_AI;
		case "quick":
			return FSRS_QUICK_REFERENCE;
		case "examples":
			return FSRS_SQL_EXAMPLES.join("\n\n");
		default:
			return FSRS_QUICK_REFERENCE;
	}
}
