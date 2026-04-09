import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NoteReviewService } from "../../../src/services/note-review/note-review.service";
import { BUILTIN_NOTE_REVIEW_ID } from "../../../src/types/note.types";
import {
	createTestContext,
	createTestNote,
	insertNoteDirect,
	type TestContext,
} from "../../persistence/sqlite/__setup__/test-database";

// ── stripFrontmatter / splitFrontmatter (pure functions) ─────

describe("NoteReviewService.stripFrontmatter", () => {
	it("strips standard YAML frontmatter", () => {
		const input = `---\ntags:\n  - test\n---\n# Hello\nBody text`;
		expect(NoteReviewService.stripFrontmatter(input)).toBe(
			"# Hello\nBody text",
		);
	});

	it("returns content as-is when no frontmatter", () => {
		const input = "# No frontmatter\nJust content";
		expect(NoteReviewService.stripFrontmatter(input)).toBe(input);
	});

	it("handles empty string", () => {
		expect(NoteReviewService.stripFrontmatter("")).toBe("");
	});

	it("handles frontmatter with complex fields", () => {
		const input = `---\ntags:\n  - "#mind/zettel"\nflashcard_uid: 19bc06a0\nsource:\n  - "[[Writing Blog Post]]"\naliases:\ncreated: "[[2026-01-15 (Thursday)]]"\nparents:\n  - "[[Life & Habits]]"\n---\nContent here`;
		expect(NoteReviewService.stripFrontmatter(input)).toBe("Content here");
	});

	it("handles frontmatter followed by blank line", () => {
		const input = "---\nkey: value\n---\n\n# Title";
		const result = NoteReviewService.stripFrontmatter(input);
		expect(result).toBe("\n# Title");
	});

	it("handles Windows line endings (CRLF)", () => {
		const input = "---\r\nkey: value\r\n---\r\nContent";
		expect(NoteReviewService.stripFrontmatter(input)).toBe("Content");
	});
});

describe("NoteReviewService.splitFrontmatter", () => {
	it("splits frontmatter and body", () => {
		const input = "---\nkey: value\n---\nBody";
		const { frontmatter, body } = NoteReviewService.splitFrontmatter(input);
		expect(frontmatter).toBe("---\nkey: value\n---\n");
		expect(body).toBe("Body");
	});

	it("returns empty frontmatter when none present", () => {
		const input = "Just body content";
		const { frontmatter, body } = NoteReviewService.splitFrontmatter(input);
		expect(frontmatter).toBe("");
		expect(body).toBe("Just body content");
	});

	it("roundtrips: frontmatter + body === original", () => {
		const input = "---\ntags:\n  - test\n---\n# Hello\nBody";
		const { frontmatter, body } = NoteReviewService.splitFrontmatter(input);
		expect(frontmatter + body).toBe(input);
	});
});

// ── has / findNote (database integration) ─────────────────────

describe("NoteReviewService (database)", () => {
	let ctx: TestContext;
	let service: NoteReviewService;

	beforeEach(async () => {
		ctx = await createTestContext();
		service = new NoteReviewService({ notes: ctx.notes } as never);
	});

	afterEach(() => ctx.close());

	it("has returns false when no note-review exists", () => {
		expect(service.has("uid-abc")).toBe(false);
	});

	it("has returns true after inserting a note-review note", () => {
		insertNoteDirect(
			ctx.db,
			createTestNote({
				noteTypeId: BUILTIN_NOTE_REVIEW_ID,
				sourceUid: "uid-abc",
				fields: { Content: "" },
			}),
		);
		expect(service.has("uid-abc")).toBe(true);
	});

	it("findNote returns the correct note", () => {
		const note = createTestNote({
			noteTypeId: BUILTIN_NOTE_REVIEW_ID,
			sourceUid: "uid-xyz",
			fields: { Content: "" },
		});
		insertNoteDirect(ctx.db, note);

		const found = service.findNote("uid-xyz");
		expect(found).not.toBeNull();
		expect(found?.id).toBe(note.id);
		expect(found?.noteTypeId).toBe(BUILTIN_NOTE_REVIEW_ID);
	});

	it("findNote ignores non-note-review notes with same sourceUid", () => {
		insertNoteDirect(
			ctx.db,
			createTestNote({
				noteTypeId: "builtin-basic",
				sourceUid: "uid-shared",
				fields: { Front: "Q", Back: "A" },
			}),
		);
		expect(service.findNote("uid-shared")).toBeNull();
	});

	it("findNote ignores soft-deleted note-review notes", () => {
		const note = createTestNote({
			noteTypeId: BUILTIN_NOTE_REVIEW_ID,
			sourceUid: "uid-deleted",
			fields: { Content: "" },
		});
		insertNoteDirect(ctx.db, note);
		ctx.db.run("UPDATE notes SET deleted_at = ? WHERE id = ?", [
			Date.now(),
			note.id,
		]);

		expect(service.findNote("uid-deleted")).toBeNull();
		expect(service.has("uid-deleted")).toBe(false);
	});
});
