import { describe, expect, it } from "vitest";

import type { TemporaryCustomStudyDeck } from "@true-recall/core/types/review-session.types";

import { resolveNextSessionScope } from "../../../src/views/review/next-session-scope";

function createMockDeck(
	overrides: Partial<TemporaryCustomStudyDeck> = {},
): TemporaryCustomStudyDeck {
	return {
		id: "deck-1",
		name: "Extra review cards",
		customStudy: { kind: "increase-review", amount: 10 },
		cardIds: [],
		createdAt: 0,
		rebuiltAt: 0,
		...overrides,
	};
}

const noNames = () => undefined;

describe("resolveNextSessionScope", () => {
	it("returns undefined for an unscoped session so the modal opens unscoped", () => {
		expect(resolveNextSessionScope({}, [], noNames)).toBeUndefined();
	});

	describe("direct filters", () => {
		it.each([
			[
				"project path",
				{ projectPath: "Projects/Biology.md" },
				{ projectPath: "Projects/Biology.md", scopeLabel: "Biology" },
			],
			[
				"one note",
				{ sourceNoteFilters: ["ATP"] },
				{ sourceNoteFilters: ["ATP"], scopeLabel: "ATP" },
			],
			[
				"several notes",
				{ sourceNoteFilters: ["ATP", "Krebs"] },
				{ sourceNoteFilters: ["ATP", "Krebs"], scopeLabel: "2 notes" },
			],
			[
				"legacy single note filter",
				{ sourceNoteFilter: "ATP" },
				{ sourceNoteFilters: ["ATP"], scopeLabel: "ATP" },
			],
		])("keeps the %s scope", (_label, filters, expected) => {
			expect(resolveNextSessionScope(filters, [], noNames)).toEqual(expected);
		});

		it("resolves a source uid to its note name", () => {
			const scope = resolveNextSessionScope(
				{ sourceUidFilter: "uid-1" },
				[],
				(uid) => (uid === "uid-1" ? "ATP" : undefined),
			);
			expect(scope).toEqual({ sourceNoteFilters: ["ATP"], scopeLabel: "ATP" });
		});

		it("falls back to unscoped when the source uid has no known note", () => {
			expect(
				resolveNextSessionScope({ sourceUidFilter: "gone" }, [], noNames),
			).toBeUndefined();
		});
	});

	describe("temporary Custom Study Session", () => {
		it("reuses the deck's project scope and label", () => {
			const deck = createMockDeck({
				projectPath: "Projects/Biology.md",
				scopeLabel: "Biology course",
			});
			expect(
				resolveNextSessionScope({ temporaryDeckId: "deck-1" }, [deck], noNames),
			).toEqual({
				projectPath: "Projects/Biology.md",
				scopeLabel: "Biology course",
			});
		});

		it("reuses the deck's note scope and label", () => {
			const deck = createMockDeck({
				sourceNoteFilters: ["ATP", "Krebs"],
				scopeLabel: "2 notes",
			});
			expect(
				resolveNextSessionScope({ temporaryDeckId: "deck-1" }, [deck], noNames),
			).toEqual({ sourceNoteFilters: ["ATP", "Krebs"], scopeLabel: "2 notes" });
		});

		it("opens unscoped when the deck itself was unscoped", () => {
			expect(
				resolveNextSessionScope(
					{ temporaryDeckId: "deck-1", projectPath: "Ignored.md" },
					[createMockDeck()],
					noNames,
				),
			).toBeUndefined();
		});

		it("falls back to the session filters when the deck was deleted", () => {
			expect(
				resolveNextSessionScope(
					{ temporaryDeckId: "deleted", sourceNoteFilters: ["ATP"] },
					[],
					noNames,
				),
			).toEqual({ sourceNoteFilters: ["ATP"], scopeLabel: "ATP" });
		});
	});
});
