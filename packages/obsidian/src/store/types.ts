import type { TFile } from "obsidian";
import type { Grade } from "ts-fsrs";

import type { AppError } from "@true-recall/core/errors";
import type {
	FlashcardInfo,
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionStats,
	SchedulingPreview,
	TrueRecallSettings,
} from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";

import type {
	MetricType,
	SequenceSimulation,
} from "@true-recall/obsidian/features/metrics/ui/simulator/types";

export interface AppStoreDeps {
	getSettings: () => TrueRecallSettings;
}

export interface BadgeCounts {
	new: number;
	learning: number;
	due: number;
}

export interface EditModeState {
	active: boolean;
	field: "question" | "answer" | null;
	originalQuestion: string;
	originalAnswer: string;
}

export type SessionPhase =
	| { type: "idle" }
	| { type: "active"; card: FSRSFlashcardItem }
	| { type: "waiting"; timeUntilDue: number }
	| { type: "complete"; stats: ReviewSessionStats };

export interface ReviewSliceState {
	isActive: boolean;
	queue: FSRSFlashcardItem[];
	currentIndex: number;
	isAnswerRevealed: boolean;
	results: ReviewResult[];
	startTime: number;
	questionShownTime: number;
	stats: ReviewSessionStats;
	cachedBadgeCounts: BadgeCounts;
	editMode: EditModeState;
	sessionFilters: SessionFilters;
}

export interface ReviewSliceActions {
	// Session lifecycle
	startSession: (queue: FSRSFlashcardItem[]) => void;
	endSession: () => void;
	reset: () => void;
	setSessionFilters: (filters: SessionFilters) => void;
	getSessionFilters: () => SessionFilters;

	// Answer display
	revealAnswer: () => void;
	hideAnswer: () => void;

	// Card navigation
	nextCard: () => boolean;
	recordAnswer: (rating: Grade, updatedCard: FSRSFlashcardItem) => boolean;
	recordAnswerAndNext: (
		rating: Grade,
		updatedCard: FSRSFlashcardItem,
		requeueData?: { card: FSRSFlashcardItem; position: number },
	) => boolean;

	// Queue manipulation
	requeueCard: (card: FSRSFlashcardItem, position?: number) => void;
	removeCurrentCard: () => void;
	removeCardById: (cardId: string) => void;
	removeCardsByIds: (cardIds: string[]) => void;
	addCardToQueue: (card: FSRSFlashcardItem) => void;
	insertCardAtPosition: (card: FSRSFlashcardItem, position: number) => void;
	replaceQueue: (
		queue: FSRSFlashcardItem[],
		currentCardId?: string | null,
	) => void;

	// Undo
	undoLastAnswer: (
		previousIndex: number,
		restoredCard: FSRSFlashcardItem,
		requeuedAtIndex?: number,
	) => void;

	getEditState: () => EditModeState;
	startEdit: (field: "question" | "answer") => void;
	cancelEdit: () => void;
	isEditing: () => boolean;
	updateCurrentCardContent: (question: string, answer: string) => void;

	// Scheduling preview (ephemeral)
	getSchedulingPreview: () => SchedulingPreview | null;
	setSchedulingPreview: (preview: SchedulingPreview | null) => void;
	notifyChange: () => void;

	// Computed getters
	getCurrentCard: () => FSRSFlashcardItem | null;
	getPhase: () => SessionPhase;
	getBadgeCounts: () => BadgeCounts;
	getStats: () => ReviewSessionStats;
	getProgress: () => { current: number; total: number; percentage: number };
	getRemainingCount: () => number;
	isCardDueNow: (card: FSRSFlashcardItem) => boolean;
	getPendingLearningCards: () => FSRSFlashcardItem[];
	getTimeUntilNextDue: () => number;
	isWaitingForLearningCards: () => boolean;
	isComplete: () => boolean;
	isActiveSession: () => boolean;
	isAnswerShown: () => boolean;
}

export type ProcessingStatus = "none" | "exists";
export type ViewMode = "list";
export type SelectionMode = "normal" | "selecting";

export interface PanelSliceState {
	status: ProcessingStatus;
	viewMode: ViewMode;
	currentFile: TFile | null;
	flashcardInfo: FlashcardInfo | null;
	error: AppError | null;
	renderVersion: number;
	sourceNoteName: string | null;
	uncollectedCount: number;
	selectionMode: SelectionMode;
	selectedCardIds: Set<string>;
	expandedCardIds: Set<string>;
	searchQuery: string;
	isAddCardExpanded: boolean;
	isFollowingReview: boolean;
	reviewSourceNotePath: string | null;
	hasHighlights: boolean;
	activeViewContext: string | null;
}

export interface PanelSliceActions {
	setState: (partial: Partial<PanelSliceState>) => void;
	reset: () => void;
	incrementRenderVersion: () => number;
	isCurrentRender: (version: number) => boolean;
	setCurrentFile: (file: TFile | null) => void;
	setStatus: (status: ProcessingStatus) => void;
	setViewMode: (mode: ViewMode) => void;
	setFlashcardInfo: (info: FlashcardInfo | null) => void;
	setError: (error: AppError | null) => void;
	isCurrentFile: (file: TFile | null) => boolean;
	setUncollectedInfo: (count: number) => void;
	hasUncollectedFlashcards: () => boolean;
	setHasHighlights: (value: boolean) => void;
	enterSelectionMode: (initialCardId?: string) => void;
	exitSelectionMode: () => void;
	toggleCardSelection: (cardId: string) => void;
	selectAll: (cardIds: string[]) => void;
	toggleCardExpanded: (cardId: string) => void;
	isInSelectionMode: () => boolean;
	setSearchQuery: (query: string) => void;
	setAddCardExpanded: (expanded: boolean) => void;
	setReviewFollowState: (sourcePath: string | null, isActive: boolean) => void;
}

// API type for components to depend on
export type PanelApi = PanelSliceState & PanelSliceActions;

export interface SimulatorSliceState {
	sequences: string[];
	parameters: number[];
	desiredRetention: number;
	metricType: MetricType;
	useAnimation: boolean;
	useLogarithmic: boolean;
	parameterHistory: number[][];
	historyIndex: number;
	simulations: SequenceSimulation[];
}

export interface SimulatorSliceActions {
	getSequences: () => string[];
	getParameters: () => number[];
	getDesiredRetention: () => number;
	getMetricType: () => MetricType;
	getUseAnimation: () => boolean;
	getUseLogarithmic: () => boolean;
	getSimulations: () => SequenceSimulation[];
	canUndo: () => boolean;
	canRedo: () => boolean;
	setSequences: (sequences: string[]) => void;
	setParameter: (index: number, value: number) => void;
	setAllParameters: (parameters: number[]) => void;
	setDesiredRetention: (value: number) => void;
	setMetricType: (type: MetricType) => void;
	setUseAnimation: (value: boolean) => void;
	setUseLogarithmic: (value: boolean) => void;
	setSimulations: (simulations: SequenceSimulation[]) => void;
	resetSequences: () => void;
	resetParameters: () => void;
	undo: () => void;
	redo: () => void;
	reset: () => void;
	getParametersString: () => string;
}

// API type for components to depend on
export type SimulatorApi = SimulatorSliceState & SimulatorSliceActions;

export type ReviewApi = ReviewSliceState & ReviewSliceActions;

export interface AppState {
	review: ReviewSliceState & ReviewSliceActions;
	panel: PanelSliceState & PanelSliceActions;
	simulator: SimulatorSliceState & SimulatorSliceActions;
}
