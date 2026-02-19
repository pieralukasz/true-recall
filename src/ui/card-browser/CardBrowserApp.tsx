import { effect } from "@preact/signals";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { notify } from "../../services";
import {
	dataVersion,
	notifyCardChange,
	track,
} from "../../services/core/signals";
import type {
	BrowserApi,
	BrowserSortColumn,
	BrowserStateFilter,
	SelectionMode,
} from "../../state/store";
import type { FSRSFlashcardItem } from "../../types";
import { useApp, usePlugin } from "../preact";
import {
	ActionButton,
	IconButton,
	LoadingSpinner,
	SearchInput,
	StateBadge,
} from "../preact/components";
import { useIcon, useMarkdown } from "../preact/hooks";
import {
	formatDueDate,
	formatIntervalDays,
	truncateText,
} from "./helpers/browser-helpers";

// ── Constants ──────────────────────────────────────────────────

const ROW_HEIGHT = 36;
const BUFFER_SIZE = 10;

const STATE_FILTERS: { value: BrowserStateFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "new", label: "New" },
	{ value: "learning", label: "Learning" },
	{ value: "review", label: "Review" },
	{ value: "relearning", label: "Relearn" },
	{ value: "suspended", label: "Suspended" },
	{ value: "buried", label: "Buried" },
];

interface ColumnDef {
	key: string;
	label: string;
	width: string;
	sortable?: boolean;
	align?: "left" | "right";
	render: (card: FSRSFlashcardItem) => preact.ComponentChildren;
}

const COLUMNS: ColumnDef[] = [
	{
		key: "question",
		label: "Question",
		width: "minmax(150px, 2fr)",
		sortable: true,
		render: (card) => truncateText(card.question, 80),
	},
	{
		key: "answer",
		label: "Answer",
		width: "minmax(120px, 1.5fr)",
		sortable: true,
		render: (card) => truncateText(card.answer, 60),
	},
	{
		key: "state",
		label: "State",
		width: "85px",
		sortable: true,
		render: (card) => (
			<StateBadge
				state={card.fsrs.state}
				suspended={card.fsrs.suspended}
				buriedUntil={card.fsrs.buriedUntil}
				size="sm"
			/>
		),
	},
	{
		key: "due",
		label: "Due",
		width: "90px",
		sortable: true,
		render: (card) => formatDueDate(card.fsrs.due),
	},
	{
		key: "interval",
		label: "Interval",
		width: "70px",
		sortable: true,
		align: "right",
		render: (card) => formatIntervalDays(card.fsrs.scheduledDays),
	},
	{
		key: "lapses",
		label: "Lapses",
		width: "60px",
		sortable: true,
		align: "right",
		render: (card) => String(card.fsrs.lapses),
	},
	{
		key: "stability",
		label: "Stab.",
		width: "65px",
		sortable: true,
		align: "right",
		render: (card) =>
			card.fsrs.stability > 0 ? card.fsrs.stability.toFixed(1) : "-",
	},
	{
		key: "difficulty",
		label: "Diff.",
		width: "60px",
		sortable: true,
		align: "right",
		render: (card) => card.fsrs.difficulty.toFixed(1),
	},
	{
		key: "source",
		label: "Source",
		width: "minmax(100px, 1fr)",
		sortable: true,
		render: (card) => (
			<span class="ep:truncate">{card.sourceNoteName ?? "-"}</span>
		),
	},
];

const PILL_BASE =
	"ep:px-2 ep:py-0.5 ep:rounded-full ep:text-ui-smaller ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";
const PILL_ACTIVE = `${PILL_BASE} ep:bg-obs-interactive ep:text-obs-on-accent`;
const PILL_INACTIVE = `${PILL_BASE} ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal`;

// ── Hooks ──────────────────────────────────────────────────────

function useBrowser(): BrowserApi {
	return usePlugin().store?.getState().browser;
}

