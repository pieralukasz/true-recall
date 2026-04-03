import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import {
	BUILTIN_NOTE_REVIEW_ID,
	type Note,
} from "@true-recall/core/types/note.types";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export class NoteReviewService {
	constructor(private store: SqliteStoreService) {}

	has(sourceUid: string): boolean {
		return this.findNote(sourceUid) !== null;
	}

	findNote(sourceUid: string): Note | null {
		const notes = this.store.notes.getBySourceUid(sourceUid);
		return notes.find((n) => n.noteTypeId === BUILTIN_NOTE_REVIEW_ID) ?? null;
	}

	static stripFrontmatter(content: string): string {
		const match = content.match(FRONTMATTER_RE);
		return match ? content.slice(match[0].length) : content;
	}
}
