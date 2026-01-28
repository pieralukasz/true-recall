import { Plugin, TFile, Notice } from "obsidian";
import {
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_STATS,
	VIEW_TYPE_SESSION,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_PROJECTS,
	VIEW_TYPE_BROWSER,
	VIEW_TYPE_SIMULATOR,
} from "./constants";
import { normalizePath } from "obsidian";
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
	BackupService,
	DeviceIdService,
	DeviceDiscoveryService,
	AuthService,
	SyncService,
	FrontmatterIndexService,
} from "./services";
import {
	DB_FOLDER,
	getDeviceDbFilename,
} from "./services/persistence/sqlite/sqlite.types";
import { NLQueryService } from "./services/ai/nl-query.service";
import { SqlJsAdapter } from "./services/ai/langchain-sqlite.adapter";
import type { FSRSCardData } from "./types";
import { extractFSRSSettings } from "./types";
import { FlashcardPanelView } from "./ui/flashcard-panel/FlashcardPanelView";
import { ReviewView } from "./ui/review/ReviewView";
import { StatsView } from "./ui/stats/StatsView";
import { SessionView } from "./ui/session";
import { DashboardView } from "./ui/dashboard";
import { ProjectsView } from "./ui/projects";
import { BrowserView } from "./ui/browser";
import { SimulatorView } from "./ui/simulator";
import { FloatingGenerateButton } from "./ui/components/FloatingGenerateButton";
import {
	TrueRecallSettingTab,
	type TrueRecallSettings,
	DEFAULT_SETTINGS,
} from "./ui/settings";
import {
	AddToProjectModal,
	RestoreBackupModal,
	DeviceSelectionModal,
	type DeviceSelectionResult,
} from "./ui/modals";
import { registerCommands } from "./plugin/PluginCommands";
import { registerEventHandlers } from "./plugin/PluginEventHandlers";
import { AgentService, registerAllTools, resetToolRegistry } from "./agent";
import {
	activateView,
	activateReviewView,
	viewExists,
	getView,
	closeAllViews,
} from "./plugin/ViewActivator";

export default class TrueRecallPlugin extends Plugin {
	settings!: TrueRecallSettings;
	flashcardManager!: FlashcardManager;
	openRouterService!: OpenRouterService;
	fsrsService!: FSRSService;
	statsService!: StatsService;
	sessionPersistence!: SessionPersistenceService;
	cardStore!: SqliteStoreService;
	dayBoundaryService!: DayBoundaryService;
	frontmatterIndex!: FrontmatterIndexService;
	nlQueryService: NLQueryService | null = null;
	backupService: BackupService | null = null;
	agentService: AgentService | null = null;
	deviceIdService: DeviceIdService | null = null;
	deviceDiscovery: DeviceDiscoveryService | null = null;
	authService: AuthService | null = null;
	syncService: SyncService | null = null;
	floatingButton: FloatingGenerateButton | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialize frontmatter index for O(1) lookups by flashcard_uid, projects, etc.
		this.frontmatterIndex = new FrontmatterIndexService(this.app);
		this.frontmatterIndex.register({ field: "flashcard_uid", type: "string", unique: true });
		this.frontmatterIndex.register({ field: "projects", type: "array", unique: false });
		this.frontmatterIndex.registerEvents(this);

		// Build index after metadataCache is fully loaded
		this.app.workspace.onLayoutReady(() => {
			this.frontmatterIndex.rebuildIndex();
		});

		// Initialize services
		this.flashcardManager = new FlashcardManager(this.app, this.settings, this.frontmatterIndex);
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

		// Initialize device context and SQLite store
		void this.initializeDeviceAndStore();

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

		// Register the dashboard view
		this.registerView(
			VIEW_TYPE_DASHBOARD,
			(leaf) => new DashboardView(leaf, this)
		);

		// Register the projects view
		this.registerView(
			VIEW_TYPE_PROJECTS,
			(leaf) => new ProjectsView(leaf, this)
		);

