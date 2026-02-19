import type { FSRSFlashcardItem } from "../../../types";
import type {
	AppState,
	AppStoreDeps,
	SessionSliceActions,
	SessionSliceState,
} from "../types";

type SessionSlice = SessionSliceState & SessionSliceActions;

function createInitialState(): SessionSliceState {
	return {
		currentNoteName: null,
		allCards: [],
		selectedNotes: new Set<string>(),
		searchQuery: "",
		now: new Date(),
	};
}

export function createSessionSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	_deps: AppStoreDeps,
): SessionSlice {
	const initial = createInitialState();

	const slice: SessionSlice = {
		...initial,

		setState: (partial: Partial<SessionSliceState>) => {
			set((s) => {
				let selectedNotes = s.session.selectedNotes;
				if (partial.selectedNotes !== undefined) {
					selectedNotes =
						partial.selectedNotes instanceof Set
							? new Set(partial.selectedNotes)
							: new Set(partial.selectedNotes);
				}
				return {
					session: {
						...s.session,
						...partial,
						selectedNotes,
					},
				};
			});
		},

		reset: () => {
			set((s) => ({
				session: { ...s.session, ...createInitialState() },
			}));
		},

		initialize: (
			currentNoteName: string | null,
			allCards: FSRSFlashcardItem[],
		) => {
			set((s) => ({
				session: {
					...s.session,
					currentNoteName,
					allCards,
					now: new Date(),
				},
			}));
		},

		setSearchQuery: (query: string) => {
			set((s) => ({
				session: { ...s.session, searchQuery: query },
			}));
		},

		toggleNoteSelection: (noteName: string) => {
			const newSelected = new Set(get().session.selectedNotes);
			if (newSelected.has(noteName)) {
				newSelected.delete(noteName);
			} else {
				newSelected.add(noteName);
			}
			set((s) => ({
				session: { ...s.session, selectedNotes: newSelected },
			}));
		},

		setNoteSelection: (noteName: string, selected: boolean) => {
			const newSelected = new Set(get().session.selectedNotes);
			if (selected) {
				newSelected.add(noteName);
			} else {
				newSelected.delete(noteName);
			}
			set((s) => ({
				session: { ...s.session, selectedNotes: newSelected },
			}));
		},

		setAllNotesSelected: (noteNames: string[], selected: boolean) => {
			set((s) => ({
				session: {
					...s.session,
					selectedNotes: selected ? new Set(noteNames) : new Set<string>(),
				},
			}));
		},

		clearSelection: () => {
			set((s) => ({
				session: { ...s.session, selectedNotes: new Set<string>() },
			}));
		},

		getSelectedNotesArray: () => {
			return Array.from(get().session.selectedNotes);
		},

		getSelectionCount: () => {
			return get().session.selectedNotes.size;
		},

		updateTimestamp: () => {
			set((s) => ({
				session: { ...s.session, now: new Date() },
			}));
		},
	};

	return slice;
}
