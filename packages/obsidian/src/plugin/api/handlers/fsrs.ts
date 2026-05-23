import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

export function handleGetPresets(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	const presets = ctx.plugin.presetService.getPresets();
	const defaultId = ctx.plugin.settings.defaultPresetId;

	sendOk(
		res,
		presets.map((p) => ({
			id: p.id,
			name: p.name,
			isDefault: p.id === defaultId,
			requestRetention: p.requestRetention,
			maximumInterval: p.maximumInterval,
			learningSteps: p.learningSteps,
			relearningSteps: p.relearningSteps,
			newCardsPerDay: p.newCardsPerDay,
			reviewsPerDay: p.reviewsPerDay,
			weights: p.weights ? `[${p.weights.length} params]` : "default",
			lastOptimization: p.lastOptimization,
			leechThreshold: p.leechThreshold,
			leechAction: p.leechAction,
		})),
	);
}

interface CreatePresetInput {
	name: string;
	request_retention?: number;
	new_cards_per_day?: number;
	reviews_per_day?: number;
	learning_steps?: number[];
	relearning_steps?: number[];
}

export async function handleCreatePreset(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<CreatePresetInput>(raw);
	if (!body?.name) {
		sendError(res, 400, "Body must contain { name: string }");
		return;
	}

	const existing = ctx.plugin.presetService.getPresetByName(body.name);
	if (existing) {
		sendError(res, 409, `Preset "${body.name}" already exists`);
		return;
	}

	const defaults = ctx.plugin.presetService.getDefaultPreset();
	const preset = await ctx.plugin.presetService.createPreset({
		name: body.name,
		requestRetention: body.request_retention ?? defaults.requestRetention,
		maximumInterval: defaults.maximumInterval,
		weights: null,
		enableFuzz: defaults.enableFuzz !== false,
		learningSteps: body.learning_steps ?? defaults.learningSteps,
		relearningSteps: body.relearning_steps ?? defaults.relearningSteps,
		newCardsPerDay: body.new_cards_per_day ?? defaults.newCardsPerDay,
		reviewsPerDay: body.reviews_per_day ?? defaults.reviewsPerDay,
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
	});

	sendOk(res, { id: preset.id, name: preset.name });
}

export function handleGetFsrsStats(
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

	const archivedUids = ctx.plugin.hierarchyService.getArchivedSourceUids();
	const snapshot = ctx.plugin.fsrsHelper.getTrueRetentionSnapshot(days);
	const workloadForecast = ctx.plugin.fsrsHelper.getWorkloadForecastSummary(
		days,
		archivedUids,
	);
	const workloadByDay = ctx.plugin.fsrsHelper.getWorkloadByDayOfWeek(
		days,
		archivedUids,
	);
	const distributions = ctx.plugin.fsrsHelper.getDistributions();

	sendOk(res, {
		trueRetention: {
			current: snapshot.summary.current,
			target: snapshot.summary.target,
			average: snapshot.summary.average,
			trend: snapshot.summary.trend,
			totalReviews: snapshot.summary.totalReviews,
			recentHistory: snapshot.history.slice(-7),
		},
		workloadForecast: {
			avgDaily: workloadForecast.avgDaily,
			peakDay: workloadForecast.peakDay,
			needsBalancing: workloadForecast.needsBalancing,
			daysAboveTarget: workloadForecast.daysAboveTarget,
		},
		workloadByDay,
		distributions: {
			interval: distributions.interval.stats,
			stability: distributions.stability.stats,
			difficulty: distributions.difficulty.stats,
		},
	});
}
