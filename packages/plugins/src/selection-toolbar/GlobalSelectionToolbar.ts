import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { TFile } from "obsidian";
import { h, render } from "preact";

import type { ToolbarButtonConfig } from "@true-recall/core/types";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";
import type { AIProviderType } from "@true-recall/core/types/settings.types";

import {
	SelectionToolbar,
	type ToolbarActions,
	type ToolbarTier,
} from "./SelectionToolbar";

export interface GlobalSelectionToolbarCallbacks {
	actions: ToolbarActions;
	getButtons: () => ToolbarButtonConfig[];
	tier: () => ToolbarTier;
	getProviderType: () => AIProviderType;
	isEnabled: () => boolean;
	getPluginStates: () => Record<string, boolean>;
	getSourceFile: (range: Range) => TFile | null;
	getPresets: () => GenerationPreset[];
	resolveMarkdown?: (range: Range, fallback: string) => Promise<string>;
}

const MIN_SELECTION_LENGTH = 3;

export class GlobalSelectionToolbar {
	private container: HTMLDivElement | null = null;
	private currentText = "";
	private rafId = 0;

	constructor(private callbacks: GlobalSelectionToolbarCallbacks) {}

	register(): void {
		activeDocument.addEventListener("selectionchange", this.onSelectionChange);
		activeDocument.addEventListener("mouseup", this.onMouseUp);
		activeDocument.addEventListener("keydown", this.onKeyDown);
	}

	destroy(): void {
		activeDocument.removeEventListener(
			"selectionchange",
			this.onSelectionChange,
		);
		activeDocument.removeEventListener("mouseup", this.onMouseUp);
		activeDocument.removeEventListener("keydown", this.onKeyDown);
		cancelAnimationFrame(this.rafId);
		this.removeToolbar();
	}

	private onSelectionChange = (): void => {
		cancelAnimationFrame(this.rafId);
		this.rafId = window.requestAnimationFrame(() => this.checkSelection());
	};

	private onMouseUp = (): void => {
		cancelAnimationFrame(this.rafId);
		this.rafId = window.requestAnimationFrame(() => this.checkSelection());
	};

	private onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === "Escape") this.removeToolbar();
	};

	private checkSelection(): void {
		if (!this.callbacks.isEnabled()) {
			this.removeToolbar();
			return;
		}

		const sel = window.getSelection();
		if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
			this.removeToolbar();
			return;
		}

		const text = sel.toString().trim();
		if (text.length < MIN_SELECTION_LENGTH) {
			this.removeToolbar();
			return;
		}

		const range = sel.getRangeAt(0);

		if (this.isInsideCmEditor(range.commonAncestorContainer)) {
			this.removeToolbar();
			return;
		}

		if (this.isInsideExcludedContainer(range.commonAncestorContainer)) {
			this.removeToolbar();
			return;
		}

		if (this.container && this.currentText === text) {
			this.positionToolbar(range);
			return;
		}

		this.currentText = text;
		this.showToolbar(text, range);
	}

	private isInsideCmEditor(node: Node): boolean {
		const el = node.instanceOf(Element) ? node : node.parentElement;
		return !!el?.closest(".cm-editor");
	}

	private isInsideExcludedContainer(node: Node): boolean {
		const el = node.instanceOf(Element) ? node : node.parentElement;
		return !!el?.closest(
			".true-recall-review-card-container, .ep-card-browser, .true-recall-selection-toolbar-container, .tr-quick-editor-view, .tr-modal-quick-editor, .tr-popout-view",
		);
	}

	private showToolbar(text: string, range: Range): void {
		if (!this.container) {
			this.container = createDiv();
			this.container.className = "true-recall-selection-toolbar-container";
			activeDocument.body.appendChild(this.container);
			this.container.addEventListener("mousedown", (e) => e.stopPropagation());
		}

		const sourceFile = this.callbacks.getSourceFile(range);
		const capturedRange = range.cloneRange();
		const { resolveMarkdown } = this.callbacks;
		const resolvedTextPromise: Promise<string> = resolveMarkdown
			? resolveMarkdown(capturedRange, text).catch(() => text)
			: Promise.resolve(text);

		const actions = this.callbacks.actions;

		render(
			h(SelectionToolbar, {
				selectedText: text,
				buttons: this.callbacks.getButtons(),
				actions: {
					...actions,
					onPreset: async (presetId: string) => {
						const md = await resolvedTextPromise;
						return actions.onPreset(presetId, md, sourceFile);
					},
					onQuickAdd: async () => {
						const md = await resolvedTextPromise;
						return actions.onQuickAdd(md, sourceFile);
					},
					onEdit: () => {
						void resolvedTextPromise.then((md) => actions.onEdit(md));
					},
					onNewNote: async () => {
						const md = await resolvedTextPromise;
						return actions.onNewNote(md);
					},
					onAppend: async () => {
						const md = await resolvedTextPromise;
						return actions.onAppend(md);
					},
					onDismiss: () => this.removeToolbar(),
				},
				tier: this.callbacks.tier(),
				providerType: this.callbacks.getProviderType(),
				presets: this.callbacks.getPresets(),
				pluginStates: this.callbacks.getPluginStates(),
			}),
			this.container,
		);

		this.positionToolbar(range);
	}

	private positionToolbar(range: Range): void {
		if (!this.container) return;

		const rect = range.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			this.removeToolbar();
			return;
		}

		const virtualEl = {
			getBoundingClientRect: () => rect,
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
}
