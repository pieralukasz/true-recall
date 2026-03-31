import { FSRSSimulatorService } from "@true-recall/core/services/fsrs/fsrs-simulator.service";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

export function handleOptimizeParameters(
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
	const presetName = url.searchParams.get("preset_name") ?? undefined;

	const preset = presetName
		? ctx.plugin.presetService.getPresetByName(presetName)
		: ctx.plugin.presetService.getDefaultPreset();

	const currentWeights = preset?.weights ?? ctx.plugin.settings.fsrsWeights;

	try {
		const result = ctx.plugin.fsrsHelper.optimizeParameters(
			{},
			presetName,
			currentWeights,
		);

		sendOk(res, result);
	} catch (error) {
		sendError(
			res,
			400,
			error instanceof Error ? error.message : "Optimization failed",
		);
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

	const weights = body.weights ?? ctx.plugin.settings.fsrsWeights ?? [];
	const retention = body.retention ?? ctx.plugin.settings.fsrsRequestRetention;

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

	const forecast = ctx.plugin.fsrsHelper.getWorkloadForecast(days);
	const byDay = ctx.plugin.fsrsHelper.getWorkloadByDayOfWeek(days);

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
