import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

import { clearRecentCards } from "@true-recall/core/ai/state/streaming-state";
import type { FlashcardItem } from "@true-recall/core/types";

import { useStreamingCardState } from "@true-recall/obsidian/features/library/ui/panel/components/StreamingSection";
import { groupCards } from "@true-recall/obsidian/features/library/ui/panel/group-cards";
import { usePanelScroll } from "@true-recall/obsidian/features/library/ui/panel/hooks/PanelScrollContext";
import { useCardActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useCardActions";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { useSelectionActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useSelectionActions";
import { useStreamingNewCount } from "@true-recall/obsidian/features/library/ui/panel/hooks/useStreamingNewCount";
import type { PanelCardActionHandlers } from "@true-recall/obsidian/features/library/ui/panel/panel.types";
import { openPanelShortcutsModal } from "@true-recall/obsidian/features/library/ui/panel/panel-shortcuts-modal";
import { resolvePanelKeyboardAction } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-keyboard";
import {
	filterAndSortPanelItems,
	getPanelItemCardIds,
	getPanelItemRepresentative,
	isPanelCardDue,
	type PanelSort,
	type PanelStatusFilter,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";

export function useFlashcardPanel() {
	const app = useApp();
	const plugin = usePlugin();
	const store = usePanelStore();
	const cardActions = useCardActions();
	const panelActions = usePanelActions();
	const selectionActions = useSelectionActions();
	const { scrollRef: contentRef } = usePanelScroll();
	const panelRootRef = useRef<HTMLDivElement | null>(null);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const [openCardId, setOpenCardId] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<PanelStatusFilter>("all");
	const [sort, setSort] = useState<PanelSort>("source");
	const [debouncedSearch, setDebouncedSearch] = useState(store.searchQuery);
	const setSearchQuery = store.panel.setSearchQuery;
	const dayStartHour = plugin.settings.dayStartHour;

	const streamingNewCount = useStreamingNewCount(
		store.cardsWithFsrs,
		store.currentFile?.path,
	);
	const streaming = useStreamingCardState();
	const isStreamingForFile =
		streaming.isGenerating && streaming.notePath === store.currentFile?.path;

	useEffect(() => {
		const timer = window.setTimeout(
			() => setDebouncedSearch(store.searchQuery),
			100,
		);
		return () => window.clearTimeout(timer);
	}, [store.searchQuery]);

	useEffect(() => {
		if (streaming.isGenerating || streaming.recentCardIds.size === 0) return;
		const timer = window.setTimeout(() => clearRecentCards(), 1000);
		return () => window.clearTimeout(timer);
	}, [streaming.isGenerating, streaming.recentCardIds.size]);

	useEffect(() => {
		setOpenCardId(null);
		setStatusFilter("all");
		setSort("source");
		setSearchQuery("");
	}, [store.currentFile?.path, setSearchQuery]);

	const allFlashcards = useMemo(() => {
		const cards = store.flashcardInfo?.exists
			? store.flashcardInfo.flashcards
			: [];
		if (!isStreamingForFile || streaming.completedCards.length === 0)
			return cards;
		const existingIds = new Set(cards.map((card) => card.id));
		const newCards = streaming.completedCards.filter(
			(card: FlashcardItem) => !existingIds.has(card.id),
		);
		return newCards.length > 0 ? [...cards, ...newCards] : cards;
	}, [
		store.flashcardInfo,
		isStreamingForFile,
		streaming.completedCards,
		streamingNewCount,
	]);
	const fsrsMap = useMemo(
		() => new Map(store.cardsWithFsrs.map((card) => [card.id, card])),
		[store.cardsWithFsrs],
	);
	const groupedItems = useMemo(
		() => groupCards(allFlashcards, fsrsMap),
		[allFlashcards, fsrsMap],
	);
	const visibleItems = useMemo(
		() =>
			filterAndSortPanelItems(groupedItems, fsrsMap, {
				query: debouncedSearch,
				status: statusFilter,
				sort,
				dayStartHour,
			}),
		[groupedItems, fsrsMap, debouncedSearch, statusFilter, sort, dayStartHour],
	);
	const visibleCardIds = useMemo(
		() => visibleItems.flatMap(getPanelItemCardIds),
		[visibleItems],
	);
	const allCardIds = useMemo(
		() => allFlashcards.map((card) => card.id),
		[allFlashcards],
	);
	const visibleCards = useMemo(
		() => visibleItems.map(getPanelItemRepresentative),
		[visibleItems],
	);
	const dueCount = useMemo(
		() =>
			store.cardsWithFsrs.reduce(
				(count, card) => count + (isPanelCardDue(card, dayStartHour) ? 1 : 0),
				0,
			),
		[store.cardsWithFsrs, dayStartHour],
	);
	const openCard = openCardId
		? (allFlashcards.find((card) => card.id === openCardId) ?? null)
		: null;
	const openPosition = openCard
		? visibleCards.findIndex((card) => card.id === openCard.id)
		: -1;

	useEffect(() => {
		if (openCardId && !allFlashcards.some((card) => card.id === openCardId)) {
			setOpenCardId(null);
		}
	}, [openCardId, allFlashcards]);

	const navigateCard = useCallback(
		(delta: number) => {
			if (visibleCards.length === 0) return;
			const current = visibleCards.findIndex((card) => card.id === openCardId);
			const next =
				current < 0
					? 0
					: (current + delta + visibleCards.length) % visibleCards.length;
			setOpenCardId(visibleCards[next]?.id ?? null);
		},
		[visibleCards, openCardId],
	);

	const actions = usePanelCardActions({
		cardActions,
		panelActions,
		selectionActions,
		setOpenCardId,
	});
	const resetList = useCallback(() => {
		setSearchQuery("");
		setStatusFilter("all");
		setSort("source");
	}, [setSearchQuery]);
	const handleSearchInput = useCallback((input: HTMLInputElement | null) => {
		searchInputRef.current = input;
	}, []);
	const showShortcuts = useCallback(() => openPanelShortcutsModal(app), [app]);

	usePanelKeyboard({
		app,
		panelRootRef,
		searchInputRef,
		store,
		openCard,
		visibleCardIds,
		setOpenCardId,
		navigateCard,
		cardActions,
		selectionActions,
	});

	return {
		store,
		contentRef,
		panelRootRef,
		openCard,
		openPosition,
		statusFilter,
		setStatusFilter,
		sort,
		setSort,
		debouncedSearch,
		allFlashcards,
		fsrsMap,
		visibleItems,
		visibleCardIds,
		allCardIds,
		visibleCards,
		dueCount,
		dayStartHour,
		isStreamingForFile,
		isSelecting: store.selectionMode === "selecting",
		actions,
		navigateCard,
		closeCard: () => setOpenCardId(null),
		enterSelection: () => selectionActions.handleSelectCards([]),
		handleSearchInput,
		showShortcuts,
		resetList,
	};
}

function usePanelCardActions({
	cardActions,
	panelActions,
	selectionActions,
	setOpenCardId,
}: {
	cardActions: ReturnType<typeof useCardActions>;
	panelActions: ReturnType<typeof usePanelActions>;
	selectionActions: ReturnType<typeof useSelectionActions>;
	setOpenCardId: (cardId: string | null) => void;
}): PanelCardActionHandlers {
	const {
		handleEditButton,
		handleCopyCard,
		handleMoveCard,
		handleChangeType,
		handleToggleReversed,
		handleForgetCard,
		handleSuspendCard,
		handleUnsuspendCard,
		handleDeleteCard,
		handleUpdateContent,
	} = cardActions;
	const {
		handleOpenSourceNote,
		handleJumpToSource,
		handleHoverSource,
		handleLeaveSource,
	} = panelActions;
	const { handleEnterSelectionMode, handleSetCardsSelected } = selectionActions;
	return useMemo(
		() => ({
			onOpen: (card) => setOpenCardId(card.id),
			onOpenSource: (card) => {
				if (card.sourceText) void handleJumpToSource(card);
				else handleOpenSourceNote();
			},
			onEdit: (card) => void handleEditButton(card),
			onCopy: (card) => void handleCopyCard(card),
			onMove: (card) => void handleMoveCard(card),
			onChangeType: (card) => void handleChangeType(card),
			onToggleReversed: (card) => void handleToggleReversed(card),
			onForget: handleForgetCard,
			onSuspend: handleSuspendCard,
			onUnsuspend: handleUnsuspendCard,
			onDelete: (card) => void handleDeleteCard(card),
			onUpdateContent: handleUpdateContent,
			onEnterSelection: handleEnterSelectionMode,
			onSetSelected: handleSetCardsSelected,
			onHoverSource: handleHoverSource,
			onLeaveSource: handleLeaveSource,
		}),
		[
			setOpenCardId,
			handleOpenSourceNote,
			handleJumpToSource,
			handleEditButton,
			handleCopyCard,
			handleMoveCard,
			handleChangeType,
			handleToggleReversed,
			handleForgetCard,
			handleSuspendCard,
			handleUnsuspendCard,
			handleDeleteCard,
			handleUpdateContent,
			handleEnterSelectionMode,
			handleSetCardsSelected,
			handleHoverSource,
			handleLeaveSource,
		],
	);
}

interface KeyboardArgs {
	app: ReturnType<typeof useApp>;
	panelRootRef: ReturnType<typeof useRef<HTMLDivElement | null>>;
	searchInputRef: ReturnType<typeof useRef<HTMLInputElement | null>>;
	store: ReturnType<typeof usePanelStore>;
	openCard: FlashcardItem | null;
	visibleCardIds: string[];
	setOpenCardId: (cardId: string | null) => void;
	navigateCard: (delta: number) => void;
	cardActions: ReturnType<typeof useCardActions>;
	selectionActions: ReturnType<typeof useSelectionActions>;
}

function usePanelKeyboard(args: KeyboardArgs) {
	const argsRef = useRef(args);
	argsRef.current = args;
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) =>
			handlePanelKeyDown(event, argsRef.current);
		activeDocument.addEventListener("keydown", handleKeyDown);
		return () => activeDocument.removeEventListener("keydown", handleKeyDown);
	}, []);
}

