import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { ReviewService } from "../../../src/services/review/review.service";
import type { CardSchedulingMeta } from "../../../src/types";
import { createMockCard } from "../../mocks/fsrs.mocks";

function makeMeta(
	id: string,
	opts: { cardType?: string; noteId?: string } = {},
): CardSchedulingMeta {
	return {
		id,
		fsrs: createMockCard({ id, state: State.Review }),
		cardType: opts.cardType as CardSchedulingMeta["cardType"],
		noteId: opts.noteId,
	};
}

function ioCard(id: string, noteId: string): CardSchedulingMeta {
	return makeMeta(id, { cardType: "image-occlusion", noteId });
}

function clozeCard(id: string, noteId: string): CardSchedulingMeta {
	return makeMeta(id, { cardType: "cloze", noteId });
}

function basicCard(id: string): CardSchedulingMeta {
	return makeMeta(id);
}

describe("spaceSiblings", () => {
	const svc = new ReviewService();

	it("returns empty array unchanged", () => {
		expect(svc.spaceSiblings([])).toEqual([]);
	});

	it("returns single card unchanged", () => {
		const queue = [basicCard("a")];
		expect(svc.spaceSiblings(queue)).toEqual(queue);
	});

	it("returns two cards unchanged (below threshold)", () => {
		const queue = [basicCard("a"), basicCard("b")];
		expect(svc.spaceSiblings(queue)).toEqual(queue);
	});

	it("returns queue with no siblings unchanged", () => {
		const queue = [basicCard("a"), basicCard("b"), basicCard("c")];
		expect(svc.spaceSiblings(queue)).toEqual(queue);
	});

	it("spaces IO siblings apart", () => {
		const queue = [
			ioCard("io-1", "note-a"),
			ioCard("io-2", "note-a"),
			ioCard("io-3", "note-a"),
			basicCard("b1"),
			basicCard("b2"),
			basicCard("b3"),
		];

		const result = svc.spaceSiblings(queue);
		const ids = result.map((c) => c.id);

		// IO siblings should not be adjacent
		for (let i = 0; i < ids.length - 1; i++) {
			const currentIsIo = ids[i]?.startsWith("io-");
			const nextIsIo = ids[i + 1]?.startsWith("io-");
			if (currentIsIo && nextIsIo) {
				throw new Error(
					`IO siblings adjacent at positions ${i} and ${i + 1}: ${ids.join(", ")}`,
				);
			}
		}

		// All cards should be present
		expect(result).toHaveLength(queue.length);
	});

	it("spaces cloze siblings apart", () => {
		const queue = [
			clozeCard("c-1", "note-b"),
			clozeCard("c-2", "note-b"),
			clozeCard("c-3", "note-b"),
			basicCard("b1"),
			basicCard("b2"),
			basicCard("b3"),
		];

		const result = svc.spaceSiblings(queue);

		// Cloze siblings from same note should not be adjacent
		for (let i = 0; i < result.length - 1; i++) {
			const a = result[i];
			const b = result[i + 1];
			if (a && b && a.noteId === "note-b" && b.noteId === "note-b") {
				throw new Error(
					`Cloze siblings adjacent at positions ${i} and ${i + 1}`,
				);
			}
		}

		expect(result).toHaveLength(queue.length);
	});

	it("handles mixed IO and cloze groups independently", () => {
		const queue = [
			ioCard("io-1", "note-io"),
			ioCard("io-2", "note-io"),
			clozeCard("cl-1", "note-cl"),
			clozeCard("cl-2", "note-cl"),
			basicCard("b1"),
			basicCard("b2"),
			basicCard("b3"),
			basicCard("b4"),
		];

		const result = svc.spaceSiblings(queue);
		expect(result).toHaveLength(queue.length);

		// Verify no same-group siblings are adjacent
		for (let i = 0; i < result.length - 1; i++) {
			const a = result[i];
			const b = result[i + 1];
			if (!a || !b) continue;
			const keyA =
				a.cardType === "image-occlusion"
					? `io:${a.noteId}`
					: a.cardType === "cloze"
						? `cloze:${a.noteId}`
						: null;
			const keyB =
				b.cardType === "image-occlusion"
					? `io:${b.noteId}`
					: b.cardType === "cloze"
						? `cloze:${b.noteId}`
						: null;
			if (keyA && keyB && keyA === keyB) {
				throw new Error(
					`Siblings adjacent at ${i}/${i + 1}: ${result.map((c) => c.id).join(", ")}`,
				);
			}
		}
	});

	it("handles queue where all cards are siblings", () => {
		const queue = [
			ioCard("io-1", "note-x"),
			ioCard("io-2", "note-x"),
			ioCard("io-3", "note-x"),
		];

		const result = svc.spaceSiblings(queue);

		// All cards should still be present
		expect(result).toHaveLength(3);
		expect(new Set(result.map((c) => c.id))).toEqual(
			new Set(["io-1", "io-2", "io-3"]),
		);
	});

	it("preserves basic cards not involved in sibling groups", () => {
		const queue = [
			basicCard("b1"),
			ioCard("io-1", "note-a"),
			basicCard("b2"),
			ioCard("io-2", "note-a"),
			basicCard("b3"),
		];

		const result = svc.spaceSiblings(queue);
		expect(result).toHaveLength(5);

		const basicIds = result
			.filter((c) => !c.cardType || c.cardType === "basic")
			.map((c) => c.id);
		expect(basicIds).toEqual(["b1", "b2", "b3"]);
	});

	it("does not modify queue when siblings are already spaced", () => {
		const queue = [
			ioCard("io-1", "note-a"),
			basicCard("b1"),
			basicCard("b2"),
			basicCard("b3"),
			ioCard("io-2", "note-a"),
			basicCard("b4"),
			basicCard("b5"),
			basicCard("b6"),
			ioCard("io-3", "note-a"),
		];

		const result = svc.spaceSiblings(queue);
		const ids = result.map((c) => c.id);

		// Already spaced — order should be preserved
		expect(ids).toEqual(queue.map((c) => c.id));
	});
});
