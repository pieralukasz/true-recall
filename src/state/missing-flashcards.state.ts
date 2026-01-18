/**
 * Missing Flashcards State Manager
 * Centralized state management for the missing flashcards view
 */
import type {
	MissingFlashcardsState,
	MissingFlashcardsStateListener,
	PartialMissingFlashcardsState,
	NoteWithMissingFlashcards,
} from "./state.types";

/**
 * Creates the initial missing flashcards state
 */
function createInitialState(): MissingFlashcardsState {
	return {
		isLoading: true,
		allMissingNotes: [],
		searchQuery: "",
		activeTagFilter: null,
	};
}

/**
 * Centralized state manager for the missing flashcards view
 */
export class MissingFlashcardsStateManager {
	private state: MissingFlashcardsState;
	private listeners: Set<MissingFlashcardsStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	/**
	 * Get current state (immutable copy)
	 */
	getState(): MissingFlashcardsState {
		return {
			...this.state,
			allMissingNotes: [...this.state.allMissingNotes],
		};
	}

	/**
	 * Update state with partial updates
	 */
	setState(partial: PartialMissingFlashcardsState): void {
		const prevState = this.state;
		this.state = {
			...this.state,
			...partial,
		};
		this.notifyListeners(prevState);
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe(listener: MissingFlashcardsStateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Reset state to initial values
	 */
	reset(): void {
		const prevState = this.state;
		this.state = createInitialState();
		this.notifyListeners(prevState);
	}

	// ===== Convenience Methods =====

	/**
	 * Set loading state
	 */
	setLoading(isLoading: boolean): void {
		this.setState({ isLoading });
	}

	/**
	 * Set all missing notes
	 */
	setMissingNotes(notes: NoteWithMissingFlashcards[]): void {
		this.setState({
			allMissingNotes: notes,
			isLoading: false,
		});
	}

	/**
	 * Set search query
	 */
	setSearchQuery(query: string): void {
		this.setState({ searchQuery: query });
	}

	/**
	 * Set tag filter
	 */
	setTagFilter(filter: "raw" | "zettel" | null): void {
		this.setState({ activeTagFilter: filter });
	}

	/**
	 * Get filtered notes based on current state
	 */
	getFilteredNotes(): NoteWithMissingFlashcards[] {
		let notes = [...this.state.allMissingNotes];

		// Apply tag filter
		if (this.state.activeTagFilter) {
			notes = notes.filter(
				(note) => note.tagType === this.state.activeTagFilter
			);
		}

		// Apply search filter
		if (this.state.searchQuery) {
			const query = this.state.searchQuery.toLowerCase();
			notes = notes.filter(
				(note) =>
					note.file.basename.toLowerCase().includes(query) ||
					note.file.path.toLowerCase().includes(query)
			);
		}

		return notes;
	}

	// ===== Private Methods =====

	private notifyListeners(prevState: MissingFlashcardsState): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("Error in missing flashcards state listener:", error);
			}
		});
	}
}

/**
 * Create a new MissingFlashcardsStateManager instance
 */
export function createMissingFlashcardsStateManager(): MissingFlashcardsStateManager {
	return new MissingFlashcardsStateManager();
}
