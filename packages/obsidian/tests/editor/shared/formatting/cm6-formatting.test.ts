import { describe, expect, it } from "vitest";

import {
	clearFormatting,
	insertAtCursor,
	toggleAsymmetricMarker,
	toggleMarker,
} from "../../../../src/editor/shared/formatting/cm6-formatting";
import { MockEditorView } from "./mock-editor-view";

describe("cm6-formatting", () => {
	it("wraps selected text with symmetric marker", () => {
		const view = new MockEditorView("hello world", 0, 5);

		toggleMarker(view as never, "**");

		expect(view.value).toBe("**hello** world");
	});

	it("unwraps text when selection sits inside surrounding markers", () => {
		const view = new MockEditorView("**hello** world", 2, 7);

		toggleMarker(view as never, "**");

		expect(view.value).toBe("hello world");
	});

	it("wraps selected text with asymmetric marker", () => {
		const view = new MockEditorView("hello world", 6, 11);

		toggleAsymmetricMarker(view as never, "[[", "]]");

		expect(view.value).toBe("hello [[world]]");
	});

	it("inserts text at cursor", () => {
		const view = new MockEditorView("hello world", 5);

		insertAtCursor(view as never, "!");

		expect(view.value).toBe("hello! world");
	});

	it("clears known markdown formatting from selection", () => {
		const text =
			'**bold** [[link]] <u>under</u> <span style="color:var(--color-red)">red</span>';
		const view = new MockEditorView(text, 0, text.length);

		clearFormatting(view as never);

		expect(view.value).toBe("bold link under red");
	});
});
