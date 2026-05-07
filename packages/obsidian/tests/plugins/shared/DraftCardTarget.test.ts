import { describe, expect, it, vi } from "vitest";

import { DraftCardTarget } from "@true-recall/plugins/shared/DraftCardTarget";

describe("DraftCardTarget", () => {
	it("round-trips fields and note type from detail", () => {
		const t = new DraftCardTarget({
			fields: { Front: "q", Back: "" },
			noteType: { id: "b", name: "Basic", fields: ["Front", "Back"] },
			sourceUid: "uid-1",
			currentCardId: null,
			operation: "create",
			onApply: vi.fn(),
		});
		expect(t.getFields()).toEqual({ Front: "q", Back: "" });
		expect(t.getNoteType().fields).toEqual(["Front", "Back"]);
		expect(t.getSourceUid()).toBe("uid-1");
		expect(t.getCurrentCardId()).toBeUndefined();
		expect(t.getOperation()).toBe("create");
	});

	it("filters apply() to keys present in the note type and returns true", () => {
		const onApply = vi.fn();
		const result = new DraftCardTarget({
			fields: { Front: "", Back: "" },
			noteType: { id: "b", name: "Basic", fields: ["Front", "Back"] },
			sourceUid: "u",
			currentCardId: null,
			operation: "create",
			onApply,
		}).apply({ Front: "Q", Back: "A", Stale: "drop me" });
		expect(onApply).toHaveBeenCalledWith({ Front: "Q", Back: "A" });
		expect(result).toBe(true);
	});
});
