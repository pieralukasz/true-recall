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
		expect(children.getLiveChildren("parent").map((c) => c.childCardId)).toEqual([
			"child-a",
			"child-b",
		]);
		expect(children.getParentIds()).toEqual(["parent"]);
	});

	it("drops a child the user deleted so it cannot block the group", () => {
		seed();
		children.link("child-a", "parent");
		ctx.cards.softDelete("child-a");

		expect(children.getLiveChildren("parent")).toEqual([]);
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
});
