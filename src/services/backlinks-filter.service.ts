/**
 * Service to hide flashcard files from Obsidian's Linked mentions panel
 */
import { FLASHCARD_CONFIG } from "../constants";

export class BacklinksFilterService {
    private observer: MutationObserver | null = null;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly DEBOUNCE_MS = 100;

    enable(): void {
        if (this.observer) return;

        this.observer = new MutationObserver(() => {
            this.debouncedHide();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Hide existing entries immediately
        this.hideFlashcardEntries();
    }

    disable(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.observer?.disconnect();
        this.observer = null;
        this.showAllEntries();
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
            // Target tree items that contain file matches
            const items = pane.querySelectorAll(".tree-item");

            items.forEach((item) => {
                const titleEl = item.querySelector(".tree-item-inner");
                const text = titleEl?.textContent || "";

                if (text.includes(FLASHCARD_CONFIG.filePrefix)) {
                    (item as HTMLElement).style.display = "none";
                } else {
                    // Make sure non-flashcard items are visible
                    (item as HTMLElement).style.display = "";
                }
            });
        });
    }

    private showAllEntries(): void {
        const items = document.querySelectorAll(".backlink-pane .tree-item");
        items.forEach((item) => {
            (item as HTMLElement).style.display = "";
        });
    }
}
