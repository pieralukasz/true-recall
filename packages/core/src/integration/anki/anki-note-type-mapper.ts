import { slugifyNoteTypeName } from "@true-recall/core/flashcard/note-types/note-type-slug";
import type { AnkiModel, NoteTypeMapping } from "@true-recall/core/types";
import type {
	CardTemplate,
	NoteType,
} from "@true-recall/core/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
} from "@true-recall/core/types/note.types";

export interface NoteTypeStore {
	getAll(): NoteType[];
	getBySlug(slug: string): NoteType | null;
	create(noteType: NoteType): void;
}

export class AnkiNoteTypeMapper {
	private modelToNoteType = new Map<number, string>();
	private created = 0;

	constructor(private noteTypeStore: NoteTypeStore) {}

	get noteTypesCreated(): number {
		return this.created;
	}

	suggestMappings(
		models: Map<number, AnkiModel>,
		cardCountByModel?: Map<number, number>,
	): NoteTypeMapping[] {
		const suggestions: NoteTypeMapping[] = [];

		for (const [modelId, model] of models) {
			const fields = [...model.flds]
				.sort((a, b) => a.ord - b.ord)
				.map((f) => f.name);

			const builtinId = this.matchBuiltin(model);
			let suggestedId: string | null = null;
			let suggestedName: string | null = null;

			if (builtinId) {
				suggestedId = builtinId;
				const nt = this.noteTypeStore.getAll().find((t) => t.id === builtinId);
				suggestedName = nt?.name ?? builtinId;
			} else {
				const existing = this.findExistingMatch(model);
				if (existing) {
					suggestedId = existing.id;
					suggestedName = existing.name;
				}
			}

			suggestions.push({
				ankiModelId: modelId,
				ankiModelName: model.name,
				ankiFields: fields,
				ankiType: model.type === 1 ? 1 : 0,
				cardCount: cardCountByModel?.get(modelId) ?? 0,
				suggestedNoteTypeId: suggestedId,
				suggestedNoteTypeName: suggestedName,
			});
		}

		return suggestions;
	}

	mapModels(
		models: Map<number, AnkiModel>,
		overrides?: Map<number, string>,
	): void {
		for (const [modelId, model] of models) {
			const override = overrides?.get(modelId);

			if (override && override !== "auto") {
				// User explicitly chose a note type
				this.modelToNoteType.set(modelId, override);
				continue;
			}

			const noteTypeId = this.resolveNoteType(model);
			this.modelToNoteType.set(modelId, noteTypeId);
		}
	}

	getNoteTypeId(ankiModelId: number): string | undefined {
		return this.modelToNoteType.get(ankiModelId);
	}

	private findExistingMatch(model: AnkiModel): NoteType | undefined {
		const modelFields = [...model.flds]
			.sort((a, b) => a.ord - b.ord)
			.map((f) => f.name);
		return this.noteTypeStore
			.getAll()
			.find(
				(nt) =>
					nt.name === model.name &&
					!nt.isBuiltin &&
					nt.fields.length === modelFields.length &&
					nt.fields.every((f, i) => f === modelFields[i]),
			);
	}

	private resolveNoteType(model: AnkiModel): string {
		const builtinId = this.matchBuiltin(model);
		if (builtinId) return builtinId;

		const existing = this.findExistingMatch(model);
		if (existing) return existing.id;

		return this.createFromAnkiModel(model);
	}

	private matchBuiltin(model: AnkiModel): string | null {
		const fieldNames = [...model.flds]
			.sort((a, b) => a.ord - b.ord)
			.map((f) => f.name);

		if (
			model.type === 0 &&
			fieldNames.length === 2 &&
			fieldNames[0] === "Front" &&
			fieldNames[1] === "Back" &&
			model.tmpls.length === 1
		) {
			return BUILTIN_BASIC_ID;
		}

		if (
			model.type === 0 &&
			fieldNames.length === 2 &&
			fieldNames[0] === "Front" &&
			fieldNames[1] === "Back" &&
			model.tmpls.length === 2
		) {
			return BUILTIN_BASIC_REVERSED_ID;
		}

		if (
			model.type === 1 &&
			fieldNames.length === 2 &&
			fieldNames[0] === "Text" &&
			fieldNames[1] === "Extra"
		) {
			return BUILTIN_CLOZE_ID;
		}

		return null;
	}

	private createFromAnkiModel(model: AnkiModel): string {
		const fields = [...model.flds]
			.sort((a, b) => a.ord - b.ord)
			.map((f) => f.name);

		const templates: CardTemplate[] = [...model.tmpls]
			.sort((a, b) => a.ord - b.ord)
			.map((t) => ({
				name: t.name,
				ordinal: t.ord,
				qfmt: stripHtmlFromTemplate(t.qfmt),
				afmt: stripHtmlFromTemplate(t.afmt),
			}));

		// If all templates have empty qfmt (v18 parsing fallback), generate simple ones
		if (templates.every((t) => !t.qfmt)) {
			for (const t of templates) {
				t.qfmt = fields[0] ? `{{${fields[0]}}}` : "";
				t.afmt = fields[1] ? `{{${fields[1]}}}` : "";
			}
		}

		let name = model.name;
		const allTypes = this.noteTypeStore.getAll();
		if (allTypes.some((nt) => nt.name === name)) {
			let counter = 2;
			while (allTypes.some((nt) => nt.name === `${name} (${counter})`)) {
				counter++;
			}
			name = `${name} (${counter})`;
		}

		let slug = slugifyNoteTypeName(name);
		if (this.noteTypeStore.getBySlug(slug)) {
			let counter = 2;
			while (this.noteTypeStore.getBySlug(`${slug}-${counter}`)) {
				counter++;
			}
			slug = `${slug}-${counter}`;
		}

		const now = Date.now();
		const noteType: NoteType = {
			id: crypto.randomUUID(),
			name,
			type: model.type === 1 ? 1 : 0,
			fields,
			templates,
			css: model.css ?? "",
			isBuiltin: false,
			slug,
			createdAt: now,
			updatedAt: now,
		};

		this.noteTypeStore.create(noteType);
		this.created++;
		return noteType.id;
	}
}

/**
 * Strip HTML wrapper tags from Anki templates while preserving
 * {{FieldName}}, {{cloze:FieldName}}, {{FrontSide}}, {{#Field}}...{{/Field}} references.
 */
export function stripHtmlFromTemplate(template: string): string {
	if (!template) return template;

	let result = template;

	// Remove Anki's answer divider
	result = result.replace(/<hr\s+id=["']?answer["']?\s*\/?>/gi, "");

	// Replace <br> with newlines
	result = result.replace(/<br\s*\/?>/gi, "\n");

	// Strip HTML tags but preserve {{ }} template syntax
	result = result.replace(/<[^>]+>/g, "");

	// Decode common HTML entities
	result = result
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&nbsp;/gi, " ")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&apos;/gi, "'");

	// Strip Anki field modifiers: {{edit:Field}} → {{Field}}
	result = result.replace(/\{\{\s*edit:([\w][\w ]*?)\s*\}\}/g, "{{$1}}");

	// Collapse excessive blank lines
	result = result.replace(/\n{3,}/g, "\n\n");

	return result.trim();
}
