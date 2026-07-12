import { describe, expect, it } from "vitest";

import type { AssistantContext } from "../../../src/ai/assistant/assistant.types";
import { AssistantAgent } from "../../../src/ai/assistant/assistant-agent";
import type { AssistantToolHost } from "../../../src/ai/assistant/assistant-tools";
import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
} from "../../../src/ai/clients/openrouter-client";

const HOST: AssistantToolHost = {
	listNoteTypes: () => [
		{ id: "builtin-basic", name: "Basic", fields: ["Front", "Back"] },
	],
	getCardFields: (cardId) =>
		cardId === "card-1"
			? {
					noteId: "note-1",
					noteTypeId: "builtin-basic",
					fields: { Front: "Q?", Back: "" },
				}
			: null,
	getRelatedCards: () => [
		{ noteType: "Basic", fields: { Front: "R?", Back: "A" } },
	],
	readNote: async (path) => (path === "Topic.md" ? "# Topic" : null),
	searchImages: async () => [{ url: "https://img/1.jpg", title: "one" }],
};

const CONTEXT: AssistantContext = {
	selectedText: "odbiornik",
	card: {
		cardId: "card-1",
		noteId: "note-1",
		question: "Q?",
		answer: "",
		sourceUid: "uid-1",
	},
};

function toolCallResponse(
	calls: Array<{ id: string; name: string; args: unknown }>,
): ChatCompletionResponse {
	return {
		id: "r",
		choices: [
			{
				message: {
					role: "assistant",
					content: null,
					tool_calls: calls.map((c) => ({
						id: c.id,
						type: "function" as const,
						function: { name: c.name, arguments: JSON.stringify(c.args) },
					})),
				},
				finish_reason: "tool_calls",
			},
		],
	};
}

function textResponse(text: string): ChatCompletionResponse {
	return {
		id: "r",
		choices: [
			{
				message: {
					role: "assistant",
					content: text,
					annotations: [
						{
							type: "url_citation",
							url_citation: { url: "https://src.example", title: "Src" },
						},
					],
				},
				finish_reason: "stop",
			},
		],
	};
}

function makeScriptedClient(responses: ChatCompletionResponse[]) {
	const requests: ChatCompletionRequest[] = [];
	let i = 0;
	return {
		requests,
		client: {
			chat: async (request: ChatCompletionRequest) => {
				requests.push(request);
				const response = responses[Math.min(i, responses.length - 1)];
				i += 1;
				return response;
			},
		},
	};
}

describe("AssistantAgent", () => {
	it("executes tool calls, records proposals and citations, stops on text answer", async () => {
		const { client, requests } = makeScriptedClient([
			toolCallResponse([
				{
					id: "t1",
					name: "create_cards",
					args: {
						noteTypeId: "builtin-basic",
						cards: [
							{ Front: "Czym jest **[[odbiornik]]**?", Back: "urządzenie" },
						],
					},
				},
				{
					id: "t2",
					name: "update_card",
					args: { cardId: "card-1", fields: { Back: "prąd" } },
				},
			]),
			textResponse("Proposed 1 card and 1 fill."),
		]);
		const agent = new AssistantAgent(client, {
			maxIterations: 5,
			webSearch: true,
		});
		const manifest = await agent.run("uzupełnij", CONTEXT, HOST);

		expect(manifest.proposals).toHaveLength(2);
		expect(manifest.proposals[0]).toMatchObject({
			type: "create_card",
			status: "proposed",
			noteTypeId: "builtin-basic",
		});
		expect(manifest.proposals[1]).toMatchObject({
			type: "update_card",
			cardId: "card-1",
			noteId: "note-1",
			fields: { Back: "prąd" },
			previousFields: { Front: "Q?", Back: "" },
		});
		expect(manifest.citations).toEqual([
			{ url: "https://src.example", title: "Src" },
		]);
		expect(manifest.finalText).toBe("Proposed 1 card and 1 fill.");
		expect(requests[0]?.plugins).toEqual([{ id: "web", max_results: 5 }]);
		const toolMessages =
			requests[1]?.messages.filter((m) => m.role === "tool") ?? [];
		expect(toolMessages).toHaveLength(2);
	});

	it("passes and enforces maxSources for web citations", async () => {
		const { client, requests } = makeScriptedClient([
			{
				id: "r",
				choices: [
					{
						message: {
							role: "assistant",
							content: "done",
							annotations: [
								{
									type: "url_citation",
									url_citation: { url: "https://src-1.example" },
								},
								{
									type: "url_citation",
									url_citation: { url: "https://src-2.example" },
								},
								{
									type: "url_citation",
									url_citation: { url: "https://src-3.example" },
								},
							],
						},
						finish_reason: "stop",
					},
				],
			},
		]);
		const agent = new AssistantAgent(client, {
			maxSources: 2,
			webSearch: true,
		});

		const manifest = await agent.run("research", CONTEXT, HOST);

		expect(requests[0]?.plugins).toEqual([{ id: "web", max_results: 2 }]);
		expect(manifest.citations).toEqual([
			{ url: "https://src-1.example" },
			{ url: "https://src-2.example" },
		]);
	});

	it("does not enable web plugin when maxSources is 0", async () => {
		const { client, requests } = makeScriptedClient([textResponse("done")]);
		const agent = new AssistantAgent(client, {
			maxSources: 0,
			webSearch: true,
		});

		const manifest = await agent.run("research", CONTEXT, HOST);

		expect(requests[0]?.plugins).toBeUndefined();
		expect(manifest.citations).toEqual([]);
	});

	it("returns an error string to the model for unknown cards", async () => {
		const { client, requests } = makeScriptedClient([
			toolCallResponse([
				{
					id: "t1",
					name: "update_card",
					args: { cardId: "missing", fields: { Back: "x" } },
				},
			]),
			textResponse("done"),
		]);
		const agent = new AssistantAgent(client, {
			maxIterations: 5,
			webSearch: false,
		});
		const manifest = await agent.run("x", CONTEXT, HOST);
		expect(manifest.proposals).toHaveLength(0);
		const toolMsg = requests[1]?.messages.find((m) => m.role === "tool");
		expect(String(toolMsg?.content)).toContain("not found");
	});

	it("stops at maxIterations and keeps collected proposals", async () => {
		const { client } = makeScriptedClient([
			toolCallResponse([
				{
					id: "t1",
					name: "create_cards",
					args: {
						noteTypeId: "builtin-basic",
						cards: [{ Front: "A?", Back: "B" }],
					},
				},
			]),
		]);
		const agent = new AssistantAgent(client, {
			maxIterations: 3,
			webSearch: false,
		});
		const manifest = await agent.run("x", CONTEXT, HOST);
		expect(manifest.proposals.length).toBe(3);
	});
});
