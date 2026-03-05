/**
 * Incremental Block Format Parser for streaming AI responses.
 *
 * Processes text chunks as they arrive and emits events when blocks
 * are complete (#type/<slug> ... ---) or when partial content updates.
 */

import type { NoteType } from "@shared/types/note.types";
import type { ParsedBlock } from "@features/study/services/flashcard/block-parser.service";

export interface IncrementalParseEvent {
	type: "card_complete" | "partial_update";
	block?: ParsedBlock;
	partialQuestion?: string;
	partialAnswer?: string;
}

export type NoteTypeLookup = (slug: string) => NoteType | null;

const TYPE_TAG_RE = /^#type\/([a-z0-9-]+)$/;
const SOURCE_COMMENT_RE = /^<!--\s*source:\s*([\s\S]*?)\s*-->$/;
const BLOCK_SEPARATOR_RE = /^---\s*$/;

export class IncrementalFlashcardParser {
	private buffer = "";
	private currentSlug: string | null = null;
	private currentNoteType: NoteType | null = null;
	private blockLines: string[] = [];

	constructor(private getNoteType: NoteTypeLookup) {}

	feed(chunk: string): IncrementalParseEvent[] {
		this.buffer += chunk;
		return this.processBuffer(false);
	}

	finish(): IncrementalParseEvent[] {
		return this.processBuffer(true);
	}

	private processBuffer(isEnd: boolean): IncrementalParseEvent[] {
		const events: IncrementalParseEvent[] = [];
		const parts = this.buffer.split("\n");

		if (isEnd) {
			this.buffer = "";
		} else {
			this.buffer = parts.pop() ?? "";
		}

		for (const line of (isEnd ? parts : parts)) {
			const trimmed = line.trim();

			// Check for block separator
			if (BLOCK_SEPARATOR_RE.test(trimmed)) {
				const block = this.finalizeBlock();
				if (block) {
					events.push({ type: "card_complete", block });
				}
				continue;
			}

			// Check for new type tag
			const typeMatch = trimmed.match(TYPE_TAG_RE);
			if (typeMatch) {
				// Finalize any existing block first
				const prevBlock = this.finalizeBlock();
				if (prevBlock) {
					events.push({ type: "card_complete", block: prevBlock });
				}

				const slug = typeMatch[1]!;
				const noteType = this.getNoteType(slug);
				if (noteType) {
					this.currentSlug = slug;
					this.currentNoteType = noteType;
					this.blockLines = [];
				}
				continue;
			}

			// Accumulate lines for current block
			if (this.currentNoteType) {
				this.blockLines.push(line);
			}
		}

		// Finalize on end
		if (isEnd) {
			const block = this.finalizeBlock();
			if (block) {
				events.push({ type: "card_complete", block });
			}
		}

		// Emit partial update if we have content being built
		if (!isEnd && this.currentNoteType && this.blockLines.length > 0) {
			const partial = this.getPartialUpdate();
			if (partial) {
				events.push(partial);
			}
		}

		return events;
	}

	private finalizeBlock(): ParsedBlock | null {
		if (!this.currentNoteType || !this.currentSlug) return null;

		const noteTypeId = this.currentNoteType.id;
		const slug = this.currentSlug;
		const fieldNames = this.currentNoteType.fields;
		const { fields, sourceText } = this.parseFieldValues(this.blockLines, fieldNames);
		const hasContent = Object.values(fields).some((v) => v.trim().length > 0);

		this.currentSlug = null;
		this.currentNoteType = null;
		this.blockLines = [];

		if (!hasContent) return null;

		return { noteTypeId, noteTypeSlug: slug, fields, sourceText };
	}

	private parseFieldValues(
		lines: string[],
		fieldNames: string[],
	): { fields: Record<string, string>; sourceText?: string } {
		const fields: Record<string, string> = {};
		let sourceText: string | undefined;

		for (const name of fieldNames) {
			fields[name] = "";
		}

		const fieldSet = new Set(fieldNames);
		let currentField: string | null = null;
		const valueLines: string[] = [];

		const flushField = () => {
			if (currentField && fieldSet.has(currentField)) {
				fields[currentField] = valueLines.join("\n").trim();
			}
			valueLines.length = 0;
		};

		for (const line of lines) {
			const trimmed = line.trim();

			const sourceMatch = trimmed.match(SOURCE_COMMENT_RE);
			if (sourceMatch) {
				sourceText = sourceMatch[1]!.trim();
				continue;
			}

			const colonIdx = trimmed.indexOf(":");
			if (colonIdx > 0) {
				const candidate = trimmed.slice(0, colonIdx);
				if (fieldSet.has(candidate)) {
					flushField();
					currentField = candidate;
					valueLines.push(trimmed.slice(colonIdx + 1).trimStart());
					continue;
				}
			}

			if (currentField) {
				valueLines.push(line);
			}
		}

		flushField();

		return { fields, sourceText };
	}

	/**
	 * Build partial update from current block being built.
	 * Maps first field → partialQuestion, second field → partialAnswer
	 * for backward-compatible UI display.
	 */
	private getPartialUpdate(): IncrementalParseEvent | null {
		if (!this.currentNoteType) return null;

		const { fields } = this.parseFieldValues(
			this.blockLines,
			this.currentNoteType.fields,
		);

		const fieldNames = this.currentNoteType.fields;
		const firstField = fieldNames[0] ? fields[fieldNames[0]] : undefined;
		const secondField = fieldNames[1] ? fields[fieldNames[1]] : undefined;

		if (!firstField && !secondField) return null;

		return {
			type: "partial_update",
			partialQuestion: firstField?.trim() || undefined,
			partialAnswer: secondField?.trim() || undefined,
		};
	}
}
