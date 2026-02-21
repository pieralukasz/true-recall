import { StateEffect, StateField, type Extension } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	type DecorationSet,
	type ViewUpdate,
} from "@codemirror/view";
import { effect } from "@preact/signals";
import {
	highlightRequest,
	type HighlightRequest,
} from "@shared/services/signals";

const addHighlight = StateEffect.define<{
	from: number;
	to: number;
	className: string;
}>();
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
						class: e.value.className,
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
					if (!req) {
						queueMicrotask(() => this.clearHighlightNow());
						return;
					}
					queueMicrotask(() => this.handleRequest(req));
				});
			}

			private clearHighlightNow(): void {
				if (this.clearTimer) {
					clearTimeout(this.clearTimer);
					this.clearTimer = null;
				}
				this.view.dispatch({
					effects: clearHighlight.of(undefined),
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
					this.clearTimer = null;
				}

				const className =
					req.mode === "hover"
						? "true-recall-source-highlight-hover"
						: "true-recall-source-highlight";

				const effects: StateEffect<unknown>[] = [
					addHighlight.of({
						from: idx,
						to: idx + req.sourceText.length,
						className,
					}),
				];

				if (req.mode === "jump") {
					effects.push(EditorView.scrollIntoView(idx, { y: "center" }));
				}

				this.view.dispatch({ effects });

				// Auto-clear only for jump mode
				if (req.mode === "jump") {
					this.clearTimer = setTimeout(() => {
						this.view.dispatch({
							effects: clearHighlight.of(undefined),
						});
						this.clearTimer = null;
					}, 2000);
				}
			}

			update(_update: ViewUpdate): void {}

			destroy(): void {
				this.dispose?.();
				if (this.clearTimer) clearTimeout(this.clearTimer);
			}
		},
	);

	return [highlightField, plugin];
}
