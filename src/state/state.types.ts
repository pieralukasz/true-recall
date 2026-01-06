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
