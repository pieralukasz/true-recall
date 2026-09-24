import {
	describeErrorForUser,
	isHttpError,
	isTransient,
	toAppError,
} from "@true-recall/core/errors";

import { reportError } from "@true-recall/obsidian/services/errors";

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
	handleBulkFlag,
	handleBulkSuspend,
	handleDeleteCard,
	handleMoveCard,
	handleRemoveCardsFromNote,
	handleSuspendCard,
	handleUpdateCard,
} from "./handlers/card-actions";
import { handleGetCardContext } from "./handlers/card-context";
import {
	handleCreateCardPolishPreset,
	handleDeleteCardPolishPreset,
	handleListCardPolishPresets,
	handleUpdateCardPolishPreset,
} from "./handlers/card-polish-presets";
import { handleGetCardRelations } from "./handlers/card-relations";
import {
	handleCreateCards,
	handleGetActualLearningCards,
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
	route("GET", "/cards/actual-learning", handleGetActualLearningCards),
	route("GET", "/cards/problems", handleGetProblemCards),
	route("GET", "/cards/:id/context", handleGetCardContext),
	route("GET", "/cards/:id/relations", handleGetCardRelations),
	route("GET", "/cards/:id", handleGetCard),
	route("GET", "/cards", handleListCards),

	// Cards — writes
	route("POST", "/cards/:id/review", handleGradeCard),
	route("POST", "/cards/:id/suspend", handleSuspendCard),
	route("POST", "/cards/:id/update", handleUpdateCard),
	route("POST", "/cards/:id/move", handleMoveCard),
	route("DELETE", "/cards/:id", handleDeleteCard),
	route("POST", "/cards/bulk-delete", handleBulkDelete),
	route("POST", "/cards/bulk-suspend", handleBulkSuspend),
	route("POST", "/cards/bulk-flag", handleBulkFlag),
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

	// Card Polish presets
	route("GET", "/card-polish-presets", handleListCardPolishPresets),
	route("POST", "/card-polish-presets", handleCreateCardPolishPreset),
	route("POST", "/card-polish-presets/:id", handleUpdateCardPolishPreset),
	route("DELETE", "/card-polish-presets/:id", handleDeleteCardPolishPreset),

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
	const requestId = crypto.randomUUID();
	const origin = header(req, "origin");
	const allowedOrigin = resolveAllowedOrigin(
		origin,
		ctx.plugin.settings.apiAllowedOrigins,
	);
	const response = withResponseMetadata(res, allowedOrigin, requestId);

	if (method === "OPTIONS") {
		if (origin && !allowedOrigin) {
			sendError(response, 403, "Browser origin is not allowed", {
				code: "origin-not-allowed",
				requestId,
			});
			return;
		}
		response.writeHead(204, {
			...CORS_HEADERS,
			"Access-Control-Max-Age": "86400",
		});
		response.end();
		return;
	}

	if (origin && !allowedOrigin) {
		sendError(response, 403, "Browser origin is not allowed", {
			code: "origin-not-allowed",
			requestId,
		});
		return;
	}

	if (!tokenMatches(readToken(req), ctx.apiToken)) {
		sendError(response, 401, "Local API authentication is required", {
			code: "unauthorized",
			requestId,
		});
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
			await r.handler(req, response, ctx, params);
		} catch (error) {
			const appError = toAppError(error);
			reportError(error, {
				origin: "local-api",
				context: { method, route: routeTemplate(r), requestId },
			});
			sendError(response, statusFor(error), describeErrorForUser(error), {
				code: appError.code,
				retryable: isTransient(error),
				requestId:
					(isHttpError(appError) ? appError.requestId : undefined) ?? requestId,
			});
		}
		return;
	}

	sendError(response, 404, `Not found: ${method} ${pathname}`, {
		code: "route-not-found",
		requestId,
	});
}

function statusFor(error: unknown): number {
	const appError = toAppError(error);
	if (isHttpError(appError)) return appError.statusCode;
	if (appError.category === "validation") return 400;
	if (appError.category === "not-found") return 404;
	if (appError.category === "access-denied") return 403;
	if (appError.category === "feature-unavailable") return 503;
	return 500;
}

function header(req: ApiRequest, name: string): string | undefined {
	const value = req.headers[name] ?? req.headers[name.toLowerCase()];
	return Array.isArray(value) ? value[0] : value;
}

function readToken(req: ApiRequest): string | undefined {
	const direct = header(req, "x-true-recall-token")?.trim();
	if (direct) return direct;
	const authorization = header(req, "authorization");
	return authorization?.replace(/^Bearer\s+/i, "").trim();
}

function tokenMatches(
	candidate: string | undefined,
	expected: string,
): boolean {
	if (!candidate || candidate.length !== expected.length) return false;
	let difference = 0;
	for (let index = 0; index < expected.length; index++) {
		difference |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
	}
	return difference === 0;
}

function resolveAllowedOrigin(
	origin: string | undefined,
	allowed: readonly string[],
): string | undefined {
	if (!origin) return undefined;
	return allowed.includes(origin) ? origin : undefined;
}

function withResponseMetadata(
	res: ApiResponseWriter,
	allowedOrigin: string | undefined,
	requestId: string,
): ApiResponseWriter {
	return {
		get writableEnded() {
			return res.writableEnded;
		},
		writeHead(statusCode, headers = {}) {
			res.writeHead(statusCode, {
				"Cache-Control": "no-store",
				"x-request-id": requestId,
				...headers,
				...(allowedOrigin
					? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" }
					: {}),
			});
		},
		end(data) {
			res.end(data);
		},
	};
}

function routeTemplate(route: Route): string {
	return route.pattern.source;
}
