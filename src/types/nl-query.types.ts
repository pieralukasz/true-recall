/**
 * Natural Language Query Types
 * Types for AI-powered SQL querying of flashcard statistics
 */

/**
 * Result of a natural language query
 */
export interface NLQueryResult {
    /** Original question asked by the user */
    question: string;
    /** AI-generated answer */
    answer: string;
    /** Intermediate steps showing SQL queries executed */
    intermediateSteps: NLQueryStep[];
    /** Error message if query failed */
    error?: string;
}

/**
 * Intermediate step in query execution
 */
export interface NLQueryStep {
    /** Action taken (e.g., "sql_db_query") */
    action: string;
    /** Input to the action (e.g., SQL query) */
    input: string;
    /** Output from the action */
    output: string;
}

/**
 * Problem card analysis
 */
export interface ProblemCard {
    id: string;
    question: string;
    lapses: number;
    stability: number;
    difficulty: number;
    problemType: "high_lapses" | "low_stability" | "relearning";
}

/**
 * Study pattern analysis
 */
export interface StudyPattern {
    /** Best days of week for studying (0=Sunday, 6=Saturday) */
    bestDays: { day: number; successRate: number }[];
    /** Best hours of day for studying (0-23) */
    bestHours: { hour: number; successRate: number }[];
    /** Heatmap data: day x hour with count and success rate */
    heatmap: { day: number; hour: number; count: number; rate: number }[][];
}

/**
 * Time-to-mastery statistics per group (deck or tag)
 */
export interface TimeToMasteryStats {
    /** Group identifier (deck name or tag) */
    group: string;
    /** Average days from first review to mastery (scheduled_days >= 21) */
    avgDays: number;
    /** Number of cards in this group that reached mastery */
    cardCount: number;
}

/**
 * Configuration for NLQueryService
 */
export interface NLQueryConfig {
    /** OpenRouter API key */
    apiKey: string;
    /** AI model to use */
    model: string;
    /** Maximum results to return from SQL queries */
    topK?: number;
}

/**
 * Example query for display in UI
 */
export interface ExampleQuery {
    /** Display text */
    text: string;
    /** Actual query to send */
    query: string;
}
