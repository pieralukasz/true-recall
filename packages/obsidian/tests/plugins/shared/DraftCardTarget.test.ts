import { describe, expect, it, vi } from "vitest";

import { DraftCardTarget } from "@true-recall/plugins/shared/DraftCardTarget";

describe("DraftCardTarget", () => {
	it("round-trips fields and note type from detail", () => {
		const t = new DraftCardTarget({
			fields: { Front: "q", Back: "" },
			noteType: { id: "b", name: "Basic", fields: ["Front", "Back"] },
			sourceUid: "uid-1",
			currentCardId: null,
			onApply: vi.fn(),
		});
		expect(t.getFields()).toEqual({ Front: "q", Back: "" });
		expect(t.getNoteType().fields).toEqual(["Front", "Back"]);
		expect(t.getSourceUid()).toBe("uid-1");
		expect(t.getCurrentCardId()).toBeNull();
	});

	it("filters apply() to keys present in the note type", () => {
		const onApply = vi.fn();
		new DraftCardTarget({
			fields: { Front: "", Back: "" },
			noteType: { id: "b", name: "Basic", fields: ["Front", "Back"] },
			sourceUid: "u",
			currentCardId: null,
			onApply,
		}).apply({ Front: "Q", Back: "A", Stale: "drop me" });
		expect(onApply).toHaveBeenCalledWith({ Front: "Q", Back: "A" });
	});
});
