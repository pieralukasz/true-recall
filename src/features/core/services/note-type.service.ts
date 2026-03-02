/**
 * NoteType Service
 *
 * Business logic for note type CRUD operations.
 * Handles validation, built-in type management, field/template operations,
 * and cascading updates to notes and cards.
 */

import type { NoteType, CardTemplate } from "@shared/types/note.types";

export interface NoteTypeServiceDeps {
	noteTypeActions: {
		getById(id: string): NoteType | null;
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
		throw new Error("Not implemented");
	}

	getById(_id: string): NoteType | null {
		throw new Error("Not implemented");
	}

	getAll(): NoteType[] {
		throw new Error("Not implemented");
	}

	create(_input: {
		name: string;
		fields: string[];
		templates: CardTemplate[];
		css?: string;
	}): NoteType {
		throw new Error("Not implemented");
	}

	update(
		_id: string,
		_updates: Partial<Pick<NoteType, "name" | "fields" | "templates" | "css">>,
	): void {
		throw new Error("Not implemented");
	}

	delete(_id: string): void {
		throw new Error("Not implemented");
	}

	addField(_noteTypeId: string, _fieldName: string): void {
		throw new Error("Not implemented");
	}

	removeField(_noteTypeId: string, _fieldName: string): void {
		throw new Error("Not implemented");
	}

	renameField(
		_noteTypeId: string,
		_oldName: string,
		_newName: string,
	): void {
		throw new Error("Not implemented");
	}
}
