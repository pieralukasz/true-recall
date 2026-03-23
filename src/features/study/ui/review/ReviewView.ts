import { SemanticAnswerGradingService } from "@features/ai/services/semantic-answer-grading.service";
import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import { FSRSService } from "@features/core/services/fsrs.service";
import { computeActionableSessionSnapshot } from "@features/study/services/actionable-session-snapshot.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { ReviewService } from "@features/study/services/review.service";
import type { PresetPickerOption } from "@features/study/ui/review/components/PresetPopover";
import {
	AnswerHandler,
	CardActionsHandler,
	EditHandler,
	KeyboardHandler,
} from "@features/study/ui/review/handlers";
import {
	applyMutation,
	assessTypedAnswer,
	deriveTypeInMode,
	filterActiveCards,
	getEmptyQueueMessage,
	getTypeInModeStorage,
	isRatingLockedForTypeIn,
	isTypeInRequiredForCard,
	nextTypeInMode,
	persistTypeInMode,
	readPersistedTypeInMode,
	shouldRunAIGradingOnReveal,
	type TypeInMode,
} from "@features/study/ui/review/helpers";
import {
	ReviewApp,
	ReviewEmptyState,
} from "@features/study/ui/review/ReviewApp";
import {
	filtersFromViewState,
	filtersToViewState,
	isCustomSession,
	type SessionFilters,
} from "@features/study/ui/review/review.types";
import { effect } from "@preact/signals";
import { VIEW_TYPE_REVIEW } from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import { refreshCards } from "@shared/services/reactive-card-store";
import { lastMutation } from "@shared/services/signals";
import type { ReviewApi } from "@shared/store";
import {
	extractFSRSSettings,
	type FSRSFlashcardItem,
	type FSRSPreset,
	type LocalAnswerAssessment,
	type SemanticGradingResult,
} from "@shared/types";
import { mountPreact } from "@shared/ui/preact";
import {
	ItemView,
	Menu,
	TFile,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";
import type { Grade } from "ts-fsrs";
import type TrueRecallPlugin from "../../../../main";

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
	private flashcardManager: FlashcardManager;
	private sessionPersistence: SessionPersistenceService;
	private semanticGradingService: SemanticAnswerGradingService;

	private filters: SessionFilters = {};
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
	private typeInState: TypeInAssessmentState = createEmptyTypeInState();
	private sessionTypeInModeEnabled = false;
	private aiEnabledForTypeIn = false;

	private get review(): ReviewApi {
		const store = this.plugin.store;
		if (!store) throw new Error("Store not initialized");
		return store.getState().review;
	}

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.flashcardManager = plugin.flashcardManager;
		this.reviewService = new ReviewService();
		this.sessionPersistence = plugin.sessionPersistence;
		this.semanticGradingService = new SemanticAnswerGradingService(
			() => this.plugin.settings,
		);
		this.applyDefaultTypeInMode();

		const fsrsSettings = extractFSRSSettings(plugin.settings);
		this.fsrsService = new FSRSService(fsrsSettings);

		this.editHandler = new EditHandler({
			app: this.app,
			getReview: () => this.review,
			flashcardManager: this.flashcardManager,
			undoService: plugin.undoService ?? undefined,
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
			},
			{
				onUpdateSchedulingPreview: () =>
					this.answerHandler.updateSchedulingPreview(),
			},
		);

		this.keyboardHandler = new KeyboardHandler(() => this.review, {
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
		});
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
			const sourceContext = await this.resolveSourceContext(card);
			semanticResult = await this.answerHandler.gradeTypedAnswerSemantically(
				card,
				typedAnswer,
				localAssessment.score,
				SEMANTIC_PASS_THRESHOLD,
				{ allowLocalFallback: false, sourceContext },
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

	private async handleAnswer(rating: Grade): Promise<void> {
		if (this.isProcessingAnswer) return;
		if (this.isRatingLocked()) return;
		this.isProcessingAnswer = true;
		try {
			await this.answerHandler.handleAnswer(rating);
			const nextCardId = this.review.getCurrentCard()?.id ?? null;
			this.resetTypeInState(nextCardId);
		} finally {
			this.isProcessingAnswer = false;
		}
	}

	// ─── Obsidian lifecycle ──────────────────────────────────────────────

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		this.filters = filtersFromViewState(
			(state as import("./review.types").ReviewViewState) ?? null,
		);
		this.filters.dayStartHour = this.plugin.settings.dayStartHour;
		this.crammedCardIds.clear();
		this.isProcessingAnswer = false;
		this.applyDefaultTypeInMode();
		this.resetTypeInState();

		await super.setState(state, result);
		await this.startSession();
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

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		this.applyDefaultTypeInMode();

		if (!this.plugin.store) return;
		this.unsubscribe = this.plugin.store.subscribe(
			(state) => state.review,
			() => {
				this.updateHeaderActions();
			},
		);

		this.plugin.undoService?.setReviewStateManager(this.review, {
			onUpdateSchedulingPreview: () =>
				this.answerHandler.updateSchedulingPreview(),
			onUndoAnswer: (payload, writeCancelled) =>
				this.answerHandler.handleUndoAnswer(payload, writeCancelled),
		});

		this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
			const activeView = this.app.workspace.getActiveViewOfType(ReviewView);
			if (activeView !== this) return;
			if (document.querySelector(".modal-container")) return;
			this.keyboardHandler.handleKeyDown(e);
		});
	}

	private mountApp(container: HTMLElement): void {
		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(ReviewApp, {
				onShowAnswer: () => void this.handleReveal(),
				onTypedAnswerChange: (value: string) =>
					this.handleTypedAnswerChange(value),
				onAnswer: (rating: Grade) => void this.handleAnswer(rating),
				onContentChange: (value: string, field: "question" | "answer") =>
					void this.editHandler.saveContent(value, field),
				onOpenSourceNote: () => this.handleOpenSourceNote(),
				onClose: () => this.handleClose(),
				onNextSession: () => this.handleNextSession(),
				onEndSession: () => {
					/* handled in Preact component */
				},
				onActionsMenu: (e: MouseEvent) => this.showActionsMenu(e),
				isCustomSession: isCustomSession(this.filters),
				crammingMode: this.filters.crammingMode ?? false,
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
		this.plugin.undoService?.setReviewStateManager(null, null);
		this.plugin.undoService?.clearSessionEntries();

		if (this.plugin.cardStore) {
			await this.plugin.cardStore.flush();
		}

		this.unsubscribe?.();
		this.unsubscribeFromSessionEvents();
		this.unmountPreact?.();

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

	private async handlePresetChange(newPresetName: string): Promise<void> {
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
			.setFsrsPreset(sourceFile, newPresetName);

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

			const allCards = this.flashcardManager.getAllFSRSCards();

			if (allCards.length === 0) {
				this.mountEmptyState(
					container,
					"No flashcards found. Generate some flashcards first!",
				);
				return;
			}

			const archivedSourceUids =
				this.plugin.hierarchyService.getArchivedSourceUids();
			const activeCards = filterActiveCards(allCards, {
				stateFilter: this.filters.stateFilter,
				archivedSourceUids,
			});

			if (activeCards.length === 0) {
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

			const snapshot = computeActionableSessionSnapshot(
				{
					allCards,
					archivedSourceUids,
					settings: this.plugin.settings,
					sessionPersistence: this.sessionPersistence,
					presetService: this.plugin.presetService,
					metadataCache: this.app.metadataCache,
					hierarchyService: this.plugin.hierarchyService,
					fsrsService: this.fsrsService,
					reviewService: this.reviewService,
				},
				this.filters,
				{ activeCards },
			);
			const queue = snapshot.queue;

			if (queue.length === 0) {
				this.mountEmptyState(
					container,
					getEmptyQueueMessage(this.filters.stateFilter),
				);
				return;
			}

			// Pre-resolve presets for all cards (keyed by sourceUid for dedup)
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

		this.sessionSignalDisposer = effect(() => {
			const m = lastMutation.value;
			if (!m) return;
			// Skip "reviewed" — the queue is already updated synchronously
			// by recordAnswerAndNext() before persistence runs
			if (m.type === "reviewed") return;
			applyMutation(
				m,
				this.review,
				this.flashcardManager,
				this.plugin.cardStore,
				this.filters,
			);
		});
	}

	private unsubscribeFromSessionEvents(): void {
		this.sessionSignalDisposer?.();
		this.sessionSignalDisposer = null;
	}

	// ─── Actions menu ────────────────────────────────────────────────────

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
				.onClick(() => void this.cardActionsHandler.handleAddImageOcclusion()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Open source note")
				.setIcon("external-link")
				.onClick(() => this.handleOpenSourceNote()),
		);

		menu.showAtMouseEvent(event);
	}

	private async resolveSourceContext(
		card: FSRSFlashcardItem,
	): Promise<string | undefined> {
		const MAX_CONTEXT_CHARS = 4000;

		if (card.sourceText) {
			return card.sourceText.slice(0, MAX_CONTEXT_CHARS);
		}

		const file = this.resolveSourceFile(card);
		if (!file) return undefined;

		try {
			const content = await this.app.vault.cachedRead(file);
			return content.slice(0, MAX_CONTEXT_CHARS);
		} catch {
			return undefined;
		}
	}

	// ─── Navigation ──────────────────────────────────────────────────────

	private resolveSourceFile(card: FSRSFlashcardItem): TFile | null {
		if (card.sourceUid && this.plugin.frontmatterIndex) {
			const file = this.plugin.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid,
			);
			if (file) return file;
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
		void this.plugin.activateView();
	}
}
