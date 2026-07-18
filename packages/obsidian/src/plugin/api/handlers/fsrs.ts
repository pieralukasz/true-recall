import type { FSRSPreset, TrueRecallSettings } from "@true-recall/core/types";

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

interface UpdatePresetInput {
	request_retention?: number;
	new_cards_per_day?: number;
	reviews_per_day?: number;
	learning_steps?: number[];
	relearning_steps?: number[];
	leech_threshold?: number;
	leech_action?: string;
	weights?: number[] | null;
}

export async function handleUpdatePreset(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	const key = decodeURIComponent(params.id ?? "");
	const preset =
		ctx.plugin.presetService.getPresetById(key) ??
		ctx.plugin.presetService.getPresetByName(key);
	if (!preset) {
		sendError(res, 404, `Preset "${key}" not found (by id or name)`);
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<UpdatePresetInput>(raw);
	if (!body) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}

	const changes: Partial<Omit<FSRSPreset, "id">> = {};
	if (body.request_retention !== undefined) {
		if (body.request_retention < 0.7 || body.request_retention > 0.99) {
			sendError(res, 400, "request_retention must be between 0.70 and 0.99");
			return;
		}
		changes.requestRetention = body.request_retention;
	}
	if (body.new_cards_per_day !== undefined) {
		if (body.new_cards_per_day < 0) {
			sendError(res, 400, "new_cards_per_day must be >= 0");
			return;
		}
		changes.newCardsPerDay = Math.round(body.new_cards_per_day);
	}
	if (body.reviews_per_day !== undefined) {
		if (body.reviews_per_day < 0) {
			sendError(res, 400, "reviews_per_day must be >= 0");
			return;
		}
		changes.reviewsPerDay = Math.round(body.reviews_per_day);
	}
	if (body.learning_steps !== undefined) {
		changes.learningSteps = body.learning_steps;
	}
	if (body.relearning_steps !== undefined) {
		changes.relearningSteps = body.relearning_steps;
	}
	if (body.leech_threshold !== undefined) {
		changes.leechThreshold = Math.round(body.leech_threshold);
	}
	if (body.leech_action !== undefined) {
		if (body.leech_action !== "tag-only" && body.leech_action !== "suspend") {
			sendError(res, 400, 'leech_action must be "tag-only" or "suspend"');
			return;
		}
		changes.leechAction = body.leech_action;
	}
	if (body.weights !== undefined) {
		if (
			body.weights !== null &&
			!ctx.plugin.fsrsHelper?.validateWeights(body.weights)
		) {
			sendError(
				res,
				400,
				"weights must be null or an array of 21 non-negative numbers",
			);
			return;
		}
		changes.weights = body.weights;
	}

	if (Object.keys(changes).length === 0) {
		sendError(res, 400, "No recognized fields to update");
		return;
	}

	await ctx.plugin.presetService.updatePreset(preset.id, changes);
	sendOk(res, {
		id: preset.id,
		name: preset.name,
		updated: Object.keys(changes),
	});
}

interface LoadBalanceSettingsInput {
	enabled?: boolean;
	target_mode?: string;
	target?: number;
	max_deviation?: number;
	max_shift_days?: number;
	bulk_days?: number;
}

export async function handleUpdateLoadBalanceSettings(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	const raw = await readBody(req);
	const body = parseJsonBody<LoadBalanceSettingsInput>(raw);
	if (!body) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}

	const settings: TrueRecallSettings = ctx.plugin.settings;
	const updated: string[] = [];

	if (body.enabled !== undefined) {
		settings.loadBalanceEnabled = Boolean(body.enabled);
		updated.push("enabled");
	}
	if (body.target_mode !== undefined) {
		if (body.target_mode !== "auto" && body.target_mode !== "manual") {
			sendError(res, 400, 'target_mode must be "auto" or "manual"');
			return;
		}
		settings.loadBalanceTargetMode = body.target_mode;
		updated.push("target_mode");
	}
	if (body.target !== undefined) {
		if (body.target < 1) {
			sendError(res, 400, "target must be >= 1");
			return;
		}
		settings.loadBalanceTarget = Math.round(body.target);
		updated.push("target");
	}
	if (body.max_deviation !== undefined) {
		if (body.max_deviation < 0 || body.max_deviation > 100) {
			sendError(res, 400, "max_deviation must be between 0 and 100");
			return;
		}
		settings.loadBalanceMaxDeviation = Math.round(body.max_deviation);
		updated.push("max_deviation");
	}
	if (body.max_shift_days !== undefined) {
		if (body.max_shift_days < 0) {
			sendError(res, 400, "max_shift_days must be >= 0");
			return;
		}
		settings.loadBalanceMaxShiftDays = Math.round(body.max_shift_days);
		updated.push("max_shift_days");
	}
	if (body.bulk_days !== undefined) {
		if (body.bulk_days < 0) {
			sendError(res, 400, "bulk_days must be >= 0");
			return;
		}
		settings.loadBalanceBulkDays = Math.round(body.bulk_days);
		updated.push("bulk_days");
	}

	if (updated.length === 0) {
		sendError(res, 400, "No recognized fields to update");
		return;
	}

	await ctx.plugin.saveSettings();
	sendOk(res, {
		updated,
		loadBalance: {
			enabled: settings.loadBalanceEnabled,
			targetMode: settings.loadBalanceTargetMode,
			target: settings.loadBalanceTarget,
			maxDeviation: settings.loadBalanceMaxDeviation,
			maxShiftDays: settings.loadBalanceMaxShiftDays,
			bulkDays: settings.loadBalanceBulkDays,
		},
	});
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
