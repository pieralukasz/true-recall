import { useCallback } from "preact/hooks";
import { notify } from "@shared/services/notification.service";
import type { SessionResult } from "@shared/types/events.types";
import type { SessionPreset } from "@shared/types/settings.types";
import { SessionResultFactory } from "@shared/utils/session-result-factory";
import { AddToProjectModal } from "@shared/ui/modals/AddToProjectModal";
import { CustomStudyModal } from "@features/study/modals/CustomStudyModal";
import { MoveCardModal } from "@shared/ui/modals/MoveCardModal";
import type { FSRSFlashcardItem } from "@shared/types";
import type TrueRecallPlugin from "../../../../../main";
import type { SessionLogic } from "@features/study/ui/session/SessionLogic";

interface SessionSlice {
	toggleNoteSelection: (noteName: string) => void;
	setSearchQuery: (query: string) => void;
	setAllNotesSelected: (noteNames: string[], select: boolean) => void;
	clearSelection: () => void;
}

interface UseSessionHandlersParams {
	plugin: TrueRecallPlugin;
	logic: SessionLogic;
	onSelectAndClose: (result: SessionResult) => void;
	currentNoteName: string | null;
	selectedNotes: Set<string>;
	allCards: FSRSFlashcardItem[];
	searchQuery: string;
	now: Date;
	session: SessionSlice | undefined;
	setSessionPresets: (presets: SessionPreset[]) => void;
}

