import { __awaiter } from "tslib";
import { StreamingGenerationService } from "@true-recall/core/ai/generation/streaming-generation.service";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { ObsidianHttpClient } from "../adapters/ObsidianHttpClient";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { BUILTIN_BASIC_ID } from "@true-recall/core/types/note.types";
let streamingService = null;
function getStreamingService(plugin) {
    if (!streamingService) {
        streamingService = new StreamingGenerationService(() => plugin.settings, plugin.flashcardManager, new ObsidianHttpClient());
    }
    return streamingService;
}
export function hasApiKey(plugin) {
    return !!(plugin.settings.proKey || plugin.settings.openRouterApiKey);
}
export function generateFlashcardsFromSelection(plugin, text) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const file = plugin.app.workspace.getActiveFile();
        if (!file) {
            notify().error("No active file");
            return;
        }
        try {
            yield plugin.activateView();
            const noteType = (_b = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.noteTypes.getById(BUILTIN_BASIC_ID)) !== null && _b !== void 0 ? _b : null;
            const service = getStreamingService(plugin);
            const result = yield service.generateStreaming(text, file, noteType);
            if (result.created === 0 && result.duplicates === 0) {
                notify().warning("No flashcards found in AI response");
            }
            else if (result.duplicates > 0) {
                notify().info(`Created ${result.created} flashcard(s), ${result.duplicates} duplicate(s) skipped`);
            }
            else {
                notify().info(`Created ${result.created} flashcard(s)`);
            }
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            const msg = error instanceof Error ? error.message : String(error);
            notify().error(`Flashcard generation failed: ${msg}`);
        }
    });
}
export function editSelectionAsFlashcard(plugin, text) {
    const modal = new QuickNoteEditorModal(plugin.app, plugin, {
        mode: "add",
        initialFields: { Front: text },
    });
    void modal.openAndWait();
}
export function quickAddFlashcardFromSelection(plugin, text) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const file = plugin.app.workspace.getActiveFile();
            if (!file) {
                notify().error("No active file");
                return;
            }
            const parts = text.split(/\n\s*\n/);
            const question = ((_a = parts[0]) !== null && _a !== void 0 ? _a : text).trim();
            const answer = parts.slice(1).join("\n\n").trim();
            yield plugin.flashcardManager.saveFlashcardsToSql(file.path, file.basename, [{ id: crypto.randomUUID(), question, answer }], undefined, text);
            notify().info("Quick-added 1 flashcard");
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            notify().error(`Quick add failed: ${msg}`);
        }
    });
}
