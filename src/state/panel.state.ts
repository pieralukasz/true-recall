import type { TFile } from "obsidian";
import type { FlashcardInfo } from "../types";
import type { AppError } from "../errors";
import type {
    PanelState,
    ProcessingStatus,
    ViewMode,
    StateListener,
    PartialPanelState,
    StateSelector,
} from "./state.types";

function createInitialState(): PanelState {
    return {
        status: "none",
        viewMode: "list",
        currentFile: null,
        flashcardInfo: null,
        userInstructions: "",
        isFlashcardFile: false,
        noteFlashcardType: "unknown",
        error: null,
        renderVersion: 0,
        selectedText: "",
        hasSelection: false,
        sourceNoteName: null,
        uncollectedCount: 0,
        selectionMode: "normal",
        selectedCardIds: new Set(),
        expandedCardIds: new Set(),
        searchQuery: "",
        isAddCardExpanded: false,
        isFollowingReview: false,
        reviewSourceNotePath: null,
    };
}

export class PanelStateManager {
    private state: PanelState;
    private listeners: Set<StateListener> = new Set();

    constructor() {
        this.state = createInitialState();
    }

    getState(): PanelState {
        return {
            ...this.state,
            selectedCardIds: new Set(this.state.selectedCardIds),
            expandedCardIds: new Set(this.state.expandedCardIds),
        };
    }

    setState(partial: PartialPanelState): void {
        const prevState = this.state;
        this.state = { ...this.state, ...partial };
        this.notifyListeners(prevState);
    }

    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Only notifies when selected value changes */
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

    reset(): void {
        const prevState = this.state;
        this.state = createInitialState();
        this.notifyListeners(prevState);
    }

    incrementRenderVersion(): number {
        this.state = { ...this.state, renderVersion: this.state.renderVersion + 1 };
        return this.state.renderVersion;
    }

    isCurrentRender(version: number): boolean {
        return this.state.renderVersion === version;
    }

    setCurrentFile(file: TFile | null): void {
        this.setState({
            currentFile: file,
            status: "none",
            viewMode: "list",
            flashcardInfo: null,
            isFlashcardFile: false,
            noteFlashcardType: "unknown",
            error: null,
        });
    }

    setStatus(status: ProcessingStatus): void {
        this.setState({ status });
    }

    setViewMode(mode: ViewMode): void {
        this.setState({ viewMode: mode });
    }

    setFlashcardInfo(info: FlashcardInfo | null): void {
        this.setState({
            flashcardInfo: info,
            status: info?.exists ? "exists" : "none",
        });
    }

    setUserInstructions(instructions: string): void {
        this.setState({ userInstructions: instructions });
    }

    setError(error: AppError | null): void {
        this.setState({
            error,
            status: error ? "none" : this.state.status,
        });
    }

    startProcessing(): void {
        this.setState({
            status: "processing",
            error: null,
        });
    }

    finishProcessing(hasFlashcards: boolean = false): void {
        this.setState({
            status: hasFlashcards ? "exists" : "none",
        });
    }

    isCurrentFile(file: TFile | null): boolean {
        if (!file || !this.state.currentFile) {
            return file === this.state.currentFile;
        }
        return this.state.currentFile.path === file.path;
    }

    isProcessing(): boolean {
        return this.state.status === "processing";
    }

    setSelectedText(text: string): void {
        this.setState({
            selectedText: text,
            hasSelection: text.length > 0,
        });
    }

    clearSelection(): void {
        this.setState({
            selectedText: "",
            hasSelection: false,
        });
    }

    setUncollectedInfo(count: number): void {
        this.setState({
            uncollectedCount: count,
        });
    }

    hasUncollectedFlashcards(): boolean {
        return this.state.uncollectedCount > 0;
    }

    enterSelectionMode(initialCardId?: string): void {
        const selectedCardIds = new Set<string>();
        if (initialCardId) {
            selectedCardIds.add(initialCardId);
        }
        this.setState({
            selectionMode: "selecting",
            selectedCardIds,
        });
    }

    exitSelectionMode(): void {
        this.setState({
            selectionMode: "normal",
            selectedCardIds: new Set(),
        });
    }

    toggleCardSelection(cardId: string): void {
        const newSet = new Set(this.state.selectedCardIds);
        if (newSet.has(cardId)) {
            newSet.delete(cardId);
        } else {
            newSet.add(cardId);
        }
        this.setState({ selectedCardIds: newSet });
    }

    toggleCardExpanded(cardId: string): void {
        const newSet = new Set(this.state.expandedCardIds);
        if (newSet.has(cardId)) {
            newSet.delete(cardId);
        } else {
            newSet.add(cardId);
        }
        this.setState({ expandedCardIds: newSet });
    }

    isInSelectionMode(): boolean {
        return this.state.selectionMode === "selecting";
    }

    setSearchQuery(query: string): void {
        this.setState({ searchQuery: query });
    }

    setAddCardExpanded(expanded: boolean): void {
        this.setState({ isAddCardExpanded: expanded });
    }

    setReviewFollowState(sourcePath: string | null, isActive: boolean): void {
        this.setState({
            isFollowingReview: isActive && sourcePath !== null,
            reviewSourceNotePath: isActive ? sourcePath : null,
        });
    }

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

export function createPanelStateManager(): PanelStateManager {
    return new PanelStateManager();
}
