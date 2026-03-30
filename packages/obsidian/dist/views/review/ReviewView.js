import { __awaiter } from "tslib";
import { effect } from "@preact/signals";
import { SemanticAnswerGradingService } from "@true-recall/core/ai/grading/semantic-answer-grading.service";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import { extractFSRSSettings, } from "@true-recall/core/types";
import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";
import { AnswerHandler, CardActionsHandler, EditHandler, KeyboardHandler, } from "@true-recall/obsidian/features/study/ui/review/handlers";
import { applyMutation, assessTypedAnswer, deriveTypeInMode, filterActiveCards, getEmptyQueueMessage, getTypeInModeStorage, isRatingLockedForTypeIn, isTypeInRequiredForCard, nextTypeInMode, persistTypeInMode, readPersistedTypeInMode, shouldRunAIGradingOnReveal, } from "@true-recall/obsidian/features/study/ui/review/helpers";
import { filtersFromViewState, filtersToViewState, isCustomSession, } from "@true-recall/obsidian/features/study/ui/review/review.types";
import { mountPreact } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { refreshCards } from "@true-recall/obsidian/services/reactive-card-store";
import { lastMutation } from "@true-recall/obsidian/services/signals";
import { ReviewApp, ReviewEmptyState, } from "@true-recall/obsidian/views/review/ReviewApp";
import { ItemView, Menu, TFile, } from "obsidian";
import { h } from "preact";
function createEmptyTypeInState(cardId = null) {
    return {
        cardId,
        typedAnswer: "",
        localAssessment: null,
        semanticResult: null,
        semanticMessage: null,
        isChecking: false,
    };
}
const SEMANTIC_PASS_THRESHOLD = 85;
export class ReviewView extends ItemView {
    get review() {
        const store = this.plugin.store;
        if (!store)
            throw new Error("Store not initialized");
        return store.getState().review;
    }
    constructor(leaf, plugin) {
        var _a;
        super(leaf);
        this.filters = {};
        this.crammedCardIds = new Set();
        this.isProcessingAnswer = false;
        this.presetCache = new Map();
        this.openNoteAction = null;
        this.unsubscribe = null;
        this.sessionSignalDisposer = null;
        this.typeInState = createEmptyTypeInState();
        this.sessionTypeInModeEnabled = false;
        this.aiEnabledForTypeIn = false;
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.reviewService = new ReviewService();
        this.sessionPersistence = plugin.sessionPersistence;
        this.semanticGradingService = new SemanticAnswerGradingService(() => this.plugin.settings, new ObsidianHttpClient());
        this.applyDefaultTypeInMode();
        const fsrsSettings = extractFSRSSettings(plugin.settings);
        this.fsrsService = new FSRSService(fsrsSettings);
        this.editHandler = new EditHandler({
            app: this.app,
            getReview: () => this.review,
            flashcardManager: this.flashcardManager,
            undoService: (_a = plugin.undoService) !== null && _a !== void 0 ? _a : undefined,
        });
        this.answerHandler = new AnswerHandler({
            getReview: () => this.review,
            plugin: this.plugin,
            fsrsService: this.fsrsService,
            reviewService: this.reviewService,
            flashcardManager: this.flashcardManager,
            sessionPersistence: this.sessionPersistence,
            getFilters: () => this.filters,
            getCrammedCardIds: () => this.crammedCardIds,
            getPresetCache: () => this.presetCache,
            semanticGradingService: this.semanticGradingService,
        });
        this.cardActionsHandler = new CardActionsHandler({
            app: this.app,
            getReview: () => this.review,
            flashcardManager: this.flashcardManager,
            fsrsService: this.fsrsService,
            reviewService: this.reviewService,
            cardStore: this.plugin.cardStore,
            settings: this.plugin.settings,
            plugin: this.plugin,
        }, {
            onUpdateSchedulingPreview: () => this.answerHandler.updateSchedulingPreview(),
        });
        this.keyboardHandler = new KeyboardHandler(() => this.review, {
            onShowAnswer: () => void this.handleReveal(),
            onAnswer: (rating) => this.handleAnswer(rating),
            onUndo: () => __awaiter(this, void 0, void 0, function* () {
                yield this.cardActionsHandler.handleUndo();
            }),
            onSuspend: () => this.cardActionsHandler.handleSuspend(),
            onForget: () => this.cardActionsHandler.handleForget(),
            onBuryCard: () => this.cardActionsHandler.handleBuryCard(),
            onBuryNote: () => this.cardActionsHandler.handleBuryNote(),
            onMoveCard: () => this.cardActionsHandler.handleMoveCard(),
            onAddCard: () => this.cardActionsHandler.handleAddNewFlashcard(),
            onEditCard: () => this.cardActionsHandler.handleEditCardModal(),
            onCycleTypeInMode: () => this.cycleTypeInMode(),
            canRateShortcuts: () => !this.isRatingLocked(),
            isTypeInActive: () => this.isTypeInRequiredForCurrentCard(),
            onFocusTypeIn: () => this.focusTypeInEditor(),
        });
    }
    getCurrentTypeInState(cardId) {
        if (this.typeInState.cardId !== cardId) {
            return createEmptyTypeInState(cardId);
        }
        return this.typeInState;
    }
    setTypeInState(cardId, patch) {
        const current = this.getCurrentTypeInState(cardId);
        this.typeInState = Object.assign(Object.assign(Object.assign({}, current), patch), { cardId });
        this.review.notifyChange();
    }
    resetTypeInState(cardId = null) {
        this.typeInState = createEmptyTypeInState(cardId);
    }
    applyDefaultTypeInMode() {
        const persisted = readPersistedTypeInMode(getTypeInModeStorage());
        const mode = persisted !== null && persisted !== void 0 ? persisted : this.plugin.settings.defaultTypeInMode;
        this.sessionTypeInModeEnabled = mode !== "off";
        this.aiEnabledForTypeIn = mode === "ai";
    }
    getTypeInMode() {
        return deriveTypeInMode(this.sessionTypeInModeEnabled, this.aiEnabledForTypeIn);
    }
    cycleTypeInMode() {
        var _a;
        const currentMode = this.getTypeInMode();
        const card = this.review.getCurrentCard();
        const alwaysTypeIn = !!((card === null || card === void 0 ? void 0 : card.alwaysTypeIn) || (card === null || card === void 0 ? void 0 : card.fsrs.alwaysTypeIn));
        const nextMode = nextTypeInMode(currentMode, alwaysTypeIn);
        const currentId = (_a = card === null || card === void 0 ? void 0 : card.id) !== null && _a !== void 0 ? _a : null;
        this.sessionTypeInModeEnabled = nextMode !== "off";
        this.aiEnabledForTypeIn = nextMode === "ai";
        persistTypeInMode(getTypeInModeStorage(), nextMode);
        // When answer is already revealed, preserve grading results —
        // the UI shows/hides assessment based on mode flags
        if (this.review.isAnswerRevealed) {
            this.review.notifyChange();
            notify().info(this.getTypeInModeMessage(nextMode));
            return;
        }
        if (nextMode === "off" || nextMode === "ai") {
            this.resetTypeInState(currentId);
            this.review.notifyChange();
        }
        else if (currentId) {
            // Keep typed input while switching AI -> Diff, clear grading state only.
            this.setTypeInState(currentId, {
                localAssessment: null,
                semanticResult: null,
                semanticMessage: null,
                isChecking: false,
            });
        }
        else {
            this.review.notifyChange();
        }
        notify().info(this.getTypeInModeMessage(nextMode));
    }
    getTypeInModeMessage(mode) {
        if (mode === "ai")
            return "Type in: AI";
        if (mode === "diff")
            return "Type in: Diff";
        return "Type in: Off";
    }
    isTypeInRequiredForCurrentCard() {
        return isTypeInRequiredForCard(this.review.getCurrentCard(), this.sessionTypeInModeEnabled);
    }
    focusTypeInEditor() {
        const container = this.containerEl.children[1];
        if (!(container instanceof HTMLElement))
            return;
        const cmContent = container.querySelector(".true-recall-add-field .cm-content");
        if (cmContent) {
            cmContent.focus();
            return;
        }
        // Fallback: textarea (when CodeMirror is unavailable)
        const textarea = container.querySelector("textarea");
        textarea === null || textarea === void 0 ? void 0 : textarea.focus();
    }
    isRatingLocked() {
        const card = this.review.getCurrentCard();
        if (!card)
            return false;
        const state = this.getCurrentTypeInState(card.id);
        return isRatingLockedForTypeIn({
            requiresTypeIn: this.isTypeInRequiredForCurrentCard(),
            isAnswerRevealed: this.review.isAnswerRevealed,
            isChecking: state.isChecking,
        });
    }
    handleTypedAnswerChange(value) {
        const card = this.review.getCurrentCard();
        if (!card || !this.isTypeInRequiredForCurrentCard())
            return;
        this.setTypeInState(card.id, {
            typedAnswer: value,
            localAssessment: null,
            semanticResult: null,
            semanticMessage: null,
            isChecking: false,
        });
    }
    handleReveal() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const card = this.review.getCurrentCard();
            if (!card)
                return;
            const requiresTypeIn = this.isTypeInRequiredForCurrentCard();
            if (!requiresTypeIn) {
                this.answerHandler.handleShowAnswer();
                return;
            }
            const state = this.getCurrentTypeInState(card.id);
            const typedAnswer = state.typedAnswer.trim();
            const shouldRunAI = shouldRunAIGradingOnReveal({
                requiresTypeIn,
                aiEnabled: this.aiEnabledForTypeIn,
                typedAnswer: state.typedAnswer,
                isChecking: state.isChecking,
            });
            // Type-in with AI disabled: local diff-only comparison.
            if (!this.aiEnabledForTypeIn) {
                // Skip diff assessment on empty input — just reveal the answer
                if (!typedAnswer) {
                    this.answerHandler.handleShowAnswer();
                    return;
                }
                const prepared = this.answerHandler.prepareTypedAnswerAssessment(state.typedAnswer);
                if (!prepared)
                    return;
                this.setTypeInState(card.id, {
                    localAssessment: prepared.localAssessment,
                    semanticResult: null,
                    semanticMessage: null,
                    isChecking: false,
                });
                return;
            }
            // AI mode enabled with empty input: plain reveal, no grading.
            if (!shouldRunAI) {
                this.answerHandler.handleShowAnswer();
                this.setTypeInState(card.id, {
                    localAssessment: null,
                    semanticResult: null,
                    semanticMessage: null,
                    isChecking: false,
                });
                return;
            }
            this.answerHandler.handleShowAnswer();
            const localAssessment = assessTypedAnswer((_a = card.answer) !== null && _a !== void 0 ? _a : "", typedAnswer);
            this.setTypeInState(card.id, {
                isChecking: true,
                localAssessment,
                semanticResult: null,
                semanticMessage: null,
            });
            let semanticResult = null;
            let semanticMessage = null;
            try {
                const sourceContext = yield this.resolveSourceContext(card);
                semanticResult = yield this.answerHandler.gradeTypedAnswerSemantically(card, typedAnswer, localAssessment.score, SEMANTIC_PASS_THRESHOLD, { allowLocalFallback: false, sourceContext });
            }
            catch (error) {
                semanticMessage =
                    error instanceof Error
                        ? error.message
                        : "AI grading unavailable. Please rate manually.";
            }
            const activeCard = this.review.getCurrentCard();
            if (!activeCard || activeCard.id !== card.id)
                return;
            this.setTypeInState(card.id, {
                isChecking: false,
                semanticResult,
                semanticMessage,
            });
        });
    }
    handleAnswer(rating) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (this.isProcessingAnswer)
                return;
            if (this.isRatingLocked())
                return;
            this.isProcessingAnswer = true;
            try {
                this.answerHandler.handleAnswer(rating);
                const nextCardId = (_b = (_a = this.review.getCurrentCard()) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null;
                this.resetTypeInState(nextCardId);
            }
            finally {
                this.isProcessingAnswer = false;
            }
        });
    }
    // ─── Obsidian lifecycle ──────────────────────────────────────────────
    setState(state, result) {
        const _super = Object.create(null, {
            setState: { get: () => super.setState }
        });
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.filters = filtersFromViewState((_a = state) !== null && _a !== void 0 ? _a : null);
            this.filters.dayStartHour = this.plugin.settings.dayStartHour;
            this.crammedCardIds.clear();
            this.isProcessingAnswer = false;
            this.applyDefaultTypeInMode();
            this.resetTypeInState();
            yield _super.setState.call(this, state, result);
            this.startSession();
        });
    }
    getState() {
        return filtersToViewState(this.filters);
    }
    getViewType() {
        return VIEW_TYPE_REVIEW;
    }
    getDisplayText() {
        return "Review session";
    }
    getIcon() {
        return "brain";
    }
    getCurrentReviewedCard() {
        return this.review.getCurrentCard();
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const container = this.containerEl.children[1];
            if (!(container instanceof HTMLElement))
                return;
            container.empty();
            this.applyDefaultTypeInMode();
            if (!this.plugin.store)
                return;
            this.unsubscribe = this.plugin.store.subscribe((state) => state.review, () => {
                this.updateHeaderActions();
            });
            (_a = this.plugin.undoService) === null || _a === void 0 ? void 0 : _a.setReviewStateManager(this.review, {
                onUpdateSchedulingPreview: () => this.answerHandler.updateSchedulingPreview(),
                onUndoAnswer: (payload, writeCancelled) => this.answerHandler.handleUndoAnswer(payload, writeCancelled),
            });
            this.registerDomEvent(document, "keydown", (e) => {
                const activeView = this.app.workspace.getActiveViewOfType(ReviewView);
                if (activeView !== this)
                    return;
                if (document.querySelector(".modal-container"))
                    return;
                this.keyboardHandler.handleKeyDown(e);
            });
        });
    }
    mountApp(container) {
        var _a, _b;
        (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unmountPreact = mountPreact(container, this.plugin, h(ReviewApp, {
            onShowAnswer: () => void this.handleReveal(),
            onTypedAnswerChange: (value) => this.handleTypedAnswerChange(value),
            onAnswer: (rating) => void this.handleAnswer(rating),
            onContentChange: (value, field) => void this.editHandler.saveContent(value, field),
            onOpenSourceNote: () => this.handleOpenSourceNote(),
            onClose: () => this.handleClose(),
            onNextSession: () => this.handleNextSession(),
            onEndSession: () => {
                /* handled in Preact component */
            },
            onActionsMenu: (e) => this.showActionsMenu(e),
            isCustomSession: isCustomSession(this.filters),
            crammingMode: (_b = this.filters.crammingMode) !== null && _b !== void 0 ? _b : false,
            showHeader: this.plugin.settings.showReviewHeader,
            showHeaderStats: this.plugin.settings.showReviewHeaderStats,
            showNextReviewTime: this.plugin.settings.showNextReviewTime,
            continuousCustomReviews: this.plugin.settings.continuousCustomReviews,
            onCycleTypeInMode: () => this.cycleTypeInMode(),
            getTypeInState: (card, isAnswerRevealed) => {
                const requiresTypeIn = isTypeInRequiredForCard(card, this.sessionTypeInModeEnabled);
                const state = this.getCurrentTypeInState(card.id);
                return {
                    typeInMode: this.getTypeInMode(),
                    useTypeInMode: requiresTypeIn,
                    aiEnabled: this.aiEnabledForTypeIn,
                    typedAnswer: state.typedAnswer,
                    isCheckingAnswer: state.isChecking,
                    isRatingLocked: isRatingLockedForTypeIn({
                        requiresTypeIn,
                        isAnswerRevealed,
                        isChecking: state.isChecking,
                    }),
                    localAssessment: state.localAssessment,
                    semanticResult: state.semanticResult,
                    semanticMessage: state.semanticMessage,
                };
            },
            getPresetName: (card) => this.answerHandler.resolvePreset(card).name,
            getPresetOptions: () => this.getPresetOptions(),
            onPresetChange: (name) => void this.handlePresetChange(name),
        }));
    }
    mountEmptyState(container, message) {
        var _a;
        (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unmountPreact = mountPreact(container, this.plugin, h(ReviewEmptyState, {
            message,
            onClose: () => this.handleClose(),
        }));
    }
    onClose() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            (_a = this.plugin.undoService) === null || _a === void 0 ? void 0 : _a.setReviewStateManager(null, null);
            (_b = this.plugin.undoService) === null || _b === void 0 ? void 0 : _b.clearSessionEntries();
            if (this.plugin.cardStore) {
                yield this.plugin.cardStore.flush();
            }
            (_c = this.unsubscribe) === null || _c === void 0 ? void 0 : _c.call(this);
            this.unsubscribeFromSessionEvents();
            (_d = this.unmountPreact) === null || _d === void 0 ? void 0 : _d.call(this);
            // Sync card data signal with FSRS changes accumulated during review
            // (skipped per-answer to avoid blocking rapid answers)
            refreshCards();
            if (this.openNoteAction) {
                this.openNoteAction.remove();
                this.openNoteAction = null;
            }
            this.review.reset();
            this.aiEnabledForTypeIn = false;
            this.resetTypeInState();
        });
    }
    // ─── Header actions (Obsidian native) ────────────────────────────────
    updateHeaderActions() {
        if (this.openNoteAction) {
            this.openNoteAction.remove();
            this.openNoteAction = null;
        }
        if (!this.review.isActive || !this.plugin.settings.showReviewHeader) {
            return;
        }
        this.openNoteAction = this.addAction("external-link", "Open note", () => this.handleOpenNote());
    }
    getPresetOptions() {
        return this.plugin.presetService.getPresets().map((p) => ({
            value: p.name,
            label: p.name,
            retention: p.requestRetention,
        }));
    }
    handlePresetChange(newPresetName) {
        var _a;
        const card = this.review.getCurrentCard();
        if (!card)
            return;
        const newPreset = this.plugin.presetService.getPresetByName(newPresetName);
        if (!newPreset) {
            notify().error(`Preset "${newPresetName}" not found`);
            return;
        }
        const sourceFile = this.resolveSourceFile(card);
        if (!sourceFile) {
            notify().warning("Cannot save preset: source note not found");
            return;
        }
        // Persist to frontmatter (async, fire-and-forget for UI responsiveness)
        void this.flashcardManager
            .getFrontmatterService()
            .setFsrsPreset(sourceFile.path, newPresetName);
        const uid = (_a = card.sourceUid) !== null && _a !== void 0 ? _a : "";
        this.presetCache.set(uid, newPreset);
        // Recalculate button intervals with new preset
        this.answerHandler.updateSchedulingPreview();
        // Force re-render so ButtonBar picks up new scheduling preview
        this.review.notifyChange();
    }
    // ─── Session lifecycle ───────────────────────────────────────────────
    startSession() {
        var _a, _b, _c;
        const container = this.containerEl.children[1];
        if (!(container instanceof HTMLElement))
            return;
        try {
            this.applyDefaultTypeInMode();
            const fsrsSettings = extractFSRSSettings(this.plugin.settings);
            this.fsrsService.updateSettings(fsrsSettings);
            const allCards = this.flashcardManager.getAllFSRSCards();
            if (allCards.length === 0) {
                this.mountEmptyState(container, "No flashcards found. Generate some flashcards first!");
                return;
            }
            const archivedSourceUids = this.plugin.hierarchyService.getArchivedSourceUids();
            const activeCards = filterActiveCards(allCards, {
                stateFilter: this.filters.stateFilter,
                archivedSourceUids,
            });
            if (activeCards.length === 0) {
                const msg = this.filters.stateFilter === "buried"
                    ? "No buried cards found."
                    : "All cards are suspended or buried. Unsuspend/unbury some cards to start reviewing.";
                this.mountEmptyState(container, msg);
                return;
            }
            if (!this.sessionPersistence) {
                this.sessionPersistence = this.plugin.sessionPersistence;
            }
            if (!this.sessionPersistence) {
                console.error("[ReviewView] sessionPersistence not initialized");
                this.mountEmptyState(container, "Session persistence not ready. Please try again.");
                return;
            }
            const snapshot = computeActionableSessionSnapshot({
                allCards,
                archivedSourceUids,
                settings: this.plugin.settings,
                sessionPersistence: this.sessionPersistence,
                presetService: this.plugin.presetService,
                metadataCache: this.app.metadataCache,
                hierarchyService: this.plugin.hierarchyService,
                fsrsService: this.fsrsService,
                reviewService: this.reviewService,
            }, this.filters, { activeCards });
            const queue = snapshot.queue;
            if (queue.length === 0) {
                this.mountEmptyState(container, getEmptyQueueMessage(this.filters.stateFilter));
                return;
            }
            // Pre-resolve presets for all cards (keyed by sourceUid for dedup)
            this.presetCache.clear();
            for (const card of queue) {
                const uid = (_a = card.sourceUid) !== null && _a !== void 0 ? _a : "";
                if (!this.presetCache.has(uid)) {
                    this.presetCache.set(uid, this.plugin.presetService.resolvePresetForCard(card, {
                        projectPath: this.filters.projectPath,
                    }));
                }
            }
            // Load full content (question/answer) only for the ~50 queue cards,
            // not all 3000+ in the collection. Queue was built from lightweight
            // CardSchedulingMeta; now we fetch rendered content for just these IDs.
            const queueIds = queue.map((c) => c.id);
            const fullQueue = this.flashcardManager.getCardsByIds(queueIds);
            this.review.startSession(fullQueue);
            this.resetTypeInState((_c = (_b = this.review.getCurrentCard()) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : null);
            this.subscribeToSessionEvents();
            this.answerHandler.updateSchedulingPreview();
            // Mount the Preact app now that the session is active
            this.mountApp(container);
        }
        catch (error) {
            console.error("Error starting review session:", error);
            notify().error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // ─── Signal-based mutation handling ──────────────────────────────────
    subscribeToSessionEvents() {
        this.unsubscribeFromSessionEvents();
        this.sessionSignalDisposer = effect(() => {
            const m = lastMutation.value;
            if (!m)
                return;
            // Skip "reviewed" — the queue is already updated synchronously
            // by recordAnswerAndNext() before persistence runs
            if (m.type === "reviewed")
                return;
            applyMutation(m, this.review, this.flashcardManager, this.plugin.cardStore, this.filters);
        });
    }
    unsubscribeFromSessionEvents() {
        var _a;
        (_a = this.sessionSignalDisposer) === null || _a === void 0 ? void 0 : _a.call(this);
        this.sessionSignalDisposer = null;
    }
    // ─── Actions menu ────────────────────────────────────────────────────
    showActionsMenu(event) {
        const menu = new Menu();
        const typeInMode = this.getTypeInMode();
        const typeInMenuLabel = typeInMode === "ai"
            ? "Type in: AI (t)"
            : typeInMode === "diff"
                ? "Type in: Diff (t)"
                : "Type in: Off (t)";
        menu.addItem((item) => item
            .setTitle(typeInMenuLabel)
            .setIcon("text-cursor-input")
            .onClick(() => this.cycleTypeInMode()));
        menu.addSeparator();
        if (this.cardActionsHandler.canUndo()) {
            menu.addItem((item) => item
                .setTitle("Undo last answer (z)")
                .setIcon("undo")
                .onClick(() => this.cardActionsHandler.handleUndo()));
            menu.addSeparator();
        }
        menu.addItem((item) => item
            .setTitle("Move card (m)")
            .setIcon("folder-input")
            .onClick(() => this.cardActionsHandler.handleMoveCard()));
        menu.addItem((item) => item
            .setTitle("Suspend card")
            .setIcon("pause")
            .onClick(() => this.cardActionsHandler.handleSuspend()));
        menu.addItem((item) => item
            .setTitle("Bury card (-)")
            .setIcon("eye-off")
            .onClick(() => this.cardActionsHandler.handleBuryCard()));
        menu.addItem((item) => item
            .setTitle("Bury note (=)")
            .setIcon("eye-off")
            .onClick(() => this.cardActionsHandler.handleBuryNote()));
        if (this.cardActionsHandler.canForgetCurrentCard()) {
            menu.addItem((item) => item
                .setTitle("Forget card (f)")
                .setIcon("rotate-ccw")
                .onClick(() => this.cardActionsHandler.handleForget()));
        }
        menu.addItem((item) => item
            .setTitle("Edit card (e)")
            .setIcon("pencil")
            .onClick(() => void this.cardActionsHandler.handleEditCardModal()));
        menu.addItem((item) => item
            .setTitle("Change note type")
            .setIcon("replace")
            .onClick(() => void this.cardActionsHandler.handleChangeNoteType()));
        menu.addItem((item) => item
            .setTitle("Add flashcard (a)")
            .setIcon("plus")
            .onClick(() => void this.cardActionsHandler.handleAddNewFlashcard()));
        menu.addItem((item) => item
            .setTitle("Add image occlusion")
            .setIcon("image")
            .onClick(() => void this.cardActionsHandler.handleAddImageOcclusion()));
        menu.addItem((item) => item
            .setTitle("Open source note")
            .setIcon("external-link")
            .onClick(() => this.handleOpenSourceNote()));
        menu.showAtMouseEvent(event);
    }
    resolveSourceContext(card) {
        return __awaiter(this, void 0, void 0, function* () {
            const MAX_CONTEXT_CHARS = 4000;
            if (card.sourceText) {
                return card.sourceText.slice(0, MAX_CONTEXT_CHARS);
            }
            const file = this.resolveSourceFile(card);
            if (!file)
                return undefined;
            try {
                const content = yield this.app.vault.cachedRead(file);
                return content.slice(0, MAX_CONTEXT_CHARS);
            }
            catch (_a) {
                return undefined;
            }
        });
    }
    // ─── Navigation ──────────────────────────────────────────────────────
    resolveSourceFile(card) {
        if (card.sourceUid && this.plugin.frontmatterIndex) {
            const filePath = this.plugin.frontmatterIndex.getFileByValue("flashcard_uid", card.sourceUid);
            if (filePath) {
                const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
                if (abstractFile instanceof TFile)
                    return abstractFile;
            }
        }
        if (card.sourceNotePath) {
            const abstractFile = this.app.vault.getAbstractFileByPath(card.sourceNotePath);
            if (abstractFile instanceof TFile) {
                return abstractFile;
            }
        }
        return null;
    }
    handleOpenSourceNote() {
        const card = this.review.getCurrentCard();
        if (!card || !card.sourceNoteName) {
            notify().warning("Source note not found");
            return;
        }
        const sourceFile = this.resolveSourceFile(card);
        if (sourceFile) {
            void this.app.workspace.openLinkText(sourceFile.path, "", false);
        }
        else {
            notify().warning(`Source note "${card.sourceNoteName}" not found`);
        }
    }
    handleOpenNote() {
        const card = this.review.getCurrentCard();
        if (!card)
            return;
        if (card.sourceNoteName) {
            this.handleOpenSourceNote();
        }
        else {
            notify().info("This card has no associated source note");
        }
    }
    handleClose() {
        this.leaf.detach();
    }
    handleNextSession() {
        this.leaf.detach();
        void this.plugin.activateView();
    }
}
