import { __awaiter } from "tslib";
import { FlashcardPanelApp, } from "@true-recall/obsidian/views/panel/FlashcardPanelApp";
import { extractHighlights } from "@true-recall/obsidian/features/library/ui/panel/utils/highlight-extractor";
import { cardsToBlockText } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { CollectService } from "@true-recall/core/flashcard/lifecycle/collect.service";
import { effect } from "@preact/signals";
import { VIEW_TYPE_FLASHCARD_PANEL } from "@true-recall/core/constants";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { cards, pluginSettings } from "@true-recall/obsidian/services/reactive-card-store";
import { pushDeleteUndo } from "@true-recall/obsidian/services/undo.service";
import { countCardsByState } from "@true-recall/obsidian/helpers";
import { mountPreact } from "@true-recall/obsidian/preact/mount";
import { ItemView, Platform, TFile, } from "obsidian";
import { h } from "preact";
export class FlashcardPanelView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        // Preact cleanup
        this.unmountPreact = null;
        // Review state subscription (for tracking current review card)
        this.reviewUnsubscribe = null;
        this.lastReviewCardPath = null;
        this.lastReviewActive = false;
        // Signal effect disposer for data change tracking
        this.signalDisposer = null;
        // Editor change timer for real-time #flashcard tag detection
        this.editorChangeTimer = null;
        // Flashcard info reload timer
        this.flashcardInfoTimer = null;
        // Header actions (Obsidian native view actions)
        this.reviewAction = null;
        this.openFileAction = null;
        this.deleteAllAction = null;
        // Store subscription for header actions
        this.headerActionsUnsub = null;
        // Mobile header FSRS status element
        this.mobileStatusEl = null;
        // Header stats update timer for debouncing
        this.headerStatsTimer = null;
        // Cache for getCardsWithFsrs() on mobile
        this.cachedCardsWithFsrs = null;
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.collectService = new CollectService((slug) => plugin.noteTypeService.getBySlug(slug));
    }
    get panel() {
        const store = this.plugin.store;
        if (!store)
            throw new Error("Store not initialized");
        return store.getState().panel;
    }
    getViewType() {
        return VIEW_TYPE_FLASHCARD_PANEL;
    }
    getDisplayText() {
        return "True Recall";
    }
    getIcon() {
        return "layers";
    }
    onPaneMenu(menu, source) {
        super.onPaneMenu(menu, source);
        if (!Platform.isMobile)
            return;
        const state = this.panel;
        if (!state.currentFile)
            return;
        menu.addItem((item) => {
            item
                .setTitle("Refresh")
                .setIcon("refresh-cw")
                .onClick(() => void this.loadFlashcardInfo());
        });
        const hasFlashcards = state.status === "exists";
        if (hasFlashcards) {
            menu.addSeparator();
            menu.addItem((item) => {
                item
                    .setTitle("Browse in card browser")
                    .setIcon("table-2")
                    .onClick(() => {
                    var _a;
                    const sourceUid = (_a = state.flashcardInfo) === null || _a === void 0 ? void 0 : _a.sourceUid;
                    if (sourceUid) {
                        void this.plugin.openCardBrowser({ sourceUid });
                    }
                });
            });
            menu.addItem((item) => {
                item
                    .setTitle("Copy to clipboard")
                    .setIcon("clipboard-copy")
                    .onClick(() => void this.handleCopyAllToClipboard());
            });
            menu.addItem((item) => {
                item
                    .setTitle("Export as CSV")
                    .setIcon("file-down")
                    .onClick(() => void this.handleExportCsv());
            });
            menu.addSeparator();
            menu.addItem((item) => {
                item
                    .setTitle("Open flashcard file")
                    .setIcon("file-text")
                    .onClick(() => void this.handleOpenFlashcardFile());
            });
            menu.addItem((item) => {
                item
                    .setTitle("Delete all flashcards")
                    .setIcon("trash-2")
                    .onClick(() => void this.handleDeleteAllFlashcards());
            });
        }
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const container = this.containerEl.children[1];
            if (!(container instanceof HTMLElement))
                return;
            container.empty();
            // Mount Preact app
            this.unmountPreact = mountPreact(container, this.plugin, h(FlashcardPanelApp, {
                onActions: (action) => {
                    if (action.type === "refresh") {
                        void this.loadFlashcardInfo();
                    }
                },
            }));
            // Subscribe to store for Obsidian native header actions
            if (this.plugin.store) {
                this.headerActionsUnsub = this.plugin.store.subscribe((s) => ({ status: s.panel.status, file: s.panel.currentFile }), () => this.updateHeaderActions());
            }
            this.subscribeToDataChanges();
            this.subscribeToReviewState();
            this.registerEditorChangeTracking();
            if (Platform.isMobile) {
                this.setupMobileHeaderStatus();
            }
            // If a review session is already active, sync with it instead of loading the active file
            const reviewState = (_b = (_a = this.plugin.store) === null || _a === void 0 ? void 0 : _a.getState()) === null || _b === void 0 ? void 0 : _b.review;
            if (reviewState === null || reviewState === void 0 ? void 0 : reviewState.isActive) {
                const currentCard = reviewState.getCurrentCard();
                const currentPath = (_c = currentCard === null || currentCard === void 0 ? void 0 : currentCard.sourceNotePath) !== null && _c !== void 0 ? _c : null;
                this.lastReviewCardPath = currentPath;
                this.lastReviewActive = true;
                void this.syncWithReviewCard(currentPath, true);
            }
            else {
                yield this.loadCurrentFile();
            }
        });
    }
    updateHeaderActions() {
        const state = this.panel;
        if (this.reviewAction) {
            this.reviewAction.remove();
            this.reviewAction = null;
        }
        if (this.openFileAction) {
            this.openFileAction.remove();
            this.openFileAction = null;
        }
        if (this.deleteAllAction) {
            this.deleteAllAction.remove();
            this.deleteAllAction = null;
        }
        const currentFile = state.currentFile;
        if (state.status === "exists" && currentFile) {
            if (!Platform.isMobile) {
                this.deleteAllAction = this.addAction("trash-2", "Delete all flashcards", () => void this.handleDeleteAllFlashcards());
                this.openFileAction = this.addAction("file-text", "Open flashcard file", () => void this.handleOpenFlashcardFile());
            }
            this.reviewAction = this.addAction("brain", "Review flashcards", () => void this.plugin.reviewNoteFlashcards(currentFile));
        }
    }
    onClose() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
            this.unmountPreact = null;
            (_b = this.reviewUnsubscribe) === null || _b === void 0 ? void 0 : _b.call(this);
            (_c = this.signalDisposer) === null || _c === void 0 ? void 0 : _c.call(this);
            (_d = this.headerActionsUnsub) === null || _d === void 0 ? void 0 : _d.call(this);
            if (this.editorChangeTimer) {
                clearTimeout(this.editorChangeTimer);
                this.editorChangeTimer = null;
            }
            if (this.flashcardInfoTimer) {
                clearTimeout(this.flashcardInfoTimer);
                this.flashcardInfoTimer = null;
            }
            if (this.headerStatsTimer) {
                clearTimeout(this.headerStatsTimer);
                this.headerStatsTimer = null;
            }
            if (this.reviewAction) {
                this.reviewAction.remove();
                this.reviewAction = null;
            }
            if (this.openFileAction) {
                this.openFileAction.remove();
                this.openFileAction = null;
            }
            if (this.deleteAllAction) {
                this.deleteAllAction.remove();
                this.deleteAllAction = null;
            }
            if (this.mobileStatusEl) {
                this.mobileStatusEl.remove();
                this.mobileStatusEl = null;
            }
        });
    }
    subscribeToDataChanges() {
        this.signalDisposer = effect(() => {
            void cards.value;
            void pluginSettings.value;
            this.invalidateCardsCache();
            this.scheduleHeaderStatsUpdate();
            this.scheduleFlashcardInfoReload();
        });
    }
    scheduleFlashcardInfoReload() {
        if (this.flashcardInfoTimer)
            clearTimeout(this.flashcardInfoTimer);
        this.flashcardInfoTimer = setTimeout(() => {
            this.flashcardInfoTimer = null;
            void this.loadFlashcardInfo();
        }, 100);
    }
    subscribeToReviewState() {
        const store = this.plugin.store;
        if (!store)
            return;
        this.reviewUnsubscribe = store.subscribe((state) => state.review, () => {
            var _a;
            const review = store.getState().review;
            const currentCard = review.getCurrentCard();
            const currentPath = (_a = currentCard === null || currentCard === void 0 ? void 0 : currentCard.sourceNotePath) !== null && _a !== void 0 ? _a : null;
            const isActive = review.isActive;
            if (currentPath !== this.lastReviewCardPath ||
                isActive !== this.lastReviewActive) {
                this.lastReviewCardPath = currentPath;
                this.lastReviewActive = isActive;
                void this.syncWithReviewCard(currentPath, isActive);
            }
        });
    }
    syncWithReviewCard(sourceNotePath, isActive) {
        return __awaiter(this, void 0, void 0, function* () {
            this.panel.setReviewFollowState(sourceNotePath, isActive);
            if (!isActive || !sourceNotePath) {
                const activeFile = this.app.workspace.getActiveFile();
                yield this.handleFileChange(activeFile);
                return;
            }
            const sourceFile = this.app.vault.getAbstractFileByPath(sourceNotePath);
            if (sourceFile instanceof TFile) {
                yield this.handleFileChange(sourceFile);
            }
        });
    }
    handleFileChange(file) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const state = this.panel;
            if (((_a = state.currentFile) === null || _a === void 0 ? void 0 : _a.path) === (file === null || file === void 0 ? void 0 : file.path)) {
                return;
            }
            this.panel.setCurrentFile(file);
            yield this.loadFlashcardInfo();
        });
    }
    isFollowingReview() {
        return this.panel.isFollowingReview;
    }
    clearReviewFollowState() {
        this.panel.setReviewFollowState(null, false);
    }
    syncWithReviewState(sourceNotePath, isActive) {
        this.lastReviewCardPath = sourceNotePath;
        this.lastReviewActive = isActive;
        void this.syncWithReviewCard(sourceNotePath, isActive);
    }
    loadCurrentFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.app.workspace.getActiveFile();
            this.panel.setCurrentFile(file);
            yield this.loadFlashcardInfo();
        });
    }
    loadFlashcardInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            this.invalidateCardsCache();
            const state = this.panel;
            const file = state.currentFile;
            if (state.selectionMode === "selecting") {
                this.panel.exitSelectionMode();
            }
            if (!this.flashcardManager.hasStore()) {
                return;
            }
            if (!file || file.extension !== "md") {
                this.panel.setFlashcardInfo(null);
                this.panel.setUncollectedInfo(0);
                return;
            }
            if (!this.app.vault.getAbstractFileByPath(file.path)) {
                this.panel.setFlashcardInfo(null);
                this.panel.setUncollectedInfo(0);
                return;
            }
            const renderVersion = this.panel.incrementRenderVersion();
            try {
                const [info, content] = yield Promise.all([
                    this.flashcardManager.getFlashcardInfo(file.path),
                    this.app.vault.read(file),
                ]);
                if (!this.panel.isCurrentRender(renderVersion))
                    return;
                const uncollectedCount = this.collectService.countFlashcardLines(content);
                const hasHighlights = extractHighlights(content).length > 0;
                this.invalidateCardsCache();
                this.panel.setState({
                    flashcardInfo: info,
                    status: (info === null || info === void 0 ? void 0 : info.exists) ? "exists" : "none",
                    sourceNoteName: null,
                    uncollectedCount,
                    hasHighlights,
                });
            }
            catch (error) {
                console.error("Error loading flashcard info:", error);
            }
        });
    }
    // ── Mobile-only methods ─────────────────────────────────
    scheduleHeaderStatsUpdate() {
        if (!Platform.isMobile)
            return;
        if (this.headerStatsTimer) {
            clearTimeout(this.headerStatsTimer);
        }
        this.headerStatsTimer = setTimeout(() => {
            this.updateMobileHeaderStatus();
            this.headerStatsTimer = null;
        }, 100);
    }
    getCardsWithFsrs() {
        var _a;
        if (this.cachedCardsWithFsrs !== null) {
            return this.cachedCardsWithFsrs;
        }
        const state = this.panel;
        if (!((_a = state.flashcardInfo) === null || _a === void 0 ? void 0 : _a.flashcards))
            return [];
        if (!this.flashcardManager.hasStore()) {
            return [];
        }
        const cardIds = state.flashcardInfo.flashcards.map((c) => c.id);
        this.cachedCardsWithFsrs = this.flashcardManager.getCardsByIds(cardIds);
        return this.cachedCardsWithFsrs;
    }
    invalidateCardsCache() {
        this.cachedCardsWithFsrs = null;
    }
    setupMobileHeaderStatus() {
        const titleContainer = this.containerEl.querySelector(".view-header-title-container");
        if (!titleContainer)
            return;
        const titleEl = titleContainer.querySelector(".view-header-title");
        if (titleEl) {
            titleEl.addClass("ep:hidden");
        }
        this.mobileStatusEl = document.createElement("div");
        this.mobileStatusEl.addClass("ep:flex", "ep:gap-1", "ep:items-center", "ep:text-ui-smaller");
        titleContainer.appendChild(this.mobileStatusEl);
    }
    updateMobileHeaderStatus(precomputedCards) {
        if (!this.mobileStatusEl)
            return;
        const cards = precomputedCards !== null && precomputedCards !== void 0 ? precomputedCards : this.getCardsWithFsrs();
        const counts = countCardsByState(cards);
        this.mobileStatusEl.empty();
        const newEl = this.mobileStatusEl.createSpan({ cls: "ep:text-obs-blue" });
        newEl.textContent = String(counts.new);
        this.mobileStatusEl.createSpan({
            cls: "ep:text-obs-faint",
            text: "\u00B7",
        });
        const learningEl = this.mobileStatusEl.createSpan({
            cls: "ep:text-obs-orange",
        });
        learningEl.textContent = String(counts.learning);
        this.mobileStatusEl.createSpan({
            cls: "ep:text-obs-faint",
            text: "\u00B7",
        });
        const reviewEl = this.mobileStatusEl.createSpan({
            cls: "ep:text-obs-green",
        });
        reviewEl.textContent = String(counts.review);
    }
    // ── Mobile pane menu handlers ───────────────────────────
    handleOpenFlashcardFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.panel;
            if (state.currentFile) {
                yield this.app.workspace.openLinkText(state.currentFile.path, "");
            }
        });
    }
    handleDeleteAllFlashcards() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.panel;
            if (!state.flashcardInfo || state.flashcardInfo.flashcards.length === 0)
                return;
            const count = state.flashcardInfo.flashcards.length;
            const { confirm } = yield import("@true-recall/obsidian/modals/shared/ConfirmModal");
            const confirmed = yield confirm(this.app, {
                message: `Delete all ${count} flashcard(s) for this note?`,
            });
            if (!confirmed)
                return;
            const cardIds = state.flashcardInfo.flashcards.map((card) => card.id);
            const result = this.flashcardManager.removeFlashcardsByIdsWithDetails(cardIds);
            if (result.ok) {
                pushDeleteUndo(this.plugin, result);
            }
            notify().cardsDeletedWithUndo(result.affectedCount, () => {
                var _a;
                void ((_a = this.plugin.undoService) === null || _a === void 0 ? void 0 : _a.undo());
            });
        });
    }
    handleCopyAllToClipboard() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const state = this.panel;
            if (!((_a = state.flashcardInfo) === null || _a === void 0 ? void 0 : _a.flashcards) ||
                state.flashcardInfo.flashcards.length === 0) {
                notify().warning("No flashcards to copy");
                return;
            }
            const text = cardsToBlockText(state.flashcardInfo.flashcards, this.plugin);
            yield navigator.clipboard.writeText(text);
            notify().success(`Copied ${state.flashcardInfo.flashcards.length} flashcard(s) to clipboard`);
        });
    }
    handleExportCsv() {
        var _a;
        const state = this.panel;
        if (!((_a = state.flashcardInfo) === null || _a === void 0 ? void 0 : _a.flashcards) ||
            state.flashcardInfo.flashcards.length === 0) {
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
        const rows = state.flashcardInfo.flashcards.map((card) => `${escapeCSV(card.question)},${escapeCSV(card.answer)}`);
        const csvContent = [header, ...rows].join("\n");
        const filename = state.currentFile
            ? `${state.currentFile.basename}-flashcards.csv`
            : "flashcards.csv";
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        notify().success(`Exported ${state.flashcardInfo.flashcards.length} flashcard(s) to CSV`);
    }
    registerEditorChangeTracking() {
        this.registerEvent(this.app.workspace.on("editor-change", () => {
            if (this.editorChangeTimer) {
                clearTimeout(this.editorChangeTimer);
            }
            this.editorChangeTimer = setTimeout(() => {
                void this.checkUncollectedFlashcards();
            }, 500);
        }));
    }
    checkUncollectedFlashcards() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.panel;
            const file = state.currentFile;
            if (!file || file.extension !== "md") {
                return;
            }
            try {
                const content = yield this.app.vault.read(file);
                const uncollectedCount = this.collectService.countFlashcardLines(content);
                const hasHighlights = extractHighlights(content).length > 0;
                if (state.uncollectedCount !== uncollectedCount) {
                    this.panel.setUncollectedInfo(uncollectedCount);
                }
                if (state.hasHighlights !== hasHighlights) {
                    this.panel.setHasHighlights(hasHighlights);
                }
            }
            catch (_a) {
                // Ignore errors (file might be deleted/moved)
            }
        });
    }
}
