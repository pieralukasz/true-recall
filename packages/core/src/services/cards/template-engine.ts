/**
 * Template Engine — Anki-compatible template rendering.
 *
 * Supported syntax:
 * - {{FieldName}} — field value substitution
 * - {{FrontSide}} — stripped (True Recall shows Q/A separately)
 * - {{cloze:FieldName}} — cloze deletion rendering
 * - {{#FieldName}}...{{/FieldName}} — conditional (non-empty field)
 * - {{^FieldName}}...{{/FieldName}} — inverse conditional (empty field)
 */

import {
	renderClozeAnswer,
	renderClozeQuestion,
} from "@true-recall/core/flashcard/parsing/cloze-parser.service";

import type { CardType } from "../../types";
import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	BUILTIN_NOTE_REVIEW_ID,
	type NoteType,
} from "../../types/note.types";

export interface TemplateContext {
	fields: Record<string, string>;
	/** Set to any string (even "") to signal answer-side rendering (affects cloze display) */
	frontSide?: string;
	/** Active cloze index (only for cloze note types) */
	clozeIndex?: number;
}

/**
 * Render an Anki-style template with the given context.
 *
 * Processing order matters to prevent re-evaluation of injected content:
 * 1. Strip HTML comments (don't process handlebars inside them)
 * 2. Replace {{FrontSide}}
 * 3. Replace {{cloze:FieldName}}
 * 4. Process conditionals ({{#Field}}, {{^Field}}) — must happen before
 *    field substitution so we can check emptiness of original field values
 * 5. Replace {{FieldName}} — values injected here are NOT re-processed
 */
export function renderTemplate(
	template: string,
	context: TemplateContext,
): string {
	if (template.length === 0) return "";

	// 1. Extract HTML comments so handlebars inside them are not processed
	const commentPlaceholders: string[] = [];
	let working = template.replace(/<!--[\s\S]*?-->/g, (match) => {
		const idx = commentPlaceholders.length;
		commentPlaceholders.push(match);
		return `\x00COMMENT_${idx}\x00`;
	});

	// 1.5. Strip Anki field modifiers: {{edit:Field}} → {{Field}}
	working = working.replace(/\{\{\s*edit:([\w][\w ]*?)\s*\}\}/g, "{{$1}}");

	// 2. Strip {{FrontSide}} — True Recall's review UI shows Q/A separately
	working = working.replace(/\{\{\s*FrontSide\s*\}\}/g, "");

	// 3. Replace {{cloze:FieldName}}
	working = working.replace(
		/\{\{\s*cloze:([\w][\w ]*?)\s*\}\}/g,
		(_match, fieldName: string) => {
			const fieldValue = context.fields[fieldName];
			if (fieldValue === undefined) return _match;

			const idx = context.clozeIndex ?? 0;
			const isAnswer = context.frontSide !== undefined;

			if (isAnswer) {
				return renderClozeAnswer(fieldValue, idx);
			}
			return renderClozeQuestion(fieldValue, idx);
		},
	);

	// 4. Process conditionals — recursive to handle nesting
	working = processConditionals(working, context.fields);

	// 5. Replace {{FieldName}} — use a marker approach to prevent re-processing
	const fieldPlaceholders: string[] = [];
	working = working.replace(
		/\{\{\s*([\w][\w ]*?)\s*\}\}/g,
		(_match, fieldName: string) => {
			if (fieldName in context.fields) {
				const idx = fieldPlaceholders.length;
				const fieldValue = context.fields[fieldName];
				if (fieldValue !== undefined) {
					fieldPlaceholders.push(fieldValue);
					return `\x00FIELD_${idx}\x00`;
				}
			}
			return _match; // Unknown field — leave unreplaced
		},
	);

	// Restore field values (already protected from re-processing by placeholders)
	for (let i = 0; i < fieldPlaceholders.length; i++) {
		const placeholder = fieldPlaceholders[i];
		if (placeholder !== undefined) {
			working = working.replace(`\x00FIELD_${i}\x00`, () => placeholder);
		}
	}

	// Restore HTML comments
	for (let i = 0; i < commentPlaceholders.length; i++) {
		const comment = commentPlaceholders[i];
		if (comment !== undefined) {
			working = working.replace(`\x00COMMENT_${i}\x00`, () => comment);
		}
	}

	return working;
}

/**
 * Process {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}} conditionals.
 * Handles nesting by processing innermost conditionals first.
 */
function processConditionals(
	template: string,
	fields: Record<string, string>,
): string {
	// Process from innermost out — keep going until no more conditionals found
	let result = template;
	let changed = true;
	let iterations = 0;
	const MAX_ITERATIONS = 50;

	while (changed && iterations < MAX_ITERATIONS) {
		changed = false;
		iterations++;

		// Match innermost conditionals (no nested {{# or {{^ inside)
		result = result.replace(
			/\{\{([#^])\s*([\w][\w ]*?)\s*\}\}((?:(?!\{\{[#^])[\s\S])*?)\{\{\/\s*([\w][\w ]*?)\s*\}\}/g,
			(
				_match,
				type: string,
				openField: string,
				content: string,
				closeField: string,
			) => {
				changed = true;

				// Mismatched tags — return content as graceful fallback
				if (openField !== closeField) {
					return content;
				}

				const fieldValue = fields[openField] ?? "";
				const isEmpty = fieldIsEmpty(fieldValue);

				if (type === "#") {
					return isEmpty ? "" : content;
				}
				// type === "^"
				return isEmpty ? content : "";
			},
		);
	}

	return result;
}

/**
 * Check if a field value is "empty" in Anki's sense.
 * Empty = blank, whitespace-only, or contains only empty HTML tags (<br>, <div>, etc.)
 */
export function fieldIsEmpty(value: string): boolean {
	// Strip HTML tags
	let stripped = value.replace(/<[^>]*>/gi, "");
	// Strip &nbsp;
	stripped = stripped.replace(/&nbsp;/gi, "");
	// Strip whitespace
	stripped = stripped.trim();
	return stripped.length === 0;
}

/**
 * Derive CardType from note type metadata and template ordinal.
 */
export function deriveCardType(
	noteType: Pick<NoteType, "id" | "type">,
	templateOrd: number,
): CardType {
	if (noteType.id === BUILTIN_NOTE_REVIEW_ID) {
		return "note-review";
	}
	if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
		return "image-occlusion";
	}
	if (noteType.type === 1) {
		return "cloze";
	}
	if (templateOrd === 0) {
		return "basic";
	}
	return "reversed";
}
