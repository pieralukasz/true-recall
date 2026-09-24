import {
	ItemView,
	Menu,
	Scope,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";
import type { Grade } from "ts-fsrs";

import type { AssistantContext } from "@true-recall/core/ai/assistant";
import { SemanticAnswerGradingService } from "@true-recall/core/ai/grading/semantic-answer-grading.service";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import {
	extractFSRSSettings,
	type FSRSFlashcardItem,
	type FSRSPreset,
	type ReviewSessionTopUp,
} from "@true-recall/core/types";
import { isPreviewCustomStudy } from "@true-recall/core/types/review-session.types";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { CommandService, ReviewUndoHook } from "@true-recall/obsidian/commands";
import { G, getDataLayer } from "@true-recall/obsidian/data";
import { assistantContextFromCard } from "@true-recall/obsidian/features/assistant/ui/ai-context-source";
import {
	FACT_CHECK_QUEUED_MESSAGE,
	isFactCheckAvailable,
	startFactCheck,
} from "@true-recall/obsidian/features/assistant/ui/fact-check";
import { openAiWorkspace } from "@true-recall/obsidian/features/assistant/ui/open-ai-workspace";
import { ReviewSessionController } from "@true-recall/obsidian/features/study/services/ReviewSessionController";
import {
	AnswerHandler,
	CardActionsHandler,
	EditHandler,
	KeyboardHandler,
} from "@true-recall/obsidian/features/study/ui/review/handlers";
import {
	buildReviewFollowUpContext,
	getTypeInModeStorage,
} from "@true-recall/obsidian/features/study/ui/review/helpers";
import { ReviewSelectionBubble } from "@true-recall/obsidian/features/study/ui/review/ReviewSelectionBubble";
import {
	filtersFromViewState,
	filtersToViewState,
	type SessionFilters,
} from "@true-recall/obsidian/features/study/ui/review/review.types";
import { mountPreact } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { notifyReviewSessionCardGraded } from "@true-recall/obsidian/services/signals";
import {
	type AppStore,
	createAppStore,
	type ReviewApi,
} from "@true-recall/obsidian/store";
import { isMobile } from "@true-recall/obsidian/utils/platform";
import { runWhenLayoutReady } from "@true-recall/obsidian/views/layout-ready";
import {
	ReviewApp,
	ReviewEmptyState,
} from "@true-recall/obsidian/views/review/ReviewApp";

import type TrueRecallPlugin from "../../main";
import { isPluginEnabled } from "../../plugin/plugin-utils";
import { populateReviewActionsMenu } from "./ReviewActionsMenu";
import { createReviewModel } from "./ReviewPresenter";
import { ReviewPresetController } from "./ReviewPresetController";
import { ReviewSessionOrchestrator } from "./ReviewSessionOrchestrator";
import { ReviewSessionSubscriptions } from "./ReviewSessionSubscriptions";
import { ReviewSourceNavigator } from "./ReviewSourceNavigator";
import { TypeInController } from "./TypeInController";

export class ReviewView extends ItemView {
	private orchestrator: ReviewSessionOrchestrator;
	private subscriptions: ReviewSessionSubscriptions;
	private presets: ReviewPresetController;

	private typeIn: TypeInController;
	private sourceNavigator: ReviewSourceNavigator;

	private plugin: TrueRecallPlugin;
	private fsrsService: FSRSService;
	private reviewService: ReviewService;
	private reviewController: ReviewSessionController;
	private sessionStore: AppStore;
	private sessionCommandService: CommandService;
	private commandHistoryBaseline: number;
	private flashcardManager: FlashcardManager;
	private sessionPersistence: SessionPersistenceService;
	private semanticGradingService: SemanticAnswerGradingService;

	private filters: SessionFilters = {};
	private sessionKey?: string;
	private sessionLabel?: string;
	private readonly sessionId = crypto.randomUUID();
	private crammedCardIds = new Set<string>();
	private isProcessingAnswer = false;
	private presetCache = new Map<string, FSRSPreset>();

	private answerHandler!: AnswerHandler;
	private editHandler!: EditHandler;
	private cardActionsHandler!: CardActionsHandler;
	private keyboardHandler!: KeyboardHandler;
	private unmountPreact?: () => void;
	private openNoteAction: HTMLElement | null = null;
	private unsubscribe: (() => void) | null = null;
	private disposeReviewHook: (() => void) | null = null;
	private askBubble: ReviewSelectionBubble | null = null;
	private queuedFollowUpCount = 0;

	private get review(): ReviewApi {
		return this.sessionStore.getState().review;
	}

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.sourceNavigator = new ReviewSourceNavigator(plugin, () => this.review);
		this.typeIn = new TypeInController({
			getReview: () => this.review,
			getSettings: () => this.plugin.settings,
			getStorage: () => getTypeInModeStorage(this.plugin.app),
			showAnswer: () => this.answerHandler.handleShowAnswer(),
			grade: (card, answer, context) =>
				this.answerHandler.gradeTypedAnswerSemantically(card, answer, context),
			resolveGradingContext: (card) =>
				this.sourceNavigator.resolveGradingContext(card),
		});

		this.sessionStore = createAppStore({
			getSettings: () => this.plugin.settings,
		});
		this.sessionCommandService = new CommandService({
			flashcardManager: plugin.flashcardManager,
			cardStore: plugin.cardStore,
			sessionPersistence: plugin.sessionPersistence,
		});
		this.commandHistoryBaseline = CommandService.currentOrder();

		// Consume Escape while this view is active. Without this, Obsidian's
		// app-scope Escape handler re-activates the last `navigation` leaf
		// (this view has `navigation: false`), swapping the review tab out
		// for the most recent note tab.
		this.scope = new Scope(this.app.scope);
		this.scope.register([], "Escape", () => false);
		this.flashcardManager = plugin.flashcardManager;
		this.reviewService = new ReviewService();
		this.reviewController = new ReviewSessionController(
			plugin,
			() => this.review,
			this.sessionCommandService,
		);
		this.sessionPersistence = plugin.sessionPersistence;
		this.semanticGradingService = new SemanticAnswerGradingService(
			() => this.plugin.settings,
			new ObsidianHttpClient(),
		);
		this.typeIn.applyDefaultTypeInMode();

		const fsrsSettings = extractFSRSSettings(plugin.settings);
		this.fsrsService = new FSRSService(fsrsSettings);

		this.editHandler = new EditHandler({
			app: this.app,
			getReview: () => this.review,
			flashcardManager: this.flashcardManager,
			commandService: this.sessionCommandService,
		});

		this.answerHandler = new AnswerHandler({
			getReview: () => this.review,
			plugin: this.plugin,
			fsrsService: this.fsrsService,
			reviewService: this.reviewService,
			reviewController: this.reviewController,
			flashcardManager: this.flashcardManager,
			sessionPersistence: this.sessionPersistence,
			getFilters: () => this.filters,
			getCrammedCardIds: () => this.crammedCardIds,
			getPresetCache: () => this.presetCache,
			semanticGradingService: this.semanticGradingService,
		});

		this.cardActionsHandler = new CardActionsHandler(
			{
				app: this.app,
				getReview: () => this.review,
				flashcardManager: this.flashcardManager,
				fsrsService: this.fsrsService,
				reviewService: this.reviewService,
				cardStore: this.plugin.cardStore,
				settings: this.plugin.settings,
				plugin: this.plugin,
				commandService: this.sessionCommandService,
			},
			{
				onUpdateSchedulingPreview: () =>
					this.answerHandler.updateSchedulingPreview(),
			},
		);

		this.subscriptions = new ReviewSessionSubscriptions(
			plugin,
			() => this.review,
			() => this.filters,
			this.sessionId,
		);
		this.presets = new ReviewPresetController(
			plugin,
			this.presetCache,
			() => this.review,
			() => this.filters,
			this.sourceNavigator,
			() => this.answerHandler.updateSchedulingPreview(),
		);
		this.orchestrator = new ReviewSessionOrchestrator({
			plugin,
			controller: this.reviewController,
			fsrsService: this.fsrsService,
			commandService: this.sessionCommandService,
			getReview: () => this.review,
			getFilters: () => this.filters,
			setFilters: (filters) => {
				this.filters = filters;
			},
			cachePresets: (queue) => this.presets.cachePresetsForQueue(queue),
			onSessionStarted: () => {
				this.queuedFollowUpCount = 0;
				this.subscriptions.subscribeToSessionEvents();
			},
			onCardChanged: () => {
				this.typeIn.resetTypeInState(this.review.getCurrentCard()?.id ?? null);
				this.answerHandler.updateSchedulingPreview();
			},
		});
		this.keyboardHandler = new KeyboardHandler(
			() => this.review,
			{
				onShowAnswer: () => void this.typeIn.handleReveal(),
				onAnswer: (rating) => this.handleAnswer(rating as Grade),
				onUndo: async () => {
					await this.undoSessionAction();
				},
				onDelete: () => this.cardActionsHandler.handleDelete(),
				onSuspend: () => this.cardActionsHandler.handleSuspend(),
				onSetFlag: (flag) => this.cardActionsHandler.handleSetFlag(flag),
				onForget: () => this.cardActionsHandler.handleForget(),
				onBuryCard: () => this.cardActionsHandler.handleBuryCard(),
				onBuryNote: () => this.cardActionsHandler.handleBuryNote(),
				onMoveCard: () => this.cardActionsHandler.handleMoveCard(),
				onAddCard: () => this.cardActionsHandler.handleAddNewFlashcard(),
				onAddCardCopy: () =>
					this.cardActionsHandler.handleAddCopyOfCurrentFlashcard(),
				onEditCard: () => this.cardActionsHandler.handleEditCardModal(),
				onEditComment: () => this.cardActionsHandler.handleEditComment(),
				onCycleTypeInMode: () => this.typeIn.cycleTypeInMode(),
				canRateShortcuts: () => !this.typeIn.isRatingLocked(),
				isTypeInActive: () => this.typeIn.isTypeInRequiredForCurrentCard(),
				onFocusTypeIn: () => this.focusTypeInEditor(),
				getSuggestedRating: () =>
					this.typeIn.getSuggestedRatingForCurrentCard(),
			},
			this.plugin.settings.reviewKeybindings,
		);
	}

	private focusTypeInEditor(): void {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		const cmContent = container.querySelector<HTMLElement>(
			".true-recall-add-field .cm-content",
		);
		if (cmContent) {
			cmContent.focus();
			return;
		}
		// Fallback: textarea (when CodeMirror is unavailable)
		const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
		textarea?.focus();
	}

	private handleAskFollowUp(question: string): boolean {
		const card = this.review.getCurrentCard();
		const service = this.plugin.assistantService;
		const trimmed = question.trim();
		if (!card || !service || trimmed === "") return false;
		const state = this.typeIn.getCurrentTypeInState(card.id);
		service.enqueue({
			instruction: trimmed,
			context: buildReviewFollowUpContext(card, {
				typedAnswer: state.typedAnswer,
				semanticResult: state.semanticResult,
			}),
		});
		this.queuedFollowUpCount += 1;
		this.review.notifyChange();
		return true;
	}

	private handleAnswer(rating: Grade): void {
		if (this.isProcessingAnswer) return;
		if (this.typeIn.isRatingLocked()) return;
		// Click path: the queue advances synchronously but the re-render that
		// hides the rating bar is async, so a fast double-click would grade
		// the next card sight-unseen (keyboard path already checks this).
		if (!this.review.isAnswerRevealed) return;
		this.isProcessingAnswer = true;
		try {
			const outcome = this.answerHandler.handleAnswer(rating);
			if (
				outcome &&
				!this.filters.crammingMode &&
				!isPreviewCustomStudy(this.filters)
			) {
				this.notifyOtherSessionsCardReviewed(outcome.card.id);
			}
			const nextCardId = this.review.getCurrentCard()?.id ?? null;
			this.typeIn.resetTypeInState(nextCardId);
		} finally {
			this.isProcessingAnswer = false;
		}
	}

	// ─── Obsidian lifecycle ──────────────────────────────────────────────

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const viewState =
			(state as import("@true-recall/obsidian/features/study/ui/review/review.types").ReviewViewState) ??
			null;
		this.sessionKey = viewState?.sessionKey;
		this.sessionLabel = viewState?.sessionLabel;
		this.filters = filtersFromViewState(viewState);
		this.filters.dayStartHour = this.plugin.settings.dayStartHour;
		this.crammedCardIds.clear();
		this.isProcessingAnswer = false;
		this.typeIn.applyDefaultTypeInMode();
		this.typeIn.resetTypeInState();

		await super.setState(state, result);
		// During startup restore, enrichment (frontmatter index, hierarchy
		// graph) is only populated at layout-ready — a queue built earlier is
		// silently empty for note-/project-scoped filters and shows a false
		// "Congratulations" empty state that never retries.
		await runWhenLayoutReady(this.app.workspace, {
			isAttached: () => this.containerEl.isConnected,
			run: () => this.startSession(),
		});
	}

	getState() {
		return {
			...filtersToViewState(this.filters),
			sessionKey: this.sessionKey,
			sessionLabel: this.sessionLabel,
		};
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW;
	}

	getDisplayText(): string {
		return this.sessionLabel
			? `Review · ${this.sessionLabel}`
			: "Review session";
	}

	getIcon(): string {
		return "brain";
	}

	getCurrentReviewedCard(): FSRSFlashcardItem | null {
		return this.review.getCurrentCard();
	}

	canUndoSessionAction(): boolean {
		return this.getNewestUndoService() !== null;
	}

	async undoSessionAction(): Promise<boolean> {
		const service = this.getNewestUndoService();
		if (!service) {
			notify().nothingToUndo();
			return false;
		}
		return service.undo();
	}

	canRedoSessionAction(): boolean {
		return this.getNewestRedoService() !== null;
	}

	async redoSessionAction(): Promise<boolean> {
		const service = this.getNewestRedoService();
		if (!service) {
			notify().nothingToRedo();
			return false;
		}
		return service.redo();
	}

	private getNewestUndoService(): CommandService | null {
		return CommandService.newestUndoService(
			[this.sessionCommandService, this.plugin.commandService],
			this.commandHistoryBaseline,
		);
	}

	private getNewestRedoService(): CommandService | null {
		return CommandService.newestRedoService(
			[this.sessionCommandService, this.plugin.commandService],
			this.commandHistoryBaseline,
		);
	}

	notifyOtherSessionsCardReviewed(cardId: string): void {
		notifyReviewSessionCardGraded(cardId, this.sessionId);
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return Promise.resolve();
		container.empty();
		this.typeIn.applyDefaultTypeInMode();

		this.unsubscribe = this.sessionStore.subscribe(
			(state) => state.review,
			() => {
				this.updateHeaderActions();
				this.syncSharedReviewState();
			},
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.syncSharedReviewState();
			}),
		);
		this.syncSharedReviewState();

		this.disposeReviewHook = this.sessionCommandService.registerHook(
			new ReviewUndoHook({
				onUpdateSchedulingPreview: () =>
					this.answerHandler.updateSchedulingPreview(),
			}),
		);

		const onReviewKeyDown = (e: KeyboardEvent): void => {
			const activeView = this.app.workspace.getActiveViewOfType(ReviewView);
			if (activeView !== this) return;
			if (activeDocument.querySelector(".modal-container")) return;
			this.keyboardHandler.handleKeyDown(e);
		};
		activeDocument.addEventListener("keydown", onReviewKeyDown, true);
		this.register(() => {
			activeDocument.removeEventListener("keydown", onReviewKeyDown, true);
		});

		this.askBubble = new ReviewSelectionBubble({
			isEnabled: () => isPluginEnabled(this.plugin.settings, "ai-assistant"),
			getContext: (text) => this.buildAssistantContext(text),
			onAsk: (rect, context) =>
				openAiWorkspace(this.plugin, {
					intent: "selection",
					anchor: rect,
					context,
					// The bubble only closes surfaces it owns; the docked panel stays.
				}) ?? (() => {}),
		});
		this.askBubble.register();

		window.addEventListener(
			"true-recall:assistant-card-updated",
			this.onAssistantCardUpdated,
		);
		this.register(() => {
			window.removeEventListener(
				"true-recall:assistant-card-updated",
				this.onAssistantCardUpdated,
			);
		});
		return Promise.resolve();
	}

	private buildAssistantContext(selectedText?: string): AssistantContext {
		const card = this.review.getCurrentCard();
		if (card) return assistantContextFromCard(card, selectedText);
		return selectedText ? { selectedText } : {};
	}

	private onAssistantCardUpdated = (e: Event): void => {
		const cardId = (e as CustomEvent<{ cardId: string }>).detail?.cardId;
		if (!cardId) return;
		if (this.review.getCurrentCard()?.id !== cardId) return;
		this.cardActionsHandler.refreshCurrentCard();
	};

	private mountApp(container: HTMLElement): void {
		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(ReviewApp, {
				model: createReviewModel({
					plugin: this.plugin,
					store: this.sessionStore,
					filters: this.filters,
					typeIn: this.typeIn,
					answerHandler: this.answerHandler,
					getQueuedFollowUpCount: () => this.queuedFollowUpCount,
					getTopUpAvailability: () => this.orchestrator.getTopUpAvailability(),
					getPresetOptions: () => this.presets.getPresetOptions(),
					canUndo: () => this.canUndoSessionAction(),
					actions: {
						onShowAnswer: () => void this.typeIn.handleReveal(),
						onTypedAnswerChange: (value: string) =>
							this.typeIn.handleTypedAnswerChange(value),
						onAskFollowUp: isPluginEnabled(this.plugin.settings, "ai-assistant")
							? (question: string) => this.handleAskFollowUp(question)
							: undefined,
						onOpenAssistantInbox: () => void this.plugin.openAssistantInbox(),
						onAnswer: (rating: Grade) => void this.handleAnswer(rating),
						onContentChange: (value: string, field: "question" | "answer") =>
							void this.editHandler.saveContent(value, field),
						onOpenSourceNote: () => this.sourceNavigator.handleOpenSourceNote(),
						onEditComment: () =>
							void this.cardActionsHandler.handleEditComment(),
						onRemoveComment: () =>
							this.cardActionsHandler.handleRemoveComment(),
						onClose: () => this.handleClose(),
						onNextSession: () => this.handleNextSession(),
						onOpenDashboard: () => void this.handleOpenDashboard(),
						onTopUp: (topUp: ReviewSessionTopUp) =>
							this.orchestrator.handleTopUp(topUp),
						onEndSession: () => this.handleNextSession(),
						onActionsMenu: (e: MouseEvent) => this.showActionsMenu(e),
						// Card editing runs inside the shared AI Workspace.
						onPolishMenu: isPluginEnabled(this.plugin.settings, "card-polish")
							? (e: MouseEvent) => this.openCardPolishMenu(e)
							: undefined,
						onCycleTypeInMode: () => this.typeIn.cycleTypeInMode(),
						onUndo: () => void this.undoSessionAction(),
						onPresetChange: (name: string) =>
							void this.presets.handlePresetChange(name),
					},
				}),
			}),
		);
	}

	private mountEmptyState(container: HTMLElement, message: string): void {
		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(ReviewEmptyState, {
				message,
				onClose: () => this.handleClose(),
			}),
		);
	}

	async onClose(): Promise<void> {
		const sharedReviewAtClose = this.review;
		this.disposeReviewHook?.();
		this.disposeReviewHook = null;
		await this.orchestrator.finish();

		this.askBubble?.unregister();
		this.askBubble = null;

		this.unsubscribe?.();
		this.subscriptions.unsubscribeFromSessionEvents();
		this.unmountPreact?.();

		// Sync card data after review session ends
		getDataLayer().invalidateGroups([G.CARDS]);

		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		const sharedStoreStillOwnsSession =
			this.plugin.store?.getState().review === sharedReviewAtClose;
		this.review.reset();
		if (sharedStoreStillOwnsSession) {
			this.plugin.store?.setState({ review: this.review });
		}
		this.typeIn.resetTypeInState();
	}

	private syncSharedReviewState(): void {
		const activeView = this.app.workspace.getActiveViewOfType(ReviewView);
		if (activeView !== this) return;
		this.plugin.store?.setState({ review: this.review });
	}

	// ─── Header actions (Obsidian native) ────────────────────────────────

	private updateHeaderActions(): void {
		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		if (!this.review.isActive || !this.plugin.settings.showReviewHeader) {
			return;
		}

		this.openNoteAction = this.addAction("external-link", "Open note", () =>
			this.sourceNavigator.handleOpenNote(),
		);
	}
	async startSession(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		try {
			this.typeIn.applyDefaultTypeInMode();
			const prepared = this.orchestrator.prepare();
			await new Promise<void>((resolve) =>
				this.containerEl.win.requestAnimationFrame(() => resolve()),
			);
			if (!this.containerEl.isConnected) return;
			if (prepared.message) {
				this.mountEmptyState(container, prepared.message);
				return;
			}
			this.orchestrator.start(prepared.queue);
			this.mountApp(container);
		} catch (error) {
			notify().operationFailed("start review session", error);
		}
	}

	// ─── Actions menu ────────────────────────────────────────────────────

	private openCardPolishMenu(e: MouseEvent): void {
		const anchor = e.currentTarget;
		openAiWorkspace(this.plugin, {
			intent: "preset",
			anchor: anchor instanceof HTMLElement ? anchor : undefined,
			mode: "card-polish",
			context: this.buildAssistantContext(),
		});
	}

	/** Whether the actions menu and the command may offer a fact check right now. */
	canFactCheckCurrentCard(): boolean {
		return (
			this.review.getCurrentCard() !== null &&
			isFactCheckAvailable(this.plugin.settings)
		);
	}

	/**
	 * Queues a background fact check of the visible card. Review continues;
	 * the verdict lands in the AI inbox.
	 */
	factCheckCurrentCard(): void {
		const card = this.review.getCurrentCard();
		if (!card || !isFactCheckAvailable(this.plugin.settings)) return;
		const taskId = startFactCheck(this.plugin, card);
		if (taskId) notify().info(FACT_CHECK_QUEUED_MESSAGE);
		else notify().error("AI assistant is not running");
	}

	private showActionsMenu(event: MouseEvent): void {
		const menu = new Menu();
		this.populateActionsMenu(menu);
		menu.showAtMouseEvent(event);
	}

	/** On mobile the card actions join the view's native pane menu, so the
	 * header keeps a single overflow button instead of two identical ones. */
	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		if (!isMobile() || !this.review.isActive) return;
		menu.addSeparator();
		this.populateActionsMenu(menu);
	}
	private populateActionsMenu(menu: Menu): void {
		populateReviewActionsMenu(menu, {
			plugin: this.plugin,
			getReview: () => this.review,
			cardActionsHandler: this.cardActionsHandler,
			getTypeInMode: () => this.typeIn.getTypeInMode(),
			cycleTypeInMode: () => this.typeIn.cycleTypeInMode(),
			buildAssistantContext: () => this.buildAssistantContext(),
			canFactCheckCurrentCard: () => this.canFactCheckCurrentCard(),
			factCheckCurrentCard: () => this.factCheckCurrentCard(),
			openCardPolishMenu: (event) => this.openCardPolishMenu(event),
			canUndoSessionAction: () => this.canUndoSessionAction(),
			undoSessionAction: () => this.undoSessionAction(),
			handleOpenSourceNote: () => this.sourceNavigator.handleOpenSourceNote(),
		});
	}

	private handleClose(): void {
		this.leaf.detach();
	}

	private handleNextSession(): void {
		this.leaf.detach();
		void this.plugin.activateView().catch((err) => {
			notify().error("Could not open the next review session", err);
		});
	}

	private async handleOpenDashboard(): Promise<void> {
		this.leaf.detach();
		await this.plugin.openDashboard();
	}
}
