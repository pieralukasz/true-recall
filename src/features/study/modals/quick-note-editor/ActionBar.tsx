import { NoteTypePicker } from "@features/core/modals/add-flashcards/NoteTypePicker";
import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import type { App, TFile } from "obsidian";

interface ActionBarProps {
	app: App;
	noteTypeId: string;
	onNoteTypeChange: (id: string) => void;
	isEdit: boolean;
	showSourcePicker: boolean;
	selectedSourceNote: TFile | null;
	onSourceSelect: (file: TFile | null) => void;
}

export function ActionBar({
	app,
	noteTypeId,
	onNoteTypeChange,
	isEdit,
	showSourcePicker,
	selectedSourceNote,
	onSourceSelect,
}: ActionBarProps) {
	return (
		<div class="ep:flex ep:items-center ep:gap-2">
			<NoteTypePicker
				value={noteTypeId}
				onChange={onNoteTypeChange}
				disabled={isEdit}
			/>

			{showSourcePicker && (
				<div class="ep:flex-1 ep:min-w-[140px] ep:flex ep:items-center ep:gap-1">
					<div class="ep:flex-1">
						<NotePickerCombobox
							app={app}
							selectedNote={selectedSourceNote}
							onSelect={onSourceSelect}
						/>
					</div>
					{selectedSourceNote && (
						<Clickable
							class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
							onClick={() => onSourceSelect(null)}
						>
							Clear
						</Clickable>
					)}
				</div>
			)}
		</div>
	);
}
