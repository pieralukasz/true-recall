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

const server = new McpServer({
	name: "true-recall",
	version: "1.0.0",
});

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
