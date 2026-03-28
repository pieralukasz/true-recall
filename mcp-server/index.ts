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
import { registerRagTools } from "./tools/rag-tools.js";
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
			"AUTO-INJECTED CONTEXT: If you see 'True Recall live context:' in the conversation, you ALREADY have the user's current state.",
			"Do NOT call get_full_context — the data is already there. Use it directly.",
			"If no live context is present (Obsidian not running), call get_full_context as your first tool.",
			"",
			"DISAMBIGUATING USER INTENT: The live context includes both activeNote and reviewSession simultaneously.",
			"'this card' / 'this flashcard' / 'nie rozumiem' → refers to reviewSession.currentCard",
			"'this note' / 'this file' / 'ta notatka' → refers to activeNote",
			"'what am I looking at' → describe both if both are present",
			"If ambiguous, ask which one they mean.",
			"",
			"ANSWER PRIVACY: When isAnswerRevealed is false, the user has NOT seen the answer yet.",
			"Do NOT reveal, paraphrase, or hint at the answer. Discuss only the question side.",
			"Ask the user what they think first. Only discuss the answer after the user asks to see it or you call reveal_answer.",
			"",
			"REVIEW FLOW: During an active review session, use these tools in order:",
			"1. Read the live context (auto-injected) — see the current card's question",
			"2. Discuss the question with the user, help them think through it",
			"3. reveal_answer — when the user wants to see the answer (flips the card in Obsidian UI too)",
			"4. grade_review_card — when the user is ready to rate (advances to the next card in the session)",
			"Use grade_review_card (not grade_card) during active sessions — it advances the session and updates the UI.",
			"",
			"TOOL TIPS: Only call get_active_note when you need the full markdown content of the note.",
			"get_due_cards and list_cards can return 100k+ characters — prefer live context for counts.",
			"",
			"KNOWLEDGE BASE (Pro only): When the user asks about a topic, call search_knowledge FIRST to find relevant notes and flashcards.",
			"Results include FSRS mastery data — use it to understand what the user knows well vs what needs work.",
			"If search_knowledge returns 'Pro subscription required', the user is on the free/BYOK tier.",
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
registerRagTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
