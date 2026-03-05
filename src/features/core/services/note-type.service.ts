/**
 * NoteType Service
 *
 * Business logic for note type CRUD operations.
 * Handles validation, built-in type management, field/template operations,
 * and cascading updates to notes and cards.
 */

import { slugifyNoteTypeName } from "@features/study/services/flashcard/note-type-slug";
import type { NoteType, CardTemplate } from "@shared/types/note.types";

export interface NoteTypeServiceDeps {
	noteTypeActions: {
		getById(id: string): NoteType | null;
		getBySlug(slug: string): NoteType | null;
		getAll(): NoteType[];
		create(noteType: NoteType): void;
		update(id: string, updates: Partial<NoteType>): void;
		delete(id: string): void;
		seedBuiltinTypes(): void;
	};
	noteActions: {
		getByNoteTypeId(noteTypeId: string): { id: string }[];
		countByNoteType(noteTypeId: string): number;
	};
}

export class NoteTypeService {
	constructor(private deps: NoteTypeServiceDeps) {}

	initialize(): void {
		this.deps.noteTypeActions.seedBuiltinTypes();
	}

	getById(id: string): NoteType | null {
		return this.deps.noteTypeActions.getById(id);
	}

	getAll(): NoteType[] {
		return this.deps.noteTypeActions.getAll();
	}

	getBySlug(slug: string): NoteType | null {
		return this.deps.noteTypeActions.getBySlug(slug);
	}

	create(input: {
		name: string;
		fields: string[];
		templates: CardTemplate[];
		css?: string;
		slug?: string;
	}): NoteType {
		const name = input.name.trim();

		if (input.fields.length === 0) {
			throw new Error("Note type must have at least one field");
		}
		if (input.templates.length === 0) {
			throw new Error("Note type must have at least one template");
		}

		// Check duplicate name
		const existing = this.deps.noteTypeActions.getAll();
		if (existing.some((nt) => nt.name === name)) {
			throw new Error(`Note type with name "${name}" already exists`);
		}

		// Auto-generate slug if not provided, ensure uniqueness
		let slug = input.slug ?? slugifyNoteTypeName(name);
		if (this.deps.noteTypeActions.getBySlug(slug)) {
			let counter = 2;
			while (this.deps.noteTypeActions.getBySlug(`${slug}-${counter}`)) {
				counter++;
			}
			slug = `${slug}-${counter}`;
		}

		const now = Date.now();
		const noteType: NoteType = {
			id: crypto.randomUUID(),
			name,
			type: 0,
			fields: input.fields,
			templates: input.templates,
			css: input.css ?? "",
			isBuiltin: false,
			slug,
			createdAt: now,
			updatedAt: now,
		};

		this.deps.noteTypeActions.create(noteType);
		return noteType;
	}

	update(
		id: string,
		updates: Partial<Pick<NoteType, "name" | "fields" | "templates" | "css">>,
	): void {
		const existing = this.deps.noteTypeActions.getById(id);
		if (!existing) {
			throw new Error(`Note type "${id}" not found`);
		}
		if (existing.isBuiltin) {
			throw new Error("Cannot update built-in note types");
		}

		this.deps.noteTypeActions.update(id, updates);
	}

	delete(id: string): void {
		const existing = this.deps.noteTypeActions.getById(id);
		if (!existing) {
			throw new Error(`Note type "${id}" not found`);
		}
		if (existing.isBuiltin) {
			throw new Error("Cannot delete built-in note types");
		}

		const noteCount = this.deps.noteActions.countByNoteType(id);
		if (noteCount > 0) {
			throw new Error(
				`Cannot delete note type "${existing.name}": ${noteCount} notes are using it`,
			);
		}

		this.deps.noteTypeActions.delete(id);
	}

	addField(noteTypeId: string, fieldName: string): void {
		const existing = this.deps.noteTypeActions.getById(noteTypeId);
		if (!existing) {
			throw new Error(`Note type "${noteTypeId}" not found`);
		}
		if (existing.isBuiltin) {
			throw new Error("Cannot modify built-in note types");
		}

		const fields = [...existing.fields, fieldName];
		this.deps.noteTypeActions.update(noteTypeId, { fields });
	}

	removeField(noteTypeId: string, fieldName: string): void {
		const existing = this.deps.noteTypeActions.getById(noteTypeId);
		if (!existing) {
			throw new Error(`Note type "${noteTypeId}" not found`);
		}
		if (existing.isBuiltin) {
			throw new Error("Cannot modify built-in note types");
		}
		if (existing.fields.length <= 1) {
			throw new Error("Cannot remove the last field from a note type");
		}

		const fields = existing.fields.filter((f) => f !== fieldName);
		this.deps.noteTypeActions.update(noteTypeId, { fields });
	}

	renameField(
		noteTypeId: string,
		oldName: string,
		newName: string,
	): void {
		const existing = this.deps.noteTypeActions.getById(noteTypeId);
		if (!existing) {
			throw new Error(`Note type "${noteTypeId}" not found`);
		}
		if (existing.isBuiltin) {
			throw new Error("Cannot modify built-in note types");
		}

		const fields = existing.fields.map((f) =>
			f === oldName ? newName : f,
		);

		// Also update templates that reference the old field name
		const templates = existing.templates.map((t) => ({
			...t,
			qfmt: t.qfmt.replace(
				new RegExp(`\\{\\{\\s*${escapeRegex(oldName)}\\s*\\}\\}`, "g"),
				`{{${newName}}}`,
			),
			afmt: t.afmt.replace(
				new RegExp(`\\{\\{\\s*${escapeRegex(oldName)}\\s*\\}\\}`, "g"),
				`{{${newName}}}`,
			),
		}));

		this.deps.noteTypeActions.update(noteTypeId, { fields, templates });
	}
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
