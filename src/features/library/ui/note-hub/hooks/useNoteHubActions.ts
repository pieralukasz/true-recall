import type { WorkspaceLeaf } from "obsidian";
import { TFile } from "obsidian";
import { useCallback } from "preact/hooks";
import { VIEW_TYPE_REVIEW } from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import { AddToProjectModal, SelectNoteModal } from "@shared/ui/modals";
import { useApp, usePlugin } from "@shared/ui/preact";

export function useNoteHubActions(loadData: () => Promise<void>) {
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
		const noteHub = plugin.store?.getState().noteHub;
		if (!noteHub) return;
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
		const noteHub = plugin.store?.getState().noteHub;
		if (!noteHub) return;
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
