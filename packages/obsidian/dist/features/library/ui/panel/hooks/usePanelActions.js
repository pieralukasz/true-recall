import { __awaiter } from "tslib";
import { getHighlightColor } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import { extractHighlights } from "@true-recall/obsidian/features/library/ui/panel/utils/highlight-extractor";
import { cardsToBlockText } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { pushDeleteUndo } from "@true-recall/obsidian/services/undo.service";
import { BUILTIN_BASIC_ID } from "@true-recall/core/types/note.types";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
import { usePanelStore } from "./usePanelStore";
export function usePanelActions() {
    const plugin = usePlugin();
    const app = useApp();
    const { currentFile, flashcardInfo, cardsWithFsrs, panel } = usePanelStore();
    // ── AI generation ──
    const handleGenerateFromNote = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        if (!currentFile)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        if (!plugin.settings.proKey && !plugin.settings.openRouterApiKey) {
            notify().aiNotConfigured();
            return;
        }
        const content = yield app.vault.read(currentFile);
        if (!content.trim()) {
            notify().warning("Note is empty");
            return;
        }
        const { ChunkedGenerationService } = yield import("@true-recall/core/ai/generation/chunked-generation.service");
        const { ObsidianHttpClient } = yield import("@true-recall/obsidian/adapters/ObsidianHttpClient");
        const chunkedService = new ChunkedGenerationService(() => plugin.settings, plugin.flashcardManager, new ObsidianHttpClient());
        try {
            const basicNoteType = (_c = (_b = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.noteTypes) === null || _b === void 0 ? void 0 : _b.getById(BUILTIN_BASIC_ID)) !== null && _c !== void 0 ? _c : null;
            const result = yield chunkedService.generateFromNote(content, currentFile, basicNoteType);
            if (result.created === 0 && result.duplicates === 0) {
                notify().warning("No flashcards generated from this note");
            }
            else if (result.duplicates > 0) {
                notify().cardsCreatedWithDuplicates(result.created, result.duplicates, currentFile.basename);
            }
            else {
                notify().cardsCreated(result.created, currentFile.basename);
            }
            if (result.failedChunks > 0) {
                notify().warning(`${result.failedChunks} of ${result.totalChunks} sections failed: ${result.errors.join("; ")}`);
            }
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            const msg = error instanceof Error ? error.message : String(error);
            notify().error(`Flashcard generation failed: ${msg}`);
        }
    }), [currentFile, app, plugin]);
    const handleGenerateFromHighlights = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        if (!currentFile)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        if (!plugin.settings.proKey && !plugin.settings.openRouterApiKey) {
            notify().aiNotConfigured();
            return;
        }
        const content = yield app.vault.read(currentFile);
        const highlights = extractHighlights(content);
        if (highlights.length === 0) {
            notify().warning("No highlights found in note");
            return;
        }
        const frontmatterService = plugin.flashcardManager.getFrontmatterService();
        const sourceUid = yield frontmatterService.getSourceNoteUid(currentFile.path);
        const existingSourceTexts = sourceUid
            ? ((_b = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.getCardsBySourceUid(sourceUid)) !== null && _b !== void 0 ? _b : [])
                .map((c) => { var _a; return (_a = c.sourceText) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase(); })
                .filter(Boolean)
            : [];
        const newHighlights = existingSourceTexts.length > 0
            ? highlights.filter((h) => {
                const normalized = h.trim().toLowerCase();
                return !existingSourceTexts.some((st) => st.includes(normalized) || normalized.includes(st));
            })
            : highlights;
        if (newHighlights.length === 0) {
            notify().warning("All highlights already have flashcards");
            return;
        }
        const joinedHighlights = newHighlights.join("\n\n");
        const { StreamingGenerationService } = yield import("@true-recall/core/ai/generation/streaming-generation.service");
        const { ObsidianHttpClient: HttpClient } = yield import("@true-recall/obsidian/adapters/ObsidianHttpClient");
        const streamingService = new StreamingGenerationService(() => plugin.settings, plugin.flashcardManager, new HttpClient());
        try {
            const basicNoteType = (_e = (_d = (_c = plugin.cardStore) === null || _c === void 0 ? void 0 : _c.noteTypes) === null || _d === void 0 ? void 0 : _d.getById(BUILTIN_BASIC_ID)) !== null && _e !== void 0 ? _e : null;
            const result = yield streamingService.generateStreaming(joinedHighlights, currentFile, basicNoteType);
            if (result.created === 0 && result.duplicates === 0) {
                notify().warning("No flashcards generated from highlights");
            }
            else if (result.duplicates > 0) {
                notify().cardsCreatedWithDuplicates(result.created, result.duplicates, currentFile.basename);
            }
            else {
                notify().cardsCreated(result.created, currentFile.basename);
            }
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            const msg = error instanceof Error ? error.message : String(error);
            notify().error(`Flashcard generation failed: ${msg}`);
        }
    }), [currentFile, app, plugin]);
    // ── Collection ──
    const handleCollect = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!currentFile)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const { CollectService } = yield import("@true-recall/core/flashcard/lifecycle/collect.service");
        if (!plugin.flashcardManager.hasStore()) {
            notify().error("Flashcard store not ready. Please restart Obsidian.");
            return;
        }
        try {
            const getNoteType = (slug) => plugin.noteTypeService.getBySlug(slug);
            const collectService = new CollectService(getNoteType);
            const content = yield app.vault.read(currentFile);
            const collectResult = collectService.collect(content);
            if (collectResult.collectedCount === 0) {
                notify().info("No flashcards to collect");
                return;
            }
            const frontmatterService = plugin.flashcardManager.getFrontmatterService();
            const sourceUid = yield frontmatterService.getSourceNoteUid(currentFile.path);
            const contentToSave = plugin.settings.removeFlashcardContentAfterCollect
                ? collectResult.newContentWithoutFlashcards
                : collectResult.newContent;
            yield app.vault.process(currentFile, () => contentToSave);
            const { notes, cards } = plugin.flashcardManager.createNoteBatch(collectResult.parsedBlocks.map((block) => ({
                noteTypeId: block.noteTypeId,
                fields: block.fields,
                sourceUid: sourceUid !== null && sourceUid !== void 0 ? sourceUid : undefined,
                sourceText: block.sourceText,
                alwaysTypeIn: block.alwaysTypeIn,
                createdVia: "collect",
            })));
            if (cards.length === 0) {
                notify().info("No new flashcards collected");
            }
            else {
                notify().success(`Collected ${notes.length} note(s) → ${cards.length} card(s)`);
            }
        }
        catch (error) {
            notify().operationFailed("collect flashcards", error);
        }
    }), [currentFile, app, plugin]);
    // ── Export ──
    const handleExportCsv = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        if (!(flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.flashcards) || flashcardInfo.flashcards.length === 0) {
            notify().warning("No flashcards to export");
            return;
        }
        const escapeCSV = (str) => {
            if (str.includes(",") || str.includes("\n") || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        const header = "Question,Answer";
        const rows = flashcardInfo.flashcards.map((card) => `${escapeCSV(card.question)},${escapeCSV(card.answer)}`);
        const csvContent = [header, ...rows].join("\n");
        const filename = currentFile
            ? `${currentFile.basename}-flashcards.csv`
            : "flashcards.csv";
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        notify().success(`Exported ${flashcardInfo.flashcards.length} flashcard(s) to CSV`);
    }), [flashcardInfo, currentFile]);
    const handleCopyAllToClipboard = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        if (!(flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.flashcards) || flashcardInfo.flashcards.length === 0) {
            notify().warning("No flashcards to copy");
            return;
        }
        const text = cardsToBlockText(flashcardInfo.flashcards, plugin);
        yield navigator.clipboard.writeText(text);
        notify().success(`Copied ${flashcardInfo.flashcards.length} flashcard(s) to clipboard`);
    }), [flashcardInfo, plugin]);
    // ── Navigation ──
    const handleReview = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!currentFile)
            return;
        yield plugin.reviewNoteFlashcards(currentFile);
    }), [currentFile, plugin]);
    const handleOpenSourceNote = useCallback(() => {
        if (!currentFile)
            return;
        void app.workspace.getLeaf("tab").openFile(currentFile);
    }, [currentFile, app]);
    // ── Source highlighting ──
    const handleJumpToSource = useCallback((card) => __awaiter(this, void 0, void 0, function* () {
        if (!card.sourceText || !currentFile)
            return;
        const { requestSourceHighlight } = yield import("@true-recall/obsidian/services/signals");
        const filePath = currentFile.path;
        const fsrsCard = cardsWithFsrs.find((c) => c.id === card.id);
        const colorHint = getHighlightColor(fsrsCard);
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile || activeFile.path !== filePath) {
            const leaf = app.workspace.getLeaf(false);
            yield leaf.openFile(currentFile);
        }
        requestSourceHighlight(filePath, card.sourceText, "jump", colorHint);
    }), [currentFile, app, cardsWithFsrs]);
    const handleHoverSource = useCallback((card) => {
        if (!card.sourceText || !currentFile)
            return;
        const sourceText = card.sourceText;
        const fsrsCard = cardsWithFsrs.find((c) => c.id === card.id);
        const colorHint = getHighlightColor(fsrsCard);
        void import("@true-recall/obsidian/services/signals").then(({ requestSourceHighlight }) => {
            requestSourceHighlight(currentFile === null || currentFile === void 0 ? void 0 : currentFile.path, sourceText, "hover", colorHint);
        });
    }, [currentFile, cardsWithFsrs]);
    const handleLeaveSource = useCallback(() => {
        void import("@true-recall/obsidian/services/signals").then(({ clearSourceHighlight }) => {
            clearSourceHighlight();
        });
    }, []);
    // ── Search ──
    const handleSearchChange = useCallback((query) => {
        panel.setSearchQuery(query);
    }, [panel]);
    const handleBrowseDeck = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!(flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.sourceUid))
            return;
        yield plugin.openCardBrowser({ sourceUid: flashcardInfo.sourceUid });
    }), [flashcardInfo, plugin]);
    // ── Bulk operations (all cards) ──
    const handleForgetAll = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!flashcardInfo || flashcardInfo.flashcards.length === 0)
            return;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        const { notifyCardChange } = yield import("@true-recall/obsidian/services/signals");
        const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
        const count = flashcardInfo.flashcards.length;
        const confirmed = yield confirm(app, {
            message: `Forget all ${count} flashcard(s) for this note? This resets scheduling and clears review history.`,
        });
        if (!confirmed)
            return;
        const cardIds = flashcardInfo.flashcards.map((card) => card.id);
        const forgotten = plugin.cardStore.cards.bulkForget(cardIds);
        if (forgotten === 0) {
            notify().warning("Forget is only available for non-New cards");
            return;
        }
        (_a = plugin.sessionPersistence) === null || _a === void 0 ? void 0 : _a.removeReviewedCards(cardIds);
        notifyCardChange({ type: "bulk", cardIds, action: "reset" });
        notify().cardsForgotten(forgotten);
    }), [flashcardInfo, plugin]);
    const handleDeleteAll = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        if (!flashcardInfo || flashcardInfo.flashcards.length === 0)
            return;
        const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
        const count = flashcardInfo.flashcards.length;
        const confirmed = yield confirm(app, {
            message: `Delete all ${count} flashcard(s) for this note?`,
        });
        if (!confirmed)
            return;
        const cardIds = flashcardInfo.flashcards.map((card) => card.id);
        const result = plugin.flashcardManager.removeFlashcardsByIdsWithDetails(cardIds);
        if (result.ok) {
            pushDeleteUndo(plugin, result);
        }
        notify().cardsDeletedWithUndo(result.affectedCount, () => {
            var _a;
            void ((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
        });
    }), [flashcardInfo, plugin]);
    const handleDeleteNoteAndCards = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { notify } = yield import("@true-recall/obsidian/services/notification.service");
        if (!currentFile)
            return;
        const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
        const count = (_a = flashcardInfo === null || flashcardInfo === void 0 ? void 0 : flashcardInfo.flashcards.length) !== null && _a !== void 0 ? _a : 0;
        const confirmed = yield confirm(app, {
            message: `Delete "${currentFile.basename}" and its ${count} flashcard(s)? This cannot be undone.`,
        });
        if (!confirmed)
            return;
        try {
            if (count > 0 && flashcardInfo) {
                const cardIds = flashcardInfo.flashcards.map((card) => card.id);
                plugin.flashcardManager.removeFlashcardsByIdsWithDetails(cardIds);
            }
            yield app.vault.trash(currentFile, true);
            notify().success(`Deleted note and ${count} flashcard(s)`);
            yield plugin.openDashboard();
        }
        catch (error) {
            console.error("[True Recall] Failed to delete note and cards:", error);
            notify().error("Failed to delete note. Some flashcards may have been removed.");
        }
    }), [currentFile, flashcardInfo, plugin, app]);
    return {
        handleGenerateFromNote,
        handleGenerateFromHighlights,
        handleCollect,
        handleExportCsv,
        handleCopyAllToClipboard,
        handleReview,
        handleOpenSourceNote,
        handleBrowseDeck,
        handleJumpToSource,
        handleHoverSource,
        handleLeaveSource,
        handleSearchChange,
        handleForgetAll,
        handleDeleteAll,
        handleDeleteNoteAndCards,
    };
}
