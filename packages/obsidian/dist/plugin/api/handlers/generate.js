import { __awaiter } from "tslib";
import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import { FlashcardGenerationService } from "@true-recall/core/ai/generation/flashcard-generation.service";
import { fixBlockSourceTexts } from "@true-recall/core/ai/utils/source-text-fixer";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleGenerate(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        if (!hasAIKey(ctx.plugin.settings)) {
            sendError(res, 400, "No AI key configured. Add your Pro key or OpenRouter API key in plugin settings.");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!(body === null || body === void 0 ? void 0 : body.text)) {
            sendError(res, 400, "Body must contain { text: string }");
            return;
        }
        const noteType = body.note_type_slug
            ? ctx.plugin.flashcardManager.getNoteTypeBySlug(body.note_type_slug)
            : null;
        const { ObsidianHttpClient } = yield import("@true-recall/obsidian/adapters/ObsidianHttpClient");
        const service = new FlashcardGenerationService(() => ctx.plugin.settings, (slug) => ctx.plugin.flashcardManager.getNoteTypeBySlug(slug), new ObsidianHttpClient());
        let result;
        try {
            result = yield service.generate(body.text, noteType);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            sendError(res, 502, `AI generation failed: ${message}`);
            return;
        }
        if (result.blocks.length === 0) {
            sendOk(res, {
                created: 0,
                cards: [],
                message: "AI returned no parseable flashcards",
            });
            return;
        }
        // Resolve source UID: use provided, or derive from active note
        let sourceUid = body.source_uid;
        if (!sourceUid) {
            const file = ctx.plugin.app.workspace.getActiveFile();
            if (file && file.extension === "md") {
                const frontmatterService = ctx.plugin.flashcardManager.getFrontmatterService();
                sourceUid =
                    (_a = (yield frontmatterService.getSourceNoteUid(file.path))) !== null && _a !== void 0 ? _a : undefined;
                if (!sourceUid) {
                    sourceUid = frontmatterService.generateUid();
                    yield frontmatterService.setSourceNoteUid(file.path, sourceUid);
                }
            }
        }
        fixBlockSourceTexts(result.blocks, body.text);
        const noteParams = result.blocks.map((block) => ({
            noteTypeId: block.noteTypeId,
            fields: block.fields,
            alwaysTypeIn: block.alwaysTypeIn,
            sourceUid,
            sourceText: block.sourceText,
            createdVia: "ai",
        }));
        const batchResult = ctx.plugin.flashcardManager.createNoteBatch(noteParams);
        sendOk(res, {
            created: batchResult.cards.length,
            cards: batchResult.cards.map((c) => {
                var _a, _b, _c;
                return ({
                    id: c.id,
                    question: (_a = c.question) !== null && _a !== void 0 ? _a : "",
                    answer: (_b = c.answer) !== null && _b !== void 0 ? _b : "",
                    cardType: (_c = c.cardType) !== null && _c !== void 0 ? _c : "basic",
                    sourceText: c.sourceText,
                });
            }),
        });
    });
}
export function handleGetNoteTypes(_req, res, ctx) {
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const noteTypes = ctx.plugin.cardStore.noteTypes.getAll();
    sendOk(res, noteTypes.map((nt) => ({
        id: nt.id,
        name: nt.name,
        slug: nt.slug,
        type: nt.type === 0 ? "standard" : "cloze",
        fields: nt.fields,
        isBuiltin: nt.isBuiltin,
    })));
}
