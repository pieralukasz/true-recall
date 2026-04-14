import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { TFile } from "obsidian";
import { h, render } from "preact";

import type { ToolbarButtonConfig } from "@true-recall/core/types";

import { SelectionToolbar, type ToolbarActions } from "./SelectionToolbar";

export interface GlobalSelectionToolbarCallbacks {
	actions: ToolbarActions;
	getButtons: () => ToolbarButtonConfig[];
	hasApiKey: () => boolean;
	hasActivePreset: () => boolean;
	isEnabled: () => boolean;
	getSourceFile: (range: Range) => TFile | null;
}

const MIN_SELECTION_LENGTH = 3;

export class GlobalSelectionToolbar {
	private container: HTMLDivElement | null = null;
	private currentText = "";
	private rafId = 0;

	constructor(private callbacks: GlobalSelectionToolbarCallbacks) {}

	register(): void {
		document.addEventListener("selectionchange", this.onSelectionChange);
		document.addEventListener("mouseup", this.onMouseUp);
		document.addEventListener("keydown", this.onKeyDown);
	}

	destroy(): void {
		document.removeEventListener("selectionchange", this.onSelectionChange);
		document.removeEventListener("mouseup", this.onMouseUp);
		document.removeEventListener("keydown", this.onKeyDown);
		cancelAnimationFrame(this.rafId);
		this.removeToolbar();
	}

	private onSelectionChange = (): void => {
		cancelAnimationFrame(this.rafId);
		this.rafId = requestAnimationFrame(() => this.checkSelection());
	};

	private onMouseUp = (): void => {
		cancelAnimationFrame(this.rafId);
		this.rafId = requestAnimationFrame(() => this.checkSelection());
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
		const el = node instanceof Element ? node : node.parentElement;
		return !!el?.closest(".cm-editor");
	}

	private isInsideExcludedContainer(node: Node): boolean {
		const el = node instanceof Element ? node : node.parentElement;
		return !!el?.closest(
			".true-recall-review-card-container, .ep-card-browser, .true-recall-selection-toolbar-container",
		);
	}

	private showToolbar(text: string, range: Range): void {
		if (!this.container) {
			this.container = document.createElement("div");
			this.container.className = "true-recall-selection-toolbar-container";
			document.body.appendChild(this.container);
			this.container.addEventListener("mousedown", (e) => e.stopPropagation());
		}

		const sourceFile = this.callbacks.getSourceFile(range);

		render(
			h(SelectionToolbar, {
				selectedText: text,
				buttons: this.callbacks.getButtons(),
				actions: {
					...this.callbacks.actions,
					onGenerate: (_t: string) =>
						this.callbacks.actions.onGenerate(text, sourceFile),
					onVocab: (_t: string) =>
						this.callbacks.actions.onVocab(text, sourceFile),
					onQuickAdd: (_t: string) =>
						this.callbacks.actions.onQuickAdd(text, sourceFile),
					onDismiss: () => this.removeToolbar(),
				},
				hasApiKey: this.callbacks.hasApiKey(),
				hasActivePreset: this.callbacks.hasActivePreset(),
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