function useBrowserState() {
	const plugin = usePlugin();
	const [state, setState] = useState(() => {
		const b = plugin.store?.getState().browser;
		return {
			isLoading: b.isLoading,
			allCards: b.allCards,
			searchQuery: b.searchQuery,
			stateFilter: b.stateFilter as BrowserStateFilter,
			sortColumn: b.sortColumn as BrowserSortColumn,
			sortDirection: b.sortDirection as "asc" | "desc",
			selectionMode: b.selectionMode as SelectionMode,
			selectedCardIds: b.selectedCardIds,
			previewCardId: b.previewCardId,
			filteredCards: b.getFilteredAndSortedCards(),
		};
	});

	useEffect(() => {
		const unsub = plugin.store?.subscribe(
			(s) => s.browser,
			() => {
				const b = plugin.store?.getState().browser;
				setState({
					isLoading: b.isLoading,
					allCards: b.allCards,
					searchQuery: b.searchQuery,
					stateFilter: b.stateFilter as BrowserStateFilter,
					sortColumn: b.sortColumn as BrowserSortColumn,
					sortDirection: b.sortDirection as "asc" | "desc",
					selectionMode: b.selectionMode as SelectionMode,
					selectedCardIds: b.selectedCardIds,
					previewCardId: b.previewCardId,
					filteredCards: b.getFilteredAndSortedCards(),
				});
			},
		);
		return unsub;
	}, [plugin]);

	return state;
}

function useLoadData() {
	const plugin = usePlugin();

	return useCallback(() => {
		const browser = plugin.store?.getState().browser;
		browser.setLoading(true);

		try {
			const cards = plugin.flashcardManager.getAllFSRSCards();
			browser.setCards(cards);
		} catch (error) {
			console.error("[CardBrowserView] Error loading data:", error);
			notify().error("Failed to load card browser data");
			browser.setLoading(false);
		}
	}, [plugin]);
}

// ── Root Component ─────────────────────────────────────────────

