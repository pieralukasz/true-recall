/**
 * tag: search against a real SQLite database: the LIKE patterns must match
 * whole tags in the space-separated notes.tags column.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseSearchQuery } from "../../../src/helpers/search-parser";
import { buildBrowserQuery } from "../../../src/services/browser/browser-query-builder";
import type { SortConfig } from "../../../src/types/browser.types";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "../../persistence/sqlite/__setup__/test-database";

const SORT: SortConfig = { column: "created_at", direction: "asc" };

describe("tag: search (SQLite)", () => {
	let ctx: TestContext;

	function addCard(id: string, tags: string): void {
		ctx.cards.set(id, createTestCard({ id }));
		const noteId = ctx.cards.getByIds([id])[0]?.noteId;
		if (!noteId) throw new Error(`no note for ${id}`);
		ctx.db.run("UPDATE notes SET tags = ? WHERE id = ?", [tags, noteId]);
	}

	function search(query: string): string[] {
		const sql = buildBrowserQuery(parseSearchQuery(query), SORT, 100, 0);
		return ctx.cards
			.browserQuery(sql.where, sql.params, sql.orderBy, sql.limit, sql.offset)
			.map((card) => card.id)
			.sort();
	}

	beforeEach(async () => {
		ctx = await createTestContext();
		addCard("leech", "leech");
		addCard("leech-and-bio", "biology leech");
		addCard("leechy", "leechy");
		addCard("med-child", "med::cardio");
		addCard("med", "med");
		addCard("snake", "a_b");
		addCard("none", "");
	});

	afterEach(() => ctx.close());

	it("matches whole tags only", () => {
		expect(search("tag:leech")).toEqual(["leech", "leech-and-bio"]);
	});

	it("is case-insensitive", () => {
		expect(search("tag:LEECH")).toEqual(["leech", "leech-and-bio"]);
	});

	it("matches child tags", () => {
		expect(search("tag:med")).toEqual(["med", "med-child"]);
		expect(search("tag:med::cardio")).toEqual(["med-child"]);
	});

	it("supports * as a wildcard", () => {
		expect(search("tag:leech*")).toEqual(["leech", "leech-and-bio", "leechy"]);
	});

	it("treats _ and % literally", () => {
		expect(search("tag:a_b")).toEqual(["snake"]);
		expect(search("tag:a%b")).toEqual([]);
	});

	it("excludes tags with -tag:", () => {
		expect(search("-tag:leech")).toEqual([
			"leechy",
			"med",
			"med-child",
			"none",
			"snake",
		]);
	});

	it("combines several tag: filters with AND", () => {
		expect(search("tag:leech tag:biology")).toEqual(["leech-and-bio"]);
	});
});
