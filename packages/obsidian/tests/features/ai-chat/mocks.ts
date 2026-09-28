import { vi } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import { NoteCreationService } from "@true-recall/core/flashcard/note-creation.service";
import { AiChatActions } from "@true-recall/core/persistence/sqlite/modules/AiChatActions";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import type { TestContext } from "../../../../core/tests/persistence/sqlite/__setup__/test-database";

export function createMockChatPlugin(ctx: TestContext): TrueRecallPlugin {
	const store = {
		...ctx,
		set: ctx.cards.set.bind(ctx.cards),
		aiChats: new AiChatActions(ctx.db as never),
	} as unknown as SqliteStoreService;
	const creation = new NoteCreationService(() => store, vi.fn());
	return {
		settings: {
			...DEFAULT_SETTINGS,
			proKey: "test-pro",
			openRouterApiKey: "test-key",
		},
		app: { workspace: { getActiveFile: () => null } },
		cardStore: store,
		flashcardManager: {
			createNote: creation.createNote.bind(creation),
			updateNoteFields: (id: string, fields: Record<string, string>) =>
				ctx.notes.update(id, { fields }),
		},
	} as unknown as TrueRecallPlugin;
}

/** A local SSE response in the provider's wire format; no model or network involved. */
export function createMockChatResponse(toolCall?: {
	name: string;
	args: unknown;
}): Response {
	const delta = toolCall
		? {
				role: "assistant",
				tool_calls: [
					{
						index: 0,
						id: "call-1",
						type: "function",
						function: {
							name: toolCall.name,
							arguments: JSON.stringify(toolCall.args),
						},
					},
				],
			}
		: { role: "assistant", content: "Done." };
	const chunks = [
		{ id: "response-1", choices: [{ index: 0, delta, finish_reason: null }] },
		{
			id: "response-1",
			choices: [
				{
					index: 0,
					delta: {},
					finish_reason: toolCall ? "tool_calls" : "stop",
				},
			],
		},
	];
	return new Response(
		`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`,
		{
			headers: { "content-type": "text/event-stream" },
		},
	);
}