export function CardBrowserApp() {
	const state = useBrowserState();
	const browser = useBrowser();
	const loadData = useLoadData();
	const app = useApp();
	const plugin = usePlugin();
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion);
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = setTimeout(() => {
				loadData();
			}, 500);
		});
		return () => {
			dispose();
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
		};
	}, [loadData]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Reset store on unmount
	useEffect(() => {
		return () => browser.reset();
	}, [browser]);

	const previewCard = useMemo(() => {
		if (!state.previewCardId) return null;
		return (
			state.filteredCards.find((c) => c.id === state.previewCardId) ??
			state.allCards.find((c) => c.id === state.previewCardId) ??
			null
		);
	}, [state.previewCardId, state.filteredCards, state.allCards]);

	const handleRowClick = useCallback(
		(card: FSRSFlashcardItem) => {
			const current = browser.previewCardId;
			browser.setPreviewCardId(current === card.id ? null : card.id);
		},
		[browser],
	);

	const handleRowSelect = useCallback(
		(cardId: string) => {
			if (browser.selectionMode !== "selecting") {
				browser.enterSelectionMode(cardId);
			} else {
				browser.toggleCardSelection(cardId);
			}
		},
		[browser],
	);

	const handleSelectAll = useCallback(() => {
		const filtered = browser.getFilteredAndSortedCards();
		const allSelected =
			filtered.length > 0 &&
			filtered.every((c) => browser.selectedCardIds.has(c.id));

		if (allSelected) {
			browser.exitSelectionMode();
		} else {
			browser.selectAll();
		}
	}, [browser]);

	// Single card operations
	const handleSingleSuspend = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkSuspend([cardId]);
			notifyCardChange({ type: "bulk", cardIds: [cardId], action: "suspend" });
			notify().success("Card suspended");
		},
		[plugin],
	);

	const handleSingleUnsuspend = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkUnsuspend([cardId]);
			notifyCardChange({
				type: "bulk",
				cardIds: [cardId],
				action: "unsuspend",
			});
			notify().success("Card unsuspended");
		},
		[plugin],
	);

	const handleSingleDelete = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkSoftDelete([cardId]);
			notifyCardChange({ type: "removed", cardId });
			browser.setPreviewCardId(null);
			notify().success("Card deleted");
		},
		[plugin, browser],
	);

	const handleSingleReset = useCallback(
		(cardId: string) => {
			plugin.cardStore.cards.bulkReset([cardId]);
			notifyCardChange({ type: "bulk", cardIds: [cardId], action: "reset" });
			notify().success("Card reset to new");
		},
		[plugin],
	);

	// Bulk operations
	const handleBulkSuspend = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkSuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "suspend" });
		browser.exitSelectionMode();
		notify().success(`Suspended ${ids.length} card(s)`);
	}, [plugin, browser]);

	const handleBulkUnsuspend = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkUnsuspend(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "unsuspend" });
		browser.exitSelectionMode();
		notify().success(`Unsuspended ${ids.length} card(s)`);
	}, [plugin, browser]);

	const handleBulkReset = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkReset(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "reset" });
		browser.exitSelectionMode();
		notify().success(`Reset ${ids.length} card(s) to new`);
	}, [plugin, browser]);

	const handleBulkDelete = useCallback(() => {
		const ids = browser.getSelectedCardIds();
		if (ids.length === 0) return;
		plugin.cardStore.cards.bulkSoftDelete(ids);
		notifyCardChange({ type: "bulk", cardIds: ids, action: "delete" });
		browser.exitSelectionMode();
		notify().success(`Deleted ${ids.length} card(s)`);
	}, [plugin, browser]);

	if (state.isLoading) {
		return (
			<div class="ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0">
				<LoadingSpinner />
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0">
			<div class="ep:shrink-0">
				<BrowserToolbar
					searchQuery={state.searchQuery}
					stateFilter={state.stateFilter}
					totalCount={state.allCards.length}
					filteredCount={state.filteredCards.length}
					onSearchChange={(q) => browser.setSearchQuery(q)}
					onStateFilterChange={(f) => browser.setStateFilter(f)}
					onRefresh={loadData}
				/>
			</div>
			<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0 ep:overflow-hidden">
				<VirtualTable
					data={state.filteredCards}
					columns={COLUMNS}
					selectionMode={state.selectionMode}
					selectedIds={state.selectedCardIds}
					activeItemId={state.previewCardId}
					sortColumn={state.sortColumn}
					sortDirection={state.sortDirection}
					onRowClick={handleRowClick}
					onRowSelect={handleRowSelect}
					onSortChange={(col) =>
						browser.cycleSortOnColumn(col as BrowserSortColumn)
					}
					onSelectAll={handleSelectAll}
				/>
			</div>
			{previewCard && (
				<div class="ep:shrink-0">
					<CardDetailPanel
						card={previewCard}
						onClose={() => browser.setPreviewCardId(null)}
						onOpenSource={(path) =>
							void app.workspace.openLinkText(path, "", false)
						}
						onSuspend={handleSingleSuspend}
						onUnsuspend={handleSingleUnsuspend}
						onDelete={handleSingleDelete}
						onReset={handleSingleReset}
					/>
				</div>
			)}
			{state.selectionMode === "selecting" && (
				<div class="ep:shrink-0">
					<SelectionBar
						selectedCount={state.selectedCardIds.size}
						onCancel={() => browser.exitSelectionMode()}
						onSuspend={handleBulkSuspend}
						onUnsuspend={handleBulkUnsuspend}
						onReset={handleBulkReset}
						onDelete={handleBulkDelete}
					/>
				</div>
			)}
		</div>
	);
}

// ── BrowserToolbar ─────────────────────────────────────────────

interface BrowserToolbarProps {
	searchQuery: string;
	stateFilter: BrowserStateFilter;
	totalCount: number;
	filteredCount: number;
	onSearchChange: (query: string) => void;
	onStateFilterChange: (filter: BrowserStateFilter) => void;
	onRefresh: () => void;
}

