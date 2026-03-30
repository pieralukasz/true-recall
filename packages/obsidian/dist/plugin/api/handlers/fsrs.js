import { __awaiter } from "tslib";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleGetPresets(_req, res, ctx) {
    const presets = ctx.plugin.presetService.getPresets();
    const defaultId = ctx.plugin.settings.defaultPresetId;
    sendOk(res, presets.map((p) => ({
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
    })));
}
export function handleCreatePreset(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!(body === null || body === void 0 ? void 0 : body.name)) {
            sendError(res, 400, "Body must contain { name: string }");
            return;
        }
        const existing = ctx.plugin.presetService.getPresetByName(body.name);
        if (existing) {
            sendError(res, 409, `Preset "${body.name}" already exists`);
            return;
        }
        const defaults = ctx.plugin.presetService.getDefaultPreset();
        const preset = yield ctx.plugin.presetService.createPreset({
            name: body.name,
            requestRetention: (_a = body.request_retention) !== null && _a !== void 0 ? _a : defaults.requestRetention,
            maximumInterval: defaults.maximumInterval,
            weights: null,
            learningSteps: (_b = body.learning_steps) !== null && _b !== void 0 ? _b : defaults.learningSteps,
            relearningSteps: (_c = body.relearning_steps) !== null && _c !== void 0 ? _c : defaults.relearningSteps,
            newCardsPerDay: (_d = body.new_cards_per_day) !== null && _d !== void 0 ? _d : defaults.newCardsPerDay,
            reviewsPerDay: (_e = body.reviews_per_day) !== null && _e !== void 0 ? _e : defaults.reviewsPerDay,
            lastOptimization: null,
            lastOptimizationReviewCount: null,
            lastOptimizationMetrics: null,
        });
        sendOk(res, { id: preset.id, name: preset.name });
    });
}
export function handleGetFsrsStats(req, res, ctx) {
    var _a;
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    if (!ctx.plugin.fsrsHelper) {
        sendError(res, 503, "FSRS helper not initialized");
        return;
    }
    const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/", "http://localhost");
    const days = Number(url.searchParams.get("days")) || 30;
    const snapshot = ctx.plugin.fsrsHelper.getTrueRetentionSnapshot(days);
    const workloadForecast = ctx.plugin.fsrsHelper.getWorkloadForecastSummary(days);
    const workloadByDay = ctx.plugin.fsrsHelper.getWorkloadByDayOfWeek(days);
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
