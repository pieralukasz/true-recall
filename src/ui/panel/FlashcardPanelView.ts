/**
 * Flashcard Panel View
 * Main panel view for the Shadow Anki plugin
 * Uses PanelStateManager and UI components for clean architecture
 */
import {
    ItemView,
    WorkspaceLeaf,
    TFile,
    Notice,
    MarkdownRenderer,
} from "obsidian";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../../constants";
import { FlashcardManager, OpenRouterService, AnkiService } from "../../services";
import { PanelStateManager } from "../../state";
import { PanelHeader } from "./PanelHeader";
import { PanelContent } from "./PanelContent";
import { PanelFooter } from "./PanelFooter";
import type { FlashcardItem, FlashcardChange } from "../../types";
import type ShadowAnkiPlugin from "../../main";

/**
 * Main flashcard panel view
 */
export class FlashcardPanelView extends ItemView {
    private plugin: ShadowAnkiPlugin;
    private flashcardManager: FlashcardManager;
    private openRouterService: OpenRouterService;
    private ankiService: AnkiService;
    private stateManager: PanelStateManager;

    // UI Components
    private headerComponent: PanelHeader | null = null;
    private contentComponent: PanelContent | null = null;
    private footerComponent: PanelFooter | null = null;

    // Container elements
    private headerContainer!: HTMLElement;
    private contentContainer!: HTMLElement;
    private footerContainer!: HTMLElement;

