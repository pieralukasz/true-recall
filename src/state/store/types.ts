import type { App, TFile } from "obsidian";
import type { Grade } from "ts-fsrs";
import type { SqliteStoreService } from "../../services/persistence/sqlite";
import type { DayBoundaryService } from "../../services/core/day-boundary.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import type { EventBusService } from "../../services/core/event-bus.service";
import type { TrueRecallSettings } from "../../ui/settings";
import type {
	FSRSFlashcardItem,
	ReviewResult,
	ReviewSessionStats,
	FlashcardInfo,
	ProjectInfo,
	ProjectNoteInfo,
	SchedulingPreview,
} from "../../types";
import type { AppError } from "../../errors";
import type {
	MetricType,
	SequenceSimulation,
} from "../../ui/simulator/types";

export interface AppStoreDeps {
	app: App;
	cardStore: SqliteStoreService;
	dayBoundaryService: DayBoundaryService;
	frontmatterIndex: FrontmatterIndexService;
	eventBus: EventBusService;
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
}

export interface ReviewSliceActions {
	// Session lifecycle
	startSession: (queue: FSRSFlashcardItem[]) => void;
	endSession: () => void;
	reset: () => void;

	// Answer display
	revealAnswer: () => void;
	hideAnswer: () => void;

	// Card navigation
	nextCard: () => boolean;
	recordAnswer: (rating: Grade, updatedCard: FSRSFlashcardItem) => boolean;
	recordAnswerAndNext: (
		rating: Grade,
		updatedCard: FSRSFlashcardItem,
		requeueData?: { card: FSRSFlashcardItem; position: number }
	) => boolean;

	// Queue manipulation
	requeueCard: (card: FSRSFlashcardItem, position?: number) => void;
	removeCurrentCard: () => void;
	removeCardById: (cardId: string) => void;
	removeCardsByIds: (cardIds: string[]) => void;
	addCardToQueue: (card: FSRSFlashcardItem) => void;
	insertCardAtPosition: (card: FSRSFlashcardItem, position: number) => void;

	// Undo
	undoLastAnswer: (
		previousIndex: number,
		restoredCard: FSRSFlashcardItem,
		requeuedAtIndex?: number
	) => void;

	// Edit mode (stored outside state to avoid triggering subscriptions)
	getEditState: () => EditModeState;
	startEdit: (field: "question" | "answer") => void;
	cancelEdit: () => void;
	isEditing: () => boolean;
	updateCurrentCardContent: (question: string, answer: string) => void;

	// Scheduling preview (ephemeral)
	getSchedulingPreview: () => SchedulingPreview | null;
	setSchedulingPreview: (preview: SchedulingPreview | null) => void;

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
	isStale: boolean;
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
}

export interface PanelSliceActions {
	setState: (partial: Partial<PanelSliceState>) => void;
	reset: () => void;
	markStale: () => void;
	markFresh: () => void;
	getIsStale: () => boolean;
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
	enterSelectionMode: (initialCardId?: string) => void;
	exitSelectionMode: () => void;
	toggleCardSelection: (cardId: string) => void;
	toggleCardExpanded: (cardId: string) => void;
	isInSelectionMode: () => boolean;
	setSearchQuery: (query: string) => void;
	setAddCardExpanded: (expanded: boolean) => void;
	setReviewFollowState: (sourcePath: string | null, isActive: boolean) => void;
}

// API type for components to depend on
export type PanelApi = PanelSliceState & PanelSliceActions;

export interface SessionSliceState {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	selectedNotes: Set<string>;
	searchQuery: string;
	now: Date;
}

export interface SessionSliceActions {
	setState: (partial: Partial<SessionSliceState>) => void;
	reset: () => void;
	initialize: (currentNoteName: string | null, allCards: FSRSFlashcardItem[]) => void;
	setSearchQuery: (query: string) => void;
	toggleNoteSelection: (noteName: string) => void;
	setNoteSelection: (noteName: string, selected: boolean) => void;
	setAllNotesSelected: (noteNames: string[], selected: boolean) => void;
	clearSelection: () => void;
	getSelectedNotesArray: () => string[];
	getSelectionCount: () => number;
	updateTimestamp: () => void;
}

// API type for components to depend on
export type SessionApi = SessionSliceState & SessionSliceActions;

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

export interface StatsSliceState {
	isStale: boolean;
	lastRefreshed: number;
}

