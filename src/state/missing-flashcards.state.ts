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
	 * Get filtered notes based on current state
	 * Supports both note name search and tag search (prefix with #)
	 */
	getFilteredNotes(): NoteWithMissingFlashcards[] {
		const notes = [...this.state.allMissingNotes];

		if (!this.state.searchQuery) {
			return notes;
		}

		const query = this.state.searchQuery.toLowerCase();

		// Tag search mode: query starts with #
		if (query.startsWith("#")) {
			const tagPrefix = query.slice(1); // Remove #
			return notes.filter((note) => {
				// Match against full tag path (mind/raw, mind/zettel) or just type (raw, zettel)
				const fullTag = `mind/${note.tagType}`;
				return (
					fullTag.startsWith(tagPrefix) ||
					note.tagType.startsWith(tagPrefix)
				);
			});
		}

		// Normal search: filter by name/path
		return notes.filter(
			(note) =>
				note.file.basename.toLowerCase().includes(query) ||
				note.file.path.toLowerCase().includes(query)
		);
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
