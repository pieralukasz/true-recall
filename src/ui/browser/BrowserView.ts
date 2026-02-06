import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { VIEW_TYPE_BROWSER } from "../../constants";
import type { BrowserCardItem, BulkOperation } from "../../types/browser.types";
import { BrowserToolbar } from "./BrowserToolbar";
import { BrowserSidebar } from "./BrowserSidebar";
import { VirtualTable } from "./VirtualTable";
import { BrowserPreview } from "./BrowserPreview";
import { FlashcardEditorModal } from "../modals/FlashcardEditorModal";
import { getEventBus, notify } from "../../services";
import type { CardUpdatedEvent } from "../../types/events.types";
import type TrueRecallPlugin from "../../main";
import { RESIZE_STYLES } from "./styles";
import type { BrowserApi } from "../../state/store";

interface PanelSizes {
    sidebarWidth: number;
    previewWidth: number;
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
    sidebarWidth: 220,
    previewWidth: 320,
};

const PANEL_CONSTRAINTS = {
    sidebar: { min: 180, max: 350 },
    preview: { min: 280, max: 500 },
};

const PANEL_STORAGE_KEY = "true-recall-browser-panel-sizes";

export class BrowserView extends ItemView {
    private plugin: TrueRecallPlugin;

    private toolbarComponent: BrowserToolbar | null = null;
    private sidebarComponent: BrowserSidebar | null = null;
    private tableComponent: VirtualTable | null = null;
    private previewComponent: BrowserPreview | null = null;

    private prevState: BrowserApi | null = null;

    private mainContainer!: HTMLElement;
    private toolbarContainer!: HTMLElement;
    private contentContainer!: HTMLElement;
    private sidebarContainer!: HTMLElement;
    private tableContainer!: HTMLElement;
    private previewContainer!: HTMLElement;

    private unsubscribe: (() => void) | null = null;
    private eventUnsubscribers: (() => void)[] = [];
    private panelSizes: PanelSizes;

    constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.panelSizes = this.loadPanelSizes();
    }

    private get browser(): BrowserApi {
        return this.plugin.store!.getState().browser;
    }

    private loadPanelSizes(): PanelSizes {
        try {
            const stored: unknown = this.app.loadLocalStorage(PANEL_STORAGE_KEY);
            if (stored && typeof stored === "string") {
                return { ...DEFAULT_PANEL_SIZES, ...JSON.parse(stored) as Partial<PanelSizes> };
            }
        } catch {
            // Ignore parse errors
        }
        return { ...DEFAULT_PANEL_SIZES };
    }

    private savePanelSizes(): void {
        this.app.saveLocalStorage(PANEL_STORAGE_KEY, JSON.stringify(this.panelSizes));
    }

    getViewType(): string {
        return VIEW_TYPE_BROWSER;
    }

    getDisplayText(): string {
        return "Card browser";
    }

    getIcon(): string {
        return "layout-list";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        if (!(container instanceof HTMLElement)) return;
        container.empty();
        container.addClass("ep:flex", "ep:flex-col", "ep:h-full", "ep:overflow-hidden", "ep:bg-obs-primary");

        this.mainContainer = container.createDiv({
            cls: "ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0",
        });

        this.toolbarContainer = this.mainContainer.createDiv({
            cls: "ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:shrink-0",
        });

        this.contentContainer = this.mainContainer.createDiv({
            cls: "ep:flex ep:flex-1 ep:overflow-hidden ep:min-h-0",
        });

        this.sidebarContainer = this.contentContainer.createDiv({
            cls: "ep:flex ep:flex-col ep:border-r ep:border-obs-border ep:bg-obs-secondary ep:overflow-y-auto ep:shrink-0",
        });
        this.sidebarContainer.style.width = `${this.panelSizes.sidebarWidth}px`;
        this.sidebarContainer.style.minWidth = `${PANEL_CONSTRAINTS.sidebar.min}px`;
        this.sidebarContainer.style.maxWidth = `${PANEL_CONSTRAINTS.sidebar.max}px`;

        const sidebarResizeHandle = this.contentContainer.createDiv({ cls: RESIZE_STYLES.PANEL_HANDLE });
        this.setupPanelResize(sidebarResizeHandle, "sidebar");

        this.tableContainer = this.contentContainer.createDiv({
            cls: "ep:flex-1 ep:min-w-0 ep:flex ep:flex-col ep:overflow-auto",
        });

        const previewResizeHandle = this.contentContainer.createDiv({ cls: RESIZE_STYLES.PANEL_HANDLE });
        this.setupPanelResize(previewResizeHandle, "preview");

        this.previewContainer = this.contentContainer.createDiv({
            cls: "ep:h-full ep:flex ep:flex-col ep:border-l ep:border-obs-border ep:bg-obs-primary ep:overflow-y-auto ep:shrink-0",
        });
        this.previewContainer.style.width = `${this.panelSizes.previewWidth}px`;
        this.previewContainer.style.minWidth = `${PANEL_CONSTRAINTS.preview.min}px`;
        this.previewContainer.style.maxWidth = `${PANEL_CONSTRAINTS.preview.max}px`;

        this.unsubscribe = this.plugin.store!.subscribe(
            (state) => state.browser,
            () => this.render()
        );

        this.setupEventSubscriptions();
        this.render();
        void this.loadCards();
    }

    private setupPanelResize(handle: HTMLElement, panel: "sidebar" | "preview"): void {
        let startX = 0;
        let startWidth = 0;
        let rafId: number | null = null;

        const container = panel === "sidebar" ? this.sidebarContainer : this.previewContainer;
        const constraints = PANEL_CONSTRAINTS[panel];

        const onMouseMove = (e: MouseEvent) => {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                const delta = e.clientX - startX;
                // For preview, dragging left (negative delta) makes it wider
                const adjustedDelta = panel === "preview" ? -delta : delta;
                const newWidth = Math.max(constraints.min, Math.min(constraints.max, startWidth + adjustedDelta));

                if (panel === "sidebar") {
                    this.panelSizes.sidebarWidth = newWidth;
                } else {
                    this.panelSizes.previewWidth = newWidth;
                }
                container.style.width = `${newWidth}px`;
            });
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.setCssProps({ "user-select": "" });
            handle.removeClass(RESIZE_STYLES.PANEL_HANDLE_ACTIVE);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            this.savePanelSizes();
        };

        handle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = panel === "sidebar" ? this.panelSizes.sidebarWidth : this.panelSizes.previewWidth;
            document.body.setCssProps({ "user-select": "none" });
            handle.addClass(RESIZE_STYLES.PANEL_HANDLE_ACTIVE);
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        // Double-click to reset
        handle.addEventListener("dblclick", () => {
            const defaultWidth = panel === "sidebar" ? DEFAULT_PANEL_SIZES.sidebarWidth : DEFAULT_PANEL_SIZES.previewWidth;
            if (panel === "sidebar") {
                this.panelSizes.sidebarWidth = defaultWidth;
            } else {
                this.panelSizes.previewWidth = defaultWidth;
            }
            container.style.width = `${defaultWidth}px`;
            this.savePanelSizes();
        });
    }

    async onClose(): Promise<void> {
        this.unsubscribe?.();
        this.eventUnsubscribers.forEach(unsub => unsub());
        this.toolbarComponent?.destroy();
        this.sidebarComponent?.destroy();
        this.tableComponent?.destroy();
        this.previewComponent?.destroy();
    }

    private setupEventSubscriptions(): void {
        const eventBus = getEventBus();

        this.eventUnsubscribers.push(
            eventBus.on("card:added", () => void this.loadCards()),
            eventBus.on<CardUpdatedEvent>("card:updated", (event) => {
                // Skip FSRS-only updates (from review) - content hasn't changed
                if (event.changes.fsrs && !event.changes.question && !event.changes.answer) {
                    return;
                }
                void this.loadCards();
            }),
            eventBus.on("card:removed", () => void this.loadCards()),
            eventBus.on("cards:bulk-change", () => void this.loadCards())
        );
    }

    private async loadCards(): Promise<void> {
        this.browser.setLoading(true);

        try {
            const rawCards = this.plugin.cardStore.browser.getAllCardsForBrowser();
            const sourceNoteService = this.plugin.flashcardManager.getSourceNoteService();
            const cards = sourceNoteService.enrichCards(rawCards);
            this.browser.setCards(cards);
        } catch (error) {
            console.error("[BrowserView] Failed to load cards:", error);
            notify().error("Failed to load cards");
            this.browser.setCards([]);
        }
    }

    private handleCardClick(cardId: string, event: MouseEvent): void {
        const index = this.browser.filteredCards.findIndex(c => c.id === cardId);

        if (event.shiftKey && this.browser.lastClickedIndex !== null) {
            this.browser.selectRange(index);
        } else if (event.ctrlKey || event.metaKey) {
            this.browser.toggleCardSelection(cardId);
        } else {
            this.browser.clearSelection();
            this.browser.toggleCardSelection(cardId);
        }

        this.browser.setPreviewCard(cardId);
    }

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
            this.plugin.cardStore.cards.updateCardContent(
                card.id,
                result.question,
                result.answer
            );

            this.browser.updateCard(card.id, {
                question: result.question,
                answer: result.answer,
            });

            if (result.newSourceNotePath) {
                await this.plugin.flashcardManager.moveCard(
                    card.id,
                    result.newSourceNotePath
                );
                notify().cardUpdatedAndMoved();
            } else {
                notify().cardUpdated();
            }
        } catch (error) {
            notify().operationFailed("update card", error);
        }
    }

    private async handleOpenSourceNote(card: BrowserCardItem): Promise<void> {
        if (!card.sourceNotePath) {
            notify().warning("No source note linked");
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(card.sourceNotePath);
        if (file instanceof TFile) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        } else {
            notify().fileNotFound("Source note");
        }
    }

    private async executeBulkOperation(operation: BulkOperation): Promise<void> {
        const selectedIds = [...this.browser.selectedCardIds];
        if (selectedIds.length === 0) {
            notify().warning("No cards selected");
            return;
        }

        const browser = this.plugin.cardStore.browser;

        try {
            let count = 0;
            const eventBus = getEventBus();

            switch (operation) {
                case "suspend":
                    count = browser.bulkSuspend(selectedIds);
                    notify().cardsStatusChanged(count, "suspended");
                    break;

                case "unsuspend":
                    count = browser.bulkUnsuspend(selectedIds);
                    notify().success(`${count} card(s) unsuspended`);
                    break;

                case "bury": {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(4, 0, 0, 0); // 4 AM tomorrow
                    count = browser.bulkBury(selectedIds, tomorrow.toISOString());
                    notify().cardsBuried(count);
                    break;
                }

                case "unbury":
                    count = browser.bulkUnbury(selectedIds);
                    notify().cardsStatusChanged(count, "unburied");
                    break;

                case "delete":
                    // eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
                    if (!window.confirm(`Delete ${selectedIds.length} card(s)? This cannot be undone.`)) {
                        return;
                    }
                    count = browser.bulkSoftDelete(selectedIds);
                    this.browser.removeCards(selectedIds);
                    notify().cardsDeleted(count);
                    break;

                case "reset":
                    // eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
                    if (!window.confirm(`Reset ${selectedIds.length} card(s) to new state?`)) {
                        return;
                    }
                    count = browser.bulkReset(selectedIds);
                    notify().success(`${count} card(s) reset to New`);
                    break;

                case "reschedule": {
                    // eslint-disable-next-line no-alert -- simple input prompt for date
                    const dateStr = window.prompt("Enter new due date (YYYY-MM-DD):");
                    if (!dateStr) return;
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                        notify().warning("Invalid date format");
                        return;
                    }
                    count = browser.bulkReschedule(selectedIds, date.toISOString());
                    notify().success(`${count} card(s) rescheduled`);
                    break;
                }
            }

            eventBus.emit({
                type: "cards:bulk-change",
                action: operation,
                cardIds: selectedIds,
                timestamp: Date.now(),
            });

            await this.loadCards();
            this.browser.clearSelection();
        } catch (error) {
            notify().operationFailed("execute operation", error);
        }
    }

    private render(): void {
        const state = this.browser;
        const prev = this.prevState;

        const cardsChanged = !prev || prev.filteredCards.length !== state.filteredCards.length ||
            prev.filteredCards.some((c, i) => c.id !== state.filteredCards[i]?.id);
        const selectionChanged = !prev || prev.selectedCardIds !== state.selectedCardIds;
        const loadingChanged = !prev || prev.isLoading !== state.isLoading;
        const sortChanged = !prev || prev.sortColumn !== state.sortColumn || prev.sortDirection !== state.sortDirection;
        const filtersChanged = !prev || prev.sidebarFilters !== state.sidebarFilters;
        const previewChanged = !prev || prev.previewCardId !== state.previewCardId;
        const searchChanged = !prev || prev.searchQuery !== state.searchQuery;

        if (!this.toolbarComponent) {
            this.toolbarComponent = new BrowserToolbar(
                this.toolbarContainer,
                {
                    searchQuery: state.searchQuery,
                    selectedCount: state.selectedCardIds.size,
                    totalCount: state.allCards.length,
                    filteredCount: state.filteredCards.length,
                },
                {
                    onSearchChange: (query) => this.browser.setSearchQuery(query),
                    onBulkOperation: (op) => void this.executeBulkOperation(op),
                    onSelectAll: () => this.browser.selectAll(),
                    onClearSelection: () => this.browser.clearSelection(),
                }
            );
            this.toolbarComponent.render();
        } else if (cardsChanged || selectionChanged || searchChanged) {
            this.toolbarComponent.update({
                searchQuery: state.searchQuery,
                selectedCount: state.selectedCardIds.size,
                totalCount: state.allCards.length,
                filteredCount: state.filteredCards.length,
            });
        }

        if (!this.sidebarComponent) {
            this.sidebarComponent = new BrowserSidebar(
                this.sidebarContainer,
                {
                    stateCounts: this.browser.getStateCounts(),
                    projects: this.browser.getUniqueProjects(),
                    currentFilters: state.sidebarFilters,
                },
                {
                    onFilterChange: (filters) => this.browser.setSidebarFilters(filters),
                    onClearFilters: () => this.browser.clearFilters(),
                }
            );
            this.sidebarComponent.render();
        } else if (cardsChanged || filtersChanged) {
            this.sidebarComponent.update({
                stateCounts: this.browser.getStateCounts(),
                projects: this.browser.getUniqueProjects(),
                currentFilters: state.sidebarFilters,
            });
        }

        if (!this.tableComponent || loadingChanged || sortChanged) {
            this.tableComponent?.destroy();
            this.tableContainer.empty();
            this.tableComponent = new VirtualTable(this.tableContainer, {
                app: this.app,
                cards: state.filteredCards,
                selectedCardIds: state.selectedCardIds,
                sortColumn: state.sortColumn,
                sortDirection: state.sortDirection,
                isLoading: state.isLoading,
                onCardClick: (cardId, event) => this.handleCardClick(cardId, event),
                onCardDoubleClick: (card) => void this.handleEditCard(card),
                onSortChange: (column) => this.browser.setSortColumn(column),
                onOpenSourceNote: (card) => void this.handleOpenSourceNote(card),
            });
            this.tableComponent.render();
        } else if (cardsChanged) {
            this.tableComponent.setCards(state.filteredCards);
        } else if (selectionChanged) {
            this.tableComponent.updateSelection(state.selectedCardIds);
        }

        if (!this.previewComponent) {
            const previewCard = this.browser.getPreviewCard();
            this.previewComponent = new BrowserPreview(
                this.previewContainer,
                {
                    card: previewCard,
                    app: this.app,
                    component: this,
                },
                {
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
                }
            );
            this.previewComponent.render();
        } else if (previewChanged || cardsChanged) {
            const previewCard = this.browser.getPreviewCard();
            this.previewComponent.update({ card: previewCard });
        }

        this.prevState = state;
    }

    private async executeSingleOperation(cardId: string, operation: BulkOperation): Promise<void> {
        const prevSelection = this.browser.selectedCardIds;
        this.browser.setState({ selectedCardIds: new Set([cardId]) });

        await this.executeBulkOperation(operation);

        if (operation !== "delete") {
            this.browser.setState({ selectedCardIds: prevSelection });
        }
    }

    async refresh(): Promise<void> {
        await this.loadCards();
    }
}
