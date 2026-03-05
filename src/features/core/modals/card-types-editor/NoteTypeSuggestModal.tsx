import type { NoteType } from "@shared/types/note.types";
import { type App, Notice, SuggestModal } from "obsidian";
import type TrueRecallPlugin from "../../../../main";
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
			el.setText("+ Create new note type");
			el.addClass("mod-complex");
			el.style.color = "var(--text-accent)";
			return;
		}
		const suffix = item.isBuiltin ? " (built-in)" : "";
		const type = item.type === 1 ? " [cloze]" : "";
		el.setText(`${item.name}${type}${suffix}`);
	}

	async onChooseSuggestion(item: SuggestItem): Promise<void> {
		if (item === "create") {
			const result = await new CreateNoteTypeModal(this.app).openAndWait();
			if (result.cancelled) return;

			try {
				const created = this.plugin.noteTypeService.create({
					name: result.name,
					fields: ["Front", "Back"],
					templates: [
						{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
					],
				});
				new CardTypesEditorModal(this.app, this.plugin, created.id).open();
			} catch (e) {
				new Notice((e as Error).message);
			}
			return;
		}
		new CardTypesEditorModal(this.app, this.plugin, item.id).open();
	}
}
