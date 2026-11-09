import { describe, expect, it, vi } from "vitest";

import { ChildCardGrader } from "../../../src/features/child-cards/ChildCardGrader";

vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => ({ success: vi.fn() }),
}));

type Link = { parent: string; graduatedAt: number | null; linked: boolean };

/** In-memory stand-in for the card store pieces the grader touches. */
function setup(enabled = true) {
	const suspended = new Set<string>(["parent"]);
	const deleted = new Set<string>();
	const links = new Map<string, Link>();
	const ratings = new Map<string, number[]>();
	const handlers = new Map<string, (payload: never) => void>();

	const live = (parent: string) =>
		[...links.entries()]
			.filter(([id, l]) => l.linked && l.parent === parent && !deleted.has(id))
			.map(([id, l]) => ({ childCardId: id, graduatedAt: l.graduatedAt }));

	const store = {
		childCards: {
			getParentId: (id: string) => {
				const l = links.get(id);
				return l?.linked ? l.parent : null;
			},
			getLiveChildren: live,
			getParentIds: () => [
				...new Set(
					[...links.values()]
						.filter((l) => l.linked && !deleted.has(l.parent))
						.map((l) => l.parent),
				),
			],
			unlink: (id: string) => {
				const l = links.get(id);
				if (l) l.linked = false;
			},
			unlinkParent: (parent: string) => {
				for (const l of links.values()) if (l.parent === parent) l.linked = false;
			},
			markGraduated: (id: string) => {
				const l = links.get(id);
				if (l) l.graduatedAt ??= 1;
			},
		},
		cards: {
			getByIds: (ids: string[]) =>
				ids.map((id) => ({ id, suspended: suspended.has(id) })),
			bulkSuspend: (ids: string[]) => ids.forEach((id) => suspended.add(id)),
			bulkUnsuspend: (ids: string[]) =>
				ids.forEach((id) => suspended.delete(id)),
			softDeleteWithCascade: (id: string) => deleted.add(id),
		},
		stats: {
			getCardReviewHistory: (id: string, n: number) =>
				(ratings.get(id) ?? []).slice(-n).map((r) => ({ r })),
		},
	};
	const plugin = {
		settings: { childCardsEnabled: enabled, childGoodStreak: 2 },
		cardStore: store,
		register: () => {},
		coreApp: {
			events: {
				on: (name: string, fn: (payload: never) => void) => {
					handlers.set(name, fn);
					return () => {};
				},
			},
		},
	};
	const grader = new ChildCardGrader(plugin as never);
	const child = (id: string) =>
		links.set(id, { parent: "parent", graduatedAt: null, linked: true });
	const emit = (name: string, payload: object) =>
		handlers.get(name)?.(payload as never);
	return { grader, suspended, deleted, links, ratings, child, emit };
}

describe("ChildCardGrader", () => {
	it("restores the parent when the last open child is deleted by hand", () => {
		const t = setup();
		t.child("a");
		t.child("b");
		t.grader.attach();
		t.ratings.set("a", [3, 3]);
		t.emit("card:reviewed", { cardId: "a" });
		expect(t.suspended.has("parent")).toBe(true);

		t.emit("card:removed", { cardIds: ["b"] });
		expect(t.suspended.has("parent")).toBe(false);
	});

	it("repairs a parent stranded by an undone child on load", () => {
		const t = setup();
		t.child("a");
		t.deleted.add("a");
		t.grader.attach();
		expect(t.suspended.has("parent")).toBe(false);
	});

	it("brings parents back when the feature is switched off", () => {
		const t = setup(false);
		t.child("a");
		t.grader.attach();
		expect(t.suspended.has("parent")).toBe(false);
		expect(t.links.get("a")?.linked).toBe(false);
	});

	it("keeps graduated children and their review history", () => {
		const t = setup();
		t.child("a");
		t.grader.attach();
		t.ratings.set("a", [4, 3]);
		t.emit("card:reviewed", { cardId: "a" });
		expect(t.suspended.has("parent")).toBe(false);
		expect(t.suspended.has("a")).toBe(true);
		expect(t.deleted.has("a")).toBe(false);
	});
});
