import { Platform } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { notify } from "../../../../shared/services/notification.service";
import type { SessionResult } from "../../../../shared/types/events.types";
import type { SessionPreset } from "../../../../shared/types/settings.types";
import { SessionResultFactory } from "../../../../shared/utils/session-result-factory";
import { AddToProjectModal } from "../../../../shared/ui/modals/AddToProjectModal";
import { CustomStudyModal } from "../../modals/CustomStudyModal";
import { MoveCardModal } from "../../../../shared/ui/modals/MoveCardModal";
import { usePlugin } from "../../../../shared/ui/preact";
import { CardCountDisplay } from "../../../../shared/ui/components";
import type { NoteStats, SessionLogic } from "./SessionLogic";

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
	}, [plugin, onSelectAndClose]);

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
		[plugin],
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

function SearchBar({
	query,
	onChange,
}: {
	query: string;
	onChange: (q: string) => void;
}) {
	return (
		<div class="true-recall-search-container ep:mb-2">
			<input
				type="text"
				class="ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
				placeholder="Search notes..."
				aria-label="Search notes"
				value={query}
				onInput={(e) =>
					onChange((e.target as HTMLInputElement).value.toLowerCase())
				}
			/>
		</div>
	);
}

const BASE_BTN =
	"ep:flex ep:flex-col ep:items-start ep:gap-1.5 ep:px-3 ep:py-3 ep:min-h-[3rem] ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-left ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive";
const DISABLED_BTN = `${BASE_BTN} ep:opacity-50 ep:cursor-not-allowed ep:hover:bg-obs-secondary ep:hover:border-obs-border`;

interface QuickActionsProps {
	logic: SessionLogic;
	currentNoteName: string | null;
	now: Date;
	onAction: (action: "current-note" | "today" | "default" | "buried") => void;
}

function QuickActions({
	logic,
	currentNoteName,
	now,
	onAction,
}: QuickActionsProps) {
	const todayStart = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);
	const currentNoteStats = logic.getCurrentNoteStats(currentNoteName, now);
	const todayStats = logic.getTodayStats(now, todayStart);
	const allStats = logic.getAllCardsStats(now);
	const buriedStats = logic.getBuriedCardsStats(now);

	return (
		<div class="true-recall-quick-actions ep:grid ep:grid-cols-2 ep:gap-2">
			<QuickActionBtn
				label="Active note"
				stats={
					currentNoteStats && currentNoteStats.total > 0
						? logic.formatStats(
								currentNoteStats.newCount,
								currentNoteStats.dueCount,
							)
						: null
				}
				emptyText={currentNoteStats ? "done" : "no cards"}
				onClick={() => onAction("current-note")}
			/>
			<QuickActionBtn
				label="Today"
				stats={
					todayStats.total > 0
						? logic.formatStats(todayStats.newCount, todayStats.dueCount)
						: null
				}
				emptyText="no cards"
				onClick={() => onAction("today")}
			/>
			<QuickActionBtn
				label="Default"
				stats={
					allStats.total > 0
						? logic.formatStats(allStats.newCount, allStats.dueCount)
						: null
				}
				emptyText="no cards"
				onClick={() => onAction("default")}
			/>
			<QuickActionBtn
				label="Buried"
				stats={
					buriedStats.total > 0
						? logic.formatStats(buriedStats.newCount, buriedStats.dueCount)
						: null
				}
				emptyText="none"
				onClick={() => onAction("buried")}
			/>
		</div>
	);
}

function QuickActionBtn({
	label,
	stats,
	emptyText,
	onClick,
}: {
	label: string;
	stats: string | null;
	emptyText: string;
	onClick: () => void;
}) {
	const disabled = !stats;
	return (
		<button
			type="button"
			class={disabled ? DISABLED_BTN : BASE_BTN}
			disabled={disabled}
			onClick={disabled ? undefined : onClick}
		>
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
				{label}
			</span>
			<span
				class={
					stats
						? "ep:text-ui-smaller ep:text-obs-muted"
						: "ep:text-ui-smaller ep:text-obs-faint"
				}
			>
				{stats ?? emptyText}
			</span>
		</button>
	);
}

interface CustomStudySectionProps {
	logic: SessionLogic;
	onAction: (
		action: "failed" | "difficult" | "study-ahead" | "most-forgotten",
	) => void;
	onOpenModal: () => void;
}

