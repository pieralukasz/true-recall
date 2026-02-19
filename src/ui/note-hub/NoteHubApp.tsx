import { effect } from "@preact/signals";
import type { WorkspaceLeaf } from "obsidian";
import { Menu, TFile } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { State } from "ts-fsrs";
import { VIEW_TYPE_REVIEW } from "../../constants";
import { notify } from "../../services";
import { dataVersion, track } from "../../services/core/signals";
import type {
	NoteHubApi,
	NoteHubSortBy,
	NoteHubSortDirection,
	NoteHubStatusFilter,
	SelectionMode,
} from "../../state/store";
import type { ProjectInfo, ProjectNoteInfo } from "../../types";
import { AddToProjectModal, SelectNoteModal } from "../modals";
import { useApp, usePlugin } from "../preact";
import {
	CardCountDisplay,
	EmptyState,
	IconButton,
	LoadingSpinner,
	SearchInput,
} from "../preact/components";
import { useIcon } from "../preact/hooks";
import { filterActiveCardsOnly } from "../shared/helpers";

// ── Constants ──────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: NoteHubStatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Due", value: "has-due" },
	{ label: "New", value: "has-new" },
	{ label: "Needs Cards", value: "needs-cards" },
	{ label: "Done", value: "no-due" },
];

const SORT_OPTIONS: { label: string; value: NoteHubSortBy }[] = [
	{ label: "Name", value: "name" },
	{ label: "Due Count", value: "due" },
	{ label: "Card Count", value: "cards" },
];

const PILL_BASE =
	"ep:px-2 ep:py-1 ep:rounded-xl ep:text-ui-smaller ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";
const PILL_ACTIVE = `${PILL_BASE} ep:bg-obs-interactive ep:text-obs-on-accent`;
const PILL_INACTIVE = `${PILL_BASE} ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal`;

const ICON_BTN_CLS =
	"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

// ── Hooks ──────────────────────────────────────────────────────

function useNoteHub(): NoteHubApi {
	return usePlugin().store!.getState().noteHub;
}

function useNoteHubState() {
	const plugin = usePlugin();
	const [state, setState] = useState(() => {
		const nh = plugin.store!.getState().noteHub;
		return {
			isLoading: nh.isLoading,
			projects: nh.projects,
			unassignedNotes: nh.unassignedNotes,
			searchQuery: nh.searchQuery,
			expandedProjectIds: nh.expandedProjectIds,
			selectionMode: nh.selectionMode as SelectionMode,
			selectedNotePaths: nh.selectedNotePaths,
			statusFilter: nh.statusFilter as NoteHubStatusFilter,
			sortBy: nh.sortBy as NoteHubSortBy,
			sortDirection: nh.sortDirection as NoteHubSortDirection,
			filteredProjects: nh.getFilteredProjects(),
			filteredUnassigned: nh.getFilteredUnassignedNotes(),
		};
	});

	useEffect(() => {
		const unsub = plugin.store!.subscribe(
			(s) => s.noteHub,
			() => {
				const nh = plugin.store!.getState().noteHub;
				setState({
					isLoading: nh.isLoading,
					projects: nh.projects,
					unassignedNotes: nh.unassignedNotes,
					searchQuery: nh.searchQuery,
					expandedProjectIds: nh.expandedProjectIds,
					selectionMode: nh.selectionMode as SelectionMode,
					selectedNotePaths: nh.selectedNotePaths,
					statusFilter: nh.statusFilter as NoteHubStatusFilter,
					sortBy: nh.sortBy as NoteHubSortBy,
					sortDirection: nh.sortDirection as NoteHubSortDirection,
					filteredProjects: nh.getFilteredProjects(),
					filteredUnassigned: nh.getFilteredUnassignedNotes(),
				});
			},
		);
		return unsub;
	}, [plugin]);

	return state;
}

// ── Data Loading ───────────────────────────────────────────────

