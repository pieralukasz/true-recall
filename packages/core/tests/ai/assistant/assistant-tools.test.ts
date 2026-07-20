import { describe, expect, it } from "vitest";

import { ASSISTANT_TOOLS } from "../../../src/ai/assistant/assistant-tools";

describe("ASSISTANT_TOOLS", () => {
	it("declares the Assistant tools with JSON-schema parameters", () => {
		const names = ASSISTANT_TOOLS.map((t) => t.function.name);
		expect(names).toEqual([
			"create_cards",
			"update_proposal",
			"remove_proposal",
			"update_card",
			"update_draft",
			"append_to_note",
			"create_note",
			"insert_diagram",
			"search_images",
			"search_knowledge",
			"read_note",
			"get_related_cards",
		]);
		for (const tool of ASSISTANT_TOOLS) {
			expect(tool.type).toBe("function");
			expect(tool.function.parameters).toHaveProperty("type", "object");
		}
	});
});
