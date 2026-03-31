/**
 * DayBoundaryService Tests
 * Behavior-first tests for Anki-style day boundary scheduling
 */
import { describe, it, expect, beforeEach } from "vitest";
import { State } from "ts-fsrs";
import { DayBoundaryService } from "../../../src/services/review/day-boundary.service";
import type { FSRSFlashcardItem } from "../../../src/types";
import { createMockFlashcard } from "../../mocks/fsrs.mocks";

/**
 * Create a flashcard with specific state and due date
 */
function createCard(
	state: State,
	dueDate: Date,
	id?: string
): FSRSFlashcardItem {
	return createMockFlashcard({
		id: id ?? `card-${Math.random().toString(36).slice(2, 8)}`,
		fsrs: {
			state,
			due: dueDate.toISOString(),
		},
	});
}

/**
 * Create a date at specific hour on a given date
 */
function createDateAt(year: number, month: number, day: number, hour: number, minute = 0): Date {
	return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe("DayBoundaryService", () => {
	describe("Day Boundary Calculation", () => {
		it("should use dayStartHour=4 as default (Anki-style)", () => {
			const service = new DayBoundaryService();
			expect(service.getDayStartHour()).toBe(4);
		});

		it("should return yesterday's boundary at 3:59 AM with dayStartHour=4", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 3, 59); // June 15, 3:59 AM

			const boundary = service.getTodayBoundary(now);

			// Should be June 14, 4:00 AM (yesterday's boundary)
			expect(boundary.getFullYear()).toBe(2024);
			expect(boundary.getMonth()).toBe(5); // June = 5 (0-indexed)
			expect(boundary.getDate()).toBe(14);
			expect(boundary.getHours()).toBe(4);
			expect(boundary.getMinutes()).toBe(0);
		});

		it("should return today's boundary at 4:00 AM with dayStartHour=4", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 4, 0); // June 15, 4:00 AM

			const boundary = service.getTodayBoundary(now);

			// Should be June 15, 4:00 AM (today's boundary)
			expect(boundary.getDate()).toBe(15);
			expect(boundary.getHours()).toBe(4);
		});

		it("should return today's boundary at 4:01 AM with dayStartHour=4", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 4, 1); // June 15, 4:01 AM

			const boundary = service.getTodayBoundary(now);

			expect(boundary.getDate()).toBe(15);
			expect(boundary.getHours()).toBe(4);
		});

		it("should handle dayStartHour=0 (midnight boundary)", () => {
			const service = new DayBoundaryService(0);
			const now = createDateAt(2024, 6, 15, 23, 30); // June 15, 11:30 PM

			const boundary = service.getTodayBoundary(now);

			// Current hour (23) >= dayStartHour (0), so today's boundary
			expect(boundary.getDate()).toBe(15);
			expect(boundary.getHours()).toBe(0);
		});

		it("should handle dayStartHour=23 (late night boundary)", () => {
			const service = new DayBoundaryService(23);

			// At 10 PM, we're still in "yesterday"
			const now10pm = createDateAt(2024, 6, 15, 22, 0);
			const boundary10pm = service.getTodayBoundary(now10pm);
			expect(boundary10pm.getDate()).toBe(14); // Yesterday

			// At 11 PM, we're in "today"
			const now11pm = createDateAt(2024, 6, 15, 23, 0);
			const boundary11pm = service.getTodayBoundary(now11pm);
			expect(boundary11pm.getDate()).toBe(15); // Today
		});

		it("should calculate tomorrow boundary correctly", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 10, 0); // June 15, 10 AM

			const tomorrow = service.getTomorrowBoundary(now);

			// Should be June 16, 4:00 AM
			expect(tomorrow.getDate()).toBe(16);
			expect(tomorrow.getHours()).toBe(4);
		});

		it("should update dayStartHour setting", () => {
			const service = new DayBoundaryService(4);
			expect(service.getDayStartHour()).toBe(4);

			service.updateDayStartHour(6);
			expect(service.getDayStartHour()).toBe(6);
		});
	});

	describe("Card Due Today - Learning Cards", () => {
		let service: DayBoundaryService;

		beforeEach(() => {
			service = new DayBoundaryService(4);
		});

		it("should use exact timestamp check for Learning cards", () => {
			const now = createDateAt(2024, 6, 15, 10, 0); // 10:00 AM

			// Card due at 9:59 AM (1 minute ago) - should be due
			const duePast = createCard(
				State.Learning,
				createDateAt(2024, 6, 15, 9, 59)
			);
			expect(service.isCardDueToday(duePast, now)).toBe(true);

			// Card due at 10:01 AM (1 minute from now) - should NOT be due
			const dueFuture = createCard(
				State.Learning,
				createDateAt(2024, 6, 15, 10, 1)
			);
			expect(service.isCardDueToday(dueFuture, now)).toBe(false);
		});

		it("should show Learning card if due exactly at current time", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);
			const card = createCard(State.Learning, createDateAt(2024, 6, 15, 10, 0));

			expect(service.isCardDueToday(card, now)).toBe(true);
		});

		it("should NOT show Learning card if due 1 second in future", () => {
			const now = new Date(2024, 5, 15, 10, 0, 0, 0);
			const dueDate = new Date(2024, 5, 15, 10, 0, 1, 0); // 1 second later
			const card = createCard(State.Learning, dueDate);

			expect(service.isCardDueToday(card, now)).toBe(false);
		});

		it("should apply same logic to Relearning cards", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);

			// Relearning card due in past - should be due
			const duePast = createCard(
				State.Relearning,
				createDateAt(2024, 6, 15, 9, 0)
			);
			expect(service.isCardDueToday(duePast, now)).toBe(true);

			// Relearning card due in future - should NOT be due
			const dueFuture = createCard(
				State.Relearning,
				createDateAt(2024, 6, 15, 11, 0)
			);
			expect(service.isCardDueToday(dueFuture, now)).toBe(false);
		});
	});

	describe("Card Due Today - Review Cards", () => {
		let service: DayBoundaryService;

		beforeEach(() => {
			service = new DayBoundaryService(4);
		});

		it("should use day-based check for Review cards", () => {
			const now = createDateAt(2024, 6, 15, 10, 0); // June 15, 10 AM

			// Review card due yesterday - should be due
			const dueYesterday = createCard(
				State.Review,
				createDateAt(2024, 6, 14, 10, 0)
			);
			expect(service.isCardDueToday(dueYesterday, now)).toBe(true);

			// Review card due later today - should be due (day-based, not exact)
			const dueLaterToday = createCard(
				State.Review,
				createDateAt(2024, 6, 15, 23, 0)
			);
			expect(service.isCardDueToday(dueLaterToday, now)).toBe(true);
		});

		it("should show Review card due at any time yesterday", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);
			const card = createCard(
				State.Review,
				createDateAt(2024, 6, 14, 23, 59) // Yesterday 11:59 PM
			);

			expect(service.isCardDueToday(card, now)).toBe(true);
		});

		it("should show Review card due earlier today", () => {
			const now = createDateAt(2024, 6, 15, 14, 0); // 2 PM
			const card = createCard(
				State.Review,
				createDateAt(2024, 6, 15, 8, 0) // 8 AM today
			);

			expect(service.isCardDueToday(card, now)).toBe(true);
		});

		it("should show Review card due before tomorrow's boundary", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);

			// Card due at 3:59 AM tomorrow (before 4 AM boundary)
			const card = createCard(
				State.Review,
				createDateAt(2024, 6, 16, 3, 59)
			);

			// Tomorrow boundary is June 16, 4:00 AM
			// Card due at 3:59 AM is before boundary, so it's "today"
			expect(service.isCardDueToday(card, now)).toBe(true);
		});

		it("should NOT show Review card due after tomorrow's boundary", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);

			// Card due at 4:00 AM tomorrow (at boundary = tomorrow)
			const cardAtBoundary = createCard(
				State.Review,
				createDateAt(2024, 6, 16, 4, 0)
			);
			expect(service.isCardDueToday(cardAtBoundary, now)).toBe(false);

			// Card due at 10 AM tomorrow
			const cardTomorrow = createCard(
				State.Review,
				createDateAt(2024, 6, 16, 10, 0)
			);
			expect(service.isCardDueToday(cardTomorrow, now)).toBe(false);
		});
	});

	describe("New Cards", () => {
		let service: DayBoundaryService;

		beforeEach(() => {
			service = new DayBoundaryService(4);
		});

		it("should return false for New cards (not 'due')", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);
			const card = createCard(State.New, createDateAt(2024, 6, 15, 10, 0));

			// New cards are never "due" - they're "available"
			expect(service.isCardDueToday(card, now)).toBe(false);
		});

		it("should consider New cards as 'available'", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);
			const card = createCard(State.New, createDateAt(2024, 6, 15, 10, 0));

			expect(service.isCardAvailable(card, now)).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should handle card due at exact boundary moment", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 10, 0);

			// Review card due exactly at tomorrow's boundary (4 AM)
			const card = createCard(
				State.Review,
				createDateAt(2024, 6, 16, 4, 0, 0) // Exact boundary
			);

			// At boundary = tomorrow, not today
			expect(service.isCardDueToday(card, now)).toBe(false);
		});

		it("should handle dayStartHour across month boundary", () => {
			const service = new DayBoundaryService(4);

			// July 1, 3:00 AM - should still be "June 30"
			const now = createDateAt(2024, 7, 1, 3, 0);
			const boundary = service.getTodayBoundary(now);

			expect(boundary.getMonth()).toBe(5); // June
			expect(boundary.getDate()).toBe(30);
		});

		it("should handle dayStartHour across year boundary", () => {
			const service = new DayBoundaryService(4);

			// January 1, 3:00 AM - should still be "December 31"
			const now = createDateAt(2025, 1, 1, 3, 0);
			const boundary = service.getTodayBoundary(now);

			expect(boundary.getFullYear()).toBe(2024);
			expect(boundary.getMonth()).toBe(11); // December
			expect(boundary.getDate()).toBe(31);
		});

		it("should handle leap year February 29 boundary", () => {
			const service = new DayBoundaryService(4);

			// March 1, 2024 at 3:00 AM - should be "February 29" (leap year)
			const now = createDateAt(2024, 3, 1, 3, 0);
			const boundary = service.getTodayBoundary(now);

			expect(boundary.getMonth()).toBe(1); // February
			expect(boundary.getDate()).toBe(29); // Leap day
		});
	});

	describe("Today Key (Date String)", () => {
		it("should return yesterday's date key at 3:59 AM with dayStartHour=4", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 3, 59);

			const key = service.getTodayKey(now);

			expect(key).toBe("2024-06-14"); // Yesterday
		});

		it("should return today's date key at 4:00 AM with dayStartHour=4", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 4, 0);

			const key = service.getTodayKey(now);

			expect(key).toBe("2024-06-15"); // Today
		});
	});

	describe("Timestamp Today Check", () => {
		it("should identify timestamp as today if within boundaries", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 10, 0); // June 15, 10 AM

			// Timestamp at 8 AM today
			const timestamp = createDateAt(2024, 6, 15, 8, 0).getTime();

			expect(service.isTimestampToday(timestamp, now)).toBe(true);
		});

		it("should NOT identify yesterday's timestamp as today", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 10, 0);

			// Timestamp at 10 AM yesterday
			const timestamp = createDateAt(2024, 6, 14, 10, 0).getTime();

			expect(service.isTimestampToday(timestamp, now)).toBe(false);
		});

		it("should handle timestamp at exact boundary", () => {
			const service = new DayBoundaryService(4);
			const now = createDateAt(2024, 6, 15, 10, 0);

			// Timestamp at 4 AM today (exact boundary start)
			const timestampStart = createDateAt(2024, 6, 15, 4, 0).getTime();
			expect(service.isTimestampToday(timestampStart, now)).toBe(true);

			// Timestamp at 4 AM tomorrow (exact boundary end)
			const timestampEnd = createDateAt(2024, 6, 16, 4, 0).getTime();
			expect(service.isTimestampToday(timestampEnd, now)).toBe(false);
		});
	});

	describe("Counting and Filtering", () => {
		let service: DayBoundaryService;

		beforeEach(() => {
			service = new DayBoundaryService(4);
		});

		it("should count only due cards (not new)", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);
			const cards = [
				createCard(State.New, now),
				createCard(State.Review, createDateAt(2024, 6, 14, 10, 0)), // Due
				createCard(State.Learning, createDateAt(2024, 6, 15, 9, 0)), // Due
				createCard(State.Review, createDateAt(2024, 6, 17, 10, 0)), // Not due
			];

			expect(service.countDueCards(cards, now)).toBe(2);
		});

		it("should filter to get only due cards", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);
			const cards = [
				createCard(State.New, now, "new-1"),
				createCard(State.Review, createDateAt(2024, 6, 14, 10, 0), "review-due"),
				createCard(State.Review, createDateAt(2024, 6, 17, 10, 0), "review-future"),
			];

			const dueCards = service.getDueCards(cards, now);

			expect(dueCards).toHaveLength(1);
			expect(dueCards[0]?.id).toBe("review-due");
		});

		it("should get available cards (new + due)", () => {
			const now = createDateAt(2024, 6, 15, 10, 0);
			const cards = [
				createCard(State.New, now, "new-1"),
				createCard(State.Review, createDateAt(2024, 6, 14, 10, 0), "review-due"),
				createCard(State.Review, createDateAt(2024, 6, 17, 10, 0), "review-future"),
			];

			const available = service.getAvailableCards(cards, now);

			expect(available).toHaveLength(2);
			expect(available.map(c => c.id)).toContain("new-1");
			expect(available.map(c => c.id)).toContain("review-due");
		});
	});
});