function useLoadData() {
	const plugin = usePlugin();
	const app = useApp();

	return useCallback(async () => {
		const noteHub = plugin.store!.getState().noteHub;
		noteHub.setLoading(true);

		try {
			const frontmatterIndex = plugin.frontmatterIndex;
			const allProjectNames = frontmatterIndex.getAllValues("projects");
			const projectNoteCounts = new Map<string, number>();
			const projectNotes = new Map<string, ProjectNoteInfo[]>();
			const sourceUidToProjects = new Map<string, string[]>();
			const pathToUid = new Map<string, string>();

			for (const projectName of allProjectNames) {
				const files = frontmatterIndex.getFilesByValue("projects", projectName);
				const notes: ProjectNoteInfo[] = [];
				for (const file of files) {
					const uid = frontmatterIndex.getValues("flashcard_uid", file.path)[0];
					if (uid) {
						pathToUid.set(file.path, uid);
						const existing = sourceUidToProjects.get(uid) ?? [];
						if (!existing.includes(projectName)) {
							existing.push(projectName);
							sourceUidToProjects.set(uid, existing);
						}
					}

					if (file.basename === projectName) continue;

					notes.push({
						path: file.path,
						name: file.basename,
						cardCount: 0,
						newCount: 0,
						learningCount: 0,
						dueCount: 0,
					});
				}
				projectNotes.set(projectName, notes);
				projectNoteCounts.set(projectName, notes.length);
			}

			const projectCardCounts = new Map<string, number>();
			const projectNewCounts = new Map<string, number>();
			const projectLearningCounts = new Map<string, number>();
			const projectDueCounts = new Map<string, number>();
			const noteCardCounts = new Map<string, Map<string, number>>();
			const uidStateCounts = new Map<
				string,
				{ newCount: number; learningCount: number; dueCount: number }
			>();
			const uidCardCounts = new Map<string, number>();
			const sourceUidToPath = new Map<string, string>();
			const allCards = plugin.cardStore.cards.getAll();
			const now = new Date();
			const tomorrowBoundary =
				plugin.dayBoundaryService.getTomorrowBoundary(now);
			const activeCards = filterActiveCardsOnly(allCards, { now });

			const sourceUidToFile = new Map<string, TFile | null>();
			for (const card of activeCards) {
				if (card.sourceUid && !sourceUidToFile.has(card.sourceUid)) {
					sourceUidToFile.set(
						card.sourceUid,
						frontmatterIndex.getFilesByValue(
							"flashcard_uid",
							card.sourceUid,
						)[0] ?? null,
					);
				}
			}

			for (const card of activeCards) {
				if (!card.sourceUid) continue;

				uidCardCounts.set(
					card.sourceUid,
					(uidCardCounts.get(card.sourceUid) || 0) + 1,
				);

				const projects = sourceUidToProjects.get(card.sourceUid) || [];
				const sourceFile = sourceUidToFile.get(card.sourceUid);
				if (!sourceFile) continue;

				if (!sourceUidToPath.has(card.sourceUid)) {
					sourceUidToPath.set(card.sourceUid, sourceFile.path);
				}

				if (!uidStateCounts.has(card.sourceUid)) {
					uidStateCounts.set(card.sourceUid, {
						newCount: 0,
						learningCount: 0,
						dueCount: 0,
					});
				}
				const uidStats = uidStateCounts.get(card.sourceUid)!;

				const dueDate = new Date(card.due);
				const isNew = card.state === State.New;
				const isLearning =
					card.state === State.Learning || card.state === State.Relearning;
				const isDue = card.state === State.Review && dueDate < tomorrowBoundary;

				if (isNew) uidStats.newCount++;
				if (isLearning) uidStats.learningCount++;
				if (isDue) uidStats.dueCount++;

				for (const projectName of projects) {
					projectCardCounts.set(
						projectName,
						(projectCardCounts.get(projectName) || 0) + 1,
					);

					if (!noteCardCounts.has(projectName)) {
						noteCardCounts.set(projectName, new Map());
					}
					const noteCounts = noteCardCounts.get(projectName)!;
					noteCounts.set(
						sourceFile.path,
						(noteCounts.get(sourceFile.path) || 0) + 1,
					);

					if (isNew) {
						projectNewCounts.set(
							projectName,
							(projectNewCounts.get(projectName) || 0) + 1,
						);
					}
					if (isLearning) {
						projectLearningCounts.set(
							projectName,
							(projectLearningCounts.get(projectName) || 0) + 1,
						);
					}
					if (isDue) {
						projectDueCounts.set(
							projectName,
							(projectDueCounts.get(projectName) || 0) + 1,
						);
					}
				}
			}

			const projects = Array.from(projectNoteCounts.keys())
				.map((name) => {
					const rawNotes = projectNotes.get(name) ?? [];
					const noteCountsForProject = noteCardCounts.get(name);
					const notesWithCounts = rawNotes.map((note) => {
						const uid = pathToUid.get(note.path);
						const stats = uid ? uidStateCounts.get(uid) : undefined;
						return {
							...note,
							cardCount: noteCountsForProject?.get(note.path) ?? 0,
							newCount: stats?.newCount ?? 0,
							learningCount: stats?.learningCount ?? 0,
							dueCount: stats?.dueCount ?? 0,
						};
					});

					return {
						id: name,
						name,
						noteCount: projectNoteCounts.get(name) ?? 0,
						cardCount: projectCardCounts.get(name) ?? 0,
						dueCount: projectDueCounts.get(name) ?? 0,
						newCount: projectNewCounts.get(name) ?? 0,
						learningCount: projectLearningCounts.get(name) ?? 0,
						notes: notesWithCounts,
						childProjectNames: [],
						parentProjectNames: [],
					};
				})
				.sort((a, b) => a.name.localeCompare(b.name));

			const unassignedNotes: ProjectNoteInfo[] = [];
			for (const [uid, stats] of uidStateCounts) {
				const uidProjects = sourceUidToProjects.get(uid);
				if (uidProjects && uidProjects.length > 0) continue;

				const filePath = sourceUidToPath.get(uid);
				if (!filePath) continue;

				const file = app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) continue;

				unassignedNotes.push({
					path: filePath,
					name: file.basename,
					cardCount: uidCardCounts.get(uid) ?? 0,
					newCount: stats.newCount,
					learningCount: stats.learningCount,
					dueCount: stats.dueCount,
				});
			}

			unassignedNotes.sort((a, b) => a.name.localeCompare(b.name));
			noteHub.setProjects(projects);
			noteHub.setUnassignedNotes(unassignedNotes);
		} catch (error) {
			console.error("[NoteHubView] Error loading data:", error);
			notify().error("Failed to load note hub data");
			noteHub.setLoading(false);
		}
	}, [plugin, app]);
}

