import { useState } from "preact/hooks";

import {
	describeRetrievability,
	PRIORITY_DOT,
} from "@true-recall/core/helpers/note-priority";

import {
	CardCountDisplay,
	Clickable,
	IconButton,
	InlineCardCount,
	PlayIcon,
	RetentionDisplay,
} from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { cn } from "@true-recall/obsidian/utils/cn";
import { isMobile } from "@true-recall/obsidian/utils/platform";

import type { DashboardNoteEntry } from "../types";

interface NoteRowProps {
	note: DashboardNoteEntry;
	onNavigate: () => void;
	/** cardCount is set only in R-Mode, where the user states the session size. */
	onStudy: (cardCount?: number) => void;
	onCustomStudy?: () => void;
	onProjectClick?: (projectName: string) => void;
	onPresetClick?: (notePath: string | null) => void;
	onContextMenu?: (e: MouseEvent) => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onRename?: () => void;
	onDetach?: () => void;
	isSelectionMode?: boolean;
	isSelected?: boolean;
	onToggleSelect?: () => void;
	onEnterSelection?: () => void;
}

export function NoteRow({
	note,
	onNavigate,
	onStudy,
	onProjectClick,
	onPresetClick,
	onContextMenu,
	isSelectionMode,
	isSelected,
	onToggleSelect,
	onEnterSelection,
}: NoteRowProps) {
	const plugin = usePlugin();
	const rModeEnabled = plugin.settings.rMode.enabled;
	const [size, setSize] = useState(
		String(plugin.settings.rMode.defaultSessionSize),
	);

	const parsed = Number.parseInt(size, 10);
	// An empty field states nothing and lets the default apply; a typed 0 is a
	// real request for a session of new and learning cards only.
	const requestedReviews = Number.isNaN(parsed)
		? undefined
		: Math.max(0, parsed);
	const wantsReviews = requestedReviews === undefined || requestedReviews > 0;

	const startSession = () => {
		if (!hasWork) return;
		onStudy(rModeEnabled ? requestedReviews : undefined);
	};

	// New and learning cards are outside R-Mode's selection, so a session is
	// still worth starting when only they are available. Dimming the action
	// says "nothing here" without adding another number to the row.
	const hasWork =
		!rModeEnabled ||
		(wantsReviews && (note.retrievability?.pool ?? 0) > 0) ||
		note.newCount > 0 ||
		note.learning > 0;

	const handleClick = (e: MouseEvent | KeyboardEvent) => {
		const isModifier = "metaKey" in e && (e.metaKey || e.ctrlKey);

		if (isModifier && !isSelectionMode) {
			onEnterSelection?.();
		} else if (isModifier && isSelectionMode) {
			onToggleSelect?.();
		} else if (isSelectionMode) {
			(onToggleSelect ?? onNavigate)();
		} else {
			onNavigate();
		}
	};

	return (
		<Clickable
			class={cn(
				"ep:flex ep:items-center ep:gap-3 ep:px-3 ep:h-9 ep:overflow-hidden ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				note.archived && "ep:opacity-50",
				// Nothing waiting reads faster as a dim row than as another zero.
				!hasWork && !note.archived && "ep:opacity-45",
				isSelected && "ep:bg-obs-modifier-hover",
			)}
			onContextMenu={isSelectionMode ? undefined : onContextMenu}
			onClick={handleClick}
			stopPropagation={false}
		>
			{isSelectionMode && (
				<input
					type="checkbox"
					checked={isSelected}
					class="ep:shrink-0"
					onClick={(e) => {
						e.stopPropagation();
						onToggleSelect?.();
					}}
				/>
			)}

			<div class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0 ep:hover:text-obs-interactive ep:transition-colors">
				{/* Padded wrapper: a 6px dot is too small a hover target for the
				    tooltip it now carries. */}
				<span
					class="ep:flex ep:items-center ep:shrink-0 ep:p-1 ep:-m-1"
					title={describeRetrievability(note.retrievability) ?? undefined}
				>
					<span
						class={cn(
							"ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full",
							PRIORITY_DOT[note.priority],
						)}
					/>
				</span>
				<span
					class={cn(
						"ep:text-sm ep:text-obs-normal ep:truncate",
						note.archived && "tr-faux-strike",
					)}
					title={note.name}
				>
					{note.name}
				</span>
				{!isMobile() && note.presetName && (
					<Clickable
						class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-active-hover ep:transition-colors ep:shrink-0"
						title={`FSRS preset: ${note.presetName}`}
						onClick={() => onPresetClick?.(note.path)}
					>
						{note.presetName}
					</Clickable>
				)}
			</div>

			{!isMobile() && note.projects.length > 0 && (
				<div
					class="ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:max-w-[200px] ep:overflow-hidden"
					title={note.projects.join(", ")}
				>
					{note.projects.slice(0, 2).map((projectName) => (
						<Clickable
							key={projectName}
							class="ep:px-1.5 ep:py-0.5 ep:text-[10px] ep:leading-tight ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-active-hover ep:transition-colors ep:truncate ep:max-w-[90px] ep:shrink-0"
							onClick={() => onProjectClick?.(projectName)}
						>
							{projectName}
						</Clickable>
					))}
					{note.projects.length > 2 && (
						<span class="ep:text-[10px] ep:text-obs-faint ep:shrink-0">
							+{note.projects.length - 2}
						</span>
					)}
				</div>
			)}

			{rModeEnabled ? (
				<RetentionDisplay
					newCount={note.newCount}
					learningCount={note.learning}
				/>
			) : (
				<CardCountDisplay
					newCount={note.newCount}
					learningCount={note.learning}
					dueCount={note.due}
				/>
			)}

			{!isSelectionMode && (
				<div class="ep:flex ep:items-center ep:gap-1">
					{rModeEnabled && (
						<InlineCardCount
							value={size}
							onChange={setSize}
							onSubmit={startSession}
							ariaLabel={`Cards to study from ${note.name}`}
						/>
					)}
					<IconButton
						icon="play"
						customIcon={<PlayIcon />}
						ariaLabel={`Study ${note.name}`}
						onClick={startSession}
						size="small"
						disabled={!hasWork}
					/>
				</div>
			)}
		</Clickable>
	);
}
