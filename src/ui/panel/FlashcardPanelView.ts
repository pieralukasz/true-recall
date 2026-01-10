/**
 * Flashcard Panel View
 * Main panel view for the Episteme plugin
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
import { FlashcardManager, OpenRouterService } from "../../services";
import { PanelStateManager } from "../../state";
import { PanelHeader } from "./PanelHeader";
import { PanelContent } from "./PanelContent";
import { PanelFooter } from "./PanelFooter";
import { MoveCardModal } from "../modals/MoveCardModal";
import type { FlashcardItem, FlashcardChange } from "../../types";
import type EpistemePlugin from "../../main";

/**
 * Main flashcard panel view
 */
export class FlashcardPanelView extends ItemView {
    private plugin: EpistemePlugin;
    private flashcardManager: FlashcardManager;
    private openRouterService: OpenRouterService;
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

    // Selection state for bulk move
    private selectedCardLineNumbers: Set<number> = new Set();

    constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
        super(leaf);
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.openRouterService = plugin.openRouterService;
        this.stateManager = new PanelStateManager();
    }

    getViewType(): string {
        return VIEW_TYPE_FLASHCARD_PANEL;
    }

    getDisplayText(): string {
        return "Episteme";
    }

    getIcon(): string {
        return "layers";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("episteme-panel");

        // Create container elements
        this.headerContainer = container.createDiv({ cls: "episteme-header-container" });
        this.contentContainer = container.createDiv({ cls: "episteme-content-container" });
        this.footerContainer = container.createDiv({ cls: "episteme-footer-container" });

        // Subscribe to state changes
        this.unsubscribe = this.stateManager.subscribe(() => this.render());

        // Register selection tracking for literature notes
        this.registerSelectionTracking();

        // Initial render
        await this.loadCurrentFile();
    }

    async onClose(): Promise<void> {
        // Cleanup subscriptions
        this.unsubscribe?.();

        // Note: Events registered via registerEvent() and registerDomEvent() are
        // automatically cleaned up by the Component base class

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

        // Clear selection when loading new file info
        this.selectedCardLineNumbers.clear();

        if (!file || file.extension !== "md") {
            this.stateManager.setFlashcardInfo(null);
            return;
        }

        const renderVersion = this.stateManager.incrementRenderVersion();

        try {
            // Load flashcard info and note type in parallel
            const [info, noteType] = await Promise.all([
                state.isFlashcardFile
                    ? this.flashcardManager.getFlashcardInfoDirect(file)
                    : this.flashcardManager.getFlashcardInfo(file),
                // Only get note type for source notes, not flashcard files
                state.isFlashcardFile
                    ? Promise.resolve("unknown" as const)
                    : this.flashcardManager.getNoteFlashcardType(file),
            ]);

            // Check for race condition
            if (!this.stateManager.isCurrentRender(renderVersion)) return;

            this.stateManager.setState({
                flashcardInfo: info,
                status: info?.exists ? "exists" : "none",
                noteFlashcardType: noteType,
            });
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
            onReviewFlashcards: () => {
                if (state.currentFile) {
                    void this.plugin.reviewNoteFlashcards(state.currentFile);
                }
            },
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
            noteFlashcardType: state.noteFlashcardType,
            handlers: {
                app: this.app,
                component: this,
                markdownRenderer: MarkdownRenderer,
                onEditCard: (card) => void this.handleEditCard(card),
                onCopyCard: (card) => void this.handleCopyCard(card),
                onDeleteCard: (card) => void this.handleRemoveCard(card),
                onMoveCard: (card) => void this.handleMoveCard(card),
                onChangeAccept: (change, index, accepted) => this.handleChangeAccept(change, index, accepted),
                onSelectAll: (selected) => this.handleSelectAll(selected),
                onEditSave: async (card, field, newContent) => void this.handleEditSave(card, field, newContent),
                onEditChange: (change, field, newContent) => this.handleDiffEditChange(change, field, newContent),
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
            // Note type for Seed vs Generate button
            noteFlashcardType: state.noteFlashcardType,
            // Selection info for bulk move button
            selectedCount: this.selectedCardLineNumbers.size,
            // Selection state for literature notes
            hasSelection: state.hasSelection,
            selectedText: state.selectedText,
            onGenerate: () => void this.handleGenerate(),
            onUpdate: () => void this.handleUpdate(),
            onApplyDiff: () => void this.handleApplyDiff(),
            onCancelDiff: () => void this.handleCancelDiff(),
            onMoveSelected: () => void this.handleMoveSelected(),
            onDeleteSelected: () => void this.handleDeleteSelected(),
        });
        this.footerComponent.render();
    }

    /**
     * Re-render only the footer (for selection count updates)
     * Use this instead of full render() when only footer data changes
     */
    private renderFooterOnly(): void {
        const state = this.stateManager.getState();
        this.footerComponent?.destroy();
        this.footerContainer.empty();
        this.footerComponent = new PanelFooter(this.footerContainer, {
            currentFile: state.currentFile,
            status: state.status,
            viewMode: state.viewMode,
            diffResult: state.diffResult,
            isFlashcardFile: state.isFlashcardFile,
            noteFlashcardType: state.noteFlashcardType,
            selectedCount: this.selectedCardLineNumbers.size,
            hasSelection: state.hasSelection,
            selectedText: state.selectedText,
            onGenerate: () => void this.handleGenerate(),
            onUpdate: () => void this.handleUpdate(),
            onApplyDiff: () => void this.handleApplyDiff(),
            onCancelDiff: () => void this.handleCancelDiff(),
            onMoveSelected: () => void this.handleMoveSelected(),
            onDeleteSelected: () => void this.handleDeleteSelected(),
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

        // ===== SELECTION-BASED GENERATION (ANY NOTE TYPE WITH SELECTION) =====
        if (state.hasSelection && state.selectedText) {
            await this.handleGenerateFromSelection();
            return;
        }

        // ===== FULL-FILE GENERATION (NO SELECTION) =====
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
            this.stateManager.finishProcessing(false);
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
            this.stateManager.finishProcessing(false);
        }

        // Load flashcard info outside main try-catch to avoid double error handling
        try {
            await this.loadFlashcardInfo();
        } catch (error) {
            console.error("Failed to load flashcard info after generation:", error);
        }
    }

    /**
     * Generate flashcards from selected text (any note type with selection)
     * Opens review modal before saving
     */
    private async handleGenerateFromSelection(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile || !state.hasSelection) {
            new Notice("Please select text in the note first.");
            return;
        }

        const userInstructions = this.footerComponent?.getInstructions() || "";
        this.stateManager.startProcessing();

        try {
            // Use selected text instead of full file content
            const selectedContent = state.selectedText;

            // Generate flashcards from selection only
            const flashcardsMarkdown = await this.openRouterService.generateFlashcards(
                selectedContent,
                userInstructions || undefined
            );

            if (flashcardsMarkdown.trim() === "NO_NEW_CARDS") {
                new Notice("No flashcard-worthy content found in selection.");
                this.stateManager.finishProcessing(false);
                return;
            }

            // Parse markdown into FlashcardItem array
            const { FlashcardParserService } = await import("../../services/flashcard/flashcard-parser.service");
            const parser = new FlashcardParserService();
            const generatedFlashcards = parser.extractFlashcards(flashcardsMarkdown);

            if (generatedFlashcards.length === 0) {
                new Notice("No flashcards were generated. Please try again.");
                this.stateManager.finishProcessing(false);
                return;
            }

            // Open review modal
            const { FlashcardReviewModal } = await import("../modals/FlashcardReviewModal");
            const modal = new FlashcardReviewModal(this.app, {
                initialFlashcards: generatedFlashcards,
                sourceNoteName: state.currentFile.basename,
                openRouterService: this.openRouterService,
            });

            const result = await modal.openAndWait();

            // Handle modal result
            if (result.cancelled || !result.flashcards || result.flashcards.length === 0) {
                new Notice("Flashcard generation cancelled");
                this.stateManager.finishProcessing(false);
                return;
            }

            // Convert FlashcardItem[] back to markdown format
            const finalMarkdown = this.flashcardsToMarkdown(result.flashcards);

            // Append to flashcard file
            await this.flashcardManager.appendFlashcards(
                state.currentFile,
                finalMarkdown
            );

            new Notice(`Saved ${result.flashcards.length} flashcard(s) from selection`);

        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Clear selection after generation
        this.stateManager.clearSelection();
        await this.loadFlashcardInfo();
    }

    /**
     * Helper: Convert FlashcardItem[] to markdown format
     */
    private flashcardsToMarkdown(flashcards: FlashcardItem[]): string {
        return flashcards
            .map(f => `${f.question} #flashcard\n${f.answer}`)
            .join("\n\n");
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

    private async handleEditSave(
        card: FlashcardItem,
        field: "question" | "answer",
        newContent: string
    ): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile || !state.flashcardInfo) return;

        const filePath = state.isFlashcardFile
            ? state.currentFile.path
            : this.flashcardManager.getFlashcardPath(state.currentFile);

        try {
            if (field === "question") {
                await this.flashcardManager.updateCardContent(
                    filePath,
                    card.lineNumber,
                    newContent,
                    card.answer
                );
            } else {
                await this.flashcardManager.updateCardContent(
                    filePath,
                    card.lineNumber,
                    card.question,
                    newContent
                );
            }

            new Notice("Flashcard updated");

            // Reload flashcard info to reflect changes
            await this.loadFlashcardInfo();
        } catch (error) {
            new Notice(`Failed to update flashcard: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private handleDiffEditChange(
        change: FlashcardChange,
        field: "question" | "answer",
        newContent: string
    ): void {
        // Update the FlashcardChange object in the diff result
        change[field] = newContent;

        // Re-render to show updated content
        this.render();
    }

    private async handleRemoveCard(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // Save scroll position before re-render
        const scrollPosition = this.contentContainer.scrollTop;

        const removed = state.isFlashcardFile
            ? await this.flashcardManager.removeFlashcardDirect(state.currentFile, card.lineNumber)
            : await this.flashcardManager.removeFlashcard(state.currentFile, card.lineNumber);

        if (removed) {
            new Notice("Flashcard removed");
            await this.loadFlashcardInfo();

            // Restore scroll position after render completes
            requestAnimationFrame(() => {
                this.contentContainer.scrollTop = scrollPosition;
            });
        } else {
            new Notice("Failed to remove flashcard from file");
        }
    }

    private async handleCopyCard(card: FlashcardItem): Promise<void> {
        const text = `Q: ${card.question}\nA: ${card.answer}`;
        await navigator.clipboard.writeText(text);
        new Notice("Copied to clipboard");
    }

    // ===== Move Card Handlers =====

    private async handleMoveCard(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo) return;

        if (!card.id) {
            new Notice("Cannot move card without UUID. Please regenerate flashcards.");
            return;
        }

        const sourceNoteName = await this.getSourceNoteNameFromFile();

        const modal = new MoveCardModal(this.app, {
            cardCount: 1,
            sourceNoteName: sourceNoteName,
            flashcardsFolder: this.plugin.settings.flashcardsFolder,
            cardQuestion: card.question,
            cardAnswer: card.answer,
        });

        const result = await modal.openAndWait();
        if (result.cancelled || !result.targetNotePath) return;

        try {
            await this.flashcardManager.moveCard(
                card.id,
                state.flashcardInfo.filePath,
                result.targetNotePath
            );
            new Notice("Card moved successfully");
            await this.loadFlashcardInfo();
        } catch (error) {
            new Notice(`Failed to move card: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ===== Selection Handlers for Bulk Move =====

    private handleToggleCardSelection(lineNumber: number): void {
        // Toggle selection state
        if (this.selectedCardLineNumbers.has(lineNumber)) {
            this.selectedCardLineNumbers.delete(lineNumber);
        } else {
            this.selectedCardLineNumbers.add(lineNumber);
        }
        // Only update footer (checkbox already toggled visually by browser)
        this.renderFooterOnly();
    }

    private handleClearSelection(): void {
        this.selectedCardLineNumbers.clear();
        this.render();
    }

    private async handleMoveSelected(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo || this.selectedCardLineNumbers.size === 0) return;

        // Get selected cards with valid IDs
        const selectedCards = state.flashcardInfo.flashcards.filter(
            (card) => this.selectedCardLineNumbers.has(card.lineNumber) && card.id
        );

        if (selectedCards.length === 0) {
            new Notice("No cards with valid UUIDs selected. Please regenerate flashcards.");
            return;
        }

        // Open modal with first card's content for suggestions
        const firstCard = selectedCards[0];
        if (!firstCard) return;

        const sourceNoteName = await this.getSourceNoteNameFromFile();

        const modal = new MoveCardModal(this.app, {
            cardCount: selectedCards.length,
            sourceNoteName: sourceNoteName,
            flashcardsFolder: this.plugin.settings.flashcardsFolder,
            cardQuestion: firstCard.question,
            cardAnswer: firstCard.answer,
        });

        const result = await modal.openAndWait();
        if (result.cancelled || !result.targetNotePath) return;

        // Move all selected cards (in reverse order to preserve line numbers)
        const sortedCards = [...selectedCards].sort((a, b) => b.lineNumber - a.lineNumber);
        let successCount = 0;

        for (const card of sortedCards) {
            if (!card.id) continue;
            try {
                await this.flashcardManager.moveCard(
                    card.id,
                    state.flashcardInfo.filePath,
                    result.targetNotePath
                );
                successCount++;
            } catch (error) {
                console.error(`Failed to move card ${card.id}:`, error);
            }
        }

        // Clear selection and refresh
        this.selectedCardLineNumbers.clear();
        new Notice(`Moved ${successCount} of ${selectedCards.length} cards`);
        await this.loadFlashcardInfo();
    }

    private async handleDeleteSelected(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo || !state.currentFile || this.selectedCardLineNumbers.size === 0) return;

        // Get selected cards sorted by line number descending (to preserve line numbers during deletion)
        const selectedCards = state.flashcardInfo.flashcards
            .filter(card => this.selectedCardLineNumbers.has(card.lineNumber))
            .sort((a, b) => b.lineNumber - a.lineNumber);

        if (selectedCards.length === 0) return;

        // Confirm deletion
        const confirmed = confirm(`Delete ${selectedCards.length} selected card(s)?`);
        if (!confirmed) return;

        // Delete cards from bottom to top (to preserve line numbers)
        let successCount = 0;
        for (const card of selectedCards) {
            try {
                const removed = state.isFlashcardFile
                    ? await this.flashcardManager.removeFlashcardDirect(state.currentFile, card.lineNumber)
                    : await this.flashcardManager.removeFlashcard(state.currentFile, card.lineNumber);

                if (removed) {
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to delete card at line ${card.lineNumber}:`, error);
            }
        }

        // Clear selection and refresh
        this.selectedCardLineNumbers.clear();
        new Notice(`Deleted ${successCount} of ${selectedCards.length} card(s)`);
        await this.loadFlashcardInfo();
    }

    // ===== Selection Tracking for All Notes =====

    /**
     * Track text selection in the active editor for all note types
     * Selection-based flashcard generation is now available for all notes
     */
    private registerSelectionTracking(): void {
        let selectionTimer: NodeJS.Timeout | null = null;

        // Function to update selection state
        const updateSelection = () => {
            const state = this.stateManager.getState();

            // Skip if no current file
            if (!state.currentFile) {
                // Only clear if there was a selection before
                if (state.hasSelection) {
                    this.stateManager.clearSelection();
                }
                return;
            }

            // Debounce selection updates to avoid excessive updates
            if (selectionTimer) {
                clearTimeout(selectionTimer);
            }

            selectionTimer = setTimeout(() => {
                const selection = this.getCurrentSelection();
                if (selection) {
                    this.stateManager.setSelectedText(selection);
                } else if (state.hasSelection) {
                    // Only clear if there was a selection before
                    this.stateManager.clearSelection();
                }
            }, 300);
        };

        // Register handler for active leaf changes using registerEvent for proper cleanup
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", updateSelection)
        );

        // Also listen to mouseup/keyup events on the document to detect text selection
        this.registerDomEvent(document, "mouseup", updateSelection);
        this.registerDomEvent(document, "keyup", updateSelection);
    }

    /**
     * Get currently selected text from the active editor
     */
    private getCurrentSelection(): string | null {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return null;

        const state = this.stateManager.getState();
        if (!state.currentFile || activeFile.path !== state.currentFile.path) {
            return null;
        }

        // Get selection from window
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;

        const selectedText = selection.toString().trim();
        return selectedText.length > 0 ? selectedText : null;
    }

    /**
     * Extract source_note name from the flashcard file
     */
    private async getSourceNoteNameFromFile(): Promise<string | undefined> {
        const state = this.stateManager.getState();
        if (!state.currentFile || !state.flashcardInfo) return undefined;

        const filePath = state.flashcardInfo.filePath;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return undefined;

        try {
            const content = await this.app.vault.read(file);
            const match = content.match(/source_link:\s*"\[\[(.+?)\]\]"/);
            return match?.[1];
        } catch {
            return undefined;
        }
    }
}