// ── Action Handlers (hook) ─────────────────────────────────────

function useNoteHubActions(loadData: () => Promise<void>) {
	const app = useApp();
	const plugin = usePlugin();

	const handleOpenNote = useCallback(
		(path: string) => {
			void app.workspace.openLinkText(path, "", false);
		},
		[app],
	);

	const handleStartReview = useCallback(
		async (filter: {
			sourceNoteFilters?: string[];
			projectFilters?: string[];
		}) => {
			const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_REVIEW);
			let leaf: WorkspaceLeaf;

			if (leaves.length > 0 && leaves[0]) {
				leaf = leaves[0];
			} else {
				leaf = app.workspace.getLeaf("tab");
			}

			await leaf.setViewState({
				type: VIEW_TYPE_REVIEW,
				active: true,
				state: { ...filter, ignoreDailyLimits: true },
			});

			void app.workspace.revealLeaf(leaf);
		},
		[app],
	);

	const handleStartReviewProject = useCallback(
		async (projectName: string) => {
			await handleStartReview({ projectFilters: [projectName] });
		},
		[handleStartReview],
	);

	const handleCustomStudyProject = useCallback(
		async (projectName: string) => {
			await plugin.openCustomStudyModal({
				projectFilters: [projectName],
				scopeLabel: projectName,
			});
		},
		[plugin],
	);

	const handleCustomStudyNote = useCallback(
		async (filter: { sourceNoteFilters: string[] }) => {
			const label =
				filter.sourceNoteFilters.length === 1
					? filter.sourceNoteFilters[0]
					: `${filter.sourceNoteFilters.length} notes`;
			await plugin.openCustomStudyModal({
				sourceNoteFilters: filter.sourceNoteFilters,
				scopeLabel: label,
			});
		},
		[plugin],
	);

	const handleGenerateCards = useCallback(
		async (notePath: string) => {
			await app.workspace.openLinkText(notePath, "", false);
			void plugin.activateView();
		},
		[app, plugin],
	);

	const handleAddNoteToProject = useCallback(
		async (notePath: string) => {
			const file = app.vault.getAbstractFileByPath(notePath);
			if (!(file instanceof TFile)) return;

			const availableProjects = [
				...plugin.frontmatterIndex.getAllValues("projects"),
			];
			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			const content = await app.vault.cachedRead(file);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);

			const modal = new AddToProjectModal(app, {
				availableProjects,
				currentProjects,
			});
			const result = await modal.openAndWait();
			if (result.cancelled || result.projects.length === 0) return;

			const newProjects = [
				...new Set([...currentProjects, ...result.projects]),
			];
			await frontmatterService.setProjectsInFrontmatter(file, newProjects);

			await loadData();
			notify().success(`Added "${file.basename}" to project(s)`);
		},
		[app, plugin, loadData],
	);

	const handleRemoveFromProject = useCallback(
		async (notePath: string, projectName: string) => {
			const file = app.vault.getAbstractFileByPath(notePath);
			if (!(file instanceof TFile)) return;

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			const content = await app.vault.cachedRead(file);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);
			const newProjects = currentProjects.filter((p) => p !== projectName);
			await frontmatterService.setProjectsInFrontmatter(file, newProjects);

			await loadData();
			notify().success(`Removed "${file.basename}" from "${projectName}"`);
		},
		[app, plugin, loadData],
	);

	const handleAddNotesToProject = useCallback(
		async (projectName: string) => {
			const modal = new SelectNoteModal(app, {
				title: `Add Note to "${projectName}"`,
				excludeFlashcardFiles: true,
			});
			const result = await modal.openAndWait();
			if (result.cancelled || !result.selectedNote) return;

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			const content = await app.vault.cachedRead(result.selectedNote);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);

			if (currentProjects.includes(projectName)) {
				notify().info(`Note already in project "${projectName}"`);
				return;
			}

			const newProjects = [...currentProjects, projectName];
			await frontmatterService.setProjectsInFrontmatter(
				result.selectedNote,
				newProjects,
			);

			let sourceUid = await frontmatterService.getSourceNoteUid(
				result.selectedNote,
			);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(
					result.selectedNote,
					sourceUid,
				);
			}

			await loadData();
			notify().success(
				`Added "${result.selectedNote.basename}" to "${projectName}"`,
			);
		},
		[app, plugin, loadData],
	);

	const handleBulkAddToProject = useCallback(async () => {
		const noteHub = plugin.store!.getState().noteHub;
		const selectedPaths = Array.from(noteHub.selectedNotePaths);

		if (selectedPaths.length === 0) {
			notify().warning("No notes selected");
			return;
		}

		const availableProjects = [
			...plugin.frontmatterIndex.getAllValues("projects"),
		];
		const modal = new AddToProjectModal(app, {
			availableProjects,
			currentProjects: [],
		});
		const result = await modal.openAndWait();
		if (result.cancelled || result.projects.length === 0) return;

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		for (const path of selectedPaths) {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) continue;

			const content = await app.vault.cachedRead(file);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);
			const newProjects = [
				...new Set([...currentProjects, ...result.projects]),
			];
			await frontmatterService.setProjectsInFrontmatter(file, newProjects);
		}

		noteHub.exitSelectionMode();
		await loadData();
		notify().success(
			`Added ${selectedPaths.length} note(s) to ${result.projects.length} project(s)`,
		);
	}, [app, plugin, loadData]);

	const handleBulkReview = useCallback(async () => {
		const noteHub = plugin.store!.getState().noteHub;
		const selectedPaths = Array.from(noteHub.selectedNotePaths);

		if (selectedPaths.length === 0) {
			notify().warning("No notes selected");
			return;
		}

		const noteNames: string[] = [];
		for (const path of selectedPaths) {
			const file = app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				noteNames.push(file.basename);
			}
		}

		if (noteNames.length === 0) {
			notify().warning("Could not resolve note names");
			return;
		}

		noteHub.exitSelectionMode();
		await handleStartReview({ sourceNoteFilters: noteNames });
	}, [app, plugin, handleStartReview, loadData]);

	return {
		handleOpenNote,
		handleStartReview,
		handleStartReviewProject,
		handleCustomStudyProject,
		handleCustomStudyNote,
		handleGenerateCards,
		handleAddNoteToProject,
		handleRemoveFromProject,
		handleAddNotesToProject,
		handleBulkAddToProject,
		handleBulkReview,
	};
}

