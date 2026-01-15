import { Plugin, TFile, Notice, Platform } from "obsidian";
import {
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_STATS,
	FLASHCARD_CONFIG,
} from "./constants";
import {
	FlashcardManager,
	OpenRouterService,
	FSRSService,
	StatsService,
	SessionPersistenceService,
	SqliteStoreService,
	DayBoundaryService,
	resetEventBus,
} from "./services";
import type { CardStore } from "./types";
import { extractFSRSSettings } from "./types";
import { FlashcardPanelView } from "./ui/panel/FlashcardPanelView";
import { ReviewView } from "./ui/review/ReviewView";
import { StatsView } from "./ui/stats/StatsView";
import {
	EpistemeSettingTab,
	type EpistemeSettings,
	DEFAULT_SETTINGS,
} from "./ui/settings";
import {
	CustomSessionModal,
	MissingFlashcardsModal,
	ReadyToHarvestModal,
	CommandDashboardModal,
} from "./ui/modals";
import { registerCommands } from "./plugin/PluginCommands";
import { registerEventHandlers } from "./plugin/PluginEventHandlers";

export default class EpistemePlugin extends Plugin {
	settings!: EpistemeSettings;
	flashcardManager!: FlashcardManager;
	openRouterService!: OpenRouterService;
	fsrsService!: FSRSService;
	statsService!: StatsService;
	sessionPersistence!: SessionPersistenceService;
	cardStore!: CardStore;
	dayBoundaryService!: DayBoundaryService;

	// Keep reference to SQLite store for SQLite-specific operations (stats queries)
	private sqliteStore: SqliteStoreService | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialize services
		this.flashcardManager = new FlashcardManager(this.app, this.settings);
		this.openRouterService = new OpenRouterService(
			this.settings.openRouterApiKey,
			this.settings.aiModel
		);

		// Initialize FSRS and Stats services
		const fsrsSettings = extractFSRSSettings(this.settings);
		this.fsrsService = new FSRSService(fsrsSettings);
		this.statsService = new StatsService(
			this.flashcardManager,
			this.fsrsService
		);

		// Initialize SQLite store for FSRS data (also initializes session persistence)
		void this.initializeCardStore();

		// Initialize day boundary service (Anki-style day scheduling)
		this.dayBoundaryService = new DayBoundaryService(
			this.settings.dayStartHour
		);

		// Register the sidebar view
		this.registerView(
			VIEW_TYPE_FLASHCARD_PANEL,
			(leaf) => new FlashcardPanelView(leaf, this)
		);

		// Register the review view
		this.registerView(
			VIEW_TYPE_REVIEW,
			(leaf) => new ReviewView(leaf, this)
		);

		// Register the statistics view
		this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

		// Add ribbon icon to start review
		this.addRibbonIcon("brain", "Episteme - Study", () => {
			void this.startReviewSession();
		});

		// Add ribbon icon to open statistics
		this.addRibbonIcon("bar-chart-2", "Episteme - Statistics", () => {
			void this.openStatsView();
		});

		// Add ribbon icon for command dashboard
		this.addRibbonIcon("blocks", "Episteme - Command Dashboard", () => {
			this.openCommandDashboard();
		});

		// Register commands (extracted to PluginCommands.ts)
		registerCommands(this);

		// Register settings tab
		this.addSettingTab(new EpistemeSettingTab(this.app, this));

