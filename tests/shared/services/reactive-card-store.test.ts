import { describe, it, expect, beforeEach } from "vitest";
import { State } from "ts-fsrs";
import {
	cards,
	allCardsArray,
	globalCounts,
	cardsBySourceUid,
	noteStatusMap,
	refreshCards,
	initCardStore,
	type GlobalCounts,
	type NoteStatusInfo,
} from "../../../src/shared/services/reactive-card-store";
import type { FSRSFlashcardItem } from "../../../src/shared/types";

function mockCard(
	id: string,
	overrides: {
		state?: number;
		suspended?: boolean;
		buriedUntil?: string;
		sourceUid?: string;
		due?: string;
	} = {},
): FSRSFlashcardItem {
	return {
		id,
		question: `Q ${id}`,
		answer: `A ${id}`,
		sourceUid: overrides.sourceUid ?? "note-1",
		fsrs: {
			id,
			state: overrides.state ?? State.New,
			due: overrides.due ?? new Date().toISOString(),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			suspended: overrides.suspended ?? false,
			buriedUntil: overrides.buriedUntil,
		},
	} as FSRSFlashcardItem;
}

function setCards(...items: FSRSFlashcardItem[]): void {
	initCardStore({ getAll: () => items });
	refreshCards();
}

beforeEach(() => {
	initCardStore({ getAll: () => [] });
	refreshCards();
});

describe("cards signal", () => {
	it("starts empty", () => {
		expect(cards.value.size).toBe(0);
	});

	it("can be populated with cards", () => {
		setCards(mockCard("1"), mockCard("2"));
		expect(cards.value.size).toBe(2);
	});
});

describe("allCardsArray", () => {
	it("returns empty array when no cards", () => {
		expect(allCardsArray.value).toEqual([]);
	});

	it("returns all cards as array", () => {
		setCards(mockCard("1"), mockCard("2"), mockCard("3"));
		expect(allCardsArray.value).toHaveLength(3);
	});

	it("updates when cards signal changes", () => {
		setCards(mockCard("1"));
		expect(allCardsArray.value).toHaveLength(1);

		setCards(mockCard("1"), mockCard("2"));
		expect(allCardsArray.value).toHaveLength(2);
	});
});

describe("globalCounts", () => {
	it("returns zeroes when empty", () => {
		const counts: GlobalCounts = globalCounts.value;
		expect(counts).toEqual({
			newCount: 0,
			learning: 0,
			due: 0,
			total: 0,
			suspended: 0,
		});
	});

	it("counts new cards", () => {
		setCards(mockCard("1", { state: State.New }), mockCard("2", { state: State.New }));
		expect(globalCounts.value.newCount).toBe(2);
		expect(globalCounts.value.total).toBe(2);
	});

	it("counts learning and relearning cards", () => {
		setCards(
			mockCard("1", { state: State.Learning }),
			mockCard("2", { state: State.Relearning }),
		);
		expect(globalCounts.value.learning).toBe(2);
	});

	it("counts due review cards", () => {
		const pastDue = new Date(Date.now() - 86400000).toISOString();
		setCards(
			mockCard("1", { state: State.Review, due: pastDue }),
			mockCard("2", { state: State.Review, due: pastDue }),
		);
		expect(globalCounts.value.due).toBe(2);
	});

	it("does not count future review cards as due", () => {
		const future = new Date(Date.now() + 86400000).toISOString();
		setCards(mockCard("1", { state: State.Review, due: future }));
		expect(globalCounts.value.due).toBe(0);
		expect(globalCounts.value.total).toBe(1);
	});

	it("excludes suspended cards from state counts but includes in total", () => {
		setCards(
			mockCard("1", { state: State.New }),
			mockCard("2", { state: State.New, suspended: true }),
		);
		expect(globalCounts.value.newCount).toBe(1);
		expect(globalCounts.value.suspended).toBe(1);
		expect(globalCounts.value.total).toBe(2);
	});

	it("excludes buried cards from state counts", () => {
		const future = new Date(Date.now() + 86400000).toISOString();
		setCards(mockCard("1", { state: State.New, buriedUntil: future }));
		expect(globalCounts.value.newCount).toBe(0);
		expect(globalCounts.value.total).toBe(1);
	});
});

describe("cardsBySourceUid", () => {
	it("returns empty map when no cards", () => {
		expect(cardsBySourceUid.value.size).toBe(0);
	});

	it("groups cards by sourceUid", () => {
		setCards(
			mockCard("1", { sourceUid: "note-a" }),
			mockCard("2", { sourceUid: "note-a" }),
			mockCard("3", { sourceUid: "note-b" }),
		);
		const map = cardsBySourceUid.value;
		expect(map.get("note-a")).toHaveLength(2);
		expect(map.get("note-b")).toHaveLength(1);
	});

	it("skips cards without sourceUid", () => {
		const card = mockCard("1");
		card.sourceUid = undefined;
		setCards(card);
		expect(cardsBySourceUid.value.size).toBe(0);
	});
});

describe("noteStatusMap", () => {
	it("returns empty map when no cards", () => {
		expect(noteStatusMap.value.size).toBe(0);
	});

	it("computes per-note status info", () => {
		const pastDue = new Date(Date.now() - 86400000).toISOString();
		setCards(
			mockCard("1", { sourceUid: "note-a", state: State.New }),
			mockCard("2", { sourceUid: "note-a", state: State.Review, due: pastDue }),
			mockCard("3", { sourceUid: "note-a", state: State.Learning }),
		);
		const info: NoteStatusInfo = noteStatusMap.value.get("note-a")!;
		expect(info).toEqual({ new: 1, learning: 1, dueToday: 1, total: 3 });
	});

	it("separates status by sourceUid", () => {
		setCards(
			mockCard("1", { sourceUid: "note-a", state: State.New }),
			mockCard("2", { sourceUid: "note-b", state: State.Learning }),
		);
		expect(noteStatusMap.value.get("note-a")!.new).toBe(1);
		expect(noteStatusMap.value.get("note-b")!.learning).toBe(1);
	});

	it("counts suspended cards in total but not in state counts", () => {
		setCards(
			mockCard("1", { sourceUid: "note-a", state: State.New }),
			mockCard("2", { sourceUid: "note-a", state: State.New, suspended: true }),
		);
		const info = noteStatusMap.value.get("note-a")!;
		expect(info.total).toBe(2);
		expect(info.new).toBe(1);
	});
});

describe("refreshCards", () => {
	it("populates cards from query service", () => {
		const mockQueryService = {
			getAll: () => [mockCard("1"), mockCard("2")],
		};
		refreshCards(mockQueryService);
		expect(cards.value.size).toBe(2);
	});

	it("uses stored query service when none provided", () => {
		const mockQueryService = {
			getAll: () => [mockCard("1")],
		};
		initCardStore(mockQueryService);
		refreshCards();
		expect(cards.value.size).toBe(1);
	});

	it("replaces existing cards completely", () => {
		setCards(mockCard("1"), mockCard("2"), mockCard("3"));
		const mockQueryService = {
			getAll: () => [mockCard("a")],
		};
		refreshCards(mockQueryService);
		expect(cards.value.size).toBe(1);
		expect(cards.value.has("a")).toBe(true);
	});
});
