import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { AssistantContext } from "@true-recall/core/ai/assistant";

interface ReviewSelectionBubbleDeps {
	isEnabled: () => boolean;
	getContext: (selectedText: string) => AssistantContext;
	onAsk: (anchorRect: DOMRect, context: AssistantContext) => void;
}

const MIN_CHARS = 3;
const REVIEW_CONTAINER = ".true-recall-review-card-container";

/**
 * A floating "Ask AI" bubble shown when text is selected inside the review card.
 * The editor and global selection toolbars deliberately exclude the review
 * container, so this is a separate surface scoped to it.
 */
export class ReviewSelectionBubble {
	private container: HTMLElement | null = null;

	constructor(private deps: ReviewSelectionBubbleDeps) {}

	register(): void {
		activeDocument.addEventListener("mouseup", this.onMouseUp);
		activeDocument.addEventListener("selectionchange", this.onSelectionChange);
	}

	unregister(): void {
		activeDocument.removeEventListener("mouseup", this.onMouseUp);
		activeDocument.removeEventListener(
			"selectionchange",
			this.onSelectionChange,
		);
		this.remove();
	}

	private onSelectionChange = (): void => {
		const selection = activeWindow.getSelection();
		if (!selection || selection.isCollapsed) this.remove();
	};

	private onMouseUp = (): void => {
		// Defer so the selection is final after mouseup.
		activeWindow.setTimeout(() => this.maybeShow(), 0);
	};

	private maybeShow(): void {
		if (!this.deps.isEnabled()) return;
		const selection = activeWindow.getSelection();
		if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
		const text = selection.toString().trim();
		if (text.length < MIN_CHARS) return;

		const anchorNode = selection.anchorNode;
		const el =
			anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
		if (!el?.closest(REVIEW_CONTAINER)) return;
		if (el.closest(".tr-ask-ai-popover, .tr-review-ask-bubble")) return;

		const rect = selection.getRangeAt(0).getBoundingClientRect();
		this.show(rect, text);
	}

	private show(rect: DOMRect, text: string): void {
		this.remove();
		const container = activeDocument.body.createDiv({
			cls: "tr-review-ask-bubble",
		});
		container.style.position = "absolute";
		container.style.zIndex = "var(--layer-menu)";
		const button = container.createEl("button", { text: "✨ Ask AI" });
		button.addEventListener("click", () => {
			const context = this.deps.getContext(text);
			this.remove();
			this.deps.onAsk(rect, context);
		});
		this.container = container;

		const virtualEl = { getBoundingClientRect: () => rect };
		void computePosition(virtualEl, container, {
			placement: "top-start",
			middleware: [offset(6), flip(), shift({ padding: 8 })],
		}).then(({ x, y }) => {
			if (!this.container) return;
			this.container.style.left = `${x}px`;
			this.container.style.top = `${y}px`;
		});
	}

	private remove(): void {
		this.container?.remove();
		this.container = null;
	}
}
