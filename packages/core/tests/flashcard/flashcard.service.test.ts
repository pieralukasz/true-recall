import { beforeEach, describe, expect, it } from "vitest";

import { FlashcardManager } from "../../src/flashcard/flashcard.service";
import type { IFileSystem } from "../../src/interfaces/file-system";
import type { IFrontmatter } from "../../src/interfaces/frontmatter";
import type { SqliteStoreService } from "../../src/persistence/sqlite/SqliteStoreService";
import type { NoteType } from "../../src/types/note.types";
import { BUILTIN_BASIC_ID, BUILTIN_CLOZE_ID } from "../../src/types/note.types";

const basicType: NoteType = {
	id: BUILTIN_BASIC_ID,
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [
		{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
	],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

const clozeType: NoteType = {
	id: BUILTIN_CLOZE_ID,
	name: "Cloze",
	type: 1,
	fields: ["Text", "Extra"],
	templates: [
		{
			name: "Cloze",
			ordinal: 0,
			qfmt: "{{cloze:Text}}",
			afmt: "{{cloze:Text}}<br>{{Extra}}",
		},
	],
	css: "",
	isBuiltin: true,
	slug: "cloze",
};

describe("FlashcardManager", () => {
	describe("getNoteTypeById", () => {
		let fm: FlashcardManager;

		beforeEach(() => {
			const mockFileSystem: IFileSystem = {
				exists: async () => false,
				read: async () => "",
				write: async () => {},
				delete: async () => {},
				list: async () => [],
			};

			const mockFrontmatter: IFrontmatter = {
				parse: () => ({ metadata: {}, content: "" }),
				stringify: () => "",
			};

			const mockStore = {
				noteTypes: {
					getById: (id: string) =>
						id === BUILTIN_BASIC_ID
							? basicType
							: id === BUILTIN_CLOZE_ID
								? clozeType
								: null,
					getBySlug: () => null,
				},
				isReady: () => true,
			} as unknown as SqliteStoreService;

			fm = new FlashcardManager(mockFileSystem, mockFrontmatter, {});
			fm.setStore(mockStore);
		});

		it("returns the note type when id matches", () => {
			const result = fm.getNoteTypeById(BUILTIN_BASIC_ID);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(BUILTIN_BASIC_ID);
		});

		it("returns null when store has no note type with that id", () => {
			expect(fm.getNoteTypeById("nope")).toBeNull();
		});
	});
});
