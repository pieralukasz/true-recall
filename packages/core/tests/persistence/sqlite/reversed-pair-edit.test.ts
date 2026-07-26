import { describe, expect, it } from "vitest";

import { CardRepository } from "../../../src/flashcard/data/card-repository.service";
import { BUILTIN_BASIC_REVERSED_ID } from "../../../src/types/note.types";
import {
	createTestContext,
	createTestNote,
	insertNoteDirect,
} from "./__setup__/test-database";

function makeStoreFacade(ctx: Awaited<ReturnType<typeof createTestContext>>) {
	return {
		cards: ctx.cards,
		get: (id: string) => ctx.cards.get(id),
		set: (id: string, data: never) => ctx.cards.set(id, data),
		has: (id: string) => ctx.cards.has(id),
		getClozeSiblings: (uid: string, tpl: string) =>
			ctx.cards.getClozeSiblings(uid, tpl),
	} as never;
}

async function setupReversedPair() {
	const ctx = await createTestContext();
	const repo = new CardRepository(makeStoreFacade(ctx));

	insertNoteDirect(
		ctx.db,
		createTestNote({
			id: "note-1",
			noteTypeId: BUILTIN_BASIC_REVERSED_ID,
			fields: { Front: "capital of France?", Back: "Paris" },
		}),
	);
	const now = new Date().toISOString();
	for (const [id, ord] of [
		["orig-1", 0],
		["rev-1", 1],
	] as const) {
		ctx.db.run(
			`INSERT INTO cards (id, note_id, template_ord, due, created_at, updated_at) VALUES (?, 'note-1', ?, ?, ?, ?)`,
			[id, ord, now, Date.now(), Date.now()],
		);
	}
	return { ctx, repo };
}

describe("reversed pair edit (shared basic-reversed note)", () => {
	it("editing the original card keeps both orientations", async () => {
		const { ctx, repo } = await setupReversedPair();

		repo.updateContent("orig-1", "capital city of France?", "Paris");

		const orig = ctx.cards.get("orig-1");
		const rev = ctx.cards.get("rev-1");
		expect(orig?.question).toBe("capital city of France?");
		expect(orig?.answer).toBe("Paris");
		expect(rev?.question).toBe("Paris");
		expect(rev?.answer).toBe("capital city of France?");
		ctx.close();
	});

	it("editing the reversed card keeps both orientations", async () => {
		const { ctx, repo } = await setupReversedPair();

		// The reversed card renders question=Back, answer=Front
		repo.updateContent("rev-1", "Paris (city)", "capital of France?");

		const orig = ctx.cards.get("orig-1");
		const rev = ctx.cards.get("rev-1");
		expect(rev?.question).toBe("Paris (city)");
		expect(rev?.answer).toBe("capital of France?");
		expect(orig?.question).toBe("capital of France?");
		expect(orig?.answer).toBe("Paris (city)");
		ctx.close();
	});
});
