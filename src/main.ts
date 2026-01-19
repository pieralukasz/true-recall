import { Plugin, TFile, Notice } from "obsidian";
import {
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_STATS,
	VIEW_TYPE_SESSION,
	VIEW_TYPE_MISSING_FLASHCARDS,
	VIEW_TYPE_READY_TO_HARVEST,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_ORPHANED_CARDS,
	VIEW_TYPE_PROJECTS,
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
	getEventBus,
} from "./services";
import { NLQueryService } from "./services/ai/nl-query.service";
import { SqlJsAdapter } from "./services/ai/langchain-sqlite.adapter";
import type { CardStore, FSRSCardData, SourceNoteInfo } from "./types";
import { extractFSRSSettings } from "./types";
import { FlashcardPanelView } from "./ui/panel/FlashcardPanelView";
import { ReviewView } from "./ui/review/ReviewView";
import { StatsView } from "./ui/stats/StatsView";
import { SessionView } from "./ui/session";
import { MissingFlashcardsView } from "./ui/missing-flashcards";
import { ReadyToHarvestView } from "./ui/ready-to-harvest";
import { DashboardView } from "./ui/dashboard";
import { OrphanedCardsView } from "./ui/orphaned-cards";
import { ProjectsView } from "./ui/projects";
import {
	EpistemeSettingTab,
	type EpistemeSettings,
	DEFAULT_SETTINGS,
} from "./ui/settings";
import { SessionModal } from "./ui/modals";
import { registerCommands } from "./plugin/PluginCommands";
import { registerEventHandlers } from "./plugin/PluginEventHandlers";
import {
	activateView,
	activateReviewView,
	viewExists,
	getView,
	closeAllViews,
} from "./plugin/ViewActivator";

export default class EpistemePlugin extends Plugin {
	settings!: EpistemeSettings;
	flashcardManager!: FlashcardManager;
	openRouterService!: OpenRouterService;
	fsrsService!: FSRSService;
	statsService!: StatsService;
	sessionPersistence!: SessionPersistenceService;
	cardStore!: CardStore;
	dayBoundaryService!: DayBoundaryService;
	nlQueryService: NLQueryService | null = null;

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

		// Register the session view
		this.registerView(
			VIEW_TYPE_SESSION,
			(leaf) => new SessionView(leaf, this)
		);

		// Register the missing flashcards view
		this.registerView(
			VIEW_TYPE_MISSING_FLASHCARDS,
			(leaf) => new MissingFlashcardsView(leaf, this)
		);

		// Register the ready to harvest view
		this.registerView(
			VIEW_TYPE_READY_TO_HARVEST,
			(leaf) => new ReadyToHarvestView(leaf, this)
		);

		// Register the dashboard view
		this.registerView(
			VIEW_TYPE_DASHBOARD,
			(leaf) => new DashboardView(leaf, this)
		);

		// Register the orphaned cards view
		this.registerView(
			VIEW_TYPE_ORPHANED_CARDS,
			(leaf) => new OrphanedCardsView(leaf, this)
		);

