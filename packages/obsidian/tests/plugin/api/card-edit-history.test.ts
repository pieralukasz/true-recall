import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "../../../../core/tests/persistence/sqlite/__setup__/test-database";
import type {
	ApiContext,
	ApiRequest,
	ApiResponseWriter,
} from "../../../src/plugin/api/api.types";
import { dispatch } from "../../../src/plugin/api/routes";

describe("history API with SQL endpoint disabled", () => {
	let ctx: TestContext;
	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-10T10:00:00Z"));
		ctx = await createTestContext();
		ctx.cards.set("card", createTestCard({ id: "card", question: "Before" }));
		ctx.cards.updateCardContent("card", "After", "Answer");
	});
	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});
	async function get(url: string) {
		let status = 0,
			body = "";
		const req: ApiRequest = {
			url,
			method: "GET",
			headers: { authorization: "Bearer test" },
			on: () => {},
			destroy: () => {},
		};
		const res: ApiResponseWriter = {
			writeHead: (code) => {
				status = code;
			},
			end: (data) => {
				body = data ?? "";
			},
		};
		const api: ApiContext = {
			apiToken: "test",
			plugin: {
				settings: { apiAllowedOrigins: [], apiEnableSqlQuery: false },
				isStoreReady: () => true,
				cardStore: { getSqliteDb: () => ctx.db },
			} as unknown as ApiContext["plugin"],
		};
		await dispatch(req, res, api);
		return { status, ...JSON.parse(body) };
	}
	it.each([
		"/card-edits?since=2026-02-30",
		"/card-edits?until=2026-10-10T10:00:00",
		"/card-edits?since=2026-10-10&until=2026-10-10",
		"/card-edits?edit_source=remote",
		"/card-edits?limit=201",
		"/card-edits?offset=-1",
		"/cards/%20/edit-history",
		"/cards/%ZZ/edit-history",
	])("rejects invalid inputs without changing content: %s", async (url) => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await get(url)).status).toBe(400);
		expect(ctx.cards.get("card")?.question).toBe("After");
		expect(ctx.db.query("SELECT id FROM card_edit_history")).toHaveLength(1);
		vi.restoreAllMocks();
	});
	it("returns not found for an unknown card", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await get("/cards/unknown/edit-history")).status).toBe(404);
		vi.restoreAllMocks();
	});
	it("returns actual before/after through dedicated read routes", async () => {
		const global = await get("/card-edits?edit_source=manual");
		expect(global.status).toBe(200);
		expect(global.data).toMatchObject({
			total: 1,
			count: 1,
			events: [
				{
					source: "manual",
					fieldsBefore: { Front: "Before" },
					fieldsAfter: { Front: "After" },
				},
			],
		});
		const card = await get("/cards/card/edit-history");
		expect(card.status).toBe(200);
		expect(card.data).toMatchObject({
			cardId: "card",
			current: { question: "After" },
		});
	});
});
