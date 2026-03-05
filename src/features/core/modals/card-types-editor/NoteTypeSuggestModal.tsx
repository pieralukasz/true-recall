import type { NoteType } from "@shared/types/note.types";
import { type App, FuzzySuggestModal } from "obsidian";
import type TrueRecallPlugin from "../../../../main";
import { CardTypesEditorModal } from "./CardTypesEditorModal";

export class NoteTypeSuggestModal extends FuzzySuggestModal<NoteType> {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
	) {
		super(app);
		this.setPlaceholder("Choose a note type to edit...");
	}

	getItems(): NoteType[] {
		return this.plugin.noteTypeService.getAll();
	}

	getItemText(item: NoteType): string {
		const suffix = item.isBuiltin ? " (built-in)" : "";
		const type = item.type === 1 ? " [cloze]" : "";
		return `${item.name}${type}${suffix}`;
	}

	onChooseItem(item: NoteType): void {
		new CardTypesEditorModal(this.app, this.plugin, item.id).open();
	}
}
