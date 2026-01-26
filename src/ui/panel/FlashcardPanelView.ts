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
import { FlashcardManager, OpenRouterService, getEventBus } from "../../services";
import { CollectService } from "../../services/flashcard/collect.service";
import { PanelStateManager } from "../../state";
import { Panel } from "../components/Panel";
import { PanelContent } from "./PanelContent";
import { PanelFooter } from "./PanelFooter";
import { PanelHeader } from "./PanelHeader";
import { SelectionFooter } from "./SelectionFooter";
import { MoveCardModal } from "../modals/MoveCardModal";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { FlashcardEditorModal } from "../modals/FlashcardEditorModal";
import type { FlashcardItem, FlashcardChange } from "../../types";
import type { CardAddedEvent, CardRemovedEvent, CardUpdatedEvent, BulkChangeEvent } from "../../types/events.types";
import { createDefaultFSRSData } from "../../types";
import type EpistemePlugin from "../../main";

/**
 * Main flashcard panel view
 */
export class FlashcardPanelView extends ItemView {
    private plugin: EpistemePlugin;
    private flashcardManager: FlashcardManager;
    private openRouterService: OpenRouterService;
    private stateManager: PanelStateManager;
    private collectService: CollectService;

    // UI Components
    private panelComponent: Panel | null = null;
    private headerComponent: PanelHeader | null = null;
    private contentComponent: PanelContent | null = null;
    private footerComponent: PanelFooter | null = null;
    private selectionFooterComponent: SelectionFooter | null = null;

    // Container elements (obtained from Panel)
    private headerContainer!: HTMLElement;
    private contentContainer!: HTMLElement;
    private footerContainer!: HTMLElement;

    // Native header action elements
    private reviewAction: HTMLElement | null = null;
    private openFileAction: HTMLElement | null = null;
    private deleteAllAction: HTMLElement | null = null;

    // State subscription
    private unsubscribe: (() => void) | null = null;

    // Event subscriptions for cross-component reactivity
    private eventUnsubscribers: (() => void)[] = [];

    // Selection timer for debouncing
    private selectionTimer: ReturnType<typeof setTimeout> | null = null;

    // Editor change timer for real-time #flashcard tag detection
    private editorChangeTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
        super(leaf);
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.openRouterService = plugin.openRouterService;
        this.stateManager = new PanelStateManager();
        this.collectService = new CollectService();
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
        const container = this.containerEl.children[1];
        if (!(container instanceof HTMLElement)) return;
        container.empty();

        // Create Panel component (header is native Obsidian header)
        this.panelComponent = new Panel(container, {
            showFooter: true,
        });
        this.panelComponent.render();

        // Create header container (before content)
        this.headerContainer = container.createDiv();

        // Get container elements from Panel
        this.contentContainer = this.panelComponent.getContentContainer();
        const footerContainer = this.panelComponent.getFooterContainer();
        if (!footerContainer) {
            console.error("[FlashcardPanelView] Footer container not available");
            return;
        }
        this.footerContainer = footerContainer;

        // Subscribe to state changes - update render and header actions
        this.unsubscribe = this.stateManager.subscribe(() => {
            this.render();
            this.updateHeaderActions();
        });

        // Subscribe to EventBus for cross-component reactivity
        this.subscribeToEvents();

        // Register selection tracking for literature notes
        this.registerSelectionTracking();

        // Register editor change tracking for real-time #flashcard tag detection
        this.registerEditorChangeTracking();

