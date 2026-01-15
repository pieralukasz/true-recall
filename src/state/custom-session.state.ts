/**
 * Custom Session State Manager
 * Centralized state management for the custom session view
 */
import type { FSRSFlashcardItem } from "../types";
import type {
	CustomSessionState,
	CustomSessionStateListener,
	PartialCustomSessionState,
} from "./state.types";

/**
 * Creates the initial custom session state
 */
function createInitialState(): CustomSessionState {
	return {
		currentNoteName: null,
		allCards: [],
		selectedNotes: new Set<string>(),
		searchQuery: "",
		now: new Date(),
	};
}

/**
 * Centralized state manager for the custom session view
 * Provides reactive state updates and subscription capabilities
 */
export class CustomSessionStateManager {
	private state: CustomSessionState;
	private listeners: Set<CustomSessionStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	/**
	 * Get current state (immutable copy)
	 */
	getState(): CustomSessionState {
		return {
			...this.state,
			selectedNotes: new Set(this.state.selectedNotes),
		};
	}

	/**
	 * Update state with partial updates
	 * Notifies all listeners of the change
	 */
	setState(partial: PartialCustomSessionState): void {
		const prevState = this.state;
		this.state = {
			...this.state,
			...partial,
			selectedNotes: this.cloneSet(Array.isArray(partial.selectedNotes) ? new Set(partial.selectedNotes) : (partial.selectedNotes ?? this.state.selectedNotes)),
		};
		this.notifyListeners(prevState);
	}

	/**
	 * Subscribe to state changes
	 * Returns unsubscribe function
	 */
	subscribe(listener: CustomSessionStateListener): () => void {
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
	 * Initialize with session data
	 */
	initialize(
		currentNoteName: string | null,
		allCards: FSRSFlashcardItem[]
	): void {
		this.setState({
			currentNoteName,
			allCards,
			now: new Date(),
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
	toggleNoteSelection(noteName: string): void {
		const newSelected = new Set(this.state.selectedNotes);
		if (newSelected.has(noteName)) {
			newSelected.delete(noteName);
		} else {
			newSelected.add(noteName);
		}
		this.setState({ selectedNotes: newSelected });
	}

	/**
	 * Set note selection directly
	 */
	setNoteSelection(noteName: string, selected: boolean): void {
		const newSelected = new Set(this.state.selectedNotes);
		if (selected) {
			newSelected.add(noteName);
		} else {
			newSelected.delete(noteName);
		}
		this.setState({ selectedNotes: newSelected });
	}

	/**
	 * Set all visible notes as selected
	 */
	setAllNotesSelected(noteNames: string[], selected: boolean): void {
		this.setState({
			selectedNotes: selected ? new Set(noteNames) : new Set<string>(),
		});
	}

	/**
	 * Clear selection
	 */
	clearSelection(): void {
		this.setState({ selectedNotes: new Set<string>() });
	}

	/**
	 * Get selected notes as array
	 */
	getSelectedNotesArray(): string[] {
		return Array.from(this.state.selectedNotes);
	}

	/**
	 * Get selection count
	 */
	getSelectionCount(): number {
		return this.state.selectedNotes.size;
	}

	/**
	 * Update current timestamp
	 */
	updateTimestamp(): void {
		this.setState({ now: new Date() });
	}

	// ===== Private Methods =====

	private cloneSet(set: Set<string>): Set<string> {
		return new Set(set);
	}

	private notifyListeners(prevState: CustomSessionState): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("Error in custom session state listener:", error);
			}
		});
	}
}

/**
 * Create a new CustomSessionStateManager instance
 */
export function createCustomSessionStateManager(): CustomSessionStateManager {
	return new CustomSessionStateManager();
}
