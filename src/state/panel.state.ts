/**
 * Panel State Manager
 * Centralized state management for the flashcard panel
 */
import type { TFile } from "obsidian";
import type { FlashcardInfo, DiffResult } from "../types";
import type { AppError } from "../errors";
import type {
    PanelState,
    ProcessingStatus,
    ViewMode,
    StateListener,
    PartialPanelState,
    StateSelector,
} from "./state.types";
import { FLASHCARD_CONFIG } from "../constants";

/**
 * Check if a file is a flashcard file based on naming pattern
 * Supports both legacy (flashcards_*) and UID-based (8-hex-chars) naming
 */
function isFlashcardFileByName(basename: string): boolean {
    // Legacy: starts with "flashcards_"
    if (basename.startsWith(FLASHCARD_CONFIG.filePrefix)) {
        return true;
    }
    // New: 8-char hex UID pattern
    const uidPattern = new RegExp(`^[a-f0-9]{${FLASHCARD_CONFIG.uidLength}}$`, "i");
    return uidPattern.test(basename);
}

/**
 * Creates the initial panel state
 */
function createInitialState(): PanelState {
    return {
        status: "none",
        viewMode: "list",
        currentFile: null,
        flashcardInfo: null,
        diffResult: null,
        userInstructions: "",
        isFlashcardFile: false,
        noteFlashcardType: "unknown",
        error: null,
        renderVersion: 0,
        selectedText: "",
        hasSelection: false,
    };
}

/**
 * Centralized state manager for the flashcard panel
 * Provides reactive state updates and subscription capabilities
 */
export class PanelStateManager {
    private state: PanelState;
    private listeners: Set<StateListener> = new Set();

    constructor() {
        this.state = createInitialState();
    }

    /**
     * Get current state (immutable copy)
     */
    getState(): PanelState {
        return { ...this.state };
    }

    /**
     * Update state with partial updates
     * Notifies all listeners of the change
     */
    setState(partial: PartialPanelState): void {
        const prevState = this.state;
        this.state = { ...this.state, ...partial };
        this.notifyListeners(prevState);
    }

    /**
     * Subscribe to state changes
     * Returns unsubscribe function
     */
    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Subscribe to specific state changes using a selector
     * Only notifies when selected value changes
     */
    subscribeToSelector<T>(
        selector: StateSelector<T>,
        listener: (value: T, prevValue: T) => void
    ): () => void {
        let prevValue = selector(this.state);

        const wrappedListener: StateListener = (state) => {
            const newValue = selector(state);
            if (newValue !== prevValue) {
                const oldValue = prevValue;
                prevValue = newValue;
                listener(newValue, oldValue);
            }
        };

        this.listeners.add(wrappedListener);
        return () => this.listeners.delete(wrappedListener);
    }

    /**
     * Reset state to initial values
     */
    reset(): void {
        const prevState = this.state;
        this.state = createInitialState();
        this.notifyListeners(prevState);
    }

    /**
     * Increment render version (for race condition prevention)
     */
    incrementRenderVersion(): number {
        this.state = { ...this.state, renderVersion: this.state.renderVersion + 1 };
        return this.state.renderVersion;
    }

    /**
     * Check if render version matches current
     */
    isCurrentRender(version: number): boolean {
        return this.state.renderVersion === version;
    }

    // ===== Convenience Methods =====

    /**
     * Set current file and reset related state
     */
    setCurrentFile(file: TFile | null): void {
        this.setState({
            currentFile: file,
            status: "none",
            viewMode: "list",
            diffResult: null,
            flashcardInfo: null,
            isFlashcardFile: file ? isFlashcardFileByName(file.basename) : false,
            noteFlashcardType: "unknown",
            error: null,
        });
    }

    /**
     * Set processing status
     */
    setStatus(status: ProcessingStatus): void {
        this.setState({ status });
    }

    /**
     * Set view mode
     */
    setViewMode(mode: ViewMode): void {
        this.setState({ viewMode: mode });
    }

    /**
     * Set flashcard info
     */
    setFlashcardInfo(info: FlashcardInfo | null): void {
        this.setState({
            flashcardInfo: info,
            status: info?.exists ? "exists" : "none",
        });
    }

    /**
     * Set diff result and switch to diff mode
     */
    setDiffResult(result: DiffResult | null): void {
        this.setState({
            diffResult: result,
            viewMode: result ? "diff" : "list",
            status: result ? "exists" : this.state.status,
        });
    }

    /**
     * Set user instructions for AI
     */
    setUserInstructions(instructions: string): void {
        this.setState({ userInstructions: instructions });
    }

    /**
     * Set error state
     */
    setError(error: AppError | null): void {
        this.setState({
            error,
            status: error ? "none" : this.state.status,
        });
    }

    /**
     * Start processing (set status to processing)
     */
    startProcessing(): void {
        this.setState({
            status: "processing",
            error: null,
        });
    }

    /**
     * Finish processing (set status based on flashcard existence)
     */
    finishProcessing(hasFlashcards: boolean = false): void {
        this.setState({
            status: hasFlashcards ? "exists" : "none",
        });
    }

    /**
     * Clear diff result and return to list mode
     */
    clearDiff(): void {
        this.setState({
            diffResult: null,
            viewMode: "list",
        });
    }

    /**
     * Check if current file matches the given file
     */
    isCurrentFile(file: TFile | null): boolean {
        if (!file || !this.state.currentFile) {
            return file === this.state.currentFile;
        }
        return this.state.currentFile.path === file.path;
    }

    /**
     * Check if currently processing
     */
    isProcessing(): boolean {
        return this.state.status === "processing";
    }

    /**
     * Check if in diff mode
     */
    isInDiffMode(): boolean {
        return this.state.viewMode === "diff" && this.state.diffResult !== null;
    }

    /**
     * Set selected text for literature note generation
     */
    setSelectedText(text: string): void {
        this.setState({
            selectedText: text,
            hasSelection: text.length > 0,
        });
    }

    /**
     * Clear selection state
     */
    clearSelection(): void {
        this.setState({
            selectedText: "",
            hasSelection: false,
        });
    }

    // ===== Private Methods =====

    private notifyListeners(prevState: PanelState): void {
        const currentState = this.state;
        this.listeners.forEach((listener) => {
            try {
                listener(currentState, prevState);
            } catch (error) {
                console.error("Error in state listener:", error);
            }
        });
    }
}

/**
 * Create a new PanelStateManager instance
 */
export function createPanelStateManager(): PanelStateManager {
    return new PanelStateManager();
}