		// Register event handlers (extracted to PluginEventHandlers.ts)
		registerEventHandlers(this);
	}

	onunload(): void {
		// Save card store immediately on unload
		if (this.cardStore) {
			void this.cardStore.saveNow();
		}

		// Clear EventBus subscriptions
		resetEventBus();

		// Obsidian automatically handles leaf cleanup when plugin unloads
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<EpistemeSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Update services with new settings
		if (this.flashcardManager) {
			this.flashcardManager.updateSettings(this.settings);
		}
		if (this.openRouterService) {
			this.openRouterService.updateCredentials(
				this.settings.openRouterApiKey,
				this.settings.aiModel
			);
		}
		if (this.fsrsService) {
			const fsrsSettings = extractFSRSSettings(this.settings);
			this.fsrsService.updateSettings(fsrsSettings);
		}
		if (this.dayBoundaryService) {
			this.dayBoundaryService.updateDayStartHour(this.settings.dayStartHour);
		}
	}

	// Activate the sidebar view
	async activateView(): Promise<void> {
		const { workspace } = this.app;

		// Check if view already exists
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL)[0];

		if (!leaf) {
			if (Platform.isMobile) {
				// On mobile, open in main area (no sidebar support)
				leaf = workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_FLASHCARD_PANEL,
					active: true,
				});
			} else {
				// Desktop: use right sidebar
				const rightLeaf = workspace.getRightLeaf(false);
				if (rightLeaf) {
					await rightLeaf.setViewState({
						type: VIEW_TYPE_FLASHCARD_PANEL,
						active: true,
					});
					leaf = rightLeaf;
				}
			}
		}

		// Reveal and focus the leaf
		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	// Start a review session (opens modal with options)
	async startReviewSession(): Promise<void> {
		const { workspace } = this.app;

		// Check for existing review view
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_REVIEW);
		if (existingLeaves.length > 0) {
			void workspace.revealLeaf(existingLeaves[0]!);
			return;
		}

		const allCards = await this.flashcardManager.getAllFSRSCards();
		if (allCards.length === 0) {
			new Notice("No flashcards found. Generate some flashcards first!");
			return;
		}

		const currentFile = this.app.workspace.getActiveFile();
		const currentNoteName =
			currentFile && !currentFile.name.startsWith(FLASHCARD_CONFIG.filePrefix)
				? currentFile.basename
				: null;

		const modal = new CustomSessionModal(this.app, {
			currentNoteName,
			allCards,
			dayBoundaryService: this.dayBoundaryService,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		// Handle "Default" option - open with Knowledge deck, no filters
		if (result.useDefaultDeck) {
			await this.openReviewView("Knowledge");
			return;
		}

		// Handle state filter (including buried cards)
		if (result.stateFilter) {
			await this.openReviewViewWithFilters({
				deckFilter: null,
				stateFilter: result.stateFilter,
				ignoreDailyLimits: result.ignoreDailyLimits,
				bypassScheduling: result.bypassScheduling,
			});
			return;
		}

		// Handle other options with filters
		await this.openReviewViewWithFilters({
			deckFilter: null,
			sourceNoteFilter: result.sourceNoteFilter,
			sourceNoteFilters: result.sourceNoteFilters,
			filePathFilter: result.filePathFilter,
			createdTodayOnly: result.createdTodayOnly,
			ignoreDailyLimits: result.ignoreDailyLimits,
			bypassScheduling: result.bypassScheduling,
		});
	}

	/**
	 * Open the review view with optional deck filter
	 */
	private async openReviewView(deckFilter: string | null): Promise<void> {
		const { workspace } = this.app;

		// Force fullscreen on mobile (no sidebar support)
		if (Platform.isMobile || this.settings.reviewMode === "fullscreen") {
			// Open in main area
			const leaf = workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_REVIEW,
				active: true,
				state: { deckFilter },
			});
			workspace.revealLeaf(leaf);
		} else {
			// Desktop: Open in right panel
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_REVIEW,
					active: true,
					state: { deckFilter },
				});
				workspace.revealLeaf(rightLeaf);
			}
		}
	}

	/**
	 * Open the statistics view
	 */
	async openStatsView(): Promise<void> {
		const { workspace } = this.app;

		// Check if stats view already exists
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_STATS);
		if (existingLeaves.length > 0) {
			// Focus existing stats view
			const leaf = existingLeaves[0];
			if (leaf) {
				workspace.revealLeaf(leaf);
				// Refresh the view
				const view = leaf.view;
				if (view instanceof StatsView) {
					void view.refresh();
				}
			}
			return;
		}

		// Open in main area
		const leaf = workspace.getLeaf(true);
		await leaf.setViewState({
			type: VIEW_TYPE_STATS,
			active: true,
		});
		workspace.revealLeaf(leaf);
	}

	/**
	 * Show modal with notes missing flashcards
	 */
	async showMissingFlashcards(): Promise<void> {
		const modal = new MissingFlashcardsModal(
			this.app,
			this.flashcardManager,
			{
				flashcardsFolder: this.settings.flashcardsFolder,
				excludedFolders: this.settings.excludedFolders,
			}
		);

		const result = await modal.openAndWait();
		if (result.cancelled || !result.selectedNotePath) return;

		// Open the selected note
		const file = this.app.vault.getAbstractFileByPath(result.selectedNotePath);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
			// Activate panel to allow flashcard generation
			await this.activateView();
		}
	}

	/**
	 * Show modal with notes ready to harvest
	 * (all flashcards reviewed, no State.New cards)
	 */
	async showReadyToHarvest(): Promise<void> {
		const modal = new ReadyToHarvestModal(
			this.app,
			this.flashcardManager,
			this.flashcardManager.getFrontmatterService(),
			{
				flashcardsFolder: this.settings.flashcardsFolder,
				excludedFolders: this.settings.excludedFolders,
			}
		);
		modal.open();
	}

	/**
	 * Review flashcards from current note
	 */
	async reviewCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active note");
			return;
		}
		await this.reviewNoteFlashcards(file);
	}

	/**
	 * Review flashcards linked to a specific note
	 */
	async reviewNoteFlashcards(file: TFile): Promise<void> {
		// Skip if it's a flashcard file
		if (file.name.startsWith(FLASHCARD_CONFIG.filePrefix)) {
			new Notice(
				"This is a flashcard file. Select the original source note instead."
			);
			return;
		}

		const allCards = await this.flashcardManager.getAllFSRSCards();
		const noteCards = allCards.filter(
			(c) => c.sourceNoteName === file.basename
		);

		if (noteCards.length === 0) {
			new Notice(`No flashcards found for "${file.basename}"`);
			return;
		}

		// Count available cards (new or due) using day-based scheduling
		const availableCards = noteCards.filter((c) => {
			return this.dayBoundaryService.isCardAvailable(c);
		});

		if (availableCards.length === 0) {
			new Notice(
				`No cards due for "${file.basename}". All ${noteCards.length} cards are scheduled for later.`
			);
			return;
		}

		await this.openReviewViewWithFilters({
			deckFilter: null,
			sourceNoteFilter: file.basename,
			ignoreDailyLimits: true,
		});
	}

	/**
	 * Review today's new cards
	 */
	async reviewTodaysCards(): Promise<void> {
		const allCards = await this.flashcardManager.getAllFSRSCards();

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const todaysCards = allCards.filter((c) => {
			const createdAt = c.fsrs.createdAt;
			if (!createdAt || createdAt < todayStart.getTime()) return false;
			// Only show new or due (using day-based scheduling)
			return this.dayBoundaryService.isCardAvailable(c);
		});

		if (todaysCards.length === 0) {
			new Notice("No new cards created today");
			return;
		}

		await this.openReviewViewWithFilters({
			deckFilter: null,
			createdTodayOnly: true,
			ignoreDailyLimits: true,
		});
	}

	/**
	 * Open the command dashboard modal
	 */
	openCommandDashboard(): void {
		const modal = new CommandDashboardModal(this.app, this);
		modal.openAndWait();
	}

	/**
	 * Open review view with custom filters
	 */
	private async openReviewViewWithFilters(filters: {
		deckFilter?: string | null;
		sourceNoteFilter?: string;
		sourceNoteFilters?: string[];
		filePathFilter?: string;
		createdTodayOnly?: boolean;
		createdThisWeek?: boolean;
		weakCardsOnly?: boolean;
		stateFilter?: "due" | "learning" | "new" | "buried";
		ignoreDailyLimits?: boolean;
		bypassScheduling?: boolean;
	}): Promise<void> {
		const { workspace } = this.app;

		const state = {
			deckFilter: filters.deckFilter ?? null,
			sourceNoteFilter: filters.sourceNoteFilter,
			sourceNoteFilters: filters.sourceNoteFilters,
			filePathFilter: filters.filePathFilter,
			createdTodayOnly: filters.createdTodayOnly,
			createdThisWeek: filters.createdThisWeek,
			weakCardsOnly: filters.weakCardsOnly,
			stateFilter: filters.stateFilter,
			ignoreDailyLimits: filters.ignoreDailyLimits,
			bypassScheduling: filters.bypassScheduling,
		};

		if (Platform.isMobile || this.settings.reviewMode === "fullscreen") {
			const leaf = workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_REVIEW,
				active: true,
				state,
			});
			void workspace.revealLeaf(leaf);
		} else {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_REVIEW,
					active: true,
					state,
				});
				void workspace.revealLeaf(rightLeaf);
			}
		}
	}

	/**
	 * Initialize the SQLite card store and session persistence
	 */
	private async initializeCardStore(): Promise<void> {
		try {
			// Create and load SQLite store
			this.sqliteStore = new SqliteStoreService(this.app);
			await this.sqliteStore.load();

			// Use SQLite store
			this.cardStore = this.sqliteStore;
			this.flashcardManager.setStore(this.cardStore);

			// Initialize session persistence with SQL store
			this.sessionPersistence = new SessionPersistenceService(this.app, this.sqliteStore);

			// Migrate stats.json to SQL if exists (one-time migration)
			await this.sessionPersistence.migrateStatsJsonToSql();
		} catch (error) {
			console.error("[Episteme] Failed to initialize SQLite store:", error);
			new Notice("Failed to load flashcard data. Please restart Obsidian.");
		}
	}
}
