import type { App, TFile } from "obsidian";

import { Clickable } from "@true-recall/obsidian/components";
import { NotePickerCombobox } from "@true-recall/obsidian/components/NotePickerCombobox";
import { NoteTypePicker } from "@true-recall/obsidian/modals/core/add-flashcards/NoteTypePicker";

interface ActionBarProps {
	app: App;
	noteTypeId: string;
	onNoteTypeChange: (id: string) => void;
	isEdit: boolean;
	onChangeType?: () => void;
	showSourcePicker: boolean;
	selectedSourceNote: TFile | null;
	onSourceSelect: (file: TFile | null) => void;
}

export function ActionBar({
	app,
	noteTypeId,
	onNoteTypeChange,
	isEdit,
	onChangeType,
	showSourcePicker,
	selectedSourceNote,
	onSourceSelect,
}: ActionBarProps) {
	return (
		<div class="true-recall-action-bar ep:flex ep:items-center ep:gap-2">
			<NoteTypePicker
				value={noteTypeId}
				onChange={onNoteTypeChange}
				disabled={isEdit}
			/>
			{isEdit && onChangeType && (
				<Clickable
					class="ep:text-ui-smaller ep:text-obs-accent hover:ep:underline"
					onClick={onChangeType}
				>
					Change
				</Clickable>
			)}

			{showSourcePicker && (
				<div class="ep:flex-1 ep:min-w-[60%]">
					<NotePickerCombobox
						app={app}
						selectedNote={selectedSourceNote}
						onSelect={onSourceSelect}
					/>
				</div>
			)}
		</div>
	);
}
