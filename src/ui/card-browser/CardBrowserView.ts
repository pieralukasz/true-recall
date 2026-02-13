import { ItemView, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_CARD_BROWSER } from "../../constants";
import { notify } from "../../services";
import { effect } from "@preact/signals-core";
import { dataVersion, notifyCardChange, track } from "../../services/core/signals";
import { SelectionFooter } from "../components";
import { renderStateBadge } from "../components/StateBadge";
import { BrowserToolbar } from "./components/BrowserToolbar";
import { VirtualTable, type ColumnDef } from "./components/VirtualTable";
import { CardDetailPanel } from "./components/CardDetailPanel";
import { truncateText, formatDueDate, formatIntervalDays } from "./helpers/browser-helpers";
import type TrueRecallPlugin from "../../main";
import type { FSRSFlashcardItem } from "../../types";
import type { BrowserApi } from "../../state/store";

const COLUMNS: ColumnDef<FSRSFlashcardItem>[] = [
	{
		key: "question",
		label: "Question",
		width: "minmax(150px, 2fr)",
		sortable: true,
		render: (card, cell) => {
			cell.textContent = truncateText(card.question, 80);
		},
	},
	{
		key: "answer",
		label: "Answer",
		width: "minmax(120px, 1.5fr)",
		sortable: true,
		render: (card, cell) => {
			cell.textContent = truncateText(card.answer, 60);
		},
	},
	{
		key: "state",
		label: "State",
		width: "85px",
		sortable: true,
		render: (card, cell) => {
			renderStateBadge(cell, {
				state: card.fsrs.state,
				suspended: card.fsrs.suspended,
				buriedUntil: card.fsrs.buriedUntil,
				size: "sm",
			});
		},
	},
	{
		key: "due",
		label: "Due",
		width: "90px",
		sortable: true,
		render: (card, cell) => {
			cell.textContent = formatDueDate(card.fsrs.due);
		},
	},
	{
		key: "interval",
		label: "Interval",
		width: "70px",
		sortable: true,
		align: "right",
		render: (card, cell) => {
			cell.textContent = formatIntervalDays(card.fsrs.scheduledDays);
		},
	},
	{
		key: "lapses",
		label: "Lapses",
		width: "60px",
		sortable: true,
		align: "right",
		render: (card, cell) => {
			cell.textContent = String(card.fsrs.lapses);
		},
	},
	{
		key: "stability",
		label: "Stab.",
		width: "65px",
		sortable: true,
		align: "right",
		render: (card, cell) => {
			cell.textContent = card.fsrs.stability > 0
				? card.fsrs.stability.toFixed(1) : "-";
		},
	},
	{
		key: "difficulty",
		label: "Diff.",
		width: "60px",
		sortable: true,
		align: "right",
		render: (card, cell) => {
			cell.textContent = card.fsrs.difficulty.toFixed(1);
		},
	},
	{
		key: "source",
		label: "Source",
		width: "minmax(100px, 1fr)",
		sortable: true,
		render: (card, cell) => {
			cell.textContent = card.sourceNoteName ?? "-";
			cell.addClass("ep:truncate");
		},
	},
];

export class CardBrowserView extends ItemView {
	private plugin: TrueRecallPlugin;

	private toolbarComponent: BrowserToolbar | null = null;
	private tableComponent: VirtualTable<FSRSFlashcardItem> | null = null;
	private detailPanel: CardDetailPanel | null = null;
	private selectionFooterComponent: SelectionFooter | null = null;

	private mainContainer!: HTMLElement;
	private toolbarContainer!: HTMLElement;
	private tableContainer!: HTMLElement;
	private detailContainer!: HTMLElement;
	private footerContainer!: HTMLElement;

	private unsubscribe: (() => void) | null = null;
	private signalDisposer: (() => void) | null = null;
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;

	// Track what was last rendered to avoid unnecessary full rebuilds
	private lastFilteredCards: FSRSFlashcardItem[] = [];
	private lastPreviewCardId: string | null | undefined = undefined;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private get browser(): BrowserApi {
		return this.plugin.store!.getState().browser;
	}

	getViewType(): string {
		return VIEW_TYPE_CARD_BROWSER;
	}

	getDisplayText(): string {
		return "Card browser";
	}

