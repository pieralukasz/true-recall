import { __awaiter } from "tslib";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleStartSession(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        const mode = (_a = body === null || body === void 0 ? void 0 : body.mode) !== null && _a !== void 0 ? _a : "all_due";
        switch (mode) {
            case "current_note": {
                const file = ctx.plugin.app.workspace.getActiveFile();
                if (!file || file.extension !== "md") {
                    sendError(res, 404, "No active markdown note");
                    return;
                }
                yield ctx.plugin.reviewNoteFlashcards(file);
                sendOk(res, { started: true, mode, note: file.basename });
                return;
            }
            case "created_today": {
                yield ctx.plugin.reviewTodaysCards();
                sendOk(res, { started: true, mode });
                return;
            }
            case "weak_cards": {
                yield ctx.plugin.openReviewViewWithFilters({
                    weakCardsOnly: true,
                    ignoreDailyLimits: true,
                    bypassScheduling: true,
                });
                sendOk(res, { started: true, mode });
                return;
            }
            case "overdue": {
                yield ctx.plugin.openReviewViewWithFilters({
                    overdueOnly: true,
                    ignoreDailyLimits: true,
                });
                sendOk(res, { started: true, mode });
                return;
            }
            case "custom": {
                yield ctx.plugin.openReviewViewWithFilters({
                    sourceUidFilter: body === null || body === void 0 ? void 0 : body.source_uid,
                    cardLimit: body === null || body === void 0 ? void 0 : body.card_limit,
                    stateFilter: body === null || body === void 0 ? void 0 : body.state_filter,
                    overdueOnly: body === null || body === void 0 ? void 0 : body.overdue_only,
                    recentlyFailed: body === null || body === void 0 ? void 0 : body.recently_failed,
                    crammingMode: body === null || body === void 0 ? void 0 : body.cramming,
                    ignoreDailyLimits: true,
                });
                sendOk(res, { started: true, mode, filters: body });
                return;
            }
            default: {
                // "all_due" — standard review with daily limits
                yield ctx.plugin.openReviewViewWithFilters({});
                sendOk(res, { started: true, mode: "all_due" });
            }
        }
    });
}
