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
} from "@features/study/services/flashcard/cloze-parser.service";
import type { CardType } from "@shared/types";
import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	type NoteType,
} from "@shared/types/note.types";

const NESTED_CLOZE_PATTERN = /\{\{c\d+::.*\{\{c/;

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
	working = working.replace(/\{\{\s*edit:(\w+)\s*\}\}/g, "{{$1}}");

	// 2. Strip {{FrontSide}} — True Recall's review UI shows Q/A separately
	working = working.replace(/\{\{\s*FrontSide\s*\}\}/g, "");

	// 3. Replace {{cloze:FieldName}}
	working = working.replace(
		/\{\{\s*cloze:(\w+)\s*\}\}/g,
		(_match, fieldName: string) => {
			const fieldValue = context.fields[fieldName];
			if (fieldValue === undefined) return _match;

			const idx = context.clozeIndex ?? 0;
			const isAnswer = context.frontSide !== undefined;

			// Use nested-aware parser when field contains nested clozes
			if (NESTED_CLOZE_PATTERN.test(fieldValue)) {
				return renderClozeNested(fieldValue, idx, isAnswer);
			}

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
		/\{\{\s*(\w+)\s*\}\}/g,
		(_match, fieldName: string) => {
			if (fieldName in context.fields) {
				const idx = fieldPlaceholders.length;
				fieldPlaceholders.push(context.fields[fieldName]!);
				return `\x00FIELD_${idx}\x00`;
			}
			return _match; // Unknown field — leave unreplaced
		},
	);

	// Restore field values (already protected from re-processing by placeholders)
	for (let i = 0; i < fieldPlaceholders.length; i++) {
		working = working.replace(`\x00FIELD_${i}\x00`, fieldPlaceholders[i]!);
	}

	// Restore HTML comments
	for (let i = 0; i < commentPlaceholders.length; i++) {
		working = working.replace(
			`\x00COMMENT_${i}\x00`,
			commentPlaceholders[i]!,
		);
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
			/\{\{([#^])\s*(\w+)\s*\}\}((?:(?!\{\{[#^])[\s\S])*?)\{\{\/\s*(\w+)\s*\}\}/g,
			(_match, type: string, openField: string, content: string, closeField: string) => {
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
 * Brace-depth-aware cloze renderer for handling nested clozes like
 * {{c1::outer {{c2::inner}}}}. Falls back to simple regex for flat clozes.
 */
function renderClozeNested(
	text: string,
	targetIndex: number,
	isAnswer: boolean,
): string {
	let result = "";
	let i = 0;

	while (i < text.length) {
		// Look for cloze start: {{cN::
		if (text.startsWith("{{c", i)) {
			const parsed = parseClozeAt(text, i);
			if (parsed) {
				if (parsed.index === targetIndex) {
					if (isAnswer) {
						const inner = renderClozeNested(
							parsed.content,
							targetIndex,
							isAnswer,
						);
						result += `**${inner}**`;
					} else {
						result += parsed.hint ? `[${parsed.hint}]` : "[...]";
					}
				} else {
					// Reveal this cloze, recursively process inner clozes
					result += renderClozeNested(
						parsed.content,
						targetIndex,
						isAnswer,
					);
				}
				i = parsed.endPos;
				continue;
			}
		}
		result += text[i];
		i++;
	}

	return result;
}

interface ParsedCloze {
	index: number;
	content: string;
	hint?: string;
	endPos: number;
}

/**
 * Parse a cloze marker at position `start` in `text`, handling nested braces.
 * Returns null if not a valid cloze at this position.
 */
function parseClozeAt(text: string, start: number): ParsedCloze | null {
	// Must start with {{c
	if (!text.startsWith("{{c", start)) return null;

	let j = start + 3;
	// Parse digits
	const digitStart = j;
	while (j < text.length && text[j]! >= "0" && text[j]! <= "9") j++;
	if (j === digitStart) return null;
	const index = parseInt(text.slice(digitStart, j), 10);

	// Must have ::
	if (!text.startsWith("::", j)) return null;
	j += 2;

	// Find matching }} counting brace depth
	const contentStart = j;
	let depth = 1;
	let firstHintSep = -1;

	while (j < text.length && depth > 0) {
		if (text.startsWith("{{", j)) {
			depth++;
			j += 2;
		} else if (text.startsWith("}}", j)) {
			depth--;
			if (depth === 0) break;
			j += 2;
		} else if (
			text.startsWith("::", j) &&
			depth === 1 &&
			firstHintSep === -1
		) {
			firstHintSep = j;
			j += 2;
		} else {
			j++;
		}
	}

	if (depth !== 0) return null;

	let content: string;
	let hint: string | undefined;

	if (firstHintSep !== -1) {
		content = text.slice(contentStart, firstHintSep);
		hint = text.slice(firstHintSep + 2, j);
	} else {
		content = text.slice(contentStart, j);
	}

	return { index, content, hint, endPos: j + 2 }; // +2 for the closing }}
}

/**
 * Derive CardType from note type metadata and template ordinal.
 */
export function deriveCardType(
	noteType: Pick<NoteType, "id" | "type">,
	templateOrd: number,
): CardType {
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
