import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";

import type { SelectModifiers } from "../helpers/browser-selection";
import type { BrowserCard } from "../types";

interface KeyboardNavOptions {
	/** Root element of the browser; scopes shortcuts to its workspace leaf. */
	rootRef: RefObject<HTMLElement>;
	cards: BrowserCard[];
	selectedCount: number;
	previewCardId: string | null;
	onSelect: (cardId: string, modifiers?: SelectModifiers) => void;
	onPreview: (card: BrowserCard) => void;
	onClearSelection: () => void;
	onSelectAll: () => void;
	onFocusSearch: () => void;
}

interface KeyTarget {
	tagName?: string;
	isContentEditable?: boolean;
}

/** Typing in inputs and editors must not trigger browser shortcuts. */
export function isEditableTarget(target: KeyTarget | null): boolean {
	if (!target) return false;
	return (
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT" ||
		target.isContentEditable === true
	);
}

interface LeafLike {
	closest(
		selector: string,
	): { classList: { contains(c: string): boolean } } | null;
}

/**
 * The listener sits on the document, so without this check j/k, Space and
 * Cmd+A would also act on the browser while another pane has focus. Obsidian
 * marks the focused leaf with `mod-active`. Outside a leaf (tests, embeds) the
 * browser is treated as active.
 */
export function isInActiveLeaf(root: LeafLike | null): boolean {
	if (!root) return false;
	const leaf = root.closest(".workspace-leaf");
	return leaf ? leaf.classList.contains("mod-active") : true;
}

export function useKeyboardNav(options: KeyboardNavOptions) {
	// Registered once; the handler reads the latest options.
	const optionsRef = useRef(options);
	optionsRef.current = options;

	useEffect(() => {
		// Effects run after mount, so the root is attached. Its own document
		// is the right one in popout windows.
		const doc =
			optionsRef.current.rootRef.current?.ownerDocument ?? activeDocument;

		function handleKeyDown(e: KeyboardEvent) {
			const {
				rootRef,
				cards,
				selectedCount,
				previewCardId,
				onSelect,
				onPreview,
				onClearSelection,
				onSelectAll,
				onFocusSearch,
			} = optionsRef.current;

			if (!isInActiveLeaf(rootRef.current)) return;
			if (isEditableTarget(e.target as KeyTarget | null)) return;

			const currentIndex = cards.findIndex((c) => c.id === previewCardId);

			switch (e.key) {
				case "ArrowDown":
				case "j": {
					e.preventDefault();
					const next = cards[Math.min(currentIndex + 1, cards.length - 1)];
					if (next) onPreview(next);
					break;
				}

				case "ArrowUp":
				case "k": {
					e.preventDefault();
					const prev = cards[Math.max(currentIndex - 1, 0)];
					if (prev) onPreview(prev);
					break;
				}

				case " ": {
					e.preventDefault();
					if (previewCardId) onSelect(previewCardId, { ctrlKey: true });
					break;
				}

				case "Escape": {
					if (selectedCount > 0) onClearSelection();
					break;
				}

				case "a": {
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault();
						onSelectAll();
					}
					break;
				}

				case "/": {
					e.preventDefault();
					onFocusSearch();
					break;
				}
			}
		}

		doc.addEventListener("keydown", handleKeyDown);
		return () => doc.removeEventListener("keydown", handleKeyDown);
	}, []);
}
