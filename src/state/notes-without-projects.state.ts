/**
 * Notes Without Projects State Manager
 * Centralized state management for the notes without projects view
 */
import type { TFile } from "obsidian";

/**
 * Represents a note that doesn't belong to any project
 */
export interface NoteWithoutProject {
	file: TFile;
	name: string;
	path: string;
}

/**
 * Complete state of the notes without projects view
 */
export interface NotesWithoutProjectsState {
	/** Loading state */
	isLoading: boolean;
	/** All notes without projects */
	notes: NoteWithoutProject[];
	/** Search query for filtering */
	searchQuery: string;
	/** Set of selected note paths */
	selectedNotePaths: Set<string>;
}

/**
 * Listener callback type for notes without projects state changes
 */
export type NotesWithoutProjectsStateListener = (
	state: NotesWithoutProjectsState,
	prevState: NotesWithoutProjectsState
) => void;

/**
 * Partial state update type for notes without projects
 */
export type PartialNotesWithoutProjectsState = Partial<NotesWithoutProjectsState>;

/**
 * Creates the initial notes without projects state
 */
function createInitialState(): NotesWithoutProjectsState {
	return {
		isLoading: true,
		notes: [],
		searchQuery: "",
		selectedNotePaths: new Set<string>(),
	};
}

/**
 * Centralized state manager for the notes without projects view
 */
export class NotesWithoutProjectsStateManager {
	private state: NotesWithoutProjectsState;
	private listeners: Set<NotesWithoutProjectsStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	/**
	 * Get current state (immutable copy)
	 */
	getState(): NotesWithoutProjectsState {
		return {
			...this.state,
			notes: [...this.state.notes],
			selectedNotePaths: new Set(this.state.selectedNotePaths),
		};
	}

	/**
	 * Update state with partial updates
	 */
	setState(partial: PartialNotesWithoutProjectsState): void {
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
	subscribe(listener: NotesWithoutProjectsStateListener): () => void {
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
	 * Set all notes (also clears selection)
	 */
	setNotes(notes: NoteWithoutProject[]): void {
		this.setState({
			notes,
			isLoading: false,
			selectedNotePaths: new Set<string>(),
		});
	}

	/**
	 * Set search query
	 */
	setSearchQuery(query: string): void {
		this.setState({ searchQuery: query });
	}

	/**
	 * Toggle note selection
	 */
	toggleNoteSelection(notePath: string): void {
		const newSet = new Set(this.state.selectedNotePaths);
		if (newSet.has(notePath)) {
			newSet.delete(notePath);
		} else {
			newSet.add(notePath);
		}
		this.setState({ selectedNotePaths: newSet });
	}

	/**
	 * Select all filtered notes
	 */
	selectAllFiltered(): void {
		const filteredNotes = this.getFilteredNotes();
		const newSet = new Set(filteredNotes.map((note) => note.path));
		this.setState({ selectedNotePaths: newSet });
	}

	/**
	 * Clear all selections
	 */
	clearSelection(): void {
		this.setState({ selectedNotePaths: new Set<string>() });
	}

	/**
	 * Get filtered notes based on current state (search filter, sorted alphabetically)
	 */
	getFilteredNotes(): NoteWithoutProject[] {
		let notes = [...this.state.notes];

		// Apply search filter
		if (this.state.searchQuery) {
			const query = this.state.searchQuery.toLowerCase();
			notes = notes.filter((note) => note.name.toLowerCase().includes(query));
		}

		// Sort alphabetically by name
		notes.sort((a, b) => a.name.localeCompare(b.name));

		return notes;
	}

	/**
	 * Get count of selected notes
	 */
	getSelectedCount(): number {
		return this.state.selectedNotePaths.size;
	}

	// ===== Private Methods =====

	private notifyListeners(prevState: NotesWithoutProjectsState): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("Error in notes without projects state listener:", error);
			}
		});
	}
}

/**
 * Create a new NotesWithoutProjectsStateManager instance
 */
export function createNotesWithoutProjectsStateManager(): NotesWithoutProjectsStateManager {
	return new NotesWithoutProjectsStateManager();
}
