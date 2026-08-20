import { FLASHCARD_CONFIG } from "../../../../constants";
import { DatabaseError } from "../../../../errors";
import {
	deriveCardType,
	renderTemplate,
} from "../../../../services/cards/template-engine";
import type { CardSchedulingMeta, FSRSCardData } from "../../../../types";
import type { CardTemplate } from "../../../../types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../../types/note.types";
import {
	normalizeIOImagePath,
	parseIODefinition,
} from "../../../../utils/io-definition";

// ── Column definitions (JOIN-based, computed q/a) ──────────────

export const CARD_SELECT = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.fields_json AS fieldsJson,
    n.tags AS noteTags,
    n.source_text AS sourceText,
	n.user_comment AS userComment,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;

export const CARD_SELECT_SYNC = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.updated_at AS updatedAt,
    c.deleted_at AS deletedAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.fields_json AS fieldsJson,
    n.tags AS noteTags,
    n.source_text AS sourceText,
	n.user_comment AS userComment,
    n.created_via AS createdVia,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName,
    nt.templates_json AS templatesJson
`;

export const CARD_FROM = `
    FROM cards c
    JOIN notes n ON c.note_id = n.id
    JOIN note_types nt ON n.note_type_id = nt.id
`;

// ── Lightweight scheduling-only query (no fieldsJson/templatesJson) ──

export const META_SELECT = `
    c.id, c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state,
    c.last_review AS lastReview,
    c.scheduled_days AS scheduledDays,
    c.learning_step AS learningStep,
    c.suspended = 1 AS suspended,
    c.buried_until AS buriedUntil,
    c.created_at AS createdAt,
    c.source_uid AS sourceUid,
    c.note_id AS noteId,
    c.template_ord AS templateOrd,
    n.tags AS noteTags,
    n.note_type_id AS noteTypeId,
    nt.type AS noteTypeType,
    nt.name AS noteTypeName
