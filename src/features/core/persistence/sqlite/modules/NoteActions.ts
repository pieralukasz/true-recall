/**
 * Note Actions Module
 * CRUD operations for notes table
 */

import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";
import type { Note } from "@shared/types/note.types";

export class NoteActions {
	constructor(private db: SqliteDatabase) {}

	getById(_id: string): Note | null {
		throw new Error("Not implemented");
	}

	getBySourceUid(_sourceUid: string): Note[] {
		throw new Error("Not implemented");
	}

	getByNoteTypeId(_noteTypeId: string): Note[] {
		throw new Error("Not implemented");
	}

	create(_note: Note): void {
		throw new Error("Not implemented");
	}

	update(_id: string, _updates: Partial<Note>): void {
		throw new Error("Not implemented");
	}

	delete(_id: string): void {
		throw new Error("Not implemented");
	}

	count(): number {
		throw new Error("Not implemented");
	}

	countByNoteType(_noteTypeId: string): number {
		throw new Error("Not implemented");
	}

	search(_query: string): Note[] {
		throw new Error("Not implemented");
	}
}
