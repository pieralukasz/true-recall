import { effect } from "@preact/signals";
import {
	MarkdownRenderer,
	Menu,
	Component as ObsidianComponent,
	Platform,
} from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { State } from "ts-fsrs";
import type TrueRecallPlugin from "../../main";
import { notify } from "../../services";
import {
	dataVersion,
	settingsVersion,
	track,
} from "../../services/core/signals";
import type { PanelApi, SelectionMode } from "../../state/store";
import type { FlashcardInfo, FlashcardItem } from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { stripBrTags } from "../../utils";
import { useApp, usePlugin } from "../preact";
import {
	ActionButton,
	EmptyState,
	EmptyStateMessages,
	Panel,
	SearchInput,
} from "../preact/components";
import { useIcon } from "../preact/hooks";
import { groupCards } from "./group-cards";

// ── Hooks ──────────────────────────────────────────────────────

function usePanelApi(): PanelApi {
	return usePlugin().store!.getState().panel;
}

function usePanelState() {
	const plugin = usePlugin();
	const [state, setState] = useState(() => {
		const p = plugin.store!.getState().panel;
		return {
			currentFile: p.currentFile,
			flashcardInfo: p.flashcardInfo,
			status: p.status,
			viewMode: p.viewMode,
			uncollectedCount: p.uncollectedCount,
			isFollowingReview: p.isFollowingReview,
			isAddCardExpanded: p.isAddCardExpanded,
			selectionMode: p.selectionMode as SelectionMode,
			selectedCardIds: p.selectedCardIds,
			expandedCardIds: p.expandedCardIds,
			searchQuery: p.searchQuery,
		};
	});

	useEffect(() => {
		const unsub = plugin.store!.subscribe(
			(s) => s.panel,
			() => {
				const p = plugin.store!.getState().panel;
				setState({
					currentFile: p.currentFile,
					flashcardInfo: p.flashcardInfo,
					status: p.status,
					viewMode: p.viewMode,
					uncollectedCount: p.uncollectedCount,
					isFollowingReview: p.isFollowingReview,
					isAddCardExpanded: p.isAddCardExpanded,
					selectionMode: p.selectionMode as SelectionMode,
					selectedCardIds: p.selectedCardIds,
					expandedCardIds: p.expandedCardIds,
					searchQuery: p.searchQuery,
				});
			},
		);
		return unsub;
	}, [plugin]);

	return state;
}

function useCardsWithFsrs(
	flashcardInfo: FlashcardInfo | null,
): FSRSFlashcardItem[] {
	const plugin = usePlugin();
	const [dataVer, setDataVer] = useState(0);

	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion, settingsVersion);
			setDataVer((v) => v + 1);
		});
		return dispose;
	}, []);

	return useMemo(() => {
		// dataVer used for reactivity
		void dataVer;
		if (!flashcardInfo?.flashcards) return [];
		if (!plugin.flashcardManager.hasStore()) return [];
		const cardIds = flashcardInfo.flashcards.map((c) => c.id);
		return plugin.flashcardManager.getCardsByIds(cardIds);
	}, [flashcardInfo, plugin, dataVer]);
}

// ── Status Dot Helpers ──────────────────────────────────────────

function getStatusDotColor(fsrsCard?: FSRSFlashcardItem): string {
	if (!fsrsCard) return "var(--text-muted)";
	switch (fsrsCard.fsrs.state) {
		case State.New:
			return "var(--color-green)";
		case State.Learning:
		case State.Relearning:
			return "var(--color-orange)";
		case State.Review:
			return "var(--color-blue)";
		default:
			return "var(--text-muted)";
	}
}

function getStatusTitle(fsrsCard?: FSRSFlashcardItem): string {
	if (!fsrsCard) return "Unknown";
	switch (fsrsCard.fsrs.state) {
		case State.New:
			return "New";
		case State.Learning:
			return "Learning";
		case State.Relearning:
			return "Relearning";
		case State.Review:
			return "Review";
		default:
			return "Unknown";
	}
}

function isSuspended(fsrsCard?: FSRSFlashcardItem): boolean {
	return fsrsCard?.fsrs.suspended === true;
}

function isBuried(fsrsCard?: FSRSFlashcardItem): boolean {
	const buriedUntil = fsrsCard?.fsrs.buriedUntil;
	if (!buriedUntil) return false;
	return new Date(buriedUntil) > new Date();
}

function getAggregateStatusDotColor(
	fsrsCards: (FSRSFlashcardItem | undefined)[],
): string {
	let hasNew = false;
	let hasLearning = false;
	let hasReview = false;

	for (const fsrs of fsrsCards) {
		if (!fsrs) continue;
		switch (fsrs.fsrs.state) {
			case State.New:
				hasNew = true;
				break;
			case State.Learning:
			case State.Relearning:
				hasLearning = true;
				break;
			case State.Review:
				hasReview = true;
				break;
		}
	}

	if (hasNew) return "var(--color-green)";
	if (hasLearning) return "var(--color-orange)";
	if (hasReview) return "var(--color-blue)";
	return "var(--text-muted)";
}

function getAggregateStatusTitle(
	fsrsCards: (FSRSFlashcardItem | undefined)[],
): string {
	const counts = { new: 0, learning: 0, review: 0 };
	for (const fsrs of fsrsCards) {
		if (!fsrs) continue;
		switch (fsrs.fsrs.state) {
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
	const parts: string[] = [];
	if (counts.new > 0) parts.push(`${counts.new} new`);
	if (counts.learning > 0) parts.push(`${counts.learning} learning`);
	if (counts.review > 0) parts.push(`${counts.review} review`);
	return parts.join(", ") || "Unknown";
}

// ── Header Status Count Helper ──────────────────────────────────

interface StatusCounts {
	new: number;
	learning: number;
	review: number;
}

function countByState(
	cards: FSRSFlashcardItem[],
	reviewedToday?: Set<string>,
	dayStartHour = 4,
): StatusCounts {
	const counts: StatusCounts = { new: 0, learning: 0, review: 0 };
	const now = new Date();

	const todayBoundary = new Date(now);
	if (now.getHours() < dayStartHour) {
		todayBoundary.setDate(todayBoundary.getDate() - 1);
	}
	todayBoundary.setHours(dayStartHour, 0, 0, 0);
	const tomorrowBoundary = new Date(todayBoundary);
	tomorrowBoundary.setDate(tomorrowBoundary.getDate() + 1);

	for (const card of cards) {
		if (card.fsrs.suspended) continue;
		if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
			continue;

		const isLearning =
			card.fsrs.state === State.Learning ||
			card.fsrs.state === State.Relearning;
		if (!isLearning && reviewedToday?.has(card.id)) continue;

		switch (card.fsrs.state) {
			case State.New:
				counts.new++;
				break;
			case State.Learning:
			case State.Relearning:
				counts.learning++;
				break;
			case State.Review: {
				const dueDate = new Date(card.fsrs.due);
				if (dueDate < tomorrowBoundary) {
					counts.review++;
				}
				break;
			}
		}
	}
	return counts;
}

// ── Markdown Content Component ──────────────────────────────────

function MarkdownContent({
	markdown,
	filePath,
	class: cls,
	onLinkClick,
}: {
	markdown: string;
	filePath: string;
	class?: string;
	onLinkClick?: (href: string) => void;
}) {
	const app = useApp();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		el.empty();
		const obsComponent = new ObsidianComponent();
		void MarkdownRenderer.render(
			app,
			stripBrTags(markdown),
			el,
			filePath,
			obsComponent,
		);

		// Setup cmd+click for internal links
		if (onLinkClick) {
			const handler = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				const linkEl = target.closest("a.internal-link");
				if (!linkEl) return;

				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();

				if (e.metaKey || e.ctrlKey) {
					const href = linkEl.getAttribute("data-href");
					if (href) onLinkClick(href);
				}
			};
			el.addEventListener("click", handler, true);
			return () => {
				el.removeEventListener("click", handler, true);
				obsComponent.unload();
			};
		}

		return () => obsComponent.unload();
	}, [app, markdown, filePath, onLinkClick]);

	return <div ref={ref} class={cls ?? ""} />;
}

