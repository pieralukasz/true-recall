import { h } from "preact";
import {
	ItemView,
	WorkspaceLeaf,
	Menu,
	TFile,
	type ViewStateResult,
} from "obsidian";
import { Rating, State, type Grade } from "ts-fsrs";
import { VIEW_TYPE_REVIEW } from "../../constants";
import {
	FSRSService,
	ReviewService,
	FlashcardManager,
	SessionPersistenceService,
	notify,
} from "../../services";
import { ImageService } from "../../services/image";
import { extractFSRSSettings, type FSRSFlashcardItem } from "../../types";
import type { ReviewApi } from "../../state/store";
import { effect } from "@preact/signals";
import { notifyCardChange, lastMutation, type CardMutation } from "../../services/core/signals";
import { mountPreact } from "../preact";
import { ReviewApp, ReviewEmptyState } from "./ReviewApp";
import type TrueRecallPlugin from "../../main";
import type { ReviewViewState } from "./review.types";
import { CardActionsHandler, KeyboardHandler } from "./handlers";
import {
	filterActiveCards,
	buildSourceUidToProjectsMap,
	getEmptyQueueMessage,
} from "./helpers";
import { CopilotIntegrationService } from "../../services/integration/copilot-integration.service";
import { DuplicateQuestionError } from "../../services/flashcard/card-repository.service";
import { BR_REGEX, buildProjectGraph, getDescendantProjects } from "../../utils";

export class ReviewView extends ItemView {

	private plugin: TrueRecallPlugin;
	private fsrsService: FSRSService;
	private reviewService: ReviewService;
	private flashcardManager: FlashcardManager;
	private sessionPersistence: SessionPersistenceService;

	private projectFilters: string[] = [];
	private isCustomSession: boolean = false;

	private sourceNoteFilter?: string;
	private sourceNoteFilters?: string[];
	private filePathFilter?: string;
	private createdTodayOnly?: boolean;
	private createdThisWeek?: boolean;
	private weakCardsOnly?: boolean;
	private stateFilter?: "due" | "learning" | "new" | "buried";
	private ignoreDailyLimits?: boolean;
	private bypassScheduling?: boolean;
	private difficultyRange?: { min: number; max: number };
	private lapsesRange?: { min: number; max: number };
	private stabilityRange?: { min: number; max: number };
	private overdueOnly?: boolean;
	private recentlyFailed?: boolean;
	private cardLimit?: number;
	private studyAheadDays?: number;
	private customReviewOrder?: import("../../types/settings.types").ReviewOrder;
	private crammingMode?: boolean;
	private crammedCardIds = new Set<string>();

	private cardActionsHandler!: CardActionsHandler;
	private keyboardHandler!: KeyboardHandler;
	private imageService!: ImageService;
	private copilotService!: CopilotIntegrationService;
	private lastCopilotContextCardId: string | null = null;

	private unmountPreact?: () => void;
	private openNoteAction: HTMLElement | null = null;
	private unsubscribe: (() => void) | null = null;
	private sessionSignalDisposer: (() => void) | null = null;

	private get review(): ReviewApi {
		return this.plugin.store!.getState().review;
	}

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.flashcardManager = plugin.flashcardManager;
		this.reviewService = new ReviewService();
		this.sessionPersistence = plugin.sessionPersistence;

		const fsrsSettings = extractFSRSSettings(plugin.settings);
		this.fsrsService = new FSRSService(fsrsSettings);