function CustomStudySection({
	logic,
	onAction,
	onOpenModal,
}: CustomStudySectionProps) {
	const failedCount = logic.getFailedCardsCount();
	const difficultCount = logic.getDifficultCardsCount();
	const aheadCount = logic.getStudyAheadCount(3);
	const forgottenCount = logic.getMostForgottenCount(1);

	const btnCls =
		"ep:flex ep:flex-col ep:items-start ep:gap-1 ep:px-3 ep:py-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-left ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive";
	const disabledCls = `${btnCls} ep:opacity-50 ep:cursor-not-allowed ep:hover:bg-obs-secondary ep:hover:border-obs-border`;

	return (
		<>
			<div class="ep:flex ep:items-center ep:justify-between ep:my-2">
				<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					Custom study
				</div>
				<button
					type="button"
					class="ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border-none ep:cursor-pointer ep:hover:text-obs-normal ep:px-1"
					aria-label="Open custom study modal"
					onClick={onOpenModal}
				>
					Advanced
				</button>
			</div>
			<div class="true-recall-custom-study ep:grid ep:grid-cols-2 ep:gap-2">
				<CustomStudyBtn
					label="Failed cards"
					count={failedCount}
					unit="cards"
					onClick={() => onAction("failed")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
				<CustomStudyBtn
					label="Difficult"
					count={difficultCount}
					unit="cards"
					onClick={() => onAction("difficult")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
				<CustomStudyBtn
					label="Study ahead"
					count={aheadCount}
					unit="cards (3d)"
					onClick={() => onAction("study-ahead")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
				<CustomStudyBtn
					label="Most forgotten"
					count={forgottenCount}
					unit="cards"
					onClick={() => onAction("most-forgotten")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
			</div>
		</>
	);
}

function CustomStudyBtn({
	label,
	count,
	unit,
	onClick,
	cls,
	disabledCls,
}: {
	label: string;
	count: number;
	unit: string;
	onClick: () => void;
	cls: string;
	disabledCls: string;
}) {
	const disabled = count === 0;
	return (
		<button
			type="button"
			class={disabled ? disabledCls : cls}
			disabled={disabled}
			onClick={disabled ? undefined : onClick}
		>
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
				{label}
			</span>
			<span
				class={
					disabled
						? "ep:text-ui-smaller ep:text-obs-faint"
						: "ep:text-ui-smaller ep:text-obs-muted"
				}
			>
				{disabled ? "none" : `${count} ${unit}`}
			</span>
		</button>
	);
}

function SavedPresets({
	presets,
	onAction,
	onDelete,
}: {
	presets: SessionPreset[];
	onAction: (p: SessionPreset) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<>
			<div class="ep:flex ep:items-center ep:justify-between ep:my-2">
				<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					Saved presets
				</div>
			</div>
			<div class="true-recall-saved-presets ep:flex ep:flex-col ep:gap-1.5">
				{presets.map((preset) => {
					const details: string[] = [];
					if (preset.crammingMode) details.push("cram");
					if (preset.stateFilter) details.push(preset.stateFilter);
					if (preset.reviewOrder && preset.reviewOrder !== "due-date")
						details.push(preset.reviewOrder);
					if (preset.cardLimit) details.push(`limit ${preset.cardLimit}`);

					return (
						<button
							type="button"
							key={preset.id}
							class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive ep:group ep:font-inherit ep:text-left ep:w-full"
							onClick={(e) => {
								if ((e.target as HTMLElement).tagName !== "BUTTON")
									onAction(preset);
							}}
						>
							<div class="ep:flex-1 ep:min-w-0">
								<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
									{preset.name}
								</span>
								{details.length > 0 && (
									<span class="ep:text-ui-smaller ep:text-obs-muted ep:ml-2">
										{details.join(" \u00b7 ")}
									</span>
								)}
							</div>
							<button
								type="button"
								class="ep:text-ui-smaller ep:text-obs-faint ep:bg-transparent ep:border-none ep:cursor-pointer ep:hover:text-obs-red ep:opacity-0 ep:group-hover:opacity-100 ep:px-1"
								aria-label="Delete preset"
								onClick={(e) => {
									e.stopPropagation();
									onDelete(preset.id);
								}}
							>
								&times;
							</button>
						</button>
					);
				})}
			</div>
		</>
	);
}

function NoteList({
	logic,
	searchQuery,
	now,
	selectedNotes,
	onToggle,
	onNavigate,
}: {
	logic: SessionLogic;
	searchQuery: string;
	now: Date;
	selectedNotes: Set<string>;
	onToggle: (name: string) => void;
	onNavigate: (path: string) => void;
}) {
	const filteredStats = logic.getFilteredNoteStats(searchQuery, now);

	if (filteredStats.length === 0) {
		return (
			<div class="ep:text-center ep:py-8 ep:text-obs-muted ep:text-ui-small">
				{searchQuery
					? "No notes match your search"
					: "No notes with flashcards found"}
			</div>
		);
	}

	return (
		<div class="true-recall-note-list">
			{filteredStats.map((stat) => (
				<NoteRow
					key={stat.noteName}
					stat={stat}
					isSelected={selectedNotes.has(stat.noteName)}
					onToggle={() => onToggle(stat.noteName)}
					onNavigate={
						stat.notePath
							? () => onNavigate(stat.notePath as string)
							: undefined
					}
				/>
			))}
		</div>
	);
}

function NoteRow({
	stat,
	isSelected,
	onToggle,
	onNavigate,
}: {
	stat: NoteStats;
	isSelected: boolean;
	onToggle: () => void;
	onNavigate?: () => void;
}) {
	const hasCards = stat.newCount > 0 || stat.dueCount > 0;

	return (
		<button
			type="button"
			class={`ep:flex ep:items-center ep:gap-3 ep:py-2.5 ep:px-3 ep:border-b ep:border-obs-modifier-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:bg-transparent ep:border-x-0 ep:border-t-0 ep:font-inherit ep:text-left ep:w-full${isSelected ? " ep:bg-obs-interactive/10" : ""}`}
			onClick={(e) => {
				const target = e.target as HTMLElement;
				if (target.tagName !== "INPUT" && target.tagName !== "A" && hasCards)
					onToggle();
			}}
		>
			{hasCards ? (
				<input
					type="checkbox"
					class="ep:shrink-0 ep:w-4 ep:h-4"
					checked={isSelected}
					onChange={onToggle}
				/>
			) : stat.isCompleted ? (
				<span class="ep:text-obs-green ep:text-ui-medium ep:font-semibold ep:w-4 ep:text-center">
					{"\u2713"}
				</span>
			) : null}

			<div class="ep:flex-1 ep:min-w-0">
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug ep:line-clamp-2">
					{onNavigate ? (
						<button
							type="button"
							class="ep:text-obs-normal ep:no-underline ep:hover:text-obs-link ep:hover:underline ep:bg-transparent ep:border-none ep:p-0 ep:cursor-pointer ep:text-left ep:font-inherit"
							onClick={(e) => {
								e.stopPropagation();
								onNavigate();
							}}
						>
							{stat.noteName}
						</button>
					) : (
						stat.noteName
					)}
				</div>
				<div class="ep:text-ui-smaller ep:mt-0.5 ep:flex ep:items-center ep:gap-1">
					{hasCards ? (
						<CardCountDisplay
							newCount={stat.newCount}
							learningCount={0}
							dueCount={stat.dueCount}
							variant="compact"
							size="smaller"
							bold
						/>
					) : (
						<span class="ep:text-obs-faint">done</span>
					)}
				</div>
			</div>
		</button>
	);
}

function SelectionBar({
	count,
	onStart,
	onMove,
	onAddProject,
	onClear,
}: {
	count: number;
	onStart: () => void;
	onMove: () => void;
	onAddProject: () => void;
	onClear: () => void;
}) {
	const btnCls =
		"ep:py-1.5 ep:px-3 ep:text-ui-small ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded-md ep:cursor-pointer ep:hover:bg-obs-modifier-hover";
	return (
		<div class="true-recall-session-selection-bar ep:hidden ep:md:flex ep:items-center ep:justify-between ep:p-3 ep:mt-2 ep:bg-obs-secondary ep:rounded-md ep:gap-3 ep:shrink-0">
			<span class="ep:text-ui-small ep:text-obs-muted ep:font-medium">
				{count} note{count > 1 ? "s" : ""} selected
			</span>
			<div class="ep:flex ep:gap-2">
				<button type="button" class={btnCls} onClick={onMove}>
					Move
				</button>
				<button type="button" class={btnCls} onClick={onAddProject}>
					Add to project
				</button>
				<button type="button" class={btnCls} onClick={onClear}>
					Clear
				</button>
				<button
					type="button"
					class="mod-cta ep:py-1.5 ep:px-4 ep:text-ui-small"
					onClick={onStart}
				>
					Start Session
				</button>
			</div>
		</div>
	);
}
