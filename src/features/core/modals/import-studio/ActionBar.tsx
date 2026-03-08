import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import type { App, TFile } from "obsidian";

interface ImportStudioActionBarProps {
	app: App;
	selectedSourceNote: TFile | null;
	onSourceSelect: (file: TFile | null) => void;
}

export function ActionBar({
	app,
	selectedSourceNote,
	onSourceSelect,
}: ImportStudioActionBarProps) {
	return (
		<NotePickerCombobox
			app={app}
			selectedNote={selectedSourceNote}
			onSelect={onSourceSelect}
		/>
	);
}
