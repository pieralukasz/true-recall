import type { FSRSFlashcardItem } from "../types";
import type {
	SessionState,
	SessionStateListener,
	PartialSessionState,
} from "./state.types";

function createInitialState(): SessionState {
	return {
		currentNoteName: null,
		allCards: [],
		selectedNotes: new Set<string>(),
		searchQuery: "",
		now: new Date(),
	};
}

export class SessionStateManager {
	private state: SessionState;
	private listeners: Set<SessionStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	getState(): SessionState {
		return {
			...this.state,
			selectedNotes: new Set(this.state.selectedNotes),
		};
	}

	setState(partial: PartialSessionState): void {
		const prevState = this.state;
		this.state = {
			...this.state,
			...partial,
			selectedNotes: this.cloneSet(Array.isArray(partial.selectedNotes) ? new Set(partial.selectedNotes) : (partial.selectedNotes ?? this.state.selectedNotes)),
		};
		this.notifyListeners(prevState);
	}

	subscribe(listener: SessionStateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	reset(): void {
		const prevState = this.state;
		this.state = createInitialState();
		this.notifyListeners(prevState);
	}

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

	setSearchQuery(query: string): void {
		this.setState({ searchQuery: query });
	}

	toggleNoteSelection(noteName: string): void {
		const newSelected = new Set(this.state.selectedNotes);
		if (newSelected.has(noteName)) {
			newSelected.delete(noteName);
		} else {
			newSelected.add(noteName);
		}
		this.setState({ selectedNotes: newSelected });
	}

	setNoteSelection(noteName: string, selected: boolean): void {
		const newSelected = new Set(this.state.selectedNotes);
		if (selected) {
			newSelected.add(noteName);
		} else {
			newSelected.delete(noteName);
		}
		this.setState({ selectedNotes: newSelected });
	}

	setAllNotesSelected(noteNames: string[], selected: boolean): void {
		this.setState({
			selectedNotes: selected ? new Set(noteNames) : new Set<string>(),
		});
	}

	clearSelection(): void {
		this.setState({ selectedNotes: new Set<string>() });
	}

	getSelectedNotesArray(): string[] {
		return Array.from(this.state.selectedNotes);
	}

	getSelectionCount(): number {
		return this.state.selectedNotes.size;
	}

	updateTimestamp(): void {
		this.setState({ now: new Date() });
	}

	private cloneSet(set: Set<string>): Set<string> {
		return new Set(set);
	}

	private notifyListeners(prevState: SessionState): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("Error in session state listener:", error);
			}
		});
	}
}

export function createSessionStateManager(): SessionStateManager {
	return new SessionStateManager();
}
