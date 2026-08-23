import { describe, expect, it } from "vitest";

import { FORMATTING_KEYBINDINGS } from "../../../../src/editor/shared/formatting/formatting-keymap";
import { MockEditorView } from "./mock-editor-view";

function runBinding(key: string, view: MockEditorView): boolean {
	const binding = FORMATTING_KEYBINDINGS.find((b) => b.key === key);
	if (!binding) throw new Error(`No binding registered for ${key}`);
	return binding.run(view as never);
}

describe("formatting keymap", () => {
	it("wraps the selection in <u> on Mod-u", () => {
		const view = new MockEditorView("hello world", 6, 11);

		const handled = runBinding("Mod-u", view);

		expect(handled).toBe(true);
		expect(view.value).toBe("hello <u>world</u>");
	});

	it("unwraps an already underlined selection on Mod-u", () => {
		const view = new MockEditorView("hello <u>world</u>", 9, 14);

		runBinding("Mod-u", view);

		expect(view.value).toBe("hello world");
	});

	it("numbers a new cloze above the highest one in the document", () => {
		const view = new MockEditorView("{{c1::alpha}} beta", 14, 18);

		runBinding("Mod-Shift-c", view);

		expect(view.value).toBe("{{c1::alpha}} {{c2::beta}}");
	});

	it("wraps the selection as a cloze on Mod-Shift-c", () => {
		const view = new MockEditorView("hello world", 6, 11);

		const handled = runBinding("Mod-Shift-c", view);

		expect(handled).toBe(true);
		expect(view.value).toBe("hello {{c1::world}}");
	});
});
