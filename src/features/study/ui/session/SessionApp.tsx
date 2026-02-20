import { Platform } from "obsidian";
import { useEffect, useState } from "preact/hooks";
import type { SessionResult } from "../../../../shared/types/events.types";
import { usePlugin } from "../../../../shared/ui/preact";
import type { SessionLogic } from "./SessionLogic";
import {
	CustomStudySection,
	NoteList,
	QuickActions,
	SavedPresets,
	SearchBar,
	SelectionBar,
} from "./components";
import { useSessionHandlers } from "./hooks/useSessionHandlers";

interface SessionAppProps {
	logic: SessionLogic;
	onSelectAndClose: (result: SessionResult) => void;
}

export function SessionApp({ logic, onSelectAndClose }: SessionAppProps) {
	const plugin = usePlugin();
	const session = plugin.store?.getState().session;

	const [currentNoteName, setCurrentNoteName] = useState(
		session?.currentNoteName ?? null,
	);
	const [allCards, setAllCards] = useState(session?.allCards ?? []);
	const [selectedNotes, setSelectedNotes] = useState(
		session?.selectedNotes ?? new Set<string>(),
	);
	const [searchQuery, setSearchQuery] = useState(session?.searchQuery ?? "");
	const [now, setNow] = useState(session?.now ?? new Date());
	const [sessionPresets, setSessionPresets] = useState(
		plugin.settings.sessionPresets,
	);

	useEffect(() => {
		if (!plugin.store) return;
		const unsub = plugin.store.subscribe(
			(state) => state.session,
			(s) => {
				setCurrentNoteName(s.currentNoteName);
				setAllCards(s.allCards);
				setSelectedNotes(new Set(s.selectedNotes));
				setSearchQuery(s.searchQuery);
				setNow(s.now);
			},
		);
		return unsub;
	}, [plugin]);

	const {
		handleQuickAction,
		handleCustomStudyAction,
		handleOpenCustomStudyModal,
		handlePresetAction,
		handlePresetDelete,
		handleStartSession,
		handleMoveSelectedNotes,
		handleAddToProject,
		handleNoteToggle,
		handleSearchChange,
		handleNavigateToNote,
	} = useSessionHandlers({
		plugin,
		logic,
		onSelectAndClose,
		currentNoteName,
		selectedNotes,
		allCards,
		searchQuery,
		now,
		session,
		setSessionPresets,
	});

	const selectionCount = selectedNotes.size;

	return (
		<div class="ep:h-full ep:flex ep:flex-col ep:px-1 ep:overflow-hidden">
			<div class="ep:flex-1 ep:min-h-0">
				<div class="true-recall-session-content ep:flex ep:flex-col ep:h-full ep:gap-2">
					{!Platform.isMobile && (
						<div class="ep:flex ep:items-center ep:justify-between">
							<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
								Session
							</div>
						</div>
					)}

					<SearchBar query={searchQuery} onChange={handleSearchChange} />

					<div class="ep:flex ep:items-center ep:justify-between">
						<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							Quick access
						</div>
					</div>

					<QuickActions
						logic={logic}
						currentNoteName={currentNoteName}
						now={now}
						onAction={handleQuickAction}
					/>

					<CustomStudySection
						logic={logic}
						onAction={handleCustomStudyAction}
						onOpenModal={() => void handleOpenCustomStudyModal()}
					/>

					{sessionPresets.length > 0 && (
						<SavedPresets
							presets={sessionPresets}
							onAction={handlePresetAction}
							onDelete={(id) => void handlePresetDelete(id)}
						/>
					)}

					<div class="ep:flex ep:items-center ep:justify-between ep:my-2 ep:shrink-0">
						<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							Select notes
						</div>
					</div>

					<div class="true-recall-session-scroll ep:flex-1 ep:overflow-y-auto ep:min-h-0">
						<NoteList
							logic={logic}
							searchQuery={searchQuery}
							now={now}
							selectedNotes={selectedNotes}
							onToggle={handleNoteToggle}
							onNavigate={handleNavigateToNote}
						/>
					</div>

					{selectionCount > 0 && (
						<SelectionBar
							count={selectionCount}
							onStart={handleStartSession}
							onMove={() => void handleMoveSelectedNotes()}
							onAddProject={() => void handleAddToProject()}
							onClear={() => session?.clearSelection()}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