function BrowserToolbar({
	searchQuery,
	stateFilter,
	totalCount,
	filteredCount,
	onSearchChange,
	onStateFilterChange,
	onRefresh,
}: BrowserToolbarProps) {
	const countText =
		filteredCount === totalCount
			? `${totalCount} cards`
			: `${filteredCount} of ${totalCount} cards`;

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:border-b ep:border-obs-border">
			<div class="ep:flex ep:items-center ep:gap-2">
				<SearchInput
					value={searchQuery}
					placeholder="Search cards\u2026"
					onChange={onSearchChange}
					class="ep:flex-1"
				/>
				<IconButton icon="refresh-cw" ariaLabel="Refresh" onClick={onRefresh} />
			</div>
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-2 ep:flex-wrap">
				<div class="ep:flex ep:items-center ep:gap-1 ep:flex-wrap">
					{STATE_FILTERS.map((f) => (
						<button
							type="button"
							key={f.value}
							class={stateFilter === f.value ? PILL_ACTIVE : PILL_INACTIVE}
							onClick={() => onStateFilterChange(f.value)}
						>
							{f.label}
						</button>
					))}
				</div>
				<span
					class="ep:text-ui-smaller ep:text-obs-muted ep:whitespace-nowrap"
					aria-live="polite"
				>
					{countText}
				</span>
			</div>
		</div>
	);
}

// ── VirtualTable ───────────────────────────────────────────────

interface VirtualTableProps {
	data: FSRSFlashcardItem[];
	columns: ColumnDef[];
	selectionMode: SelectionMode;
	selectedIds: Set<string>;
	activeItemId: string | null;
	sortColumn: BrowserSortColumn;
	sortDirection: "asc" | "desc";
	onRowClick: (card: FSRSFlashcardItem) => void;
	onRowSelect: (cardId: string) => void;
	onSortChange: (column: string) => void;
	onSelectAll: () => void;
}

