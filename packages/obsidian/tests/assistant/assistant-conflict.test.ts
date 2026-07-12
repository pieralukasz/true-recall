import { describe, expect, it } from "vitest";

import { detectFieldConflict } from "../../src/services/assistant/assistant-conflict";

describe("detectFieldConflict", () => {
	it("returns null when current fields match the proposal snapshot", () => {
		expect(
			detectFieldConflict({ Front: "Q", Back: "" }, { Front: "Q", Back: "" }),
		).toBeNull();
	});

	it("lists fields that changed since the snapshot", () => {
		expect(
			detectFieldConflict({ Front: "Q", Back: "" }, { Front: "Q2", Back: "x" }),
		).toEqual(["Front", "Back"]);
	});

	it("treats a missing current field as changed from a non-empty snapshot", () => {
		expect(detectFieldConflict({ Front: "Q" }, {})).toEqual(["Front"]);
	});
});
