import { describe, expect, it, vi } from "vitest";

import type { TrueRecallClient } from "../client.js";
import { hintsFor } from "../tools/_hints.js";
import { cardTools } from "../tools/card-tools.js";

const list = cardTools.find((t) => t.name === "list_card_edits")!;
const perCard = cardTools.find((t) => t.name === "get_card_edit_history")!;
describe("history shared CLI/MCP definitions", () => {
	it("preserves and encodes the exact card identifier without trimming", async () => {
		const get = vi.fn(async (_path: string) => ({ total: 0, events: [] }));
		await perCard.handle({ card_id: " a/b " }, {
			get,
		} as unknown as TrueRecallClient);
		expect(get).toHaveBeenCalledWith(
			"/cards/%20a%2Fb%20/edit-history?limit=50&offset=0",
		);
	});
	it.each([
		{ since: "2026-02-30" },
		{ since: "2026-10-10T10:00:00" },
		{ since: "2026-10-10", until: "2026-10-10" },
		{ edit_source: "remote" },
		{ limit: 201 },
		{ offset: -1 },
	])("rejects invalid history inputs before reaching the API: %j", async (params) => {
		const get = vi.fn();
		await expect(
			list.handle(params, { get } as unknown as TrueRecallClient),
		).rejects.toThrow();
		expect(get).not.toHaveBeenCalled();
	});
	it.each([
		{},
		{ card_id: "" },
		{ card_id: " " },
	])("requires a nonblank card ID: %j", async (params) => {
		const get = vi.fn();
		await expect(
			perCard.handle(params, { get } as unknown as TrueRecallClient),
		).rejects.toThrow();
		expect(get).not.toHaveBeenCalled();
	});
	it("has read-only hints and no SQL dependency", async () => {
		expect(hintsFor(list.name)).toMatchObject({
			readOnlyHint: true,
			openWorldHint: false,
		});
		expect(hintsFor(perCard.name)).toMatchObject({
			readOnlyHint: true,
			openWorldHint: false,
		});
		const get = vi.fn(async (_path: string) => ({ total: 0, events: [] }));
		await list.handle(
			{ edit_source: "system", source_uid: "a/b", since: "2026-10-10" },
			{ get } as unknown as TrueRecallClient,
		);
		const url = new URL(get.mock.calls[0]![0], "http://localhost");
		expect(url.pathname).toBe("/card-edits");
		expect(url.searchParams.get("edit_source")).toBe("system");
		expect(url.searchParams.get("since")).toBe("2026-10-10");
	});
});
