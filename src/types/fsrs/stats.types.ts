/**
 * FSRS Statistics Types
 * Statistics panel and tracking
 */

/**
 * Daily statistics
 */
export interface DailyStats {
    /** New cards reviewed today */
    newReviewed: number;
    /** Reviews completed today */
    reviewsCompleted: number;
    /** Cards due today */
    dueToday: number;
    /** New cards remaining today */
    newRemaining: number;
    /** Date (YYYY-MM-DD) */
    date: string;
}

/**
 * Persistent daily statistics stored in .true-recall/stats.json
 */
export interface PersistentDailyStats {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** IDs of cards reviewed today (for exclusion from queue) */
    reviewedCardIds: string[];
    /** Count of new cards studied today (for daily limit) */
    newCardsStudied: number;
    /** Total reviews completed today */
    reviewsCompleted: number;
    /** Total time spent reviewing in ms */
    totalTimeMs: number;
}

/**
 * Persistent stats file structure
 */
export interface PersistentStatsData {
    /** Schema version for migrations */
    version: number;
    /** Last update timestamp (ISO string) */
    lastUpdated: string;
    /** Daily stats keyed by date (YYYY-MM-DD) */
    daily: Record<string, PersistentDailyStats>;
}

/**
 * Extended daily stats with rating breakdown for statistics panel
 */
export interface ExtendedDailyStats extends PersistentDailyStats {
    /** Again rating count */
    again: number;
    /** Hard rating count */
    hard: number;
    /** Good rating count */
    good: number;
    /** Easy rating count */
    easy: number;
    /** New cards reviewed (state was New) */
    newCards: number;
    /** Learning/relearning cards reviewed */
    learningCards: number;
    /** Review cards studied */
    reviewCards: number;
}

/**
 * Card maturity breakdown for pie chart
 * Young: Review cards with interval < 21 days
 * Mature: Review cards with interval >= 21 days
 */
export interface CardMaturityBreakdown {
    new: number;
    learning: number;
    young: number;
    mature: number;
    suspended: number;
    buried: number;
}

/**
 * Future due prediction entry for bar chart
 */
export interface FutureDueEntry {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Cards due on this date */
    count: number;
    /** Cumulative backlog up to this date */
    cumulative: number;
}

/**
 * Cards created entry for historical bar chart
 */
export interface CardsCreatedEntry {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Cards created on this date */
    count: number;
    /** Cumulative total up to this date */
    cumulative: number;
}

/**
 * Cards created vs reviewed entry for comparison chart
 */
export interface CardsCreatedVsReviewedEntry {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Cards created on this date */
    created: number;
    /** Cards reviewed on this date */
    reviewed: number;
    /** Cards created AND reviewed on the same day */
    createdAndReviewedSameDay: number;
}

/**
 * Time range for statistics charts
 */
export type StatsTimeRange = "backlog" | "1m" | "3m" | "1y" | "all";

/**
 * Retention rate entry for retention chart
 */
export interface RetentionEntry {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Retention rate 0-100% */
    retention: number;
    /** Total reviews that day */
    total: number;
}

/**
 * Today summary for statistics panel
 */
export interface TodaySummary {
    /** Total cards studied */
    studied: number;
    /** Time spent in minutes */
    minutes: number;
    /** New cards studied */
    newCards: number;
    /** Review cards studied */
    reviewCards: number;
    /** Again count */
    again: number;
    /** Correct rate (good+easy / total) */
    correctRate: number;
}

/**
 * Streak information
 */
export interface StreakInfo {
    /** Current streak in days */
    current: number;
    /** Longest streak in days */
    longest: number;
}

/**
 * Information about a note belonging to a project
 */
export interface ProjectNoteInfo {
    /** Source note file path */
    path: string;
    /** Note basename for display */
    name: string;
    /** Number of flashcards from this note in the project */
    cardCount: number;
    /** New cards count (blue in Anki) */
    newCount: number;
    /** Learning/Relearning cards count (orange in Anki) */
    learningCount: number;
    /** Due review cards count (green in Anki) */
    dueCount: number;
}

/**
 * Project information (aggregated from frontmatter at runtime)
 */
export interface ProjectInfo {
    /** Project ID (UUID string for UI consistency) */
    id: string;
    /** Project name (unique) */
    name: string;
    /** Number of source notes in this project */
    noteCount: number;
    /** Number of cards in this project */
    cardCount: number;
    /** Review cards due count (green in Anki) */
    dueCount: number;
    /** New cards count (blue in Anki) */
    newCount: number;
    /** Learning/Relearning cards due count (orange in Anki) */
    learningCount: number;
    /** Notes belonging to this project (populated during loadProjects) */
    notes: ProjectNoteInfo[];
}