// ── Status Dot Component ────────────────────────────────────────

function StatusDot({ color, title }: { color: string; title: string }) {
	return (
		<div
			class="ep:w-2.5 ep:h-2.5 ep:rounded-full ep:flex-shrink-0 ep-dynamic-bg"
			title={title}
			style={{ "--ep-dynamic-color": color } as Record<string, string>}
		/>
	);
}

// ── CompactCard Component ───────────────────────────────────────

interface CompactCardProps {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	filePath: string;
	isExpanded: boolean;
	isSelected: boolean;
	isSelectionMode: boolean;
	onToggleExpand: () => void;
	onToggleSelect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onCopy: () => void;
	onMove: () => void;
	onSelect: () => void;
	onLongPress: () => void;
}

function CompactCard({
	card,
	fsrsCard,
	filePath,
	isExpanded,
	isSelected,
	isSelectionMode,
	onToggleExpand,
	onToggleSelect,
	onEdit,
	onDelete,
	onCopy,
	onMove,
	onSelect,
	onLongPress,
}: CompactCardProps) {
	const app = useApp();
	const menuIconRef = useIcon("more-vertical");
	const longPressRef = useRef<{
		timer: ReturnType<typeof setTimeout> | null;
		wasLongPress: boolean;
	}>({
		timer: null,
		wasLongPress: false,
	});

	const handleLinkClick = useCallback(
		(href: string) => void app.workspace.openLinkText(href, filePath, false),
		[app, filePath],
	);

	const handlePointerDown = useCallback(() => {
		const lp = longPressRef.current;
		lp.wasLongPress = false;
		lp.timer = setTimeout(() => {
			lp.wasLongPress = true;
			lp.timer = null;
			onLongPress();
		}, 500);
	}, [onLongPress]);

	const handlePointerUp = useCallback(() => {
		const lp = longPressRef.current;
		if (lp.timer) {
			clearTimeout(lp.timer);
			lp.timer = null;
		}
	}, []);

	const handlePointerCancel = handlePointerUp;

	const handleRowClick = useCallback(
		(e: MouseEvent) => {
			if (longPressRef.current.wasLongPress) return;
			if ((e.target as HTMLElement).closest("button")) return;
			if ((e.target as HTMLElement).closest("a")) return;
			e.stopPropagation();
			if (isSelectionMode) {
				onToggleSelect();
			} else {
				onToggleExpand();
			}
		},
		[isSelectionMode, onToggleSelect, onToggleExpand],
	);

	const handleMenuClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			const menu = new Menu();

			menu.addItem((item) =>
				item.setTitle("Edit").setIcon("pencil").onClick(onEdit),
			);
			menu.addItem((item) =>
				item.setTitle("Copy").setIcon("copy").onClick(onCopy),
			);
			menu.addItem((item) =>
				item.setTitle("Move").setIcon("folder-input").onClick(onMove),
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item.setTitle("Delete").setIcon("trash-2").onClick(onDelete),
			);

			if (!isSelectionMode) {
				menu.addSeparator();
				menu.addItem((item) =>
					item.setTitle("Select").setIcon("check-square").onClick(onSelect),
				);
			}

			menu.showAtMouseEvent(e);
		},
		[onEdit, onCopy, onMove, onDelete, onSelect, isSelectionMode],
	);

	const handleCheckboxClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			onToggleSelect();
		},
		[onToggleSelect],
	);

	const borderCls = isSelected ? "ep:border-obs-interactive ep:border-2" : "";

	return (
		<div
			class={`ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border ep:shadow-sm ${borderCls}`}
		>
			{/* Main row (always visible) */}
			<div
				class="ep:flex ep:items-center ep:gap-2 ep:p-3 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded-md ep:transition-colors"
				role="button"
				tabIndex={0}
				onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(e as unknown as MouseEvent); } }}
				onClick={handleRowClick}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
			>
				{isSelectionMode && (
					<input
						type="checkbox"
						class="ep:w-4 ep:h-4 ep:cursor-pointer"
						checked={isSelected}
						onClick={handleCheckboxClick}
					/>
				)}

				<StatusDot
					color={getStatusDotColor(fsrsCard)}
					title={getStatusTitle(fsrsCard)}
				/>

				{isSuspended(fsrsCard) && (
					<span
						class="ep:text-ui-smaller ep:text-obs-red ep:font-medium ep:flex-shrink-0"
						title="Suspended - excluded from review"
					>
						S
					</span>
				)}
				{!isSuspended(fsrsCard) && isBuried(fsrsCard) && (
					<span
						class="ep:text-ui-smaller ep:text-obs-faint ep:font-medium ep:flex-shrink-0"
						title={`Buried until ${new Date(fsrsCard?.fsrs.buriedUntil ?? "").toLocaleDateString()}`}
					>
						B
					</span>
				)}

				<MarkdownContent
					markdown={card.question}
					filePath={filePath}
					class="ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown"
					onLinkClick={handleLinkClick}
				/>

				<button
					type="button"
					class="clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5"
					aria-label="Card actions"
					onClick={handleMenuClick}
				>
					<span ref={menuIconRef} />
				</button>
			</div>

			{/* Expanded content (answer) */}
			{isExpanded && (
				<div class="ep:px-3 ep:pb-3 ep:pt-3 ep:border-t ep:border-obs-border">
					<MarkdownContent
						markdown={card.answer}
						filePath={filePath}
						class="ep:text-ui-small ep:text-obs-normal true-recall-panel-card-field"
						onLinkClick={handleLinkClick}
					/>
				</div>
			)}
		</div>
	);
}

// ── CardGroup Component ─────────────────────────────────────────