`;

// ── Row interfaces ───────────────────────────────────────────

export interface MetaRow {
	id: string;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	state: number;
	lastReview: string | null;
	scheduledDays: number;
	learningStep: number;
	suspended: number;
	buriedUntil: string | null;
	createdAt: number | null;
	sourceUid: string | null;
	noteId: string;
	templateOrd: number;
	noteTags: string | null;
	noteTypeId: string;
	noteTypeType: number;
	noteTypeName: string;
}

export interface CardRow {
	id: string;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	state: number;
	lastReview: string | null;
	scheduledDays: number;
	learningStep: number;
	suspended: number;
	buriedUntil: string | null;
	createdAt: number | null;
	updatedAt?: number | null;
	deletedAt?: number | null;
	sourceUid: string | null;
	noteId: string;
	templateOrd: number;
	fieldsJson: string;
	noteTags: string | null;
	sourceText: string | null;
	userComment: string | null;
	createdVia: string | null;
	noteTypeId: string;
	noteTypeType: number;
	noteTypeName: string;
	templatesJson: string;
}

// ── Row mappers ──────────────────────────────────────────────

export function mapMetaRow(row: MetaRow): CardSchedulingMeta {
	const noteTags =
		row.noteTags
			?.split(" ")
			.map((t: string) => t.trim())
			.filter(Boolean) ?? [];

	const noteTypeInfo = { id: row.noteTypeId, type: row.noteTypeType as 0 | 1 };
	const cardType = deriveCardType(noteTypeInfo, row.templateOrd);

	return {
		id: row.id,
		fsrs: {
			id: row.id,
			due: row.due,
			stability: row.stability,
			difficulty: row.difficulty,
			reps: row.reps,
			lapses: row.lapses,
			state: row.state,
			lastReview: row.lastReview,
			scheduledDays: row.scheduledDays,
			learningStep: row.learningStep,
			suspended: row.suspended === 1,
			buriedUntil: row.buriedUntil ?? undefined,
			createdAt: row.createdAt ?? undefined,
			sourceUid: row.sourceUid ?? undefined,
			noteId: row.noteId,
			templateOrd: row.templateOrd,
			noteTypeId: row.noteTypeId,
			noteTypeName: row.noteTypeName,
		},
		sourceUid: row.sourceUid ?? undefined,
		cardType,
		noteId: row.noteId,
		templateOrd: row.templateOrd,
		noteTypeName: row.noteTypeName,
		alwaysTypeIn: noteTags.includes(FLASHCARD_CONFIG.alwaysTypeInTag),
		tags: noteTags,
	};
}

export function mapRow(row: CardRow): FSRSCardData {
	let fields: Record<string, string>;
	try {
		fields = JSON.parse(row.fieldsJson) as Record<string, string>;
	} catch {
		throw new DatabaseError(
			`Corrupt fields JSON for card ${row.id}`,
			"card:parse",
		);
	}
	const noteTags =
		row.noteTags
			?.split(" ")
			.map((t: string) => t.trim())
			.filter(Boolean) ?? [];
	let templates: CardTemplate[];
	try {
		templates = JSON.parse(row.templatesJson) as CardTemplate[];
	} catch {
		throw new DatabaseError(
			`Corrupt templates JSON for card ${row.id}`,
			"card:parse",
		);
	}

	// Cloze types: always use first template (templateOrd = cloze index, not template ordinal)
	let template: CardTemplate | undefined;
	if (row.noteTypeType === 1) {
		template = templates[0];
	} else {
		template = templates.find(
			(t: CardTemplate) => t.ordinal === row.templateOrd,
		);
	}

	const noteTypeInfo = {
		id: row.noteTypeId,
		type: row.noteTypeType as 0 | 1,
	};
	const cardType = deriveCardType(noteTypeInfo, row.templateOrd);

	const ioImagePath =
		cardType === "image-occlusion"
			? normalizeIOImagePath(fields.Image ?? "")
			: undefined;
	const ioRegionsJson =
		cardType === "image-occlusion" ? (fields.Regions ?? "") : undefined;
	const ioDefinition =
		cardType === "image-occlusion" && ioRegionsJson
			? parseIODefinition(ioRegionsJson)
			: null;

	let question = "";
	let answer = "";

	if (cardType === "image-occlusion") {
		question =
			ioImagePath && ioDefinition
				? `Image occlusion ${row.templateOrd + 1}`
				: "Image occlusion";
		answer = "Reveal image occlusion";
	} else if (template) {
		const context = { fields, clozeIndex: row.templateOrd };
		question = renderTemplate(template.qfmt, context);
		answer = renderTemplate(template.afmt, {
			...context,
			frontSide: "",
		});
	}

	const isCloze = noteTypeInfo.type === 1;

	// Derive cloze field name from template's {{cloze:FieldName}} instead of hardcoding "Text"
	let clozeFieldName = "Text";
	if (isCloze && template) {
		const m = template.qfmt.match(/\{\{\s*cloze:(\w+)\s*\}\}/);
		if (m?.[1]) clozeFieldName = m[1];
	}

	return {
		id: row.id,
		due: row.due,
		stability: row.stability,
		difficulty: row.difficulty,
		reps: row.reps,
		lapses: row.lapses,
		state: row.state,
		lastReview: row.lastReview,
		scheduledDays: row.scheduledDays,
		learningStep: row.learningStep,
		suspended: row.suspended === 1,
		buriedUntil: row.buriedUntil ?? undefined,
		createdAt: row.createdAt ?? undefined,
		question,
		answer,
		sourceUid: row.sourceUid ?? undefined,
		cardType,
		clozeTemplate: isCloze ? (fields[clozeFieldName] ?? undefined) : undefined,
		clozeIndex: isCloze ? row.templateOrd : undefined,
		createdVia: row.createdVia ?? undefined,
		sourceText: row.sourceText ?? undefined,
		userComment: row.userComment ?? undefined,
		noteId: row.noteId,
		templateOrd: row.templateOrd,
		noteTypeId: row.noteTypeId,
		noteTypeName: row.noteTypeName,
		ioImagePath,
		ioRegionsJson,
		ioGroupKey:
			cardType === "image-occlusion" ? String(row.templateOrd) : undefined,
		alwaysTypeIn: noteTags.includes(FLASHCARD_CONFIG.alwaysTypeInTag),
		tags: noteTags,
	};
}

export function mapRowWithSync(
	row: CardRow,
): FSRSCardData & { updatedAt?: number; deletedAt?: number | null } {
	return {
		...mapRow(row),
		updatedAt: row.updatedAt ?? undefined,
		deletedAt: row.deletedAt,
	};
}

// ── Note mapping helper ───────────────────────────────────────

export function resolveNoteMapping(data: FSRSCardData): {
	noteTypeId: string;
	fieldsJson: string;
	templateOrd: number;
} {
	if (data.noteTypeId) {
		if (data.noteTypeId === BUILTIN_IMAGE_OCCLUSION_ID) {
			return {
				noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
				fieldsJson: JSON.stringify({
					Image: data.ioImagePath ?? "",
					Regions: data.ioRegionsJson ?? "[]",
				}),
				templateOrd: data.templateOrd ?? 0,
			};
		}

		// Caller provides explicit field values (e.g. Anki import with custom note types)
		if (data.fields) {
			return {
				noteTypeId: data.noteTypeId,
				fieldsJson: JSON.stringify(data.fields),
				// Cloze cards: templateOrd stores the 1-based cloze index, not the template ordinal
				templateOrd:
					data.cardType === "cloze" && data.clozeIndex != null
						? data.clozeIndex
						: (data.templateOrd ?? 0),
			};
		}

		// Fallback: derive fields from question/answer for legacy callers
		return {
			noteTypeId: data.noteTypeId,
			fieldsJson: JSON.stringify(
				data.cardType === "cloze"
					? { Text: data.clozeTemplate ?? "", Extra: "" }
					: { Front: data.question ?? "", Back: data.answer ?? "" },
			),
			templateOrd:
				data.cardType === "cloze" && data.clozeIndex != null
					? data.clozeIndex
					: (data.templateOrd ?? 0),
		};
	}

	if (data.cardType === "cloze") {
		return {
			noteTypeId: BUILTIN_CLOZE_ID,
			fieldsJson: JSON.stringify({
				Text: data.clozeTemplate ?? "",
				Extra: "",
			}),
			templateOrd: data.clozeIndex ?? 0,
		};
	}

	if (data.cardType === "reversed") {
		return {
			noteTypeId: BUILTIN_BASIC_REVERSED_ID,
			fieldsJson: JSON.stringify({
				Front: data.question ?? "",
				Back: data.answer ?? "",
			}),
			templateOrd: data.templateOrd ?? 1,
		};
	}

	return {
		noteTypeId: BUILTIN_BASIC_ID,
		fieldsJson: JSON.stringify({
			Front: data.question ?? "",
			Back: data.answer ?? "",
		}),
		templateOrd: data.templateOrd ?? 0,
	};
}
