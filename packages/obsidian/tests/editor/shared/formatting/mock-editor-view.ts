/** Minimal stand-in for a CM6 EditorView: the formatting helpers only touch
 * doc slices, the main selection range, dispatch and focus. */
interface DispatchPayload {
	changes?: { from: number; to: number; insert: string };
	selection?: { anchor: number; head?: number };
}

export class MockEditorView {
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
				toString: () => this.text,
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
