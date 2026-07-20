import type { AssistantContext } from "@true-recall/core/ai/assistant";

interface ReviewSelectionBubbleDeps {
	isEnabled: () => boolean;
	getContext: (selectedText: string) => AssistantContext;
	onAsk: (anchorRect: DOMRect, context: AssistantContext) => () => void;
}

const MIN_CHARS = 3;
const REVIEW_CONTAINER = ".true-recall-review-card-container";

/**
 * Opens the Ask AI prompt when text is selected inside the review card.
 * The editor and global selection toolbars deliberately exclude the review
 * container, so this is a separate surface scoped to it.
 */
export class ReviewSelectionBubble {
	private disposePopover: (() => void) | null = null;

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
		if (this.disposePopover) return;
		const selection = activeWindow.getSelection();
		if (!selection || selection.isCollapsed) this.remove();
	};

	private onMouseUp = (event: MouseEvent): void => {
		const target = event.target;
		if (target instanceof Element && target.closest(".tr-ask-ai-popover")) {
			return;
		}
		// Defer so the selection is final after mouseup.
		activeWindow.setTimeout(() => this.maybeShow(), 0);
	};

	private maybeShow(): void {
		if (!this.deps.isEnabled()) return;
		const selection = activeWindow.getSelection();
		if (!selection || selection.isCollapsed || selection.rangeCount === 0)
			return;
		const text = selection.toString().trim();
		if (text.length < MIN_CHARS) return;

		const anchorNode = selection.anchorNode;
		const el =
			anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
		if (!el?.closest(REVIEW_CONTAINER)) return;
		if (el.closest(".tr-ask-ai-popover")) return;

		const rect = selection.getRangeAt(0).getBoundingClientRect();
		const context = this.deps.getContext(text);
		this.remove();
		const dispose = this.deps.onAsk(rect, context);
		this.disposePopover = () => {
			dispose();
			this.disposePopover = null;
		};
	}

	private remove(): void {
		this.disposePopover?.();
		this.disposePopover = null;
	}
}
