import { __awaiter } from "tslib";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleOpenView(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!(body === null || body === void 0 ? void 0 : body.view)) {
            sendError(res, 400, "Body must contain { view: string }");
            return;
        }
        switch (body.view) {
            case "dashboard":
                yield ctx.plugin.openDashboard();
                sendOk(res, { opened: "dashboard" });
                return;
            case "stats":
                yield ctx.plugin.openStats();
                sendOk(res, { opened: "stats" });
                return;
            case "card-browser":
                yield ctx.plugin.openCardBrowser(body.source_uid ? { sourceUid: body.source_uid } : undefined);
                sendOk(res, { opened: "card-browser", sourceUid: body.source_uid });
                return;
            case "card-browser-orphaned":
                yield ctx.plugin.openCardBrowser({ orphaned: true });
                sendOk(res, { opened: "card-browser", orphaned: true });
                return;
            case "flashcard-panel":
                yield ctx.plugin.activateView();
                sendOk(res, { opened: "flashcard-panel" });
                return;
            case "simulator":
                yield ctx.plugin.openSimulator();
                sendOk(res, { opened: "simulator" });
                return;
            default:
                sendError(res, 400, `Unknown view: ${body.view}. Available: dashboard, stats, card-browser, card-browser-orphaned, flashcard-panel, simulator`);
        }
    });
}
export function handleOpenNote(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!(body === null || body === void 0 ? void 0 : body.path)) {
            sendError(res, 400, "Body must contain { path: string }");
            return;
        }
        const file = ctx.plugin.app.vault.getAbstractFileByPath(body.path);
        if (!file) {
            sendError(res, 404, `File not found: ${body.path}`);
            return;
        }
        yield ctx.plugin.app.workspace.openLinkText(body.path, "", false);
        sendOk(res, { opened: body.path });
    });
}
