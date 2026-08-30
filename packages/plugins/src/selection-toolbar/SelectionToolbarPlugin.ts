import type { Extension, Text } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { h, render } from "preact";

import type { ToolbarButtonConfig } from "@true-recall/core/types";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";
import type { AIProviderType } from "@true-recall/core/types/settings.types";

import {
	SelectionToolbar,
	type ToolbarActions,
	type ToolbarTier,
} from "./SelectionToolbar";

interface SelectionToolbarCallbacks {
	actions: ToolbarActions;
	getButtons: () => ToolbarButtonConfig[];
	tier: () => ToolbarTier;
	getProviderType: () => AIProviderType;
	isEnabled: () => boolean;
	getPluginStates: () => Record<string, boolean>;
	getPresets: () => GenerationPreset[];
}

function extractFirstImagePath(text: string): string | null {
	const wiki = text.match(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	if (wiki?.[1]) return wiki[1].trim();
	const md = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
	if (md?.[1]) return md[1].trim();
	return null;
}

const MIN_SELECTION_LENGTH = 3;

const CARD_TAG = "#card";

/** Highlight markers around the selection, plus a trailing `#card` tag when the
 * card variant is used. The tag is what makes highlights waiting to become
 * cards findable in search. It is padded with a space on both sides so it never
 * glues to the text that follows, and an existing tag right after the selection
 * is left alone instead of being duplicated. */
function buildHighlightChanges(
	doc: Text,
	from: number,
	to: number,
	withCardTag: boolean,
): { from: number; insert: string }[] {
	const restOfLine = doc.sliceString(to, doc.lineAt(to).to);
	const hasCardTag = new RegExp(`^\\s*${CARD_TAG}\\b`).test(restOfLine);
	const needsTrailingSpace = restOfLine.length > 0 && !/^\s/.test(restOfLine);
	const tag = `${CARD_TAG}${needsTrailingSpace ? " " : ""}`;
	const closing = withCardTag && !hasCardTag ? `== ${tag}` : "==";
	return [
		{ from, insert: "==" },
		{ from: to, insert: closing },
	];
}

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
				this.rafId = window.requestAnimationFrame(() => this.checkSelection());
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
						".true-recall-review-card-container, .ep-card-browser, .tr-quick-editor-view, .tr-modal-quick-editor, .tr-popout-view",
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
					this.container = createDiv();
					this.container.className = "true-recall-selection-toolbar-container";
					activeDocument.body.appendChild(this.container);
				}

				const detectedImagePath = extractFirstImagePath(text);
				const applyHighlight = (withCardTag: boolean) => {
					const { state } = this.view;
					const sel = state.selection.main;
					if (sel.empty) return;
					this.view.dispatch({
						changes: buildHighlightChanges(
							state.doc,
							sel.from,
							sel.to,
							withCardTag,
						),
					});
				};

				render(
					h(SelectionToolbar, {
						selectedText: text,
						buttons: callbacks.getButtons(),
						actions: {
							...callbacks.actions,
							onHighlight: () => applyHighlight(false),
							onHighlightCard: () => applyHighlight(true),
							onDismiss: () => this.removeToolbar(),
						},
						tier: callbacks.tier(),
						providerType: callbacks.getProviderType(),
						presets: callbacks.getPresets(),
						detectedImagePath,
						pluginStates: callbacks.getPluginStates(),
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
