/**
 * Maturity Calculator
 * Calculates card maturity breakdown statistics
 */
import type { SqliteStoreService } from "../../../persistence/sqlite/SqliteStoreService";
import type { CardMaturityBreakdown, CardSchedulingMeta } from "../../../types";
/**
 * Calculator for card maturity statistics
 */
export declare class MaturityCalculator {
    private sqliteStore;
    constructor(sqliteStore?: SqliteStoreService | null);
    /**
     * Set SQLite store for optimized queries
     */
    setSqliteStore(store: SqliteStoreService): void;
    /**
     * Get card maturity breakdown for pie chart
     * Young: Review cards with interval < 21 days
     * Mature: Review cards with interval >= 21 days
     */
    calculate(allCards: CardSchedulingMeta[]): CardMaturityBreakdown;
    /**
     * Calculate breakdown from card array
     */
    calculateFromCards(allCards: CardSchedulingMeta[]): CardMaturityBreakdown;
    /**
     * Get cards by maturity category
     */
    getCardsByCategory(allCards: CardSchedulingMeta[], category: keyof CardMaturityBreakdown): CardSchedulingMeta[];
}