		// Register the browser view
		this.registerView(
			VIEW_TYPE_BROWSER,
			(leaf) => new BrowserView(leaf, this)
		);

		// Register the FSRS simulator view
		this.registerView(
			VIEW_TYPE_SIMULATOR,
			(leaf) => new SimulatorView(leaf, this)
		);

		// Add ribbon icon to start review
		this.addRibbonIcon("brain", "True Recall - Study", () => {
			void this.startReviewSession();
		});

		// Add ribbon icon to open statistics
		this.addRibbonIcon("bar-chart-2", "True Recall - Statistics", () => {
			void this.openStatsView();
		});

		// Add ribbon icon for command dashboard
		this.addRibbonIcon("blocks", "True Recall - Command Dashboard", () => {
			this.openCommandDashboard();
		});

		// Initialize floating generate button
		this.floatingButton = new FloatingGenerateButton(this);
		this.floatingButton.initialize();

		// Register commands (extracted to PluginCommands.ts)
		registerCommands(this);

		// Register settings tab
		this.addSettingTab(new TrueRecallSettingTab(this.app, this));

		// Register event handlers (extracted to PluginEventHandlers.ts)
		registerEventHandlers(this);

		// Register agent tools and initialize AgentService
		registerAllTools();
		this.agentService = new AgentService(this);

		// Initialize AuthService (SaaS model - always available)
		this.authService = new AuthService();

