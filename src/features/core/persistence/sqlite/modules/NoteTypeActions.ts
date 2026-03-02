/**
 * NoteType Actions Module
 * CRUD operations for note_types table
 */

import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";
import type { NoteType } from "@shared/types/note.types";

export class NoteTypeActions {
	constructor(private db: SqliteDatabase) {}

	getById(_id: string): NoteType | null {
		throw new Error("Not implemented");
	}

	getAll(): NoteType[] {
		throw new Error("Not implemented");
	}

	create(_noteType: NoteType): void {
		throw new Error("Not implemented");
	}

	update(_id: string, _updates: Partial<NoteType>): void {
		throw new Error("Not implemented");
	}

	delete(_id: string): void {
		throw new Error("Not implemented");
	}

	seedBuiltinTypes(): void {
		throw new Error("Not implemented");
	}
}
