import { describe, expect, it } from "vitest";

import { resolveComposerKeyAction } from "../../src/features/assistant/ui/composer-keys";

describe("resolveComposerKeyAction", () => {
	it("submits on plain Enter", () => {
		expect(resolveComposerKeyAction({ key: "Enter", shiftKey: false })).toBe(
			"submit",
		);
	});

	it("keeps the newline on Shift+Enter", () => {
		expect(resolveComposerKeyAction({ key: "Enter", shiftKey: true })).toBe(
			"newline",
		);
	});

	it("dismisses on Escape", () => {
		expect(resolveComposerKeyAction({ key: "Escape", shiftKey: false })).toBe(
			"dismiss",
		);
	});

	it("ignores other keys", () => {
		expect(resolveComposerKeyAction({ key: "a", shiftKey: false })).toBe(
			"none",
		);
		expect(
			resolveComposerKeyAction({ key: "Enter", shiftKey: false }),
		).not.toBe("none");
	});
});
