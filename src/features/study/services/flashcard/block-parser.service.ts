/**
 * Block Format Parser
 *
 * Parses the unified block format for all card types:
 *
 * #type/<slug>
 * Front: What is X?
 * Back: X is...
 * <!-- source: exact quote -->
 * ---
 *
 * Each block starts with #type/<slug>, contains FieldName: value pairs
 * (field names come from the NoteType), and ends at --- or EOF.
 */

import type { NoteType } from "@shared/types/note.types";

export interface ParsedBlock {
	noteTypeId: string;
	noteTypeSlug: string;
	fields: Record<string, string>;
	sourceText?: string;
	alwaysTypeIn?: boolean;
}

export type NoteTypeLookup = (slug: string) => NoteType | null;

const TYPE_TAG_RE = /^#type\/([a-z0-9-]+)$/;
const SOURCE_COMMENT_RE = /^<!--\s*source:\s*([\s\S]*?)\s*-->$/;
const BLOCK_SEPARATOR_RE = /^---\s*$/;
const ALWAYS_TYPE_IN_TOKEN = "@typein";

/**
 * Parse content containing block-format flashcards.
 * Returns parsed blocks and content with blocks stripped.
 */
export function parseBlocks(
	content: string,
	getNoteType: NoteTypeLookup,
): { blocks: ParsedBlock[]; contentWithoutBlocks: string } {
	const lines = content.split(/\r?\n/);
	const blocks: ParsedBlock[] = [];
	const nonBlockLines: string[] = [];

	// Skip YAML frontmatter
	let startIdx = 0;
	if (lines[0]?.trim() === "---") {
		let fmEnd = -1;
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i] ?? "";
			if (BLOCK_SEPARATOR_RE.test(line.trim())) {
				fmEnd = i;
				break;
			}
		}
		if (fmEnd > 0) {
			for (let i = 0; i <= fmEnd; i++) {
				nonBlockLines.push(lines[i] ?? "");
			}
			startIdx = fmEnd + 1;
		}
	}

	// Scan line-by-line: #type/<slug> starts a block, --- ends it
	let i = startIdx;
	while (i < lines.length) {
		const currentLine = lines[i] ?? "";
		const trimmed = currentLine.trim();
		const typeMatch = trimmed.match(TYPE_TAG_RE);

		if (typeMatch) {
			// Potential block start — collect lines until --- or EOF
			const blockLines: string[] = [];
			const blockStart = i;
			i++; // skip the #type line
			while (
				i < lines.length &&
				!BLOCK_SEPARATOR_RE.test((lines[i] ?? "").trim())
			) {
				blockLines.push(lines[i] ?? "");
				i++;
			}
			// i now points at --- or past EOF

			const matchedType = typeMatch[1];
			if (!matchedType) continue;
			const slug = matchedType;
			const noteType = getNoteType(slug);
			if (noteType) {
				const { fields, sourceText, alwaysTypeIn } = parseFieldValues(
					blockLines,
					noteType.fields,
				);
				const hasContent = Object.values(fields).some(
					(v) => v.trim().length > 0,
				);
				if (hasContent) {
					blocks.push({
						noteTypeId: noteType.id,
						noteTypeSlug: slug,
						fields,
						sourceText,
						alwaysTypeIn,
					});
					// Skip the --- separator if present
					if (i < lines.length) i++;
					continue;
				}
			}

			// Not a valid block — put lines back as non-block content
			for (let j = blockStart; j < i; j++) {
				nonBlockLines.push(lines[j] ?? "");
			}
			// Skip the --- separator if present
			if (i < lines.length) i++;
		} else if (BLOCK_SEPARATOR_RE.test(currentLine.trim())) {
			// Standalone --- not preceded by a block — preserve it
			nonBlockLines.push(currentLine);
			i++;
		} else {
			nonBlockLines.push(currentLine);
			i++;
		}
	}

	return {
		blocks,
		contentWithoutBlocks: nonBlockLines
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim(),
	};
}

/**
 * Parse FieldName: value pairs from lines.
 * Only field names belonging to the given NoteType are recognized as boundaries.
 * Multi-line values accumulate until the next field or end of block.
 */
function parseFieldValues(
	lines: string[],
	fieldNames: string[],
): {
	fields: Record<string, string>;
	sourceText?: string;
	alwaysTypeIn?: boolean;
} {
	const fields: Record<string, string> = {};
	let sourceText: string | undefined;
	let alwaysTypeIn = false;

	for (const name of fieldNames) {
		fields[name] = "";
	}

	// Build a set and regex for field detection
	const fieldSet = new Set(fieldNames);
	let currentField: string | null = null;
	const valueLines: string[] = [];

	function flushField() {
		if (currentField && fieldSet.has(currentField)) {
			fields[currentField] = valueLines.join("\n").trim();
		}
		valueLines.length = 0;
	}

	for (const line of lines) {
		const trimmed = line.trim();

		const sourceMatch = trimmed.match(SOURCE_COMMENT_RE);
		if (sourceMatch) {
			sourceText = sourceMatch[1]?.trim();
			continue;
		}
		if (trimmed === ALWAYS_TYPE_IN_TOKEN) {
			alwaysTypeIn = true;
			continue;
		}

		const fieldMatch = matchFieldStart(trimmed, fieldSet);
		if (fieldMatch) {
			flushField();
			currentField = fieldMatch.fieldName;
			// The rest of the line after "FieldName:" is the start of the value
			valueLines.push(fieldMatch.value);
		} else if (currentField) {
			valueLines.push(line);
		}
		// Lines before any field is matched are ignored (e.g., blank lines after #type tag)
	}

	flushField();

	return { fields, sourceText, alwaysTypeIn: alwaysTypeIn || undefined };
}

/**
 * Check if a line starts with a recognized field name followed by `:`.
 * Returns the field name and remaining value, or null.
 */
function matchFieldStart(
	trimmed: string,
	fieldSet: Set<string>,
): { fieldName: string; value: string } | null {
	const colonIdx = trimmed.indexOf(":");
	if (colonIdx <= 0) return null;

	const candidate = trimmed.slice(0, colonIdx);
	if (fieldSet.has(candidate)) {
		return {
			fieldName: candidate,
			value: trimmed.slice(colonIdx + 1).trimStart(),
		};
	}
	return null;
}

// ── Serialization: ParsedBlock → block format text ──────

export function blockToText(block: ParsedBlock, fieldNames: string[]): string {
	const lines: string[] = [`#type/${block.noteTypeSlug}`];

	for (const name of fieldNames) {
		const value = block.fields[name] ?? "";
		if (value.includes("\n")) {
			lines.push(`${name}:`);
			lines.push(value);
		} else {
			lines.push(`${name}: ${value}`);
		}
	}

	if (block.sourceText) {
		lines.push(`<!-- source: ${block.sourceText} -->`);
	}
	if (block.alwaysTypeIn) {
		lines.push(ALWAYS_TYPE_IN_TOKEN);
	}

	return lines.join("\n");
}

export function blocksToText(
	blocks: ParsedBlock[],
	getFieldNames: (noteTypeId: string) => string[],
): string {
	return blocks
		.map((b) => blockToText(b, getFieldNames(b.noteTypeId)))
		.join("\n---\n");
}

/**
 * Count how many valid blocks exist in content.
 */
export function countBlocks(
	content: string,
	getNoteType: NoteTypeLookup,
): number {
	return parseBlocks(content, getNoteType).blocks.length;
}