interface CardGroupProps {
	groupType: "cloze" | "reverse";
	cards: FlashcardItem[];
	fsrsCards: (FSRSFlashcardItem | undefined)[];
	template?: string;
	filePath: string;
	groupId: string;
	isExpanded: boolean;
	isSelected: boolean;
	isSelectionMode: boolean;
	onToggleExpand: () => void;
	onToggleSelect: () => void;
	onEditGroup: () => void;
	onDeleteGroup: () => void;
	onCopyGroup: () => void;
	onMoveGroup: () => void;
	onSelect: () => void;
	onLongPress: () => void;
}

function CardGroup({
	groupType,
	cards,
	fsrsCards,
	template,
	filePath,
	isExpanded,
	isSelected,
	isSelectionMode,
	onToggleExpand,
	onToggleSelect,
	onEditGroup,
	onDeleteGroup,
	onCopyGroup,
	onMoveGroup,
	onSelect,
	onLongPress,
}: CardGroupProps) {
	const _app = useApp();
	const menuIconRef = useIcon("more-vertical");
	const typeIconRef = useIcon(
		groupType === "cloze" ? "brackets" : "arrow-left-right",
	);
	const longPressRef = useRef<{
		timer: ReturnType<typeof setTimeout> | null;
		wasLongPress: boolean;
	}>({
		timer: null,
		wasLongPress: false,
	});

	const handlePointerDown = useCallback(() => {
		const lp = longPressRef.current;
		lp.wasLongPress = false;
		lp.timer = setTimeout(() => {
			lp.wasLongPress = true;
			lp.timer = null;
			onLongPress();
		}, 500);
	}, [onLongPress]);

	const handlePointerUp = useCallback(() => {
		const lp = longPressRef.current;
		if (lp.timer) {
			clearTimeout(lp.timer);
			lp.timer = null;
		}
	}, []);

	const handlePointerCancel = handlePointerUp;

	const handleRowClick = useCallback(
		(e: MouseEvent) => {
			if (longPressRef.current.wasLongPress) return;
			if ((e.target as HTMLElement).closest("button")) return;
			if ((e.target as HTMLElement).closest("a")) return;
			e.stopPropagation();
			if (isSelectionMode) {
				onToggleSelect();
			} else {
				onToggleExpand();
			}
		},
		[isSelectionMode, onToggleSelect, onToggleExpand],
	);

	const handleMenuClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			const menu = new Menu();

			menu.addItem((item) =>
				item.setTitle("Edit group").setIcon("pencil").onClick(onEditGroup),
			);
			menu.addItem((item) =>
				item.setTitle("Copy").setIcon("copy").onClick(onCopyGroup),
			);
			menu.addItem((item) =>
				item.setTitle("Move").setIcon("folder-input").onClick(onMoveGroup),
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item.setTitle("Delete group").setIcon("trash-2").onClick(onDeleteGroup),
			);

			if (!isSelectionMode) {
				menu.addSeparator();
				menu.addItem((item) =>
					item.setTitle("Select").setIcon("check-square").onClick(onSelect),
				);
			}

			menu.showAtMouseEvent(e);
		},
		[
			onEditGroup,
			onCopyGroup,
			onMoveGroup,
			onDeleteGroup,
			onSelect,
			isSelectionMode,
		],
	);

	const handleCheckboxClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			onToggleSelect();
		},
		[onToggleSelect],
	);

	const displayText = useMemo(() => {
		if (groupType === "cloze" && template) {
			return template.replace(/\{\{c\d+::([^}]*?)(?:::[^}]*?)?\}\}/g, "$1");
		}
		return cards[0]?.question ?? "";
	}, [groupType, template, cards]);

	const borderCls = isSelected ? "ep:border-obs-interactive ep:border-2" : "";

	return (
		<div
			class={`ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border ep:shadow-sm ${borderCls}`}
		>
			{/* Header row */}
			<div
				class="ep:flex ep:items-center ep:gap-2 ep:p-3 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded-md ep:transition-colors"
				role="button"
				tabIndex={0}
				onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(e as unknown as MouseEvent); } }}
				onClick={handleRowClick}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
			>
				{isSelectionMode && (
					<input
						type="checkbox"
						class="ep:w-4 ep:h-4 ep:cursor-pointer"
						checked={isSelected}
						onClick={handleCheckboxClick}
					/>
				)}

				<StatusDot
					color={getAggregateStatusDotColor(fsrsCards)}
					title={getAggregateStatusTitle(fsrsCards)}
				/>

				<span
					ref={typeIconRef}
					class="ep:flex-shrink-0 ep:mt-0.5 ep:text-obs-faint"
				/>

				<div class="ep:flex-1 ep:text-ui-small ep:text-obs-normal ep:truncate">
					{displayText}
				</div>

				<span class="ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-base-25 ep:rounded ep:px-2 ep:py-1 ep:flex-shrink-0">
					{cards.length}
				</span>

				<button
					type="button"
					class="clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5"
					aria-label="Group actions"
					onClick={handleMenuClick}
				>
					<span ref={menuIconRef} />
				</button>
			</div>

			{/* Expanded content */}
			{isExpanded && (
				<div class="ep:border-t ep:border-obs-border">
					{cards.map((card, i) => (
						<div
							key={card.id}
							class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:border-b ep:border-obs-border last:ep:border-b-0"
						>
							<StatusDot
								color={getStatusDotColor(fsrsCards[i])}
								title={getStatusTitle(fsrsCards[i])}
							/>

							<div class="ep:flex-1 ep:flex ep:flex-col ep:gap-1">
								<span class="ep:text-xs ep:text-obs-faint ep:uppercase ep:tracking-wider">
									{groupType === "cloze"
										? `Cloze ${card.clozeIndex}`
										: i === 0
											? "Original"
											: "Reversed"}
								</span>
								<MarkdownContent
									markdown={card.question}
									filePath={filePath}
									class="ep:text-ui-small ep:text-obs-normal true-recall-card-markdown"
								/>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ── PanelHeader Component ───────────────────────────────────────

interface PanelHeaderProps {
	flashcardInfo: FlashcardInfo | null;
	cardsWithFsrs: FSRSFlashcardItem[];
	hasUncollectedFlashcards: boolean;
	uncollectedCount: number;
	selectionMode: SelectionMode;
	selectedCount: number;
	searchQuery: string;
	isFollowingReview: boolean;
	reviewedToday?: Set<string>;
	dayStartHour: number;
	onAdd: () => void;
	onCollect: () => void;
	onRefresh: () => void;
	onReview: () => void;
	onExitSelectionMode: () => void;
	onSearchChange: (query: string) => void;
	onExportCsv: () => void;
	onCopyToClipboard: () => void;
	onDeleteAll: () => void;
	onOpenSourceNote: () => void;
}

function PanelHeader({
	flashcardInfo,
	cardsWithFsrs,
	hasUncollectedFlashcards,
	uncollectedCount,
	selectionMode,
	selectedCount,
	searchQuery,
	isFollowingReview,
	reviewedToday,
	dayStartHour,
	onAdd,
	onCollect,
	onRefresh,
	onReview,
	onExitSelectionMode,
	onSearchChange,
	onExportCsv,
	onCopyToClipboard,
	onDeleteAll,
	onOpenSourceNote,
}: PanelHeaderProps) {
	const moreIconRef = useIcon("more-vertical");
	const addIconRef = useIcon("plus");
	const collectIconRef = useIcon("download");
	const openNoteIconRef = useIcon("file-text");
	const closeIconRef = useIcon("x");

	const handleMoreMenu = useCallback(
		(e: MouseEvent) => {
			const menu = new Menu();
			const hasFlashcards = (flashcardInfo?.cardCount ?? 0) > 0;

			menu.addItem((item) =>
				item.setTitle("Refresh").setIcon("refresh-cw").onClick(onRefresh),
			);
			menu.addItem((item) =>
				item
					.setTitle("Open source note")
					.setIcon("file-text")
					.onClick(onOpenSourceNote),
			);

			if (hasFlashcards) {
				menu.addItem((item) =>
					item.setTitle("Start review").setIcon("brain").onClick(onReview),
				);
				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Copy to clipboard")
						.setIcon("clipboard-copy")
						.onClick(onCopyToClipboard),
				);
				menu.addItem((item) =>
					item
						.setTitle("Export as CSV")
						.setIcon("file-down")
						.onClick(onExportCsv),
				);
				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Delete all flashcards")
						.setIcon("trash-2")
						.onClick(onDeleteAll),
				);
			}

			menu.showAtMouseEvent(e);
		},
		[
			flashcardInfo,
			onRefresh,
			onOpenSourceNote,
			onReview,
			onCopyToClipboard,
			onExportCsv,
			onDeleteAll,
		],
	);

	if (selectionMode === "selecting") {
		return (
			<div class="ep:flex ep:flex-col ep:gap-2">
				<div class="ep:flex ep:items-center ep:justify-between">
					<div class="ep:flex ep:items-center ep:gap-3">
						<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{selectedCount} selected
						</div>
					</div>
					<div class="ep:flex ep:items-center ep:gap-1">
						<button
							type="button"
							class="clickable-icon ep:flex ep:items-center ep:gap-1"
							aria-label="Exit selection mode"
							onClick={onExitSelectionMode}
						>
							<span ref={closeIconRef} />
							<span class="ep:text-ui-smaller ep:text-obs-faint">Cancel</span>
						</button>
					</div>
				</div>
			</div>
		);
	}

	const counts =
		cardsWithFsrs.length > 0
			? countByState(cardsWithFsrs, reviewedToday, dayStartHour)
			: null;

	const badgeCls =
		"ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold";

	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<div class="ep:flex ep:items-center ep:justify-between">
				{/* Left side: section label + counts */}
				<div class="ep:flex ep:items-center ep:gap-3">
					<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
						Cards
					</div>

					{counts && (
						<div class="ep:flex ep:items-center ep:gap-1">
							<div class={`${badgeCls} ep:bg-obs-green/20 ep:text-obs-green`}>
								{counts.new}
							</div>
							<div class={`${badgeCls} ep:bg-obs-orange/20 ep:text-obs-orange`}>
								{counts.learning}
							</div>
							<div class={`${badgeCls} ep:bg-obs-blue/20 ep:text-obs-blue`}>
								{counts.review}
							</div>
						</div>
					)}
				</div>

				{/* Right side: action buttons */}
				<div class="ep:flex ep:items-center ep:gap-1">
					{isFollowingReview && (
						<button
							type="button"
							class="clickable-icon"
							aria-label="Open source note"
							onClick={onOpenSourceNote}
						>
							<span ref={openNoteIconRef} />
						</button>
					)}

					{hasUncollectedFlashcards && (
						<button
							type="button"
							class="clickable-icon ep:flex ep:items-center ep:gap-1 true-recall-pulse-collect"
							aria-label={`Collect ${uncollectedCount} flashcards`}
							onClick={onCollect}
						>
							<span ref={collectIconRef} />
							<span class="ep:text-ui-smaller">{uncollectedCount}</span>
						</button>
					)}

					<button
						type="button"
						class="clickable-icon"
						aria-label="Add flashcard"
						onClick={onAdd}
					>
						<span ref={addIconRef} />
					</button>

					<button
						type="button"
						class="clickable-icon"
						aria-label="More actions"
						onClick={handleMoreMenu}
					>
						<span ref={moreIconRef} />
					</button>
				</div>
			</div>

			<SearchInput
				value={searchQuery}
				placeholder="Search flashcards..."
				onChange={onSearchChange}
			/>
		</div>
	);
}

// ── PanelContent Component ──────────────────────────────────────

interface PanelContentProps {
	flashcardInfo: FlashcardInfo | null;
	currentFile: { path: string; extension: string } | null;
	status: string;
	selectionMode: SelectionMode;
	selectedCardIds: Set<string>;
	expandedCardIds: Set<string>;
	cardsWithFsrs: FSRSFlashcardItem[];
	searchQuery: string;
	handlers: ContentHandlers;
}

interface ContentHandlers {
	onEditButton: (card: FlashcardItem) => void;
	onDeleteCard: (card: FlashcardItem) => void;
	onCopyCard: (card: FlashcardItem) => void;
	onMoveCard: (card: FlashcardItem) => void;
	onToggleExpand: (cardId: string) => void;
	onToggleSelect: (cardId: string) => void;
	onEnterSelectionMode: (cardId: string) => void;
	onAdd: () => void;
	onEditGroup: (cards: FlashcardItem[], template?: string) => void;
	onDeleteGroup: (cards: FlashcardItem[]) => void;
	onCopyGroup: (cards: FlashcardItem[]) => void;
	onMoveGroup: (cards: FlashcardItem[]) => void;
}

function PanelContent({
	flashcardInfo,
	currentFile,
	status: _status,
	selectionMode,
	selectedCardIds,
	expandedCardIds,
	cardsWithFsrs,
	searchQuery,
	handlers,
}: PanelContentProps) {
	if (!currentFile) {
		return <EmptyState message={EmptyStateMessages.NO_FILE} />;
	}

	if (currentFile.extension !== "md") {
		return <EmptyState message={EmptyStateMessages.NOT_MARKDOWN} />;
	}

	if (!flashcardInfo?.exists) {
		return (
			<div class="ep:py-4 ep:text-center">
				<p class="ep:text-ui-small ep:text-obs-muted ep:m-0">No flashcards</p>
			</div>
		);
	}

	const filePath = currentFile.path;

	// Build FSRS lookup map
	const fsrsMap = useMemo(
		() => new Map(cardsWithFsrs.map((c) => [c.id, c])),
		[cardsWithFsrs],
	);

	// Group cards
	const grouped = useMemo(
		() => groupCards(flashcardInfo.flashcards),
		[flashcardInfo.flashcards],
	);

	// Filter
	const filteredItems = useMemo(() => {
		if (!searchQuery) return grouped;
		return grouped.filter((item) => {
			if (item.type === "basic") {
				return (
					item.card.question.toLowerCase().includes(searchQuery) ||
					item.card.answer.toLowerCase().includes(searchQuery)
				);
			}
			if (item.type === "cloze-group") {
				return item.cards.some(
					(c) =>
						c.question.toLowerCase().includes(searchQuery) ||
						c.answer.toLowerCase().includes(searchQuery),
				);
			}
			return (
				item.original.question.toLowerCase().includes(searchQuery) ||
				item.original.answer.toLowerCase().includes(searchQuery) ||
				item.reversed.question.toLowerCase().includes(searchQuery) ||
				item.reversed.answer.toLowerCase().includes(searchQuery)
			);
		});
	}, [grouped, searchQuery]);

	return (
		<div class="ep:flex ep:flex-col">
			{filteredItems.map((item) => {
				if (item.type === "basic") {
					return (
						<CompactCard
							key={item.card.id}
							card={item.card}
							fsrsCard={fsrsMap.get(item.card.id)}
							filePath={filePath}
							isExpanded={expandedCardIds.has(item.card.id)}
							isSelected={selectedCardIds.has(item.card.id)}
							isSelectionMode={selectionMode === "selecting"}
							onToggleExpand={() => handlers.onToggleExpand(item.card.id)}
							onToggleSelect={() => handlers.onToggleSelect(item.card.id)}
							onEdit={() => handlers.onEditButton(item.card)}
							onDelete={() => handlers.onDeleteCard(item.card)}
							onCopy={() => handlers.onCopyCard(item.card)}
							onMove={() => handlers.onMoveCard(item.card)}
							onSelect={() => handlers.onEnterSelectionMode(item.card.id)}
							onLongPress={() => handlers.onEnterSelectionMode(item.card.id)}
						/>
					);
				}

				if (item.type === "cloze-group") {
					const groupId = `cloze:${item.cards[0]?.id}`;
					return (
						<CardGroup
							key={groupId}
							groupType="cloze"
							cards={item.cards}
							fsrsCards={item.cards.map((c) => fsrsMap.get(c.id))}
							template={item.template}
							filePath={filePath}
							groupId={groupId}
							isExpanded={expandedCardIds.has(groupId)}
							isSelected={item.cards.some((c) => selectedCardIds.has(c.id))}
							isSelectionMode={selectionMode === "selecting"}
							onToggleExpand={() => handlers.onToggleExpand(groupId)}
							onToggleSelect={() => {
								for (const c of item.cards) handlers.onToggleSelect(c.id);
							}}
							onEditGroup={() =>
								handlers.onEditGroup(item.cards, item.template)
							}
							onDeleteGroup={() => handlers.onDeleteGroup(item.cards)}
							onCopyGroup={() => handlers.onCopyGroup(item.cards)}
							onMoveGroup={() => handlers.onMoveGroup(item.cards)}
							onSelect={() =>
								handlers.onEnterSelectionMode(item.cards[0]?.id ?? "")
							}
							onLongPress={() =>
								handlers.onEnterSelectionMode(item.cards[0]?.id ?? "")
							}
						/>
					);
				}

				// reverse-group
				const groupId = `reverse:${item.original.id}`;
				const reverseCards = [item.original, item.reversed];
				return (
					<CardGroup
						key={groupId}
						groupType="reverse"
						cards={reverseCards}
						fsrsCards={reverseCards.map((c) => fsrsMap.get(c.id))}
						filePath={filePath}
						groupId={groupId}
						isExpanded={expandedCardIds.has(groupId)}
						isSelected={reverseCards.some((c) => selectedCardIds.has(c.id))}
						isSelectionMode={selectionMode === "selecting"}
						onToggleExpand={() => handlers.onToggleExpand(groupId)}
						onToggleSelect={() => {
							for (const c of reverseCards) handlers.onToggleSelect(c.id);
						}}
						onEditGroup={() => handlers.onEditGroup(reverseCards)}
						onDeleteGroup={() => handlers.onDeleteGroup(reverseCards)}
						onCopyGroup={() => handlers.onCopyGroup(reverseCards)}
						onMoveGroup={() => handlers.onMoveGroup(reverseCards)}
						onSelect={() => handlers.onEnterSelectionMode(item.original.id)}
						onLongPress={() => handlers.onEnterSelectionMode(item.original.id)}
					/>
				);
			})}
		</div>
	);
}

// ── PanelFooter Component ───────────────────────────────────────

interface PanelFooterProps {
	selectionMode: SelectionMode;
	selectedCount: number;
	onMoveSelected: () => void;
	onDeleteSelected: () => void;
}

function PanelFooter({
	selectionMode,
	selectedCount,
	onMoveSelected,
	onDeleteSelected,
}: PanelFooterProps) {
	if (selectionMode !== "selecting") return null;

	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary">
			<span class="ep:text-ui-small ep:text-obs-normal ep:font-medium">
				Selected: {selectedCount}
			</span>
			<div class="ep:flex ep:items-center ep:gap-2">
				<ActionButton
					label="Move"
					icon="folder-input"
					variant="secondary"
					disabled={selectedCount === 0}
					onClick={onMoveSelected}
				/>
				<ActionButton
					label="Delete"
					icon="trash-2"
					variant="danger"
					disabled={selectedCount === 0}
					onClick={onDeleteSelected}
				/>
			</div>
		</div>
	);
}

// ── FlashcardPanelApp (Root) ────────────────────────────────────

export function FlashcardPanelApp({
	onActions,
}: {
	onActions?: (actions: PanelAppActions) => void;
}) {
	const plugin = usePlugin();
	const app = useApp();
	const state = usePanelState();
	const cardsWithFsrs = useCardsWithFsrs(state.flashcardInfo);
	const panel = usePanelApi();
	const contentRef = useRef<HTMLDivElement>(null);

	const reviewedToday = plugin.sessionPersistence?.getReviewedToday();
	const dayStartHour = plugin.settings.dayStartHour;

	// ── Handlers (stable references) ──────────────────────────────

	const handleAddFlashcard = useCallback(
		async (prefillFlashcards?: Array<{ question: string; answer: string }>) => {
			if (!state.currentFile) return;
			const { SimpleFlashcardEditorModal } = await import(
				"../modals/SimpleFlashcardEditorModal"
			);
			const { cardsToMarkdown } = await import(
				"../../services/flashcard/flashcard-format.util"
			);
			const { notify } = await import("../../services");

			const modal = new SimpleFlashcardEditorModal(app, {
				mode: "add",
				currentFilePath: state.currentFile.path,
				prefillContent: prefillFlashcards
					? cardsToMarkdown(prefillFlashcards)
					: undefined,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || result.flashcards.length === 0) return;

			try {
				const flashcardsWithIds = result.flashcards.map((f) => ({
					id: f.id || crypto.randomUUID(),
					question: f.question,
					answer: f.answer,
					cardType: f.cardType,
					clozeTemplate: f.clozeTemplate,
					clozeIndex: f.clozeIndex,
					reverseOfBatchId: f.reverseOfBatchId,
				}));

				const saveResult = await plugin.flashcardManager.saveFlashcardsToSql(
					state.currentFile,
					flashcardsWithIds,
				);

				if (saveResult.duplicates.length > 0) {
					if (saveResult.created.length > 0) {
						notify().cardsCreated(
							saveResult.created.length,
							state.currentFile.basename,
						);
					}
					showDuplicateNotifications(plugin, saveResult.duplicates);

					const duplicateFlashcards = saveResult.duplicates.map((d) => ({
						question: d.flashcard.question,
						answer: d.flashcard.answer,
					}));
					await handleAddFlashcard(duplicateFlashcards);
				} else {
					notify().cardsCreated(
						saveResult.created.length,
						state.currentFile.basename,
					);
				}
			} catch (error) {
				console.error("Error adding flashcards:", error);
				(await import("../../services"))
					.notify()
					.operationFailed("add flashcards", error);
			}
		},
		[state.currentFile, app, plugin],
	);

	const handleEditButton = useCallback(
		async (card: FlashcardItem) => {
			if (!state.currentFile) return;
			const { SimpleFlashcardEditorModal } = await import(
				"../modals/SimpleFlashcardEditorModal"
			);
			const { cardToMarkdown } = await import(
				"../../services/flashcard/flashcard-format.util"
			);
			const { notify } = await import("../../services");
			const { DuplicateQuestionError } = await import(
				"../../services/flashcard/card-repository.service"
			);

			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			const modal = new SimpleFlashcardEditorModal(app, {
				mode: "edit",
				currentFilePath: state.currentFile.path,
				prefillContent: cardToMarkdown(card),
				editCardId: card.id,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || result.flashcards.length === 0) return;

			try {
				const firstFlashcard = result.flashcards[0];
				if (firstFlashcard) {
					plugin.flashcardManager.updateCardContent(
						card.id,
						firstFlashcard.question,
						firstFlashcard.answer,
					);
				}

				if (result.flashcards.length > 1) {
					const frontmatterService =
						plugin.flashcardManager.getFrontmatterService();
					let sourceUid = await frontmatterService.getSourceNoteUid(
						state.currentFile,
					);
					if (!sourceUid) {
						sourceUid = frontmatterService.generateUid();
						await frontmatterService.setSourceNoteUid(
							state.currentFile,
							sourceUid,
						);
					}

					for (let i = 1; i < result.flashcards.length; i++) {
						const flashcard = result.flashcards[i];
						if (flashcard) {
							await plugin.flashcardManager.addSingleFlashcard(
								flashcard.question,
								flashcard.answer,
								sourceUid,
							);
						}
					}
					notify().success(
						`Updated card and created ${result.flashcards.length - 1} new cards`,
					);
				} else {
					notify().cardUpdated();
				}

				// Restore scroll position after re-render
				requestAnimationFrame(() => {
					if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
				});
			} catch (error) {
				if (error instanceof DuplicateQuestionError) {
					const question = result.flashcards[0]?.question ?? "";
					notifyDuplicateError(plugin, error, question);
				} else {
					notify().operationFailed("update flashcard", error);
				}
			}
		},
		[state.currentFile, app, plugin],
	);

	const handleDeleteCard = useCallback(
		async (card: FlashcardItem) => {
			if (!state.currentFile) return;
			const { notify } = await import("../../services");
			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			const removed = await plugin.flashcardManager.removeFlashcardById(
				card.id,
			);
			if (removed) {
				notify().cardsDeleted(1);
				requestAnimationFrame(() => {
					if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
				});
			} else {
				notify().error("Failed to remove flashcard from file");
			}
		},
		[state.currentFile, plugin],
	);

	const handleCopyCard = useCallback(async (card: FlashcardItem) => {
		const { notify } = await import("../../services");
		const text = `Q: ${card.question}\nA: ${card.answer}`;
		await navigator.clipboard.writeText(text);
		notify().success("Copied to clipboard");
	}, []);

	const handleMoveCard = useCallback(
		async (card: FlashcardItem) => {
			if (!state.flashcardInfo) return;
			if (!card.id) {
				(await import("../../services"))
					.notify()
					.error(
						"Cannot move card without UUID. Please regenerate flashcards.",
					);
				return;
			}
			const { MoveCardModal } = await import("../modals/MoveCardModal");
			const { notify } = await import("../../services");

			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				state.currentFile,
				state.flashcardInfo,
			);

			const modal = new MoveCardModal(app, {
				cardCount: 1,
				sourceNoteName,
				cardQuestion: card.question,
				cardAnswer: card.answer,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNotePath) return;

			try {
				await plugin.flashcardManager.moveCard(card.id, result.targetNotePath);
				notify().cardsMoved(1, result.targetNotePath);
			} catch (error) {
				notify().operationFailed("move card", error);
			}
		},
		[state.currentFile, state.flashcardInfo, app, plugin],
	);

	const handleToggleExpand = useCallback(
		(cardId: string) => {
			const scrollPosition = contentRef.current?.scrollTop ?? 0;
			panel.toggleCardExpanded(cardId);
			requestAnimationFrame(() => {
				if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
			});
		},
		[panel],
	);

	const handleToggleSelect = useCallback(
		(cardId: string) => {
			const scrollPosition = contentRef.current?.scrollTop ?? 0;
			panel.toggleCardSelection(cardId);
			requestAnimationFrame(() => {
				if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
			});
		},
		[panel],
	);

	const handleEnterSelectionMode = useCallback(
		(cardId: string) => {
			panel.enterSelectionMode(cardId);
		},
		[panel],
	);

	const handleEditGroup = useCallback(
		async (cards: FlashcardItem[], clozeTemplate?: string) => {
			if (!state.currentFile) return;
			const { SimpleFlashcardEditorModal } = await import(
				"../modals/SimpleFlashcardEditorModal"
			);
			const { cardToMarkdown } = await import(
				"../../services/flashcard/flashcard-format.util"
			);
			const { notify } = await import("../../services");

			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			if (clozeTemplate) {
				const modal = new SimpleFlashcardEditorModal(app, {
					mode: "edit",
					currentFilePath: state.currentFile.path,
					prefillContent: cards[0] ? cardToMarkdown(cards[0]) : "",
					editCardId: cards[0]?.id,
				});

				const result = await modal.openAndWait();
				if (result.cancelled || result.flashcards.length === 0) return;

				try {
					const firstFlashcard = result.flashcards[0];
					if (!firstFlashcard) return;

					const frontmatterService =
						plugin.flashcardManager.getFrontmatterService();
					const sourceUid = await frontmatterService.getSourceNoteUid(
						state.currentFile,
					);
					if (!sourceUid) return;

					const { hasClozeContent } = await import(
						"../../services/flashcard/cloze-parser.service"
					);
					if (hasClozeContent(firstFlashcard.question)) {
						plugin.flashcardManager.updateClozeTemplate(
							sourceUid,
							clozeTemplate,
							firstFlashcard.question,
							state.currentFile.basename,
						);
						notify().success("Updated cloze group");
					} else {
						plugin.flashcardManager.updateCardContent(
							cards[0]!.id,
							firstFlashcard.question,
							firstFlashcard.answer,
						);
						notify().cardUpdated();
					}

					requestAnimationFrame(() => {
						if (contentRef.current)
							contentRef.current.scrollTop = scrollPosition;
					});
				} catch (error) {
					notify().operationFailed("update cloze group", error);
				}
			} else {
				const originalCard = cards[0];
				if (!originalCard) return;
				await handleEditButton(originalCard);
			}
		},
		[state.currentFile, app, plugin, handleEditButton],
	);

	const handleDeleteGroup = useCallback(
		async (cards: FlashcardItem[]) => {
			if (cards.length === 0) return;
			const { notify } = await import("../../services");
			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			const removed = await plugin.flashcardManager.removeFlashcardById(
				cards[0]!.id,
			);
			if (removed) {
				notify().cardsDeleted(cards.length);
				requestAnimationFrame(() => {
					if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
				});
			} else {
				notify().error("Failed to remove card group");
			}
		},
		[plugin],
	);

	const handleCopyGroup = useCallback(async (cards: FlashcardItem[]) => {
		if (cards.length === 0) return;
		const { notify } = await import("../../services");
		const firstCard = cards[0];
		if (!firstCard) return;
		let text: string;
		if (firstCard.clozeTemplate) {
			text = firstCard.clozeTemplate;
		} else {
			text = cards.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join("\n\n");
		}
		await navigator.clipboard.writeText(text);
		notify().success("Copied to clipboard");
	}, []);

	const handleMoveGroup = useCallback(
		async (cards: FlashcardItem[]) => {
			if (cards.length === 0) return;
			const { MoveCardModal } = await import("../modals/MoveCardModal");
			const { notify } = await import("../../services");

			const firstCard = cards[0];
			if (!firstCard) return;
			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				state.currentFile,
				state.flashcardInfo,
			);

			const modal = new MoveCardModal(app, {
				cardCount: cards.length,
				sourceNoteName,
				cardQuestion: firstCard.question,
				cardAnswer: firstCard.answer,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNotePath) return;

			const targetPath = result.targetNotePath;
			const results = await Promise.allSettled(
				cards.map((card) =>
					plugin.flashcardManager.moveCard(card.id, targetPath),
				),
			);

			const successCount = results.filter(
				(r) => r.status === "fulfilled",
			).length;
			notify().success(`Moved ${successCount} of ${cards.length} cards`);
		},
		[state.currentFile, state.flashcardInfo, app, plugin],
	);

	const handleCollect = useCallback(async () => {
		if (!state.currentFile) return;
		const { notify } = await import("../../services");
		const { CollectService } = await import(
			"../../services/flashcard/collect.service"
		);

		if (!plugin.flashcardManager.hasStore()) {
			notify().error("Flashcard store not ready. Please restart Obsidian.");
			return;
		}

		try {
			const collectService = new CollectService();
			const content = await app.vault.read(state.currentFile);
			const collectResult = collectService.collect(content);

			if (collectResult.collectedCount === 0) {
				notify().info("No flashcards to collect");
				return;
			}

			const saveResult = await plugin.flashcardManager.saveFlashcardsToSql(
				state.currentFile,
				collectResult.flashcards.map((f) => ({
					id: f.id || crypto.randomUUID(),
					question: f.question,
					answer: f.answer,
				})),
			);

			const contentToSave = plugin.settings.removeFlashcardContentAfterCollect
				? collectResult.newContentWithoutFlashcards
				: collectResult.newContent;
			await app.vault.process(state.currentFile, () => contentToSave);

			if (saveResult.duplicates.length > 0) {
				if (saveResult.created.length > 0) {
					notify().success(
						`Collected ${saveResult.created.length} flashcard(s)`,
					);
				}
				showDuplicateNotifications(plugin, saveResult.duplicates);
			} else {
				notify().success(`Collected ${saveResult.created.length} flashcard(s)`);
			}
		} catch (error) {
			notify().operationFailed("collect flashcards", error);
		}
	}, [state.currentFile, app, plugin]);

	const handleReview = useCallback(async () => {
		if (!state.currentFile) return;
		await plugin.reviewNoteFlashcards(state.currentFile);
	}, [state.currentFile, plugin]);

	const handleOpenSourceNote = useCallback(() => {
		if (!state.currentFile) return;
		void app.workspace.getLeaf("tab").openFile(state.currentFile);
	}, [state.currentFile, app]);

	const handleExportCsv = useCallback(async () => {
		const { notify } = await import("../../services");
		if (
			!state.flashcardInfo?.flashcards ||
			state.flashcardInfo.flashcards.length === 0
		) {
			notify().warning("No flashcards to export");
			return;
		}

		const escapeCSV = (str: string): string => {
			if (str.includes(",") || str.includes("\n") || str.includes('"')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		};

		const header = "Question,Answer";
		const rows = state.flashcardInfo.flashcards.map(
			(card) => `${escapeCSV(card.question)},${escapeCSV(card.answer)}`,
		);
		const csvContent = [header, ...rows].join("\n");

		const filename = state.currentFile
			? `${state.currentFile.basename}-flashcards.csv`
			: "flashcards.csv";

		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		notify().success(
			`Exported ${state.flashcardInfo.flashcards.length} flashcard(s) to CSV`,
		);
	}, [state.flashcardInfo, state.currentFile]);

	const handleCopyAllToClipboard = useCallback(async () => {
		const { notify } = await import("../../services");
		if (
			!state.flashcardInfo?.flashcards ||
			state.flashcardInfo.flashcards.length === 0
		) {
			notify().warning("No flashcards to copy");
			return;
		}

		const text = state.flashcardInfo.flashcards
			.map((card, i) => `${i + 1}. Q: ${card.question}\n   A: ${card.answer}`)
			.join("\n\n");

		await navigator.clipboard.writeText(text);
		notify().success(
			`Copied ${state.flashcardInfo.flashcards.length} flashcard(s) to clipboard`,
		);
	}, [state.flashcardInfo]);

	const handleDeleteAll = useCallback(async () => {
		const { notify } = await import("../../services");
		if (!state.flashcardInfo || state.flashcardInfo.flashcards.length === 0)
			return;

		const count = state.flashcardInfo.flashcards.length;
		// eslint-disable-next-line no-alert
		const confirmed = window.confirm(
			`Delete all ${count} flashcard(s) for this note?`,
		);
		if (!confirmed) return;

		const cardIds = state.flashcardInfo.flashcards.map((card) => card.id);
		const successCount = plugin.flashcardManager.removeFlashcardsByIds(cardIds);
		notify().cardsDeleted(successCount);
	}, [state.flashcardInfo, plugin]);

	const handleMoveSelected = useCallback(async () => {
		if (!state.flashcardInfo || state.selectedCardIds.size === 0) return;
		const { MoveCardModal } = await import("../modals/MoveCardModal");
		const { notify } = await import("../../services");

		const selectedCards = state.flashcardInfo.flashcards.filter((card) =>
			state.selectedCardIds.has(card.id),
		);

		if (selectedCards.length === 0) {
			notify().error(
				"No cards with valid UUIDs selected. Please regenerate flashcards.",
			);
			return;
		}

		const firstCard = selectedCards[0];
		if (!firstCard) return;

		const sourceNoteName = await getSourceNoteNameFromFile(
			app,
			state.currentFile,
			state.flashcardInfo,
		);

		const modal = new MoveCardModal(app, {
			cardCount: selectedCards.length,
			sourceNoteName,
			cardQuestion: firstCard.question,
			cardAnswer: firstCard.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		const targetPath = result.targetNotePath;
		const results = await Promise.allSettled(
			selectedCards.map((card) =>
				plugin.flashcardManager.moveCard(card.id, targetPath),
			),
		);

		const successCount = results.filter((r) => r.status === "fulfilled").length;
		results.forEach((r, i) => {
			if (r.status === "rejected") {
				console.error(`Failed to move card ${selectedCards[i]?.id}:`, r.reason);
			}
		});

		panel.exitSelectionMode();
		notify().success(`Moved ${successCount} of ${selectedCards.length} cards`);
	}, [
		state.flashcardInfo,
		state.selectedCardIds,
		state.currentFile,
		app,
		plugin,
		panel,
	]);

	const handleDeleteSelected = useCallback(async () => {
		if (
			!state.flashcardInfo ||
			!state.currentFile ||
			state.selectedCardIds.size === 0
		)
			return;
		const { notify } = await import("../../services");

		const selectedCards = state.flashcardInfo.flashcards.filter((card) =>
			state.selectedCardIds.has(card.id),
		);
		if (selectedCards.length === 0) return;

		// eslint-disable-next-line no-alert
		const confirmed = window.confirm(
			`Delete ${selectedCards.length} selected card(s)?`,
		);
		if (!confirmed) return;

		const cardIds = selectedCards.map((card) => card.id);
		const successCount = plugin.flashcardManager.removeFlashcardsByIds(cardIds);

		panel.exitSelectionMode();
		notify().cardsDeleted(successCount);
	}, [
		state.flashcardInfo,
		state.currentFile,
		state.selectedCardIds,
		plugin,
		panel,
	]);

	const handleExitSelectionMode = useCallback(() => {
		panel.exitSelectionMode();
	}, [panel]);

	const handleSearchChange = useCallback(
		(query: string) => {
			panel.setSearchQuery(query);
		},
		[panel],
	);

	// Build content handlers object (stable via useMemo)
	const contentHandlers: ContentHandlers = useMemo(
		() => ({
			onEditButton: handleEditButton,
			onDeleteCard: handleDeleteCard,
			onCopyCard: handleCopyCard,
			onMoveCard: handleMoveCard,
			onToggleExpand: handleToggleExpand,
			onToggleSelect: handleToggleSelect,
			onEnterSelectionMode: handleEnterSelectionMode,
			onAdd: handleAddFlashcard,
			onEditGroup: handleEditGroup,
			onDeleteGroup: handleDeleteGroup,
			onCopyGroup: handleCopyGroup,
			onMoveGroup: handleMoveGroup,
		}),
		[
			handleEditButton,
			handleDeleteCard,
			handleCopyCard,
			handleMoveCard,
			handleToggleExpand,
			handleToggleSelect,
			handleEnterSelectionMode,
			handleAddFlashcard,
			handleEditGroup,
			handleDeleteGroup,
			handleCopyGroup,
			handleMoveGroup,
		],
	);

	// Mobile renders without header (uses native Obsidian header actions)
	const showHeader = !Platform.isMobile;

	const footer = (
		<PanelFooter
			selectionMode={state.selectionMode}
			selectedCount={state.selectedCardIds.size}
			onMoveSelected={handleMoveSelected}
			onDeleteSelected={handleDeleteSelected}
		/>
	);

	return (
		<Panel showFooter footer={footer} disableScroll>
			<div class="ep:flex ep:flex-col ep:gap-2 ep:h-full">
				{showHeader && (
					<div class="ep:shrink-0">
						<PanelHeader
							flashcardInfo={state.flashcardInfo}
							cardsWithFsrs={cardsWithFsrs}
							hasUncollectedFlashcards={state.uncollectedCount > 0}
							uncollectedCount={state.uncollectedCount}
							selectionMode={state.selectionMode}
							selectedCount={state.selectedCardIds.size}
							searchQuery={state.searchQuery}
							isFollowingReview={state.isFollowingReview}
							reviewedToday={reviewedToday}
							dayStartHour={dayStartHour}
							onAdd={handleAddFlashcard}
							onCollect={handleCollect}
							onRefresh={() => onActions?.({ type: "refresh" })}
							onReview={handleReview}
							onExitSelectionMode={handleExitSelectionMode}
							onSearchChange={handleSearchChange}
							onExportCsv={handleExportCsv}
							onCopyToClipboard={handleCopyAllToClipboard}
							onDeleteAll={handleDeleteAll}
							onOpenSourceNote={handleOpenSourceNote}
						/>
					</div>
				)}

				<div ref={contentRef} class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
					<PanelContent
						flashcardInfo={state.flashcardInfo}
						currentFile={state.currentFile}
						status={state.status}
						selectionMode={state.selectionMode}
						selectedCardIds={state.selectedCardIds}
						expandedCardIds={state.expandedCardIds}
						cardsWithFsrs={cardsWithFsrs}
						searchQuery={state.searchQuery}
						handlers={contentHandlers}
					/>
				</div>
			</div>
		</Panel>
	);
}

// ── Action types for parent communication ───────────────────────

export type PanelAppActions = { type: "refresh" };

// ── Helpers (non-component) ─────────────────────────────────────

async function getSourceNoteNameFromFile(
	app: { vault: { read: (file: any) => Promise<string> } },
	currentFile: any,
	flashcardInfo: FlashcardInfo | null,
): Promise<string | undefined> {
	if (!currentFile || !flashcardInfo) return undefined;
	try {
		const content = await app.vault.read(currentFile);
		const match = content.match(/source_link:\s*"\[\[(.+?)\]\]"/);
		return match?.[1];
	} catch {
		return undefined;
	}
}

function showDuplicateNotifications(
	plugin: TrueRecallPlugin,
	duplicates: any[],
): void {
	const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
	for (const dup of duplicates) {
		const sourceInfo = dup.existingSourceUid
			? sourceNoteService.resolveSourceNote(dup.existingSourceUid)
			: {};
		notify().duplicateFound(
			dup.flashcard.question,
			(sourceInfo as any).noteName,
		);
	}
}

function notifyDuplicateError(
	plugin: TrueRecallPlugin,
	error: any,
	question: string,
): void {
	const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
	const sourceInfo = error.existingSourceUid
		? sourceNoteService.resolveSourceNote(error.existingSourceUid)
		: {};
	notify().duplicateFound(question, (sourceInfo as any).noteName);
}
