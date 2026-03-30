import type {
	CardSchedulingMeta,
	FlashcardInfo,
} from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";
import type {
	PanelApi,
	ProcessingStatus,
	SelectionMode,
	ViewMode,
} from "@true-recall/obsidian/store";
import type { TFile } from "obsidian";
import { useEffect, useMemo, useState } from "preact/hooks";

interface PanelState {
	currentFile: TFile | null;
	flashcardInfo: FlashcardInfo | null;
	status: ProcessingStatus;
	viewMode: ViewMode;
	uncollectedCount: number;
	isFollowingReview: boolean;
	isAddCardExpanded: boolean;
	selectionMode: SelectionMode;
	selectedCardIds: Set<string>;
	expandedCardIds: Set<string>;
	searchQuery: string;
	hasHighlights: boolean;
}

export interface PanelStoreResult extends PanelState {
	cardsWithFsrs: FSRSFlashcardItem[];
	panel: PanelApi;
}

const DEFAULT_STATE: PanelState = {
	currentFile: null,
	flashcardInfo: null,
	status: "idle" as ProcessingStatus,
	viewMode: "list" as ViewMode,
	uncollectedCount: 0,
	isFollowingReview: false,
	isAddCardExpanded: false,
	selectionMode: "idle" as SelectionMode,
	selectedCardIds: new Set<string>(),
	expandedCardIds: new Set<string>(),
	searchQuery: "",
	hasHighlights: false,
};

function buildPanelState(p: {
	currentFile: TFile | null;
	flashcardInfo: FlashcardInfo | null;
	status: ProcessingStatus;
	viewMode: ViewMode;
	uncollectedCount: number;
	isFollowingReview: boolean;
	isAddCardExpanded: boolean;
	selectionMode: string;
	selectedCardIds: Set<string>;
	expandedCardIds: Set<string>;
	searchQuery: string;
	hasHighlights: boolean;
}): PanelState {
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
		hasHighlights: p.hasHighlights,
	};
}

export function usePanelStore(): PanelStoreResult {
	const plugin = usePlugin();

	// ── Panel API ──
	const store = plugin.store;
	if (!store) throw new Error("Store not initialized");
	const panel = store.getState().panel;

	// ── Panel state subscription ──
	const [state, setState] = useState<PanelState>(() => {
		const p = store.getState().panel;
		return p ? buildPanelState(p) : DEFAULT_STATE;
	});

	useEffect(() => {
		const unsub = store.subscribe(
			(s) => s.panel,
			() => {
				const p = store.getState().panel;
				if (p) setState(buildPanelState(p));
			},
		);
		return unsub;
	}, [store]);

	// ── Cards enriched with FSRS scheduling data ──
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const cardsRef = allMeta.value;
	const cardsWithFsrs = useMemo(() => {
		if (!state.flashcardInfo?.flashcards) return [];
		if (!plugin.flashcardManager.hasStore()) return [];
		const cardIds = state.flashcardInfo.flashcards.map((c) => c.id);
		return plugin.flashcardManager.getCardsByIds(cardIds);
	}, [state.flashcardInfo, plugin, cardsRef]);

	return {
		...state,
		cardsWithFsrs,
		panel,
	};
}