	getIcon(): string {
		return "table-2";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("ep:flex", "ep:flex-col", "ep:h-full", "ep:overflow-hidden", "ep:bg-obs-primary");

		this.mainContainer = container.createDiv({
			cls: "ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0",
		});

		this.toolbarContainer = this.mainContainer.createDiv({ cls: "ep:shrink-0" });
		this.tableContainer = this.mainContainer.createDiv({
			cls: "ep:flex ep:flex-col ep:flex-1 ep:min-h-0 ep:overflow-hidden",
		});
		this.detailContainer = this.mainContainer.createDiv({ cls: "ep:shrink-0" });
		this.footerContainer = this.mainContainer.createDiv({ cls: "ep:shrink-0" });

		this.unsubscribe = this.plugin.store!.subscribe(
			(state) => state.browser,
			() => this.render()
		);

		this.signalDisposer = effect(() => {
			track(dataVersion);
			this.scheduleRefresh();
		});

		this.render();
		void this.loadData();
	}

	async onClose(): Promise<void> {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);
		this.unsubscribe?.();
		this.signalDisposer?.();
		this.toolbarComponent?.destroy();
		this.tableComponent?.destroy();
		this.detailPanel?.destroy();
		this.selectionFooterComponent?.destroy();
		this.browser.reset();
	}

	private loadData(): void {
		this.browser.setLoading(true);

		try {
			const cards = this.plugin.flashcardManager.getAllFSRSCards();
			this.browser.setCards(cards);
		} catch (error) {
			console.error("[CardBrowserView] Error loading data:", error);
			notify().error("Failed to load card browser data");
			this.browser.setLoading(false);
		}
	}

	private render(): void {
		const state = this.browser;
		const filteredCards = state.getFilteredAndSortedCards();

		// Toolbar
		if (!this.toolbarComponent) {
			this.toolbarComponent = new BrowserToolbar(this.toolbarContainer, {
				searchQuery: state.searchQuery,
				stateFilter: state.stateFilter,
				totalCount: state.allCards.length,
				filteredCount: filteredCards.length,
				onSearchChange: (q) => this.browser.setSearchQuery(q),
				onStateFilterChange: (f) => this.browser.setStateFilter(f),
				onRefresh: () => this.loadData(),
			});
		} else {
			this.toolbarComponent.updateProps({
				searchQuery: state.searchQuery,
				stateFilter: state.stateFilter,
				totalCount: state.allCards.length,
				filteredCount: filteredCards.length,
			});
		}

		// Table
		const itemsChanged = filteredCards !== this.lastFilteredCards;
		this.lastFilteredCards = filteredCards;

		if (!this.tableComponent) {
			this.tableComponent = new VirtualTable<FSRSFlashcardItem>(this.tableContainer, {
				items: filteredCards,
				columns: COLUMNS,
				getItemId: (card) => card.id,
				selectedIds: state.selectedCardIds,
				selectionMode: state.selectionMode,
				activeItemId: state.previewCardId,
				sortColumn: state.sortColumn,
				sortDirection: state.sortDirection,
				onRowClick: (card) => this.handleRowClick(card),
				onRowSelect: (id) => this.handleRowSelect(id),
				onSortChange: (col) => this.browser.cycleSortOnColumn(col as import("../../state/store").BrowserSortColumn),
				onSelectAll: () => this.handleSelectAll(),
			});
			this.tableComponent.render();
		} else {
			this.tableComponent.updateProps({
				items: itemsChanged ? filteredCards : undefined,
				selectedIds: state.selectedCardIds,
				selectionMode: state.selectionMode,
				activeItemId: state.previewCardId,
				sortColumn: state.sortColumn,
				sortDirection: state.sortDirection,
			});
		}

		// Detail panel
		this.renderDetailPanel(filteredCards);

		// Selection footer
		this.renderSelectionFooter();
	}

	private renderDetailPanel(filteredCards: FSRSFlashcardItem[]): void {
		const { previewCardId } = this.browser;

		if (previewCardId === this.lastPreviewCardId) return;
		this.lastPreviewCardId = previewCardId;

		this.detailPanel?.destroy();
		this.detailPanel = null;
		this.detailContainer.empty();

		if (!previewCardId) return;

		const card = filteredCards.find((c) => c.id === previewCardId)
			?? this.browser.allCards.find((c) => c.id === previewCardId);
		if (!card) return;

		this.detailPanel = new CardDetailPanel(this.detailContainer, {
			card,
			app: this.app,
			component: this,
			onClose: () => this.browser.setPreviewCardId(null),
			onOpenSource: (path) => void this.app.workspace.openLinkText(path, "", false),
			onSuspend: (id) => this.handleSingleSuspend(id),
			onUnsuspend: (id) => this.handleSingleUnsuspend(id),
			onDelete: (id) => this.handleSingleDelete(id),
			onReset: (id) => this.handleSingleReset(id),
		});
	}

	private renderSelectionFooter(): void {
		this.selectionFooterComponent?.destroy();
		this.selectionFooterComponent = null;
		this.footerContainer.empty();

		if (this.browser.selectionMode !== "selecting") return;

		const selectedCount = this.browser.selectedCardIds.size;

		this.selectionFooterComponent = new SelectionFooter(this.footerContainer, {
			display: { type: "selectedCount", count: selectedCount },
			actions: [
				{
					label: "Suspend",
					icon: "pause",
					onClick: () => this.handleBulkSuspend(),
					variant: "secondary",
					disabled: selectedCount === 0,
				},
				{
					label: "Unsuspend",
					icon: "play",
					onClick: () => this.handleBulkUnsuspend(),
					variant: "secondary",
					disabled: selectedCount === 0,
				},
				{
					label: "Reset",
					icon: "rotate-ccw",
					onClick: () => this.handleBulkReset(),
					variant: "secondary",
					disabled: selectedCount === 0,
				},
				{
					label: "Delete",
					icon: "trash-2",
					onClick: () => this.handleBulkDelete(),
					variant: "danger",
					disabled: selectedCount === 0,
				},
			],
			onCancel: () => this.browser.exitSelectionMode(),
		});
		this.selectionFooterComponent.render();
	}

	// ── Row interaction ─────────────────────

	private handleRowClick(card: FSRSFlashcardItem): void {
		// Toggle preview: clicking same card closes it, different card opens it
		const current = this.browser.previewCardId;
		this.browser.setPreviewCardId(current === card.id ? null : card.id);
	}

	private handleRowSelect(cardId: string): void {
		if (this.browser.selectionMode !== "selecting") {
			this.browser.enterSelectionMode(cardId);
		} else {
			this.browser.toggleCardSelection(cardId);
		}
	}

	private handleSelectAll(): void {
		const state = this.browser;
		const filteredCards = state.getFilteredAndSortedCards();
		const allSelected = filteredCards.length > 0
			&& filteredCards.every((c) => state.selectedCardIds.has(c.id));

		if (allSelected) {
			this.browser.exitSelectionMode();
		} else {
			this.browser.selectAll();
		}
	}

	// ── Single card operations (from detail panel) ─────

	private handleSingleSuspend(cardId: string): void {
		this.plugin.cardStore.cards.bulkSuspend([cardId]);
		notifyCardChange({ type: "bulk", cardIds: [cardId], action: "suspend" });
		notify().success("Card suspended");
	}

	private handleSingleUnsuspend(cardId: string): void {
		this.plugin.cardStore.cards.bulkUnsuspend([cardId]);
		notifyCardChange({ type: "bulk", cardIds: [cardId], action: "unsuspend" });
		notify().success("Card unsuspended");
	}

	private handleSingleDelete(cardId: string): void {
		this.plugin.cardStore.cards.bulkSoftDelete([cardId]);
		notifyCardChange({ type: "removed", cardId });
		this.browser.setPreviewCardId(null);
		notify().success("Card deleted");
	}

	private handleSingleReset(cardId: string): void {
		this.plugin.cardStore.cards.bulkReset([cardId]);
		notifyCardChange({ type: "bulk", cardIds: [cardId], action: "reset" });
		notify().success("Card reset to new");
	}

	// ── Bulk operations (from selection footer) ─────

	private handleBulkSuspend(): void {
		const ids = this.browser.getSelectedCardIds();
		if (ids.length === 0) return;

		this.plugin.cardStore.cards.bulkSuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "suspend" });
		this.browser.exitSelectionMode();
		notify().success(`Suspended ${ids.length} card(s)`);
	}

	private handleBulkUnsuspend(): void {
		const ids = this.browser.getSelectedCardIds();
		if (ids.length === 0) return;

		this.plugin.cardStore.cards.bulkUnsuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "unsuspend" });
		this.browser.exitSelectionMode();
		notify().success(`Unsuspended ${ids.length} card(s)`);
	}

	private handleBulkReset(): void {
		const ids = this.browser.getSelectedCardIds();
		if (ids.length === 0) return;

		this.plugin.cardStore.cards.bulkReset(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "reset" });
		this.browser.exitSelectionMode();
		notify().success(`Reset ${ids.length} card(s) to new`);
	}

	private handleBulkDelete(): void {
		const ids = this.browser.getSelectedCardIds();
		if (ids.length === 0) return;

		this.plugin.cardStore.cards.bulkSoftDelete(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "delete" });
		this.browser.exitSelectionMode();
		notify().success(`Deleted ${ids.length} card(s)`);
	}

	// ── Refresh ─────────────────────────────

	private scheduleRefresh(): void {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);
		this.refreshTimer = setTimeout(() => {
			this.loadData();
		}, 500);
	}
}
