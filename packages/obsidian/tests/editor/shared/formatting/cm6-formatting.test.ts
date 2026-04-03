import { describe, expect, it } from "vitest";
import {
	clearFormatting,
	insertAtCursor,
	toggleAsymmetricMarker,
	toggleMarker,
} from "../../../../src/editor/shared/formatting/cm6-formatting";

interface DispatchPayload {
	changes?: { from: number; to: number; insert: string };
	selection?: { anchor: number; head?: number };
}

class MockEditorView {
	private text: string;
	private from: number;
	private to: number;
	focusCalls = 0;

	constructor(text: string, from: number, to = from) {
		this.text = text;
		this.from = from;
		this.to = to;
	}

	get value(): string {
		return this.text;
	}

	get selection(): { from: number; to: number } {
		return { from: this.from, to: this.to };
	}

	get state() {
		return {
			doc: {
				length: this.text.length,
				sliceString: (from: number, to: number) =>
					this.text.slice(Math.max(0, from), Math.max(0, to)),
			},
			selection: {
				main: {
					from: this.from,
					to: this.to,
					anchor: this.from,
					head: this.to,
				},
			},
			sliceDoc: (from: number, to: number) =>
				this.text.slice(Math.max(0, from), Math.max(0, to)),
		};
	}

	dispatch(payload: DispatchPayload): void {
		if (payload.changes) {
			const { from, to, insert } = payload.changes;
			this.text = this.text.slice(0, from) + insert + this.text.slice(to);
			this.from = from;
			this.to = from + insert.length;
		}

		if (payload.selection) {
			const head = payload.selection.head ?? payload.selection.anchor;
			this.from = Math.min(payload.selection.anchor, head);
			this.to = Math.max(payload.selection.anchor, head);
		}
	}

	focus(): void {
		this.focusCalls += 1;
	}
}

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
