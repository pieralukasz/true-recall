import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import {
	handleCreateCards,
	handleListCards,
} from "../../../../src/plugin/api/handlers/cards";

function mockRes() {
	const calls: Array<{ status: number; body: unknown }> = [];
	return {
		writeHead: (status: number) => {
			calls.push({ status, body: undefined });
		},
		end: (data?: string) => {
			const last = calls[calls.length - 1];
			if (last) last.body = data ? JSON.parse(data) : undefined;
		},
		calls,
	};
}

function mockReq(body?: unknown, url = "/cards") {
	const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
	const req = {
		url,
		on(event: string, cb: (...a: unknown[]) => void) {
			const existing = listeners[event] ?? [];
			existing.push(cb);
			listeners[event] = existing;
			return req;
		},
		destroy() {},
	};
	setTimeout(() => {
		if (body !== undefined) {
			for (const cb of listeners.data ?? []) {
				cb(Buffer.from(JSON.stringify(body)));
			}
		}
		for (const cb of listeners.end ?? []) {
			cb();
		}
	}, 0);
	return req as never;
}

interface StoredCard {
	id: string;
	question: string;
	answer: string;
	state: State;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	suspended?: boolean;
	buriedUntil?: string;
	sourceUid?: string;
}

function createStoredCard(overrides: Partial<StoredCard> = {}): StoredCard {
	return {
		id: overrides.id ?? "card-1",
		question: overrides.question ?? "Q",
		answer: overrides.answer ?? "A",
		state: overrides.state ?? State.Review,
		due: overrides.due ?? "2026-08-01T10:00:00.000Z",
		stability: overrides.stability ?? 5,
		difficulty: overrides.difficulty ?? 5,
		reps: overrides.reps ?? 1,
		lapses: overrides.lapses ?? 0,
		suspended: overrides.suspended,
		buriedUntil: overrides.buriedUntil,
		sourceUid: overrides.sourceUid,
	};
}

function mockPlugin(
	cards: StoredCard[] = [],
	opts: { createdIds?: string[] } = {},
) {
	const execute = vi.fn(async () => {});
	return {
		execute,
		plugin: {
			isStoreReady: () => true,
			cardStore: {
				cards: {
					getAll: () => cards,
					getCardsBySourceUid: () => cards,
				},
			},
			hierarchyService: {
				getArchivedSourceUids: () => new Set<string>(),
			},
			flashcardManager: {
				createNoteBatch: vi.fn(() => ({
					cards: (opts.createdIds ?? ["new-1"]).map((id) => ({ id })),
				})),
			},
			commandService: { execute },
		},
	};
}

describe("handleListCards", () => {
	it("exposes suspended and buriedUntil on every card", () => {
		const buriedUntil = "2026-08-05T00:00:00.000Z";
		const { plugin } = mockPlugin([
			createStoredCard({ id: "a", suspended: true }),
			createStoredCard({ id: "b", buriedUntil }),
		]);
		const res = mockRes();

		// Suspended cards are filtered out unless explicitly requested.
		handleListCards(
			mockReq(undefined, "/cards?suspended=true"),
			res as never,
			{ plugin } as never,
		);

		const body = res.calls[0]?.body as {
			data: {
				cards: Array<{ id: string; suspended: boolean; buriedUntil?: string }>;
			};
		};
		const [first, second] = body.data.cards;

		expect(first?.suspended).toBe(true);
		expect(second?.suspended).toBe(false);
		expect(second?.buriedUntil).toBe(buriedUntil);
	});

	it("defaults suspended to false rather than undefined", () => {
		const { plugin } = mockPlugin([createStoredCard({ id: "a" })]);
		const res = mockRes();

		handleListCards(mockReq(), res as never, { plugin } as never);

		const body = res.calls[0]?.body as {
			data: { cards: Array<{ suspended: boolean }> };
		};
		expect(body.data.cards[0]?.suspended).toBe(false);
	});
});

describe("handleCreateCards", () => {
	it("suspends the created cards when suspended is true", async () => {
		const { plugin, execute } = mockPlugin([], {
			createdIds: ["new-1", "new-2"],
		});
		const res = mockRes();

		await handleCreateCards(
			mockReq({ question: "Q", answer: "", suspended: true }),
			res as never,
			{ plugin } as never,
		);

		expect(execute).toHaveBeenCalledTimes(1);
		const body = res.calls[0]?.body as {
			data: { created: number; suspended: boolean };
		};
		expect(body.data.created).toBe(2);
		expect(body.data.suspended).toBe(true);
	});

	it("leaves cards in the queue when the flag is absent", async () => {
		const { plugin, execute } = mockPlugin();
		const res = mockRes();

		await handleCreateCards(
			mockReq({ question: "Q", answer: "A" }),
			res as never,
			{ plugin } as never,
		);

		expect(execute).not.toHaveBeenCalled();
		const body = res.calls[0]?.body as { data: { suspended: boolean } };
		expect(body.data.suspended).toBe(false);
	});

	it("accepts an empty answer so a question can be captured mid-study", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleCreateCards(
			mockReq({ question: "Dlaczego?", answer: "", suspended: true }),
			res as never,
			{ plugin } as never,
		);

		expect(res.calls[0]?.status).toBe(200);
	});

	it("rejects a card with no question", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleCreateCards(
			mockReq({ question: "  ", answer: "A" }),
			res as never,
			{ plugin } as never,
		);

		expect(res.calls[0]?.status).toBe(400);
	});
});
