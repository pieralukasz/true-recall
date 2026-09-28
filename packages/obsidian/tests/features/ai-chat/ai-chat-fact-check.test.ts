import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiChatController } from "@true-recall/obsidian/features/ai-chat/chat-controller";
import { suggestionsFor } from "@true-recall/obsidian/features/ai-chat/engine/chat-suggestions";
import { isFactCheckAvailable } from "@true-recall/obsidian/features/assistant/ui/fact-check";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

import {
	createTestContext,
	type TestContext,
} from "../../../../core/tests/persistence/sqlite/__setup__/test-database";
import { createMockChatPlugin, createMockChatResponse } from "./mocks";

describe("AI chat fact check suggestions", () => {
	let ctx: TestContext;
	let plugin: TrueRecallPlugin;
	beforeEach(async () => {
		ctx = await createTestContext();
		plugin = createMockChatPlugin(ctx);
	});
	afterEach(() => {
		ctx.close();
		vi.unstubAllGlobals();
	});

	it.each([
		"custom",
		"lmstudio",
	] as const)("hides fact checking for %s", (providerType) => {
		plugin.settings.providerType = providerType;
		plugin.settings.customModel = "local-model";
		plugin.settings.lmStudioModel = "local-model";
		const suggestions = suggestionsFor(
			{ card: { id: "c1" } },
			isFactCheckAvailable(plugin.settings),
		);
		expect(suggestions.some((s) => s.factCheck)).toBe(false);
		expect(suggestions.some((s) => s.label === "Make it clearer")).toBe(true);
	});

	it.each([
		"openrouter",
		"pro",
	] as const)("forces search on %s even when general web search is disabled", async (providerType) => {
		plugin.settings.providerType = providerType;
		plugin.settings.assistantWebSearch = false;
		plugin.settings.assistantMaxSources = 0;
		const fetch = vi
			.fn(async () => createMockChatResponse())
			.mockImplementationOnce(async () =>
				createMockChatResponse({
					name: "report_fact_check",
					args: {
						cardId: "c1",
						verdict: "unverifiable",
						confidence: "low",
						summary: "No usable sources.",
					},
				}),
			);
		vi.stubGlobal("activeWindow", { fetch });
		const controller = new AiChatController(plugin, async () => {});
		controller.setContext(controller.currentId, { card: { id: "c1" } });
		const suggestion = suggestionsFor(
			controller.current.context,
			isFactCheckAvailable(plugin.settings),
		).find((s) => s.factCheck);
		if (!suggestion) throw new Error("Missing fact check suggestion");
		await controller.send(controller.currentId, suggestion.prompt, {
			factCheck: suggestion.factCheck,
		});
		expect(controller.current.chat.error).toBeUndefined();
		expect(fetch).toHaveBeenCalledTimes(2);
		const request = fetch.mock.calls[0] as unknown as [unknown, RequestInit];
		const body = JSON.parse(String(request[1].body));
		expect(body.plugins).toEqual([{ id: "web", max_results: 5 }]);
		expect(body.tool_choice).toBe("required");
		controller.dispose();
	});

	it("blocks an existing fact check after switching to a provider without web search", async () => {
		const controller = new AiChatController(plugin, async () => {});
		const session = await controller.start({
			context: { card: { id: "c1" } },
			factCheck: true,
			reveal: false,
		});
		plugin.settings.providerType = "custom";
		plugin.settings.customModel = "local-model";
		const fetch = vi.fn();
		vi.stubGlobal("activeWindow", { fetch });
		await controller.send(session.id, "Check the facts");
		expect(session.chat.error?.message).toContain(
			"Fact checking needs web search",
		);
		expect(fetch).not.toHaveBeenCalled();
		controller.dispose();
	});
});
