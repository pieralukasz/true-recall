import { __awaiter } from "tslib";
import { sendError, sendOk } from "../api.types";
export function handleGetStatus(_req, res, ctx) {
    sendOk(res, {
        running: true,
        dbReady: ctx.plugin.isStoreReady(),
        vault: ctx.plugin.app.vault.getName(),
    });
}
export function handleGetActiveNote(_req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const file = ctx.plugin.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") {
            sendError(res, 404, "No active markdown note");
            return;
        }
        const content = yield ctx.plugin.app.vault.read(file);
        let sourceUid;
        let cards = [];
        if (ctx.plugin.isStoreReady()) {
            const frontmatterService = ctx.plugin.flashcardManager.getFrontmatterService();
            sourceUid = (_a = (yield frontmatterService.getSourceNoteUid(file.path))) !== null && _a !== void 0 ? _a : undefined;
            if (sourceUid) {
                const rawCards = ctx.plugin.cardStore.cards.getCardsBySourceUid(sourceUid);
                cards = rawCards.map((c) => {
                    var _a, _b;
                    return ({
                        id: c.id,
                        question: (_a = c.question) !== null && _a !== void 0 ? _a : "",
                        answer: (_b = c.answer) !== null && _b !== void 0 ? _b : "",
                        state: c.state,
                        due: c.due,
                        reps: c.reps,
                        lapses: c.lapses,
                    });
                });
            }
        }
        sendOk(res, {
            path: file.path,
            basename: file.basename,
            content,
            sourceUid,
            cardCount: cards.length,
            cards,
        });
    });
}