function handlePanelKeyDown(event: KeyboardEvent, args: KeyboardArgs) {
	const target = event.target as HTMLElement | null;
	if (!target || !args.panelRootRef.current?.contains(target)) return;
	const isEditingText = !!target.closest(
		"textarea, [contenteditable='true'], input:not([type]), input[type='text'], input[type='search'], input[type='email'], input[type='url'], input[type='tel'], input[type='number'], input[type='password']",
	);
	const mode =
		args.store.selectionMode === "selecting"
			? "selection"
			: args.openCard
				? "detail"
				: "list";
	const action = resolvePanelKeyboardAction({
		key: event.key,
		metaKey: event.metaKey,
		ctrlKey: event.ctrlKey,
		shiftKey: event.shiftKey,
		mode,
		isEditingText,
	});
	if (!action) return;
	event.preventDefault();

	if (action === "focus-search") {
		args.setOpenCardId(null);
		window.setTimeout(() => args.searchInputRef.current?.focus(), 0);
	} else if (action === "add-card") void args.cardActions.handleAddFlashcard();
	else if (action === "select-visible")
		args.selectionActions.handleSelectCards(args.visibleCardIds);
	else if (action === "close") {
		if (args.store.selectionMode === "selecting")
			args.selectionActions.handleExitSelectionMode();
		else args.setOpenCardId(null);
	} else if (action === "edit-card" && args.openCard) {
		void args.cardActions.handleEditButton(args.openCard);
	} else if (action === "previous-card") args.navigateCard(-1);
	else if (action === "next-card") args.navigateCard(1);
	else if (action === "show-shortcuts") openPanelShortcutsModal(args.app);
}
