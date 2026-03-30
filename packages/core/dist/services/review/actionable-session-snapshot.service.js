import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import { buildGlobalPresetQueueContext, buildQueueOptions, filterActiveCards, isGlobalReviewSession, } from "@true-recall/core/services/review/session-helpers";
import { extractFSRSSettings, } from "@true-recall/core/types";
import { State } from "ts-fsrs";
function buildScopeCacheKey(filters) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return JSON.stringify({
        projectPath: (_a = filters.projectPath) !== null && _a !== void 0 ? _a : null,
        sourceUidFilter: (_b = filters.sourceUidFilter) !== null && _b !== void 0 ? _b : null,
        sourceNoteFilter: (_c = filters.sourceNoteFilter) !== null && _c !== void 0 ? _c : null,
        sourceNoteFilters: (_d = filters.sourceNoteFilters) !== null && _d !== void 0 ? _d : null,
        filePathFilter: (_e = filters.filePathFilter) !== null && _e !== void 0 ? _e : null,
        createdTodayOnly: Boolean(filters.createdTodayOnly),
        createdThisWeek: Boolean(filters.createdThisWeek),
        weakCardsOnly: Boolean(filters.weakCardsOnly),
        stateFilter: (_f = filters.stateFilter) !== null && _f !== void 0 ? _f : null,
        ignoreDailyLimits: Boolean(filters.ignoreDailyLimits),
        bypassScheduling: Boolean(filters.bypassScheduling),
        difficultyRange: (_g = filters.difficultyRange) !== null && _g !== void 0 ? _g : null,
        lapsesRange: (_h = filters.lapsesRange) !== null && _h !== void 0 ? _h : null,
        stabilityRange: (_j = filters.stabilityRange) !== null && _j !== void 0 ? _j : null,
        overdueOnly: Boolean(filters.overdueOnly),
        recentlyFailed: Boolean(filters.recentlyFailed),
        cardLimit: (_k = filters.cardLimit) !== null && _k !== void 0 ? _k : null,
        studyAheadDays: (_l = filters.studyAheadDays) !== null && _l !== void 0 ? _l : null,
        customReviewOrder: (_m = filters.customReviewOrder) !== null && _m !== void 0 ? _m : null,
        crammingMode: Boolean(filters.crammingMode),
    });
}
function resolveSessionPresetForFilters(filters, presetService, noteResolver) {
    if (filters.projectPath) {
        return presetService.resolvePresetChain(filters.projectPath).effective
            .preset;
    }
    if (filters.sourceNoteFilter && noteResolver) {
        const filePath = noteResolver.resolveNotePath(filters.sourceNoteFilter);
        if (filePath) {
            return presetService.resolvePresetChain(filePath).effective.preset;
        }
    }
    return presetService.getDefaultPreset();
}
function countQueue(queue) {
    let due = 0;
    let newCount = 0;
    let learning = 0;
    for (const card of queue) {
        switch (card.fsrs.state) {
            case State.New:
                newCount++;
                break;
            case State.Review:
                due++;
                break;
            case State.Learning:
            case State.Relearning:
                learning++;
                break;
        }
    }
    return { due, learning, new: newCount };
}
export function computeActionableSessionSnapshot(deps, filters, options = {}) {
    var _a, _b, _c, _d, _e;
    const cacheKey = buildScopeCacheKey(filters);
    const cached = (_a = options.cache) === null || _a === void 0 ? void 0 : _a.get(cacheKey);
    if (cached)
        return cached;
    const activeCards = (_b = options.activeCards) !== null && _b !== void 0 ? _b : filterActiveCards(deps.allCards, {
        stateFilter: filters.stateFilter,
        archivedSourceUids: new Set(deps.archivedSourceUids),
    });
    const sessionPreset = resolveSessionPresetForFilters(filters, deps.presetService, deps.noteResolver);
    const queueOptions = buildQueueOptions(filters, deps.settings, deps.sessionPersistence, sessionPreset);
    if (filters.sourceUidFilter) {
        queueOptions.sourceUidFilter = new Set([filters.sourceUidFilter]);
    }
    if (isGlobalReviewSession(filters)) {
        const presetContext = buildGlobalPresetQueueContext(activeCards, deps.presetService, deps.sessionPersistence);
        queueOptions.cardPresetById = presetContext.cardPresetById;
        queueOptions.presetDailyLimits = presetContext.presetDailyLimits;
        queueOptions.presetProgressToday = presetContext.presetProgressToday;
        queueOptions.defaultPresetName = presetContext.defaultPresetName;
    }
    if (filters.projectPath && deps.hierarchyService) {
        const projectSourceUids = deps.hierarchyService.getSourceUidsForProject(filters.projectPath);
        if (!queueOptions.sourceUidFilter) {
            queueOptions.sourceUidFilter = projectSourceUids;
        }
        else {
            const intersected = new Set();
            for (const uid of queueOptions.sourceUidFilter) {
                if (projectSourceUids.has(uid)) {
                    intersected.add(uid);
                }
            }
            queueOptions.sourceUidFilter = intersected;
        }
    }
    const reviewService = (_c = deps.reviewService) !== null && _c !== void 0 ? _c : new ReviewService();
    const fsrsSettings = extractFSRSSettings(deps.settings);
    const fsrsService = (_d = deps.fsrsService) !== null && _d !== void 0 ? _d : new FSRSService(fsrsSettings);
    const queue = reviewService.buildQueue(activeCards, fsrsService, queueOptions);
    const snapshot = {
        queue,
        counts: countQueue(queue),
        queueLength: queue.length,
    };
    (_e = options.cache) === null || _e === void 0 ? void 0 : _e.set(cacheKey, snapshot);
    return snapshot;
}
