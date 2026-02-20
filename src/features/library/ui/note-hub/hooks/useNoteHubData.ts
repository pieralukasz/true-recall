import { TFile } from "obsidian";
import { useCallback } from "preact/hooks";
import { State } from "ts-fsrs";
import { notify } from "../../../../../shared/services/notification.service";
import type { ProjectNoteInfo } from "../../../../../shared/types";
import { useApp, usePlugin } from "../../../../../shared/ui/preact";
import { filterActiveCardsOnly } from "../../../../../shared/ui/helpers";

export function useLoadData() {
	const plugin = usePlugin();
	const app = useApp();

	return useCallback(async () => {
		const noteHub = plugin.store?.getState().noteHub;
		if (!noteHub) return;
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
				const uidStats = uidStateCounts.get(card.sourceUid);
				if (!uidStats) continue;

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
					const noteCounts = noteCardCounts.get(projectName);
					if (noteCounts) {
						noteCounts.set(
							sourceFile.path,
							(noteCounts.get(sourceFile.path) || 0) + 1,
						);
					}

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