export function useSessionHandlers({
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
}: UseSessionHandlersParams) {
	const handleQuickAction = useCallback(
		(action: "current-note" | "today" | "default" | "buried") => {
			const result = SessionResultFactory.createActionResult(
				action,
				currentNoteName,
			);
			onSelectAndClose(result);
		},
		[currentNoteName, onSelectAndClose],
	);

	const handleCustomStudyAction = useCallback(
		(action: "failed" | "difficult" | "study-ahead" | "most-forgotten") => {
			let result: SessionResult;
			switch (action) {
				case "failed":
					result = SessionResultFactory.createFailedCardsResult();
					break;
				case "difficult":
					result = SessionResultFactory.createDifficultCardsResult();
					break;
				case "study-ahead":
					result = SessionResultFactory.createStudyAheadResult(3);
					break;
				case "most-forgotten":
					result = SessionResultFactory.createMostForgottenResult(50);
					break;
			}
			onSelectAndClose(result);
		},
		[onSelectAndClose],
	);

	const handleOpenCustomStudyModal = useCallback(async () => {
		const modal = new CustomStudyModal(plugin.app, {
			title: "Custom study",
			width: "480px",
		});
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		if (result.saveAsPreset && result.presetName && result.sessionResult) {
			const preset: SessionPreset = {
				id: crypto.randomUUID(),
				name: result.presetName,
				createdAt: Date.now(),
				stateFilter: result.sessionResult.stateFilter,
				difficultyRange: result.sessionResult.difficultyRange,
				lapsesRange: result.sessionResult.lapsesRange,
				stabilityRange: result.sessionResult.stabilityRange,
				overdueOnly: result.sessionResult.overdueOnly,
				recentlyFailed: result.sessionResult.recentlyFailed,
				reviewOrder: result.sessionResult.reviewOrder,
				cardLimit: result.sessionResult.cardLimit,
				studyAheadDays: result.sessionResult.studyAheadDays,
				crammingMode: result.sessionResult.crammingMode,
				projectFilters: result.sessionResult.projectFilters,
			};
			plugin.settings.sessionPresets = [
				...plugin.settings.sessionPresets,
				preset,
			];
			await plugin.saveSettings();
			setSessionPresets([...plugin.settings.sessionPresets]);
			notify().success(`Preset "${result.presetName}" saved`);
		}

		if (result.sessionResult) {
			onSelectAndClose(result.sessionResult);
		}
	}, [plugin, onSelectAndClose, setSessionPresets]);

	const handlePresetAction = useCallback(
		(preset: SessionPreset) => {
			const result: SessionResult = {
				cancelled: false,
				sessionType: "custom-study",
				ignoreDailyLimits: true,
				bypassScheduling: true,
				stateFilter: preset.stateFilter,
				difficultyRange: preset.difficultyRange,
				lapsesRange: preset.lapsesRange,
				stabilityRange: preset.stabilityRange,
				overdueOnly: preset.overdueOnly,
				recentlyFailed: preset.recentlyFailed,
				reviewOrder: preset.reviewOrder,
				cardLimit: preset.cardLimit,
				studyAheadDays: preset.studyAheadDays,
				crammingMode: preset.crammingMode,
				projectFilters: preset.projectFilters,
			};
			onSelectAndClose(result);
		},
		[onSelectAndClose],
	);

	const handlePresetDelete = useCallback(
		async (presetId: string) => {
			plugin.settings.sessionPresets = plugin.settings.sessionPresets.filter(
				(p) => p.id !== presetId,
			);
			await plugin.saveSettings();
			setSessionPresets([...plugin.settings.sessionPresets]);
		},
		[plugin, setSessionPresets],
	);

	const handleStartSession = useCallback(() => {
		if (selectedNotes.size === 0) return;
		const result = SessionResultFactory.createSelectedNotesResult(
			Array.from(selectedNotes),
		);
		onSelectAndClose(result);
	}, [selectedNotes, onSelectAndClose]);

	const handleMoveSelectedNotes = useCallback(async () => {
		if (selectedNotes.size === 0) return;
		const cardsToMove = allCards.filter(
			(card) => card.sourceNoteName && selectedNotes.has(card.sourceNoteName),
		);
		if (cardsToMove.length === 0) {
			notify().warning("No flashcards found in selected notes");
			return;
		}

		const modal = new MoveCardModal(plugin.app, {
			cardCount: cardsToMove.length,
		});
		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		let movedCount = 0;
		for (const card of cardsToMove) {
			const success = await plugin.flashcardManager.moveCard(
				card.id,
				result.targetNotePath,
			);
			if (success) movedCount++;
		}
		notify().cardsMoved(movedCount, result.targetNotePath);
		session?.clearSelection();
	}, [plugin, selectedNotes, allCards, session]);

	const handleAddToProject = useCallback(async () => {
		if (selectedNotes.size === 0) return;
		const availableProjects = Array.from(
			plugin.frontmatterIndex.getAllValues("projects"),
		);
		const modal = new AddToProjectModal(plugin.app, {
			availableProjects,
			currentProjects: [],
		});
		const result = await modal.openAndWait();
		if (result.cancelled || result.projects.length === 0) return;

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		let updatedCount = 0;
		for (const noteName of selectedNotes) {
			const noteFile = plugin.app.vault
				.getMarkdownFiles()
				.find((f) => f.basename === noteName);
			if (!noteFile) continue;
			const content = await plugin.app.vault.cachedRead(noteFile);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);
			const newProjects = [
				...new Set([...currentProjects, ...result.projects]),
			];
			await frontmatterService.setProjectsInFrontmatter(noteFile, newProjects);
			updatedCount++;
		}
		notify().success(`Added ${updatedCount} note(s) to project(s)`);
		session?.clearSelection();
	}, [plugin, selectedNotes, session]);

	const handleNoteToggle = useCallback(
		(noteName: string) => {
			session?.toggleNoteSelection(noteName);
		},
		[session],
	);

	const handleSearchChange = useCallback(
		(query: string) => {
			session?.setSearchQuery(query);
		},
		[session],
	);

	const _handleSelectAll = useCallback(
		(select: boolean) => {
			const filteredStats = logic.getFilteredNoteStats(searchQuery, now);
			const availableNotes = filteredStats
				.filter((s) => s.newCount > 0 || s.dueCount > 0)
				.map((s) => s.noteName);
			session?.setAllNotesSelected(availableNotes, select);
		},
		[logic, searchQuery, now, session],
	);

	const handleNavigateToNote = useCallback(
		(notePath: string) => {
			void plugin.app.workspace.openLinkText(notePath, "", false);
		},
		[plugin],
	);

	return {
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
		_handleSelectAll,
		handleNavigateToNote,
	};
}
