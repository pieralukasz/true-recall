import { describe, expect, it } from "vitest";

import { assistantItemsForNote } from "../../src/features/assistant/ui/assistant-note-match";

const thread = (id: string, ctx: Record<string, unknown>) => ({
	id,
	context: ctx,
});
const task = (id: string, ctx: Record<string, unknown>, threadId?: string) => ({
	id,
	threadId,
	context: ctx,
});

describe("assistantItemsForNote", () => {
	it("matches by activeNotePath and by source path", () => {
		const result = assistantItemsForNote({
			threads: [
				thread("t1", { activeNotePath: "a/b.md" }),
				thread("t2", { source: { path: "a/b.md", uid: "u" } }),
				thread("t3", { activeNotePath: "other.md" }),
			],
			tasks: [],
			notePath: "a/b.md",
		});
		expect(result.count).toBe(2);
		expect(result.firstThreadId).toBe("t1");
	});

	it("counts standalone tasks but skips thread-owned tasks", () => {
		const result = assistantItemsForNote({
			threads: [],
			tasks: [
				task("k1", { activeNotePath: "a/b.md" }),
				task("k2", { activeNotePath: "a/b.md" }, "t1"),
			],
			notePath: "a/b.md",
		});
		expect(result.count).toBe(1);
		expect(result.firstThreadId).toBeNull();
	});

	it("returns zero for a missing note path", () => {
		const result = assistantItemsForNote({
			threads: [thread("t1", { activeNotePath: "a/b.md" })],
			tasks: [],
			notePath: null,
		});
		expect(result.count).toBe(0);
		expect(result.firstThreadId).toBeNull();
	});
});