// ── Root Component ─────────────────────────────────────────────

export function NoteHubApp() {
	const state = useNoteHubState();
	const noteHub = useNoteHub();
	const loadData = useLoadData();
	const actions = useNoteHubActions(loadData);
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// React to dataVersion signal changes with debounced refresh
	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion);
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

	// Initial data load
	useEffect(() => {
		void loadData();
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

// ── Toolbar Component ──────────────────────────────────────────

interface NoteHubToolbarProps {
	searchQuery: string;
	statusFilter: NoteHubStatusFilter;
	sortBy: NoteHubSortBy;
	sortDirection: NoteHubSortDirection;
	onSearchChange: (query: string) => void;
	onStatusFilterChange: (filter: NoteHubStatusFilter) => void;
	onSortByChange: (sortBy: NoteHubSortBy) => void;
	onSortDirectionToggle: () => void;
	onRefresh: () => void;
}

function NoteHubToolbar({
	searchQuery,
	statusFilter,
	sortBy,
	sortDirection,
	onSearchChange,
	onStatusFilterChange,
	onSortByChange,
	onSortDirectionToggle,
	onRefresh,
}: NoteHubToolbarProps) {
	const sortDirIcon = useIcon(
		sortDirection === "asc" ? "arrow-up" : "arrow-down",
	);
	const refreshIcon = useIcon("refresh-cw");

	return (
		<div class="ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:shrink-0 ep:flex-wrap">
			<SearchInput
				value={searchQuery}
				placeholder="Search notes..."
				onChange={onSearchChange}
			/>

			<div class="ep:flex ep:items-center ep:gap-1">
				{STATUS_FILTERS.map((f) => (
					<button
						type="button"
						key={f.value}
						class={statusFilter === f.value ? PILL_ACTIVE : PILL_INACTIVE}
						onClick={() => onStatusFilterChange(f.value)}
					>
						{f.label}
					</button>
				))}
			</div>

			<div class="ep:flex ep:items-center ep:gap-1">
				<select
					class="ep:bg-obs-primary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-lg ep:px-2 ep:py-1 ep:text-ui-smaller ep:cursor-pointer"
					value={sortBy}
					onChange={(e) =>
						onSortByChange(
							(e.target as HTMLSelectElement).value as NoteHubSortBy,
						)
					}
				>
					{SORT_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>

				<button
					type="button"
					class="clickable-icon"
					aria-label={
						sortDirection === "asc" ? "Sort ascending" : "Sort descending"
					}
					onClick={onSortDirectionToggle}
				>
					<span ref={sortDirIcon} />
				</button>
			</div>

			<button type="button" class="clickable-icon" aria-label="Refresh" onClick={onRefresh}>
				<span ref={refreshIcon} />
			</button>
		</div>
	);
}

// ── Content Component ──────────────────────────────────────────

interface NoteHubContentProps {
	isLoading: boolean;
	projects: ProjectInfo[];
	unassignedNotes: ProjectNoteInfo[];
	expandedProjectIds: Set<string>;
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	onToggleExpand: (projectId: string) => void;
	onToggleNoteSelection: (notePath: string) => void;
	onEnterSelectionMode: (notePath: string) => void;
	onOpenNote: (path: string) => void;
	onStartReview: (filter: {
		sourceNoteFilters?: string[];
		projectFilters?: string[];
	}) => void;
	onStartReviewProject: (projectName: string) => void;
	onCustomStudyProject: (projectName: string) => void;
	onCustomStudyNote: (filter: { sourceNoteFilters: string[] }) => void;
	onGenerateCards: (notePath: string) => void;
	onAddToProject: (notePath: string) => void;
	onRemoveFromProject: (notePath: string, projectName: string) => void;
	onAddNotesToProject: (projectName: string) => void;
}

function NoteHubContent({
	isLoading,
	projects,
	unassignedNotes,
	expandedProjectIds,
	selectionMode,
	selectedNotePaths,
	onToggleExpand,
	onToggleNoteSelection,
	onEnterSelectionMode,
	onOpenNote,
	onStartReview,
	onStartReviewProject,
	onCustomStudyProject,
	onCustomStudyNote,
	onGenerateCards,
	onAddToProject,
	onRemoveFromProject,
	onAddNotesToProject,
}: NoteHubContentProps) {
	if (isLoading) {
		return <LoadingSpinner />;
	}

	if (projects.length === 0 && unassignedNotes.length === 0) {
		return <EmptyState message="No notes with flashcards yet" />;
	}

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:overflow-y-auto ep:min-h-0">
			{projects.map((project) => (
				<ProjectGroup
					key={project.id}
					project={project}
					isExpanded={expandedProjectIds.has(project.id)}
					selectionMode={selectionMode}
					selectedNotePaths={selectedNotePaths}
					onToggleExpand={onToggleExpand}
					onToggleNoteSelection={onToggleNoteSelection}
					onEnterSelectionMode={onEnterSelectionMode}
					onOpenNote={onOpenNote}
					onStartReview={onStartReview}
					onStartReviewProject={onStartReviewProject}
					onCustomStudyProject={onCustomStudyProject}
					onCustomStudyNote={onCustomStudyNote}
					onGenerateCards={onGenerateCards}
					onAddToProject={onAddToProject}
					onRemoveFromProject={onRemoveFromProject}
					onAddNotesToProject={onAddNotesToProject}
				/>
			))}

			{unassignedNotes.length > 0 && (
				<UnassignedSection
					notes={unassignedNotes}
					expandedProjectIds={expandedProjectIds}
					selectionMode={selectionMode}
					selectedNotePaths={selectedNotePaths}
					onToggleExpand={onToggleExpand}
					onToggleNoteSelection={onToggleNoteSelection}
					onEnterSelectionMode={onEnterSelectionMode}
					onOpenNote={onOpenNote}
					onStartReview={onStartReview}
					onCustomStudyNote={onCustomStudyNote}
					onGenerateCards={onGenerateCards}
					onAddToProject={onAddToProject}
					onRemoveFromProject={onRemoveFromProject}
				/>
			)}
		</div>
	);
}

// ── Project Group Component ────────────────────────────────────

interface ProjectGroupProps {
	project: ProjectInfo;
	isExpanded: boolean;
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	onToggleExpand: (projectId: string) => void;
	onToggleNoteSelection: (notePath: string) => void;
	onEnterSelectionMode: (notePath: string) => void;
	onOpenNote: (path: string) => void;
	onStartReview: (filter: {
		sourceNoteFilters?: string[];
		projectFilters?: string[];
	}) => void;
	onStartReviewProject: (projectName: string) => void;
	onCustomStudyProject: (projectName: string) => void;
	onCustomStudyNote: (filter: { sourceNoteFilters: string[] }) => void;
	onGenerateCards: (notePath: string) => void;
	onAddToProject: (notePath: string) => void;
	onRemoveFromProject: (notePath: string, projectName: string) => void;
	onAddNotesToProject: (projectName: string) => void;
}

function ProjectGroup({
	project,
	isExpanded,
	selectionMode,
	selectedNotePaths,
	onToggleExpand,
	onToggleNoteSelection,
	onEnterSelectionMode,
	onOpenNote,
	onStartReview,
	onStartReviewProject,
	onCustomStudyProject,
	onCustomStudyNote,
	onGenerateCards,
	onAddToProject,
	onRemoveFromProject,
	onAddNotesToProject,
}: ProjectGroupProps) {
	const chevronRef = useIcon(isExpanded ? "chevron-down" : "chevron-right");
	const noteText =
		project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;

	const handleHeaderClick = useCallback(
		(e: MouseEvent) => {
			if ((e.target as HTMLElement).closest("button")) return;
			onToggleExpand(project.id);
		},
		[project.id, onToggleExpand],
	);

	return (
		<div class="ep:flex ep:flex-col">
			<div
				class="ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors ep:border-b ep:border-obs-modifier-border"
				role="button"
				tabIndex={0}
				onClick={handleHeaderClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleHeaderClick(e as unknown as MouseEvent);
					}
				}}
			>
				<div class="ep:shrink-0 ep:flex ep:items-center ep:text-obs-muted [&_svg]:ep:w-4 [&_svg]:ep:h-4">
					<span ref={chevronRef} />
				</div>

				<div class="ep:font-medium ep:text-obs-normal ep:text-ui-small">
					{project.name}
				</div>

				<div class="ep:text-obs-muted ep:text-ui-smaller">{noteText}</div>

				{project.cardCount > 0 && (
					<div class="ep:shrink-0">
						<CardCountDisplay
							newCount={project.newCount}
							learningCount={project.learningCount}
							dueCount={project.dueCount}
							totalCount={project.cardCount}
						/>
					</div>
				)}

				<div class="ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:ml-auto">
					<IconButton
						icon="sliders-horizontal"
						ariaLabel="Custom study"
						size="small"
						onClick={() => onCustomStudyProject(project.name)}
					/>
					<IconButton
						icon="play"
						ariaLabel="Review project"
						size="small"
						onClick={() => onStartReviewProject(project.name)}
					/>
					<IconButton
						icon="plus"
						ariaLabel="Add note to project"
						size="small"
						onClick={() => onAddNotesToProject(project.name)}
					/>
				</div>
			</div>

			{isExpanded &&
				project.notes.map((note) => (
					<NoteHubNoteRow
						key={note.path}
						note={note}
						projectName={project.name}
						isSelected={selectedNotePaths.has(note.path)}
						selectionMode={selectionMode}
						onToggleSelection={onToggleNoteSelection}
						onEnterSelectionMode={onEnterSelectionMode}
						onOpenNote={onOpenNote}
						onStartReview={onStartReview}
						onCustomStudy={onCustomStudyNote}
						onGenerateCards={onGenerateCards}
						onAddToProject={onAddToProject}
						onRemoveFromProject={onRemoveFromProject}
					/>
				))}
		</div>
	);
}

