import { Menu } from "obsidian";
import { useCallback } from "preact/hooks";
import type { SelectionMode } from "@shared/store";
import type { ProjectNoteInfo } from "@shared/types";
import {
	CardCountDisplay,
	IconButton,
} from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact/hooks";
import { ICON_BTN_CLS } from "@features/library/ui/note-hub/constants";

export interface NoteHubNoteRowProps {
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

export function NoteHubNoteRow({
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

			<button
				type="button"
				class="ep:flex-1 ep:min-w-0 ep:truncate ep:text-ui-small ep:font-medium ep:text-obs-normal ep:cursor-pointer ep:hover:text-obs-link ep:hover:underline ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left"
				onClick={(e) => {
					e.stopPropagation();
					onOpenNote(note.path);
				}}
			>
				{note.name}
			</button>

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