		// Initialize SyncService (requires authService and cardStore)
		// Note: cardStore may not be ready yet, sync will check availability
		this.initializeSyncService();
	}

	/**
	 * Initialize or reinitialize SyncService when auth/store are ready
	 */
	private initializeSyncService(): void {
		if (this.authService && this.cardStore) {
			this.syncService = new SyncService(
				this.authService,
				this.cardStore
			);
		}
	}

	onunload(): void {
		// Cleanup floating button
		this.floatingButton?.destroy();

		// Save card store immediately on unload (critical with 60s debounce)
		if (this.cardStore) {
			void this.cardStore.saveNow();
		}

		// Clear EventBus subscriptions
		resetEventBus();

		// Clear ToolRegistry
		resetToolRegistry();

		// Obsidian automatically handles leaf cleanup when plugin unloads
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<TrueRecallSettings>
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
			this.dayBoundaryService.updateDayStartHour(
				this.settings.dayStartHour
			);
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
	 * Activate the dashboard view
	 */
	async activateDashboardView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_DASHBOARD);
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

	/**
	 * Activate the browser view
	 */
	async activateBrowserView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_BROWSER, { useMainArea: true });
	}

	/**
	 * Show card browser
	 */
	async showBrowser(): Promise<void> {
		await this.activateBrowserView();
	}

	/**
	 * Open FSRS simulator
	 */
	async openSimulator(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_SIMULATOR, { useMainArea: true });
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
		const currentNoteName = currentFile ? currentFile.basename : null;

		// Open session panel and wait for result
		return new Promise<void>((resolve) => {
			const eventBus = getEventBus();
			const unsubscribe = eventBus.on("session:selected", (event: any) => {
				unsubscribe();
				void this.handleSessionResult(event.result);
				resolve();
			});

			void this.activateSessionView(currentNoteName, allCards);
		});
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
	 * Initialize device context and then the card store.
	 * Handles first-run detection, legacy migration, and device selection.
	 */
	private async initializeDeviceAndStore(): Promise<void> {
		try {
			const deviceId = await this.initializeDeviceContext();
			await this.initializeCardStore(deviceId);
		} catch (error) {
			console.error(
				"[True Recall] Failed to initialize device context:",
				error
			);
			new Notice(
				"Failed to initialize device context. Using default configuration."
			);
			// Fallback: create ephemeral device ID and continue
			this.deviceIdService = new DeviceIdService();
			await this.initializeCardStore(this.deviceIdService.getDeviceId());
		}
	}

	/**
	 * Initialize device context: ID, discovery, and first-run handling.
	 * @returns The device ID to use for this session
	 */
	private async initializeDeviceContext(): Promise<string> {
		// 1. Get or create device ID
		this.deviceIdService = new DeviceIdService();
		const deviceId = this.deviceIdService.getDeviceId();
		console.log(`[True Recall] Device ID: ${deviceId}`);

		// 2. Initialize discovery service
		this.deviceDiscovery = new DeviceDiscoveryService(this.app, deviceId);

		// 3. Check if device-specific database exists
		const deviceDbPath = normalizePath(
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`
		);
		const deviceDbExists = await this.app.vault.adapter.exists(
			deviceDbPath
		);

		if (deviceDbExists) {
			// Database for this device already exists - nothing to do
			console.log(
				`[True Recall] Using existing device database: ${deviceDbPath}`
			);
			return deviceId;
		}

		// 4. First-run detection - check for other databases
		const databases = await this.deviceDiscovery.discoverDeviceDatabases();
		const hasLegacy = await this.deviceDiscovery.hasLegacyDatabase();

		console.log(
			`[True Recall] First run on device. Legacy DB: ${hasLegacy}, Other devices: ${databases.length}`
		);

		// 5. Handle different scenarios
		if (hasLegacy && databases.length === 0) {
			// Migrate legacy database to device-specific
			await this.migrateLegacyDatabase(deviceId);
		} else if (databases.length > 0) {
			// Show selection modal
			const result = await this.showDeviceSelectionModal(
				databases,
				hasLegacy
			);
			if (!result.cancelled) {
				await this.handleDeviceSelection(result, deviceId);
			}
			// If cancelled, SqliteStoreService will create a new empty database
		}
		// If no databases exist, SqliteStoreService will create a new empty database

		return deviceId;
	}

	/**
	 * Migrate legacy true-recall.db to device-specific format.
	 */
	private async migrateLegacyDatabase(deviceId: string): Promise<void> {
		const legacyPath = normalizePath(`${DB_FOLDER}/true-recall.db`);
		const newPath = normalizePath(
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`
		);
		const backupPath = normalizePath(`${DB_FOLDER}/true-recall.db.migrated`);

		try {
			// Create backup of legacy database
			const data = await this.app.vault.adapter.readBinary(legacyPath);
			await this.app.vault.adapter.writeBinary(backupPath, data);

			// Rename legacy to device-specific
			await this.app.vault.adapter.rename(legacyPath, newPath);

			console.log(`[True Recall] Migrated legacy database to ${newPath}`);
			new Notice("Database migrated to per-device format.");
		} catch (error) {
			console.error("[True Recall] Legacy migration failed:", error);
			new Notice("Failed to migrate legacy database.");
			throw error;
		}
	}

	/**
	 * Show device selection modal and return result.
	 */
	private async showDeviceSelectionModal(
		databases: import("./services").DeviceDatabaseInfo[],
		hasLegacy: boolean
	): Promise<DeviceSelectionResult> {
		const modal = new DeviceSelectionModal(this.app, {
			databases,
			hasLegacy,
		});
		return await modal.openAndWait();
	}

	/**
	 * Handle result of device selection modal.
	 */
	private async handleDeviceSelection(
		result: DeviceSelectionResult,
		deviceId: string
	): Promise<void> {
		if (result.action === "import" && result.sourcePath) {
			const targetPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`
			);

			try {
				const sourceData = await this.app.vault.adapter.readBinary(
					result.sourcePath
				);
				await this.app.vault.adapter.writeBinary(
					targetPath,
					sourceData
				);

				console.log(
					`[True Recall] Imported database from ${result.sourceDeviceId} to ${deviceId}`
				);
				new Notice(
					`Imported data from device ${result.sourceDeviceId}`
				);
			} catch (error) {
				console.error("[True Recall] Database import failed:", error);
				new Notice("Failed to import database.");
				throw error;
			}
		}
		// "fresh" action - do nothing, SqliteStoreService will create new database
	}

	/**
	 * Initialize the SQLite card store and session persistence
	 */
	private async initializeCardStore(deviceId: string): Promise<void> {
		try {
			// Create and load SQLite store with device ID
			this.cardStore = new SqliteStoreService(this.app, deviceId);
			await this.cardStore.load();

			// Set store in flashcard manager
			this.flashcardManager.setStore(this.cardStore);

			// Initialize session persistence with SQL store (uses dayBoundaryService for Anki-style day boundaries)
			this.sessionPersistence = new SessionPersistenceService(
				this.app,
				this.cardStore,
				this.dayBoundaryService
			);

			// Migrate stats.json to SQL if exists (one-time migration)
			await this.sessionPersistence.migrateStatsJsonToSql();

			// Initialize Backup Service
			this.backupService = new BackupService(this.app, this.cardStore);

			// Auto-backup on load if enabled
			if (this.settings.autoBackupOnLoad) {
				await this.runAutoBackup();
			}

			// Initialize NL Query Service (AI-powered stats queries)
			await this.initializeNLQueryService();

			// Initialize SyncService now that cardStore is ready
			this.initializeSyncService();
		} catch (error) {
			console.error(
				"[True Recall] Failed to initialize SQLite store:",
				error
			);
			new Notice(
				"Failed to load flashcard data. Please restart Obsidian."
			);
		}
	}

	/**
	 * Initialize the NL Query Service for AI-powered statistics queries
	 */
	private async initializeNLQueryService(): Promise<void> {
		if (!this.cardStore || !this.settings.openRouterApiKey) {
			// Service requires API key and database
			return;
		}

		try {
			const db = this.cardStore.getDatabase();
			if (!db) {
				console.warn(
					"[True Recall] Database not ready for NL Query Service"
				);
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
			console.warn(
				"[True Recall] Failed to initialize NL Query Service:",
				error
			);
			// Non-critical: plugin continues without NL Query feature
		}
	}

	/**
	 * Add current note to a project via modal
	 * v16: Projects scanned from frontmatter (no database)
	 */
	async addCurrentNoteToProject(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice("No active markdown file");
			return;
		}

		const frontmatterService =
			this.flashcardManager.getFrontmatterService();

		// Get current projects from frontmatter
		const content = await this.app.vault.read(file);
		const currentProjects =
			frontmatterService.extractProjectsFromFrontmatter(content);

		// v16: Scan all files for available projects (from frontmatter)
		const allProjectsSet = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();
		for (const f of files) {
			const c = await this.app.vault.cachedRead(f);
			const projects =
				frontmatterService.extractProjectsFromFrontmatter(c);
			projects.forEach((p) => allProjectsSet.add(p));
		}
		const allProjects = Array.from(allProjectsSet).sort();

		// Open modal
		const modal = new AddToProjectModal(this.app, {
			availableProjects: allProjects,
			currentProjects: currentProjects,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		// Update frontmatter (v16: frontmatter is source of truth)
		await frontmatterService.setProjectsInFrontmatter(
			file,
			result.projects
		);

		if (result.projects.length > 0) {
			new Notice(`Projects updated: ${result.projects.join(", ")}`);
		} else {
			new Notice("Removed all projects from note");
		}
	}

	/**
	 * Create a project from a file (used by file-menu context action)
	 * v16: Projects only in frontmatter (no database)
	 */
	async createProjectFromNote(file: TFile): Promise<void> {
		const projectName = file.basename;
		const frontmatterService =
			this.flashcardManager.getFrontmatterService();

		// v16: Check if project exists by scanning frontmatter
		const files = this.app.vault.getMarkdownFiles();
		for (const f of files) {
			const content = await this.app.vault.cachedRead(f);
			const projects =
				frontmatterService.extractProjectsFromFrontmatter(content);
			if (
				projects.some(
					(p) => p.toLowerCase() === projectName.toLowerCase()
				)
			) {
				new Notice(`Project "${projectName}" already exists`);
				return;
			}
		}

		// Get or create source note UID
		let sourceUid = await frontmatterService.getSourceNoteUid(file);
		if (!sourceUid) {
			sourceUid = frontmatterService.generateUid();
			await frontmatterService.setSourceNoteUid(file, sourceUid);
		}

		// Add note to project (update frontmatter - v16: frontmatter is source of truth)
		await frontmatterService.setProjectsInFrontmatter(file, [projectName]);

		new Notice(`Project "${projectName}" created`);
	}

	/**
	 * Run automatic backup on plugin load
	 */
	private async runAutoBackup(): Promise<void> {
		if (!this.backupService) return;

		try {
			await this.backupService.createBackup();

			// Prune old backups if limit is set
			if (this.settings.maxBackups > 0) {
				await this.backupService.pruneBackups(this.settings.maxBackups);
			}
		} catch (error) {
			console.warn("[True Recall] Auto-backup failed:", error);
		}
	}

	/**
	 * Create a manual backup (called from command or settings)
	 */
	async createManualBackup(): Promise<void> {
		if (!this.backupService) {
			new Notice("Backup service not available");
			return;
		}

		try {
			const backupPath = await this.backupService.createBackup();
			const filename = backupPath.split("/").pop();
			new Notice(`Backup created: ${filename}`);

			// Prune old backups if limit is set
			if (this.settings.maxBackups > 0) {
				const deleted = await this.backupService.pruneBackups(
					this.settings.maxBackups
				);
				if (deleted > 0) {
					console.log(`[True Recall] Pruned ${deleted} old backup(s)`);
				}
			}
		} catch (error) {
			console.error("[True Recall] Manual backup failed:", error);
			new Notice("Failed to create backup. Check console for details.");
		}
	}

	/**
	 * Open the restore backup modal
	 */
	async openRestoreBackupModal(): Promise<void> {
		if (!this.backupService) {
			new Notice("Backup service not available");
			return;
		}

		const backups = await this.backupService.listBackups();
		if (backups.length === 0) {
			new Notice("No backups available");
			return;
		}

		const modal = new RestoreBackupModal(this.app, {
			backups,
			backupService: this.backupService,
		});

		await modal.openAndWait();
	}

	/**
	 * Synchronize with cloud (pull + push with conflict resolution)
	 */
	async syncCloud(): Promise<void> {
		if (!this.syncService?.isAvailable()) {
			new Notice(
				"Cloud sync not available. Check Supabase configuration."
			);
			return;
		}

		new Notice("Syncing...");
		const result = await this.syncService.sync();

		if (result.success) {
			new Notice(
				`Sync complete: ${result.pulled} pulled, ${result.pushed} pushed`
			);
		} else {
			new Notice(`Sync failed: ${result.error}`);
		}
	}

	/**
	 * Add flashcard UID to current note's frontmatter
	 * Creates a unique identifier for linking flashcards to the source note
	 */
	async addFlashcardUidToCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice("No active markdown file");
			return;
		}

		const frontmatterService =
			this.flashcardManager.getFrontmatterService();

		// Check if UID already exists
		const existingUid = await frontmatterService.getSourceNoteUid(file);
		if (existingUid) {
			new Notice(`Note already has flashcard UID: ${existingUid}`);
			return;
		}

		// Generate and set new UID
		const newUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(file, newUid);
		// Note: FrontmatterIndexService updates automatically via metadataCache 'changed' event

		new Notice(`Added flashcard UID: ${newUid}`);
	}

	/**
	 * Force replace - overwrites all server data with local database
	 * WARNING: Destructive operation
	 */
	async forceReplaceCloud(): Promise<void> {
		if (!this.syncService?.isAvailable()) {
			new Notice(
				"Cloud sync not available. Check Supabase configuration."
			);
			return;
		}

		// Confirmation dialog
		const confirmed = confirm(
			"WARNING: This will DELETE all your data on the server and replace it with your local database.\n\n" +
				"Other devices will lose their changes.\n\n" +
				"Are you sure you want to continue?"
		);

		if (!confirmed) return;

		new Notice("Replacing all server data...");
		const result = await this.syncService.forceReplace();

		if (result.success) {
			new Notice(
				`Force replace complete: ${result.pushed} records uploaded`
			);
		} else {
			new Notice(`Replace failed: ${result.error}`);
		}
	}
}
