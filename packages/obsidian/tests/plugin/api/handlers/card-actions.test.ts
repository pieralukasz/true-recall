import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleBulkBury } from "../../../../src/plugin/api/handlers/card-actions";

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

function mockReq(body?: unknown) {
	const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
	const req = {
		url: "/cards/bulk-bury",
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

function mockPlugin() {
	const execute = vi.fn(async () => {});
	return {
		execute,
		plugin: {
			isStoreReady: () => true,
			commandService: { execute },
		},
	};
}

type BuryBody = {
	buried: number;
	unburied: number;
	untilDate: string;
	cardIds: string[];
};

function bodyOf(res: ReturnType<typeof mockRes>): BuryBody {
	return (res.calls[0]?.body as { data: BuryBody }).data;
}

describe("handleBulkBury", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-08-01T10:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("buries for a number of days by default", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleBulkBury(mockReq({ card_ids: ["a"], days: 3 }), res as never, {
			plugin,
		} as never);

		const body = bodyOf(res);
		expect(body.buried).toBe(1);
		expect(body.unburied).toBe(0);
		expect(new Date(body.untilDate).getTime()).toBeGreaterThan(Date.now());
	});

	it("unbury sets an already-elapsed date", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleBulkBury(
			mockReq({ card_ids: ["a", "b"], unbury: true }),
			res as never,
			{ plugin } as never,
		);

		const body = bodyOf(res);
		expect(body.unburied).toBe(2);
		expect(body.buried).toBe(0);
		expect(new Date(body.untilDate).getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("unbury wins over days so the two cannot fight", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleBulkBury(
			mockReq({ card_ids: ["a"], days: 5, unbury: true }),
			res as never,
			{ plugin } as never,
		);

		expect(new Date(bodyOf(res).untilDate).getTime()).toBeLessThanOrEqual(
			Date.now(),
		);
	});

	it("rejects an empty card list", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleBulkBury(mockReq({ card_ids: [] }), res as never, {
			plugin,
		} as never);

		expect(res.calls[0]?.status).toBe(400);
	});

	it("rejects a non-positive days value", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleBulkBury(mockReq({ card_ids: ["a"], days: 0 }), res as never, {
			plugin,
		} as never);

		expect(res.calls[0]?.status).toBe(400);
	});
});
