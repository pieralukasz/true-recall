import type { FSRSCardData } from "@true-recall/core/types/fsrs/card.types";
import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";
import { computeProjectStats } from "../../../../../src/editor/study/widgets/project-stats";

function makeCard(overrides: Partial<FSRSCardData>): FSRSCardData {
	return {
		id: "card",
		due: "2026-03-01T09:00:00.000Z",
		stability: 8,
		difficulty: 5,
		reps: 10,
		lapses: 0,
		state: State.Review,
		lastReview: "2026-02-28T08:00:00.000Z",
		scheduledDays: 7,
		learningStep: 0,
		...overrides,
	};
}

describe("computeProjectStats", () => {
	it("returns identical stats with legacy fetches and indexed context", () => {
		const now = new Date("2026-03-01T10:00:00.000Z");
		const sourceUids = new Set(["uid-a", "uid-b"]);

		const byUid = new Map<string, FSRSCardData[]>([
			[
				"uid-a",
				[
					makeCard({ id: "due-1", state: State.Review }),
					makeCard({
						id: "new-1",
						state: State.New,
						lastReview: null,
					}),
					makeCard({ id: "learn-1", state: State.Learning }),
					makeCard({ id: "suspended-1", suspended: true }),
				],
			],
			[
				"uid-b",
				[
					makeCard({
						id: "future-review-1",
						state: State.Review,
						due: "2026-03-03T10:00:00.000Z",
					}),
					makeCard({
						id: "relearning-1",
						state: State.Relearning,
						lastReview: "2026-03-01T07:30:00.000Z",
					}),
					makeCard({
						id: "buried-1",
						buriedUntil: "2026-03-01T23:00:00.000Z",
					}),
				],
			],
		]);

		const hierarchyService = {
			getSourceUidsForProject: vi.fn(() => sourceUids),
		};
		const cardStore = {
			getCardsBySourceUid: vi.fn((uid: string) => byUid.get(uid) ?? []),
		};
		const fsrsService = {
			getRetrievability: vi.fn((card: FSRSCardData) =>
				card.state === State.Review ? 0.8 : 0.6,
			),
		};

		const legacy = computeProjectStats(
			"Projects/X",
			"X",
			2,
			hierarchyService as never,
			cardStore as never,
			fsrsService as never,
			{ now },
		);

		const retrievabilityByCardId = new Map<string, number>();
		for (const cards of byUid.values()) {
			for (const card of cards) {
				if (card.state === State.New) continue;
				retrievabilityByCardId.set(
					card.id,
					card.state === State.Review ? 0.8 : 0.6,
				);
			}
		}

		const indexed = computeProjectStats(
			"Projects/X",
			"X",
			2,
			hierarchyService as never,
			cardStore as never,
			fsrsService as never,
			{
				sourceUids,
				cardsBySourceUid: byUid,
				retrievabilityByCardId,
				now,
			},
		);

		expect(indexed).toEqual(legacy);
		expect(indexed.totalCards).toBe(7);
		expect(indexed.due).toBe(1);
		expect(indexed.newCount).toBe(1);
		expect(indexed.learning).toBe(2);
		expect(indexed.healthPct).toBe(70);
		expect(indexed.lastReviewed).toBe("2026-03-01T07:30:00.000Z");
	});

	it("uses cached retrievability map instead of recomputing per card", () => {
		const now = new Date("2026-03-01T10:00:00.000Z");
		const sourceUids = new Set(["uid-c"]);
		const cards = [
			makeCard({ id: "review-1", state: State.Review }),
			makeCard({ id: "learning-1", state: State.Learning }),
		];
		const byUid = new Map<string, FSRSCardData[]>([["uid-c", cards]]);

		const hierarchyService = {
			getSourceUidsForProject: vi.fn(() => sourceUids),
		};
		const cardStore = {
			getCardsBySourceUid: vi.fn(),
		};
		const fsrsService = {
			getRetrievability: vi.fn(() => 0.1),
		};

		const stats = computeProjectStats(
			"Projects/Y",
			"Y",
			0,
			hierarchyService as never,
			cardStore as never,
			fsrsService as never,
			{
				sourceUids,
				cardsBySourceUid: byUid,
				retrievabilityByCardId: new Map([
					["review-1", 0.9],
					["learning-1", 0.7],
				]),
				now,
			},
		);

		expect(stats.healthPct).toBe(80);
		expect(fsrsService.getRetrievability).not.toHaveBeenCalled();
		expect(cardStore.getCardsBySourceUid).not.toHaveBeenCalled();
	});
});
