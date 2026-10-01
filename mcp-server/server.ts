import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { TrueRecallClient } from "./client.js";
import { registerTools, type ToolDef } from "./tools/_register.js";
import { backupTools } from "./tools/backup-tools.js";
import { cardTools } from "./tools/card-tools.js";
import { contextTools } from "./tools/context-tools.js";
import { dashboardTools } from "./tools/dashboard-tools.js";
import { exportTools, fsrsAdvancedTools } from "./tools/fsrs-advanced-tools.js";
import { fsrsTools } from "./tools/fsrs-tools.js";
import { generateTools } from "./tools/generate-tools.js";
import { navigationTools } from "./tools/navigation-tools.js";
import { noteTools } from "./tools/note-tools.js";
import { polishTools } from "./tools/polish-tools.js";
import { presetTools } from "./tools/preset-tools.js";
import { queryTools } from "./tools/query-tools.js";
import { reviewTools } from "./tools/review-tools.js";
import { sessionTools } from "./tools/session-tools.js";
import { statsTools } from "./tools/stats-tools.js";

export const SERVER_VERSION = "1.1.0";

/** Sent once per session; harnesses put it in the model's context. */
export const SERVER_INSTRUCTIONS = [
	"True Recall is the user's spaced-repetition flashcard app, running as an Obsidian plugin. These tools read and change their cards, reviews and study stats through the plugin, so Obsidian must be open. They don't search, create or edit note text; use the harness's note or file tools for that.",
	"",
	"STATE: Some setups inject a message starting 'True Recall live context:'. When a recent one is present, use it instead of calling get_full_context. Otherwise call get_full_context before other True Recall tools. If a call fails, get_status and the error's hint say whether Obsidian is closed, the local API is off, or the token is wrong; the user fixes those, so report the fix instead of retrying.",
	"",
	"WHAT 'THIS' MEANS: The context can hold an active note and a review session at once. 'this card' or 'nie rozumiem' means reviewSession.currentCard; 'this note' or 'ta notatka' means activeNote. If both fit, ask.",
	"",
	"ANSWER PRIVACY: The context and get_full_context include the current card's answer even when isAnswerRevealed is false. Until the user has seen it, don't reveal, paraphrase or hint at it: the review only works if they recall it themselves. Discuss the question, ask what they think, and call reveal_answer only when they ask to see the answer. A card's userComment is the user's own note about the card; use it as context, not as source material.",
	"",
	"REVIEW SESSIONS: reveal_answer flips the current card in Obsidian and returns its answer. grade_review_card records the user's rating and moves to the next card; use it instead of grade_card while a session is active, and grade with the rating the user chose.",
	"",
	"CHANGING DATA: Tools marked destructive overwrite or delete data with no restore call in this API (deletes, card text edits, grades, FSRS preset changes). Call them only for what the user asked; for anything broader than one card, say what will change and get a yes first. Create cards in small batches the user can check.",
	"",
	"FSRS TUNING (too many reviews, easy cards keep coming back): 1) get_fsrs_analytics: if trueRetention.current is well above target, the weights are stale. 2) optimize_parameters; show the user simulate_reviews for '3333' and '13333' with old vs new weights. 3) After a yes, update_fsrs_preset with the weights (and a retention the user picks). 4) reschedule_from_history with no dry_run, show summary.dueToday and avgNext30Days before/after; after a second yes run it with dry_run false (it backs up first). Without step 4 the new weights only take effect card by card at each next review. Never pick the retention for the user: lower retention means fewer reviews and more forgetting.",
	"",
	"SIZE: get_due_cards returns 50 cards unless you pass limit; for counts, get_full_context or get_dashboard is cheaper. list_cards caps at 200 and doesn't filter by due date.",
].join("\n");

/** Tools by topic; the CLI uses the topics as help sections. */
export const TOOL_GROUPS: ReadonlyArray<readonly [string, ToolDef[]]> = [
	["Context", contextTools],
	["Cards", cardTools],
	["Card actions", sessionTools],
	["Review", reviewTools],
	["Generation", generateTools],
	["Generation presets", presetTools],
	["Card Polish presets", polishTools],
	["Dashboard", dashboardTools],
	["FSRS", fsrsTools],
	["FSRS advanced", fsrsAdvancedTools],
	["Export", exportTools],
	["Navigation", navigationTools],
	["Notes", noteTools],
	["Backup", backupTools],
	["Stats", statsTools],
	["Query", queryTools],
];

export const ALL_TOOLS: ToolDef[] = TOOL_GROUPS.flatMap(([, tools]) => tools);

export function createServer(client: TrueRecallClient): McpServer {
	const server = new McpServer(
		{ name: "true-recall", title: "True Recall", version: SERVER_VERSION },
		{ instructions: SERVER_INSTRUCTIONS },
	);
	registerTools(server, client, ALL_TOOLS);
	return server;
}

/** Serve over stdio until the client disconnects. */
export async function serveStdio(client: TrueRecallClient): Promise<void> {
	await createServer(client).connect(new StdioServerTransport());
}
