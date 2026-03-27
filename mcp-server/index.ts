#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TrueRecallClient } from "./client.js";
import { registerBackupTools } from "./tools/backup-tools.js";
import { registerCardTools } from "./tools/card-tools.js";
import { registerContextTools } from "./tools/context-tools.js";
import { registerDashboardTools } from "./tools/dashboard-tools.js";
import { registerFsrsTools } from "./tools/fsrs-tools.js";
import { registerGenerateTools } from "./tools/generate-tools.js";
import { registerNavigationTools } from "./tools/navigation-tools.js";
import { registerNoteTools } from "./tools/note-tools.js";
import { registerQueryTools } from "./tools/query-tools.js";
import { registerReviewTools } from "./tools/review-tools.js";
import { registerSessionTools } from "./tools/session-tools.js";
import { registerStatsTools } from "./tools/stats-tools.js";

const port = process.env.TRUE_RECALL_PORT
	? Number(process.env.TRUE_RECALL_PORT)
	: 27182;

const client = new TrueRecallClient(port);

const server = new McpServer(
	{
		name: "true-recall",
		version: "1.0.0",
	},
	{
		instructions: [
			"TOOL SELECTION: Always call get_full_context FIRST before any other True Recall tool.",
			"It returns the user's current state in one lightweight call: active view, review session with current card, active note, today's stats, due count.",
			"Only call get_active_note when you need full note markdown content.",
			"Never call get_due_cards just to check what's due — get_full_context already includes the due count.",
			"",
			"ANSWER PRIVACY: When the response includes isAnswerRevealed: false, the user has NOT seen the answer yet.",
			"Do NOT reveal, paraphrase, or hint at the answer. Discuss only the question side.",
			"Ask the user what they think first. Only discuss the answer after the user asks to see it or you call reveal_answer.",
			"",
			"REVIEW FLOW: During an active review session, use these tools in order:",
			"1. get_full_context — see the current card's question (answer hidden if not revealed)",
			"2. Discuss the question with the user, help them think through it",
			"3. reveal_answer — when the user wants to see the answer (flips the card in Obsidian UI too)",
			"4. grade_review_card — when the user is ready to rate (advances to the next card in the session)",
			"Use grade_review_card (not grade_card) during active sessions — it advances the session and updates the UI.",
			"",
			"LARGE RESPONSES: get_due_cards and list_cards can return 100k+ characters and may exceed the output limit.",
			"Prefer get_full_context for overview data. Use get_due_cards only when you actually need the card list.",
		].join("\n"),
	},
);

registerContextTools(server, client);
registerCardTools(server, client);
registerReviewTools(server, client);
registerGenerateTools(server, client);
registerSessionTools(server, client);
registerDashboardTools(server, client);
registerFsrsTools(server, client);
registerNavigationTools(server, client);
registerNoteTools(server, client);
registerBackupTools(server, client);
registerStatsTools(server, client);
registerQueryTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
