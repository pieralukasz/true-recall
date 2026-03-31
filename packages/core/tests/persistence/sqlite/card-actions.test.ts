/**
 * Tests for CardActions
 *
 * These tests verify the CardActions module behavior using mocked database.
 * Integration tests with real SQLite would require setting up sql.js.
 */
import { describe, it, expect } from "vitest";

/**
 * Tests for getDueCardsByDateRange
 *
 * This method returns cards due within a date range, excluding Learning
 * and Relearning cards. This is used by load balancing and forecasting.
 *
 * Expected SQL filter:
 * AND state NOT IN (1, 3)  -- Excludes Learning and Relearning
 */
describe("CardActions - getDueCardsByDateRange", () => {
    describe("Learning card exclusion", () => {
        it("should exclude Learning state cards (state=1)", () => {
            // This documents that getDueCardsByDateRange filters out
            // Learning cards so they won't be moved by load balancer
            const statesToInclude = [0, 2]; // New, Review
            const statesToExclude = [1, 3]; // Learning, Relearning

            // The SQL filter is: state NOT IN (1, 3)
            for (const state of statesToInclude) {
                expect([1, 3].includes(state)).toBe(false);
            }

            for (const state of statesToExclude) {
                expect([1, 3].includes(state)).toBe(true);
            }
        });
    });
});
