import { useEffect } from "preact/hooks";

import type { BrowserCard } from "../types";

interface KeyboardNavOptions {
	cards: BrowserCard[];
	selectedIds: Set<string>;
	previewCardId: string | null;
	onSelect: (
		cardId: string,
		event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
	) => void;
	onPreview: (card: BrowserCard) => void;
	onClearSelection: () => void;
	onSelectAll: () => void;
	onFocusSearch: () => void;
}

export function useKeyboardNav({
	cards,
	selectedIds,
	previewCardId,
	onSelect,
	onPreview,
	onClearSelection,
	onSelectAll,
	onFocusSearch,
}: KeyboardNavOptions) {
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Don't intercept if typing in an input
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}

			const currentIndex = cards.findIndex((c) => c.id === previewCardId);

			switch (e.key) {
				case "ArrowDown":
				case "j": {
					e.preventDefault();
					const nextIdx = Math.min(currentIndex + 1, cards.length - 1);
					const next = cards[nextIdx];
					if (next) onPreview(next);
					break;
				}

				case "ArrowUp":
				case "k": {
					e.preventDefault();
					const prevIdx = Math.max(currentIndex - 1, 0);
					const prev = cards[prevIdx];
					if (prev) onPreview(prev);
					break;
				}

				case " ": {
					e.preventDefault();
					if (previewCardId) {
						onSelect(previewCardId, { ctrlKey: true });
					}
					break;
				}

				case "Escape": {
					if (selectedIds.size > 0) {
						onClearSelection();
					}
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

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		cards,
		selectedIds,
		previewCardId,
		onSelect,
		onPreview,
		onClearSelection,
		onSelectAll,
		onFocusSearch,
	]);
}
