import { DEFAULT_FSRS_WEIGHTS } from "@true-recall/core/constants";
import { HttpError } from "@true-recall/core/errors";
import { HistoryRescheduleService } from "@true-recall/core/metrics/fsrs-tools";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { FSRSSimulatorService } from "@true-recall/core/services/fsrs/fsrs-simulator.service";
import type { FSRSSettings } from "@true-recall/core/types";
import { getTomorrowBoundary } from "@true-recall/core/utils";

import { HistoryRescheduleCommand } from "@true-recall/obsidian/commands/commands/history-reschedule.cmd";
import { G } from "@true-recall/obsidian/data";
import { setLastMutation } from "@true-recall/obsidian/services/signals";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

export async function handleOptimizeParameters(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	if (!ctx.plugin.fsrsHelper) {
		sendError(res, 503, "FSRS helper not initialized");
		return;
	}

	const url = new URL(req.url ?? "/", "http://localhost");
	const presetName = url.searchParams.get("preset_name") ?? undefined;

	// An unknown preset name starts from the default preset, not from the
	// stale legacy fsrsWeights mirror; null weights mean the FSRS defaults.
	const preset =
		(presetName
			? ctx.plugin.presetService.getPresetByName(presetName)
			: undefined) ?? ctx.plugin.presetService.getDefaultPreset();

	const currentWeights = preset.weights;

	try {
		const result = await ctx.plugin.fsrsHelper.optimizeParameters(
			{},
			presetName,
			currentWeights,
		);

		sendOk(res, result);
	} catch (error) {
		throw new HttpError(400, {
			backendCode: "fsrs-optimization-invalid",
			cause: error,
			context: { operation: "fsrs-optimization" },
		});
	}
}

interface SimulateInput {
	sequences: string[];
	retention?: number;
	weights?: number[];
}

export async function handleSimulateReviews(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<SimulateInput>(raw);

	if (!body?.sequences || !Array.isArray(body.sequences)) {
		sendError(
			res,
			400,
			'Body must contain { sequences: string[] } (e.g. ["3333", "3132"])',
		);
		return;
	}

	const defaultPreset = ctx.plugin.presetService.getDefaultPreset();
	const weights = body.weights ??
		defaultPreset.weights ?? [...DEFAULT_FSRS_WEIGHTS];
	const retention = body.retention ?? defaultPreset.requestRetention;

	const simulator = new FSRSSimulatorService();
	const results = simulator.simulate(body.sequences, weights, retention);

	sendOk(res, results);
}

export function handleGetWorkloadForecast(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	if (!ctx.plugin.fsrsHelper) {
		sendError(res, 503, "FSRS helper not initialized");
		return;
	}

	const url = new URL(req.url ?? "/", "http://localhost");
	const days = Number(url.searchParams.get("days")) || 30;
	const project = url.searchParams.get("project");

	let includeUids: ReadonlySet<string> | undefined;
	if (project) {
		const sourceUids =
			ctx.plugin.hierarchyService.getSourceUidsForProject(project);
		if (sourceUids.size === 0) {
			sendError(res, 404, `Project "${project}" not found or has no notes`);
			return;
		}
		includeUids = sourceUids;
	}

	const archivedUids = ctx.plugin.hierarchyService.getArchivedSourceUids();
	const forecast = ctx.plugin.fsrsHelper.getWorkloadForecast(
		days,
		archivedUids,
		includeUids,
	);
	const byDay = ctx.plugin.fsrsHelper.getWorkloadByDayOfWeek(
		days,
		archivedUids,
		includeUids,
	);

	sendOk(res, { forecast, byDayOfWeek: byDay });
}

export function handleGetRetrievability(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const cardId = params.id;
	if (!cardId) {
		sendError(res, 400, "Missing card ID");
		return;
	}

	const card = ctx.plugin.cardStore.cards.get(cardId);
	if (!card) {
		sendError(res, 404, "Card not found");
		return;
	}

	const retrievability = ctx.plugin.fsrsService.getRetrievability(card);

	sendOk(res, {
		cardId,
		retrievability: Math.round(retrievability * 10000) / 10000,
		percentage: `${Math.round(retrievability * 100)}%`,
	});
}

export function handleGetSchedulingPreview(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const cardId = params.id;
	if (!cardId) {
		sendError(res, 400, "Missing card ID");
		return;
	}

	const card = ctx.plugin.cardStore.cards.get(cardId);
	if (!card) {
		sendError(res, 404, "Card not found");
		return;
	}

	const preview = ctx.plugin.fsrsService.getSchedulingPreview(card);

	sendOk(res, {
		cardId,
		current: {
			state: card.state,
			stability: card.stability,
			difficulty: card.difficulty,
			due: card.due,
		},
		preview,
	});
}

