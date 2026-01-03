/**
 * Deck Selection Modal
 * Allows user to select a deck before starting review session
 */
import { App, Modal, Setting } from "obsidian";
import type { DeckInfo } from "../../types";

export interface DeckSelectionResult {
    cancelled: boolean;
    selectedDeck: string | null; // null means "All decks"
}

/**
 * Modal for selecting which deck to study
 */
export class DeckSelectionModal extends Modal {
    private decks: DeckInfo[];
    private resolvePromise: ((result: DeckSelectionResult) => void) | null = null;
    private hasSelected = false;

    constructor(app: App, decks: DeckInfo[]) {
        super(app);
        this.decks = decks;
    }

    /**
     * Open modal and return promise with selection result
     */
    async openAndWait(): Promise<DeckSelectionResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("episteme-deck-modal");

        // Title
        contentEl.createEl("h2", { text: "Select deck to study" });

        // Calculate total stats
        const totalStats = this.calculateTotalStats();

        // "All decks" option
        const allDecksSetting = new Setting(contentEl)
            .setName("All decks")
            .setDesc(`Study cards from all ${this.decks.length} decks`);

        // Add stats badge
        this.addStatsBadge(allDecksSetting.settingEl, totalStats.newCount, totalStats.dueCount);

        allDecksSetting.addButton((btn) =>
            btn
                .setButtonText("Study")
                .setCta()
                .onClick(() => {
                    this.selectDeck(null);
                })
        );

        // Divider
        if (this.decks.length > 0) {
            contentEl.createEl("hr", { cls: "episteme-deck-divider" });
        }

        // Individual decks
        for (const deck of this.decks) {
            const deckSetting = new Setting(contentEl)
                .setName(deck.name)
                .setDesc(`${deck.cardCount} cards total`);

            this.addStatsBadge(deckSetting.settingEl, deck.newCount, deck.dueCount);

            deckSetting.addButton((btn) =>
                btn.setButtonText("Study").onClick(() => {
                    this.selectDeck(deck.name);
                })
            );
        }

        // Empty state
        if (this.decks.length === 0) {
            contentEl.createEl("p", {
                text: "No flashcards found. Generate some flashcards first!",
                cls: "episteme-deck-empty",
            });
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        // If modal closed without selection, treat as cancelled
        if (!this.hasSelected && this.resolvePromise) {
            this.resolvePromise({ cancelled: true, selectedDeck: null });
            this.resolvePromise = null;
        }
    }

    private selectDeck(deckName: string | null): void {
        this.hasSelected = true;
        if (this.resolvePromise) {
            this.resolvePromise({ cancelled: false, selectedDeck: deckName });
            this.resolvePromise = null;
        }
        this.close();
    }

    private calculateTotalStats(): { newCount: number; dueCount: number } {
        return {
            newCount: this.decks.reduce((sum, d) => sum + d.newCount, 0),
            dueCount: this.decks.reduce((sum, d) => sum + d.dueCount, 0),
        };
    }

    private addStatsBadge(
        settingEl: HTMLElement,
        newCount: number,
        dueCount: number
    ): void {
        const statsContainer = settingEl.createDiv({ cls: "episteme-deck-stats" });

        if (newCount > 0) {
            statsContainer.createSpan({
                cls: "episteme-stat-badge episteme-stat-new",
                text: `${newCount} new`,
            });
        }

        if (dueCount > 0) {
            statsContainer.createSpan({
                cls: "episteme-stat-badge episteme-stat-due",
                text: `${dueCount} due`,
            });
        }

        if (newCount === 0 && dueCount === 0) {
            statsContainer.createSpan({
                cls: "episteme-stat-badge episteme-stat-done",
                text: "all done",
            });
        }
    }
}
