import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { setIcon } from "obsidian";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

interface ReviewSelectionBubbleDeps {
	isEnabled: () => boolean;
	getContext: (selectedText: string) => AssistantContext;
	onAsk: (anchorRect: DOMRect, context: AssistantContext) => () => void;
}

const MIN_CHARS = 3;
const REVIEW_CONTAINER = ".true-recall-review-card-container";
const BUBBLE = "tr-review-ask-bubble";
const POPOVER = "tr-ask-ai-popover";

function isTextInput(el: Element | null): boolean {
	return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Whether a finished text selection in review should offer "Ask AI". */
export function isAskableSelection(selection: {
	text: string;
	inReviewCard: boolean;
	inTextInput: boolean;
	inAiSurface: boolean;
}): boolean {
	return (
		selection.text.trim().length >= MIN_CHARS &&
		selection.inReviewCard &&
		!selection.inTextInput &&
		!selection.inAiSurface
	);
}

/**
 * A small "Ask AI" button over text selected inside the review card. Selecting
 * text only shows the button; the AI opens when the user clicks it, so
 * highlighting while reading never pulls the chat or a prompt over the card.
 * The editor and global selection toolbars deliberately exclude the review
 * container, so this is a separate surface scoped to it.
 */
export class ReviewSelectionBubble {
	private bubble: HTMLElement | null = null;
	private disposePopover: (() => void) | null = null;
	/** Set on every selection change; a click that leaves it false did not
	 * select anything new, so it must not bring a dismissed button back. */
	private selectionChanged = false;

	constructor(private deps: ReviewSelectionBubbleDeps) {}

	register(): void {
		activeDocument.addEventListener("mouseup", this.onMouseUp);
		activeDocument.addEventListener("selectionchange", this.onSelectionChange);
		activeDocument.addEventListener("pointerdown", this.onPointerDown, true);
		// Window capture: Obsidian's keymap (also window capture, registered
		// first) stops Escape before it reaches the document, for example when
		// the card field's embedded editor has focus.
		activeWindow.addEventListener("keydown", this.onKeyDown, true);
	}

	unregister(): void {
		activeDocument.removeEventListener("mouseup", this.onMouseUp);
		activeDocument.removeEventListener(
			"selectionchange",
			this.onSelectionChange,
		);
		activeDocument.removeEventListener("pointerdown", this.onPointerDown, true);
		activeWindow.removeEventListener("keydown", this.onKeyDown, true);
		this.hideBubble();
		this.closePopover();
	}

	private onSelectionChange = (): void => {
		this.selectionChanged = true;
		const selection = activeWindow.getSelection();
		if (!selection || selection.isCollapsed) this.hideBubble();
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") this.hideBubble();
	};

	/** Any click outside the button dismisses it, also on parts of the review
	 * that cannot be selected (a click there keeps the old selection). */
	private onPointerDown = (event: PointerEvent): void => {
		const target = event.target;
		if (target instanceof Node && this.bubble?.contains(target)) return;
		this.selectionChanged = false;
		this.hideBubble();
	};

	private onMouseUp = (event: MouseEvent): void => {
		const target = event.target;
		if (
			target instanceof Element &&
			target.closest(`.${POPOVER}, .${BUBBLE}`)
		) {
			return;
		}
		// Defer so the selection is final after mouseup.
		window.setTimeout(() => this.maybeShow(), 0);
	};

	private maybeShow(): void {
		if (!this.deps.isEnabled() || !this.selectionChanged) return;
		const selection = activeWindow.getSelection();
		if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
			return;
		}
		const text = selection.toString().trim();
		const anchorNode = selection.anchorNode;
		const el =
			anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
		const askable = isAskableSelection({
			text,
			inReviewCard: !!el?.closest(REVIEW_CONTAINER),
			inTextInput:
				!!el?.closest("input, textarea") ||
				isTextInput(activeDocument.activeElement),
			inAiSurface: !!el?.closest(`.${POPOVER}`),
		});
		if (!askable) return;
		this.showBubble(selection.getRangeAt(0).getBoundingClientRect(), text);
	}

	private showBubble(rect: DOMRect, text: string): void {
		this.hideBubble();
		const bubble = activeDocument.body.createDiv({ cls: BUBBLE });
		const button = bubble.createEl("button", {
			cls: "tr-review-ask-bubble__button",
			attr: { type: "button", "aria-label": "Ask AI about the selection" },
		});
		setIcon(
			button.createSpan({ cls: "tr-review-ask-bubble__icon" }),
			"sparkles",
		);
		button.createSpan({ text: "Ask AI" });
		// Keep the selection alive: a plain mousedown would collapse it first.
		button.addEventListener("mousedown", (e) => e.preventDefault());
		button.addEventListener("click", () => {
			const context = this.deps.getContext(text);
			this.hideBubble();
			this.closePopover();
			const dispose = this.deps.onAsk(rect, context);
			this.disposePopover = () => {
				dispose();
				this.disposePopover = null;
			};
		});
		this.bubble = bubble;

		const virtualEl = { getBoundingClientRect: () => rect };
		void computePosition(virtualEl, bubble, {
			strategy: "fixed",
			placement: "top",
			middleware: [offset(6), flip(), shift({ padding: 8 })],
		}).then(({ x, y }) => {
			if (this.bubble !== bubble) return;
			bubble.setCssStyles({ left: `${x}px`, top: `${y}px` });
		});
	}

	private hideBubble(): void {
		this.bubble?.remove();
		this.bubble = null;
	}

	private closePopover(): void {
		this.disposePopover?.();
		this.disposePopover = null;
	}
}
