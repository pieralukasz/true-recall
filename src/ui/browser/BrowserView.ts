/**
 * Browser View
 * Anki-style card browser for viewing, filtering, and managing flashcards
 */
import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { VIEW_TYPE_BROWSER } from "../../constants";
import { createBrowserStateManager } from "../../state/browser.state";
import type { BrowserCardItem, BulkOperation } from "../../types/browser.types";
import { BrowserToolbar } from "./BrowserToolbar";
import { BrowserSidebar } from "./BrowserSidebar";
import { BrowserTable } from "./BrowserTable";
import { BrowserPreview } from "./BrowserPreview";
import { FlashcardEditorModal } from "../modals/FlashcardEditorModal";
import { getEventBus } from "../../services/core/event-bus.service";
import type EpistemePlugin from "../../main";

/**
 * Card Browser View
 * Three-panel layout: Sidebar | Table | Preview
 */
export class BrowserView extends ItemView {
    private plugin: EpistemePlugin;
    private stateManager = createBrowserStateManager();

    // UI Components
    private toolbarComponent: BrowserToolbar | null = null;
    private sidebarComponent: BrowserSidebar | null = null;
    private tableComponent: BrowserTable | null = null;
    private previewComponent: BrowserPreview | null = null;

    // Container elements
    private mainContainer!: HTMLElement;
    private toolbarContainer!: HTMLElement;
    private contentContainer!: HTMLElement;
    private sidebarContainer!: HTMLElement;
    private tableContainer!: HTMLElement;
    private previewContainer!: HTMLElement;

    // State subscription
    private unsubscribe: (() => void) | null = null;

    // EventBus subscriptions
    private eventUnsubscribers: (() => void)[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_BROWSER;
    }

    getDisplayText(): string {
        return "Card Browser";
    }

    getIcon(): string {
        return "layout-list";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        if (!(container instanceof HTMLElement)) return;
        container.empty();
        container.addClass("episteme-browser-view");

        // Create main container
        this.mainContainer = container.createDiv({ cls: "browser-main" });

        // Create toolbar at top
        this.toolbarContainer = this.mainContainer.createDiv({ cls: "browser-toolbar-container" });

        // Create content area (3-panel layout)
        this.contentContainer = this.mainContainer.createDiv({ cls: "browser-content" });

        // Create sidebar
        this.sidebarContainer = this.contentContainer.createDiv({ cls: "browser-sidebar" });

        // Create table (center)
        this.tableContainer = this.contentContainer.createDiv({ cls: "browser-table-container" });

        // Create preview panel
        this.previewContainer = this.contentContainer.createDiv({ cls: "browser-preview" });

        // Subscribe to state changes
        this.unsubscribe = this.stateManager.subscribe(() => this.render());

        // Subscribe to EventBus events
        this.setupEventSubscriptions();

        // Initial render
        this.render();

        // Load cards
        void this.loadCards();
    }

    async onClose(): Promise<void> {
        this.unsubscribe?.();
        this.eventUnsubscribers.forEach(unsub => unsub());
        this.toolbarComponent?.destroy();
        this.sidebarComponent?.destroy();
        this.tableComponent?.destroy();
        this.previewComponent?.destroy();
    }

    /**
     * Set up EventBus subscriptions
     */
    private setupEventSubscriptions(): void {
        const eventBus = getEventBus();

        // Refresh on card changes
        this.eventUnsubscribers.push(
            eventBus.on("card:added", () => void this.loadCards()),
            eventBus.on("card:updated", () => void this.loadCards()),
            eventBus.on("card:removed", () => void this.loadCards()),
            eventBus.on("cards:bulk-change", () => void this.loadCards())
        );
    }

    /**
     * Load cards from database
     */
    private async loadCards(): Promise<void> {
        this.stateManager.setLoading(true);

        try {
            const cards = this.plugin.cardStore.browser.getAllCardsForBrowser();
            this.stateManager.setCards(cards);
        } catch (error) {
            console.error("[BrowserView] Failed to load cards:", error);
            new Notice("Failed to load cards");
            this.stateManager.setCards([]);
        }
    }

    // ===== Card Actions =====

