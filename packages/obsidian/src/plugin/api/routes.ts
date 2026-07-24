import type {
	ApiContext,
	ApiRequest,
	ApiResponseWriter,
	RouteHandler,
} from "./api.types";
import { CORS_HEADERS, sendError } from "./api.types";
import {
	handleCreateBackup,
	handleGetIntegrity,
	handleListBackups,
} from "./handlers/backup";
import {
	handleBulkBury,
	handleBulkDelete,
	handleBulkSuspend,
	handleDeleteCard,
	handleRemoveCardsFromNote,
	handleSuspendCard,
	handleUpdateCard,
} from "./handlers/card-actions";
import { handleGetCardContext } from "./handlers/card-context";
import { handleGetCardRelations } from "./handlers/card-relations";
import {
	handleCreateCards,
	handleGetCard,
	handleGetDueCards,
	handleGetProblemCards,
	handleListCards,
} from "./handlers/cards";
import {
	handleGetDashboard,
	handleGetProject,
	handleGetProjects,
} from "./handlers/dashboard";
import { handleExportCsv } from "./handlers/export";
import {
	handleCreatePreset,
	handleGetFsrsStats,
	handleGetPresets,
	handleUpdateLoadBalanceSettings,
	handleUpdatePreset,
} from "./handlers/fsrs";
import {
	handleGetRetrievability,
	handleGetSchedulingPreview,
	handleGetWorkloadForecast,
	handleOptimizeParameters,
	handleSimulateReviews,
} from "./handlers/fsrs-advanced";
import { handleGetFullContext } from "./handlers/full-context";
import { handleGenerate, handleGetNoteTypes } from "./handlers/generate";
import {
	handleCreateGenerationPreset,
	handleDeleteGenerationPreset,
	handleGenerateWithPreset,
	handleGetGenerationPreset,
	handleListGenerationPresets,
	handleUpdateGenerationPreset,
} from "./handlers/generation-presets";
import { handleOpenNote, handleOpenView } from "./handlers/navigation";
import {
	handleAddFlashcardUid,
	handleDissolveProject,
	handleMoveChildren,
	handleNoteCards,
	handleNoteReviewStatus,
	handleNoteStats,
	handleSetArchive,
	handleSetParent,
	handleSetPresetForNote,
	handleToggleNoteReview,
} from "./handlers/notes";
import { handleGetSchema, handleQuerySql } from "./handlers/query";
import { handleGradeCard } from "./handlers/review";
import {
	handleGradeSessionCard,
	handleRevealAnswer,
} from "./handlers/review-actions";
import { handleGetReviewContext } from "./handlers/review-context";
import { handleGetSessionAnalysis } from "./handlers/session-analysis";
import { handleStartSession } from "./handlers/sessions";
import {
	handleGetDailyStats,
	handleGetPatterns,
	handleGetSummary,
} from "./handlers/stats";
import { handleGetActiveNote, handleGetStatus } from "./handlers/status";

type HttpMethod = "GET" | "POST" | "DELETE";

interface Route {
	method: HttpMethod;
	pattern: RegExp;
	paramNames: string[];
	handler: RouteHandler;
}

function route(method: HttpMethod, path: string, handler: RouteHandler): Route {
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
	route("GET", "/review/current", handleGetReviewContext),
	route("GET", "/context", handleGetFullContext),

	// Cards — reads
	route("GET", "/cards/due", handleGetDueCards),
	route("GET", "/cards/problems", handleGetProblemCards),
	route("GET", "/cards/:id/context", handleGetCardContext),
	route("GET", "/cards/:id/relations", handleGetCardRelations),
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

	// Generation presets
	route("GET", "/generation-presets", handleListGenerationPresets),
	route("GET", "/generation-presets/:id", handleGetGenerationPreset),
	route("POST", "/generation-presets", handleCreateGenerationPreset),
	route("POST", "/generation-presets/:id", handleUpdateGenerationPreset),
	route("DELETE", "/generation-presets/:id", handleDeleteGenerationPreset),
	route("POST", "/generate-with-preset", handleGenerateWithPreset),

	// Review actions (in-session)
	route("POST", "/review/reveal", handleRevealAnswer),
	route("POST", "/review/grade", handleGradeSessionCard),

	// Sessions
	route("POST", "/sessions/start", handleStartSession),

	// Stats
	route("GET", "/stats/summary", handleGetSummary),
	route("GET", "/stats/daily", handleGetDailyStats),
	route("GET", "/stats/patterns", handleGetPatterns),
	route("GET", "/stats/session-analysis", handleGetSessionAnalysis),

	// Dashboard & Projects
	route("GET", "/dashboard", handleGetDashboard),
	route("GET", "/projects", handleGetProjects),
	route("GET", "/project", handleGetProject),

	// FSRS
	route("GET", "/presets", handleGetPresets),
	route("POST", "/presets", handleCreatePreset),
	route("POST", "/presets/:id", handleUpdatePreset),
	route("POST", "/settings/load-balance", handleUpdateLoadBalanceSettings),
	route("GET", "/fsrs/stats", handleGetFsrsStats),

	// Navigation
	route("POST", "/open-view", handleOpenView),
	route("POST", "/open-note", handleOpenNote),

	// Notes / Frontmatter
	route("GET", "/notes/stats", handleNoteStats),
	route("GET", "/notes/cards", handleNoteCards),
	route("POST", "/notes/add-uid", handleAddFlashcardUid),
	route("POST", "/notes/set-preset", handleSetPresetForNote),
	route("POST", "/notes/set-parent", handleSetParent),
	route("POST", "/notes/set-archive", handleSetArchive),
	route("POST", "/notes/dissolve-project", handleDissolveProject),
	route("POST", "/notes/move-children", handleMoveChildren),
	route("POST", "/notes/note-review/toggle", handleToggleNoteReview),
	route("POST", "/notes/note-review/status", handleNoteReviewStatus),

	// Backup & Integrity
	route("POST", "/backups/create", handleCreateBackup),
	route("GET", "/backups", handleListBackups),
	route("GET", "/integrity", handleGetIntegrity),

	// Query
	route("POST", "/query", handleQuerySql),
	route("GET", "/schema", handleGetSchema),

	// Export
	route("POST", "/export/csv", handleExportCsv),

	// FSRS Advanced
	route("GET", "/fsrs/optimize", handleOptimizeParameters),
	route("POST", "/fsrs/simulate", handleSimulateReviews),
	route("GET", "/fsrs/forecast", handleGetWorkloadForecast),
	route("GET", "/cards/:id/retrievability", handleGetRetrievability),
	route("GET", "/cards/:id/preview", handleGetSchedulingPreview),
];

export async function dispatch(
	req: ApiRequest,
	res: ApiResponseWriter,
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
