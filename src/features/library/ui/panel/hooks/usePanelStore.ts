import { effect } from "@preact/signals";
import { dataVersion, settingsVersion, track } from "@shared/services/signals";
import type {
	PanelApi,
	ProcessingStatus,
	SelectionMode,
	ViewMode,
} from "@shared/store";
import type { FlashcardInfo } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { usePlugin } from "@shared/ui/preact";
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

	// ── Signal→render bridge for FSRS data reactivity ──
	const [dataVer, setDataVer] = useState(0);

	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion, settingsVersion);
			setDataVer((v) => v + 1);
		});
		return dispose;
	}, []);

	// ── Cards enriched with FSRS scheduling data ──
	const cardsWithFsrs = useMemo(() => {
		void dataVer;
		if (!state.flashcardInfo?.flashcards) return [];
		if (!plugin.flashcardManager.hasStore()) return [];
		const cardIds = state.flashcardInfo.flashcards.map((c) => c.id);
		return plugin.flashcardManager.getCardsByIds(cardIds);
	}, [state.flashcardInfo, plugin, dataVer]);

	return {
		...state,
		cardsWithFsrs,
		panel,
	};
}
