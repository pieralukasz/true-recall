import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChildCardActions } from "../../../src/persistence/sqlite/modules/ChildCardActions";
import {
	createTestCard,
	createTestContext,
	insertCardDirect,
	type TestContext,
} from "./__setup__/test-database";

describe("ChildCardActions", () => {
	let ctx: TestContext;
	let children: ChildCardActions;

	beforeEach(async () => {
		ctx = await createTestContext();
		children = new ChildCardActions(ctx.db as never);
	});

	afterEach(() => {
		ctx.close();
	});

	function seed(): void {
		insertCardDirect(ctx.cards, createTestCard({ id: "parent" }));
		insertCardDirect(ctx.cards, createTestCard({ id: "child-a" }));
		insertCardDirect(ctx.cards, createTestCard({ id: "child-b" }));
	}

	it("links children to a parent and lists them in creation order", () => {
		seed();
		children.link("child-a", "parent", 1);
		children.link("child-b", "parent", 2);

		expect(children.getParentId("child-a")).toBe("parent");
		expect(
			children.getLiveChildren("parent").map((c) => c.childCardId),
		).toEqual(["child-a", "child-b"]);
		expect(children.getParentIds()).toEqual(["parent"]);
	});

	it("drops a child the user deleted so it cannot block the group", () => {
		seed();
		children.link("child-a", "parent");
		ctx.cards.softDelete("child-a");

		expect(children.getLiveChildren("parent")).toEqual([]);
		// The parent is still listed, so the grader can restore it.
		expect(children.getParentIds()).toEqual(["parent"]);
	});

	it("forgets a deleted parent and every link of a dissolved group", () => {
		seed();
		children.link("child-a", "parent");
		children.link("child-b", "parent");
		children.unlinkParent("parent");
		expect(children.getParentIds()).toEqual([]);
		expect(children.getParentId("child-b")).toBeNull();

		children.link("child-a", "parent");
		ctx.cards.softDelete("parent");
		expect(children.getParentIds()).toEqual([]);
	});

	it("tracks graduation per child", () => {
		seed();
		children.link("child-a", "parent");
		children.markGraduated("child-a", 1234);

		const [child] = children.getLiveChildren("parent");
		expect(child?.graduatedAt).toBe(1234);
		// A second stamp must not move the original time.
		children.markGraduated("child-a", 9999);
		expect(children.getLiveChildren("parent")[0]?.graduatedAt).toBe(1234);
	});

	it("re-linking moves the child to another parent and clears graduation", () => {
		seed();
		insertCardDirect(ctx.cards, createTestCard({ id: "other-parent" }));
		children.link("child-a", "parent");
		children.markGraduated("child-a", 1);
		children.link("child-a", "other-parent", 2);

		expect(children.getParentId("child-a")).toBe("other-parent");
		expect(children.getLiveChildren("parent")).toEqual([]);
		expect(children.getLiveChildren("other-parent")[0]?.graduatedAt).toBeNull();
	});

	it("unlink removes the relation", () => {
		seed();
		children.link("child-a", "parent");
		children.unlink("child-a");

		expect(children.getParentId("child-a")).toBeNull();
		expect(children.getLiveChildren("parent")).toEqual([]);
	});

	it("remembers whether the group suspended the parent, also for later children", () => {
		seed();
		children.link("child-a", "parent", 1, false);
		expect(children.isParentSuspendedByChildren("parent")).toBe(false);
		children.unlinkParent("parent");

		children.link("child-a", "parent", 2, true);
		// The parent is suspended now, but by this group: a child added later
		// must not make the group forget that.
		children.link("child-b", "parent", 3, false);
		children.unlink("child-a", 4);
		expect(children.isParentSuspendedByChildren("parent")).toBe(true);
	});
});
