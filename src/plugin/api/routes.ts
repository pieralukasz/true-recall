import type { IncomingMessage, ServerResponse } from "http";
import type { ApiContext, RouteHandler } from "./api.types";
import { CORS_HEADERS, sendError } from "./api.types";
import {
	handleBulkBury,
	handleBulkDelete,
	handleBulkSuspend,
	handleDeleteCard,
	handleRemoveCardsFromNote,
	handleSuspendCard,
	handleUpdateCard,
} from "./handlers/card-actions";
import {
	handleCreateCards,
	handleGetCard,
	handleGetDueCards,
	handleGetProblemCards,
	handleListCards,
} from "./handlers/cards";
import { handleCreateBackup, handleGetIntegrity, handleListBackups } from "./handlers/backup";
import { handleGetDashboard, handleGetProjects } from "./handlers/dashboard";
import { handleCreatePreset, handleGetFsrsStats, handleGetPresets } from "./handlers/fsrs";
import { handleGenerate, handleGetNoteTypes } from "./handlers/generate";
import {
	handleAddFlashcardUid,
	handleSetArchive,
	handleSetParent,
	handleSetPresetForNote,
} from "./handlers/notes";
import { handleOpenNote, handleOpenView } from "./handlers/navigation";
import { handleGetSchema, handleQuerySql } from "./handlers/query";
import { handleGradeCard } from "./handlers/review";
import { handleStartSession } from "./handlers/sessions";
import { handleGetActiveNote, handleGetStatus } from "./handlers/status";
import {
	handleGetDailyStats,
	handleGetPatterns,
	handleGetSummary,
} from "./handlers/stats";

type HttpMethod = "GET" | "POST" | "DELETE";

interface Route {
	method: HttpMethod;
	pattern: RegExp;
	paramNames: string[];
	handler: RouteHandler;
}

function route(
	method: HttpMethod,
	path: string,
	handler: RouteHandler,
): Route {
	const paramNames: string[] = [];
	const regexStr = path.replace(/:(\w+)/g, (_match, name: string) => {
		paramNames.push(name);
		return "([^/]+)";
	});
	return {
		method,
		pattern: new RegExp(`^${regexStr}$`),
		paramNames,
		handler,
	};
}

const routes: Route[] = [
	// Context
	route("GET", "/status", handleGetStatus),
	route("GET", "/active-note", handleGetActiveNote),

	// Cards — reads
	route("GET", "/cards/due", handleGetDueCards),
	route("GET", "/cards/problems", handleGetProblemCards),
	route("GET", "/cards/:id", handleGetCard),
	route("GET", "/cards", handleListCards),

	// Cards — writes
	route("POST", "/cards/:id/review", handleGradeCard),
	route("POST", "/cards/:id/suspend", handleSuspendCard),
	route("POST", "/cards/:id/update", handleUpdateCard),
	route("DELETE", "/cards/:id", handleDeleteCard),
	route("POST", "/cards/bulk-delete", handleBulkDelete),
	route("POST", "/cards/bulk-suspend", handleBulkSuspend),
	route("POST", "/cards/bulk-bury", handleBulkBury),
	route("POST", "/cards/remove-from-note", handleRemoveCardsFromNote),
	route("POST", "/cards", handleCreateCards),

	// AI generation
	route("POST", "/generate", handleGenerate),
	route("GET", "/note-types", handleGetNoteTypes),

	// Sessions
	route("POST", "/sessions/start", handleStartSession),

	// Stats
	route("GET", "/stats/summary", handleGetSummary),
	route("GET", "/stats/daily", handleGetDailyStats),
	route("GET", "/stats/patterns", handleGetPatterns),

	// Dashboard & Projects
	route("GET", "/dashboard", handleGetDashboard),
	route("GET", "/projects", handleGetProjects),

	// FSRS
	route("GET", "/presets", handleGetPresets),
	route("POST", "/presets", handleCreatePreset),
	route("GET", "/fsrs/stats", handleGetFsrsStats),

	// Navigation
	route("POST", "/open-view", handleOpenView),
	route("POST", "/open-note", handleOpenNote),

	// Notes / Frontmatter
	route("POST", "/notes/add-uid", handleAddFlashcardUid),
	route("POST", "/notes/set-preset", handleSetPresetForNote),
	route("POST", "/notes/set-parent", handleSetParent),
	route("POST", "/notes/set-archive", handleSetArchive),

	// Backup & Integrity
	route("POST", "/backups/create", handleCreateBackup),
	route("GET", "/backups", handleListBackups),
	route("GET", "/integrity", handleGetIntegrity),

	// Query
	route("POST", "/query", handleQuerySql),
	route("GET", "/schema", handleGetSchema),
];

export async function dispatch(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	const method = req.method ?? "GET";
	const urlObj = new URL(req.url ?? "/", "http://localhost");
	const pathname = urlObj.pathname;

	if (method === "OPTIONS") {
		res.writeHead(204, {
			...CORS_HEADERS,
			"Access-Control-Max-Age": "86400",
		});
		res.end();
		return;
	}

	for (const r of routes) {
		if (r.method !== method) continue;
		const match = pathname.match(r.pattern);
		if (!match) continue;

		const params: Record<string, string> = {};
		r.paramNames.forEach((name, i) => {
			params[name] = match[i + 1] ?? "";
		});

		try {
			await r.handler(req, res, ctx, params);
		} catch (error) {
			console.error("[True Recall API]", error);
			sendError(
				res,
				500,
				error instanceof Error ? error.message : "Internal error",
			);
		}
		return;
	}

	sendError(res, 404, `Not found: ${method} ${pathname}`);
}
