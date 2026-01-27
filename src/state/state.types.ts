/**
 * State Types for Panel
 * Defines the state structure for the flashcard panel
 */
import type { TFile } from "obsidian";
import type { FlashcardInfo, DiffResult, NoteFlashcardType } from "../types";
import type { AppError } from "../errors";

/**
 * Processing status of the panel
 */
export type ProcessingStatus = "none" | "exists" | "processing";

/**
 * View mode of the panel
 */
export type ViewMode = "list" | "diff";

/**
 * Selection mode state
 */
export type SelectionMode = "normal" | "selecting";

/**
 * Complete state of the flashcard panel
 */
export interface PanelState {
    /** Current processing status */
    status: ProcessingStatus;
    /** Current view mode (list of cards or diff view) */
    viewMode: ViewMode;
    /** Currently active file */
    currentFile: TFile | null;
    /** Information about flashcards for current file */
    flashcardInfo: FlashcardInfo | null;
    /** Diff result when in diff mode */
    diffResult: DiffResult | null;
    /** User's additional instructions for AI */
    userInstructions: string;
    /** Whether current file is a flashcard file (flashcards_*.md) */
    isFlashcardFile: boolean;
    /** Note flashcard type based on tags (temporary, permanent, maybe, none, unknown) */
    noteFlashcardType: NoteFlashcardType;
    /** Current error if any */
    error: AppError | null;
    /** Render version for race condition prevention */
    renderVersion: number;
    /** Selected text from the active editor (for literature notes) */
    selectedText: string;
    /** Whether text is currently selected in the editor */
    hasSelection: boolean;
    /** Source note name (when viewing a flashcard file) */
    sourceNoteName: string | null;
    /** Number of uncollected flashcards (with #flashcard tag) in current file */
    uncollectedCount: number;
    /** Whether there are flashcards to collect */
    hasUncollectedFlashcards: boolean;
    /** Selection mode */
    selectionMode: SelectionMode;
    /** Selected card IDs in selection mode */
    selectedCardIds: Set<string>;
    /** Expanded card IDs (cards showing answer) */
    expandedCardIds: Set<string>;
    /** Search query for filtering flashcards */
    searchQuery: string;
    /** Whether the add card component is expanded */
    isAddCardExpanded: boolean;
}

/**
 * Listener callback type for state changes
 */
export type StateListener = (state: PanelState, prevState: PanelState) => void;

/**
 * Partial state update type
 */
export type PartialPanelState = Partial<PanelState>;

/**
 * State selector type for subscribing to specific state changes
 */
export type StateSelector<T> = (state: PanelState) => T;

// ===== Session State Types =====

/**
 * Complete state of the session view
 */
export interface SessionState {
    /** Current note name */
    currentNoteName: string | null;
    /** All flashcards */
    allCards: import("../types").FSRSFlashcardItem[];
    /** Selected note names */
    selectedNotes: Set<string>;
    /** Search query for filtering notes */
    searchQuery: string;
    /** Current timestamp for stats calculation */
    now: Date;
}

/**
 * Listener callback type for session state changes
 */
export type SessionStateListener = (state: SessionState, prevState: SessionState) => void;

/**
 * Partial state update type for session
 */
export type PartialSessionState = Partial<Omit<SessionState, "selectedNotes">> & {
    selectedNotes?: Set<string> | string[];
};

// ===== Missing Flashcards State Types =====

/**
 * Note with missing flashcards info
 */
export interface NoteWithMissingFlashcards {
    file: TFile;
    tagType: "raw" | "zettel";
    tagDisplay: string;
}

/**
 * Complete state of the missing flashcards view
 */
export interface MissingFlashcardsState {
    /** Loading state */
    isLoading: boolean;
    /** All notes missing flashcards */
    allMissingNotes: NoteWithMissingFlashcards[];
    /** Search query for filtering (supports note names and #tags) */
    searchQuery: string;
}

/**
 * Listener callback type for missing flashcards state changes
 */
export type MissingFlashcardsStateListener = (state: MissingFlashcardsState, prevState: MissingFlashcardsState) => void;

/**
 * Partial state update type for missing flashcards
 */
export type PartialMissingFlashcardsState = Partial<MissingFlashcardsState>;

// ===== Orphaned Cards State Types =====

/**
 * Orphaned card info (card without source_uid)
 */
export interface OrphanedCard {
    id: string;
    question: string;
    answer: string;
}

/**
 * Complete state of the orphaned cards view
 */
export interface OrphanedCardsState {
    /** Loading state */
    isLoading: boolean;
    /** All orphaned cards */
    allOrphanedCards: OrphanedCard[];
    /** Search query for filtering */
    searchQuery: string;
    /** Selected card IDs */
    selectedCardIds: Set<string>;
}

/**
 * Listener callback type for orphaned cards state changes
 */
export type OrphanedCardsStateListener = (state: OrphanedCardsState, prevState: OrphanedCardsState) => void;

/**
 * Partial state update type for orphaned cards
 */
export type PartialOrphanedCardsState = Partial<Omit<OrphanedCardsState, "selectedCardIds">> & {
    selectedCardIds?: Set<string> | string[];
};
