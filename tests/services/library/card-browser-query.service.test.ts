import { describe, it, expect, vi } from "vitest";
import { State } from "ts-fsrs";
import { CardBrowserQueryService } from "../../../src/features/library/services/card-browser-query.service";
import type { FSRSCardData } from "../../../src/shared/types";
import { EMPTY_FILTER, type SortConfig } from "../../../src/features/library/ui/browser/types";

function makeCard(
	id: string,
	sourceUid?: string,
	overrides: Partial<FSRSCardData> = {},
): FSRSCardData {
	return {
		id,
		due: new Date(0).toISOString(),
		stability: 1,
		difficulty: 1,
		reps: 0,
		lapses: 0,
		state: State.New,
		lastReview: null,
		scheduledDays: 0,
		learningStep: 0,
		suspended: false,
		question: `Q:${id}`,
		answer: `A:${id}`,
		sourceUid,
		cardType: "basic",
		createdVia: "manual",
		...overrides,
	};
}

function createService({
	allCards = [],
	queryCards = allCards,
	existingUids = new Set<string>(),
	archivedUids = new Set<string>(),
}: {
	allCards?: FSRSCardData[];
	queryCards?: FSRSCardData[];
	existingUids?: Set<string>;
	archivedUids?: Set<string>;
} = {}) {
	const cardsMock = {
		getAll: vi.fn(() => allCards),
		browserQuery: vi.fn(
			(
				_where: string,
				params: (string | number)[],
				_orderBy: string,
				_limit: number,
				_offset: number,
			) => {
				const excludesArchived = params.some(
					(p) => typeof p === "string" && archivedUids.has(p),
				);
				if (!excludesArchived) return queryCards;
				return queryCards.filter(
					(card) => !archivedUids.has(card.sourceUid ?? ""),
				);
			},
		),
		browserCount: vi.fn((_where: string, params: (string | number)[]) => {
			const excludesArchived = params.some(
				(p) => typeof p === "string" && archivedUids.has(p),
			);
			if (!excludesArchived) return queryCards.length;
			return queryCards.filter(
				(card) => !archivedUids.has(card.sourceUid ?? ""),
			).length;
		}),
	};

	const cardStore = {
		cards: cardsMock,
		notes: {
			isFts5Available: vi.fn(() => false),
		},
	};

	const frontmatterIndex = {
		getFileByValue: vi.fn((field: string, uid: string) => {
			if (field !== "flashcard_uid") return null;
			if (!existingUids.has(uid)) return null;
			return {
				path: `Notes/${uid}.md`,
				basename: uid === "uid-archived" ? "Archived" : uid,
			} as unknown;
		}),
		getAllValues: vi.fn(() => new Set(existingUids)),
		getValues: vi.fn(() => []),
	};

	const hierarchyService = {
		getArchivedSourceUids: vi.fn(() => new Set(archivedUids)),
	};

	const service = new CardBrowserQueryService(
		cardStore as unknown as ConstructorParameters<
			typeof CardBrowserQueryService
		>[0],
		frontmatterIndex as unknown as ConstructorParameters<
			typeof CardBrowserQueryService
		>[1],
		hierarchyService as unknown as ConstructorParameters<
			typeof CardBrowserQueryService
		>[2],
	);

	return {
		service,
		cardsMock,
		frontmatterIndex,
		hierarchyService,
	};
}

