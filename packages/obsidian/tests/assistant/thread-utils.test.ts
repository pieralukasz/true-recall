import { describe, expect, it } from "vitest";

import {
	normalizedSelectedText,
	selectedTextPreview,
	statusTone,
} from "../../src/features/assistant/ui/thread-utils";

describe("statusTone", () => {
	it("maps active states to accent", () => {
		expect(statusTone("pending")).toBe("accent");
		expect(statusTone("running")).toBe("accent");
		expect(statusTone("working")).toBe("accent");
	});

	it("maps failed to danger", () => {
		expect(statusTone("failed")).toBe("danger");
	});

	it("defaults to neutral", () => {
		expect(statusTone("done")).toBe("neutral");
		expect(statusTone("2 to review")).toBe("neutral");
		expect(statusTone("draft")).toBe("neutral");
	});
});

describe("normalizedSelectedText", () => {
	it("collapses whitespace and trims", () => {
		expect(normalizedSelectedText("  a\n\n b  ")).toBe("a b");
	});

	it("returns null for empty input", () => {
		expect(normalizedSelectedText(undefined)).toBeNull();
		expect(normalizedSelectedText("   ")).toBeNull();
	});
});

describe("selectedTextPreview", () => {
	it("passes short text through", () => {
		expect(selectedTextPreview("short")).toBe("short");
	});

	it("truncates long text to 140 chars ending with ellipsis", () => {
		const preview = selectedTextPreview("x".repeat(200));
		expect(preview).toHaveLength(140);
		expect(preview?.endsWith("...")).toBe(true);
	});
});
