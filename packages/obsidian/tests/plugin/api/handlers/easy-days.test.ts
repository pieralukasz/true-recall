import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	handleAddEasyDay,
	handleApplyEasyDays,
	handleGetEasyDays,
	handleUpdateEasyDays,
} from "../../../../src/plugin/api/handlers/easy-days";

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
		url: "/settings/easy-days",
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

function mockPlugin(
	easyDays = { recurringDays: [] as number[], specificDates: [] as string[] },
	multiplier = 0.5,
) {
	const applyEasyDays = vi.fn(() => ({ affectedCount: 7 }));
	const saveSettings = vi.fn(async () => {});
	return {
		applyEasyDays,
		saveSettings,
		plugin: {
			settings: { easyDays, easyDaysMultiplier: multiplier },
			saveSettings,
			fsrsHelper: { applyEasyDays },
		},
	};
}

type Body = {
	easyDays: { recurringDays: number[]; specificDates: string[] };
	multiplier: number;
	updated?: string[];
	movedCards?: number;
	applied?: boolean;
	dryRun?: boolean;
	date?: string;
};

function bodyOf(res: ReturnType<typeof mockRes>): Body {
	return (res.calls[0]?.body as { data: Body }).data;
}

describe("handleGetEasyDays", () => {
	it("returns the stored configuration", () => {
		const { plugin } = mockPlugin({
			recurringDays: [0, 6],
			specificDates: ["2026-08-05"],
		});
		const res = mockRes();

		handleGetEasyDays(mockReq(), res as never, { plugin } as never);

		expect(bodyOf(res).easyDays.recurringDays).toEqual([0, 6]);
		expect(bodyOf(res).multiplier).toBe(0.5);
	});
});

describe("handleUpdateEasyDays", () => {
	it("appends dates without dropping the existing ones", async () => {
		const { plugin } = mockPlugin({
			recurringDays: [],
			specificDates: ["2026-08-05"],
		});
		const res = mockRes();

		await handleUpdateEasyDays(
			mockReq({ add_dates: ["2026-08-09"] }),
			res as never,
			{ plugin } as never,
		);

		expect(bodyOf(res).easyDays.specificDates).toEqual([
			"2026-08-05",
			"2026-08-09",
		]);
	});

	it("deduplicates and sorts recurring days", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleUpdateEasyDays(
			mockReq({ recurring_days: [6, 0, 6] }),
			res as never,
			{ plugin } as never,
		);

		expect(bodyOf(res).easyDays.recurringDays).toEqual([0, 6]);
	});

	it("removes dates on request", async () => {
		const { plugin } = mockPlugin({
			recurringDays: [],
			specificDates: ["2026-08-05", "2026-08-09"],
		});
		const res = mockRes();

		await handleUpdateEasyDays(
			mockReq({ remove_dates: ["2026-08-05"] }),
			res as never,
			{ plugin } as never,
		);

		expect(bodyOf(res).easyDays.specificDates).toEqual(["2026-08-09"]);
	});

	it("does not redistribute unless asked", async () => {
		const { plugin, applyEasyDays } = mockPlugin();
		const res = mockRes();

		await handleUpdateEasyDays(
			mockReq({ add_dates: ["2026-08-09"] }),
			res as never,
			{ plugin } as never,
		);

		expect(applyEasyDays).not.toHaveBeenCalled();
	});

	it("redistributes when apply is set", async () => {
		const { plugin, applyEasyDays } = mockPlugin();
		const res = mockRes();

		await handleUpdateEasyDays(
			mockReq({ add_dates: ["2026-08-09"], apply: true }),
			res as never,
			{ plugin } as never,
		);

		expect(applyEasyDays).toHaveBeenCalledWith({ dryRun: false });
		expect(bodyOf(res).movedCards).toBe(7);
	});

	it.each([
		["weekday out of range", { recurring_days: [7] }],
		["malformed date", { add_dates: ["05-08-2026"] }],
		["multiplier above one", { multiplier: 1.5 }],
	] as const)("rejects %s", async (_label, payload) => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleUpdateEasyDays(mockReq(payload), res as never, {
			plugin,
		} as never);

		expect(res.calls[0]?.status).toBe(400);
	});

	it("rejects a body with nothing to update", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleUpdateEasyDays(mockReq({}), res as never, { plugin } as never);

		expect(res.calls[0]?.status).toBe(400);
	});
});

describe("handleAddEasyDay", () => {
	describe("with a pinned clock", () => {
		beforeEach(() => {
			// Only Date is faked: mockReq drives the request body through
			// setTimeout, which must keep running for real.
			vi.useFakeTimers({ toFake: ["Date"] });
			vi.setSystemTime(new Date("2026-08-01T10:00:00"));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("defaults to today and applies immediately", async () => {
			const { plugin, applyEasyDays } = mockPlugin();
			const res = mockRes();

			await handleAddEasyDay(mockReq({}), res as never, { plugin } as never);

			expect(bodyOf(res).date).toBe("2026-08-01");
			expect(bodyOf(res).easyDays.specificDates).toContain("2026-08-01");
			expect(applyEasyDays).toHaveBeenCalledWith({ dryRun: false });
		});
	});

	it("can record the date without redistributing", async () => {
		const { plugin, applyEasyDays } = mockPlugin();
		const res = mockRes();

		await handleAddEasyDay(
			mockReq({ date: "2026-08-09", apply: false }),
			res as never,
			{ plugin } as never,
		);

		expect(applyEasyDays).not.toHaveBeenCalled();
		expect(bodyOf(res).easyDays.specificDates).toContain("2026-08-09");
	});

	it("rejects a malformed date", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleAddEasyDay(mockReq({ date: "tomorrow" }), res as never, {
			plugin,
		} as never);

		expect(res.calls[0]?.status).toBe(400);
	});
});

describe("handleApplyEasyDays", () => {
	it("refuses when nothing is configured", async () => {
		const { plugin } = mockPlugin();
		const res = mockRes();

		await handleApplyEasyDays(mockReq({}), res as never, { plugin } as never);

		expect(res.calls[0]?.status).toBe(400);
	});

	it("performs a real run by default", async () => {
		const { plugin, applyEasyDays } = mockPlugin({
			recurringDays: [6],
			specificDates: [],
		});
		const res = mockRes();

		await handleApplyEasyDays(mockReq({}), res as never, { plugin } as never);

		expect(applyEasyDays).toHaveBeenCalledWith({ dryRun: false });
		expect(bodyOf(res).movedCards).toBe(7);
	});

	it("previews when dry_run is requested", async () => {
		const { plugin, applyEasyDays } = mockPlugin({
			recurringDays: [6],
			specificDates: [],
		});
		const res = mockRes();

		await handleApplyEasyDays(mockReq({ dry_run: true }), res as never, {
			plugin,
		} as never);

		expect(applyEasyDays).toHaveBeenCalledWith({ dryRun: true });
		expect(bodyOf(res).dryRun).toBe(true);
	});
});
