import { describe, expect, it } from "vitest";

import type {
	AssistantContext,
	AssistantProgressEvent,
} from "../../../src/ai/assistant/assistant.types";
import { AssistantAgent } from "../../../src/ai/assistant/assistant-agent";
import type { AssistantToolHost } from "../../../src/ai/assistant/assistant-tools";
import {
	FACT_CHECK_CORRECTION_GATE_MESSAGE,
	FACT_CHECK_UNCORROBORATED_NOTE,
} from "../../../src/ai/assistant/fact-check-tools";
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
	searchedUrls: string[] = [],
): ChatCompletionResponse {
	return {
		id: "r",
		choices: [
			{
				message: {
					role: "assistant",
					content: null,
					annotations: searchedUrls.map((url) => ({
						type: "url_citation",
						url_citation: { url },
					})),
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
		expect(requests[0]?.cache_control).toEqual({ type: "ephemeral" });
		expect(typeof requests[0]?.max_tokens).toBe("number");
		expect(requests[0]?.max_tokens ?? 0).toBeGreaterThan(0);
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

	it("includes recent thread turns in a follow-up request", async () => {
		const { client, requests } = makeScriptedClient([textResponse("done")]);
		await new AssistantAgent(client, { webSearch: false }).run(
			"Make it shorter",
			{
				conversation: [
					{ role: "user", content: "Create two cards about TCP" },
					{ role: "assistant", content: "Created 2 card drafts." },
				],
			},
			HOST,
		);

		const prompt = String(requests[0]?.messages[1]?.content);
		expect(prompt).toContain("RECENT CONVERSATION");
		expect(prompt).toContain("Create two cards about TCP");
		expect(prompt).toContain("INSTRUCTION:\nMake it shorter");
	});

	it("renders the review attempt with tutor guidance for a follow-up question", async () => {
		const { client, requests } = makeScriptedClient([textResponse("done")]);
		await new AssistantAgent(client, { webSearch: false }).run(
			"Why is my claim about UDP wrong?",
			{
				...CONTEXT,
				reviewAttempt: {
					typedAnswer: "TCP is connectionless",
					verdict: "wrong",
					teacherComment: "TCP is connection-oriented.",
					covered: ["transport layer"],
					missing: ["three-way handshake"],
					errors: ["connectionless claim"],
				},
			},
			HOST,
		);

		const prompt = String(requests[0]?.messages[1]?.content);
		expect(prompt).toContain("REVIEW ATTEMPT");
		expect(prompt).toContain("TCP is connectionless");
		expect(prompt).toContain("GRADING VERDICT: wrong");
		expect(prompt).toContain("MISSING: three-way handshake");
		expect(prompt).toContain("update_card");
		expect(prompt).toContain("INSTRUCTION:\nWhy is my claim about UDP wrong?");
	});

	it("omits grading lines when the review attempt has no verdict", async () => {
		const { client, requests } = makeScriptedClient([textResponse("done")]);
		await new AssistantAgent(client, { webSearch: false }).run(
			"What does this answer actually mean?",
			{ ...CONTEXT, reviewAttempt: { typedAnswer: "something vague" } },
			HOST,
		);

		const prompt = String(requests[0]?.messages[1]?.content);
		expect(prompt).toContain("REVIEW ATTEMPT");
		expect(prompt).toContain("something vague");
		expect(prompt).not.toContain("GRADING VERDICT");
	});

	it("proposes validated changes to an open draft without storing callbacks", async () => {
		const draftContext: AssistantContext = {
			draftCard: {
				sessionId: "draft-1",
				fields: { Front: "Long question", Back: "Long answer" },
				noteType: {
					id: "builtin-basic",
					name: "Basic",
					fields: ["Front", "Back"],
				},
				operation: "edit",
			},
		};
		const { client } = makeScriptedClient([
			toolCallResponse([
				{
					id: "t1",
					name: "update_draft",
					args: { fields: { Back: "Short", Unknown: "drop me" } },
				},
			]),
			textResponse("done"),
		]);
		const agent = new AssistantAgent(client, {
			maxIterations: 2,
			webSearch: false,
		});

		const manifest = await agent.run("shorten", draftContext, HOST);

		expect(manifest.proposals[0]).toEqual({
			id: expect.any(String),
			status: "proposed",
			type: "update_draft",
			sessionId: "draft-1",
			fields: { Back: "Short" },
			previousFields: { Front: "Long question", Back: "Long answer" },
		});
	});

	it("refines an existing draft workspace by stable proposal id", async () => {
		const context: AssistantContext = {
			draftWorkspace: {
				revision: 1,
				manifest: {
					proposals: [
						{
							id: "keep",
							status: "proposed",
							type: "create_card",
							noteTypeId: "builtin-basic",
							fields: { Front: "Q", Back: "Long answer" },
						},
						{
							id: "remove",
							status: "proposed",
							type: "create_card",
							noteTypeId: "builtin-basic",
							fields: { Front: "Duplicate", Back: "A" },
						},
					],
					citations: [],
				},
			},
		};
		const { client } = makeScriptedClient([
			toolCallResponse([
				{
					id: "t1",
					name: "update_proposal",
					args: { proposalId: "keep", fields: { Back: "Short" } },
				},
				{
					id: "t2",
					name: "remove_proposal",
					args: { proposalId: "remove" },
				},
			]),
			textResponse("Updated drafts."),
		]);
		const manifest = await new AssistantAgent(client, {
			maxIterations: 2,
			webSearch: false,
		}).run("Shorten the first and remove the second", context, HOST);

		expect(manifest.proposals).toHaveLength(1);
		expect(manifest.proposals[0]).toMatchObject({
			id: "keep",
			fields: { Front: "Q", Back: "Short" },
		});
	});

	it("accumulates token usage across iterations into the manifest", async () => {
		const events: AssistantProgressEvent[] = [];
		const r1 = {
			...toolCallResponse([
				{
					id: "t1",
					name: "create_cards",
					args: {
						noteTypeId: "builtin-basic",
						cards: [{ Front: "A?", Back: "B" }],
					},
				},
			]),
			usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
		};
		const r2: ChatCompletionResponse = {
			id: "r",
			choices: [
				{
					message: { role: "assistant", content: "done" },
					finish_reason: "stop",
				},
			],
			usage: { prompt_tokens: 130, completion_tokens: 10, total_tokens: 140 },
		};
		const { client } = makeScriptedClient([r1, r2]);
		const agent = new AssistantAgent(client, {
			maxIterations: 5,
			webSearch: false,
			onProgress: (event) => events.push(event),
		});

		const manifest = await agent.run("x", CONTEXT, HOST);

		expect(manifest.usage).toEqual({
			promptTokens: 230,
			completionTokens: 30,
			totalTokens: 260,
		});
		expect(events.filter((e) => e.kind === "usage")).toHaveLength(2);
	});

	it("omits usage from the manifest when the provider reports none", async () => {
		const { client } = makeScriptedClient([textResponse("done")]);
		const agent = new AssistantAgent(client, {
			maxSources: 0,
			webSearch: false,
		});

		const manifest = await agent.run("x", CONTEXT, HOST);

		expect(manifest.usage).toBeUndefined();
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

describe("AssistantAgent fact-check mode", () => {
	const EVIDENCE = [
		{ url: "https://docs.example/a", title: "Docs", quote: "Default is 5." },
	];
	const report = (id: string, verdict: string, evidence = EVIDENCE) => ({
		id,
		name: "report_fact_check",
		args: {
			verdict,
			confidence: "high",
			summary: "Checked the default value against the docs.",
			evidence,
		},
	});
	const lastToolMessage = (request: {
		messages: Array<{ role: string; content: unknown }>;
	}) => {
		const tool = [...request.messages]
			.reverse()
			.find((message) => message.role === "tool");
		return tool?.content;
	};

	it("forces web search, offers the fact check tools and records a confirmed verdict", async () => {
		const { client, requests } = makeScriptedClient([
			toolCallResponse([report("t1", "confirmed")], ["https://docs.example/b"]),
			textResponse("Confirmed."),
		]);
		const agent = new AssistantAgent(client, {
			maxIterations: 5,
			webSearch: false,
			factCheck: true,
		});
		const manifest = await agent.run("Fact-check this card", CONTEXT, HOST);

		expect(requests[0].plugins).toEqual([{ id: "web", max_results: 5 }]);
		const toolNames = requests[0].tools?.map((tool) => tool.function.name);
		expect(toolNames).toContain("report_fact_check");
		expect(toolNames).not.toContain("create_cards");
		expect(requests[0].messages[0].content).toContain("FACT CHECK MODE");

		expect(manifest.factCheck).toEqual({
			verdict: "confirmed",
			confidence: "high",
			summary: "Checked the default value against the docs.",
			evidence: EVIDENCE,
		});
		expect(manifest.citations.map((c) => c.url)).toContain(
			"https://docs.example/a",
		);
		expect(manifest.proposals).toHaveLength(0);
		expect(manifest.finalText).toBe("Confirmed.");
	});

	it("raises maxSources to at least 3 in fact-check mode", async () => {
		const { client, requests } = makeScriptedClient([
			toolCallResponse([report("t1", "confirmed")]),
			textResponse("ok"),
		]);
		const agent = new AssistantAgent(client, {
			maxSources: 1,
			factCheck: true,
		});
		await agent.run("check", CONTEXT, HOST);
		expect(requests[0].plugins).toEqual([{ id: "web", max_results: 3 }]);
	});

	it("records a correction after an incorrect verdict", async () => {
		const { client } = makeScriptedClient([
			toolCallResponse(
				[
					report("t1", "incorrect"),
					{
						id: "t2",
						name: "update_card",
						args: { cardId: "card-1", fields: { Back: "6" } },
					},
				],
				["https://www.docs.example/other"],
			),
			textResponse("Proposed a fix."),
		]);
		const agent = new AssistantAgent(client, { factCheck: true });
		const manifest = await agent.run("check", CONTEXT, HOST);

		expect(manifest.factCheck?.verdict).toBe("incorrect");
		expect(manifest.proposals).toHaveLength(1);
		expect(manifest.proposals[0]).toMatchObject({
			type: "update_card",
			cardId: "card-1",
			fields: { Back: "6" },
		});
	});

	it("refuses update_card before a negative verdict", async () => {
		const { client, requests } = makeScriptedClient([
			toolCallResponse([
				{
					id: "t1",
					name: "update_card",
					args: { cardId: "card-1", fields: { Back: "6" } },
				},
			]),
			toolCallResponse([report("t2", "confirmed")]),
			toolCallResponse([
				{
					id: "t3",
					name: "update_card",
					args: { cardId: "card-1", fields: { Back: "7" } },
				},
			]),
			textResponse("done"),
		]);
		const agent = new AssistantAgent(client, { factCheck: true });
		const manifest = await agent.run("check", CONTEXT, HOST);

		expect(lastToolMessage(requests[1])).toBe(
			FACT_CHECK_CORRECTION_GATE_MESSAGE,
		);
		expect(lastToolMessage(requests[3])).toBe(
			FACT_CHECK_CORRECTION_GATE_MESSAGE,
		);
		expect(manifest.proposals).toHaveLength(0);
	});

	it("rejects a verdict without evidence and falls back to unverifiable when none is recorded", async () => {
		const { client, requests } = makeScriptedClient([
			toolCallResponse([report("t1", "confirmed", [])]),
			textResponse("I could not find sources."),
		]);
		const agent = new AssistantAgent(client, { factCheck: true });
		const manifest = await agent.run("check", CONTEXT, HOST);

		expect(String(lastToolMessage(requests[1]))).toContain(
			"at least one source",
		);
		expect(manifest.factCheck).toEqual({
			verdict: "unverifiable",
			confidence: "low",
			summary: "I could not find sources.",
			evidence: [],
		});
	});

	it("fills a fallback verdict when the model never reports one", async () => {
		const { client } = makeScriptedClient([textResponse("Looks fine.")]);
		const agent = new AssistantAgent(client, { factCheck: true });
		const manifest = await agent.run("check", CONTEXT, HOST);

		expect(manifest.factCheck).toEqual({
			verdict: "unverifiable",
			confidence: "low",
			summary: "Looks fine.",
			evidence: [],
		});
	});

	it("does not expose or accept report_fact_check outside fact-check mode", async () => {
		const { client, requests } = makeScriptedClient([
			toolCallResponse([report("t1", "confirmed")]),
			textResponse("done"),
		]);
		const agent = new AssistantAgent(client, { webSearch: true });
		const manifest = await agent.run("check", CONTEXT, HOST);

		const toolNames = requests[0].tools?.map((tool) => tool.function.name);
		expect(toolNames).not.toContain("report_fact_check");
		expect(lastToolMessage(requests[1])).toBe(
			"Unknown tool: report_fact_check",
		);
		expect(manifest.factCheck).toBeUndefined();
	});

	it("downgrades confidence when no evidence host appears in the search results", async () => {
		const { client } = makeScriptedClient([
			toolCallResponse(
				[report("t1", "confirmed")],
				["https://elsewhere.example/x"],
			),
			textResponse("Confirmed."),
		]);
		const agent = new AssistantAgent(client, { factCheck: true });
		const manifest = await agent.run("check", CONTEXT, HOST);

		expect(manifest.factCheck?.verdict).toBe("confirmed");
		expect(manifest.factCheck?.confidence).toBe("low");
		expect(manifest.factCheck?.summary).toContain(
			FACT_CHECK_UNCORROBORATED_NOTE,
		);
	});

	it("keeps an unverifiable verdict untouched by corroboration", async () => {
		const { client } = makeScriptedClient([
			toolCallResponse([report("t1", "unverifiable", [])]),
			textResponse("Opinion."),
		]);
		const agent = new AssistantAgent(client, { factCheck: true });
		const manifest = await agent.run("check", CONTEXT, HOST);

		expect(manifest.factCheck).toMatchObject({
			verdict: "unverifiable",
			confidence: "high",
		});
		expect(manifest.factCheck?.summary).not.toContain(
			FACT_CHECK_UNCORROBORATED_NOTE,
		);
	});

	it("shows the earlier verdict to follow-up turns and does not overwrite it", async () => {
		const { client, requests } = makeScriptedClient([
			textResponse("Because the docs say so."),
		]);
		const agent = new AssistantAgent(client, { factCheck: true });
		const previous = {
			verdict: "confirmed" as const,
			confidence: "high" as const,
			summary: "Checked.",
			evidence: EVIDENCE,
		};
		const manifest = await agent.run(
			"why?",
			{
				...CONTEXT,
				draftWorkspace: {
					revision: 1,
					manifest: { proposals: [], citations: [], factCheck: previous },
				},
			},
			HOST,
		);

		expect(requests[0].messages[1].content).toContain("CURRENT FACT CHECK");
		expect(requests[0].messages[1].content).toContain(
			"Confirmed (high confidence)",
		);
		expect(requests[0].messages[1].content).toContain("https://docs.example/a");
		expect(manifest.factCheck).toEqual(previous);
		expect(manifest.finalText).toBe("Because the docs say so.");
	});
});
