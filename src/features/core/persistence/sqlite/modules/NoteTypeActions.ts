/**
 * NoteType Actions Module
 * CRUD operations for note_types table
 */

import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";
import type { CardTemplate, NoteType } from "@shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
	BUILTIN_SLUGS,
} from "@shared/types/note.types";

interface NoteTypeRow {
	id: string;
	name: string;
	type: number;
	fields_json: string;
	templates_json: string;
	css: string | null;
	is_builtin: number;
	slug: string | null;
	created_at: number | null;
	updated_at: number | null;
	deleted_at: number | null;
}

function mapRowToNoteType(row: NoteTypeRow): NoteType {
	return {
		id: row.id,
		name: row.name,
		type: row.type as 0 | 1,
		fields: JSON.parse(row.fields_json) as string[],
		templates: JSON.parse(row.templates_json) as CardTemplate[],
		css: row.css ?? "",
		isBuiltin: row.is_builtin === 1,
		slug: row.slug ?? undefined,
		createdAt: row.created_at ?? undefined,
		updatedAt: row.updated_at ?? undefined,
	};
}

export class NoteTypeActions {
	constructor(private db: SqliteDatabase) {}

	getById(id: string): NoteType | null {
		const row = this.db.get<NoteTypeRow>(
			`SELECT * FROM note_types WHERE id = ? AND deleted_at IS NULL`,
			[id],
		);
		return row ? mapRowToNoteType(row) : null;
	}

	getBySlug(slug: string): NoteType | null {
		const row = this.db.get<NoteTypeRow>(
			`SELECT * FROM note_types WHERE slug = ? AND deleted_at IS NULL`,
			[slug],
		);
		return row ? mapRowToNoteType(row) : null;
	}

	getAll(): NoteType[] {
		const rows = this.db.query<NoteTypeRow>(
			`SELECT * FROM note_types WHERE deleted_at IS NULL`,
		);
		return rows.map(mapRowToNoteType);
	}

	create(noteType: NoteType): void {
		const now = Date.now();
		this.db.run(
			`INSERT INTO note_types (id, name, type, fields_json, templates_json, css, is_builtin, slug, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				noteType.id,
				noteType.name,
				noteType.type,
				JSON.stringify(noteType.fields),
				JSON.stringify(noteType.templates),
				noteType.css,
				noteType.isBuiltin ? 1 : 0,
				noteType.slug ?? null,
				noteType.createdAt ?? now,
				noteType.updatedAt ?? now,
			],
		);
	}

	update(id: string, updates: Partial<NoteType>): void {
		const now = Date.now();
		const sets: string[] = [];
		const params: (string | number | null)[] = [];

		if (updates.name !== undefined) {
			sets.push("name = ?");
			params.push(updates.name);
		}
		if (updates.type !== undefined) {
			sets.push("type = ?");
			params.push(updates.type);
		}
		if (updates.fields !== undefined) {
			sets.push("fields_json = ?");
			params.push(JSON.stringify(updates.fields));
		}
		if (updates.templates !== undefined) {
			sets.push("templates_json = ?");
			params.push(JSON.stringify(updates.templates));
		}
		if (updates.css !== undefined) {
			sets.push("css = ?");
			params.push(updates.css);
		}
		if (updates.slug !== undefined) {
			sets.push("slug = ?");
			params.push(updates.slug);
		}

		sets.push("updated_at = ?");
		params.push(now);
		params.push(id);

		this.db.run(
			`UPDATE note_types SET ${sets.join(", ")} WHERE id = ?`,
			params,
		);
	}

	delete(id: string): void {
		this.db.run(
			`UPDATE note_types SET deleted_at = ? WHERE id = ?`,
			[Date.now(), id],
		);
	}

	seedBuiltinTypes(): void {
		const builtins = getBuiltinNoteTypes();
		for (const nt of builtins) {
			const slug = BUILTIN_SLUGS[nt.id];
			this.db.run(
				`INSERT OR IGNORE INTO note_types (id, name, type, fields_json, templates_json, css, is_builtin, slug, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					nt.id,
					nt.name,
					nt.type,
					JSON.stringify(nt.fields),
					JSON.stringify(nt.templates),
					nt.css,
					1,
					slug ?? null,
					Date.now(),
					Date.now(),
				],
			);
		}
	}

	// Ensures builtin note type templates always match code definitions.
	// Fixes databases migrated before template changes (e.g. old afmt with <hr>).
	refreshBuiltins(): void {
		const builtins = getBuiltinNoteTypes();
		const now = Date.now();
		for (const nt of builtins) {
			const slug = BUILTIN_SLUGS[nt.id];
			this.db.run(
				`UPDATE note_types
				 SET templates_json = ?, fields_json = ?, css = ?, name = ?, slug = ?, updated_at = ?
				 WHERE id = ? AND is_builtin = 1`,
				[
					JSON.stringify(nt.templates),
					JSON.stringify(nt.fields),
					nt.css,
					nt.name,
					slug ?? null,
					now,
					nt.id,
				],
			);
		}
	}
}

export function getBuiltinNoteTypes(): NoteType[] {
	return [
		{
			id: BUILTIN_BASIC_ID,
			name: "Basic",
			type: 0,
			fields: ["Front", "Back"],
			templates: [
				{
					name: "Card 1",
					ordinal: 0,
					qfmt: "{{Front}}",
					afmt: "{{Back}}",
				},
			],
			css: "",
			isBuiltin: true,
		},
		{
			id: BUILTIN_BASIC_REVERSED_ID,
			name: "Basic (reversed)",
			type: 0,
			fields: ["Front", "Back"],
			templates: [
				{
					name: "Card 1",
					ordinal: 0,
					qfmt: "{{Front}}",
					afmt: "{{Back}}",
				},
				{
					name: "Card 2",
					ordinal: 1,
					qfmt: "{{Back}}",
					afmt: "{{Front}}",
				},
			],
			css: "",
			isBuiltin: true,
		},
		{
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
		},
		{
			id: BUILTIN_IMAGE_OCCLUSION_ID,
			name: "Image Occlusion",
			type: 0,
			fields: ["Image", "Regions"],
			templates: [
				{
					name: "Occlusion",
					ordinal: 0,
					qfmt: "{{Image}}",
					afmt: "{{Image}}{{Regions}}",
				},
			],
			css: "",
			isBuiltin: true,
		},
	];
}
