import { effect } from "@preact/signals";
import {
	ItemView,
	Menu,
	Scope,
	TFile,
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
	type CardSchedulingMeta,
	extractFSRSSettings,
	type FSRSFlashcardItem,
	type FSRSPreset,
	type LocalAnswerAssessment,
	type SemanticGradingResult,
} from "@true-recall/core/types";
import { isPreviewCustomStudy } from "@true-recall/core/types/review-session.types";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { CommandService, ReviewUndoHook } from "@true-recall/obsidian/commands";
import { G, getDataLayer, Q } from "@true-recall/obsidian/data";
import { assistantContextFromCard } from "@true-recall/obsidian/features/assistant/ui/ai-context-source";
import { openAiWorkspace } from "@true-recall/obsidian/features/assistant/ui/open-ai-workspace";
import { ReviewSessionController } from "@true-recall/obsidian/features/study/services/ReviewSessionController";
import type { PresetPickerOption } from "@true-recall/obsidian/features/study/ui/review/components";
import {
	AnswerHandler,
	CardActionsHandler,
	EditHandler,
	KeyboardHandler,
} from "@true-recall/obsidian/features/study/ui/review/handlers";
import {
	applyMutation,
	assessTypedAnswer,
	deriveTypeInMode,
	getEmptyQueueMessage,
	getTypeInModeStorage,
	isRatingLockedForTypeIn,
	isTypeInRequiredForCard,
	nextTypeInMode,
	persistTypeInMode,
	readPersistedTypeInMode,
	shouldRunAIGradingOnReveal,
	type TypeInMode,
} from "@true-recall/obsidian/features/study/ui/review/helpers";
import { ReviewSelectionBubble } from "@true-recall/obsidian/features/study/ui/review/ReviewSelectionBubble";
import {
	filtersFromViewState,
	filtersToViewState,
	isCustomSession,
	type SessionFilters,
} from "@true-recall/obsidian/features/study/ui/review/review.types";
import { mountPreact } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import {
	lastMutation,
	notifyReviewSessionCardGraded,
	reviewSessionCardGraded,
} from "@true-recall/obsidian/services/signals";
import {
	type AppStore,
	createAppStore,
	type ReviewApi,
} from "@true-recall/obsidian/store";
import { runWhenLayoutReady } from "@true-recall/obsidian/views/layout-ready";
import {
	ReviewApp,
	ReviewEmptyState,
} from "@true-recall/obsidian/views/review/ReviewApp";

import type TrueRecallPlugin from "../../main";
import { isPluginEnabled } from "../../plugin/plugin-utils";

interface TypeInAssessmentState {
	cardId: string | null;
	typedAnswer: string;
	localAssessment: LocalAnswerAssessment | null;
	semanticResult: SemanticGradingResult | null;
	semanticMessage: string | null;
	isChecking: boolean;
}