    /**
     * Handle card click (select + preview)
     */
    private handleCardClick(cardId: string, event: MouseEvent): void {
        const index = this.stateManager.getState().filteredCards.findIndex(c => c.id === cardId);

        if (event.shiftKey && this.stateManager.getState().lastClickedIndex !== null) {
            // Range selection
            this.stateManager.selectRange(index);
        } else if (event.ctrlKey || event.metaKey) {
            // Toggle selection
            this.stateManager.toggleCardSelection(cardId);
        } else {
            // Single selection
            this.stateManager.clearSelection();
            this.stateManager.toggleCardSelection(cardId);
        }

        // Set preview
        this.stateManager.setPreviewCard(cardId);
    }

    /**
     * Handle edit card
     */
    private async handleEditCard(card: BrowserCardItem): Promise<void> {
        const modal = new FlashcardEditorModal(this.app, {
            mode: "edit",
            card: {
                id: card.id,
                question: card.question ?? "",
                answer: card.answer ?? "",
                fsrs: {
                    id: card.id,
                    due: card.due,
                    stability: card.stability,
                    difficulty: card.difficulty,
                    scheduledDays: card.scheduledDays,
                    reps: card.reps,
                    lapses: card.lapses,
                    state: card.state,
                    lastReview: card.lastReview,
                    learningStep: card.learningStep,
                },
                projects: card.projects,
            },
            currentFilePath: card.sourceNotePath || "",
            sourceNoteName: card.sourceNoteName || "Unknown",
        });

        const result = await modal.openAndWait();
        if (result.cancelled) return;

        try {
            this.plugin.flashcardManager.updateCardContent(card.id, result.question, result.answer);

            // Update state
            this.stateManager.updateCard(card.id, {
                question: result.question,
                answer: result.answer,
            });

            // If source was changed, move the card
            if (result.newSourceNotePath) {
                await this.plugin.flashcardManager.moveCard(
                    card.id,
                    result.newSourceNotePath
                );
                new Notice("Card updated and moved");
            } else {
                new Notice("Card updated");
            }
        } catch (error) {
            new Notice(`Failed to update card: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle open source note
     */
    private async handleOpenSourceNote(card: BrowserCardItem): Promise<void> {
        if (!card.sourceNotePath) {
            new Notice("No source note linked");
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(card.sourceNotePath);
        if (file instanceof TFile) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        } else {
            new Notice("Source note not found");
        }
    }

    // ===== Bulk Operations =====

    /**
     * Execute bulk operation on selected cards
     */
    private async executeBulkOperation(operation: BulkOperation): Promise<void> {
        const selectedIds = [...this.stateManager.getState().selectedCardIds];
        if (selectedIds.length === 0) {
            new Notice("No cards selected");
            return;
        }

        const browser = this.plugin.cardStore.browser;

        try {
            let count = 0;
            const eventBus = getEventBus();

            switch (operation) {
                case "suspend":
                    count = browser.bulkSuspend(selectedIds);
                    new Notice(`${count} card(s) suspended`);
                    break;

                case "unsuspend":
                    count = browser.bulkUnsuspend(selectedIds);
                    new Notice(`${count} card(s) unsuspended`);
                    break;

                case "bury": {
                    // Bury until tomorrow
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(4, 0, 0, 0); // 4 AM tomorrow
                    count = browser.bulkBury(selectedIds, tomorrow.toISOString());
                    new Notice(`${count} card(s) buried until tomorrow`);
                    break;
                }

                case "unbury":
                    count = browser.bulkUnbury(selectedIds);
                    new Notice(`${count} card(s) unburied`);
                    break;

                case "delete":
                    if (!confirm(`Delete ${selectedIds.length} card(s)? This cannot be undone.`)) {
                        return;
                    }
                    count = browser.bulkDelete(selectedIds);
                    this.stateManager.removeCards(selectedIds);
                    new Notice(`${count} card(s) deleted`);
                    break;

                case "reset":
                    if (!confirm(`Reset ${selectedIds.length} card(s) to New state?`)) {
                        return;
                    }
                    count = browser.bulkReset(selectedIds);
                    new Notice(`${count} card(s) reset to New`);
                    break;

                case "reschedule": {
                    const dateStr = prompt("Enter new due date (YYYY-MM-DD):");
                    if (!dateStr) return;
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                        new Notice("Invalid date format");
                        return;
                    }
                    count = browser.bulkReschedule(selectedIds, date.toISOString());
                    new Notice(`${count} card(s) rescheduled`);
                    break;
                }
            }

            // Emit event and reload
            eventBus.emit({
                type: "cards:bulk-change",
                action: operation,
                cardIds: selectedIds,
                timestamp: Date.now(),
            });

            // Reload cards to reflect changes
            await this.loadCards();
            this.stateManager.clearSelection();
        } catch (error) {
            new Notice(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ===== Render =====

    /**
     * Render all components
     */
    private render(): void {
        const state = this.stateManager.getState();

        // Render toolbar
        this.toolbarComponent?.destroy();
        this.toolbarContainer.empty();
        this.toolbarComponent = new BrowserToolbar(this.toolbarContainer, {
            searchQuery: state.searchQuery,
            selectedCount: state.selectedCardIds.size,
            totalCount: state.allCards.length,
            filteredCount: state.filteredCards.length,
            onSearchChange: (query) => this.stateManager.setSearchQuery(query),
            onBulkOperation: (op) => void this.executeBulkOperation(op),
            onSelectAll: () => this.stateManager.selectAll(),
            onClearSelection: () => this.stateManager.clearSelection(),
        });
        this.toolbarComponent.render();

        // Render sidebar
        this.sidebarComponent?.destroy();
        this.sidebarContainer.empty();
        this.sidebarComponent = new BrowserSidebar(this.sidebarContainer, {
            stateCounts: this.stateManager.getStateCounts(),
            projects: this.stateManager.getUniqueProjects(),
            currentFilters: state.sidebarFilters,
            onFilterChange: (filters) => this.stateManager.setSidebarFilters(filters),
            onClearFilters: () => this.stateManager.clearFilters(),
        });
        this.sidebarComponent.render();

        // Render table
        this.tableComponent?.destroy();
        this.tableContainer.empty();
        this.tableComponent = new BrowserTable(this.tableContainer, {
            cards: state.filteredCards,
            selectedCardIds: state.selectedCardIds,
            sortColumn: state.sortColumn,
            sortDirection: state.sortDirection,
            isLoading: state.isLoading,
            onCardClick: (cardId, event) => this.handleCardClick(cardId, event),
            onCardDoubleClick: (card) => void this.handleEditCard(card),
            onSortChange: (column) => this.stateManager.setSortColumn(column),
            onOpenSourceNote: (card) => void this.handleOpenSourceNote(card),
        });
        this.tableComponent.render();

        // Render preview
        this.previewComponent?.destroy();
        this.previewContainer.empty();
        const previewCard = this.stateManager.getPreviewCard();
        this.previewComponent = new BrowserPreview(this.previewContainer, {
            card: previewCard,
            app: this.app,
            component: this,
            onEdit: (card) => void this.handleEditCard(card),
            onOpenSource: (card) => void this.handleOpenSourceNote(card),
            onSuspend: (card) => {
                void this.executeSingleOperation(card.id, card.suspended ? "unsuspend" : "suspend");
            },
            onBury: (card) => {
                const isBuried = card.buriedUntil && new Date(card.buriedUntil) > new Date();
                void this.executeSingleOperation(card.id, isBuried ? "unbury" : "bury");
            },
            onDelete: (card) => void this.executeSingleOperation(card.id, "delete"),
        });
        this.previewComponent.render();
    }

    /**
     * Execute operation on single card
     */
    private async executeSingleOperation(cardId: string, operation: BulkOperation): Promise<void> {
        // Temporarily select just this card
        const prevSelection = this.stateManager.getState().selectedCardIds;
        this.stateManager.setState({ selectedCardIds: new Set([cardId]) });

        await this.executeBulkOperation(operation);

        // Restore selection (if card still exists)
        if (operation !== "delete") {
            this.stateManager.setState({ selectedCardIds: prevSelection });
        }
    }

    /**
     * Refresh the view
     */
    async refresh(): Promise<void> {
        await this.loadCards();
    }
}
