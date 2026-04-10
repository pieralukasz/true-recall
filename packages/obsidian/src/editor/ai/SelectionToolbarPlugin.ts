import type { Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { h, render } from "preact";

import type { ToolbarButtonConfig } from "@true-recall/core/types";

import { SelectionToolbar, type ToolbarActions } from "./SelectionToolbar";

interface SelectionToolbarCallbacks {
	actions: ToolbarActions;
	getButtons: () => ToolbarButtonConfig[];
	hasApiKey: () => boolean;
	isEnabled: () => boolean;
}

function extractFirstImagePath(text: string): string | null {
	const wiki = text.match(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	if (wiki?.[1]) return wiki[1].trim();
	const md = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
	if (md?.[1]) return md[1].trim();
	return null;
}

const MIN_SELECTION_LENGTH = 3;

export function createSelectionToolbarExtension(
	callbacks: SelectionToolbarCallbacks,
): Extension {
	return ViewPlugin.fromClass(
		class {
			private container: HTMLDivElement | null = null;
			private currentText = "";

			private rafId = 0;

			constructor(private view: EditorView) {
				this.scheduleCheck();
			}

			update(update: ViewUpdate): void {
				if (update.selectionSet || update.docChanged || update.focusChanged) {
					this.scheduleCheck();
				}
			}

			private scheduleCheck(): void {
				cancelAnimationFrame(this.rafId);
				this.rafId = requestAnimationFrame(() => this.checkSelection());
			}

			destroy(): void {
				cancelAnimationFrame(this.rafId);
				this.removeToolbar();
			}

			private checkSelection(): void {
				if (!callbacks.isEnabled()) {
					this.removeToolbar();
					return;
				}

				if (!this.view.hasFocus && !this.container?.matches(":hover")) {
					this.removeToolbar();
					return;
				}

				if (
					this.view.dom.closest(
						".true-recall-review-card-container, .ep-card-browser",
					)
				) {
					this.removeToolbar();
					return;
				}

				const { state } = this.view;
				const selection = state.selection.main;

				if (selection.empty) {
					this.removeToolbar();
					return;
				}

				const selectedText = state.doc.sliceString(
					selection.from,
					selection.to,
				);

				if (selectedText.trim().length < MIN_SELECTION_LENGTH) {
					this.removeToolbar();
					return;
				}

				if (this.container && this.currentText === selectedText) {
					this.positionToolbar(selection.from);
					return;
				}

				this.currentText = selectedText;
				this.showToolbar(selectedText, selection.from);
			}

			private showToolbar(text: string, pos: number): void {
				if (!this.container) {
					this.container = document.createElement("div");
					this.container.className = "true-recall-selection-toolbar-container";
					document.body.appendChild(this.container);
				}

				const detectedImagePath = extractFirstImagePath(text);
				const highlightAction = () => {
					const { state } = this.view;
					const sel = state.selection.main;
					if (sel.empty) return;
					this.view.dispatch({
						changes: [
							{ from: sel.from, insert: "==" },
							{ from: sel.to, insert: "==" },
						],
					});
				};

				render(
					h(SelectionToolbar, {
						selectedText: text,
						buttons: callbacks.getButtons(),
						actions: {
							...callbacks.actions,
							onHighlight: highlightAction,
							onDismiss: () => this.removeToolbar(),
						},
						hasApiKey: callbacks.hasApiKey(),
						detectedImagePath,
					}),
					this.container,
				);

				this.positionToolbar(pos);
			}

			private positionToolbar(pos: number): void {
				if (!this.container) return;

				const coords = this.view.coordsAtPos(pos);
				if (!coords) {
					this.removeToolbar();
					return;
				}

				const virtualEl = {
					getBoundingClientRect: () => ({
						width: coords.right - coords.left,
						height: coords.bottom - coords.top,
						x: coords.left,
						y: coords.top,
						top: coords.top,
						left: coords.left,
						right: coords.right,
						bottom: coords.bottom,
					}),
				};

				void computePosition(virtualEl, this.container, {
					placement: "top-start",
					middleware: [offset(6), flip(), shift({ padding: 8 })],
				}).then(({ x, y }) => {
					if (!this.container) return;
					this.container.style.left = `${x}px`;
					this.container.style.top = `${y}px`;
				});
			}

			private removeToolbar(): void {
				if (this.container) {
					render(null, this.container);
					this.container.remove();
					this.container = null;
					this.currentText = "";
				}
			}
		},
	);
}