describe("CardBrowserQueryService.getOrphanedCardIds", () => {
	it("returns IDs for cards with unresolved source UIDs", () => {
		const cards = [
			makeCard("orphan-1", "uid-orphan-1"),
			makeCard("ok-1", "uid-ok-1"),
			makeCard("orphan-2", "uid-orphan-2"),
		];
		const { service } = createService({
			allCards: cards,
			existingUids: new Set(["uid-ok-1"]),
		});

		const orphanedIds = service.getOrphanedCardIds();

		expect(orphanedIds).toEqual(["orphan-1", "orphan-2"]);
	});

	it("excludes cards whose source UIDs resolve to existing notes", () => {
		const cards = [makeCard("ok-1", "uid-a"), makeCard("ok-2", "uid-b")];
		const { service } = createService({
			allCards: cards,
			existingUids: new Set(["uid-a", "uid-b"]),
		});

		const orphanedIds = service.getOrphanedCardIds();

		expect(orphanedIds).toEqual([]);
	});

	it("includes cards with null/empty sourceUid as orphaned", () => {
		const cards = [
			makeCard("no-source-1"),
			makeCard("no-source-2", ""),
			makeCard("orphan-1", "uid-orphan"),
		];
		const { service, frontmatterIndex } = createService({
			allCards: cards,
		});

		const orphanedIds = service.getOrphanedCardIds();

		expect(orphanedIds).toEqual(["no-source-1", "no-source-2", "orphan-1"]);
		expect(frontmatterIndex.getFileByValue).toHaveBeenCalledTimes(1);
		expect(frontmatterIndex.getFileByValue).toHaveBeenCalledWith(
			"flashcard_uid",
			"uid-orphan",
		);
	});
});

describe("CardBrowserQueryService.query archived filtering", () => {
	const sort: SortConfig = { column: "due", direction: "asc" };

	it("removes archived cards from both results and totalCount when showArchived=false", () => {
		const queryCards = [
			makeCard("live-1", "uid-live"),
			makeCard("archived-1", "uid-archived"),
			makeCard("orphan", undefined),
		];
		const { service, cardsMock } = createService({
			queryCards,
			existingUids: new Set(["uid-live", "uid-archived"]),
			archivedUids: new Set(["uid-archived"]),
		});

		const result = service.query(
			{ ...EMPTY_FILTER, showArchived: false },
			sort,
			200,
			0,
		);

		expect(result.cards.map((c) => c.id)).toEqual(["live-1", "orphan"]);
		expect(result.totalCount).toBe(2);

		const where = cardsMock.browserQuery.mock.calls[0]?.[0] as string;
		expect(where).toContain("c.source_uid IS NULL OR c.source_uid NOT IN");
	});

	it("keeps archived cards in results and totalCount when showArchived=true", () => {
		const queryCards = [
			makeCard("live-1", "uid-live"),
			makeCard("archived-1", "uid-archived"),
		];
		const { service, cardsMock } = createService({
			queryCards,
			existingUids: new Set(["uid-live", "uid-archived"]),
			archivedUids: new Set(["uid-archived"]),
		});

		const result = service.query(
			{ ...EMPTY_FILTER, showArchived: true },
			sort,
			200,
			0,
		);

		expect(result.cards.map((c) => c.id)).toEqual(["live-1", "archived-1"]);
		expect(result.totalCount).toBe(2);

		const where = cardsMock.browserQuery.mock.calls[0]?.[0] as string;
		expect(where).not.toContain(
			"c.source_uid IS NULL OR c.source_uid NOT IN",
		);
	});
});

describe("CardBrowserQueryService.getFacetCounts archived filtering", () => {
	it("hides archived source notes when showArchived=false", () => {
		const allCards = [
			makeCard("live-1", "uid-live", { state: State.New }),
			makeCard("archived-1", "uid-archived", { state: State.Review }),
		];
		const { service } = createService({
			allCards,
			existingUids: new Set(["uid-live", "uid-archived"]),
			archivedUids: new Set(["uid-archived"]),
		});

		const facets = service.getFacetCounts(false);

		expect(facets.sourceNotes.map((n) => n.uid)).toEqual(["uid-live"]);
		expect(facets.states["new"]).toBe(1);
		expect(facets.states["review"]).toBeUndefined();
	});

	it("includes archived source notes when showArchived=true", () => {
		const allCards = [
			makeCard("live-1", "uid-live"),
			makeCard("archived-1", "uid-archived"),
		];
		const { service } = createService({
			allCards,
			existingUids: new Set(["uid-live", "uid-archived"]),
			archivedUids: new Set(["uid-archived"]),
		});

		const facets = service.getFacetCounts(true);

		expect(facets.sourceNotes.map((n) => n.uid)).toEqual([
			"uid-archived",
			"uid-live",
		]);
	});
});