// ── Unassigned Section Component ───────────────────────────────

interface UnassignedSectionProps {
	notes: ProjectNoteInfo[];
	expandedProjectIds: Set<string>;
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	onToggleExpand: (projectId: string) => void;
	onToggleNoteSelection: (notePath: string) => void;
	onEnterSelectionMode: (notePath: string) => void;
	onOpenNote: (path: string) => void;
	onStartReview: (filter: {
		sourceNoteFilters?: string[];
		projectFilters?: string[];
	}) => void;
	onCustomStudyNote: (filter: { sourceNoteFilters: string[] }) => void;
	onGenerateCards: (notePath: string) => void;
	onAddToProject: (notePath: string) => void;
	onRemoveFromProject: (notePath: string, projectName: string) => void;
}

function UnassignedSection({
	notes,
	expandedProjectIds,
	selectionMode,
	selectedNotePaths,
	onToggleExpand,
	onToggleNoteSelection,
	onEnterSelectionMode,
	onOpenNote,
	onStartReview,
	onCustomStudyNote,
	onGenerateCards,
	onAddToProject,
	onRemoveFromProject,
}: UnassignedSectionProps) {
	const isExpanded = expandedProjectIds.has("__unassigned__");
	const chevronRef = useIcon(isExpanded ? "chevron-down" : "chevron-right");
	const noteText = notes.length === 1 ? "1 note" : `${notes.length} notes`;

	const totals = useMemo(() => {
		let totalNew = 0;
		let totalLearning = 0;
		let totalDue = 0;
		let totalCards = 0;
		for (const note of notes) {
			totalNew += note.newCount;
			totalLearning += note.learningCount;
			totalDue += note.dueCount;
			totalCards += note.cardCount;
		}
		return { totalNew, totalLearning, totalDue, totalCards };
	}, [notes]);

	const handleHeaderClick = useCallback(
		(e: MouseEvent) => {
			if ((e.target as HTMLElement).closest("button")) return;
			onToggleExpand("__unassigned__");
		},
		[onToggleExpand],
	);

	return (
		<div class="ep:flex ep:flex-col">
			<div
				class="ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors ep:border-b ep:border-obs-modifier-border"
				role="button"
				tabIndex={0}
				onClick={handleHeaderClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleHeaderClick(e as unknown as MouseEvent);
					}
				}}
			>
				<div class="ep:shrink-0 ep:flex ep:items-center ep:text-obs-muted [&_svg]:ep:w-4 [&_svg]:ep:h-4">
					<span ref={chevronRef} />
				</div>

				<div class="ep:font-medium ep:text-obs-normal ep:text-ui-small">
					Unassigned Notes
				</div>

				<div class="ep:text-obs-muted ep:text-ui-smaller">{noteText}</div>

				{totals.totalCards > 0 && (
					<div class="ep:shrink-0">
						<CardCountDisplay
							newCount={totals.totalNew}
							learningCount={totals.totalLearning}
							dueCount={totals.totalDue}
							totalCount={totals.totalCards}
						/>
					</div>
				)}
			</div>

			{isExpanded &&
				notes.map((note) => (
					<NoteHubNoteRow
						key={note.path}
						note={note}
						projectName={null}
						isSelected={selectedNotePaths.has(note.path)}
						selectionMode={selectionMode}
						onToggleSelection={onToggleNoteSelection}
						onEnterSelectionMode={onEnterSelectionMode}
						onOpenNote={onOpenNote}
						onStartReview={onStartReview}
						onCustomStudy={onCustomStudyNote}
						onGenerateCards={onGenerateCards}
						onAddToProject={onAddToProject}
						onRemoveFromProject={onRemoveFromProject}
					/>
				))}
		</div>
	);
}

