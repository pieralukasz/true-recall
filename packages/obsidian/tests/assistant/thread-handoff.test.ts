import { describe, expect, it } from "vitest";

import { resolveThreadHandoff } from "../../src/features/assistant/ui/thread-handoff";

const base = {
	state: "active",
	activeTaskId: undefined,
	manifest: undefined,
};

describe("resolveThreadHandoff", () => {
	it("returns none for a missing thread", () => {
		expect(resolveThreadHandoff(null)).toBe("none");
		expect(resolveThreadHandoff(undefined)).toBe("none");
	});

	it("returns none for non-active threads", () => {
		expect(resolveThreadHandoff({ ...base, state: "inbox" })).toBe("none");
		expect(resolveThreadHandoff({ ...base, state: "archived" })).toBe("none");
	});

	it("defers when a task is still running", () => {
		expect(resolveThreadHandoff({ ...base, activeTaskId: "t1" })).toBe(
			"defer",
		);
	});

	it("defers when proposals await review", () => {
		expect(
			resolveThreadHandoff({
				...base,
				manifest: { proposals: [{ status: "proposed" }] },
			}),
		).toBe("defer");
	});

	it("archives when nothing is pending", () => {
		expect(
			resolveThreadHandoff({
				...base,
				manifest: {
					proposals: [{ status: "applied" }, { status: "rejected" }],
				},
			}),
		).toBe("archive");
	});
});