export interface StatsSliceActions {
	markStale: () => void;
	markFresh: () => void;
	getIsStale: () => boolean;
}

export type StatsApi = StatsSliceState & StatsSliceActions;

export type ReviewApi = ReviewSliceState & ReviewSliceActions;

export type NoteHubStatusFilter = "all" | "has-due" | "has-new" | "needs-cards" | "no-due";
export type NoteHubSortBy = "name" | "due" | "cards";
export type NoteHubSortDirection = "asc" | "desc";

export interface NoteHubSliceState {
	isLoading: boolean;
	isStale: boolean;
	projects: ProjectInfo[];
	unassignedNotes: ProjectNoteInfo[];
	searchQuery: string;
	expandedProjectIds: Set<string>;
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	statusFilter: NoteHubStatusFilter;
	sortBy: NoteHubSortBy;
	sortDirection: NoteHubSortDirection;
}

export interface NoteHubSliceActions {
	setState: (partial: Partial<NoteHubSliceState>) => void;
	reset: () => void;
	setLoading: (isLoading: boolean) => void;
	setProjects: (projects: ProjectInfo[]) => void;
	setUnassignedNotes: (notes: ProjectNoteInfo[]) => void;
	setSearchQuery: (query: string) => void;
	toggleProjectExpanded: (projectId: string) => void;
	isProjectExpanded: (projectId: string) => boolean;
	enterSelectionMode: (initialNotePath?: string) => void;
	exitSelectionMode: () => void;
	toggleNoteSelection: (notePath: string) => void;
	isInSelectionMode: () => boolean;
	getSelectedNotePaths: () => string[];
	setStatusFilter: (filter: NoteHubStatusFilter) => void;
	setSortBy: (sortBy: NoteHubSortBy) => void;
	toggleSortDirection: () => void;
	getFilteredProjects: () => ProjectInfo[];
	getFilteredUnassignedNotes: () => ProjectNoteInfo[];
	markStale: () => void;
	markFresh: () => void;
	getIsStale: () => boolean;
}

export type NoteHubApi = NoteHubSliceState & NoteHubSliceActions;

// ── Card Browser ──

export type BrowserSortColumn =
	| "question" | "answer" | "state" | "due" | "interval"
	| "lapses" | "stability" | "difficulty" | "source";

export type BrowserStateFilter =
	| "all" | "new" | "learning" | "review" | "relearning"
	| "suspended" | "buried";

export interface BrowserSliceState {
	isLoading: boolean;
	isStale: boolean;
	allCards: FSRSFlashcardItem[];
	searchQuery: string;
	stateFilter: BrowserStateFilter;
	sortColumn: BrowserSortColumn;
	sortDirection: "asc" | "desc";
	selectionMode: SelectionMode;
	selectedCardIds: Set<string>;
	previewCardId: string | null;
}

export interface BrowserSliceActions {
	setState: (partial: Partial<BrowserSliceState>) => void;
	reset: () => void;
	setLoading: (isLoading: boolean) => void;
	setCards: (cards: FSRSFlashcardItem[]) => void;
	setSearchQuery: (query: string) => void;
	setStateFilter: (filter: BrowserStateFilter) => void;
	setSortColumn: (column: BrowserSortColumn) => void;
	toggleSortDirection: () => void;
	cycleSortOnColumn: (column: BrowserSortColumn) => void;
	enterSelectionMode: (initialCardId?: string) => void;
	exitSelectionMode: () => void;
	toggleCardSelection: (cardId: string) => void;
	selectAll: () => void;
	isInSelectionMode: () => boolean;
	getSelectedCardIds: () => string[];
	setPreviewCardId: (cardId: string | null) => void;
	getFilteredAndSortedCards: () => FSRSFlashcardItem[];
	markStale: () => void;
	markFresh: () => void;
	getIsStale: () => boolean;
}

export type BrowserApi = BrowserSliceState & BrowserSliceActions;

export interface AppState {
	review: ReviewSliceState & ReviewSliceActions;
	panel: PanelSliceState & PanelSliceActions;
	session: SessionSliceState & SessionSliceActions;
	simulator: SimulatorSliceState & SimulatorSliceActions;
	stats: StatsSliceState & StatsSliceActions;
	noteHub: NoteHubSliceState & NoteHubSliceActions;
	browser: BrowserSliceState & BrowserSliceActions;
}

export type SliceCreator<T> = (
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	deps: AppStoreDeps
) => T;