// ── Note Row Component ─────────────────────────────────────────

interface NoteHubNoteRowProps {
	note: ProjectNoteInfo;
	projectName: string | null;
	isSelected: boolean;
	selectionMode: SelectionMode;
	onToggleSelection: (path: string) => void;
	onEnterSelectionMode: (path: string) => void;
	onOpenNote: (path: string) => void;
	onStartReview: (filter: { sourceNoteFilters: string[] }) => void;
	onCustomStudy: (filter: { sourceNoteFilters: string[] }) => void;
	onGenerateCards: (path: string) => void;
	onAddToProject: (path: string) => void;
	onRemoveFromProject: (path: string, projectName: string) => void;
}

function NoteHubNoteRow({
	note,
	projectName,
	isSelected,
	selectionMode,
	onToggleSelection,
	onEnterSelectionMode,
	onOpenNote,
	onStartReview,
	onCustomStudy,
	onGenerateCards,
	onAddToProject,
	onRemoveFromProject,
}: NoteHubNoteRowProps) {
	const moreIconRef = useIcon("more-horizontal");

	const handleCheckboxChange = useCallback(() => {
		if (selectionMode !== "selecting") {
			onEnterSelectionMode(note.path);
		} else {
			onToggleSelection(note.path);
		}
	}, [selectionMode, note.path, onEnterSelectionMode, onToggleSelection]);

	const showContextMenu = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			const menu = new Menu();

			menu.addItem((item) =>
				item
					.setTitle("Open note")
					.setIcon("file-text")
					.onClick(() => onOpenNote(note.path)),
			);
			menu.addItem((item) =>
				item
					.setTitle("Start review")
					.setIcon("play")
					.onClick(() => onStartReview({ sourceNoteFilters: [note.name] })),
			);
			menu.addItem((item) =>
				item
					.setTitle("Custom study")
					.setIcon("sliders-horizontal")
					.onClick(() => onCustomStudy({ sourceNoteFilters: [note.name] })),
			);
			menu.addItem((item) =>
				item
					.setTitle("Generate cards")
					.setIcon("sparkles")
					.onClick(() => onGenerateCards(note.path)),
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle("Add to project...")
					.setIcon("folder-plus")
					.onClick(() => onAddToProject(note.path)),
			);
			if (projectName) {
				menu.addItem((item) =>
					item
						.setTitle(`Remove from "${projectName}"`)
						.setIcon("folder-minus")
						.onClick(() => onRemoveFromProject(note.path, projectName)),
				);
			}

			menu.showAtMouseEvent(e);
		},
		[
			note,
			projectName,
			onOpenNote,
			onStartReview,
			onCustomStudy,
			onGenerateCards,
			onAddToProject,
			onRemoveFromProject,
		],
	);

	const rowCls = `ep:group ep:flex ep:items-center ep:gap-3 ep:py-2.5 ep:px-4 ep:pl-8 ep:border-b ep:border-obs-modifier-border ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0${isSelected ? " ep:bg-obs-interactive/10" : ""}`;
	const checkboxVisibility =
		selectionMode === "selecting"
			? ""
			: " ep:opacity-0 ep:group-hover:opacity-100";

	return (
		<div class={rowCls}>
			<div class={`ep:shrink-0 ep:flex ep:items-center${checkboxVisibility}`}>
				<input
					type="checkbox"
					class="ep:w-4 ep:h-4 ep:cursor-pointer"
					checked={isSelected}
					onChange={handleCheckboxChange}
					onClick={(e) => e.stopPropagation()}
				/>
			</div>

			<div
				class="ep:flex-1 ep:min-w-0 ep:truncate ep:text-ui-small ep:font-medium ep:text-obs-normal ep:cursor-pointer ep:hover:text-obs-link ep:hover:underline"
				role="button"
				tabIndex={0}
				onClick={(e) => {
					e.stopPropagation();
					onOpenNote(note.path);
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						e.stopPropagation();
						onOpenNote(note.path);
					}
				}}
			>
				{note.name}
			</div>

			<div class="ep:shrink-0">
				<CardCountDisplay
					newCount={note.newCount}
					learningCount={note.learningCount}
					dueCount={note.dueCount}
				/>
			</div>

			{selectionMode !== "selecting" && (
				<div class="ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:opacity-0 ep:group-hover:opacity-100 ep:transition-opacity">
					<IconButton
						icon="play"
						ariaLabel="Review note"
						size="small"
						onClick={() => onStartReview({ sourceNoteFilters: [note.name] })}
					/>
					<IconButton
						icon="sparkles"
						ariaLabel="Generate cards"
						size="small"
						onClick={() => onGenerateCards(note.path)}
					/>
					<button
						type="button"
						class={ICON_BTN_CLS}
						aria-label="More actions"
						onClick={showContextMenu}
					>
						<span ref={moreIconRef} />
					</button>
				</div>
			)}
		</div>
	);
}

