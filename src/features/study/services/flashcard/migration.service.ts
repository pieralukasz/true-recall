/**
 * Migrates inline `Front :: Back` flashcard lines in notes to the new block format.
 *
 * For each note containing inline flashcards:
 * 1. Detect `Front :: Back` and standalone cloze lines
 * 2. Convert to block format (#type/basic, #type/cloze, etc.)
 * 3. Replace the old lines in the note content
 */

import { blockToText } from "@features/study/services/flashcard/block-parser.service";
import {
	CLOZE_DETECT,
	INLINE_SEPARATOR_RE,
} from "@features/study/services/flashcard/parsing-patterns";
import { BUILTIN_BASIC_ID, BUILTIN_CLOZE_ID } from "@shared/types/note.types";
import type { App } from "obsidian";

export interface MigrationResult {
	migratedFiles: number;
	migratedCards: number;
	errors: string[];
}

/**
 * Migrate a single note's content from :: format to block format.
 * Returns the transformed content, or null if no changes were needed.
 */
export function migrateContent(content: string): string | null {
	const lines = content.split("\n");
	const result: string[] = [];
	let changed = false;

	// Skip YAML frontmatter
	let inFrontmatter = false;
	let frontmatterDone = false;
	let lineIndex = 0;

	if (lines[0]?.trim() === "---") {
		inFrontmatter = true;
		result.push(lines[0]);
		lineIndex = 1;
	}

	for (; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex]!;
		const trimmed = line.trim();

		if (inFrontmatter && !frontmatterDone) {
			result.push(line);
			if (trimmed === "---") {
				frontmatterDone = true;
				inFrontmatter = false;
			}
			continue;
		}

		// Already block format — skip
		if (trimmed.startsWith("#type/")) {
			result.push(line);
			continue;
		}

		// Try :: separator
		const colonMatch = trimmed.match(INLINE_SEPARATOR_RE);
		if (colonMatch) {
			const front = colonMatch[1]?.trim();
			const back = colonMatch[2]?.trim();
			if (front && back) {
				const isCloze = CLOZE_DETECT.test(front);
				if (isCloze) {
					result.push(
						`${blockToText(
							{
								noteTypeId: BUILTIN_CLOZE_ID,
								noteTypeSlug: "cloze",
								fields: { Text: front, Extra: back },
							},
							["Text", "Extra"],
						)}\n---`,
					);
				} else {
					result.push(
						`${blockToText(
							{
								noteTypeId: BUILTIN_BASIC_ID,
								noteTypeSlug: "basic",
								fields: { Front: front, Back: back },
							},
							["Front", "Back"],
						)}\n---`,
					);
				}
				changed = true;
				continue;
			}
		}

		// Standalone cloze line
		if (CLOZE_DETECT.test(trimmed) && trimmed.length > 0) {
			result.push(
				`${blockToText(
					{
						noteTypeId: BUILTIN_CLOZE_ID,
						noteTypeSlug: "cloze",
						fields: { Text: trimmed, Extra: "" },
					},
					["Text", "Extra"],
				)}\n---`,
			);
			changed = true;
			continue;
		}

		result.push(line);
	}

	return changed ? result.join("\n") : null;
}

/**
 * Migrate all notes in the vault from :: format to block format.
 */
export async function migrateVault(app: App): Promise<MigrationResult> {
	const mdFiles = app.vault.getMarkdownFiles();
	let migratedFiles = 0;
	let migratedCards = 0;
	const errors: string[] = [];

	for (const file of mdFiles) {
		try {
			const content = await app.vault.read(file);
			const migrated = migrateContent(content);
			if (migrated !== null) {
				// Count how many blocks we created
				const blockCount = (migrated.match(/#type\//g) ?? []).length;
				await app.vault.modify(file, migrated);
				migratedFiles++;
				migratedCards += blockCount;
			}
		} catch (err) {
			errors.push(
				`${file.path}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	return { migratedFiles, migratedCards, errors };
}
