/**
 * Ready to Harvest State Manager
 * Centralized state management for the ready to harvest view
 */
import type {
	ReadyToHarvestState,
	ReadyToHarvestStateListener,
	PartialReadyToHarvestState,
	NoteReadyToHarvest,
} from "./state.types";

/**
 * Creates the initial ready to harvest state
 */
function createInitialState(): ReadyToHarvestState {
	return {
		isLoading: true,
		allReadyNotes: [],
		searchQuery: "",
	};
}

/**
 * Centralized state manager for the ready to harvest view
 */
export class ReadyToHarvestStateManager {
	private state: ReadyToHarvestState;
	private listeners: Set<ReadyToHarvestStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	/**
	 * Get current state (immutable copy)
	 */
	getState(): ReadyToHarvestState {
		return {
			...this.state,
			allReadyNotes: [...this.state.allReadyNotes],
		};
	}

	/**
	 * Update state with partial updates
	 */
	setState(partial: PartialReadyToHarvestState): void {
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
	subscribe(listener: ReadyToHarvestStateListener): () => void {
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
	 * Set all ready notes
	 */
	setReadyNotes(notes: NoteReadyToHarvest[]): void {
		this.setState({
			allReadyNotes: notes,
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
	 */
	getFilteredNotes(): NoteReadyToHarvest[] {
		let notes = [...this.state.allReadyNotes];

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

	private notifyListeners(prevState: ReadyToHarvestState): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("Error in ready to harvest state listener:", error);
			}
		});
	}
}

/**
 * Create a new ReadyToHarvestStateManager instance
 */
export function createReadyToHarvestStateManager(): ReadyToHarvestStateManager {
	return new ReadyToHarvestStateManager();
}
