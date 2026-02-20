import { NoteHubContent } from "@features/library/ui/note-hub/components/NoteHubContent";
import { NoteHubToolbar } from "@features/library/ui/note-hub/components/NoteHubToolbar";
import { SelectionFooter } from "@features/library/ui/note-hub/components/SelectionFooter";
import { useNoteHubActions } from "@features/library/ui/note-hub/hooks/useNoteHubActions";
import { useLoadData } from "@features/library/ui/note-hub/hooks/useNoteHubData";
import {
	useNoteHub,
	useNoteHubState,
} from "@features/library/ui/note-hub/hooks/useNoteHubState";
import { effect } from "@preact/signals";
import { dataVersion, track } from "@shared/services/signals";
import { useEffect, useRef } from "preact/hooks";

export function NoteHubApp() {
	const state = useNoteHubState();
	const noteHub = useNoteHub();
	const loadData = useLoadData();
	const actions = useNoteHubActions(loadData);
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		void loadData();

		let isFirstRun = true;
		const dispose = effect(() => {
			track(dataVersion);
			if (isFirstRun) {
				isFirstRun = false;
				return;
			}
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = setTimeout(() => {
				void loadData();
			}, 500);
		});
		return () => {
			dispose();
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
		};
	}, [loadData]);

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0">
			<div class="ep:shrink-0">
				<NoteHubToolbar
					searchQuery={state.searchQuery}
					statusFilter={state.statusFilter}
					sortBy={state.sortBy}
					sortDirection={state.sortDirection}
					onSearchChange={(q) => noteHub.setSearchQuery(q)}
					onStatusFilterChange={(f) => noteHub.setStatusFilter(f)}
					onSortByChange={(s) => noteHub.setSortBy(s)}
					onSortDirectionToggle={() => noteHub.toggleSortDirection()}
					onRefresh={() => void loadData()}
				/>
			</div>
			<div class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
				<NoteHubContent
					isLoading={state.isLoading}
					projects={state.filteredProjects}
					unassignedNotes={state.filteredUnassigned}
					expandedProjectIds={state.expandedProjectIds}
					selectionMode={state.selectionMode}
					selectedNotePaths={state.selectedNotePaths}
					onToggleExpand={(id) => noteHub.toggleProjectExpanded(id)}
					onToggleNoteSelection={(path) => noteHub.toggleNoteSelection(path)}
					onEnterSelectionMode={(path) => noteHub.enterSelectionMode(path)}
					onOpenNote={actions.handleOpenNote}
					onStartReview={(f) => void actions.handleStartReview(f)}
					onStartReviewProject={(n) => void actions.handleStartReviewProject(n)}
					onCustomStudyProject={(n) => void actions.handleCustomStudyProject(n)}
					onCustomStudyNote={(f) => void actions.handleCustomStudyNote(f)}
					onGenerateCards={(p) => void actions.handleGenerateCards(p)}
					onAddToProject={(p) => void actions.handleAddNoteToProject(p)}
					onRemoveFromProject={(np, proj) =>
						void actions.handleRemoveFromProject(np, proj)
					}
					onAddNotesToProject={(pn) => void actions.handleAddNotesToProject(pn)}
				/>
			</div>
			<div class="ep:shrink-0">
				<SelectionFooter
					selectionMode={state.selectionMode}
					selectedNotePaths={state.selectedNotePaths}
					projects={state.projects}
					unassignedNotes={state.unassignedNotes}
					onCancel={() => noteHub.exitSelectionMode()}
					onBulkAddToProject={() => void actions.handleBulkAddToProject()}
					onBulkReview={() => void actions.handleBulkReview()}
				/>
			</div>
		</div>
	);
}
