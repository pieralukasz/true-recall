/**
 * Flashcard Panel View
 * Main panel view for the True Recall plugin
 * Uses PanelStateManager and UI components for clean architecture
 */
import {
    ItemView,
    WorkspaceLeaf,
    TFile,
    MarkdownRenderer,
    setIcon,
    Platform,
    Menu,
} from "obsidian";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../../constants";
import { FlashcardManager, OpenRouterService, getEventBus, notify } from "../../services";
import { CollectService } from "../../services/flashcard/collect.service";
import { PanelStateManager } from "../../state";
import { Panel } from "../components/Panel";
import { FlashcardPanelContent } from "./FlashcardPanelContent";
import { FlashcardPanelFooter } from "./FlashcardPanelFooter";
import { FlashcardPanelHeader } from "./FlashcardPanelHeader";
import { SelectionFooter } from "../components";
import { MoveCardModal } from "../modals/MoveCardModal";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { SimpleFlashcardEditorModal, flashcardToMarkdown } from "../modals/SimpleFlashcardEditorModal";
import type { FlashcardItem } from "../../types";
import type { CardAddedEvent, CardRemovedEvent, CardUpdatedEvent, CardReviewedEvent, BulkChangeEvent, ReviewCardChangedEvent } from "../../types/events.types";
import { State } from "ts-fsrs";
import type TrueRecallPlugin from "../../main";

/**
 * Main flashcard panel view
 */
export class FlashcardPanelView extends ItemView {
    private plugin: TrueRecallPlugin;
    private flashcardManager: FlashcardManager;
    private openRouterService: OpenRouterService;
    private stateManager: PanelStateManager;
    private collectService: CollectService;

    // UI Components
    private panelComponent: Panel | null = null;
    private headerComponent: FlashcardPanelHeader | null = null;
    private contentComponent: FlashcardPanelContent | null = null;
    private footerComponent: FlashcardPanelFooter | null = null;
    private selectionFooterComponent: SelectionFooter | null = null;

    // Container elements (obtained from Panel)
    private contentContainer!: HTMLElement;
    private footerContainer!: HTMLElement;

    // Container elements for header and content (created once, reused)
    private headerDiv: HTMLElement | null = null;
    private contentDiv: HTMLElement | null = null;

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

