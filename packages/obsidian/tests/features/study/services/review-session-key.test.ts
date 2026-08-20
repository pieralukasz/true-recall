import { describe, expect, it } from "vitest";

import {
	createReviewSessionKey,
	createReviewSessionLabel,
} from "@true-recall/obsidian/features/study/services/review-session-key";

const CARDS = [
	{ sourceUid: "uid-a", sourceNoteName: "Alpha" },
	{ sourceUid: "uid-b", sourceNoteName: "Beta" },
];

describe("createReviewSessionKey", () => {
	it("identifies the same note launched from the dashboard and panel", () => {
		const dashboardKey = createReviewSessionKey(
			{ mode: "notes", noteNames: ["Alpha"] },
			CARDS,
		);
		const panelKey = createReviewSessionKey(
			{ mode: "note", sourceUid: "uid-a" },
			CARDS,
		);

		expect(dashboardKey).toBe(panelKey);
	});

	it("is independent of note selection order", () => {
		const first = createReviewSessionKey(
			{ mode: "notes", noteNames: ["Alpha", "Beta"] },
			CARDS,
		);
		const second = createReviewSessionKey(
			{ mode: "notes", noteNames: ["Beta", "Alpha"] },
			CARDS,
		);

		expect(first).toBe(second);
	});

	it("keeps different note and project launchers separate", () => {
		const alpha = createReviewSessionKey(
			{ mode: "note", sourceUid: "uid-a" },
			CARDS,
		);
		const beta = createReviewSessionKey(
			{ mode: "note", sourceUid: "uid-b" },
			CARDS,
		);
		const project = createReviewSessionKey(
			{ mode: "project", projectPath: "Projects/A.md" },
			CARDS,
		);

		expect(alpha).not.toBe(beta);
		expect(alpha).not.toBe(project);
	});

	it("keeps a temporary custom deck stable when its queue is rebuilt", () => {
		const first = createReviewSessionKey(
			{
				mode: "custom",
				temporaryDeckId: "deck-1",
				materializedCardIds: ["card-1"],
			},
			CARDS,
		);
		const rebuilt = createReviewSessionKey(
			{
				mode: "custom",
				temporaryDeckId: "deck-1",
				materializedCardIds: ["card-2", "card-3"],
			},
			CARDS,
		);

		expect(first).toBe(rebuilt);
	});

	it("does not treat the requested R-Mode size as a second launcher", () => {
		const small = createReviewSessionKey(
			{ mode: "project", projectPath: "Projects/A.md", rModeTargetCount: 10 },
			CARDS,
		);
		const large = createReviewSessionKey(
			{ mode: "project", projectPath: "Projects/A.md", rModeTargetCount: 50 },
			CARDS,
		);

		expect(small).toBe(large);
	});
});

describe("createReviewSessionLabel", () => {
	it("uses the note name for dashboard and panel launchers", () => {
		expect(
			createReviewSessionLabel({ mode: "notes", noteNames: ["Alpha"] }, CARDS),
		).toBe("Alpha");
		expect(
			createReviewSessionLabel({ mode: "note", sourceUid: "uid-a" }, CARDS),
		).toBe("Alpha");
	});

	it.each([
		["today", { mode: "all_due" } as const, "Today"],
		[
			"project",
			{ mode: "project", projectPath: "Projects/Physics.md" } as const,
			"Project: Physics",
		],
		["created today", { mode: "created_today" } as const, "Created today"],
		["overdue", { mode: "overdue" } as const, "Overdue"],
	])("labels a %s launcher", (_name, config, expected) => {
		expect(createReviewSessionLabel(config, CARDS)).toBe(expected);
	});

	it("uses the persisted Custom Study deck name", () => {
		const label = createReviewSessionLabel(
			{ mode: "custom", temporaryDeckId: "deck-1" },
			CARDS,
			{ customDeckName: "Forgotten cards — Alpha" },
		);

		expect(label).toBe("Forgotten cards — Alpha");
	});
});
