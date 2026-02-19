import {
	ItemView,
	WorkspaceLeaf,
	Menu,
	setIcon,
	TFile,
	type ViewStateResult,
} from "obsidian";
import { Rating, State, type Grade } from "ts-fsrs";
import { VIEW_TYPE_REVIEW, UI_CONFIG } from "../../constants";
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
import { effect } from "@preact/signals-core";
import { notifyCardChange, lastMutation, type CardMutation } from "../../services/core/signals";
import { SubscriptionManager } from "../utils";
import type TrueRecallPlugin from "../../main";
import type { ReviewViewState } from "./review.types";
import { CardActionsHandler, KeyboardHandler } from "./handlers";
import { CardContent, CardBacklink, CardProjects } from "./components";
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

	private expandedProjects: Set<string> = new Set();

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

	private cardContent!: CardContent;
	private cardBacklink!: CardBacklink;
	private cardProjects!: CardProjects;

	private imageService!: ImageService;

	private copilotService!: CopilotIntegrationService;

	private lastCopilotContextCardId: string | null = null;

	private headerEl!: HTMLElement;
	private cardContainerEl!: HTMLElement;
	private buttonsEl!: HTMLElement;
	private openNoteAction: HTMLElement | null = null;

	private unsubscribe: (() => void) | null = null;

	private subs = new SubscriptionManager();

	private sessionSignalDisposer: (() => void) | null = null;

	private waitingTimerId: ReturnType<typeof setInterval> | null = null;

	private cardEventAbortController: AbortController | null = null;

	private lastRenderedState: {
		cardId: string | null;
		answerRevealed: boolean;
		editActive: boolean;
		question: string | null;
		answer: string | null;
		badgeCounts: { new: number; learning: number; due: number } | null;
	} = {
		cardId: null,
		answerRevealed: false,
		editActive: false,
		question: null,
		answer: null,
		badgeCounts: null,
	};

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

		this.cardContent = new CardContent(
			{ app: this.app, component: this },
			{
				onStartEdit: (field) => this.startEdit(field),
				onSaveEdit: (textarea, field) =>
					this.saveEditFromTextarea(textarea, field),
				onImagePaste: (file, textarea) =>
					this.handleInlineImagePaste(file, textarea),
				isAnswerRevealed: () => this.review.isAnswerShown(),
			}
		);

		this.cardBacklink = new CardBacklink({
			onOpenSource: () => this.handleOpenSourceNote(),
		});

		this.cardProjects = new CardProjects({
			onToggleProjects: (cardId) => {
				this.expandedProjects.add(cardId);
				this.renderCard();
			},
			onOpenProject: (project) => this.handleProjectClick(project),
		});
	}

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
		container.addClass(
			"true-recall-review",
			"ep:flex",
			"ep:flex-col",
			"ep:h-full",
			"ep:p-0"
		);

		this.headerEl = container.createDiv({
			cls: "ep:flex ep:justify-center ep:items-center ep:border-b ep:border-obs-border ep:relative ep:shrink-0 ep:p-2 ep:pb-4",
		});
		this.cardContainerEl = container.createDiv({
			cls: "true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto",
		});

		// Delegated click handler for all card interactions
		// Uses event delegation pattern for better performance (single listener vs many)
		this.cardContainerEl.addEventListener("click", (e: MouseEvent) => {
			const target = e.target as HTMLElement;

			// Clear text selection when clicking outside content
			if (target === this.cardContainerEl) {
				window.getSelection()?.removeAllRanges();
				return;
			}

			// Handle data-action clicks (open-source, toggle-projects, open-project)
			const actionEl = target.closest<HTMLElement>("[data-action]");
			if (actionEl) {
				const action = actionEl.dataset.action;
				if (action === "open-source") {
					this.handleOpenSourceNote();
					return;
				}
				if (action === "toggle-projects") {
					const cardId = actionEl.dataset.cardId;
					if (cardId) {
						this.expandedProjects.add(cardId);
						this.renderCard();
					}
					return;
				}
				if (action === "open-project") {
					const project = actionEl.dataset.project;
					if (project) {
						this.handleProjectClick(project);
					}
					return;
				}
			}

			// Handle field clicks (question/answer) for internal links and edit mode
			const fieldEl = target.closest<HTMLElement>("[data-field]");
			if (fieldEl) {
				const field = fieldEl.dataset.field as "question" | "answer" | undefined;
				const sourcePath = fieldEl.dataset.sourcePath || "";
				if (field) {
					this.handleFieldClick(e, field, sourcePath);
				}
			}
		});

		this.buttonsEl = container.createDiv({
			cls: "true-recall-review-buttons ep:flex ep:justify-center ep:gap-3 ep:border-t ep:border-obs-border ep:flex-nowrap ep:shrink-0 ep:p-4",
		});

		this.unsubscribe = this.plugin.store!.subscribe(
			(state) => state.review,
			() => {
				this.render();
				this.updateHeaderActions();
			}
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

	private updateHeaderActions(): void {
		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		if (
			!this.review.isActive ||
			!this.plugin.settings.showReviewHeader
		) {
			return;
		}

		this.openNoteAction = this.addAction("external-link", "Open note", () =>
			this.handleOpenNote()
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
		this.subs.dispose();
		this.cardEventAbortController?.abort();
		this.cardEventAbortController = null;
		this.cardContent.destroy();

		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		this.review.reset();
	}

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
				this.renderHeader();
				break;
			}
		}
	}

	private unsubscribeFromSessionEvents(): void {
		this.sessionSignalDisposer?.();
		this.sessionSignalDisposer = null;
	}

	private clearWaitingTimer(): void {
		if (this.waitingTimerId) {
			this.subs.clearInterval(this.waitingTimerId);
			this.waitingTimerId = null;
		}
	}

	async startSession(): Promise<void> {
		try {
			const fsrsSettings = extractFSRSSettings(this.plugin.settings);
			this.fsrsService.updateSettings(fsrsSettings);

			const allCards = this.flashcardManager.getAllFSRSCards();

			if (allCards.length === 0) {
				this.renderEmptyState(
					"No flashcards found. Generate some flashcards first!"
				);
				return;
			}

			const activeCards = filterActiveCards(allCards, {
				stateFilter: this.stateFilter,
			});

			if (activeCards.length === 0) {
				if (this.stateFilter === "buried") {
					this.renderEmptyState("No buried cards found.");
				} else {
					this.renderEmptyState(
						"All cards are suspended or buried. Unsuspend/unbury some cards to start reviewing."
					);
				}
				return;
			}

			if (!this.sessionPersistence) {
				this.sessionPersistence = this.plugin.sessionPersistence;
			}
			if (!this.sessionPersistence) {
				console.error("[ReviewView] sessionPersistence not initialized");
				this.renderEmptyState("Session persistence not ready. Please try again.");
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
					// Custom session filters
					sourceNoteFilter: this.sourceNoteFilter,
					sourceNoteFilters: this.sourceNoteFilters,
					filePathFilter: this.filePathFilter,
					createdTodayOnly: this.createdTodayOnly,
					createdThisWeek: this.createdThisWeek,
					weakCardsOnly: this.weakCardsOnly,
					stateFilter: this.stateFilter,
					ignoreDailyLimits: this.ignoreDailyLimits,
					bypassScheduling: this.bypassScheduling,
					// Advanced custom study filters
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
				this.renderEmptyState(
					getEmptyQueueMessage(this.stateFilter, this.projectFilters)
				);
				return;
			}

			this.review.startSession(queue);
			this.subscribeToSessionEvents();
			this.updateSchedulingPreview();
		} catch (error) {
			console.error("Error starting review session:", error);
			notify().error(
				`Error: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	private resetRenderState(): void {
		this.lastRenderedState.cardId = null;
		this.lastRenderedState.question = null;
		this.lastRenderedState.answer = null;
	}

	private render(): void {
		const phase = this.review.getPhase();

		switch (phase.type) {
			case "idle":
				this.resetRenderState();
				return;

			case "complete":
				this.renderHeader();
				this.review.endSession();
				this.renderSummary();
				this.resetRenderState();
				return;

			case "waiting":
				this.renderHeader();
				this.renderWaitingScreen();
				this.resetRenderState();
				return;

			case "active":
				// Continue to active card rendering below
				break;
		}

		this.clearWaitingTimer();

		const currentCard = phase.card;
		const answerRevealed = this.review.isAnswerRevealed;
		const editState = this.review.getEditState();
		const prev = this.lastRenderedState;

		const cardChanged = currentCard.id !== prev.cardId;
		const answerJustRevealed = answerRevealed && !prev.answerRevealed;
		const editStateChanged = editState.active !== prev.editActive;
		const contentChanged = currentCard.question !== prev.question ||
			currentCard.answer !== prev.answer;

		if (this.plugin.settings.showReviewHeader) {
			this.headerEl.removeClass("ep:hidden");
			this.renderHeader();
		} else {
			this.headerEl.addClass("ep:hidden");
			this.headerEl.empty();
		}

		if (cardChanged || answerJustRevealed || editStateChanged || contentChanged) {
			this.renderCard();
		}

		this.renderButtons();

		this.lastRenderedState = {
			cardId: currentCard.id,
			answerRevealed,
			editActive: editState.active,
			question: currentCard.question,
			answer: currentCard.answer,
			badgeCounts: prev.badgeCounts,
		};
	}

	private renderHeader(): void {
		if (!this.plugin.settings.showReviewHeaderStats) {
			this.headerEl.empty();
			this.lastRenderedState.badgeCounts = null;
			return;
		}

		const counts = this.review.getBadgeCounts();
		const prevCounts = this.lastRenderedState.badgeCounts;

		if (
			prevCounts &&
			prevCounts.new === counts.new &&
			prevCounts.learning === counts.learning &&
			prevCounts.due === counts.due
		) {
			return;
		}

		this.headerEl.empty();
		this.lastRenderedState.badgeCounts = { ...counts };

		const statsContainer = this.headerEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1.5",
		});
		this.renderHeaderStatBadge(statsContainer, "new", counts.new);
		this.renderHeaderStatBadge(statsContainer, "learning", counts.learning);
		this.renderHeaderStatBadge(statsContainer, "due", counts.due);

		if (this.crammingMode) {
			statsContainer.createDiv({
				cls: "ep:flex ep:items-center ep:justify-center ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ep:bg-obs-orange/20 ep:text-obs-orange ep:ml-1",
				text: "Cram",
			});
		}
	}

	private renderHeaderStatBadge(
		container: HTMLElement,
		type: "new" | "learning" | "due",
		count: number
	): void {
		const typeColors = {
			new: "ep:bg-obs-green/20 ep:text-obs-green",
			learning: "ep:bg-obs-orange/20 ep:text-obs-orange",
			due: "ep:bg-obs-blue/20 ep:text-obs-blue",
		};
		const badge = container.createDiv({
			cls: `ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ${typeColors[type]}`,
		});
		badge.createSpan({ text: String(count) });
	}

	private async addSourceToCopilotContext(
		card: FSRSFlashcardItem
	): Promise<void> {
		if (!this.plugin.settings.copilotAutoContext) return;
		if (!this.copilotService.isAvailable()) return;
		if (this.lastCopilotContextCardId === card.id) return;
		if (!card.sourceUid) return;

		const sourceFile = this.plugin.frontmatterIndex?.getFileByValue(
			"flashcard_uid",
			card.sourceUid
		);
		if (!sourceFile) return;

		const success = await this.copilotService.addNoteToContext(sourceFile);
		if (success) {
			this.lastCopilotContextCardId = card.id;
		}
	}

	private renderCard(): void {
		const card = this.review.getCurrentCard();
		if (!card) {
			this.cardContainerEl.empty();
			return;
		}

		void this.addSourceToCopilotContext(card);

		const editState = this.review.getEditState();
		const isAnswerRevealed = this.review.isAnswerRevealed;

		this.cardContent.render(
			this.cardContainerEl,
			card,
			editState,
			isAnswerRevealed
		);

		if (isAnswerRevealed && !editState.active) {
			const cardEl = this.cardContainerEl.querySelector(".ep\\:w-full");
			if (cardEl instanceof HTMLElement) {
				this.cardBacklink.render(cardEl, card.sourceNoteName ?? null);
				this.cardProjects.render(
					cardEl,
					card.id,
					card.projects,
					this.expandedProjects.has(card.id)
				);
			}
		}
	}

	private handleFieldClick(
		e: MouseEvent,
		field: "question" | "answer",
		filePath: string
	): void {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		const linkEl = target.closest("a.internal-link");

		if (linkEl) {
			e.preventDefault();
			e.stopPropagation();
			const href = linkEl.getAttribute("data-href");

			if (e.metaKey || e.ctrlKey) {
				this.startEdit(field);
			} else if (href) {
				const existingLeaf = this.app.workspace.getMostRecentLeaf();
				if (existingLeaf && existingLeaf !== this.leaf) {
					void this.app.workspace.openLinkText(href, filePath, false);
				} else {
					void this.app.workspace.openLinkText(href, filePath, "tab");
				}
			}
		} else if (e.metaKey || e.ctrlKey) {
			this.startEdit(field);
		}
	}

	private startEdit(field: "question" | "answer"): void {
		if (field === "answer" && !this.review.isAnswerRevealed) {
			return;
		}
		this.review.startEdit(field);
		this.cardContainerEl.addClass(
			"true-recall-review-card-container--editing"
		);
		this.renderCard();
		// Hide buttons when entering edit mode (prevents keyboard overlap on mobile)
		this.renderButtons();
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

		// Capture card ID before async operation to prevent race conditions
		const cardIdBeforeSave = card.id;

		const newContent = textarea.value;

		// Cloze template editing: when editing question of a cloze card,
		// treat the text as a new cloze template and re-derive all siblings
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

						// Update current card in review queue with re-derived Q/A
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
						// No longer cloze syntax — update as regular content
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
			this.cardContainerEl.removeClass(
				"true-recall-review-card-container--editing"
			);
			this.renderCard();
			this.renderButtons();
			return;
		}

		const newQuestion = field === "question" ? newContent : card.question;
		const newAnswer = field === "answer" ? newContent : card.answer;

		// Compare with normalized content (convert legacy <br> to newlines for comparison)
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
					this.review.updateCurrentCardContent(
						newQuestion,
						newAnswer
					);
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
		this.cardContainerEl.removeClass(
			"true-recall-review-card-container--editing"
		);
		this.renderCard();
		this.renderButtons();
	}

	private renderButtons(): void {
		const isEditing = this.review.getEditState().active;
		const answerRevealed = this.review.isAnswerRevealed;
		const currentCardId = this.review.getCurrentCard()?.id ?? null;
		const prev = this.lastRenderedState;

		// Prevents keyboard from pushing buttons up on mobile
		if (isEditing) {
			this.buttonsEl.addClass("ep:hidden");
			return;
		}
		this.buttonsEl.removeClass("ep:hidden");

		const cardChanged = currentCardId !== prev.cardId;
		const answerJustRevealed = answerRevealed && !prev.answerRevealed;
		const editEnded = !isEditing && prev.editActive;

		if (
			this.buttonsEl.children.length > 0 &&
			!cardChanged &&
			!answerJustRevealed &&
			!editEnded
		) {
			return;
		}

		this.buttonsEl.empty();

		const buttonsWrapper = this.buttonsEl.createDiv({
			cls: "ep:flex ep:items-center ep:justify-center ep:w-full ep:relative",
		});

		const mainButtonsEl = buttonsWrapper.createDiv({
			cls: "ep:flex ep:justify-center ep:gap-3 ep:flex-nowrap ep:py-4",
		});

		const baseBtnCls =
			"ep:flex ep:flex-col ep:items-center ep:gap-1 !ep:py-4 ep:px-6 ep:h-auto ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:min-w-20 ep:whitespace-nowrap ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

		if (!this.review.isAnswerRevealed) {
			const showBtn = mainButtonsEl.createEl("button", {
				cls: `${baseBtnCls} mod-cta ep:py-2 ep:px-4`,
				text: "Show answer",
			});
			showBtn.addEventListener("click", () => this.handleShowAnswer());
		} else {
			const preview = this.review.getSchedulingPreview();
			this.renderRatingButton(
				mainButtonsEl,
				"Again",
				Rating.Again,
				`${baseBtnCls} ep:bg-obs-red ep:text-obs-on-accent`,
				preview?.again.interval
			);
			this.renderRatingButton(
				mainButtonsEl,
				"Hard",
				Rating.Hard,
				`${baseBtnCls} ep:bg-obs-orange ep:text-obs-on-accent`,
				preview?.hard.interval
			);
			this.renderRatingButton(
				mainButtonsEl,
				"Good",
				Rating.Good,
				`${baseBtnCls} ep:bg-obs-green ep:text-obs-on-accent`,
				preview?.good.interval
			);
			this.renderRatingButton(
				mainButtonsEl,
				"Easy",
				Rating.Easy,
				`${baseBtnCls} ep:bg-obs-cyan ep:text-obs-on-accent`,
				preview?.easy.interval
			);
		}

		const menuBtn = buttonsWrapper.createEl("button", {
			cls: "ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:border-none ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:cursor-pointer ep:transition-colors ep:absolute ep:right-0 ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95",
			attr: { "aria-label": "Card actions" },
		});
		setIcon(menuBtn, "more-vertical");
		menuBtn.addEventListener("click", (e) => this.showActionsMenu(e));
	}

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
			item
				.setTitle("Move card (m)")
				.setIcon("folder-input")
				.onClick(() => this.cardActionsHandler.handleMoveCard())
		);

		menu.addItem((item) =>
			item
				.setTitle("Suspend card")
				.setIcon("pause")
				.onClick(() => this.cardActionsHandler.handleSuspend())
		);

		menu.addItem((item) =>
			item
				.setTitle("Bury card (-)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryCard())
		);

		menu.addItem((item) =>
			item
				.setTitle("Bury note (=)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryNote())
		);

		menu.addItem((item) =>
			item
				.setTitle("Edit card (e)")
				.setIcon("pencil")
				.onClick(
					() => void this.cardActionsHandler.handleEditCardModal()
				)
		);

		menu.addItem((item) =>
			item
				.setTitle("Add flashcard (a)")
				.setIcon("plus")
				.onClick(
					() => void this.cardActionsHandler.handleAddNewFlashcard()
				)
		);

		menu.addItem((item) =>
			item
				.setTitle("Open source note")
				.setIcon("external-link")
				.onClick(() => this.handleOpenSourceNote())
		);

		menu.showAtMouseEvent(event);
	}

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

	private handleProjectClick(_projectName: string): void {
		// No-op: ProjectsView was removed
	}

	private renderRatingButton(
		container: HTMLElement,
		label: string,
		rating: Grade,
		cls: string,
		interval?: string
	): void {
		const btn = container.createEl("button", { cls });

		btn.createDiv({ cls: "ep:font-semibold", text: label });

		if (interval && this.plugin.settings.showNextReviewTime) {
			btn.createDiv({
				cls: "ep:text-ui-smaller ep:opacity-90",
				text: interval,
			});
		}

		btn.addEventListener("click", () => void this.handleAnswer(rating));
	}

	private renderEmptyState(message: string): void {
		this.headerEl.empty();
		this.cardContainerEl.empty();
		this.buttonsEl.empty();

		const emptyEl = this.cardContainerEl.createDiv({
			cls: "ep:text-center ep:py-12 ep:px-6",
		});
		emptyEl.createDiv({ cls: "ep:text-5xl ep:mb-4", text: "🎉" });
		emptyEl.createDiv({
			cls: "ep:text-ui-medium ep:text-obs-muted ep:mb-6",
			text: message,
		});

		const closeBtn = emptyEl.createEl("button", {
			cls: "ep:flex ep:flex-col ep:items-center ep:gap-1 ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small mod-cta",
			text: "Close",
		});
		closeBtn.addEventListener("click", () => this.handleClose());
	}

	private renderSummary(): void {
		this.cardContainerEl.empty();
		this.buttonsEl.empty();

		const stats = this.review.getStats();

		const summaryEl = this.cardContainerEl.createDiv({
			cls: "ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto",
		});
		summaryEl.createEl("h2", {
			text: "Session complete!",
			cls: "ep:text-2xl ep:m-0 ep:mb-6 ep:text-obs-normal",
		});

		const statsEl = summaryEl.createDiv({
			cls: "ep:grid ep:grid-cols-2 ep:gap-3 ep:mb-6",
		});

		this.renderStatItem(
			statsEl,
			"Total reviewed",
			stats.reviewed.toString()
		);
		this.renderStatItem(
			statsEl,
			"Again",
			stats.again.toString(),
			"ep:text-obs-red"
		);
		this.renderStatItem(
			statsEl,
			"Hard",
			stats.hard.toString(),
			"ep:text-obs-orange"
		);
		this.renderStatItem(
			statsEl,
			"Good",
			stats.good.toString(),
			"ep:text-obs-green"
		);
		this.renderStatItem(
			statsEl,
			"Easy",
			stats.easy.toString(),
			"ep:text-obs-cyan"
		);

		const durationMin = Math.floor(stats.duration / 60000);
		const durationSec = Math.floor((stats.duration % 60000) / 1000);
		this.renderStatItem(
			statsEl,
			"Duration",
			`${durationMin}m ${durationSec}s`
		);

		const buttonsEl = summaryEl.createDiv({
			cls: "ep:flex ep:gap-3 ep:py-4ep:justify-center",
		});

		const summaryBtnCls =
			"ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

		if (
			this.isCustomSession &&
			this.plugin.settings.continuousCustomReviews
		) {
			const nextSessionBtn = buttonsEl.createEl("button", {
				cls: `${summaryBtnCls} mod-cta`,
				text: "Next session",
			});
			nextSessionBtn.addEventListener("click", () =>
				this.handleNextSession()
			);

			const finishBtn = buttonsEl.createEl("button", {
				cls: `${summaryBtnCls} ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`,
				text: "Finish",
			});
			finishBtn.addEventListener("click", () => this.handleClose());
		} else {
			const closeBtn = buttonsEl.createEl("button", {
				cls: `${summaryBtnCls} mod-cta`,
				text: "Close",
			});
			closeBtn.addEventListener("click", () => this.handleClose());
		}
	}

	private renderStatItem(
		container: HTMLElement,
		label: string,
		value: string,
		valueColorCls?: string
	): void {
		const itemEl = container.createDiv({
			cls: "ep:p-3 ep:bg-obs-secondary ep:rounded-lg",
		});
		itemEl.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mb-1",
			text: label,
		});
		itemEl.createDiv({
			cls: `ep:text-xl ep:font-semibold ep:text-obs-normal ${
				valueColorCls ?? ""
			}`,
			text: value,
		});
	}

	private renderWaitingScreen(): void {
		this.clearWaitingTimer();
		this.cardContainerEl.empty();
		this.buttonsEl.empty();

		const timeUntilDue = this.review.getTimeUntilNextDue();
		const pendingCards = this.review.getPendingLearningCards();

		// Anki-like behavior: show countdown while waiting for learning cards
		const waitingEl = this.cardContainerEl.createDiv({
			cls: "ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto",
		});
		waitingEl.createEl("h2", {
			text: "Congratulations!",
			cls: "ep:text-2xl ep:m-0 ep:mb-4 ep:text-obs-normal",
		});
		waitingEl.createEl("p", {
			text: "You've reviewed all available cards.",
			cls: "ep:text-obs-muted ep:m-0 ep:mb-6",
		});

		const countdownContainer = waitingEl.createDiv({ cls: "ep:mb-6" });
		countdownContainer.createEl("p", {
			text: `${pendingCards.length} learning card${
				pendingCards.length === 1 ? "" : "s"
			} due in:`,
			cls: "ep:text-obs-muted ep:text-ui-small ep:m-0 ep:mb-2",
		});
		const countdownEl = countdownContainer.createDiv({
			cls: "ep:text-5xl ep:font-bold ep:text-obs-interactive ep:tabular-nums",
			text: this.formatCountdown(timeUntilDue),
		});

		const waitingBtnCls =
			"ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";
		const buttonsContainerEl = waitingEl.createDiv({
			cls: "ep:flex ep:gap-3 ep:justify-center",
		});

		const waitBtn = buttonsContainerEl.createEl("button", {
			cls: `${waitingBtnCls} mod-cta`,
			text: "Wait",
		});
		waitBtn.addEventListener("click", () => {});

		const endBtn = buttonsContainerEl.createEl("button", {
			cls: `${waitingBtnCls} ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`,
			text: "End session",
		});
		endBtn.addEventListener("click", () => {
			this.clearWaitingTimer();
			this.review.endSession();
			this.renderSummary();
		});

		if (timeUntilDue > 0) {
			this.waitingTimerId = this.subs.setInterval(() => {
				const remaining = this.review.getTimeUntilNextDue();
				if (remaining <= 0) {
					this.clearWaitingTimer();
					this.render();
				} else {
					countdownEl.textContent = this.formatCountdown(remaining);
				}
			}, UI_CONFIG.timerInterval);
		}
	}

	private formatCountdown(ms: number): string {
		if (ms <= 0) return "0:00";
		const totalSeconds = Math.ceil(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

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
		const responseTime =
			Date.now() - this.review.questionShownTime;

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

		// Cramming mode: skip persistence, track card to avoid infinite requeue
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

		// Push undo entry immediately so it's available for instant undo
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
				console.error(
					"Error recording review to persistent storage:",
					error
				);
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
			// Only revert stats if the deferred write actually executed
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