    // Mobile header FSRS status element
    private mobileStatusEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
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
        return "True Recall";
    }

    getIcon(): string {
        return "layers";
    }

    /**
     * Add items to the native "..." menu (mobile)
     */
    onPaneMenu(menu: Menu, source: string): void {
        super.onPaneMenu(menu, source);

        if (!Platform.isMobile) return;

        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // Refresh
        menu.addItem((item) => {
            item.setTitle("Refresh")
                .setIcon("refresh-cw")
                .onClick(() => void this.loadFlashcardInfo());
        });

        const hasFlashcards = state.status === "exists";

        // Generate flashcards (only when none exist)
        if (!hasFlashcards) {
            menu.addItem((item) => {
                item.setTitle("Generate flashcards")
                    .setIcon("sparkles")
                    .onClick(() => void this.handleGenerate());
            });
        }

        // Actions only when flashcards exist
        if (hasFlashcards) {
            menu.addSeparator();

            menu.addItem((item) => {
                item.setTitle("Copy to clipboard")
                    .setIcon("clipboard-copy")
                    .onClick(() => void this.handleCopyAllToClipboard());
            });

            menu.addItem((item) => {
                item.setTitle("Export as CSV")
                    .setIcon("file-down")
                    .onClick(() => void this.handleExportCsv());
            });

            menu.addSeparator();

            menu.addItem((item) => {
                item.setTitle("Open flashcard file")
                    .setIcon("file-text")
                    .onClick(() => void this.handleOpenFlashcardFile());
            });

            menu.addItem((item) => {
                item.setTitle("Delete all flashcards")
                    .setIcon("trash-2")
                    .onClick(() => void this.handleDeleteAllFlashcards());
            });
        }
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

        // Setup mobile header FSRS status
        if (Platform.isMobile) {
            this.setupMobileHeaderStatus();
        }

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
            // Desktop only: Delete and Open file actions (on mobile these are in "..." menu)
            if (!Platform.isMobile) {
                this.deleteAllAction = this.addAction(
                    "trash-2",
                    "Delete all flashcards",
                    () => void this.handleDeleteAllFlashcards()
                );

                this.openFileAction = this.addAction(
                    "file-text",
                    "Open flashcard file",
                    () => void this.handleOpenFlashcardFile()
                );
            }

            // Review flashcards (both desktop and mobile)
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

        // Remove mobile status element
        if (this.mobileStatusEl) {
            this.mobileStatusEl.remove();
            this.mobileStatusEl = null;
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
            // For content changes, do full reload
            if (event.changes.question || event.changes.answer) {
                void this.loadFlashcardInfo();
                return;
            }
            // For FSRS-only changes, just update the header stats
            if (event.changes.fsrs) {
                void this.updateHeaderStatsOnly();
            }
        });
        this.eventUnsubscribers.push(unsubUpdated);

        // Handle bulk changes (e.g., from diff apply)
        const unsubBulk = eventBus.on<BulkChangeEvent>("cards:bulk-change", () => {
            void this.loadFlashcardInfo();
        });
        this.eventUnsubscribers.push(unsubBulk);

        // When a card is reviewed, update header stats for FSRS counts
        const unsubReviewed = eventBus.on<CardReviewedEvent>("card:reviewed", () => {
            void this.updateHeaderStatsOnly();
        });
        this.eventUnsubscribers.push(unsubReviewed);

        // Handle review card changes - sync panel with review session
        const unsubReviewCard = eventBus.on<ReviewCardChangedEvent>(
            "review:card-changed",
            (event) => void this.handleReviewCardChanged(event)
        );
        this.eventUnsubscribers.push(unsubReviewCard);
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

    /**
     * Check if panel is currently following a review session
     */
    isFollowingReview(): boolean {
        return this.stateManager.getState().isFollowingReview;
    }

    /**
     * Clear review follow state (called when user navigates away from ReviewView)
     */
    clearReviewFollowState(): void {
        this.stateManager.setReviewFollowState(null, false);
    }

    /**
     * Handle card change during review session
     * Updates panel to show flashcards from current review card's source note
     */
    private async handleReviewCardChanged(event: ReviewCardChangedEvent): Promise<void> {
        // Update review follow state
        this.stateManager.setReviewFollowState(event.sourceNotePath, event.isActive);

        if (!event.isActive || !event.sourceNotePath) {
            // Session ended or no source - revert to active file mode
            const activeFile = this.app.workspace.getActiveFile();
            await this.handleFileChange(activeFile);
            return;
        }

        // Find the source file
        const sourceFile = this.app.vault.getAbstractFileByPath(event.sourceNotePath);
        if (sourceFile instanceof TFile) {
            // Update panel to show this file's flashcards
            await this.handleFileChange(sourceFile);
        }
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

        // Check if store is ready before accessing it
        if (!this.flashcardManager.hasStore()) {
            // Store not initialized yet, silently return
            // The view will reload once the store is ready via event subscriptions
            return;
        }

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

        // Make content container a flex column so header stays at top (only once)
        this.contentContainer.addClass("ep:flex", "ep:flex-col", "ep:gap-2");

        // Create or update header component (desktop only)
        if (!Platform.isMobile) {
            // Create header container once, then reuse
            if (!this.headerDiv) {
                this.headerDiv = this.contentContainer.createDiv({ cls: "ep:shrink-0" });
            }

            if (!this.headerComponent) {
                this.headerComponent = new FlashcardPanelHeader(this.headerDiv, {
                    flashcardInfo: state.flashcardInfo,
                    cardsWithFsrs: this.getCardsWithFsrs(),
                    hasUncollectedFlashcards: state.hasUncollectedFlashcards,
                    uncollectedCount: state.uncollectedCount,
                    selectionMode: state.selectionMode,
                    selectedCount: state.selectedCardIds.size,
                    searchQuery: state.searchQuery,
                    isFollowingReview: state.isFollowingReview,
                    onAdd: () => void this.handleAddFlashcard(),
                    onGenerate: () => void this.handleGenerate(),
                    onCollect: () => void this.handleCollect(),
                    onRefresh: () => void this.loadFlashcardInfo(),
                    onReview: () => void this.handleReviewFromPanel(),
                    onExitSelectionMode: () => this.stateManager.exitSelectionMode(),
                    onSearchChange: (query) => this.stateManager.setSearchQuery(query),
                    onExportCsv: () => void this.handleExportCsv(),
                    onCopyToClipboard: () => void this.handleCopyAllToClipboard(),
                    onDeleteAll: () => void this.handleDeleteAllFlashcards(),
                    onOpenSourceNote: () => this.handleOpenSourceNote(),
                });
                this.headerComponent.render();
            } else {
                this.headerComponent.updateProps({
                    flashcardInfo: state.flashcardInfo,
                    cardsWithFsrs: this.getCardsWithFsrs(),
                    hasUncollectedFlashcards: state.hasUncollectedFlashcards,
                    uncollectedCount: state.uncollectedCount,
                    selectionMode: state.selectionMode,
                    selectedCount: state.selectedCardIds.size,
                    searchQuery: state.searchQuery,
                    isFollowingReview: state.isFollowingReview,
                });
            }
        } else {
            // Update mobile header FSRS status
            this.updateMobileHeaderStatus();
        }

        // Create content container once, then reuse
        if (!this.contentDiv) {
            this.contentDiv = this.contentContainer.createDiv({ cls: "ep:flex-1 ep:overflow-y-auto ep:min-h-0" });
        }

        // Destroy and recreate content component (flashcard list needs full re-render)
        this.contentComponent?.destroy();
        this.contentDiv.empty();

        this.contentComponent = new FlashcardPanelContent(this.contentDiv, {
            currentFile: state.currentFile,
            status: state.status,
            flashcardInfo: state.flashcardInfo,
            isFlashcardFile: state.isFlashcardFile,
            noteFlashcardType: state.noteFlashcardType,
            selectionMode: state.selectionMode,
            selectedCardIds: state.selectedCardIds,
            expandedCardIds: state.expandedCardIds,
            cardsWithFsrs: this.getCardsWithFsrs(),
            searchQuery: state.searchQuery,
            isAddCardExpanded: state.isAddCardExpanded,
            handlers: {
                app: this.app,
                component: this,
                onEditCard: (card) => void this.handleEditCard(card),
                onEditButton: (card) => void this.handleEditButton(card),
                onCopyCard: (card) => void this.handleCopyCard(card),
                onDeleteCard: (card) => void this.handleRemoveCard(card),
                onMoveCard: (card) => void this.handleMoveCard(card),
                onEditSave: async (card, field, newContent) => void this.handleEditSave(card, field, newContent),
                onToggleExpand: (cardId) => {
                    const scrollPosition = this.contentDiv?.scrollTop ?? 0;
                    this.stateManager.toggleCardExpanded(cardId);
                    requestAnimationFrame(() => {
                        if (this.contentDiv) this.contentDiv.scrollTop = scrollPosition;
                    });
                },
                onToggleSelect: (cardId) => {
                    const scrollPosition = this.contentDiv?.scrollTop ?? 0;
                    this.stateManager.toggleCardSelection(cardId);
                    requestAnimationFrame(() => {
                        if (this.contentDiv) this.contentDiv.scrollTop = scrollPosition;
                    });
                },
                onEnterSelectionMode: (cardId) => this.stateManager.enterSelectionMode(cardId),
                onAdd: () => void this.handleAddFlashcard(),
            },
        });
        this.contentComponent.render();

        // Render Footer (only for selection mode)
        this.footerComponent?.destroy();
        this.selectionFooterComponent?.destroy();
        this.footerContainer.empty();

        if (state.selectionMode === "selecting") {
            // Selection mode footer
            const selectedCount = state.selectedCardIds.size;
            this.selectionFooterComponent = new SelectionFooter(this.footerContainer, {
                display: { type: "selectedCount", count: selectedCount },
                actions: [
                    {
                        label: "Move",
                        icon: "folder-input",
                        onClick: () => void this.handleMoveSelected(),
                        variant: "secondary",
                        disabled: selectedCount === 0,
                    },
                    {
                        label: "Delete",
                        icon: "trash-2",
                        onClick: () => void this.handleDeleteSelected(),
                        variant: "danger",
                        disabled: selectedCount === 0,
                    },
                ],
            });
            this.selectionFooterComponent.render();
        }
        // Normal mode: no footer (actions in header)
    }

    /**
     * Update header FSRS stats only (no full re-render)
     * Called when cards are reviewed to update New/Learning/Review counts
     */
    private updateHeaderStatsOnly(): void {
        const cardsWithFsrs = this.getCardsWithFsrs();

        // Update header component with new FSRS data only
        if (this.headerComponent) {
            this.headerComponent.updateProps({
                cardsWithFsrs,
            });
        }

        // Update mobile header if on mobile
        if (Platform.isMobile) {
            this.updateMobileHeaderStatus();
        }
    }

    /**
     * Get cards with FSRS data from flashcard manager
     */
    private getCardsWithFsrs(): FSRSFlashcardItem[] {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo?.flashcards) return [];

        // Check if store is ready before accessing it
        if (!this.flashcardManager.hasStore()) {
            return [];
        }

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
            notify().error("Flashcard store not ready. Please restart Obsidian.");
            return;
        }

        if (!this.plugin.settings.openRouterApiKey) {
            notify().aiNotConfigured();
            return;
        }

        // Note: Selection-based generation moved to floating button
        this.stateManager.startProcessing();

        try {
            const content = await this.app.vault.read(state.currentFile);
            const flashcards = await this.openRouterService.generateFlashcards(
                content,
                undefined,
                this.plugin.settings.customGeneratePrompt || undefined
            );

            if (flashcards.trim() === "NO_NEW_CARDS") {
                notify().info("No flashcard-worthy content found in this note.");
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

            notify().success(`Generated flashcards for ${state.currentFile.basename}`);
            this.stateManager.finishProcessing(false);
        } catch (error) {
            notify().operationFailed("generate flashcards", error);
            this.stateManager.finishProcessing(false);
        }

        // Load flashcard info outside main try-catch to avoid double error handling
        try {
            await this.loadFlashcardInfo();
        } catch (error) {
            console.error("Failed to load flashcard info after generation:", error);
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
            await this.flashcardManager.openFileAtCard(state.currentFile, card.id);
        } else {
            await this.flashcardManager.openFlashcardFileAtCard(state.currentFile, card.id);
        }
    }

    private async handleEditButton(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        const scrollPosition = this.contentDiv?.scrollTop ?? 0;

        const modal = new SimpleFlashcardEditorModal(this.app, {
            mode: "edit",
            currentFilePath: state.currentFile.path,
            prefillContent: flashcardToMarkdown(card.question, card.answer),
            editCardId: card.id,
        });

        const result = await modal.openAndWait();
        if (result.cancelled || result.flashcards.length === 0) return;

        try {
            // First flashcard updates the original card
            const firstFlashcard = result.flashcards[0];
            if (firstFlashcard) {
                this.flashcardManager.updateCardContent(
                    card.id,
                    firstFlashcard.question,
                    firstFlashcard.answer
                );
            }

            // Additional flashcards (if any) are created as new cards
            if (result.flashcards.length > 1) {
                const frontmatterService = this.flashcardManager.getFrontmatterService();
                let sourceUid = await frontmatterService.getSourceNoteUid(state.currentFile);
                if (!sourceUid) {
                    sourceUid = frontmatterService.generateUid();
                    await frontmatterService.setSourceNoteUid(state.currentFile, sourceUid);
                }

                for (let i = 1; i < result.flashcards.length; i++) {
                    const flashcard = result.flashcards[i];
                    if (flashcard) {
                        await this.flashcardManager.addSingleFlashcard(
                            flashcard.question,
                            flashcard.answer,
                            sourceUid
                        );
                    }
                }
                notify().success(`Updated card and created ${result.flashcards.length - 1} new cards`);
            } else {
                notify().cardUpdated();
            }

            await this.loadFlashcardInfo();

            requestAnimationFrame(() => {
                if (this.contentDiv) this.contentDiv.scrollTop = scrollPosition;
            });
        } catch (error) {
            notify().operationFailed("update flashcard", error);
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
        const scrollPosition = this.contentDiv?.scrollTop ?? 0;

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

            notify().cardUpdated();

            // Reload flashcard info to reflect changes
            await this.loadFlashcardInfo();

            requestAnimationFrame(() => {
                if (this.contentDiv) this.contentDiv.scrollTop = scrollPosition;
            });
        } catch (error) {
            notify().operationFailed("update flashcard", error);
        }
    }

    private async handleRemoveCard(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // Save scroll position before re-render
        const scrollPosition = this.contentDiv?.scrollTop ?? 0;

        const removed = await this.flashcardManager.removeFlashcardById(card.id);

        if (removed) {
            notify().cardsDeleted(1);
            await this.loadFlashcardInfo();

            // Restore scroll position after render completes
            requestAnimationFrame(() => {
                if (this.contentDiv) this.contentDiv.scrollTop = scrollPosition;
            });
        } else {
            notify().error("Failed to remove flashcard from file");
        }
    }

    private async handleCopyCard(card: FlashcardItem): Promise<void> {
        const text = `Q: ${card.question}\nA: ${card.answer}`;
        await navigator.clipboard.writeText(text);
        notify().success("Copied to clipboard");
    }

    // ===== Export Handlers =====

    /**
     * Copy all flashcards to clipboard as formatted text
     */
    private async handleCopyAllToClipboard(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo?.flashcards || state.flashcardInfo.flashcards.length === 0) {
            notify().warning("No flashcards to copy");
            return;
        }

        const text = state.flashcardInfo.flashcards
            .map((card, i) => `${i + 1}. Q: ${card.question}\n   A: ${card.answer}`)
            .join("\n\n");

        await navigator.clipboard.writeText(text);
        notify().success(`Copied ${state.flashcardInfo.flashcards.length} flashcard(s) to clipboard`);
    }

    /**
     * Export all flashcards as CSV file
     */
    private async handleExportCsv(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo?.flashcards || state.flashcardInfo.flashcards.length === 0) {
            notify().warning("No flashcards to export");
            return;
        }

        // Build CSV content with proper escaping
        const escapeCSV = (str: string): string => {
            if (str.includes(",") || str.includes("\n") || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const header = "Question,Answer";
        const rows = state.flashcardInfo.flashcards.map(
            (card) => `${escapeCSV(card.question)},${escapeCSV(card.answer)}`
        );
        const csvContent = [header, ...rows].join("\n");

        // Generate filename from current file
        const filename = state.currentFile
            ? `${state.currentFile.basename}-flashcards.csv`
            : "flashcards.csv";

        // Create blob and download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        notify().success(`Exported ${state.flashcardInfo.flashcards.length} flashcard(s) to CSV`);
    }

    // ===== Move Card Handlers =====

    private async handleMoveCard(card: FlashcardItem): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.flashcardInfo) return;

        if (!card.id) {
            notify().error("Cannot move card without UUID. Please regenerate flashcards.");
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
            notify().cardsMoved(1, result.targetNotePath);
            await this.loadFlashcardInfo();
        } catch (error) {
            notify().operationFailed("move card", error);
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
            notify().error("No cards with valid UUIDs selected. Please regenerate flashcards.");
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
        notify().success(`Moved ${successCount} of ${selectedCards.length} cards`);
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
        notify().cardsDeleted(successCount);
        await this.loadFlashcardInfo();
    }

    /**
     * Add flashcards via simple markdown editor modal
     * Includes AI formatting option if OpenRouter is configured
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

        const modal = new SimpleFlashcardEditorModal(this.app, {
            mode: "add",
            currentFilePath: state.currentFile.path,
            openRouterService: this.openRouterService,
            settings: this.plugin.settings,
        });

        const result = await modal.openAndWait();
        if (result.cancelled || result.flashcards.length === 0) return;

        try {
            // Save all parsed flashcards
            for (const flashcard of result.flashcards) {
                await this.flashcardManager.addSingleFlashcard(
                    flashcard.question,
                    flashcard.answer,
                    sourceUid
                );
            }
            notify().cardsCreated(result.flashcards.length);
            await this.loadFlashcardInfo();
        } catch (error) {
            console.error("Error adding flashcards:", error);
            notify().operationFailed("add flashcards", error);
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

        notify().cardsDeleted(successCount);
        await this.loadFlashcardInfo();
    }

    /**
     * Start review from the flashcard panel
     * Opens review session for current note's flashcards
     */
    private async handleReviewFromPanel(): Promise<void> {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        await this.plugin.reviewNoteFlashcards(state.currentFile);
    }

    /**
     * Open the source note in the editor
     * Used when following a review session to quickly open the source file
     */
    private handleOpenSourceNote(): void {
        const state = this.stateManager.getState();
        if (!state.currentFile) return;

        // Open the file in a new leaf
        void this.app.workspace.getLeaf("tab").openFile(state.currentFile);
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
            notify().error("Flashcard store not ready. Please restart Obsidian.");
            return;
        }

        try {
            const content = await this.app.vault.read(state.currentFile);
            const result = this.collectService.collect(content);

            if (result.collectedCount === 0) {
                notify().info("No flashcards to collect");
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

            notify().success(`Collected ${result.collectedCount} flashcard(s)`);
            await this.loadFlashcardInfo();
        } catch (error) {
            notify().operationFailed("collect flashcards", error);
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

    // ===== Mobile Header FSRS Status =====

    /**
     * Setup mobile header FSRS status element
     * Injects a colored status element into the native Obsidian header
     */
    private setupMobileHeaderStatus(): void {
        const titleContainer = this.containerEl.querySelector(".view-header-title-container");
        if (!titleContainer) return;

        // Hide the "True Recall" title
        const titleEl = titleContainer.querySelector(".view-header-title") as HTMLElement;
        if (titleEl) {
            titleEl.style.display = "none";
        }

        // Create status element
        this.mobileStatusEl = createDiv({ cls: "true-recall-mobile-status" });
        titleContainer.appendChild(this.mobileStatusEl);
    }

    /**
     * Update mobile header FSRS status counts
     */
    private updateMobileHeaderStatus(): void {
        if (!this.mobileStatusEl) return;

        const cards = this.getCardsWithFsrs();
        const counts = this.countByState(cards);

        this.mobileStatusEl.empty();

        // New count (blue)
        const newEl = this.mobileStatusEl.createSpan({ cls: "ep:text-blue-500" });
        newEl.textContent = String(counts.new);

        // Separator
        this.mobileStatusEl.createSpan({ cls: "ep:text-obs-faint", text: "·" });

        // Learning count (orange)
        const learningEl = this.mobileStatusEl.createSpan({ cls: "ep:text-orange-500" });
        learningEl.textContent = String(counts.learning);

        // Separator
        this.mobileStatusEl.createSpan({ cls: "ep:text-obs-faint", text: "·" });

        // Review count (green)
        const reviewEl = this.mobileStatusEl.createSpan({ cls: "ep:text-green-500" });
        reviewEl.textContent = String(counts.review);
    }

    /**
     * Count cards by FSRS state (excludes buried/suspended cards)
     */
    private countByState(cards: FSRSFlashcardItem[]): { new: number; learning: number; review: number } {
        const counts = { new: 0, learning: 0, review: 0 };
        const now = new Date();

        for (const card of cards) {
            // Skip buried/suspended cards
            if (card.fsrs.suspended) continue;
            if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now) continue;

            switch (card.fsrs.state) {
                case State.New:
                    counts.new++;
                    break;
                case State.Learning:
                case State.Relearning:
                    counts.learning++;
                    break;
                case State.Review:
                    counts.review++;
                    break;
            }
        }
        return counts;
    }

}