    // State subscription
    private unsubscribe: (() => void) | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ShadowAnkiPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.openRouterService = plugin.openRouterService;
        this.ankiService = plugin.ankiService;
        this.stateManager = new PanelStateManager();
    }

    getViewType(): string {
        return VIEW_TYPE_FLASHCARD_PANEL;
    }

    getDisplayText(): string {
        return "Shadow Anki";
    }

    getIcon(): string {
        return "layers";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("shadow-anki-panel");

        // Create container elements
        this.headerContainer = container.createDiv({ cls: "shadow-anki-header-container" });
        this.contentContainer = container.createDiv({ cls: "shadow-anki-content-container" });
        this.footerContainer = container.createDiv({ cls: "shadow-anki-footer-container" });

        // Subscribe to state changes
        this.unsubscribe = this.stateManager.subscribe(() => this.render());

        // Initial render
        await this.loadCurrentFile();
    }

    async onClose(): Promise<void> {
        // Cleanup subscriptions
        this.unsubscribe?.();

        // Cleanup components
        this.headerComponent?.destroy();
        this.contentComponent?.destroy();
        this.footerComponent?.destroy();
    }

    /**
     * Called when active file changes
     */
    async handleFileChange(file: TFile | null): Promise<void> {
        const state = this.stateManager.getState();

        // Don't reset if same file or processing
        if (state.currentFile?.path === file?.path || state.status === "processing") {
            return;
        }

        this.stateManager.setCurrentFile(file);
        await this.loadFlashcardInfo();
    }

    // ===== Private Methods =====

    private async loadCurrentFile(): Promise<void> {
        const file = this.app.workspace.getActiveFile();
        this.stateManager.setCurrentFile(file);
        await this.loadFlashcardInfo();
    }

    private async loadFlashcardInfo(): Promise<void> {
        const state = this.stateManager.getState();
        const file = state.currentFile;

        if (!file || file.extension !== "md") {
            this.stateManager.setFlashcardInfo(null);
            return;
        }

        const renderVersion = this.stateManager.incrementRenderVersion();

        try {
            const info = state.isFlashcardFile
                ? await this.flashcardManager.getFlashcardInfoDirect(file)
                : await this.flashcardManager.getFlashcardInfo(file);

            // Check for race condition
            if (!this.stateManager.isCurrentRender(renderVersion)) return;

            this.stateManager.setFlashcardInfo(info);
        } catch (error) {
            console.error("Error loading flashcard info:", error);
        }
    }

    private render(): void {
        const state = this.stateManager.getState();

        // Render Header
        this.headerComponent?.destroy();
        this.headerContainer.empty();
        this.headerComponent = new PanelHeader(this.headerContainer, {
            currentFile: state.currentFile,
            status: state.status,
            onOpenFlashcardFile: () => void this.handleOpenFlashcardFile(),
        });
        this.headerComponent.render();

        // Render Content
        this.contentComponent?.destroy();
        this.contentContainer.empty();
        this.contentComponent = new PanelContent(this.contentContainer, {
            currentFile: state.currentFile,
            status: state.status,
            viewMode: state.viewMode,
            flashcardInfo: state.flashcardInfo,
            diffResult: state.diffResult,
            isFlashcardFile: state.isFlashcardFile,
            handlers: {
                app: this.app,
                component: this,
                markdownRenderer: MarkdownRenderer,
                onEditCard: (card) => void this.handleEditCard(card),
                onCopyCard: (card) => void this.handleCopyCard(card),
                onDeleteCard: (card) => void this.handleRemoveCard(card),
                onChangeAccept: (change, index, accepted) => this.handleChangeAccept(change, index, accepted),
                onSelectAll: (selected) => this.handleSelectAll(selected),
            },
        });
        this.contentComponent.render();

        // Render Footer
        this.footerComponent?.destroy();
        this.footerContainer.empty();
        this.footerComponent = new PanelFooter(this.footerContainer, {
            currentFile: state.currentFile,
            status: state.status,
            viewMode: state.viewMode,
            diffResult: state.diffResult,
            isFlashcardFile: state.isFlashcardFile,
            onGenerate: () => void this.handleGenerate(),
            onUpdate: () => void this.handleUpdate(),
            onApplyDiff: () => void this.handleApplyDiff(),
            onCancelDiff: () => void this.handleCancelDiff(),
        });
        this.footerComponent.render();
    }

    // ===== Action Handlers =====

    private async handleGenerate(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        if (!this.plugin.settings.openRouterApiKey) {
            new Notice("Please configure your OpenRouter API key in settings.");
            return;
        }

        const userInstructions = this.footerComponent?.getInstructions() || "";
        this.stateManager.startProcessing();

        try {
            const content = await this.app.vault.read(state.currentFile);
            const flashcards = await this.openRouterService.generateFlashcards(
                content,
                userInstructions || undefined
            );

            if (flashcards.trim() === "NO_NEW_CARDS") {
                new Notice("No flashcard-worthy content found in this note.");
                this.stateManager.finishProcessing(false);
                return;
            }

            await this.flashcardManager.createFlashcardFile(state.currentFile, flashcards);

            if (this.plugin.settings.storeSourceContent) {
                await this.flashcardManager.updateSourceContent(state.currentFile, content);
            }

            new Notice(`Generated flashcards for ${state.currentFile.basename}`);

            if (this.plugin.settings.autoSyncToAnki) {
                await this.handleSync();
            }
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        await this.loadFlashcardInfo();
    }

    private async handleUpdate(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        if (!this.plugin.settings.openRouterApiKey) {
            new Notice("Please configure your OpenRouter API key in settings.");
            return;
        }

        const userInstructions = this.footerComponent?.getInstructions() || "";
        this.stateManager.startProcessing();

        try {
            const info = await this.flashcardManager.getFlashcardInfo(state.currentFile);
            const content = await this.app.vault.read(state.currentFile);
            const oldNoteContent = await this.flashcardManager.extractSourceContent(state.currentFile);

            const diffResult = await this.openRouterService.generateFlashcardsDiff(
                content,
                info.flashcards,
                userInstructions || undefined,
                oldNoteContent ?? undefined
            );

            if (diffResult.changes.length === 0) {
                new Notice("No changes needed. Flashcards are up to date.");
                this.stateManager.finishProcessing(true);
                return;
            }

            this.stateManager.setDiffResult(diffResult);
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
            this.stateManager.finishProcessing(true);
        }
    }

    private async handleApplyDiff(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile || !state.diffResult) return;

        const acceptedChanges = state.diffResult.changes.filter((c) => c.accepted);
        if (acceptedChanges.length === 0) {
            new Notice("No changes selected");
            return;
        }

        try {
            await this.flashcardManager.applyDiffChanges(
                state.currentFile,
                state.diffResult.changes,
                state.diffResult.existingFlashcards
            );

            if (this.plugin.settings.storeSourceContent) {
                const currentContent = await this.app.vault.read(state.currentFile);
                await this.flashcardManager.updateSourceContent(state.currentFile, currentContent);
            }

            const counts = {
                new: acceptedChanges.filter((c) => c.type === "NEW").length,
                modified: acceptedChanges.filter((c) => c.type === "MODIFIED").length,
                deleted: acceptedChanges.filter((c) => c.type === "DELETED").length,
            };

            const parts = [];
            if (counts.new > 0) parts.push(`${counts.new} new`);
            if (counts.modified > 0) parts.push(`${counts.modified} modified`);
            if (counts.deleted > 0) parts.push(`${counts.deleted} deleted`);
            new Notice(`Applied: ${parts.join(", ")}`);

            if (this.plugin.settings.autoSyncToAnki) {
                await this.handleSync();
            }
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        this.stateManager.clearDiff();
        await this.loadFlashcardInfo();
    }

    private handleCancelDiff(): void {
        this.stateManager.clearDiff();
    }

    private handleChangeAccept(change: FlashcardChange, index: number, accepted: boolean): void {
        const state = this.stateManager.getState();
        if (!state.diffResult) return;

        const changes = [...state.diffResult.changes];
        if (changes[index]) {
            changes[index] = { ...changes[index], accepted };
            this.stateManager.setDiffResult({
                ...state.diffResult,
                changes,
            });
        }
    }

    private handleSelectAll(selected: boolean): void {
        const state = this.stateManager.getState();
        if (!state.diffResult) return;

        const changes = state.diffResult.changes.map((c) => ({ ...c, accepted: selected }));
        this.stateManager.setDiffResult({
            ...state.diffResult,
            changes,
        });
    }

    private async handleSync(): Promise<void> {
        try {
            const commandIds = [
                "obsidian-to-anki-plugin:scan-vault",
                "obsidian-to-anki:scan-vault",
            ];

            let executed = false;
            for (const commandId of commandIds) {
                // @ts-expect-error - executeCommandById exists but not in types
                const result = this.app.commands.executeCommandById(commandId);
                if (result !== false) {
                    executed = true;
                    break;
                }
            }

            if (executed) {
                new Notice("Triggered Anki sync");
            } else {
                new Notice("obsidian-to-anki plugin not found. Please install it for Anki sync.");
            }
        } catch {
            new Notice("Failed to sync. Is obsidian-to-anki plugin installed?");
        }
    }

    private async handleOpenFlashcardFile(): Promise<void> {
        const state = this.stateManager.getState();
        if (state.currentFile) {
            await this.flashcardManager.openFlashcardFile(state.currentFile);
        }
    }

    private async handleEditCard(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        if (state.isFlashcardFile) {
            await this.flashcardManager.openFileAtLine(state.currentFile, card.lineNumber);
        } else {
            await this.flashcardManager.openFlashcardFileAtLine(state.currentFile, card.lineNumber);
        }
    }

    private async handleRemoveCard(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        if (card.ankiId) {
            const ankiAvailable = await this.ankiService.isAvailable();
            if (ankiAvailable) {
                const deleted = await this.ankiService.deleteNotes([card.ankiId]);
                new Notice(deleted ? "Removed from Anki" : "Could not remove from Anki (card may already be deleted)");
            } else {
                new Notice("Anki not running - removing from file only");
            }
        }

        const removed = state.isFlashcardFile
            ? await this.flashcardManager.removeFlashcardDirect(state.currentFile, card.lineNumber)
            : await this.flashcardManager.removeFlashcard(state.currentFile, card.lineNumber);

        if (removed) {
            new Notice("Flashcard removed");
            await this.loadFlashcardInfo();
        } else {
            new Notice("Failed to remove flashcard from file");
        }
    }

    private async handleCopyCard(card: FlashcardItem): Promise<void> {
        const text = `Q: ${card.question}\nA: ${card.answer}`;
        await navigator.clipboard.writeText(text);
        new Notice("Copied to clipboard");
    }
}
