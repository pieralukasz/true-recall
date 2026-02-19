import { effect } from "@preact/signals";
import {
	ItemView,
	type Menu,
	Platform,
	TFile,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";
import { VIEW_TYPE_FLASHCARD_PANEL } from "../../constants";
import type TrueRecallPlugin from "../../main";
import { type FlashcardManager, notify } from "../../services";
import {
	dataVersion,
	settingsVersion,
	track,
} from "../../services/core/signals";
import { CollectService } from "../../services/flashcard/collect.service";
import type { PanelApi } from "../../state/store";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { mountPreact } from "../preact/mount";
import { countCardsByState } from "../shared/helpers";
import { FlashcardPanelApp, type PanelAppActions } from "./FlashcardPanelApp";

export class FlashcardPanelView extends ItemView {
	private plugin: TrueRecallPlugin;
	private flashcardManager: FlashcardManager;
	private collectService: CollectService;

	// Preact cleanup
	private unmountPreact: (() => void) | null = null;

	// Review state subscription (for tracking current review card)
	private reviewUnsubscribe: (() => void) | null = null;
	private lastReviewCardPath: string | null = null;
	private lastReviewActive: boolean = false;

	// Signal effect disposer for data change tracking
	private signalDisposer: (() => void) | null = null;

	// Editor change timer for real-time #flashcard tag detection
	private editorChangeTimer: ReturnType<typeof setTimeout> | null = null;

	// Flashcard info reload timer
	private flashcardInfoTimer: ReturnType<typeof setTimeout> | null = null;

	// Header actions (Obsidian native view actions)
	private reviewAction: HTMLElement | null = null;
	private openFileAction: HTMLElement | null = null;
	private deleteAllAction: HTMLElement | null = null;

	// Store subscription for header actions
	private headerActionsUnsub: (() => void) | null = null;

	// Mobile header FSRS status element
	private mobileStatusEl: HTMLElement | null = null;

	// Header stats update timer for debouncing
	private headerStatsTimer: ReturnType<typeof setTimeout> | null = null;

	// Cache for getCardsWithFsrs() on mobile
	private cachedCardsWithFsrs: FSRSFlashcardItem[] | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.flashcardManager = plugin.flashcardManager;
		this.collectService = new CollectService();
	}

	private get panel(): PanelApi {
		return this.plugin.store?.getState().panel;
	}

	getViewType(): string {
		return VIEW_TYPE_FLASHCARD_PANEL;
	}

	getDisplayText(): string {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- Application name
		return "True Recall";
	}

	getIcon(): string {
		return "layers";
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);

		if (!Platform.isMobile) return;

		const state = this.panel;
		if (!state.currentFile) return;

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

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		// Mount Preact app
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(FlashcardPanelApp, {
				onActions: (action: PanelAppActions) => {
					if (action.type === "refresh") {
						void this.loadFlashcardInfo();
					}
				},
			}),
		);

		// Subscribe to store for Obsidian native header actions
		this.headerActionsUnsub = this.plugin.store?.subscribe(
			(s) => ({ status: s.panel.status, file: s.panel.currentFile }),
			() => this.updateHeaderActions(),
		);

		this.subscribeToDataChanges();
		this.subscribeToReviewState();
		this.registerEditorChangeTracking();

		if (Platform.isMobile) {
			this.setupMobileHeaderStatus();
		}

		// If a review session is already active, sync with it instead of loading the active file
		const reviewState = this.plugin.store?.getState()?.review;
		if (reviewState?.isActive) {
			const currentCard = reviewState.getCurrentCard();
			const currentPath = currentCard?.sourceNotePath ?? null;
			this.lastReviewCardPath = currentPath;
			this.lastReviewActive = true;
			void this.syncWithReviewCard(currentPath, true);
		} else {
			await this.loadCurrentFile();
		}
	}

	private updateHeaderActions(): void {
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

		if (state.status === "exists" && state.currentFile) {
			if (!Platform.isMobile) {
				this.deleteAllAction = this.addAction(
					"trash-2",
					"Delete all flashcards",
					() => void this.handleDeleteAllFlashcards(),
				);

				this.openFileAction = this.addAction(
					"file-text",
					"Open flashcard file",
					() => void this.handleOpenFlashcardFile(),
				);
			}

			this.reviewAction = this.addAction(
				"brain",
				"Review flashcards",
				() => void this.plugin.reviewNoteFlashcards(state.currentFile!),
			);
		}
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
		this.unmountPreact = null;

		this.reviewUnsubscribe?.();
		this.signalDisposer?.();
		this.headerActionsUnsub?.();

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
	}

	private subscribeToDataChanges(): void {
		this.signalDisposer = effect(() => {
			track(dataVersion, settingsVersion);
			this.invalidateCardsCache();
			this.scheduleHeaderStatsUpdate();
			this.scheduleFlashcardInfoReload();
		});
	}

	private scheduleFlashcardInfoReload(): void {
		if (this.flashcardInfoTimer) clearTimeout(this.flashcardInfoTimer);
		this.flashcardInfoTimer = setTimeout(() => {
			this.flashcardInfoTimer = null;
			void this.loadFlashcardInfo();
		}, 100);
	}

	private subscribeToReviewState(): void {
		const store = this.plugin.store;
		if (!store) return;

		this.reviewUnsubscribe = store.subscribe(
			(state) => state.review,
			() => {
				const review = store.getState().review;
				const currentCard = review.getCurrentCard();
				const currentPath = currentCard?.sourceNotePath ?? null;
				const isActive = review.isActive;

				if (
					currentPath !== this.lastReviewCardPath ||
					isActive !== this.lastReviewActive
				) {
					this.lastReviewCardPath = currentPath;
					this.lastReviewActive = isActive;
					void this.syncWithReviewCard(currentPath, isActive);
				}
			},
		);
	}

	private async syncWithReviewCard(
		sourceNotePath: string | null,
		isActive: boolean,
	): Promise<void> {
		this.panel.setReviewFollowState(sourceNotePath, isActive);

		if (!isActive || !sourceNotePath) {
			const activeFile = this.app.workspace.getActiveFile();
			await this.handleFileChange(activeFile);
			return;
		}

		const sourceFile = this.app.vault.getAbstractFileByPath(sourceNotePath);
		if (sourceFile instanceof TFile) {
			await this.handleFileChange(sourceFile);
		}
	}

	async handleFileChange(file: TFile | null): Promise<void> {
		const state = this.panel;

		if (state.currentFile?.path === file?.path) {
			return;
		}

		this.panel.setCurrentFile(file);
		await this.loadFlashcardInfo();
	}

	isFollowingReview(): boolean {
		return this.panel.isFollowingReview;
	}

	clearReviewFollowState(): void {
		this.panel.setReviewFollowState(null, false);
	}

	syncWithReviewState(sourceNotePath: string | null, isActive: boolean): void {
		this.lastReviewCardPath = sourceNotePath;
		this.lastReviewActive = isActive;
		void this.syncWithReviewCard(sourceNotePath, isActive);
	}

	private async loadCurrentFile(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		this.panel.setCurrentFile(file);
		await this.loadFlashcardInfo();
	}

	private async loadFlashcardInfo(): Promise<void> {
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

		const renderVersion = this.panel.incrementRenderVersion();

		try {
			const [info, content] = await Promise.all([
				this.flashcardManager.getFlashcardInfo(file),
				this.app.vault.read(file),
			]);

			if (!this.panel.isCurrentRender(renderVersion)) return;

			const uncollectedCount = this.collectService.countFlashcardTags(content);

			this.invalidateCardsCache();

			this.panel.setState({
				flashcardInfo: info,
				status: info?.exists ? "exists" : "none",
				sourceNoteName: null,
				uncollectedCount,
			});
		} catch (error) {
			console.error("Error loading flashcard info:", error);
		}
	}

	// ── Mobile-only methods ─────────────────────────────────

	private scheduleHeaderStatsUpdate(): void {
		if (!Platform.isMobile) return;
		if (this.headerStatsTimer) {
			clearTimeout(this.headerStatsTimer);
		}
		this.headerStatsTimer = setTimeout(() => {
			this.updateMobileHeaderStatus();
			this.headerStatsTimer = null;
		}, 100);
	}

	private getCardsWithFsrs(): FSRSFlashcardItem[] {
		if (this.cachedCardsWithFsrs !== null) {
			return this.cachedCardsWithFsrs;
		}

		const state = this.panel;
		if (!state.flashcardInfo?.flashcards) return [];

		if (!this.flashcardManager.hasStore()) {
			return [];
		}

		const cardIds = state.flashcardInfo.flashcards.map((c) => c.id);
		this.cachedCardsWithFsrs = this.flashcardManager.getCardsByIds(cardIds);
		return this.cachedCardsWithFsrs;
	}

	private invalidateCardsCache(): void {
		this.cachedCardsWithFsrs = null;
	}

	private setupMobileHeaderStatus(): void {
		const titleContainer = this.containerEl.querySelector(
			".view-header-title-container",
		);
		if (!titleContainer) return;

		const titleEl = titleContainer.querySelector(
			".view-header-title",
		) as HTMLElement;
		if (titleEl) {
			titleEl.addClass("ep:hidden");
		}

		this.mobileStatusEl = document.createElement("div");
		this.mobileStatusEl.addClass(
			"ep:flex",
			"ep:gap-1",
			"ep:items-center",
			"ep:text-ui-smaller",
		);
		titleContainer.appendChild(this.mobileStatusEl);
	}

	private updateMobileHeaderStatus(
		precomputedCards?: FSRSFlashcardItem[],
	): void {
		if (!this.mobileStatusEl) return;

		const cards = precomputedCards ?? this.getCardsWithFsrs();
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

	private async handleOpenFlashcardFile(): Promise<void> {
		const state = this.panel;
		if (state.currentFile) {
			await this.flashcardManager.openSourceNote(state.currentFile);
		}
	}

	private async handleDeleteAllFlashcards(): Promise<void> {
		const state = this.panel;
		if (!state.flashcardInfo || state.flashcardInfo.flashcards.length === 0)
			return;

		const count = state.flashcardInfo.flashcards.length;
		// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
		const confirmed = window.confirm(
			`Delete all ${count} flashcard(s) for this note?`,
		);
		if (!confirmed) return;

		const cardIds = state.flashcardInfo.flashcards.map((card) => card.id);
		const successCount = this.flashcardManager.removeFlashcardsByIds(cardIds);
		notify().cardsDeleted(successCount);
	}

	private async handleCopyAllToClipboard(): Promise<void> {
		const state = this.panel;
		if (
			!state.flashcardInfo?.flashcards ||
			state.flashcardInfo.flashcards.length === 0
		) {
			notify().warning("No flashcards to copy");
			return;
		}

		const text = state.flashcardInfo.flashcards
			.map((card, i) => `${i + 1}. Q: ${card.question}\n   A: ${card.answer}`)
			.join("\n\n");

		await navigator.clipboard.writeText(text);
		notify().success(
			`Copied ${state.flashcardInfo.flashcards.length} flashcard(s) to clipboard`,
		);
	}

	private async handleExportCsv(): Promise<void> {
		const state = this.panel;
		if (
			!state.flashcardInfo?.flashcards ||
			state.flashcardInfo.flashcards.length === 0
		) {
			notify().warning("No flashcards to export");
			return;
		}

		const escapeCSV = (str: string): string => {
			if (str.includes(",") || str.includes("\n") || str.includes('"')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		};

		const header = "Question,Answer";
		const rows = state.flashcardInfo.flashcards.map(
			(card) => `${escapeCSV(card.question)},${escapeCSV(card.answer)}`,
		);
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

		notify().success(
			`Exported ${state.flashcardInfo.flashcards.length} flashcard(s) to CSV`,
		);
	}

	private registerEditorChangeTracking(): void {
		this.registerEvent(
			this.app.workspace.on("editor-change", () => {
				if (this.editorChangeTimer) {
					clearTimeout(this.editorChangeTimer);
				}

				this.editorChangeTimer = setTimeout(() => {
					void this.checkUncollectedFlashcards();
				}, 500);
			}),
		);
	}

	private async checkUncollectedFlashcards(): Promise<void> {
		const state = this.panel;
		const file = state.currentFile;

		if (!file || file.extension !== "md") {
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			const uncollectedCount = this.collectService.countFlashcardTags(content);

			if (state.uncollectedCount !== uncollectedCount) {
				this.panel.setUncollectedInfo(uncollectedCount);
			}
		} catch {
			// Ignore errors (file might be deleted/moved)
		}
	}
}
