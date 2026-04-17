#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TrueRecallClient } from "./client.js";
import { registerTools } from "./tools/_register.js";
import { backupTools } from "./tools/backup-tools.js";
import { cardTools } from "./tools/card-tools.js";
import { contextTools } from "./tools/context-tools.js";
import { dashboardTools } from "./tools/dashboard-tools.js";
import { fsrsTools } from "./tools/fsrs-tools.js";
import { generateTools } from "./tools/generate-tools.js";
import { navigationTools } from "./tools/navigation-tools.js";
import { noteTools } from "./tools/note-tools.js";
import { presetTools } from "./tools/preset-tools.js";
import { queryTools } from "./tools/query-tools.js";
import { ragTools } from "./tools/rag-tools.js";
import { reviewTools } from "./tools/review-tools.js";
import { sessionTools } from "./tools/session-tools.js";
import { statsTools } from "./tools/stats-tools.js";

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
			"KNOWLEDGE BASE (Pro only): search_knowledge provides semantic search + FSRS mastery data.",
			"Use it FIRST for conceptual/topic questions ('co wiem o X', 'explain Y', 'find notes about Z').",
			"Use sourceIds param to scope search to specific notes (pass file paths from activeNote.path).",
			"Results include FSRS data per flashcard — low stability + high lapses = struggling, high stability = mastered.",
			"Results include modifiedAt timestamps for recency-aware answers.",
			"If search_knowledge returns 'Pro subscription required', the user is on the free/BYOK tier.",
			"",
			"COOPERATING WITH OBSIDIAN TOOLS: True Recall and Obsidian MCP tools complement each other.",
			"Use Obsidian search_notes for: exact text matches, tag queries, frontmatter filters, date-based lookups.",
			"Use Obsidian read_note after search_knowledge to get the full content of a found note (search returns chunks, not full notes).",
			"Use Obsidian list_directory to browse vault structure (Johnny.Decimal folders).",
			"Use Obsidian write_note/patch_note for all note creation and editing.",
		].join("\n"),
	},
);

registerTools(server, client, [
	...contextTools,
	...cardTools,
	...reviewTools,
	...generateTools,
	...presetTools,
	...sessionTools,
	...dashboardTools,
	...fsrsTools,
	...navigationTools,
	...noteTools,
	...backupTools,
	...statsTools,
	...queryTools,
	...ragTools,
]);

const transport = new StdioServerTransport();
await server.connect(transport);
