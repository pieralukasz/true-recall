import { NoteTypePicker } from "@features/core/modals/add-flashcards/NoteTypePicker";
import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import type { App, TFile } from "obsidian";

interface ImportStudioActionBarProps {
	app: App;
	noteTypeId: string;
	onNoteTypeChange: (id: string) => void;
	selectedSourceNote: TFile | null;
	onSourceSelect: (file: TFile | null) => void;
}

export function ActionBar({
	app,
	noteTypeId,
	onNoteTypeChange,
	selectedSourceNote,
	onSourceSelect,
}: ImportStudioActionBarProps) {
	return (
		<div class="ep:flex ep:items-center ep:gap-3 ep:flex-wrap">
			<span class="ep:text-ui-smaller ep:text-obs-muted ep:shrink-0">
				Note type:
			</span>
			<NoteTypePicker value={noteTypeId} onChange={onNoteTypeChange} />

			<span class="ep:text-obs-faint ep:text-ui-smaller">|</span>

			<span class="ep:text-ui-smaller ep:text-obs-muted ep:shrink-0">
				Source:
			</span>
			<div class="ep:flex-1 ep:min-w-[160px]">
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
	);
}
