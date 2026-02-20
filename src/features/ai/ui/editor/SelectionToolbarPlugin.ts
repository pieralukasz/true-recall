import type { GenerationMode } from "@features/ai/prompts/default-prompts";
import { SelectionToolbar } from "@features/ai/ui/editor/SelectionToolbar";
import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { h, render } from "preact";

export interface SelectionToolbarCallbacks {
	onGenerate: (text: string, mode: GenerationMode) => Promise<void>;
	onEdit: (text: string) => void;
	onQuickAdd: (text: string) => Promise<void>;
	hasApiKey: () => boolean;
	isEnabled: () => boolean;
}

const MIN_SELECTION_LENGTH = 3;

export function createSelectionToolbarExtension(
	callbacks: SelectionToolbarCallbacks,
): Extension {
	return ViewPlugin.fromClass(
		class {
			private container: HTMLDivElement | null = null;
			private currentText = "";

			constructor(private view: EditorView) {
				this.checkSelection();
			}

			update(update: ViewUpdate): void {
				if (
					update.selectionSet ||
					update.docChanged ||
					update.focusChanged
				) {
					this.checkSelection();
				}
			}

			destroy(): void {
				this.removeToolbar();
			}

			private checkSelection(): void {
				if (!callbacks.isEnabled()) {
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

				// Reuse existing container if text unchanged
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
					this.container.className =
						"true-recall-selection-toolbar-container";
					document.body.appendChild(this.container);
				}

				render(
					h(SelectionToolbar, {
						selectedText: text,
						onGenerate: async (mode: GenerationMode) => {
							await callbacks.onGenerate(text, mode);
						},
						onEdit: () => callbacks.onEdit(text),
						onQuickAdd: async () => {
							await callbacks.onQuickAdd(text);
						},
						hasApiKey: callbacks.hasApiKey(),
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

				const toolbarRect = this.container.getBoundingClientRect();
				const toolbarHeight = toolbarRect.height || 28;

				let left = coords.left;
				let top = coords.top - toolbarHeight - 6;

				// Keep within viewport
				const vw = window.innerWidth;
				if (left + toolbarRect.width > vw - 8) {
					left = vw - toolbarRect.width - 8;
				}
				if (left < 8) left = 8;

				// If no space above, show below the selection
				if (top < 8) {
					top = coords.bottom + 6;
				}

				this.container.style.left = `${left}px`;
				this.container.style.top = `${top}px`;
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
