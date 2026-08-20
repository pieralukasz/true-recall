import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import {
	handleGetActualLearningCards,
	handleListCards,
} from "../../../../src/plugin/api/handlers/cards";
import { handleStartSession } from "../../../../src/plugin/api/handlers/sessions";

function createResponse() {
	let status = 0;
	let body: unknown;
	return {
		response: {
			writeHead(nextStatus: number) {
				status = nextStatus;
			},
			end(data?: string) {
				body = data ? JSON.parse(data) : undefined;
			},
		},
		get status() {
			return status;
		},
		get body() {
			return body as { data: Record<string, unknown> };
		},
	};
}

function createRequest(url: string, body?: unknown) {
	const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
	const request = {
		url,
		on(event: string, listener: (...args: unknown[]) => void) {
			listeners.set(event, [...(listeners.get(event) ?? []), listener]);
			return request;
		},
		destroy() {},
	};

	if (body !== undefined) {
		queueMicrotask(() => {
			for (const listener of listeners.get("data") ?? []) {
				listener(Buffer.from(JSON.stringify(body)));
			}
			for (const listener of listeners.get("end") ?? []) listener();
		});
	}

	return request;
}

function createStoredCard(id: string, state: State) {
	return {
		id,
		question: `${id} question`,
		answer: `${id} answer`,
		state,
		due: "2026-08-06T10:00:00.000Z",
		stability: 1,
		difficulty: 5,
		reps: 1,
		lapses: 0,
	};
}

function createSchedulingCard(
	id: string,
	state: State,
	overrides: {
		suspended?: boolean;
		buriedUntil?: string;
		sourceUid?: string;
	} = {},
) {
	return {
		id,
		question: `${id} question`,
		answer: `${id} answer`,
		cardType: "basic",
		sourceUid: overrides.sourceUid,
		sourceNoteName: `${id} note`,
		fsrs: {
			state,
			due: "2026-08-06T10:00:00.000Z",
			stability: 1,
			difficulty: 5,
			reps: 1,
			lapses: 0,
			suspended: overrides.suspended,
			buriedUntil: overrides.buriedUntil,
		},
	};
}

describe("actual-learning API", () => {
	it("filters list_cards to both Learning and Relearning", () => {
		const cards = [
			createStoredCard("learning", State.Learning),
			createStoredCard("relearning", State.Relearning),
			createStoredCard("review", State.Review),
		];
		const result = createResponse();

		handleListCards(
			createRequest("/cards?state=actual-learning") as never,
			result.response as never,
			{
				plugin: {
					isStoreReady: () => true,
					cardStore: {
						cards: { getAll: () => cards, getCardsBySourceUid: () => cards },
					},
					hierarchyService: {
						getArchivedSourceUids: () => new Set<string>(),
					},
				},
			} as never,
		);

		const responseCards = result.body.data.cards as Array<{ id: string }>;
		expect(responseCards.map((card) => card.id)).toEqual([
			"learning",
			"relearning",
		]);
	});

	it("returns only active, non-archived actual-learning cards", () => {
		const cards = [
			createSchedulingCard("learning", State.Learning),
			createSchedulingCard("relearning", State.Relearning),
			createSchedulingCard("review", State.Review),
			createSchedulingCard("suspended", State.Learning, { suspended: true }),
			createSchedulingCard("buried", State.Relearning, {
				buriedUntil: "2999-01-01T00:00:00.000Z",
			}),
			createSchedulingCard("archived", State.Learning, {
				sourceUid: "archived-source",
			}),
		];
		const result = createResponse();

		handleGetActualLearningCards(
			createRequest("/cards/actual-learning?limit=20") as never,
			result.response as never,
			{
				plugin: {
					isStoreReady: () => true,
					flashcardManager: { getAllFSRSCards: () => cards },
					fsrsService: { sortByDue: (items: unknown[]) => items },
					hierarchyService: {
						getArchivedSourceUids: () => new Set(["archived-source"]),
					},
				},
			} as never,
		);

		const responseCards = result.body.data.cards as Array<{ id: string }>;
		expect(responseCards.map((card) => card.id)).toEqual([
			"learning",
			"relearning",
		]);
		expect(result.body.data.actualLearningCount).toBe(2);
	});

	it("starts an actual-learning review session", async () => {
		const startReview = vi.fn(async () => {});
		const result = createResponse();

		await handleStartSession(
			createRequest("/sessions/start", { mode: "actual_learning" }) as never,
			result.response as never,
			{
				plugin: { isStoreReady: () => true, startReview },
			} as never,
		);

		expect(startReview).toHaveBeenCalledWith({
			mode: "custom",
			customStudy: { kind: "actual-learning" },
			ignoreDailyLimits: true,
			bypassScheduling: true,
		});
		expect(result.status).toBe(200);
	});
});
