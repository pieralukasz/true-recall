import { type Extension, StateEffect, StateField } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { effect } from "@preact/signals";

import {
	type HighlightRequest,
	highlightRequest,
} from "@true-recall/obsidian/services/signals";

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
			private clearTimer: number | null = null;
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
					window.clearTimeout(this.clearTimer);
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
					window.clearTimeout(this.clearTimer);
					this.clearTimer = null;
				}

				const colorSuffix =
					req.colorHint && req.colorHint !== "default"
						? `-${req.colorHint}`
						: "";
				const className =
					req.mode === "hover"
						? `true-recall-source-highlight-hover${colorSuffix}`
						: `true-recall-source-highlight${colorSuffix}`;

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
					this.clearTimer = window.setTimeout(() => {
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
				if (this.clearTimer) window.clearTimeout(this.clearTimer);
			}
		},
	);

	return [highlightField, plugin];
}
