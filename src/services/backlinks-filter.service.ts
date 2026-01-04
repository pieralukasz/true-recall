/**
 * Service to hide flashcard files from Obsidian's Linked mentions panel
 */
import { FLASHCARD_CONFIG } from "../constants";

export class BacklinksFilterService {
	private observer: MutationObserver | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly DEBOUNCE_MS = 100;
	private shouldUpdateCount = true;

	setUpdateCount(enabled: boolean): void {
		this.shouldUpdateCount = enabled;
		// If disabling, restore original counts
		if (!enabled) {
			this.restoreOriginalCounts();
		} else if (this.observer) {
			// If enabling and already active, trigger update
			this.hideFlashcardEntries();
		}
	}

	enable(): void {
		if (this.observer) return;

		// Check if backlinks pane exists before setting up observer
		// On mobile, the UI structure may be different or unavailable
		const backlinksPane = document.querySelector(".backlink-pane");
		if (!backlinksPane) {
			// Backlinks pane not found - this is normal on mobile or when panel is closed
			// We'll still set up the observer to catch when it appears
		}

		this.observer = new MutationObserver(() => {
			this.debouncedHide();
		});

		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		// Hide existing entries immediately if pane exists
		if (backlinksPane) {
			this.hideFlashcardEntries();
		}
	}

	disable(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.observer?.disconnect();
		this.observer = null;
		this.showAllEntries();
		this.restoreOriginalCounts();
	}

	private debouncedHide(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.hideFlashcardEntries();
		}, this.DEBOUNCE_MS);
	}

	private hideFlashcardEntries(): void {
		// Target the backlinks pane specifically
		const backlinksPane = document.querySelectorAll(".backlink-pane");

		backlinksPane.forEach((pane) => {
			// Find the "Linked mentions" header
			const linkedMentionsHeader = this.findLinkedMentionsHeader(pane);
			if (!linkedMentionsHeader) return;

			// Find the results container (next sibling after header)
			const resultsContainer = linkedMentionsHeader.nextElementSibling;
			if (!resultsContainer?.classList.contains("search-result-container")) return;

			// Target tree items with search-result class
			const items = resultsContainer.querySelectorAll(".tree-item.search-result");
			let hiddenCount = 0;

			items.forEach((item) => {
				const titleEl = item.querySelector(".tree-item-inner");
				const text = titleEl?.textContent || "";

				if (text.includes(FLASHCARD_CONFIG.filePrefix)) {
					(item as HTMLElement).style.display = "none";
					hiddenCount++;
				} else {
					// Make sure non-flashcard items are visible
					(item as HTMLElement).style.display = "";
				}
			});

			// Update the count in the header if enabled
			if (this.shouldUpdateCount) {
				this.updateMentionsCount(linkedMentionsHeader, hiddenCount);
			}
		});
	}

	private findLinkedMentionsHeader(pane: Element): Element | null {
		// Search for the .tree-item-self containing "Linked mentions" text
		const headers = Array.from(pane.querySelectorAll(".tree-item-self"));
		for (const header of headers) {
			const inner = header.querySelector(".tree-item-inner");
			if (inner?.textContent?.includes("Linked mentions")) {
				return header;
			}
		}
		return null;
	}

	private updateMentionsCount(header: Element, hiddenCount: number): void {
		// Find the count element within the header
		const countEl = header.querySelector(".tree-item-flair");
		if (!countEl) return;

		// Store the original value if not already stored
		if (!countEl.hasAttribute("data-original-count")) {
			countEl.setAttribute("data-original-count", countEl.textContent || "0");
		}

		const originalCount = parseInt(countEl.getAttribute("data-original-count") || "0");
		const newCount = Math.max(0, originalCount - hiddenCount);
		countEl.textContent = newCount.toString();
	}

	private showAllEntries(): void {
		const items = document.querySelectorAll(".backlink-pane .tree-item");
		items.forEach((item) => {
			(item as HTMLElement).style.display = "";
		});
	}

	private restoreOriginalCounts(): void {
		const countElements = document.querySelectorAll(".backlink-pane [data-original-count]");
		countElements.forEach((el) => {
			const original = el.getAttribute("data-original-count");
			if (original) {
				el.textContent = original;
				el.removeAttribute("data-original-count");
			}
		});
	}
}