function VirtualTable({
	data,
	columns,
	selectionMode,
	selectedIds,
	activeItemId,
	sortColumn,
	sortDirection,
	onRowClick,
	onRowSelect,
	onSortChange,
	onSelectAll,
}: VirtualTableProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [containerHeight, setContainerHeight] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		setContainerHeight(el.clientHeight);

		const onScroll = () => setScrollTop(el.scrollTop);
		el.addEventListener("scroll", onScroll);

		const ro = new ResizeObserver(() => {
			setContainerHeight(el.clientHeight);
		});
		ro.observe(el);

		return () => {
			el.removeEventListener("scroll", onScroll);
			ro.disconnect();
		};
	}, []);

	const gridTemplate = useMemo(() => {
		const checkboxCol = "32px";
		const cols = columns.map((c) => c.width);
		return [checkboxCol, ...cols].join(" ");
	}, [columns]);

	const totalHeight = data.length * ROW_HEIGHT;
	const startIndex = Math.max(
		0,
		Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE,
	);
	const endIndex = Math.min(
		data.length,
		Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_SIZE,
	);
	const visibleItems = data.slice(startIndex, endIndex);

	const allSelected = useMemo(
		() => data.length > 0 && data.every((c) => selectedIds.has(c.id)),
		[data, selectedIds],
	);

	const sortDirIcon = useIcon(
		sortDirection === "asc" ? "arrow-up" : "arrow-down",
	);

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0 ep:overflow-x-auto">
			{/* Header */}
			<div class="ep:shrink-0 ep:border-b ep:border-obs-border ep:bg-obs-secondary">
				<div
					class="ep:grid ep:items-center ep:min-w-max"
					style={{
						gridTemplateColumns: gridTemplate,
						height: `${ROW_HEIGHT}px`,
					}}
				>
					<div class="ep:flex ep:items-center ep:justify-center">
						{selectionMode === "selecting" && (
							<input
								type="checkbox"
								class="ep:cursor-pointer"
								checked={allSelected}
								onClick={(e) => {
									e.stopPropagation();
									onSelectAll();
								}}
							/>
						)}
					</div>
					{columns.map((col) => (
						<div
							key={col.key}
							class={`ep:flex ep:items-center ep:gap-1 ep:px-2 ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide ep:select-none ${
								col.align === "right" ? "ep:justify-end" : ""
							} ${col.sortable ? "ep:cursor-pointer ep:hover:text-obs-normal" : ""}`}
							role={col.sortable ? "button" : undefined}
							tabIndex={col.sortable ? 0 : undefined}
							onClick={col.sortable ? () => onSortChange(col.key) : undefined}
							onKeyDown={col.sortable ? (e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onSortChange(col.key);
								}
							} : undefined}
						>
							<span>{col.label}</span>
							{col.sortable && sortColumn === col.key && (
								<span
									class="ep:flex ep:items-center ep:w-3 ep:h-3"
									ref={sortDirIcon}
								/>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Body */}
			<div
				ref={containerRef}
				class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto ep:overflow-x-hidden"
			>
				<div
					class="ep:relative ep:min-w-max"
					style={{ height: `${totalHeight}px` }}
				>
					{visibleItems.map((card, i) => {
						const index = startIndex + i;
						const isSelected = selectedIds.has(card.id);
						const isActive = activeItemId === card.id;
						const top = index * ROW_HEIGHT;

						let bgCls = "ep:hover:bg-obs-modifier-hover";
						if (isActive) bgCls = "ep:bg-obs-blue/10";
						else if (isSelected) bgCls = "ep:bg-obs-modifier-hover";

						return (
							<div
								key={card.id}
								class={`ep:absolute ep:left-0 ep:right-0 ep:grid ep:items-center ep:cursor-pointer ep:border-b ep:border-obs-border/50 ep:transition-colors ${bgCls}`}
								role="button"
								tabIndex={0}
								style={{
									top: `${top}px`,
									height: `${ROW_HEIGHT}px`,
									gridTemplateColumns: gridTemplate,
								}}
								onClick={() => {
									if (selectionMode === "selecting") {
										onRowSelect(card.id);
									} else {
										onRowClick(card);
									}
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										if (selectionMode === "selecting") {
											onRowSelect(card.id);
										} else {
											onRowClick(card);
										}
									}
								}}
							>
								<div class="ep:flex ep:items-center ep:justify-center">
									{selectionMode === "selecting" && (
										<input
											type="checkbox"
											class="ep:cursor-pointer"
											checked={isSelected}
											onClick={(e) => {
												e.stopPropagation();
												onRowSelect(card.id);
											}}
										/>
									)}
								</div>
								{columns.map((col) => (
									<div
										key={col.key}
										class={`ep:px-2 ep:truncate ep:text-ui-smaller ${
											col.align === "right" ? "ep:text-right" : ""
										}`}
									>
										{col.render(card)}
									</div>
								))}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ── CardDetailPanel ────────────────────────────────────────────

interface CardDetailPanelProps {
	card: FSRSFlashcardItem;
	onClose: () => void;
	onOpenSource: (path: string) => void;
	onSuspend: (cardId: string) => void;
	onUnsuspend: (cardId: string) => void;
	onDelete: (cardId: string) => void;
	onReset: (cardId: string) => void;
}

function CardDetailPanel({
	card,
	onClose,
	onOpenSource,
	onSuspend,
	onUnsuspend,
	onDelete,
	onReset,
}: CardDetailPanelProps) {
	const questionRef = useMarkdown(card.question);
	const answerRef = useMarkdown(card.answer);

	const fields: [string, string][] = useMemo(
		() => [
			["Due", formatDueDate(card.fsrs.due)],
			["Interval", formatIntervalDays(card.fsrs.scheduledDays)],
			[
				"Stability",
				card.fsrs.stability > 0 ? `${card.fsrs.stability.toFixed(1)}d` : "-",
			],
			["Difficulty", card.fsrs.difficulty.toFixed(1)],
			["Lapses", String(card.fsrs.lapses)],
			["Reps", String(card.fsrs.reps)],
			[
				"Created",
				card.fsrs.createdAt
					? new Date(card.fsrs.createdAt).toLocaleDateString()
					: "-",
			],
			[
				"Last review",
				card.fsrs.lastReview
					? new Date(card.fsrs.lastReview).toLocaleDateString()
					: "-",
			],
			["Projects", card.projects.length > 0 ? card.projects.join(", ") : "-"],
		],
		[card],
	);

	return (
		<div class="ep:border-t ep:border-obs-border ep:bg-obs-primary ep:flex ep:flex-col ep:h-[220px] ep:shrink-0">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:border-b ep:border-obs-border ep:shrink-0">
				<IconButton icon="x" ariaLabel="Close preview" onClick={onClose} />

				<StateBadge
					state={card.fsrs.state}
					suspended={card.fsrs.suspended}
					buriedUntil={card.fsrs.buriedUntil}
					size="sm"
				/>

				{card.cardType && card.cardType !== "basic" && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:uppercase">
						{card.cardType}
					</span>
				)}

				<div class="ep:flex-1" />

				{card.sourceNoteName && card.sourceNotePath && (
					<button
						type="button"
						class="ep:text-ui-smaller ep:text-obs-accent ep:hover:underline ep:cursor-pointer ep:truncate ep:max-w-[200px] ep:bg-transparent ep:border-none ep:p-0"
						onClick={() => {
							if (card.sourceNotePath) onOpenSource(card.sourceNotePath);
						}}
					>
						{card.sourceNoteName}
					</button>
				)}

				<div class="ep:flex ep:items-center ep:gap-1">
					{card.fsrs.suspended ? (
						<IconButton
							icon="play"
							ariaLabel="Unsuspend"
							onClick={() => onUnsuspend(card.id)}
						/>
					) : (
						<IconButton
							icon="pause"
							ariaLabel="Suspend"
							onClick={() => onSuspend(card.id)}
						/>
					)}
					<IconButton
						icon="rotate-ccw"
						ariaLabel="Reset"
						onClick={() => onReset(card.id)}
					/>
					<IconButton
						icon="trash-2"
						ariaLabel="Delete"
						danger
						onClick={() => onDelete(card.id)}
					/>
				</div>
			</div>

			{/* Content */}
			<div class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
				<div class="ep:grid ep:grid-cols-[1fr_1fr] ep:gap-0 ep:h-full">
					{/* Left: Q & A */}
					<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:border-r ep:border-obs-border ep:overflow-y-auto">
						<div>
							<div class="ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:mb-1">
								Q:
							</div>
							<div
								class="ep:text-ui-small ep:text-obs-normal"
								ref={questionRef}
							/>
						</div>
						<div>
							<div class="ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:mb-1">
								A:
							</div>
							<div
								class="ep:text-ui-small ep:text-obs-normal"
								ref={answerRef}
							/>
						</div>
					</div>

					{/* Right: Metadata */}
					<div class="ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:p-3 ep:content-start ep:overflow-y-auto">
						{fields.map(([label, value]) => (
							<>
								<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
									{label}
								</span>
								<span class="ep:text-ui-smaller ep:text-obs-normal">
									{value}
								</span>
							</>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// ── SelectionBar ───────────────────────────────────────────────

interface SelectionBarProps {
	selectedCount: number;
	onCancel: () => void;
	onSuspend: () => void;
	onUnsuspend: () => void;
	onReset: () => void;
	onDelete: () => void;
}

function SelectionBar({
	selectedCount,
	onCancel,
	onSuspend,
	onUnsuspend,
	onReset,
	onDelete,
}: SelectionBarProps) {
	const disabled = selectedCount === 0;

	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary">
			<div class="ep:flex ep:items-center ep:gap-2">
				<IconButton icon="x" ariaLabel="Cancel selection" onClick={onCancel} />
				<span class="ep:text-ui-small ep:text-obs-normal ep:font-medium">
					Selected: {selectedCount}
				</span>
			</div>
			<div class="ep:flex ep:items-center ep:gap-2">
				<ActionButton
					label="Suspend"
					icon="pause"
					variant="secondary"
					disabled={disabled}
					onClick={onSuspend}
				/>
				<ActionButton
					label="Unsuspend"
					icon="play"
					variant="secondary"
					disabled={disabled}
					onClick={onUnsuspend}
				/>
				<ActionButton
					label="Reset"
					icon="rotate-ccw"
					variant="secondary"
					disabled={disabled}
					onClick={onReset}
				/>
				<ActionButton
					label="Delete"
					icon="trash-2"
					variant="danger"
					disabled={disabled}
					onClick={onDelete}
				/>
			</div>
		</div>
	);
}
