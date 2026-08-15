import { describe, expect, it } from "vitest";

import { formatReviewSummary } from "@true-recall/plugins/link-status-indicators/components/NoteStatsTooltip";

describe("formatReviewSummary", () => {
	it.each([
		["whole-number lapses", 5, 0, "Review #5 • 0 lapses"],
		["fractional average", 12, 2.46, "Review #12 • 2.5 lapses"],
		["singular lapse", 1, 1, "Review #1 • 1 lapse"],
	])("formats %s", (_description, reviewCount, avgLapses, expected) => {
		expect(formatReviewSummary(reviewCount, avgLapses)).toBe(expected);
	});
});