function createEmptyTypeInState(
	cardId: string | null = null,
): TypeInAssessmentState {
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
	private plugin: TrueRecallPlugin;
	private fsrsService: FSRSService;
	private reviewService: ReviewService;
	private reviewController: ReviewSessionController;
	private sessionStore: AppStore;
	private sessionCommandService: CommandService;
	private flashcardManager: FlashcardManager;
	private sessionPersistence: SessionPersistenceService;
	private semanticGradingService: SemanticAnswerGradingService;

	private filters: SessionFilters = {};
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
	private sessionSignalDisposer: (() => void) | null = null;
	private reviewSyncDisposer: (() => void) | null = null;
	private disposeReviewHook: (() => void) | null = null;
	private askBubble: ReviewSelectionBubble | null = null;
	private typeInState: TypeInAssessmentState = createEmptyTypeInState();
	private sessionTypeInModeEnabled = false;
	private aiEnabledForTypeIn = false;

	private get review(): ReviewApi {
		return this.sessionStore.getState().review;
	}

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.sessionStore = createAppStore({
			getSettings: () => this.plugin.settings,
		});
		this.sessionCommandService = new CommandService({
			flashcardManager: plugin.flashcardManager,
			cardStore: plugin.cardStore,
			sessionPersistence: plugin.sessionPersistence,
		});

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
		this.applyDefaultTypeInMode();

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

		this.keyboardHandler = new KeyboardHandler(
			() => this.review,
			{
				onShowAnswer: () => void this.handleReveal(),
				onAnswer: (rating) => this.handleAnswer(rating as Grade),
				onUndo: async () => {
					await this.cardActionsHandler.handleUndo();
				},
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
			},
			this.plugin.settings.reviewKeybindings,
		);
	}

	private getCurrentTypeInState(cardId: string): TypeInAssessmentState {
		if (this.typeInState.cardId !== cardId) {
			return createEmptyTypeInState(cardId);
		}
		return this.typeInState;
	}

	private setTypeInState(
		cardId: string,
		patch: Partial<TypeInAssessmentState>,
	): void {
		const current = this.getCurrentTypeInState(cardId);
		this.typeInState = {
			...current,
			...patch,
			cardId,
		};
		this.review.notifyChange();
	}

	private resetTypeInState(cardId: string | null = null): void {
		this.typeInState = createEmptyTypeInState(cardId);
	}

	private applyDefaultTypeInMode(): void {
		if (!isPluginEnabled(this.plugin.settings, "type-in-mode")) {
			this.sessionTypeInModeEnabled = false;
			this.aiEnabledForTypeIn = false;
			return;
		}
		const persisted = readPersistedTypeInMode(getTypeInModeStorage());
		const mode = persisted ?? this.plugin.settings.defaultTypeInMode;
		this.sessionTypeInModeEnabled = mode !== "off";
		this.aiEnabledForTypeIn = mode === "ai";
	}

	private getTypeInMode(): TypeInMode {
		return deriveTypeInMode(
			this.sessionTypeInModeEnabled,
			this.aiEnabledForTypeIn,
		);
	}

	private cycleTypeInMode(): void {
		if (!isPluginEnabled(this.plugin.settings, "type-in-mode")) return;
		const currentMode = this.getTypeInMode();
		const card = this.review.getCurrentCard();
		const alwaysTypeIn = !!(card?.alwaysTypeIn || card?.fsrs.alwaysTypeIn);
		const nextMode = nextTypeInMode(currentMode, alwaysTypeIn);
		const currentId = card?.id ?? null;

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
		} else if (currentId) {
			// Keep typed input while switching AI -> Diff, clear grading state only.
			this.setTypeInState(currentId, {
				localAssessment: null,
				semanticResult: null,
				semanticMessage: null,
				isChecking: false,
			});
		} else {
			this.review.notifyChange();
		}

		notify().info(this.getTypeInModeMessage(nextMode));
	}

	private getTypeInModeMessage(mode: TypeInMode): string {
		if (mode === "ai") return "Type in: AI";
		if (mode === "diff") return "Type in: Diff";
		return "Type in: Off";
	}

	private isTypeInRequiredForCurrentCard(): boolean {
		return isTypeInRequiredForCard(
			this.review.getCurrentCard(),
			this.sessionTypeInModeEnabled,
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

	private isRatingLocked(): boolean {
		const card = this.review.getCurrentCard();
		if (!card) return false;
		const state = this.getCurrentTypeInState(card.id);
		return isRatingLockedForTypeIn({
			requiresTypeIn: this.isTypeInRequiredForCurrentCard(),
			isAnswerRevealed: this.review.isAnswerRevealed,
			isChecking: state.isChecking,
		});
	}

	private handleTypedAnswerChange(value: string): void {
		const card = this.review.getCurrentCard();
		if (!card || !this.isTypeInRequiredForCurrentCard()) return;

		this.setTypeInState(card.id, {
			typedAnswer: value,
			localAssessment: null,
			semanticResult: null,
			semanticMessage: null,
			isChecking: false,
		});
	}

	private async handleReveal(): Promise<void> {
		const card = this.review.getCurrentCard();
		if (!card) return;
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

			const prepared = this.answerHandler.prepareTypedAnswerAssessment(
				state.typedAnswer,
			);
			if (!prepared) return;

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
		const localAssessment = assessTypedAnswer(card.answer ?? "", typedAnswer);
		this.setTypeInState(card.id, {
			isChecking: true,
			localAssessment,
			semanticResult: null,
			semanticMessage: null,
		});

		let semanticResult: SemanticGradingResult | null = null;
		let semanticMessage: string | null = null;
		try {
			const gradingContext = await this.resolveGradingContext(card);
			semanticResult = await this.answerHandler.gradeTypedAnswerSemantically(
				card,
				typedAnswer,
				localAssessment.score,
				SEMANTIC_PASS_THRESHOLD,
				{ allowLocalFallback: false, ...gradingContext },
			);
		} catch (error) {
			semanticMessage =
				error instanceof Error
					? error.message
					: "AI grading unavailable. Please rate manually.";
		}

		const activeCard = this.review.getCurrentCard();
		if (!activeCard || activeCard.id !== card.id) return;

		this.setTypeInState(card.id, {
			isChecking: false,
			semanticResult,
			semanticMessage,
		});
	}

	private handleAnswer(rating: Grade): void {
		if (this.isProcessingAnswer) return;
		if (this.isRatingLocked()) return;
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
			this.resetTypeInState(nextCardId);
		} finally {
			this.isProcessingAnswer = false;
		}
	}

	// ─── Obsidian lifecycle ──────────────────────────────────────────────

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		this.filters = filtersFromViewState(
			(state as import("@true-recall/obsidian/features/study/ui/review/review.types").ReviewViewState) ??
				null,
		);
		this.filters.dayStartHour = this.plugin.settings.dayStartHour;
		this.crammedCardIds.clear();
		this.isProcessingAnswer = false;
		this.applyDefaultTypeInMode();
		this.resetTypeInState();

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
		return filtersToViewState(this.filters);
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW;
	}

	getDisplayText(): string {
		return "Review session";
	}

	getIcon(): string {
		return "brain";
	}

	getCurrentReviewedCard(): FSRSFlashcardItem | null {
		return this.review.getCurrentCard();
	}

	canUndoSessionAction(): boolean {
		return this.sessionCommandService.canUndo();
	}

	undoSessionAction(): Promise<boolean> {
		return this.sessionCommandService.undo();
	}

	canRedoSessionAction(): boolean {
		return this.sessionCommandService.canRedo();
	}

	redoSessionAction(): Promise<boolean> {
		return this.sessionCommandService.redo();
	}

	notifyOtherSessionsCardReviewed(cardId: string): void {
		notifyReviewSessionCardGraded(cardId, this.sessionId);
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return Promise.resolve();
		container.empty();
		this.applyDefaultTypeInMode();

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
			new ReviewUndoHook(() => this.review, {
				onUpdateSchedulingPreview: () =>
					this.answerHandler.updateSchedulingPreview(),
			}),
		);

		this.registerDomEvent(activeDocument, "keydown", (e: KeyboardEvent) => {
			const activeView = this.app.workspace.getActiveViewOfType(ReviewView);
			if (activeView !== this) return;
			if (activeDocument.querySelector(".modal-container")) return;
			this.keyboardHandler.handleKeyDown(e);
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
				store: this.sessionStore,
				onShowAnswer: () => void this.handleReveal(),
				onTypedAnswerChange: (value: string) =>
					this.handleTypedAnswerChange(value),
				onAnswer: (rating: Grade) => void this.handleAnswer(rating),
				onContentChange: (value: string, field: "question" | "answer") =>
					void this.editHandler.saveContent(value, field),
				onOpenSourceNote: () => this.handleOpenSourceNote(),
				onClose: () => this.handleClose(),
				onNextSession: () => this.handleNextSession(),
				onOpenDashboard: () => void this.handleOpenDashboard(),
				onEndSession: () => this.handleNextSession(),
				onActionsMenu: (e: MouseEvent) => this.showActionsMenu(e),
				// Polish presets now run in the shared AI workspace, so the action
				// needs both the preset family and the surface to be enabled.
				onPolishMenu:
					isPluginEnabled(this.plugin.settings, "card-polish") &&
					isPluginEnabled(this.plugin.settings, "ai-assistant")
						? (e: MouseEvent) => this.openCardPolishMenu(e)
						: undefined,
				isCustomSession: isCustomSession(this.filters),
				crammingMode: this.filters.crammingMode ?? false,
				rModeActive: this.filters.schedulingMode === "retrievability",
				showHeader: this.plugin.settings.showReviewHeader,
				showHeaderStats: this.plugin.settings.showReviewHeaderStats,
				showNextReviewTime: this.plugin.settings.showNextReviewTime,
				continuousCustomReviews: this.plugin.settings.continuousCustomReviews,
				onCycleTypeInMode: () => this.cycleTypeInMode(),
				getTypeInState: (card, isAnswerRevealed) => {
					const requiresTypeIn = isTypeInRequiredForCard(
						card,
						this.sessionTypeInModeEnabled,
					);
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
				getPresetName: (card: FSRSFlashcardItem) =>
					this.answerHandler.resolvePreset(card).name,
				getPresetOptions: () => this.getPresetOptions(),
				onPresetChange: (name: string) => void this.handlePresetChange(name),
				resolveAudioPath: (card: FSRSFlashcardItem) => {
					if (!card.noteId) return undefined;
					const note = this.plugin.cardStore?.notes.getById(card.noteId);
					if (!note?.fields) return undefined;
					for (const [key, value] of Object.entries(note.fields)) {
						if (key.startsWith("_audio_") && value) {
							return value;
						}
					}
					return undefined;
				},
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
		this.sessionCommandService.clearByType(
			"review:answer",
			"review:bury",
			"review:suspend",
			"review:forget",
		);

		if (this.plugin.cardStore) {
			await this.plugin.cardStore.flush();
		}

		this.askBubble?.unregister();
		this.askBubble = null;

		this.unsubscribe?.();
		this.unsubscribeFromSessionEvents();
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
		this.aiEnabledForTypeIn = false;
		this.resetTypeInState();
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
			this.handleOpenNote(),
		);
	}

	private getPresetOptions(): PresetPickerOption[] {
		return this.plugin.presetService.getPresets().map((p) => ({
			value: p.name,
			label: p.name,
			retention: p.requestRetention,
		}));
	}

	private handlePresetChange(newPresetName: string): void {
		const card = this.review.getCurrentCard();
		if (!card) return;

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

		const uid = card.sourceUid ?? "";
		this.presetCache.set(uid, newPreset);

		// Recalculate button intervals with new preset
		this.answerHandler.updateSchedulingPreview();

		// Force re-render so ButtonBar picks up new scheduling preview
		this.review.notifyChange();
	}

	// ─── Session lifecycle ───────────────────────────────────────────────

	async startSession(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;

		try {
			this.applyDefaultTypeInMode();
			const fsrsSettings = extractFSRSSettings(this.plugin.settings);
			this.fsrsService.updateSettings(fsrsSettings);

			const { queue } = this.reviewController.buildSession(this.filters);
			const allMetaMap = this.plugin.dataLayer?.get<
				Map<string, CardSchedulingMeta>
			>(Q.ALL_META);
			const allCards = allMetaMap
				? [...allMetaMap.values()]
				: this.plugin.cardStore.getAllSchedulingMeta();

			if (queue.length === 0 && allCards.length === 0) {
				this.mountEmptyState(
					container,
					"No flashcards found. Generate some flashcards first!",
				);
				return;
			}

			const now = new Date();
			const hasAnyActive = allCards.some(
				(card) =>
					!(
						card.fsrs.suspended ||
						(card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
					),
			);

			if (!hasAnyActive && queue.length === 0) {
				const msg =
					this.filters.stateFilter === "buried"
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
				this.mountEmptyState(
					container,
					"Session persistence not ready. Please try again.",
				);
				return;
			}

			// Yield once before mounting Preact so the loading state can paint.
			await new Promise((r) => window.requestAnimationFrame(r));
			if (!this.containerEl.isConnected) return;

			if (queue.length === 0) {
				this.mountEmptyState(
					container,
					getEmptyQueueMessage(
						this.filters.stateFilter,
						this.filters.schedulingMode === "retrievability",
					),
				);
				return;
			}

			this.presetCache.clear();
			for (const card of queue) {
				const uid = card.sourceUid ?? "";
				if (!this.presetCache.has(uid)) {
					this.presetCache.set(
						uid,
						this.plugin.presetService.resolvePresetForCard(card, {
							projectPath: this.filters.projectPath,
						}),
					);
				}
			}

			this.review.setSessionFilters(this.filters);
			this.review.startSession(queue);
			this.resetTypeInState(this.review.getCurrentCard()?.id ?? null);
			this.subscribeToSessionEvents();
			this.answerHandler.updateSchedulingPreview();

			// Mount the Preact app now that the session is active
			this.mountApp(container);
		} catch (error) {
			console.error("Error starting review session:", error);
			notify().error(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	// ─── Signal-based mutation handling ──────────────────────────────────

	private subscribeToSessionEvents(): void {
		this.unsubscribeFromSessionEvents();

		// preact-signals runs the effect callback immediately on creation, and
		// lastMutation is never cleared — without this guard every new session
		// would re-apply the last pre-session mutation to the fresh queue
		// (e.g. force-adding a card past the daily new limit).
		let isSubscribing = true;
		this.sessionSignalDisposer = effect(() => {
			const m = lastMutation.value;
			if (isSubscribing) {
				isSubscribing = false;
				return;
			}
			if (!m) return;
			// Targeted mutation handling instead of full session rebuild.
			// rebuildActiveSession() recomputes cachedBadgeCounts from scratch,
			// which can drift from the incremental counts maintained by
			// recordAnswerAndNext() (e.g. New count appearing to increase
			// when a Learning card is graded).
			const resolvedProjectUids = this.filters.projectPath
				? this.plugin.hierarchyService.getSourceUidsForProject(
						this.filters.projectPath,
					)
				: undefined;
			applyMutation(
				m,
				this.review,
				this.flashcardManager,
				this.plugin.cardStore,
				this.filters,
				resolvedProjectUids,
			);
		});

		let isReviewSyncSubscribing = true;
		this.reviewSyncDisposer = effect(() => {
			const event = reviewSessionCardGraded.value;
			if (isReviewSyncSubscribing) {
				isReviewSyncSubscribing = false;
				return;
			}
			if (!event || event.sourceSessionId === this.sessionId) return;
			this.review.removeCardsByIds([event.cardId]);
		});
	}

	private unsubscribeFromSessionEvents(): void {
		this.sessionSignalDisposer?.();
		this.sessionSignalDisposer = null;
		this.reviewSyncDisposer?.();
		this.reviewSyncDisposer = null;
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

	private showActionsMenu(event: MouseEvent): void {
		const menu = new Menu();
		const typeInMode = this.getTypeInMode();
		const typeInMenuLabel =
			typeInMode === "ai"
				? "Type in: AI (t)"
				: typeInMode === "diff"
					? "Type in: Diff (t)"
					: "Type in: Off (t)";

		menu.addItem((item) =>
			item
				.setTitle(typeInMenuLabel)
				.setIcon("text-cursor-input")
				.onClick(() => this.cycleTypeInMode()),
		);
		menu.addSeparator();

		if (isPluginEnabled(this.plugin.settings, "ai-assistant")) {
			menu.addItem((item) =>
				item
					.setTitle("Ask AI about this card")
					.setIcon("sparkles")
					.onClick(() => {
						openAiWorkspace(this.plugin, {
							intent: "compose",
							context: this.buildAssistantContext(),
						});
					}),
			);
			menu.addSeparator();
		}

		if (this.cardActionsHandler.canUndo()) {
			menu.addItem((item) =>
				item
					.setTitle("Undo last answer (z)")
					.setIcon("undo")
					.onClick(() => this.cardActionsHandler.handleUndo()),
			);
			menu.addSeparator();
		}

		menu.addItem((item) =>
			item
				.setTitle("Move card (m)")
				.setIcon("folder-input")
				.onClick(() => this.cardActionsHandler.handleMoveCard()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Suspend card")
				.setIcon("pause")
				.onClick(() => this.cardActionsHandler.handleSuspend()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Bury card (-)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryCard()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Bury note (=)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryNote()),
		);
		if (this.cardActionsHandler.canForgetCurrentCard()) {
			menu.addItem((item) =>
				item
					.setTitle("Forget card (f)")
					.setIcon("rotate-ccw")
					.onClick(() => this.cardActionsHandler.handleForget()),
			);
		}
		const currentCard = this.review.getCurrentCard();
		const isNoteReview = currentCard?.cardType === "note-review";

		if (isNoteReview) {
			menu.addItem((item) =>
				item
					.setTitle("Open note (e)")
					.setIcon("external-link")
					.onClick(() => this.handleOpenSourceNote()),
			);
		} else {
			menu.addItem((item) =>
				item
					.setTitle("Edit card (e)")
					.setIcon("pencil")
					.onClick(() => void this.cardActionsHandler.handleEditCardModal()),
			);
			menu.addItem((item) =>
				item
					.setTitle("Change note type")
					.setIcon("replace")
					.onClick(() => void this.cardActionsHandler.handleChangeNoteType()),
			);
			menu.addItem((item) =>
				item
					.setTitle("Add flashcard (a)")
					.setIcon("plus")
					.onClick(() => void this.cardActionsHandler.handleAddNewFlashcard()),
			);
			menu.addItem((item) =>
				item
					.setTitle("Add image occlusion")
					.setIcon("image")
					.onClick(
						() => void this.cardActionsHandler.handleAddImageOcclusion(),
					),
			);
			menu.addItem((item) =>
				item
					.setTitle("Open source note")
					.setIcon("external-link")
					.onClick(() => this.handleOpenSourceNote()),
			);
		}

		menu.showAtMouseEvent(event);
	}

	private async resolveGradingContext(card: FSRSFlashcardItem): Promise<{
		sourceContext?: string;
		sourceNotePath?: string;
		relatedCards?: Array<{
			fields: Record<string, string>;
			noteType: string;
		}>;
	}> {
		const MAX_CONTEXT_CHARS = 4000;
		const MAX_RELATED_CARDS = 10;

		let sourceContext: string | undefined = card.sourceText
			? card.sourceText.slice(0, MAX_CONTEXT_CHARS)
			: undefined;
		let sourceNotePath: string | undefined;

		const file = this.resolveSourceFile(card);
		if (file) {
			sourceNotePath = file.path;
			if (!sourceContext) {
				try {
					const content = await this.app.vault.cachedRead(file);
					sourceContext = content.slice(0, MAX_CONTEXT_CHARS);
				} catch {
					// Source file unreadable — fall back to no context.
				}
			}
		}

		const store = this.plugin.cardStore;
		let relatedCards:
			| Array<{ fields: Record<string, string>; noteType: string }>
			| undefined;
		if (store && card.sourceUid) {
			const siblings = store.cards.getCardsBySourceUid(card.sourceUid) ?? [];
			const collected: Array<{
				fields: Record<string, string>;
				noteType: string;
			}> = [];
			for (const sibling of siblings) {
				if (sibling.id === card.id) continue;
				if (!sibling.noteTypeId || !sibling.noteId) continue;
				const noteType = store.noteTypes?.getById(sibling.noteTypeId);
				if (!noteType) continue;
				const note = store.notes.getById(sibling.noteId);
				if (!note) continue;
				const fields: Record<string, string> = {};
				for (const fieldName of noteType.fields) {
					fields[fieldName] = note.fields?.[fieldName] ?? "";
				}
				collected.push({ fields, noteType: noteType.name });
				if (collected.length >= MAX_RELATED_CARDS) break;
			}
			if (collected.length > 0) relatedCards = collected;
		}

		return { sourceContext, sourceNotePath, relatedCards };
	}

	// ─── Navigation ──────────────────────────────────────────────────────

	private resolveSourceFile(card: FSRSFlashcardItem): TFile | null {
		if (card.sourceUid && this.plugin.frontmatterIndex) {
			const filePath = this.plugin.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid,
			);
			if (filePath) {
				const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
				if (abstractFile instanceof TFile) return abstractFile;
			}
		}

		if (card.sourceNotePath) {
			const abstractFile = this.app.vault.getAbstractFileByPath(
				card.sourceNotePath,
			);
			if (abstractFile instanceof TFile) {
				return abstractFile;
			}
		}

		return null;
	}

	private handleOpenSourceNote(): void {
		const card = this.review.getCurrentCard();
		if (!card || !card.sourceNoteName) {
			notify().warning("Source note not found");
			return;
		}

		const sourceFile = this.resolveSourceFile(card);
		if (sourceFile) {
			void this.app.workspace.openLinkText(sourceFile.path, "", false);
		} else {
			notify().warning(`Source note "${card.sourceNoteName}" not found`);
		}
	}

	private handleOpenNote(): void {
		const card = this.review.getCurrentCard();
		if (!card) return;

		if (card.sourceNoteName) {
			this.handleOpenSourceNote();
		} else {
			notify().info("This card has no associated source note");
		}
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