interface RescheduleFromHistoryInput {
	mode?: string;
	dry_run?: boolean;
	sample?: number;
}

/**
 * Recompute every Review card's memory state from its review history with
 * the current preset weights and move due dates accordingly. Dry run by
 * default; with dry_run false it writes in one transaction after a backup.
 */
export async function handleRescheduleFromHistory(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const store = ctx.plugin.cardStore;
	if (!ctx.plugin.isStoreReady() || !store) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<RescheduleFromHistoryInput>(raw || "{}") ?? {};
	const mode = body.mode ?? "postpone-only";
	if (mode !== "postpone-only" && mode !== "full") {
		sendError(res, 400, 'mode must be "postpone-only" or "full"');
		return;
	}
	const dryRun = body.dry_run !== false;

	const presets = ctx.plugin.presetService;
	const fsrs = new FSRSService(
		presets.toFSRSSettings(presets.getDefaultPreset()),
	);
	const service = new HistoryRescheduleService(fsrs);

	let backupPath: string | null = null;
	if (!dryRun) {
		if (!ctx.plugin.backupService) {
			sendError(res, 503, "Backup service not initialized; refusing to write");
			return;
		}
		backupPath = await ctx.plugin.backupService.createBackup();
	}

	// Same precedence as a review: the note's own preset, then its parents,
	// then the preset the card's latest review was scheduled with (covers a
	// project preset applied only through the studied project), then default.
	const settingsCache = new Map<string, FSRSSettings>();
	const resolveSettings = (
		card: { id: string; sourceUid?: string | null },
		lastPresetName: string | null,
	): FSRSSettings => {
		const key = `${card.sourceUid ?? ""}|${lastPresetName ?? ""}`;
		const cached = settingsCache.get(key);
		if (cached) return cached;
		const notePath = card.sourceUid
			? ctx.plugin.frontmatterIndex?.getFileByValue(
					"flashcard_uid",
					card.sourceUid,
				)
			: null;
		const chain = notePath ? presets.resolvePresetChain(notePath) : null;
		const fromNote =
			chain && chain.effective.source !== "default"
				? chain.effective.preset
				: undefined;
		const preset =
			fromNote ??
			(lastPresetName ? presets.getPresetByName(lastPresetName) : undefined) ??
			presets.getDefaultPreset();
		const settings = presets.toFSRSSettings(preset);
		settingsCache.set(key, settings);
		return settings;
	};

	const result = await service.run(store, resolveSettings, {
		mode,
		dryRun,
		tomorrowBoundary: getTomorrowBoundary(
			ctx.plugin.settings.dayStartHour ?? 4,
		),
		countExcludedSourceUids:
			ctx.plugin.hierarchyService.getArchivedSourceUids(),
		// Keep Obsidian responsive while tens of thousands of reviews replay
		yieldControl: () =>
			new Promise<void>((resolve) => window.setTimeout(resolve, 0)),
	});

	if (!dryRun && result.changes.length > 0) {
		await store.saveNow();
		// "Undo last flashcard action" restores the previous memory state and due dates
		void ctx.plugin.commandService?.execute(
			new HistoryRescheduleCommand(
				`Reschedule ${result.changes.length} cards from review history`,
				result.changes.map((c) => ({
					cardId: c.cardId,
					before: c.before,
					after: c.after,
				})),
			),
		);
		setLastMutation({
			type: "bulk",
			action: "update",
			cardIds: result.changes.map((c) => c.cardId),
		});
		ctx.plugin.dataLayer?.invalidateGroups([
			G.CARDS,
			G.BROWSER,
			G.DASHBOARD,
			G.PANEL,
			G.REVIEW,
			G.STATS,
		]);
	}

	const sampleSize = Math.max(0, Math.min(50, body.sample ?? 5));
	sendOk(res, {
		dryRun,
		backupPath,
		undoable: !dryRun && result.changes.length > 0,
		staleSkipped: result.staleSkipped,
		summary: result.summary,
		sample: result.changes.slice(0, sampleSize).map((c) => ({
			cardId: c.cardId,
			dueBefore: c.before.due,
			dueAfter: c.after.due,
			stabilityBefore: Math.round(c.before.stability * 10) / 10,
			stabilityAfter: Math.round(c.after.stability * 10) / 10,
			difficultyBefore: Math.round(c.before.difficulty * 100) / 100,
			difficultyAfter: Math.round(c.after.difficulty * 100) / 100,
		})),
	});
}
