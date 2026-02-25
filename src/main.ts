import { StreamingGenerationService } from "@features/ai/services/streaming-generation.service";
import { SqlQueryAdapter } from "@features/ai/services/sql-query.adapter";
import { NLQueryService } from "@features/ai/services/nl-query.service";
import { createSelectionToolbarExtension } from "@features/ai/ui/editor/SelectionToolbarPlugin";
import { NoteStatusCacheService } from "@features/core/cache/note-status-cache.service";
import { BackgroundBackupManager } from "@features/core/persistence/background-backup.service";
import { BackupService } from "@features/core/persistence/backup.service";
import { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import { SqliteStoreService } from "@features/core/persistence/sqlite";
import {
	DB_FOLDER,
	getDeviceDbFilename,
} from "@features/core/persistence/sqlite/sqlite.types";
import { DayBoundaryService } from "@features/core/services/day-boundary.service";
import { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import { FSRSService } from "@features/core/services/fsrs.service";
import { PresetService } from "@features/core/services/preset.service";
import { FolderProjectService } from "@features/core/services/folder-project.service";
import { ProjectLinkService } from "@features/core/services/project-link.service";
import { AnkiExportModal } from "@features/integration/modals/AnkiExportModal";
import { AnkiImportModal } from "@features/integration/modals/AnkiImportModal";
import { CsvExportModal } from "@features/integration/modals/CsvExportModal";
import {
	DeviceSelectionModal,
	type DeviceSelectionResult,
} from "@features/integration/modals/DeviceSelectionModal";
import { RestoreBackupModal } from "@features/integration/modals/RestoreBackupModal";
import { DeviceDiscoveryService } from "@features/integration/services/device-discovery.service";
import { DeviceIdService } from "@features/integration/services/device-id.service";
import { FlashcardPanelView } from "@features/library/ui/panel/FlashcardPanelView";
import { FSRSHelperService } from "@features/metrics/services/fsrs-tools";
import { StatsService } from "@features/metrics/services/stats/stats.service";
import { SimulatorView } from "@features/metrics/ui/simulator";
import { StatsView } from "@features/metrics/ui/stats/StatsView";
import {
	DEFAULT_SETTINGS,
	type TrueRecallSettings,
	TrueRecallSettingTab,
} from "@features/settings";
import {
	CustomStudyModal,
	type CustomStudyModalScope,
} from "@features/study/modals/CustomStudyModal";
import { DeletionHandlerService } from "@features/study/services/flashcard/deletion-handler.service";
import { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { UidGuardianService } from "@features/study/services/flashcard/uid-guardian.service";
import {
	createLinkStatusPostProcessor,
	createLinkStatusViewPlugin,
} from "@features/study/ui/editor";
import type { StatusBarWidget } from "@features/study/ui/editor/widgets/StatusBarWidget";
import { ReviewView } from "@features/study/ui/review/ReviewView";
import {
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import { settingsVersion } from "@shared/services/signals";
import { UndoService } from "@shared/services/undo.service";
import { type AppStore, createAppStore } from "@shared/store";
import { extractFSRSSettings } from "@shared/types";
import { SetPresetModal, SimpleFlashcardEditorModal } from "@shared/ui/modals";
import { normalizePath, Plugin, type TFile } from "obsidian";
import { registerCommands } from "./plugin/PluginCommands";
import {
	registerDeletionHandler,
	registerEventHandlers,
} from "./plugin/PluginEventHandlers";
import {
	activateReviewView,
	activateView,
	getView,
} from "./plugin/ViewActivator";

export default class TrueRecallPlugin extends Plugin {
	settings!: TrueRecallSettings;
	flashcardManager!: FlashcardManager;
	fsrsService!: FSRSService;
	statsService!: StatsService;
	sessionPersistence!: SessionPersistenceService;
	cardStore!: SqliteStoreService;
	dayBoundaryService!: DayBoundaryService;
	frontmatterIndex!: FrontmatterIndexService;
	nlQueryService: NLQueryService | null = null;
	backupService: BackupService | null = null;
	backgroundBackupManager: BackgroundBackupManager | null = null;
	deviceIdService: DeviceIdService | null = null;
	deviceDiscovery: DeviceDiscoveryService | null = null;
	// Cloud sync - coming soon
	authService: null = null;
	syncService: null = null;
	deletionHandler: DeletionHandlerService | null = null;
	undoService: UndoService | null = null;
	fsrsHelper: FSRSHelperService | null = null;
	presetService!: PresetService;
	folderProjectService!: FolderProjectService;
	projectLinkService!: ProjectLinkService;
	store: AppStore | null = null;
	noteStatusCache: NoteStatusCacheService | null = null;
	statusBarWidget: StatusBarWidget | null = null;
	EmbeddableEditor:
		| import("@shared/ui/editor/embedded-editor").EmbeddableEditorClass
		| null = null;

	/**
	 * Assert that the card store is initialized and ready.
	 * Throws an error if called before initialization completes.
	 */
	private assertStoreReady(): asserts this is this & {
		cardStore: SqliteStoreService;
	} {
		if (!this.cardStore) {
			throw new Error(
				"Card store not initialized. Please wait for plugin to fully load.",
			);
		}
	}

	/**
	 * Check if the card store is ready (non-throwing version)
	 */
	isStoreReady(): boolean {
		return this.cardStore !== null && this.cardStore !== undefined;
	}

	async onload(): Promise<void> {
		await this.loadSettings();

		this.frontmatterIndex = new FrontmatterIndexService(this.app);
		this.frontmatterIndex.register({
			field: "flashcard_uid",
			type: "string",
			unique: true,
		});
		this.frontmatterIndex.register({
			field: "fsrs_preset",
			type: "string",
			unique: false,
		});
		this.frontmatterIndex.register({
			field: "project",
			type: "string",
			unique: false,
		});
		this.frontmatterIndex.registerEvents(this);

		// Build index after metadataCache is fully loaded
		this.app.workspace.onLayoutReady(() => {
			this.frontmatterIndex.rebuildIndex();
		});

		this.folderProjectService = new FolderProjectService(
			this.app,
			this.frontmatterIndex,
			() => this.settings,
		);
		const invalidateFolderCache = () =>
			this.folderProjectService.invalidateCache();
		this.registerEvent(
			this.app.vault.on("create", invalidateFolderCache),
		);
		this.registerEvent(
			this.app.vault.on("delete", invalidateFolderCache),
		);
		this.registerEvent(
			this.app.vault.on("rename", invalidateFolderCache),
		);

		this.projectLinkService = new ProjectLinkService(
			this.app,
			this.frontmatterIndex,
			this.folderProjectService,
		);

		this.flashcardManager = new FlashcardManager(
			this.app,
			this.settings,
			this.frontmatterIndex,
		);

		this.presetService = new PresetService(
			() => this.settings,
			() => this.saveSettings(),
			this.frontmatterIndex,
		);

		const fsrsSettings = extractFSRSSettings(this.settings);
		this.fsrsService = new FSRSService(fsrsSettings);
		this.statsService = new StatsService(
			this.flashcardManager,
			this.fsrsService,
		);

		this.dayBoundaryService = new DayBoundaryService(
			this.settings.dayStartHour,
		);

		try {
			await this.initializeDeviceAndStore();
		} catch (error) {
			console.error(
				"[True Recall] Critical: Device/store initialization failed:",
				error,
			);
			notify().error("Failed to initialize database. Please restart Obsidian.");
		}

		this.registerView(
			VIEW_TYPE_FLASHCARD_PANEL,
			(leaf) => new FlashcardPanelView(leaf, this),
		);

		this.registerView(VIEW_TYPE_REVIEW, (leaf) => new ReviewView(leaf, this));

		this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

		this.registerView(
			VIEW_TYPE_SIMULATOR,
			(leaf) => new SimulatorView(leaf, this),
		);

		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => {
			const {
				DashboardView,
			} = require("@features/study/ui/dashboard/DashboardView") as {
				DashboardView: typeof import("@features/study/ui/dashboard/DashboardView").DashboardView;
			};
			return new DashboardView(leaf, this);
		});

		this.addRibbonIcon("layout-dashboard", "True Recall - dashboard", () => {
			this.openDashboard().catch((error) => {
				notify().error("Failed to open dashboard", error);
			});
		});

		this.addRibbonIcon("bar-chart-2", "True Recall - statistics", () => {
			this.openStatsView().catch((error) => {
				notify().error("Failed to open statistics view", error);
			});
		});

		registerCommands(this);
		this.addSettingTab(new TrueRecallSettingTab(this.app, this));
		registerEventHandlers(this);

		this.undoService = new UndoService(this);
		// Cloud sync - coming soon
		// this.authService = new AuthService();
	}

	// Cloud sync - coming soon
	// private initializeSyncService(): void {
	// 	if (this.authService && this.cardStore) {
	// 		this.syncService = new SyncService(
	// 			this.authService,
	// 			this.cardStore
	// 		);
	// 	}
	// }

	private initializeDeletionHandler(): void {
		if (!this.cardStore || !this.frontmatterIndex) return;

		this.deletionHandler = new DeletionHandlerService({
			frontmatterIndex: this.frontmatterIndex,
			store: this.cardStore,
		});

		registerDeletionHandler(this, this.deletionHandler);

		const uidGuardian = new UidGuardianService({
			app: this.app,
			frontmatterIndex: this.frontmatterIndex,
			store: this.cardStore,
			frontmatterService: this.flashcardManager.getFrontmatterService(),
		});
		uidGuardian.register();
	}

	onunload(): void {
		this.undoService?.clear();
		this.backgroundBackupManager?.stop();
		this.statusBarWidget?.dispose();
		this.noteStatusCache?.dispose();

		if (this.cardStore) {
			void this.cardStore.saveNow();
		}
	}

	async loadSettings(): Promise<void> {
		const rawData =
			(await this.loadData()) as Partial<TrueRecallSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, rawData);

		if (Array.isArray(this.settings.easyDays)) {
			this.settings.easyDays = {
				recurringDays: this.settings.easyDays as unknown as number[],
				specificDates: [],
			};
		}

		// Migrate global FSRS settings → Default preset for existing users
		if (!rawData?.fsrsPresets) {
			this.settings.fsrsPresets = [
				{
					id: "default",
					name: "Default",
					requestRetention: this.settings.fsrsRequestRetention,
					maximumInterval: this.settings.fsrsMaximumInterval,
					weights: this.settings.fsrsWeights,
					learningSteps: this.settings.learningSteps,
					relearningSteps: this.settings.relearningSteps,
					newCardsPerDay: this.settings.newCardsPerDay,
					reviewsPerDay: this.settings.reviewsPerDay,
					createdAt: Date.now(),
					lastOptimization: this.settings.lastOptimization,
					lastOptimizationReviewCount:
						this.settings.lastOptimizationReviewCount,
					lastOptimizationMetrics: this.settings.lastOptimizationMetrics,
				},
			];
			this.settings.defaultPresetId = "default";
			await this.saveData(this.settings);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		if (this.flashcardManager) {
			this.flashcardManager.updateSettings(this.settings);
		}
		if (this.fsrsService) {
			const fsrsSettings = extractFSRSSettings(this.settings);
			this.fsrsService.updateSettings(fsrsSettings);
		}
		if (this.dayBoundaryService) {
			this.dayBoundaryService.updateDayStartHour(this.settings.dayStartHour);
		}
		if (this.fsrsHelper) {
			this.fsrsHelper.updateSettings(this.settings);
		}
		if (this.backgroundBackupManager) {
			this.backgroundBackupManager.updateConfig(this.settings);
		}
		this.initializeNLQueryService().catch(() => {
			// NL Query Service reinitialization is non-critical
		});

		this.noteStatusCache?.bumpVersion();

		settingsVersion.value++;
	}

	async activateView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_FLASHCARD_PANEL);
	}

	async openSimulator(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_SIMULATOR, { useMainArea: true });
	}

	private async handleSessionResult(
		result: import("@shared/types/events.types").SessionResult,
	): Promise<void> {
		if (result.cancelled) return;

		if (result.useDefaultDeck) {
			await this.openReviewView("Knowledge");
			return;
		}

		await this.openReviewViewWithFilters({
			deckFilter: null,
			sourceNoteFilter: result.sourceNoteFilter,
			sourceNoteFilters: result.sourceNoteFilters,
			filePathFilter: result.filePathFilter,
			createdTodayOnly: result.createdTodayOnly,
			stateFilter: result.stateFilter,
			ignoreDailyLimits: result.ignoreDailyLimits,
			bypassScheduling: result.bypassScheduling,
			difficultyRange: result.difficultyRange,
			lapsesRange: result.lapsesRange,
			stabilityRange: result.stabilityRange,
			overdueOnly: result.overdueOnly,
			recentlyFailed: result.recentlyFailed,
			cardLimit: result.cardLimit,
			studyAheadDays: result.studyAheadDays,
			reviewOrder: result.reviewOrder,
			crammingMode: result.crammingMode,
		});
	}

	private async openReviewView(deckFilter: string | null): Promise<void> {
		await activateReviewView(
			this.app,
			VIEW_TYPE_REVIEW,
			this.settings.reviewMode,
			{ deckFilter },
		);
	}

	async openDashboard(): Promise<void> {
		const existingLeaf = getView(this.app, VIEW_TYPE_DASHBOARD);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.app, VIEW_TYPE_DASHBOARD, { useMainArea: true });
	}

	async openStatsView(): Promise<void> {
		const existingLeaf = getView(this.app, VIEW_TYPE_STATS);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);

			const view = existingLeaf.view;
			if (view instanceof StatsView) {
				void view.refresh();
			}
			return;
		}

		await activateView(this.app, VIEW_TYPE_STATS, { useMainArea: true });
	}

	async openCustomStudyModal(scope?: CustomStudyModalScope): Promise<void> {
		const modal = new CustomStudyModal(
			this.app,
			{
				title: scope?.scopeLabel
					? `Custom study — ${scope.scopeLabel}`
					: "Custom study",
				width: "480px",
			},
			scope,
		);
		const result = await modal.openAndWait();
		if (result.cancelled || !result.sessionResult) return;

		if (result.saveAsPreset && result.presetName) {
			const preset: import("@shared/types/settings.types").SessionPreset = {
				id: crypto.randomUUID(),
				name: result.presetName,
				createdAt: Date.now(),
				stateFilter: result.sessionResult.stateFilter,
				difficultyRange: result.sessionResult.difficultyRange,
				lapsesRange: result.sessionResult.lapsesRange,
				stabilityRange: result.sessionResult.stabilityRange,
				overdueOnly: result.sessionResult.overdueOnly,
				recentlyFailed: result.sessionResult.recentlyFailed,
				reviewOrder: result.sessionResult.reviewOrder,
				cardLimit: result.sessionResult.cardLimit,
				studyAheadDays: result.sessionResult.studyAheadDays,
				crammingMode: result.sessionResult.crammingMode,
			};
			this.settings.sessionPresets = [...this.settings.sessionPresets, preset];
			await this.saveSettings();
			notify().success(`Preset "${result.presetName}" saved`);
		}

		await this.handleSessionResult(result.sessionResult);
	}

	async reviewCurrentNote(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			notify().noActiveFile();
			return;
		}
		await this.reviewNoteFlashcards(file);
	}

	async reviewNoteFlashcards(file: TFile): Promise<void> {
		const allCards = this.flashcardManager.getAllFSRSCards();
		const noteCards = allCards.filter(
			(c) => c.sourceNoteName === file.basename,
		);

		if (noteCards.length === 0) {
			notify().info(`No flashcards found for "${file.basename}"`);
			return;
		}

		const availableCards = noteCards.filter((c) => {
			return this.dayBoundaryService.isCardAvailable(c);
		});

		if (availableCards.length === 0) {
			notify().info(
				`No cards due for "${file.basename}". All ${noteCards.length} cards are scheduled for later.`,
			);
			return;
		}

		await this.openReviewViewWithFilters({
			deckFilter: null,
			sourceNoteFilter: file.basename,
			ignoreDailyLimits: true,
		});
	}

	async reviewTodaysCards(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}
		const allCards = this.flashcardManager.getAllFSRSCards();

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const todaysCards = allCards.filter((c) => {
			const createdAt = c.fsrs.createdAt;
			if (!createdAt || createdAt < todayStart.getTime()) return false;
			return this.dayBoundaryService.isCardAvailable(c);
		});

		if (todaysCards.length === 0) {
			notify().info("No new cards created today");
			return;
		}

		await this.openReviewViewWithFilters({
			deckFilter: null,
			createdTodayOnly: true,
			ignoreDailyLimits: true,
		});
	}

	async openReviewViewWithFilters(filters: {
		deckFilter?: string | null;
		projectPath?: string;
		sourceNoteFilter?: string;
		sourceNoteFilters?: string[];
		filePathFilter?: string;
		createdTodayOnly?: boolean;
		createdThisWeek?: boolean;
		weakCardsOnly?: boolean;
		stateFilter?: "due" | "learning" | "new" | "buried";
		ignoreDailyLimits?: boolean;
		bypassScheduling?: boolean;
		difficultyRange?: { min: number; max: number };
		lapsesRange?: { min: number; max: number };
		stabilityRange?: { min: number; max: number };
		overdueOnly?: boolean;
		recentlyFailed?: boolean;
		cardLimit?: number;
		studyAheadDays?: number;
		reviewOrder?: import("@shared/types/settings.types").ReviewOrder;
		crammingMode?: boolean;
	}): Promise<void> {
		const state = {
			deckFilter: filters.deckFilter ?? null,
			projectPath: filters.projectPath,
			sourceNoteFilter: filters.sourceNoteFilter,
			sourceNoteFilters: filters.sourceNoteFilters,
			filePathFilter: filters.filePathFilter,
			createdTodayOnly: filters.createdTodayOnly,
			createdThisWeek: filters.createdThisWeek,
			weakCardsOnly: filters.weakCardsOnly,
			stateFilter: filters.stateFilter,
			ignoreDailyLimits: filters.ignoreDailyLimits,
			bypassScheduling: filters.bypassScheduling,
			difficultyRange: filters.difficultyRange,
			lapsesRange: filters.lapsesRange,
			stabilityRange: filters.stabilityRange,
			overdueOnly: filters.overdueOnly,
			recentlyFailed: filters.recentlyFailed,
			cardLimit: filters.cardLimit,
			studyAheadDays: filters.studyAheadDays,
			reviewOrder: filters.reviewOrder,
			crammingMode: filters.crammingMode,
		};

		await activateReviewView(
			this.app,
			VIEW_TYPE_REVIEW,
			this.settings.reviewMode,
			state,
		);
	}

	private async initializeDeviceAndStore(): Promise<void> {
		try {
			const deviceId = await this.initializeDeviceContext();
			await this.initializeCardStore(deviceId);
		} catch (error) {
			console.error(
				"[True Recall] Failed to initialize device context:",
				error,
			);
			notify().error(
				"Failed to initialize device context. Using default configuration.",
			);
			this.deviceIdService = new DeviceIdService();
			await this.initializeCardStore(this.deviceIdService.getDeviceId());
		}
	}

	private async initializeDeviceContext(): Promise<string> {
		this.deviceIdService = new DeviceIdService();
		const deviceId = this.deviceIdService.getDeviceId();
		this.deviceDiscovery = new DeviceDiscoveryService(this.app, deviceId);
		const deviceDbPath = normalizePath(
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`,
		);
		const deviceDbExists = await this.app.vault.adapter.exists(deviceDbPath);

		if (deviceDbExists) {
			return deviceId;
		}

		const databases = await this.deviceDiscovery.discoverDeviceDatabases();
		const hasLegacy = await this.deviceDiscovery.hasLegacyDatabase();

		if (hasLegacy && databases.length === 0) {
			await this.migrateLegacyDatabase(deviceId);
		} else if (databases.length > 0) {
			const result = await this.showDeviceSelectionModal(databases, hasLegacy);
			if (!result.cancelled) {
				await this.handleDeviceSelection(result, deviceId);
			}
		}

		return deviceId;
	}

	private async migrateLegacyDatabase(deviceId: string): Promise<void> {
		const legacyPath = normalizePath(`${DB_FOLDER}/true-recall.db`);
		const newPath = normalizePath(
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`,
		);
		const backupPath = normalizePath(`${DB_FOLDER}/true-recall.db.migrated`);

		try {
			const data = await this.app.vault.adapter.readBinary(legacyPath);
			await this.app.vault.adapter.writeBinary(backupPath, data);
			await this.app.vault.adapter.rename(legacyPath, newPath);

			notify().success("Database migrated to per-device format.");
		} catch (error) {
			console.error("[True Recall] Legacy migration failed:", error);
			notify().error("Failed to migrate legacy database.");
			throw error;
		}
	}

	private async showDeviceSelectionModal(
		databases: import("@features/integration/services/device-discovery.service").DeviceDatabaseInfo[],
		hasLegacy: boolean,
	): Promise<DeviceSelectionResult> {
		const modal = new DeviceSelectionModal(this.app, {
			databases,
			hasLegacy,
		});
		return await modal.openAndWait();
	}

	private async handleDeviceSelection(
		result: DeviceSelectionResult,
		deviceId: string,
	): Promise<void> {
		if (result.action === "import" && result.sourcePath) {
			const targetPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`,
			);

			try {
				const sourceData = await this.app.vault.adapter.readBinary(
					result.sourcePath,
				);
				await this.app.vault.adapter.writeBinary(targetPath, sourceData);

				notify().success(`Imported data from device ${result.sourceDeviceId}`);
			} catch (error) {
				console.error("[True Recall] Database import failed:", error);
				notify().error("Failed to import database.");
				throw error;
			}
		}
	}

	private async initializeCardStore(deviceId: string): Promise<void> {
		try {
			this.cardStore = new SqliteStoreService(this.app, deviceId);
			await this.cardStore.load();
			this.flashcardManager.setStore(this.cardStore);

			this.sessionPersistence = new SessionPersistenceService(
				this.app,
				this.cardStore,
				this.dayBoundaryService,
			);

			await this.sessionPersistence.migrateStatsJsonToSql();
			this.backupService = new BackupService(this.app, this.cardStore);
			this.backgroundBackupManager = new BackgroundBackupManager(
				this.app,
				this.backupService,
				this.settings,
			);

			if (
				this.settings.periodicBackupEnabled ||
				this.settings.activityTriggeredBackup
			) {
				this.backgroundBackupManager.start();
			}

			if (this.settings.autoBackupOnLoad) {
				await this.runAutoBackup();
			}

			await this.initializeNLQueryService();
			// Cloud sync - coming soon
			// this.initializeSyncService();
			this.fsrsHelper = new FSRSHelperService(this.cardStore, this.settings);
			this.initializeDeletionHandler();
			this.initializeStore();
			this.initializeLinkStatusIndicators();
			this.initializeStatusBar();
			this.initializeDashboardCodeblocks();
			this.initializeSelectionToolbar();
		} catch (error) {
			console.error("[True Recall] Failed to initialize SQLite store:", error);
			notify().error("Failed to load flashcard data. Please restart Obsidian.");
		}
	}

	private initializeStore(): void {
		this.store = createAppStore({
			app: this.app,
			cardStore: this.cardStore,
			dayBoundaryService: this.dayBoundaryService,
			frontmatterIndex: this.frontmatterIndex,
			getSettings: () => this.settings,
		});
	}

	private initializeLinkStatusIndicators(): void {
		if (!this.cardStore || !this.frontmatterIndex) return;

		this.noteStatusCache = new NoteStatusCacheService(this.cardStore);

		// Build cache after frontmatter index is ready
		this.app.workspace.onLayoutReady(async () => {
			this.noteStatusCache?.buildFromStore();
			this.noteStatusCache?.registerEvents();

			// Resolve the embeddable editor prototype for live-preview editing
			try {
				const { createEmbeddableEditorClass } = await import(
					"@shared/ui/editor/embedded-editor"
				);
				this.EmbeddableEditor = createEmbeddableEditorClass(this.app);
			} catch (e) {
				console.warn("[TrueRecall] Failed to resolve editor prototype:", e);
			}
		});

		const onReviewNote = (file: TFile) => {
			this.reviewNoteFlashcards(file).catch((error) => {
				notify().error("Failed to start review session", error);
			});
		};

		const onReviewNotes = (noteNames: string[], dueOnly: boolean) => {
			this.openReviewViewWithFilters({
				deckFilter: null,
				sourceNoteFilters: noteNames,
				ignoreDailyLimits: true,
				stateFilter: dueOnly ? "due" : undefined,
			}).catch((error) => {
				notify().error("Failed to start review session", error);
			});
		};

		const viewPlugin = createLinkStatusViewPlugin(
			this.app,
			this.noteStatusCache,
			this.frontmatterIndex,
			() => this.settings.showLinkStatusIndicators,
			onReviewNote,
			onReviewNotes,
			this.cardStore,
		);
		this.registerEditorExtension([viewPlugin]);

		const postProcessor = createLinkStatusPostProcessor(
			this.app,
			this.noteStatusCache,
			this.frontmatterIndex,
			() => this.settings.showLinkStatusIndicators,
			onReviewNote,
			onReviewNotes,
		);
		this.registerMarkdownPostProcessor(postProcessor);
	}

	private initializeStatusBar(): void {
		if (!this.noteStatusCache) return;

		void import("@features/study/ui/editor/widgets/StatusBarWidget").then(
			({ StatusBarWidget }) => {
				if (!this.noteStatusCache) return;

				const statusBarEl = this.addStatusBarItem();
				this.statusBarWidget = new StatusBarWidget(
					statusBarEl,
					this.noteStatusCache,
					this.flashcardManager,
					() => {
						this.openDashboard().catch(() => {});
					},
					() => this.settings.showStatusBarWidget,
				);
				this.statusBarWidget.start();
			},
		);
	}

	private initializeDashboardCodeblocks(): void {
		import("@features/study/ui/editor/widgets/DashboardCodeblock")
			.then(({ registerDashboardCodeblocks }) => {
				registerDashboardCodeblocks(this);
			})
			.catch(() => {});
	}

	private initializeSelectionToolbar(): void {
		const streamingService = new StreamingGenerationService(
			() => this.settings,
			this.flashcardManager,
		);

		const extension = createSelectionToolbarExtension({
			onGenerate: async (text, mode) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					notify().error("No active file");
					return;
				}

				try {
					// Open panel so user can see cards streaming in
					await this.activateView();

					const result = await streamingService.generateStreaming(
						text,
						mode,
						file,
					);
					if (result.created === 0 && result.duplicates === 0) {
						notify().warning("No flashcards found in AI response");
					} else if (result.duplicates > 0) {
						notify().info(
							`Created ${result.created} flashcard(s), ${result.duplicates} duplicate(s) skipped`,
						);
					} else {
						notify().info(`Created ${result.created} flashcard(s)`);
					}
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") return;
					const msg = error instanceof Error ? error.message : String(error);
					notify().error(`Flashcard generation failed: ${msg}`);
				}
			},
			onEdit: (text) => {
				const file = this.app.workspace.getActiveFile();
				const modal = new SimpleFlashcardEditorModal(
					this.app,
					{
						mode: "add",
						prefillContent: text,
						currentFilePath: file?.path ?? "",
					},
					this.EmbeddableEditor,
				);
				void modal.openAndWait().then((result) => {
					if (!result.cancelled && result.flashcards.length > 0 && file) {
						void this.flashcardManager
							.saveFlashcardsToSql(file, result.flashcards, undefined, text)
							.then((batchResult) => {
								notify().info(
									`Created ${batchResult.created.length} flashcard(s)`,
								);
							});
					}
				});
			},
			onQuickAdd: async (text) => {
				try {
					const file = this.app.workspace.getActiveFile();
					if (!file) {
						notify().error("No active file");
						return;
					}
					const parts = text.split(/\n\s*\n/);
					const question = (parts[0] ?? text).trim();
					const answer = parts.slice(1).join("\n\n").trim();
					await this.flashcardManager.saveFlashcardsToSql(
						file,
						[{ id: crypto.randomUUID(), question, answer }],
						undefined,
						text,
					);
					notify().info("Quick-added 1 flashcard");
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					notify().error(`Quick add failed: ${msg}`);
				}
			},
			hasApiKey: () => !!this.settings.openRouterApiKey,
			isEnabled: () => this.settings.selectionToolbarEnabled,
		});

		this.registerEditorExtension([extension]);

		// Source text highlight extension (Card → Text jump)
		void import("@features/study/ui/editor/SourceHighlightPlugin").then(
			({ createSourceHighlightExtension }) => {
				this.registerEditorExtension(
					createSourceHighlightExtension(
						() => this.app.workspace.getActiveFile()?.path,
					),
				);
			},
		);
	}

	private async initializeNLQueryService(): Promise<void> {
		if (!this.cardStore || !this.settings.openRouterApiKey) {
			return;
		}

		try {
			const db = this.cardStore.getDatabase();
			if (!db) {
				return;
			}

			const sqlAdapter = new SqlQueryAdapter(db);
			this.nlQueryService = new NLQueryService(
				{
					apiKey: this.settings.openRouterApiKey,
					model: this.settings.aiModel,
				},
				sqlAdapter,
			);

			await this.nlQueryService.initialize();
		} catch {
			// NL Query Service initialization is non-critical
		}
	}

	async createMasterDashboard(): Promise<void> {
		const fileName = "True Recall Dashboard.md";
		let file = this.app.vault.getAbstractFileByPath(fileName);

		if (!file) {
			const content = [
				"---",
				"cssclasses:",
				"  - true-recall-dashboard-note",
				"---",
				"",
				"# True Recall Dashboard",
				"",
				"## Today",
				"",
				"```true-recall-dashboard",
				"```",
				"",
				"## Streak",
				"",
				"```true-recall-streak",
				"showWeekDots: true",
				"showTodayRate: true",
				"```",
				"",
				"## Activity",
				"",
				"```true-recall-heatmap",
				"months: 6",
				"```",
				"",
				"## Projects",
				"",
				"```true-recall-project-hub",
				"```",
				"",
				"## Workload",
				"",
				"```true-recall-workload",
				"days: 14",
				"showTime: true",
				"```",
				"",
				"## Health",
				"",
				"```true-recall-health",
				"target: 90",
				"showBuckets: true",
				"```",
				"",
			].join("\n");

			file = await this.app.vault.create(fileName, content);
		}

		await this.app.workspace.openLinkText(fileName, "", false);
	}

	async setFsrsPresetForCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const presetNames = this.settings.fsrsPresets.map((p) => p.name);
		const currentValues = this.frontmatterIndex.getValues(
			"fsrs_preset",
			file.path,
		);
		const currentPreset =
			currentValues.length > 0 ? (currentValues[0] ?? null) : null;

		const modal = new SetPresetModal(this.app, presetNames, currentPreset);
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		const frontmatterService = this.flashcardManager.getFrontmatterService();
		await frontmatterService.setFsrsPreset(file, result.presetName);

		if (result.presetName) {
			notify().success(`FSRS preset set to: ${result.presetName}`);
		} else {
			notify().info("FSRS preset override removed (using default)");
		}
	}

	private async runAutoBackup(): Promise<void> {
		if (!this.backupService) return;

		try {
			await this.backupService.createBackup();

			if (this.settings.maxBackups > 0) {
				await this.backupService.pruneBackups(this.settings.maxBackups);
			}
		} catch {
			// Auto-backup failure is non-critical
		}
	}

	async createManualBackup(): Promise<void> {
		if (!this.backupService) {
			notify().error("Backup service not available");
			return;
		}

		try {
			const backupPath = await this.backupService.createBackup();
			const filename = backupPath.split("/").pop();
			notify().success(`Backup created: ${filename}`);

			if (this.settings.maxBackups > 0) {
				await this.backupService.pruneBackups(this.settings.maxBackups);
			}
		} catch (error) {
			console.error("[True Recall] Manual backup failed:", error);
			notify().error("Failed to create backup. Check console for details.");
		}
	}

	async openRestoreBackupModal(): Promise<void> {
		if (!this.backupService) {
			notify().error("Backup service not available");
			return;
		}

		const backups = await this.backupService.listBackups();
		if (backups.length === 0) {
			notify().info("No backups available");
			return;
		}

		const modal = new RestoreBackupModal(this.app, {
			backups,
			backupService: this.backupService,
		});

		await modal.openAndWait();
	}

	// Cloud sync - coming soon
	// async syncCloud(): Promise<void> {
	// 	if (!this.syncService?.isAvailable()) {
	// 		notify().error(
	// 			"Cloud sync not available. Check Supabase configuration."
	// 		);
	// 		return;
	// 	}
	//
	// 	notify().info("Syncing...");
	// 	const result = await this.syncService.sync();
	//
	// 	if (result.success) {
	// 		notify().success(
	// 			`Sync complete: ${result.pulled} pulled, ${result.pushed} pushed`
	// 		);
	// 	} else {
	// 		notify().error(`Sync failed: ${result.error}`);
	// 	}
	// }

	async importAnki(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const modal = new AnkiImportModal(
			this.app,
			this.cardStore,
			this.fsrsService,
		);
		modal.open();
	}

	async exportAnki(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const modal = new AnkiExportModal(
			this.app,
			this.cardStore,
			this.fsrsService,
		);
		modal.open();
	}

	async exportCsv(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const modal = new CsvExportModal(this.app, this.cardStore);
		modal.open();
	}

	async addFlashcardUidToCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const frontmatterService = this.flashcardManager.getFrontmatterService();

		const existingUid = await frontmatterService.getSourceNoteUid(file);
		if (existingUid) {
			notify().info(`Note already has flashcard UID: ${existingUid}`);
			return;
		}

		const newUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(file, newUid);

		notify().success(`Added flashcard UID: ${newUid}`);
	}

	// Cloud sync - coming soon
	// async forceReplaceCloud(): Promise<void> {
	// 	if (!this.syncService?.isAvailable()) {
	// 		notify().error(
	// 			"Cloud sync not available. Check Supabase configuration."
	// 		);
	// 		return;
	// 	}
	//
	// 	const confirmed = confirm(
	// 		"WARNING: This will DELETE all your data on the server and replace it with your local database.\n\n" +
	// 			"Other devices will lose their changes.\n\n" +
	// 			"Are you sure you want to continue?"
	// 	);
	//
	// 	if (!confirmed) return;
	//
	// 	notify().info("Replacing all server data...");
	// 	const result = await this.syncService.forceReplace();
	//
	// 	if (result.success) {
	// 		notify().success(
	// 			`Force replace complete: ${result.pushed} records uploaded`
	// 		);
	// 	} else {
	// 		notify().error(`Replace failed: ${result.error}`);
	// 	}
	// }
}