// ── Selection Footer Component ─────────────────────────────────

interface SelectionFooterProps {
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	projects: ProjectInfo[];
	unassignedNotes: ProjectNoteInfo[];
	onCancel: () => void;
	onBulkAddToProject: () => void;
	onBulkReview: () => void;
}

function SelectionFooter({
	selectionMode,
	selectedNotePaths,
	projects,
	unassignedNotes,
	onCancel,
	onBulkAddToProject,
	onBulkReview,
}: SelectionFooterProps) {
	const cancelIcon = useIcon("x");
	const folderPlusIcon = useIcon("folder-plus");
	const playIcon = useIcon("play");

	if (selectionMode !== "selecting") return null;

	let newCount = 0;
	let learningCount = 0;
	let dueCount = 0;

	for (const project of projects) {
		for (const note of project.notes) {
			if (selectedNotePaths.has(note.path)) {
				newCount += note.newCount;
				learningCount += note.learningCount;
				dueCount += note.dueCount;
			}
		}
	}

	for (const note of unassignedNotes) {
		if (selectedNotePaths.has(note.path)) {
			newCount += note.newCount;
			learningCount += note.learningCount;
			dueCount += note.dueCount;
		}
	}

	const totalDue = newCount + learningCount + dueCount;

	const btnBase =
		"ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1.5 ep:rounded-md ep:text-ui-small ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";

	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary">
			<div class="ep:flex ep:items-center ep:gap-2">
				<button
					type="button"
					class="clickable-icon"
					aria-label="Cancel selection"
					onClick={onCancel}
				>
					<span ref={cancelIcon} />
				</button>

				<span class="ep:flex ep:items-center ep:gap-1 ep:font-medium ep:text-ui-small">
					<span class="ep:text-obs-green">{newCount}</span>
					<span class="ep:text-obs-faint">&middot;</span>
					<span class="ep:text-obs-orange">{learningCount}</span>
					<span class="ep:text-obs-faint">&middot;</span>
					<span class="ep:text-obs-blue">{dueCount}</span>
				</span>
			</div>

			<div class="ep:flex ep:items-center ep:gap-2">
				<button
					type="button"
					class={`${btnBase} ep:bg-obs-modifier-hover ep:text-obs-normal ep:hover:bg-obs-interactive ep:hover:text-obs-on-accent`}
					onClick={onBulkAddToProject}
				>
					<span class="ep:flex ep:items-center" ref={folderPlusIcon} />
					<span>Add to Project</span>
				</button>

				<button
					type="button"
					class={`${btnBase} mod-cta${totalDue === 0 ? " ep:opacity-50 ep:cursor-not-allowed" : ""}`}
					disabled={totalDue === 0}
					onClick={totalDue === 0 ? undefined : onBulkReview}
				>
					<span class="ep:flex ep:items-center" ref={playIcon} />
					<span>Review Selected</span>
				</button>
			</div>
		</div>
	);
}
