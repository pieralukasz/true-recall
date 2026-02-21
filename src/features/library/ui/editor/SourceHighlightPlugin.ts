import { StateEffect, StateField, type Extension } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { effect } from "@preact/signals";
import {
	highlightRequest,
	type HighlightRequest,
} from "@shared/services/signals";

const addHighlight = StateEffect.define<{ from: number; to: number }>();
const clearHighlight = StateEffect.define<void>();

const highlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(decorations, tr) {
		for (const e of tr.effects) {
			if (e.is(addHighlight)) {
				return Decoration.set([
					Decoration.mark({
						class: "true-recall-source-highlight",
					}).range(e.value.from, e.value.to),
				]);
			}
			if (e.is(clearHighlight)) {
				return Decoration.none;
			}
		}
		return decorations.map(tr.changes);
	},
	provide: (f) => EditorView.decorations.from(f),
});

export function createSourceHighlightExtension(
	getFilePath: () => string | undefined,
): Extension {
	const plugin = ViewPlugin.fromClass(
		class {
			private lastRequestId = -1;
			private clearTimer: ReturnType<typeof setTimeout> | null = null;
			private dispose: (() => void) | null = null;

			constructor(private view: EditorView) {
				this.dispose = effect(() => {
					const req = highlightRequest.value;
					if (!req) return;
					// Can't dispatch during signal effect — schedule for next microtask
					queueMicrotask(() => this.handleRequest(req));
				});
			}

			private handleRequest(req: HighlightRequest): void {
				if (req.requestId === this.lastRequestId) return;
				this.lastRequestId = req.requestId;

				const currentPath = getFilePath();
				if (!currentPath || currentPath !== req.sourceNotePath) return;

				const doc = this.view.state.doc.toString();
				const idx = doc.indexOf(req.sourceText);
				if (idx === -1) return;

				if (this.clearTimer) {
					clearTimeout(this.clearTimer);
				}

				this.view.dispatch({
					effects: [
						addHighlight.of({
							from: idx,
							to: idx + req.sourceText.length,
						}),
						EditorView.scrollIntoView(idx, { y: "center" }),
					],
				});

				this.clearTimer = setTimeout(() => {
					this.view.dispatch({
						effects: clearHighlight.of(undefined),
					});
					this.clearTimer = null;
				}, 2000);
			}

			update(_update: ViewUpdate): void {
				// No action needed — StateField handles decoration mapping
			}

			destroy(): void {
				this.dispose?.();
				if (this.clearTimer) clearTimeout(this.clearTimer);
			}
		},
	);

	return [highlightField, plugin];
}