		this.imageService = new ImageService(this.app);
		this.copilotService = new CopilotIntegrationService(this.app);

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
				onUpdateSchedulingPreview: () => this.updateSchedulingPreview(),
			}
		);

		this.keyboardHandler = new KeyboardHandler(() => this.review, {
			onShowAnswer: () => this.handleShowAnswer(),
			onAnswer: (rating) => this.handleAnswer(rating as Grade),
			onUndo: async () => {
				await this.cardActionsHandler.handleUndo();
			},
			onSuspend: () => this.cardActionsHandler.handleSuspend(),
			onBuryCard: () => this.cardActionsHandler.handleBuryCard(),
			onBuryNote: () => this.cardActionsHandler.handleBuryNote(),
			onMoveCard: () => this.cardActionsHandler.handleMoveCard(),
			onAddCard: () => this.cardActionsHandler.handleAddNewFlashcard(),
			onCopyCard: () => this.cardActionsHandler.handleCopyCurrentCard(),
			onEditCard: () => this.cardActionsHandler.handleEditCardModal(),
		});
	}

	// ─── Obsidian lifecycle ──────────────────────────────────────────────

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const viewState = state as ReviewViewState | null;
		this.projectFilters = viewState?.projectFilters ?? [];
		this.sourceNoteFilter = viewState?.sourceNoteFilter;
		this.sourceNoteFilters = viewState?.sourceNoteFilters;
		this.filePathFilter = viewState?.filePathFilter;
		this.createdTodayOnly = viewState?.createdTodayOnly;
		this.createdThisWeek = viewState?.createdThisWeek;
		this.weakCardsOnly = viewState?.weakCardsOnly;
		this.stateFilter = viewState?.stateFilter;
		this.ignoreDailyLimits = viewState?.ignoreDailyLimits;
		this.bypassScheduling = viewState?.bypassScheduling;
		this.difficultyRange = viewState?.difficultyRange;
		this.lapsesRange = viewState?.lapsesRange;
		this.stabilityRange = viewState?.stabilityRange;
		this.overdueOnly = viewState?.overdueOnly;
		this.recentlyFailed = viewState?.recentlyFailed;
		this.cardLimit = viewState?.cardLimit;
		this.studyAheadDays = viewState?.studyAheadDays;
		this.customReviewOrder = viewState?.reviewOrder;
		this.crammingMode = viewState?.crammingMode;
		this.crammedCardIds.clear();

		this.isCustomSession = !!(
			viewState?.sourceNoteFilter ||
			(viewState?.sourceNoteFilters &&
				viewState.sourceNoteFilters.length > 0) ||
			viewState?.filePathFilter ||
			viewState?.createdTodayOnly ||
			viewState?.createdThisWeek ||
			viewState?.weakCardsOnly ||
			viewState?.stateFilter ||
			viewState?.difficultyRange ||
			viewState?.lapsesRange ||
			viewState?.stabilityRange ||
			viewState?.overdueOnly ||
			viewState?.recentlyFailed ||
			viewState?.studyAheadDays
		);

		await super.setState(state, result);

		await this.startSession();
	}

	getState(): ReviewViewState {
		return {
			projectFilters: this.projectFilters,
			sourceNoteFilter: this.sourceNoteFilter,
			sourceNoteFilters: this.sourceNoteFilters,
			filePathFilter: this.filePathFilter,
			createdTodayOnly: this.createdTodayOnly,
			createdThisWeek: this.createdThisWeek,
			weakCardsOnly: this.weakCardsOnly,
			stateFilter: this.stateFilter,
			ignoreDailyLimits: this.ignoreDailyLimits,
			bypassScheduling: this.bypassScheduling,
			difficultyRange: this.difficultyRange,
			lapsesRange: this.lapsesRange,
			stabilityRange: this.stabilityRange,
			overdueOnly: this.overdueOnly,
			recentlyFailed: this.recentlyFailed,
			cardLimit: this.cardLimit,
			studyAheadDays: this.studyAheadDays,
			reviewOrder: this.customReviewOrder,
			crammingMode: this.crammingMode,
		};
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

		this.unsubscribe = this.plugin.store!.subscribe(
			(state) => state.review,
			() => {
				this.updateHeaderActions();
				this.addCopilotContext();
				this.mountApp(container);
			},
		);

		this.plugin.undoService?.setReviewStateManager(this.review, {
			onUpdateSchedulingPreview: () => this.updateSchedulingPreview(),
			onUndoAnswer: (payload, writeCancelled) =>
				this.handleUndoAnswerFromService(payload, writeCancelled),
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
				onShowAnswer: () => this.handleShowAnswer(),
				onAnswer: (rating: Grade) => void this.handleAnswer(rating),
				onStartEdit: (field: "question" | "answer") => this.startEdit(field),
				onSaveEdit: (textarea: HTMLTextAreaElement, field: "question" | "answer") =>
					void this.saveEditFromTextarea(textarea, field),
				onImagePaste: (file: File, textarea: HTMLTextAreaElement) =>
					void this.handleInlineImagePaste(file, textarea),
				onOpenSourceNote: () => this.handleOpenSourceNote(),
				onClose: () => this.handleClose(),
				onNextSession: () => this.handleNextSession(),
				onEndSession: () => { /* handled in Preact component */ },
				onActionsMenu: (e: MouseEvent) => this.showActionsMenu(e),
				isCustomSession: this.isCustomSession,
				crammingMode: this.crammingMode ?? false,
				showHeader: this.plugin.settings.showReviewHeader,
				showHeaderStats: this.plugin.settings.showReviewHeaderStats,
				showNextReviewTime: this.plugin.settings.showNextReviewTime,
				continuousCustomReviews: this.plugin.settings.continuousCustomReviews,
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

		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		this.review.reset();
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
			this.handleOpenNote()
		);
	}

	// ─── Session lifecycle ───────────────────────────────────────────────

	async startSession(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;

		try {
			const fsrsSettings = extractFSRSSettings(this.plugin.settings);
			this.fsrsService.updateSettings(fsrsSettings);

			const allCards = this.flashcardManager.getAllFSRSCards();

			if (allCards.length === 0) {
				this.mountEmptyState(container, "No flashcards found. Generate some flashcards first!");
				return;
			}

			const activeCards = filterActiveCards(allCards, {
				stateFilter: this.stateFilter,
			});

			if (activeCards.length === 0) {
				const msg = this.stateFilter === "buried"
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
			const reviewedToday = this.sessionPersistence.getReviewedToday();
			const newCardsStudiedToday = this.sessionPersistence.getNewCardsStudiedToday();
			const reviewsCompletedToday = this.sessionPersistence.getReviewCardsCompletedToday();

			// Cascade: expand project filters to include all descendant projects
			let effectiveProjectFilters = this.projectFilters;
			if (this.projectFilters.length > 0) {
				const graph = buildProjectGraph(this.plugin.frontmatterIndex);
				const expanded = new Set(this.projectFilters);
				for (const filter of this.projectFilters) {
					const descendants = getDescendantProjects(filter, graph.childrenMap);
					for (const d of descendants) expanded.add(d);
				}
				effectiveProjectFilters = [...expanded];
			}

			const sourceUidToProjects = buildSourceUidToProjectsMap(
				this.app,
				effectiveProjectFilters
			);

			const queue = this.reviewService.buildQueue(
				activeCards,
				this.fsrsService,
				{
					newCardsLimit: this.plugin.settings.newCardsPerDay,
					reviewsLimit: this.plugin.settings.reviewsPerDay,
					reviewedToday,
					newCardsStudiedToday,
					reviewsCompletedToday,
					projectFilters: effectiveProjectFilters,
					sourceUidToProjects,
					newCardOrder: this.plugin.settings.newCardOrder,
					reviewOrder: this.customReviewOrder ?? this.plugin.settings.reviewOrder,
					newReviewMix: this.plugin.settings.newReviewMix,
					dayStartHour: this.plugin.settings.dayStartHour,
					sourceNoteFilter: this.sourceNoteFilter,
					sourceNoteFilters: this.sourceNoteFilters,
					filePathFilter: this.filePathFilter,
					createdTodayOnly: this.createdTodayOnly,
					createdThisWeek: this.createdThisWeek,
					weakCardsOnly: this.weakCardsOnly,
					stateFilter: this.stateFilter,
					ignoreDailyLimits: this.ignoreDailyLimits,
					bypassScheduling: this.bypassScheduling,
					difficultyRange: this.difficultyRange,
					lapsesRange: this.lapsesRange,
					stabilityRange: this.stabilityRange,
					overdueOnly: this.overdueOnly,
					recentlyFailed: this.recentlyFailed,
					cardLimit: this.cardLimit,
					studyAheadDays: this.studyAheadDays,
				}
			);

			if (queue.length === 0) {
				this.mountEmptyState(
					container,
					getEmptyQueueMessage(this.stateFilter, this.projectFilters)
				);
				return;
			}

			this.review.startSession(queue);
			this.subscribeToSessionEvents();
			this.updateSchedulingPreview();

			// Mount the Preact app now that the session is active
			this.mountApp(container);
		} catch (error) {
			console.error("Error starting review session:", error);
			notify().error(
				`Error: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// ─── Signal-based mutation handling ──────────────────────────────────

	private subscribeToSessionEvents(): void {
		this.unsubscribeFromSessionEvents();

		this.sessionSignalDisposer = effect(() => {
			const m = lastMutation.value;
			if (!m) return;
			this.handleMutation(m);
		});
	}

	private handleMutation(m: CardMutation): void {
		switch (m.type) {
			case "removed": {
				if (m.cardId) {
					const queue = this.review.queue;
					if (queue.find((c) => c.id === m.cardId)) {
						this.review.removeCardById(m.cardId);
					}
				}
				if (m.cardIds && m.cardIds.length > 1) {
					const queueIds = new Set(this.review.queue.map((c) => c.id));
					const idsToRemove = m.cardIds.filter((id) => queueIds.has(id));
					if (idsToRemove.length > 0) {
						this.review.removeCardsByIds(idsToRemove);
					}
				}
				break;
			}
			case "updated": {
				if (!m.changes?.question && !m.changes?.answer) return;
				const currentCard = this.review.getCurrentCard();
				if (currentCard && m.cardId && currentCard.id === m.cardId) {
					const updatedData = this.plugin.cardStore.get(m.cardId);
					if (updatedData) {
						this.review.updateCurrentCardContent(
							updatedData.question ?? currentCard.question,
							updatedData.answer ?? currentCard.answer
						);
					}
				}
				break;
			}
			case "bulk": {
				if (m.action !== "removed" || !m.cardIds) return;
				const queueIds = new Set(this.review.queue.map((c) => c.id));
				const idsToRemove = m.cardIds.filter((id) => queueIds.has(id));
				if (idsToRemove.length > 0) {
					this.review.removeCardsByIds(idsToRemove);
				}
				break;
			}
			case "added": {
				if (!m.cardId) return;
				const cards = this.flashcardManager.getCardsByIds([m.cardId]);
				const newCard = cards[0];
				if (!newCard) return;

				if (this.sourceNoteFilter && newCard.sourceNoteName !== this.sourceNoteFilter) {
					return;
				}
				if (this.sourceNoteFilters && this.sourceNoteFilters.length > 0) {
					if (!this.sourceNoteFilters.includes(newCard.sourceNoteName ?? "")) {
						return;
					}
				}

				this.review.addCardToQueue(newCard);
				break;
			}
		}
	}

	private unsubscribeFromSessionEvents(): void {
		this.sessionSignalDisposer?.();
		this.sessionSignalDisposer = null;
	}

	// ─── Edit mode ───────────────────────────────────────────────────────

	private startEdit(field: "question" | "answer"): void {
		if (field === "answer" && !this.review.isAnswerRevealed) {
			return;
		}
		this.review.startEdit(field);
	}

	private async handleInlineImagePaste(
		file: File,
		textarea: HTMLTextAreaElement
	): Promise<void> {
		try {
			const savedPath = await this.imageService.saveImageFromClipboard(file);
			if (!savedPath) {
				notify().warning("Failed to save image");
				return;
			}

			const markdown = this.imageService.buildImageMarkdown(savedPath, 500);
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const value = textarea.value;

			textarea.value = value.substring(0, start) + markdown + value.substring(end);
			textarea.selectionStart = textarea.selectionEnd = start + markdown.length;
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		} catch (error) {
			console.error("Error saving image:", error);
			notify().operationFailed("save image", error);
		}
	}

	private async saveEditFromTextarea(
		textarea: HTMLTextAreaElement,
		field: "question" | "answer"
	): Promise<void> {
		const card = this.review.getCurrentCard();
		const editState = this.review.getEditState();
		if (!card || !editState.active) return;

		const cardIdBeforeSave = card.id;
		const newContent = textarea.value;

		// Cloze template editing: re-derive all siblings from the new template
		if (
			card.cardType === "cloze" &&
			card.clozeTemplate &&
			card.sourceUid &&
			field === "question"
		) {
			const hasChanges = newContent !== card.clozeTemplate;
			if (hasChanges) {
				try {
					const { hasClozeContent, parseClozeTemplate } = await import(
						"../../services/flashcard/cloze-parser.service"
					);
					if (hasClozeContent(newContent)) {
						this.flashcardManager.updateClozeTemplate(
							card.sourceUid,
							card.clozeTemplate,
							newContent,
							card.sourceNoteName
						);

						const newCards = parseClozeTemplate(newContent);
						const thisCard = newCards.find(
							(c) => c.clozeIndex === card.clozeIndex
						);
						if (thisCard) {
							this.review.updateCurrentCardContent(
								thisCard.question,
								thisCard.answer
							);
						}
						notify().success("Updated cloze template");
					} else {
						this.flashcardManager.updateCardContent(
							cardIdBeforeSave,
							newContent,
							card.answer
						);
						this.review.updateCurrentCardContent(newContent, card.answer);
						notify().cardUpdated();
					}
				} catch (error) {
					if (error instanceof DuplicateQuestionError) {
						const sourceInfo = error.existingSourceUid
							? this.flashcardManager.getSourceNoteService().resolveSourceNote(error.existingSourceUid)
							: {};
						notify().duplicateFound(newContent, sourceInfo.noteName);
					} else {
						console.error("Error saving cloze template:", error);
						notify().operationFailed("save cloze template", error);
					}
				}
			}

			this.review.cancelEdit();
			return;
		}

		const newQuestion = field === "question" ? newContent : card.question;
		const newAnswer = field === "answer" ? newContent : card.answer;

		// Compare with normalized content (convert legacy <br> to newlines)
		const normalizedOriginal = field === "question"
			? editState.originalQuestion.replace(BR_REGEX, "\n")
			: editState.originalAnswer.replace(BR_REGEX, "\n");
		const hasChanges = newContent !== normalizedOriginal;

		if (hasChanges) {
			try {
				this.flashcardManager.updateCardContent(
					cardIdBeforeSave,
					newQuestion,
					newAnswer
				);

				const currentCard = this.review.getCurrentCard();
				if (currentCard?.id === cardIdBeforeSave) {
					this.review.updateCurrentCardContent(newQuestion, newAnswer);
					notify().cardUpdated();
				}
			} catch (error) {
				if (error instanceof DuplicateQuestionError) {
					const sourceInfo = error.existingSourceUid
						? this.flashcardManager.getSourceNoteService().resolveSourceNote(error.existingSourceUid)
						: {};
					notify().duplicateFound(newQuestion, sourceInfo.noteName);
				} else {
					console.error("Error saving card content:", error);
					notify().operationFailed("save card", error);
				}
			}
		}

		this.review.cancelEdit();
	}

	// ─── Review actions ──────────────────────────────────────────────────

	private updateSchedulingPreview(): void {
		const card = this.review.getCurrentCard();
		if (card) {
			const preset = this.plugin.presetService.resolvePresetForCard(card, this.projectFilters);
			const presetSettings = this.plugin.presetService.toFSRSSettings(preset);
			const preview = this.fsrsService.getSchedulingPreview(card.fsrs, presetSettings);
			this.review.setSchedulingPreview(preview);
		}
	}

	private handleShowAnswer(): void {
		this.review.revealAnswer();
		this.updateSchedulingPreview();
	}

	private async handleAnswer(rating: Grade): Promise<void> {
		const card = this.review.getCurrentCard();
		if (!card) return;

		const currentIndex = this.review.currentIndex;
		const responseTime = Date.now() - this.review.questionShownTime;

		const isNewCard = card.fsrs.state === State.New;
		const previousState = card.fsrs.state;

		const preset = this.plugin.presetService.resolvePresetForCard(card, this.projectFilters);
		const presetSettings = this.plugin.presetService.toFSRSSettings(preset);

		const { updatedCard, result } = this.reviewService.processAnswer(
			card,
			rating,
			this.fsrsService,
			responseTime,
			presetSettings
		);

		// Cramming mode: skip persistence
		if (this.crammingMode) {
			this.crammedCardIds.add(card.id);
			const hasMore = this.review.recordAnswerAndNext(rating, updatedCard);
			if (hasMore) {
				this.updateSchedulingPreview();
			}
			return;
		}

		let requeueData: { card: FSRSFlashcardItem; position: number } | undefined;
		if (this.reviewService.shouldRequeue(updatedCard)) {
			const relativePosition = this.reviewService.getRequeuePosition(
				this.review.queue,
				this.review.currentIndex + 1,
				updatedCard,
				this.plugin.settings.reviewOrder
			);
			requeueData = {
				card: updatedCard,
				position: relativePosition,
			};
		}

		const hasMore = this.review.recordAnswerAndNext(rating, updatedCard, requeueData);

		// Undo entry with deferred persistence
		let writeExecuted = false;
		let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

		this.plugin.undoService?.push({
			id: crypto.randomUUID(),
			actionType: "answer",
			description: `Review (${Rating[rating]})`,
			timestamp: Date.now(),
			payload: {
				type: "answer",
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
				wasNewCard: isNewCard,
				rating,
				previousState,
				requeuedAtIndex: requeueData?.position,
			},
			cancelPendingWrite: () => {
				if (!writeExecuted && pendingTimeoutId !== null) {
					clearTimeout(pendingTimeoutId);
					pendingTimeoutId = null;
					return true;
				}
				return false;
			},
		});

		// Defer persistence until after the browser paints the next card
		pendingTimeoutId = setTimeout(() => {
			writeExecuted = true;
			pendingTimeoutId = null;

			this.flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);

			try {
				this.sessionPersistence.recordReview(
					card.id,
					isNewCard,
					responseTime,
					rating,
					previousState,
					result.scheduledDays,
					result.elapsedDays,
					preset.name
				);
			} catch (error) {
				console.error("Error recording review to persistent storage:", error);
			}

			notifyCardChange({
				type: "reviewed",
				cardId: card.id,
				rating: rating as number,
				newState: updatedCard.fsrs.state,
			});

			if (hasMore) {
				this.updateSchedulingPreview();
			}
		}, 0);
	}

	private async handleUndoAnswerFromService(
		payload: import("../../services/undo").AnswerUndoPayload,
		writeCancelled: boolean
	): Promise<void> {
		try {
			if (!writeCancelled) {
				this.sessionPersistence.removeLastReview(
					payload.card.id,
					payload.wasNewCard ?? false,
					payload.rating,
					payload.previousState
				);
			}

			this.review.undoLastAnswer(
				payload.previousIndex,
				{ ...payload.card, fsrs: payload.originalFsrs },
				payload.requeuedAtIndex
			);
		} catch (error) {
			console.error("Error undoing answer:", error);
		}
	}

	// ─── Copilot integration ─────────────────────────────────────────────

	private addCopilotContext(): void {
		const card = this.review.getCurrentCard();
		if (!card) return;
		if (!this.plugin.settings.copilotAutoContext) return;
		if (!this.copilotService.isAvailable()) return;
		if (this.lastCopilotContextCardId === card.id) return;
		if (!card.sourceUid) return;

		const sourceFile = this.plugin.frontmatterIndex?.getFileByValue(
			"flashcard_uid",
			card.sourceUid
		);
		if (!sourceFile) return;

		void this.copilotService.addNoteToContext(sourceFile).then((success) => {
			if (success) {
				this.lastCopilotContextCardId = card.id;
			}
		});
	}

	// ─── Actions menu ────────────────────────────────────────────────────

	private showActionsMenu(event: MouseEvent): void {
		const menu = new Menu();

		if (this.cardActionsHandler.canUndo()) {
			menu.addItem((item) =>
				item
					.setTitle("Undo last answer (z)")
					.setIcon("undo")
					.onClick(() => this.cardActionsHandler.handleUndo())
			);
			menu.addSeparator();
		}

		menu.addItem((item) =>
			item.setTitle("Move card (m)").setIcon("folder-input")
				.onClick(() => this.cardActionsHandler.handleMoveCard())
		);
		menu.addItem((item) =>
			item.setTitle("Suspend card").setIcon("pause")
				.onClick(() => this.cardActionsHandler.handleSuspend())
		);
		menu.addItem((item) =>
			item.setTitle("Bury card (-)").setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryCard())
		);
		menu.addItem((item) =>
			item.setTitle("Bury note (=)").setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryNote())
		);
		menu.addItem((item) =>
			item.setTitle("Edit card (e)").setIcon("pencil")
				.onClick(() => void this.cardActionsHandler.handleEditCardModal())
		);
		menu.addItem((item) =>
			item.setTitle("Add flashcard (a)").setIcon("plus")
				.onClick(() => void this.cardActionsHandler.handleAddNewFlashcard())
		);
		menu.addItem((item) =>
			item.setTitle("Open source note").setIcon("external-link")
				.onClick(() => this.handleOpenSourceNote())
		);

		menu.showAtMouseEvent(event);
	}

	// ─── Navigation ──────────────────────────────────────────────────────

	private handleOpenSourceNote(): void {
		const card = this.review.getCurrentCard();
		if (!card || !card.sourceNoteName) {
			notify().warning("Source note not found");
			return;
		}

		let sourceFile: TFile | null | undefined;
		if (card.sourceUid && this.plugin.frontmatterIndex) {
			sourceFile = this.plugin.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid
			);
		}

		if (!sourceFile && card.sourceNotePath) {
			const abstractFile = this.app.vault.getAbstractFileByPath(card.sourceNotePath);
			if (abstractFile instanceof TFile) {
				sourceFile = abstractFile;
			}
		}

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
