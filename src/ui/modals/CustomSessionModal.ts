/**
 * Custom Session Modal
 * Allows user to select custom review session type and filters
 */
import { App, Modal, Setting, TFile } from "obsidian";
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../types";

export type CustomSessionType = "current-note" | "created-today" | "select-file";

export interface CustomSessionResult {
    cancelled: boolean;
    sessionType: CustomSessionType | null;
    sourceNoteFilter?: string;
    filePathFilter?: string;
    createdTodayOnly?: boolean;
    ignoreDailyLimits: boolean;
}

export interface CustomSessionModalOptions {
    currentNoteName: string | null;
    allCards: FSRSFlashcardItem[];
    flashcardFiles: TFile[];
}

interface CardCounts {
    total: number;
    newCount: number;
    dueCount: number;
}

/**
 * Modal for selecting custom review session type
 */
export class CustomSessionModal extends Modal {
    private options: CustomSessionModalOptions;
    private resolvePromise: ((result: CustomSessionResult) => void) | null = null;
    private hasSelected = false;

    constructor(app: App, options: CustomSessionModalOptions) {
        super(app);
        this.options = options;
    }

    /**
     * Open modal and return promise with selection result
     */
    async openAndWait(): Promise<CustomSessionResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("episteme-custom-session-modal");

        contentEl.createEl("h2", { text: "Custom Review Session" });

        const counts = this.calculateCounts();

        // Option 1: Current note
        this.renderOption(
            contentEl,
            "current-note",
            "Review cards from current note",
            this.options.currentNoteName
                ? `Cards linked to "${this.options.currentNoteName}"`
                : "No note currently open",
            counts.currentNote,
            !this.options.currentNoteName || counts.currentNote.total === 0
        );

        // Option 2: New cards created today
        this.renderOption(
            contentEl,
            "created-today",
            "Review today's new cards",
            "Cards created today that are new or due",
            counts.createdToday,
            counts.createdToday.total === 0
        );

        // Divider and file list
        if (this.options.flashcardFiles.length > 0) {
            contentEl.createEl("hr", { cls: "episteme-modal-divider" });
            contentEl.createEl("h3", { text: "Or select a flashcard file:" });
            this.renderFileList(contentEl, counts.byFile);
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        if (!this.hasSelected && this.resolvePromise) {
            this.resolvePromise({
                cancelled: true,
                sessionType: null,
                ignoreDailyLimits: false,
            });
            this.resolvePromise = null;
        }
    }

    private calculateCounts(): {
        currentNote: CardCounts;
        createdToday: CardCounts;
        byFile: Map<string, { file: TFile } & CardCounts>;
    } {
        const now = new Date();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const cards = this.options.allCards;

        // Helper: only new OR due cards (no future scheduled)
        const isAvailable = (card: FSRSFlashcardItem): boolean => {
            if (card.fsrs.state === State.New) return true;
            return new Date(card.fsrs.due) <= now;
        };

        // Current note cards
        const currentNoteCards = this.options.currentNoteName
            ? cards.filter(
                  (c) =>
                      c.sourceNoteName === this.options.currentNoteName &&
                      isAvailable(c)
              )
            : [];

        // Created today cards
        const createdTodayCards = cards.filter((c) => {
            const createdAt = c.fsrs.createdAt;
            return (
                createdAt &&
                createdAt >= todayStart.getTime() &&
                isAvailable(c)
            );
        });

        // By file
        const byFile = new Map<string, { file: TFile } & CardCounts>();
        for (const file of this.options.flashcardFiles) {
            const fileCards = cards.filter(
                (c) => c.filePath === file.path && isAvailable(c)
            );
            byFile.set(file.path, {
                file,
                total: fileCards.length,
                newCount: fileCards.filter((c) => c.fsrs.state === State.New)
                    .length,
                dueCount: fileCards.filter((c) => c.fsrs.state !== State.New)
                    .length,
            });
        }

        return {
            currentNote: {
                total: currentNoteCards.length,
                newCount: currentNoteCards.filter(
                    (c) => c.fsrs.state === State.New
                ).length,
                dueCount: currentNoteCards.filter(
                    (c) => c.fsrs.state !== State.New
                ).length,
            },
            createdToday: {
                total: createdTodayCards.length,
                newCount: createdTodayCards.filter(
                    (c) => c.fsrs.state === State.New
                ).length,
                dueCount: createdTodayCards.filter(
                    (c) => c.fsrs.state !== State.New
                ).length,
            },
            byFile,
        };
    }

    private renderOption(
        container: HTMLElement,
        type: CustomSessionType,
        name: string,
        desc: string,
        counts: CardCounts,
        disabled: boolean
    ): void {
        const setting = new Setting(container).setName(name).setDesc(desc);

        this.addStatsBadge(setting.settingEl, counts.newCount, counts.dueCount);

        setting.addButton((btn) => {
            btn.setButtonText(counts.total > 0 ? "Study" : "No cards").setDisabled(
                disabled
            );
            if (!disabled) {
                btn.setCta();
                btn.onClick(() => this.selectOption(type));
            }
        });
    }

    private renderFileList(
        container: HTMLElement,
        byFile: Map<string, { file: TFile } & CardCounts>
    ): void {
        const listEl = container.createDiv({ cls: "episteme-file-list" });

        if (byFile.size === 0) {
            listEl.createDiv({
                cls: "episteme-file-list-empty",
                text: "No flashcard files found",
            });
            return;
        }

        // Sort files by name
        const sortedEntries = Array.from(byFile.entries()).sort((a, b) =>
            a[1].file.basename.localeCompare(b[1].file.basename)
        );

        for (const [filePath, data] of sortedEntries) {
            // Remove "flashcards_" prefix for display
            const displayName = data.file.basename.replace(/^flashcards_/, "");

            const setting = new Setting(listEl)
                .setName(displayName)
                .setDesc(`${data.total} available cards`);

            this.addStatsBadge(setting.settingEl, data.newCount, data.dueCount);

            setting.addButton((btn) => {
                btn.setButtonText(data.total > 0 ? "Study" : "No cards").setDisabled(
                    data.total === 0
                );
                if (data.total > 0) {
                    btn.onClick(() => this.selectFile(filePath));
                }
            });
        }
    }

    private addStatsBadge(
        settingEl: HTMLElement,
        newCount: number,
        dueCount: number
    ): void {
        const statsContainer = settingEl.createDiv({
            cls: "episteme-deck-stats",
        });

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
                text: "no cards",
            });
        }
    }

    private selectOption(type: CustomSessionType): void {
        this.hasSelected = true;
        if (this.resolvePromise) {
            const result: CustomSessionResult = {
                cancelled: false,
                sessionType: type,
                ignoreDailyLimits: true,
            };

            if (type === "current-note" && this.options.currentNoteName) {
                result.sourceNoteFilter = this.options.currentNoteName;
            } else if (type === "created-today") {
                result.createdTodayOnly = true;
            }

            this.resolvePromise(result);
            this.resolvePromise = null;
        }
        this.close();
    }

    private selectFile(filePath: string): void {
        this.hasSelected = true;
        if (this.resolvePromise) {
            this.resolvePromise({
                cancelled: false,
                sessionType: "select-file",
                filePathFilter: filePath,
                ignoreDailyLimits: true,
            });
            this.resolvePromise = null;
        }
        this.close();
    }
}