		// Register the projects view
		this.registerView(
			VIEW_TYPE_PROJECTS,
			(leaf) => new ProjectsView(leaf, this)
		);

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
		// Reinitialize NL Query Service with new settings (API key or model may have changed)
		void this.initializeNLQueryService();
	}

	// Activate the sidebar view
	async activateView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_FLASHCARD_PANEL);
	}

	/**
	 * Activate the session view
	 */
	async activateSessionView(
		currentNoteName: string | null,
		allCards: import("./types").FSRSFlashcardItem[]
	): Promise<void> {
		const leaf = await activateView(this.app, VIEW_TYPE_SESSION);

		// Initialize view with data
		if (leaf) {
			const view = leaf.view as SessionView;
			view.initialize({
				currentNoteName,
				allCards,
				dayBoundaryService: this.dayBoundaryService,
			});
		}
	}

	/**
	 * Activate the missing flashcards view
	 */
	async activateMissingFlashcardsView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_MISSING_FLASHCARDS);
	}

	/**
	 * Activate the ready to harvest view
	 */
	async activateReadyToHarvestView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_READY_TO_HARVEST);
	}

	/**
	 * Activate the dashboard view
	 */
	async activateDashboardView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_DASHBOARD);
	}

	/**
	 * Activate the orphaned cards view
	 */
	async activateOrphanedCardsView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_ORPHANED_CARDS);
	}

	/**
	 * Show orphaned cards panel
	 */
	async showOrphanedCards(): Promise<void> {
		await this.activateOrphanedCardsView();
	}

	/**
	 * Activate the projects view
	 */
	async activateProjectsView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_PROJECTS);
	}

	/**
	 * Show projects panel
	 */
	async showProjects(): Promise<void> {
		await this.activateProjectsView();
	}

	// Start a review session (opens modal with options)
	async startReviewSession(): Promise<void> {
		// Check for existing review view
		const existingLeaf = getView(this.app, VIEW_TYPE_REVIEW);
		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		await this.openNewReviewSession();
	}

	/**
	 * Start a new review session, closing any existing review views first.
	 * Used by "Next Session" button to avoid race conditions.
	 */
	async startNewReviewSession(): Promise<void> {
		// Force close all existing review views first
		closeAllViews(this.app, VIEW_TYPE_REVIEW);

		// Wait for next event loop tick to ensure leaves are fully detached
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Now open new session (existing leaves already closed)
		await this.openNewReviewSession();
	}

	/**
	 * Internal method to open review session modal/panel
	 * Called after checking/closing existing views
	 */
	private async openNewReviewSession(): Promise<void> {

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

		// Check which interface to use based on settings
		if (this.settings.customSessionInterface === "panel") {
			// Panel mode: Subscribe to event, open panel, wait for result
			return new Promise<void>((resolve) => {
				const eventBus = getEventBus();
				const unsubscribe = eventBus.on("session:selected", (event: any) => {
					unsubscribe();
					void this.handleSessionResult(event.result);
					resolve();
				});

				void this.activateSessionView(currentNoteName, allCards);
			});
		} else {
			// Modal mode: Use existing modal code
			const modal = new SessionModal(this.app, {
				currentNoteName,
				allCards,
				dayBoundaryService: this.dayBoundaryService,
			});

			const result = await modal.openAndWait();
			if (result.cancelled) return;

			await this.handleSessionResult(result);
		}
	}

	/**
	 * Handle session result (shared by modal and panel)
	 */
	private async handleSessionResult(
		result: import("./types/events.types").SessionResult
	): Promise<void> {
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
		await activateReviewView(
			this.app,
			VIEW_TYPE_REVIEW,
			this.settings.reviewMode,
			{ deckFilter }
		);
	}

	/**
	 * Open the statistics view
	 */
	async openStatsView(): Promise<void> {
		// Check if stats view already exists
		const existingLeaf = getView(this.app, VIEW_TYPE_STATS);
		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
			// Refresh the view
			const view = existingLeaf.view;
			if (view instanceof StatsView) {
				void view.refresh();
			}
			return;
		}

		// Open stats in main area (not sidebar)
		await activateView(this.app, VIEW_TYPE_STATS, { useMainArea: true });
	}

	/**
	 * Show modal with notes missing flashcards
	 */
	async showMissingFlashcards(): Promise<void> {
		return new Promise<void>((resolve) => {
			const eventBus = getEventBus();
			const unsubscribe = eventBus.on("missing-flashcards:selected", (event: any) => {
				unsubscribe();

				if (!event.result.cancelled && event.result.selectedNotePath) {
					// Open the selected note
					const file = this.app.vault.getAbstractFileByPath(event.result.selectedNotePath);
					if (file instanceof TFile) {
						const leaf = this.app.workspace.getLeaf(false);
						void leaf.openFile(file).then(() => this.activateView());
					}
				}

				resolve();
			});

			void this.activateMissingFlashcardsView();
		});
	}

	/**
	 * Show modal with notes ready to harvest
	 * (all flashcards reviewed, no State.New cards)
	 */
	async showReadyToHarvest(): Promise<void> {
		await this.activateReadyToHarvestView();
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
		void this.activateDashboardView();
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

		await activateReviewView(
			this.app,
			VIEW_TYPE_REVIEW,
			this.settings.reviewMode,
			state
		);
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

			// Initialize NL Query Service (AI-powered stats queries)
			await this.initializeNLQueryService();
		} catch (error) {
			console.error("[Episteme] Failed to initialize SQLite store:", error);
			new Notice("Failed to load flashcard data. Please restart Obsidian.");
		}
	}

	/**
	 * Initialize the NL Query Service for AI-powered statistics queries
	 */
	private async initializeNLQueryService(): Promise<void> {
		if (!this.sqliteStore || !this.settings.openRouterApiKey) {
			// Service requires API key and database
			return;
		}

		try {
			const db = this.sqliteStore.getDatabase();
			if (!db) {
				console.warn("[Episteme] Database not ready for NL Query Service");
				return;
			}

			const sqlAdapter = new SqlJsAdapter(db);
			this.nlQueryService = new NLQueryService(
				{
					apiKey: this.settings.openRouterApiKey,
					model: this.settings.aiModel,
				},
				sqlAdapter
			);

			await this.nlQueryService.initialize();
		} catch (error) {
			console.warn("[Episteme] Failed to initialize NL Query Service:", error);
			// Non-critical: plugin continues without NL Query feature
		}
	}

	/**
	 * Sync source notes in database with vault files
	 * Useful after renaming notes when the handler didn't trigger
	 * Also detects orphaned source notes (deleted files)
	 */
	async syncSourceNotes(): Promise<void> {
		const sqlStore = this.cardStore as CardStore & {
			getAllSourceNotes?: () => SourceNoteInfo[];
			updateSourceNotePath?: (uid: string, newPath: string, newName?: string) => void;
			deleteSourceNote?: (uid: string, detachCards?: boolean) => void;
			getCardsBySourceUid?: (uid: string) => FSRSCardData[];
		};

		if (!sqlStore.getAllSourceNotes || !sqlStore.updateSourceNotePath) {
			new Notice("Source note sync not available");
			return;
		}

		const sourceNotes = sqlStore.getAllSourceNotes();
		const frontmatterService = this.flashcardManager.getFrontmatterService();
		const files = this.app.vault.getMarkdownFiles();

		// Build a map of UID -> file for efficient lookup
		const uidToFile = new Map<string, TFile>();
		for (const file of files) {
			const uid = await frontmatterService.getSourceNoteUid(file);
			if (uid) {
				uidToFile.set(uid, file);
			}
		}

		let synced = 0;
		let orphaned = 0;
		const orphanedUids: string[] = [];

		for (const sourceNote of sourceNotes) {
			const file = uidToFile.get(sourceNote.uid);
			if (file) {
				// Check if path/name needs updating
				if (file.path !== sourceNote.notePath || file.basename !== sourceNote.noteName) {
					sqlStore.updateSourceNotePath(sourceNote.uid, file.path, file.basename);
					synced++;
				}
			} else {
				// Source note exists in DB but no matching file in vault
				orphaned++;
				orphanedUids.push(sourceNote.uid);
			}
		}

		// Clean up orphaned source notes
		if (orphaned > 0 && sqlStore.deleteSourceNote) {
			let orphanedCards = 0;
			for (const uid of orphanedUids) {
				const cards = sqlStore.getCardsBySourceUid?.(uid) ?? [];
				orphanedCards += cards.length;
				// Delete source note but keep flashcards (detachCards = false)
				sqlStore.deleteSourceNote(uid, false);
			}
			new Notice(
				`Synced ${synced} source note(s). Removed ${orphaned} orphaned entries` +
				(orphanedCards > 0 ? ` (${orphanedCards} cards detached)` : "") +
				"."
			);
		} else {
			new Notice(`Synced ${synced} source note(s)`);
		}
	}
}
