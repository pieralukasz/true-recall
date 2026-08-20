import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import type { FSRSCardData } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import {
	BuryCommand,
	UnburyCommand,
} from "@true-recall/obsidian/commands/commands/card-bury.cmd";

function makeCard(overrides: Partial<FSRSCardData> = {}): FSRSCardData {
	return {
		id: "card-1",
		due: "2026-01-10T00:00:00.000Z",
		stability: 5,
		difficulty: 6,
		reps: 1,
		lapses: 0,
		state: State.Review,
		lastReview: "2026-01-05T00:00:00.000Z",
		scheduledDays: 5,
		learningStep: 0,
		...overrides,
	};
}

function makeCtx(cards: FSRSCardData[]): CommandContext {
	const fsrsByCard = new Map(cards.map((c) => [c.id, c]));

	return {
		flashcardManager: {
			updateCardFSRS: vi.fn((id: string, fsrs: FSRSCardData) => {
				fsrsByCard.set(id, fsrs);
				return true;
			}),
		} as unknown as CommandContext["flashcardManager"],
		cardStore: {
			get: vi.fn((id: string) => fsrsByCard.get(id)),
		} as unknown as CommandContext["cardStore"],
		sessionPersistence: {} as unknown as CommandContext["sessionPersistence"],
	};
}

describe("BuryCommand", () => {
	it("sets the bury boundary on every card", () => {
		const ctx = makeCtx([makeCard({ id: "a" }), makeCard({ id: "b" })]);
		const until = "2026-01-20T04:00:00.000Z";

		new BuryCommand(["a", "b"], until).execute(ctx);

		expect(ctx.cardStore.get("a")?.buriedUntil).toBe(until);
		expect(ctx.cardStore.get("b")?.buriedUntil).toBe(until);
	});

	it("describes a single card and a batch differently", () => {
		expect(new BuryCommand(["a"], "2026-01-20").description).toBe("Bury card");
		expect(new BuryCommand(["a", "b"], "2026-01-20").description).toBe(
			"Bury 2 cards",
		);
	});
});

describe("UnburyCommand", () => {
	const now = new Date("2026-01-15T10:00:00.000Z");

	it("moves the bury boundary into the past", () => {
		const ctx = makeCtx([
			makeCard({ id: "a", buriedUntil: "2026-01-20T04:00:00.000Z" }),
		]);

		new UnburyCommand(["a"], now).execute(ctx);

		const buriedUntil = ctx.cardStore.get("a")?.buriedUntil;
		expect(buriedUntil).toBe(now.toISOString());
		expect(new Date(buriedUntil ?? "") > now).toBe(false);
	});

	it("restores the original bury boundary on undo", () => {
		const original = "2026-01-20T04:00:00.000Z";
		const ctx = makeCtx([makeCard({ id: "a", buriedUntil: original })]);
		const cmd = new UnburyCommand(["a"], now);

		cmd.execute(ctx);
		cmd.undo(ctx);

		expect(ctx.cardStore.get("a")?.buriedUntil).toBe(original);
	});

	it("skips card ids that are not in the store", () => {
		const ctx = makeCtx([makeCard({ id: "a", buriedUntil: "2026-01-20" })]);

		new UnburyCommand(["a", "missing"], now).execute(ctx);

		expect(ctx.flashcardManager.updateCardFSRS).toHaveBeenCalledTimes(1);
		expect(ctx.cardStore.get("missing")).toBeUndefined();
	});

	it("uses the unburied mutation type so panel counts refresh", () => {
		expect(new UnburyCommand(["a"], now).mutationType).toBe("card:unburied");
		expect(new UnburyCommand(["a"], now).description).toBe("Unbury card");
	});
});
