import type { TFile } from "obsidian";
import type { FlashcardInfo, NoteFlashcardType } from "../types";
import type { AppError } from "../errors";

export type ProcessingStatus = "none" | "exists" | "processing";

export type ViewMode = "list";

export type SelectionMode = "normal" | "selecting";

export interface PanelState {
    status: ProcessingStatus;
    viewMode: ViewMode;
    currentFile: TFile | null;
    flashcardInfo: FlashcardInfo | null;
    userInstructions: string;
    isFlashcardFile: boolean;
    noteFlashcardType: NoteFlashcardType;
    error: AppError | null;
    /** For race condition prevention */
    renderVersion: number;
    selectedText: string;
    hasSelection: boolean;
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

export type StateListener = (state: PanelState, prevState: PanelState) => void;

export type PartialPanelState = Partial<PanelState>;

export type StateSelector<T> = (state: PanelState) => T;

export interface SessionState {
    currentNoteName: string | null;
    allCards: import("../types").FSRSFlashcardItem[];
    selectedNotes: Set<string>;
    searchQuery: string;
    now: Date;
}

export type SessionStateListener = (state: SessionState, prevState: SessionState) => void;

export type PartialSessionState = Partial<Omit<SessionState, "selectedNotes">> & {
    selectedNotes?: Set<string> | string[];
};

