import type { NoteType } from "@true-recall/core/types/note.types";
import { type App, Notice, SuggestModal } from "obsidian";
import type TrueRecallPlugin from "../../../main";
import { CardTypesEditorModal } from "./CardTypesEditorModal";
import { CreateNoteTypeModal } from "./CreateNoteTypeModal";

type SuggestItem = NoteType | "create";

export class NoteTypeSuggestModal extends SuggestModal<SuggestItem> {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
	) {
		super(app);
		this.setPlaceholder("Choose a note type to edit...");
	}

	getSuggestions(query: string): SuggestItem[] {
		const lowerQuery = query.toLowerCase();
		const all = this.plugin.noteTypeService.getAll();
		const filtered = lowerQuery
			? all.filter((nt) => nt.name.toLowerCase().includes(lowerQuery))
			: all;
		return [...filtered, "create"];
	}

	renderSuggestion(item: SuggestItem, el: HTMLElement): void {
		if (item === "create") {
			el.setText("+ Create New Note Type");
			el.addClasses(["mod-complex", "u-text-accent"]);
			return;
		}
		const suffix = item.isBuiltin ? " (built-in)" : "";
		const type = item.type === 1 ? " [cloze]" : "";
		el.setText(`${item.name}${type}${suffix}`);
	}

	onChooseSuggestion(item: SuggestItem): void {
		if (item === "create") {
			void this.handleCreate();
			return;
		}
		new CardTypesEditorModal(this.app, this.plugin, item.id).open();
	}

	private async handleCreate(): Promise<void> {
		const allTypes = this.plugin.noteTypeService.getAll();
		const result = await new CreateNoteTypeModal(
			this.app,
			allTypes,
		).openAndWait();
		if (result.cancelled) return;

		try {
			let fields = ["Front", "Back"];
			let templates = [
				{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
			];
			let css: string | undefined;

			if (result.cloneFromId) {
				const source = this.plugin.noteTypeService.getById(result.cloneFromId);
				if (source) {
					fields = [...source.fields];
					templates = source.templates.map((t) => ({ ...t }));
					css = source.css;
				}
			}

			const created = this.plugin.noteTypeService.create({
				name: result.name,
				fields,
				templates,
				css,
			});
			new CardTypesEditorModal(this.app, this.plugin, created.id).open();
		} catch (e) {
			new Notice((e as Error).message);
		}
	}
}