        // Initial render
        await this.loadCurrentFile();
    }

    /**
     * Update native header actions based on current state
     */
    private updateHeaderActions(): void {
        const state = this.stateManager.getState();

        // Remove existing actions
        if (this.reviewAction) {
            this.reviewAction.remove();
            this.reviewAction = null;
        }
        if (this.openFileAction) {
            this.openFileAction.remove();
            this.openFileAction = null;
        }
        if (this.deleteAllAction) {
            this.deleteAllAction.remove();
            this.deleteAllAction = null;
        }

        // Only show actions when flashcards exist
        if (state.status === "exists" && state.currentFile) {
            // Delete all flashcards
            this.deleteAllAction = this.addAction(
                "trash-2",
                "Delete all flashcards",
                () => void this.handleDeleteAllFlashcards()
            );

            // Open flashcard file
            this.openFileAction = this.addAction(
                "file-text",
                "Open flashcard file",
                () => void this.handleOpenFlashcardFile()
            );

            // Review flashcards
            this.reviewAction = this.addAction(
                "brain",
                "Review flashcards",
                () => void this.plugin.reviewNoteFlashcards(state.currentFile!)
            );
        }
    }

    async onClose(): Promise<void> {
        // Cleanup subscriptions
        this.unsubscribe?.();

        // Cleanup EventBus subscriptions
        this.eventUnsubscribers.forEach((unsub) => unsub());
        this.eventUnsubscribers = [];

        // Cleanup selection timer
        if (this.selectionTimer) {
            clearTimeout(this.selectionTimer);
            this.selectionTimer = null;
        }

        // Cleanup editor change timer
        if (this.editorChangeTimer) {
            clearTimeout(this.editorChangeTimer);
            this.editorChangeTimer = null;
        }

        // Remove native header actions
        if (this.reviewAction) {
            this.reviewAction.remove();
            this.reviewAction = null;
        }
        if (this.openFileAction) {
            this.openFileAction.remove();
            this.openFileAction = null;
        }
        if (this.deleteAllAction) {
            this.deleteAllAction.remove();
            this.deleteAllAction = null;
        }

        // Note: Events registered via registerEvent() and registerDomEvent() are
        // automatically cleaned up by the Component base class

        // Cleanup components
        this.panelComponent?.destroy();
        this.headerComponent?.destroy();
        this.contentComponent?.destroy();
        this.footerComponent?.destroy();
        this.selectionFooterComponent?.destroy();
    }

    /**
     * Subscribe to EventBus events for cross-component reactivity
     */
    private subscribeToEvents(): void {
        const eventBus = getEventBus();

        // When a card is added, reload flashcard info
        const unsubAdded = eventBus.on<CardAddedEvent>("card:added", () => {
            void this.loadFlashcardInfo();
        });
        this.eventUnsubscribers.push(unsubAdded);

        // When a card is removed, reload flashcard info
        const unsubRemoved = eventBus.on<CardRemovedEvent>("card:removed", () => {
            void this.loadFlashcardInfo();
        });
        this.eventUnsubscribers.push(unsubRemoved);

        // When card content is updated, reload flashcard info
        const unsubUpdated = eventBus.on<CardUpdatedEvent>("card:updated", (event) => {
            // Only reload for content changes (question/answer), not FSRS updates
            if (!event.changes.question && !event.changes.answer) return;
            void this.loadFlashcardInfo();
        });
        this.eventUnsubscribers.push(unsubUpdated);

        // Handle bulk changes (e.g., from diff apply)
        const unsubBulk = eventBus.on<BulkChangeEvent>("cards:bulk-change", () => {
            void this.loadFlashcardInfo();
        });
        this.eventUnsubscribers.push(unsubBulk);
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
        this.stateManager.exitSelectionMode();

        if (!file || file.extension !== "md") {
            this.stateManager.setFlashcardInfo(null);
            this.stateManager.setUncollectedInfo(0);
            return;
        }

        const renderVersion = this.stateManager.incrementRenderVersion();

        try {
            // Load flashcard info, note type, and file content in parallel
            const [info, noteType, content] = await Promise.all([
                state.isFlashcardFile
                    ? this.flashcardManager.getFlashcardInfoDirect(file)
                    : this.flashcardManager.getFlashcardInfo(file),
                // Only get note type for source notes, not flashcard files
                state.isFlashcardFile
                    ? Promise.resolve("unknown" as const)
                    : this.flashcardManager.getNoteFlashcardType(file),
                // Read file content for uncollected flashcard detection
                this.app.vault.read(file),
            ]);

            // Check for race condition
            if (!this.stateManager.isCurrentRender(renderVersion)) return;

            // Extract source note name for flashcard files
            const sourceNoteName = state.isFlashcardFile
                ? await this.getSourceNoteNameFromFile() ?? null
                : null;

            // Detect uncollected flashcards (only for source notes, not flashcard files)
            const uncollectedCount = state.isFlashcardFile
                ? 0
                : this.collectService.countFlashcardTags(content);

            this.stateManager.setState({
                flashcardInfo: info,
                status: info?.exists ? "exists" : "none",
                noteFlashcardType: noteType,
                sourceNoteName,
                uncollectedCount,
                hasUncollectedFlashcards: uncollectedCount > 0,
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
            flashcardInfo: state.flashcardInfo,
            cardsWithFsrs: this.getCardsWithFsrs(),
            hasUncollectedFlashcards: state.hasUncollectedFlashcards,
            uncollectedCount: state.uncollectedCount,
            selectionMode: state.selectionMode,
            selectedCount: state.selectedCardIds.size,
            onAdd: () => void this.handleAddFlashcard(),
            onGenerate: () => void this.handleGenerate(),
            onUpdate: () => void this.handleUpdate(),
            onCollect: () => void this.handleCollect(),
            onExitSelectionMode: () => this.stateManager.exitSelectionMode(),
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
            selectionMode: state.selectionMode,
            selectedCardIds: state.selectedCardIds,
            expandedCardIds: state.expandedCardIds,
            cardsWithFsrs: this.getCardsWithFsrs(),
            handlers: {
                app: this.app,
                component: this,
                markdownRenderer: MarkdownRenderer,
                onEditCard: (card) => void this.handleEditCard(card),
                onEditButton: (card) => void this.handleEditButton(card),
                onCopyCard: (card) => void this.handleCopyCard(card),
                onDeleteCard: (card) => void this.handleRemoveCard(card),
                onMoveCard: (card) => void this.handleMoveCard(card),
                onChangeAccept: (change, index, accepted) => this.handleChangeAccept(change, index, accepted),
                onSelectAll: (selected) => this.handleSelectAll(selected),
                onEditSave: async (card, field, newContent) => void this.handleEditSave(card, field, newContent),
                onEditChange: (change, field, newContent) => this.handleDiffEditChange(change, field, newContent),
                onToggleExpand: (cardId) => this.stateManager.toggleCardExpanded(cardId),
                onToggleSelect: (cardId) => this.stateManager.toggleCardSelection(cardId),
                onEnterSelectionMode: (cardId) => this.stateManager.enterSelectionMode(cardId),
            },
        });
        this.contentComponent.render();

        // Render Footer (different based on mode)
        this.footerComponent?.destroy();
        this.selectionFooterComponent?.destroy();
        this.footerContainer.empty();

        if (state.selectionMode === "selecting") {
            // Selection mode footer
            this.selectionFooterComponent = new SelectionFooter(this.footerContainer, {
                selectedCount: state.selectedCardIds.size,
                onMove: () => void this.handleMoveSelected(),
                onDelete: () => void this.handleDeleteSelected(),
            });
            this.selectionFooterComponent.render();
        } else if (state.viewMode === "diff" && state.diffResult) {
            // Diff mode footer (keep existing)
            this.footerComponent = new PanelFooter(this.footerContainer, {
                currentFile: state.currentFile,
                status: state.status,
                viewMode: state.viewMode,
                diffResult: state.diffResult,
                isFlashcardFile: state.isFlashcardFile,
                noteFlashcardType: state.noteFlashcardType,
                selectedCount: 0,
                hasSelection: state.hasSelection,
                selectedText: state.selectedText,
                hasUncollectedFlashcards: state.hasUncollectedFlashcards,
                uncollectedCount: state.uncollectedCount,
                onGenerate: () => void this.handleGenerate(),
                onUpdate: () => void this.handleUpdate(),
                onApplyDiff: () => void this.handleApplyDiff(),
                onCancelDiff: () => void this.handleCancelDiff(),
                onMoveSelected: () => void this.handleMoveSelected(),
                onDeleteSelected: () => void this.handleDeleteSelected(),
                onAddFlashcard: () => void this.handleAddFlashcard(),
                onCollect: () => void this.handleCollect(),
            });
            this.footerComponent.render();
        }
        // Normal mode: no footer (actions in header)
    }

    /**
     * Get cards with FSRS data from flashcard manager
     */
    private getCardsWithFsrs(): FSRSFlashcardItem[] {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo?.flashcards) return [];

        // Get all FSRS cards and filter to current file's cards
        const allFsrsCards = this.flashcardManager.getAllFSRSCards();
        const cardIds = new Set(state.flashcardInfo.flashcards.map(c => c.id));

        return allFsrsCards.filter(c => cardIds.has(c.id));
    }

    // ===== Action Handlers =====

    private async handleGenerate(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // Check if store is ready
        if (!this.flashcardManager.hasStore()) {
            new Notice("Flashcard store not ready. Please restart Obsidian.");
            return;
        }

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
                userInstructions || undefined,
                this.plugin.settings.customGeneratePrompt || undefined
            );

            if (flashcards.trim() === "NO_NEW_CARDS") {
                new Notice("No flashcard-worthy content found in this note.");
                this.stateManager.finishProcessing(false);
                return;
            }

            // Parse flashcards and generate IDs
            const { FlashcardParserService } = await import("../../services/flashcard/flashcard-parser.service");
            const parser = new FlashcardParserService();
            const parsedFlashcards = parser.extractFlashcards(flashcards);

            // Generate IDs for each card
            const flashcardsWithIds = parsedFlashcards.map((f) => ({
                id: f.id || crypto.randomUUID(),
                question: f.question,
                answer: f.answer,
            }));

            // Save directly to SQL (no MD file created)
            await this.flashcardManager.saveFlashcardsToSql(
                state.currentFile,
                flashcardsWithIds
            );

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

        // Check if store is ready
        if (!this.flashcardManager.hasStore()) {
            new Notice("Flashcard store not ready. Please restart Obsidian.");
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
                userInstructions || undefined,
                this.plugin.settings.customGeneratePrompt || undefined
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

            // Prepare flashcards with IDs for SQL storage
            const flashcardsWithIds = result.flashcards.map((f) => ({
                id: f.id || crypto.randomUUID(),
                question: f.question,
                answer: f.answer,
            }));

            // Save directly to SQL (no MD file created)
            await this.flashcardManager.saveFlashcardsToSql(
                state.currentFile,
                flashcardsWithIds
            );

            new Notice(`Saved ${result.flashcards.length} flashcard(s) from selection`);
            this.stateManager.finishProcessing(false);
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Clear selection after generation
        this.stateManager.clearSelection();
        await this.loadFlashcardInfo();
    }

    /**
     * Helper: Convert FlashcardItem[] to markdown format
     * Generates block IDs for cards that don't have them
     */
    private flashcardsToMarkdown(flashcards: FlashcardItem[]): string {
        return flashcards
            .map(f => {
                // Generate block ID if not present
                const cardId = f.id || crypto.randomUUID();
                return `${f.question} #flashcard\n${f.answer}\n^${cardId}`;
            })
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
                oldNoteContent ?? undefined,
                this.plugin.settings.customUpdatePrompt || undefined
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

        // Check if store is ready (needed for new cards)
        if (!this.flashcardManager.hasStore()) {
            new Notice("Flashcard store not ready. Please restart Obsidian.");
            return;
        }

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
            await this.flashcardManager.openFileAtCard(state.currentFile, card.id);
        } else {
            await this.flashcardManager.openFlashcardFileAtCard(state.currentFile, card.id);
        }
    }

    private async handleEditButton(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // TODO: In the future, avoid full re-render - aim for targeted DOM update instead
        const scrollPosition = this.contentContainer.scrollTop;

        // Use card directly - it already has question/answer from the panel UI
        // No need to look up from SQLite which may return cards with empty content
        const modal = new FlashcardEditorModal(this.app, {
            mode: "edit",
            card: {
                ...card,
                fsrs: createDefaultFSRSData(card.id),
                projects: [],
            },
            currentFilePath: state.currentFile.path,
            sourceNoteName: state.currentFile.basename,
        });

        const result = await modal.openAndWait();
        if (result.cancelled) return;

        // Update card content using card.id
        try {
            this.flashcardManager.updateCardContent(
                card.id,
                result.question,
                result.answer
            );

            // If source was changed, move the card
            if (result.newSourceNotePath) {
                await this.flashcardManager.moveCard(
                    card.id,
                    result.newSourceNotePath
                );
                new Notice("Flashcard updated and moved");
            } else {
                new Notice("Flashcard updated");
            }

            await this.loadFlashcardInfo();

            requestAnimationFrame(() => {
                this.contentContainer.scrollTop = scrollPosition;
            });
        } catch (error) {
            new Notice(`Failed to update flashcard: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleEditSave(
        card: FlashcardItem,
        field: "question" | "answer",
        newContent: string
    ): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile || !state.flashcardInfo) return;

        // TODO: In the future, avoid full re-render - aim for targeted DOM update instead
        const scrollPosition = this.contentContainer.scrollTop;

        try {
            if (field === "question") {
                this.flashcardManager.updateCardContent(
                    card.id,
                    newContent,
                    card.answer
                );
            } else {
                this.flashcardManager.updateCardContent(
                    card.id,
                    card.question,
                    newContent
                );
            }

            new Notice("Flashcard updated");

            // Reload flashcard info to reflect changes
            await this.loadFlashcardInfo();

            requestAnimationFrame(() => {
                this.contentContainer.scrollTop = scrollPosition;
            });
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

        const removed = await this.flashcardManager.removeFlashcardById(card.id);

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
            cardQuestion: card.question,
            cardAnswer: card.answer,
        });

        const result = await modal.openAndWait();
        if (result.cancelled || !result.targetNotePath) return;

        try {
            await this.flashcardManager.moveCard(
                card.id,
                result.targetNotePath
            );
            new Notice("Card moved successfully");
            await this.loadFlashcardInfo();
        } catch (error) {
            new Notice(`Failed to move card: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ===== Selection Handlers for Bulk Operations =====

    private async handleMoveSelected(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo || state.selectedCardIds.size === 0) return;

        // Get selected cards with valid IDs
        const selectedCards = state.flashcardInfo.flashcards.filter(
            (card) => state.selectedCardIds.has(card.id)
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
            cardQuestion: firstCard.question,
            cardAnswer: firstCard.answer,
        });

        const result = await modal.openAndWait();
        if (result.cancelled || !result.targetNotePath) return;

        // Move all selected cards
        let successCount = 0;

        for (const card of selectedCards) {
            try {
                await this.flashcardManager.moveCard(
                    card.id,
                    result.targetNotePath
                );
                successCount++;
            } catch (error) {
                console.error(`Failed to move card ${card.id}:`, error);
            }
        }

        // Clear selection and refresh
        this.stateManager.exitSelectionMode();
        new Notice(`Moved ${successCount} of ${selectedCards.length} cards`);
        await this.loadFlashcardInfo();
    }

    private async handleDeleteSelected(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo || !state.currentFile || state.selectedCardIds.size === 0) return;

        // Get selected cards by ID
        const selectedCards = state.flashcardInfo.flashcards
            .filter(card => state.selectedCardIds.has(card.id));

        if (selectedCards.length === 0) return;

        // Confirm deletion
        const confirmed = confirm(`Delete ${selectedCards.length} selected card(s)?`);
        if (!confirmed) return;

        // Delete cards by ID (order doesn't matter with ID-based deletion)
        let successCount = 0;
        for (const card of selectedCards) {
            try {
                const removed = await this.flashcardManager.removeFlashcardById(card.id);

                if (removed) {
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to delete card ${card.id}:`, error);
            }
        }

        // Clear selection and refresh
        this.stateManager.exitSelectionMode();
        new Notice(`Deleted ${successCount} of ${selectedCards.length} card(s)`);
        await this.loadFlashcardInfo();
    }

    /**
     * Add a single flashcard manually via modal
     */
    private async handleAddFlashcard(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // Get or create sourceUid for the current file
        const frontmatterService = this.flashcardManager.getFrontmatterService();
        let sourceUid = await frontmatterService.getSourceNoteUid(state.currentFile);
        if (!sourceUid) {
            sourceUid = frontmatterService.generateUid();
            await frontmatterService.setSourceNoteUid(state.currentFile, sourceUid);
        }

        const modal = new FlashcardEditorModal(this.app, {
            mode: "add",
            currentFilePath: state.currentFile.path,
            sourceNoteName: state.currentFile.basename,
            prefillQuestion: "question",
            prefillAnswer: "answer",
        });

        const result = await modal.openAndWait();
        if (result.cancelled) return;

        try {
            await this.flashcardManager.addSingleFlashcard(
                result.question,
                result.answer,
                sourceUid
            );
            new Notice("Flashcard added!");
            await this.loadFlashcardInfo();
        } catch (error) {
            console.error("Error adding flashcard:", error);
            new Notice(`Failed to add flashcard: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleDeleteAllFlashcards(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo || state.flashcardInfo.flashcards.length === 0) return;

        const count = state.flashcardInfo.flashcards.length;
        const confirmed = confirm(`Delete all ${count} flashcard(s) for this note?`);
        if (!confirmed) return;

        let successCount = 0;
        for (const card of state.flashcardInfo.flashcards) {
            try {
                const removed = await this.flashcardManager.removeFlashcardById(card.id);
                if (removed) {
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to delete card ${card.id}:`, error);
            }
        }

        new Notice(`Deleted ${successCount} flashcard(s)`);
        await this.loadFlashcardInfo();
    }

    /**
     * Collect flashcards from markdown (marked with #flashcard tag)
     * Saves them to SQL and removes the #flashcard tags from the file
     */
    private async handleCollect(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // Check if store is ready
        if (!this.flashcardManager.hasStore()) {
            new Notice("Flashcard store not ready. Please restart Obsidian.");
            return;
        }

        try {
            const content = await this.app.vault.read(state.currentFile);
            const result = this.collectService.collect(content);

            if (result.collectedCount === 0) {
                new Notice("No flashcards to collect");
                return;
            }

            // Save flashcards to SQL
            await this.flashcardManager.saveFlashcardsToSql(
                state.currentFile,
                result.flashcards.map((f) => ({
                    id: f.id || crypto.randomUUID(),
                    question: f.question,
                    answer: f.answer,
                }))
            );

            // Update markdown file based on setting
            const contentToSave = this.plugin.settings.removeFlashcardContentAfterCollect
                ? result.newContentWithoutFlashcards
                : result.newContent;
            await this.app.vault.modify(state.currentFile, contentToSave);

            new Notice(`Collected ${result.collectedCount} flashcard(s)`);
            await this.loadFlashcardInfo();
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ===== Selection Tracking for All Notes =====

    /**
     * Track text selection in the active editor for all note types
     * Selection-based flashcard generation is now available for all notes
     */
    private registerSelectionTracking(): void {
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
            if (this.selectionTimer) {
                clearTimeout(this.selectionTimer);
            }

            this.selectionTimer = setTimeout(() => {
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

    // ===== Editor Change Tracking for Real-time #flashcard Detection =====

    /**
     * Register editor change tracking for real-time #flashcard tag detection
     * Uses debouncing to avoid performance issues
     */
    private registerEditorChangeTracking(): void {
        this.registerEvent(
            this.app.workspace.on("editor-change", () => {
                // Debounce - wait 500ms after last change
                if (this.editorChangeTimer) {
                    clearTimeout(this.editorChangeTimer);
                }

                this.editorChangeTimer = setTimeout(() => {
                    void this.checkUncollectedFlashcards();
                }, 500);
            })
        );
    }

    /**
     * Lightweight check for uncollected flashcards (only updates tag count)
     * Called on editor changes with debouncing
     */
    private async checkUncollectedFlashcards(): Promise<void> {
        const state = this.stateManager.getState();
        const file = state.currentFile;

        if (!file || file.extension !== "md" || state.isFlashcardFile) {
            return;
        }

        try {
            const content = await this.app.vault.read(file);
            const uncollectedCount = this.collectService.countFlashcardTags(content);

            // Only update if changed (avoids unnecessary renders)
            if (state.uncollectedCount !== uncollectedCount) {
                this.stateManager.setUncollectedInfo(uncollectedCount);
            }
        } catch {
            // Ignore errors (file might be deleted/moved)
        }
    }

    /**
     * Extract source_note name from the flashcard file (legacy)
     * With SQL-only storage, this method reads source_link from the current file if it exists
     */
    private async getSourceNoteNameFromFile(): Promise<string | undefined> {
        const state = this.stateManager.getState();
        if (!state.currentFile || !state.flashcardInfo) return undefined;

        // Try to read source_link from the current file (legacy flashcard files)
        const file = state.currentFile;
        try {
            const content = await this.app.vault.read(file);
            const match = content.match(/source_link:\s*"\[\[(.+?)\]\]"/);
            return match?.[1];
        } catch {
            return undefined;
        }
    }

}
