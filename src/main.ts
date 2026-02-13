import { Plugin, TFile } from "obsidian";
import {
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_STATS,
	VIEW_TYPE_SESSION,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_ORPHANED_CARDS,
	VIEW_TYPE_NOTE_HUB,
	VIEW_TYPE_CARD_BROWSER,
} from "./constants";
import { normalizePath } from "obsidian";
import {
	FlashcardManager,
	FSRSService,
	StatsService,
	SessionPersistenceService,
	SqliteStoreService,
	DayBoundaryService,
	BackupService,
	DeviceIdService,
	DeviceDiscoveryService,
	// Cloud sync - coming soon
	// AuthService,
	// SyncService,
	FrontmatterIndexService,
	DeletionHandlerService,
	OrphanedCardsService,
	notify,
	UndoService,
} from "./services";
import { NoteStatusCacheService } from "./services/cache/note-status-cache.service";
import { createLinkStatusViewPlugin, createLinkStatusPostProcessor } from "./ui/editor";
import { BackgroundBackupManager } from "./services/persistence/background-backup.service";
import { FSRSHelperService } from "./services/fsrs-helper";
import { PresetService } from "./services/core/preset.service";
import {
	DB_FOLDER,
	getDeviceDbFilename,
} from "./services/persistence/sqlite/sqlite.types";
import { NLQueryService } from "./services/ai/nl-query.service";
import { settingsVersion } from "./services/core/signals";
import { SqlJsAdapter } from "./services/ai/langchain-sqlite.adapter";
import type { FSRSCardData } from "./types";
import { extractFSRSSettings } from "./types";
import { FlashcardPanelView } from "./ui/flashcard-panel/FlashcardPanelView";
import { ReviewView } from "./ui/review/ReviewView";
import { StatsView } from "./ui/stats/StatsView";
import { SessionView } from "./ui/session";
import { SimulatorView } from "./ui/simulator";
import { OrphanedCardsView } from "./ui/orphaned-cards";
import { NoteHubView } from "./ui/note-hub";
import { CardBrowserView } from "./ui/card-browser";
import {
	TrueRecallSettingTab,
	type TrueRecallSettings,
	DEFAULT_SETTINGS,
} from "./ui/settings";
import {
	AddToProjectModal,
	RestoreBackupModal,
	DeviceSelectionModal,
	OrphanedCardsActionModal,
	MergeNotesModal,
	MergeNotesNameModal,
	AnkiImportModal,
	AnkiExportModal,
	CsvExportModal,
	SetPresetModal,
	type DeviceSelectionResult,
} from "./ui/modals";
import { CustomStudyModal, type CustomStudyModalScope } from "./ui/modals/CustomStudyModal";
import { MergeNotesService } from "./services/notes/merge-notes.service";
import { registerCommands } from "./plugin/PluginCommands";
import { registerEventHandlers, registerDeletionHandler } from "./plugin/PluginEventHandlers";
import { createAppStore, type AppStore } from "./state/store";
import {
	activateView,
	activateReviewView,
	getView,
	closeAllViews,
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
	orphanedCardsService: OrphanedCardsService | null = null;
	undoService: UndoService | null = null;
	fsrsHelper: FSRSHelperService | null = null;
	presetService!: PresetService;
	store: AppStore | null = null;
	noteStatusCache: NoteStatusCacheService | null = null;

	/**
	 * Assert that the card store is initialized and ready.
	 * Throws an error if called before initialization completes.
	 */
	private assertStoreReady(): asserts this is this & { cardStore: SqliteStoreService } {
		if (!this.cardStore) {
			throw new Error("Card store not initialized. Please wait for plugin to fully load.");
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
		this.frontmatterIndex.register({ field: "flashcard_uid", type: "string", unique: true });
		this.frontmatterIndex.register({ field: "projects", type: "array", unique: false });
		this.frontmatterIndex.register({ field: "fsrs_preset", type: "string", unique: false });
		this.frontmatterIndex.registerEvents(this);

		// Build index after metadataCache is fully loaded
		this.app.workspace.onLayoutReady(() => {
			this.frontmatterIndex.rebuildIndex();
		});

		this.flashcardManager = new FlashcardManager(this.app, this.settings, this.frontmatterIndex);

		this.presetService = new PresetService(
			() => this.settings,
			() => this.saveSettings(),
			this.frontmatterIndex
		);

		const fsrsSettings = extractFSRSSettings(this.settings);
		this.fsrsService = new FSRSService(fsrsSettings);
		this.statsService = new StatsService(
			this.flashcardManager,
			this.fsrsService,
		);


		this.dayBoundaryService = new DayBoundaryService(
			this.settings.dayStartHour
		);

		try {
			await this.initializeDeviceAndStore();
		} catch (error) {
			console.error("[True Recall] Critical: Device/store initialization failed:", error);
			notify().error("Failed to initialize database. Please restart Obsidian.");
		}

		this.registerView(
			VIEW_TYPE_FLASHCARD_PANEL,
			(leaf) => new FlashcardPanelView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_REVIEW,
			(leaf) => new ReviewView(leaf, this)
		);

		this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

		this.registerView(
			VIEW_TYPE_SESSION,
			(leaf) => new SessionView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_SIMULATOR,
			(leaf) => new SimulatorView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_ORPHANED_CARDS,
			(leaf) => new OrphanedCardsView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_NOTE_HUB,
			(leaf) => new NoteHubView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_CARD_BROWSER,
			(leaf) => new CardBrowserView(leaf, this)
		);

		// eslint-disable-next-line obsidianmd/ui/sentence-case -- True Recall is a proper noun
		this.addRibbonIcon("brain", "True Recall - study", () => {
			this.startReviewSession().catch((error) => {
				notify().error("Failed to start review session", error);
			});
		});

		// eslint-disable-next-line obsidianmd/ui/sentence-case -- True Recall is a proper noun
		this.addRibbonIcon("bar-chart-2", "True Recall - statistics", () => {
			this.openStatsView().catch((error) => {
				notify().error("Failed to open statistics view", error);
			});
		});

		// eslint-disable-next-line obsidianmd/ui/sentence-case -- True Recall is a proper noun
		this.addRibbonIcon("layout-grid", "True Recall - note hub", () => {
			this.openNoteHub().catch((error) => {
				notify().error("Failed to open note hub", error);
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

		this.orphanedCardsService = new OrphanedCardsService();
		this.deletionHandler = new DeletionHandlerService({
			app: this.app,
			frontmatterIndex: this.frontmatterIndex,
			store: this.cardStore,
			onOrphanedCards: async (context) => {
				const modal = new OrphanedCardsActionModal(this.app, {
					cards: context.cards,
					deletedNoteName: context.deletedNoteName,
					sourceUid: context.sourceUid,
				});

				const result = await modal.openAndWait();

				if (result.cancelled || result.action === "leave_orphaned") {
					return; 
				}

				if (result.action === "delete") {
					const cardIds = context.cards.map((c) => c.id);
					this.cardStore.cards.bulkSoftDelete(cardIds);
					notify().cardsDeleted(cardIds.length);
				} else if (result.action === "move" && result.targetNotePath) {
					await this.moveCardsToNote(context.cards, result.targetNotePath);
				} else if (result.action === "create_note" && result.newNotePath) {
					await this.createNoteForOrphanedCards(
						context.cards,
						result.newNotePath,
						context.deletedNoteName
					);
				}
			},
		});

		registerDeletionHandler(this, this.deletionHandler);
	}

	private async moveCardsToNote(
		cards: FSRSCardData[],
		targetNotePath: string
	): Promise<void> {
		const targetFile = this.app.vault.getAbstractFileByPath(targetNotePath);
		if (!(targetFile instanceof TFile)) {
			notify().error("Target note not found");
			return;
		}

		const frontmatterService = this.flashcardManager.getFrontmatterService();
		let targetUid = await frontmatterService.getSourceNoteUid(targetFile);
		if (!targetUid) {
			targetUid = frontmatterService.generateUid();
			await frontmatterService.setSourceNoteUid(targetFile, targetUid);
		}

		for (const card of cards) {
			this.cardStore.cards.updateCardSourceUid(card.id, targetUid);
		}

		notify().cardsMoved(cards.length, targetFile.basename);
	}

	private async createNoteForOrphanedCards(
		cards: FSRSCardData[],
		newNotePath: string,
		originalNoteName: string
	): Promise<void> {
		const frontmatterService = this.flashcardManager.getFrontmatterService();
		const newUid = frontmatterService.generateUid();

		const cardList = cards
			.slice(0, 10)
			.map((c) => `- ${(c.question ?? "").slice(0, 80)}${(c.question ?? "").length > 80 ? "..." : ""}`)
			.join("\n");

		const moreText = cards.length > 10
			? `\n- ... and ${cards.length - 10} more cards`
			: "";

		const content = `---
flashcard_uid: ${newUid}
tags:
  - recovered
---

# Recovered from "${originalNoteName}"

This note was created to recover flashcards from a deleted note.

## Cards

${cardList}${moreText}
`;

		await this.app.vault.create(newNotePath, content);
		for (const card of cards) {
			this.cardStore.cards.updateCardSourceUid(card.id, newUid);
		}

		notify().success(`Created note with ${cards.length} recovered flashcard${cards.length === 1 ? "" : "s"}`);
	}

	onunload(): void {
		this.undoService?.clear();
		this.backgroundBackupManager?.stop();
		this.noteStatusCache?.dispose();

		if (this.cardStore) {
			void this.cardStore.saveNow();
		}

	}

	async loadSettings(): Promise<void> {
		const rawData = (await this.loadData()) as Partial<TrueRecallSettings> | null;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			rawData
		);

		if (Array.isArray(this.settings.easyDays)) {
			this.settings.easyDays = {
				recurringDays: this.settings.easyDays as unknown as number[],
				specificDates: [],
			};
		}

		// Migrate global FSRS settings → Default preset for existing users
		if (!rawData?.fsrsPresets) {
			this.settings.fsrsPresets = [{
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
				lastOptimizationReviewCount: this.settings.lastOptimizationReviewCount,
				lastOptimizationMetrics: this.settings.lastOptimizationMetrics,
			}];
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
			this.dayBoundaryService.updateDayStartHour(
				this.settings.dayStartHour
			);
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

	async activateSessionView(
		currentNoteName: string | null,
		allCards: import("./types").FSRSFlashcardItem[],
		onSessionSelected: (result: import("./types/events.types").SessionResult) => void
	): Promise<void> {
		const leaf = await activateView(this.app, VIEW_TYPE_SESSION);

		if (leaf) {
			const view = leaf.view as SessionView;
			view.initialize({
				currentNoteName,
				allCards,
				dayBoundaryService: this.dayBoundaryService,
				onSessionSelected,
			});
		}
	}

	async openSimulator(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_SIMULATOR, { useMainArea: true });
	}

	async openOrphanedCardsView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_ORPHANED_CARDS);
	}

	async openNoteHub(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_NOTE_HUB, { useMainArea: true });
	}

	async openCardBrowser(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_CARD_BROWSER, { useMainArea: true });
	}

	async startReviewSession(): Promise<void> {
		const existingLeaf = getView(this.app, VIEW_TYPE_REVIEW);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		await this.openNewReviewSession();
	}


	async startNewReviewSession(): Promise<void> {
		closeAllViews(this.app, VIEW_TYPE_REVIEW);

		await new Promise((resolve) => setTimeout(resolve, 0));
		await this.openNewReviewSession();
	}

	private async openNewReviewSession(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error("Database not ready. Please wait for plugin to fully load.");
			return;
		}
		const allCards = this.flashcardManager.getAllFSRSCards();
		if (allCards.length === 0) {
			notify().info("No flashcards found. Generate some flashcards first!");
			return;
		}

		const currentFile = this.app.workspace.getActiveFile();
		const currentNoteName = currentFile ? currentFile.basename : null;

		return new Promise<void>((resolve) => {
			void this.activateSessionView(currentNoteName, allCards, (result) => {
				void this.handleSessionResult(result);
				resolve();
			});
		});
	}

	private async handleSessionResult(
		result: import("./types/events.types").SessionResult
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
			projectFilters: result.projectFilters,
			crammingMode: result.crammingMode,
		});
	}

	private async openReviewView(deckFilter: string | null): Promise<void> {
		await activateReviewView(
			this.app,
			VIEW_TYPE_REVIEW,
			this.settings.reviewMode,
			{ deckFilter }
		);
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
		const modal = new CustomStudyModal(this.app, {
			title: scope?.scopeLabel ? `Custom study — ${scope.scopeLabel}` : "Custom study",
			width: "480px",
		}, scope);
		const result = await modal.openAndWait();
		if (result.cancelled || !result.sessionResult) return;

		if (result.saveAsPreset && result.presetName) {
			const preset: import("./types/settings.types").SessionPreset = {
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
				projectFilters: result.sessionResult.projectFilters,
			};
			this.settings.sessionPresets = [
				...this.settings.sessionPresets,
				preset,
			];
			await this.saveSettings();
			notify().success(`Preset "${result.presetName}" saved`);
		}

		await this.handleSessionResult(result.sessionResult);
	}

	async reviewCurrentNote(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error("Database not ready. Please wait for plugin to fully load.");
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
			(c) => c.sourceNoteName === file.basename
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

	async reviewTodaysCards(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error("Database not ready. Please wait for plugin to fully load.");
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
		difficultyRange?: { min: number; max: number };
		lapsesRange?: { min: number; max: number };
		stabilityRange?: { min: number; max: number };
		overdueOnly?: boolean;
		recentlyFailed?: boolean;
		cardLimit?: number;
		studyAheadDays?: number;
		reviewOrder?: import("./types/settings.types").ReviewOrder;
		projectFilters?: string[];
		crammingMode?: boolean;
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
			difficultyRange: filters.difficultyRange,
			lapsesRange: filters.lapsesRange,
			stabilityRange: filters.stabilityRange,
			overdueOnly: filters.overdueOnly,
			recentlyFailed: filters.recentlyFailed,
			cardLimit: filters.cardLimit,
			studyAheadDays: filters.studyAheadDays,
			reviewOrder: filters.reviewOrder,
			projectFilters: filters.projectFilters,
			crammingMode: filters.crammingMode,
		};

		await activateReviewView(
			this.app,
			VIEW_TYPE_REVIEW,
			this.settings.reviewMode,
			state
		);
	}

	private async initializeDeviceAndStore(): Promise<void> {
		try {
			const deviceId = await this.initializeDeviceContext();
			await this.initializeCardStore(deviceId);
		} catch (error) {
			console.error(
				"[True Recall] Failed to initialize device context:",
				error
			);
			notify().error(
				"Failed to initialize device context. Using default configuration."
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
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`
		);
		const deviceDbExists = await this.app.vault.adapter.exists(
			deviceDbPath
		);

		if (deviceDbExists) {
			return deviceId;
		}

		const databases = await this.deviceDiscovery.discoverDeviceDatabases();
		const hasLegacy = await this.deviceDiscovery.hasLegacyDatabase();

		if (hasLegacy && databases.length === 0) {
			await this.migrateLegacyDatabase(deviceId);
		} else if (databases.length > 0) {
			const result = await this.showDeviceSelectionModal(
				databases,
				hasLegacy
			);
			if (!result.cancelled) {
				await this.handleDeviceSelection(result, deviceId);
			}
			
		}

		return deviceId;
	}

	private async migrateLegacyDatabase(deviceId: string): Promise<void> {
		const legacyPath = normalizePath(`${DB_FOLDER}/true-recall.db`);
		const newPath = normalizePath(
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`
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
		databases: import("./services").DeviceDatabaseInfo[],
		hasLegacy: boolean
	): Promise<DeviceSelectionResult> {
		const modal = new DeviceSelectionModal(this.app, {
			databases,
			hasLegacy,
		});
		return await modal.openAndWait();
	}

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

				notify().success(
					`Imported data from device ${result.sourceDeviceId}`
				);
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
				this.dayBoundaryService
			);

			await this.sessionPersistence.migrateStatsJsonToSql();
			this.backupService = new BackupService(this.app, this.cardStore);
			this.backgroundBackupManager = new BackgroundBackupManager(
				this.app,
				this.backupService,
				this.settings
			);

			if (this.settings.periodicBackupEnabled || this.settings.activityTriggeredBackup) {
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
		} catch (error) {
			console.error(
				"[True Recall] Failed to initialize SQLite store:",
				error
			);
			notify().error(
				"Failed to load flashcard data. Please restart Obsidian."
			);
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
		this.app.workspace.onLayoutReady(() => {
			this.noteStatusCache!.buildFromStore();
			this.noteStatusCache!.registerEvents();
		});

		const onReviewNote = (file: TFile) => {
			this.reviewNoteFlashcards(file).catch((error) => {
				notify().error("Failed to start review session", error);
			});
		};

		const viewPlugin = createLinkStatusViewPlugin(
			this.app,
			this.noteStatusCache,
			this.frontmatterIndex,
			() => this.settings.showLinkStatusIndicators,
			onReviewNote,
		);
		this.registerEditorExtension([viewPlugin]);

		const postProcessor = createLinkStatusPostProcessor(
			this.app,
			this.noteStatusCache,
			this.frontmatterIndex,
			() => this.settings.showLinkStatusIndicators,
			onReviewNote,
		);
		this.registerMarkdownPostProcessor(postProcessor);
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

			const sqlAdapter = new SqlJsAdapter(db);
			this.nlQueryService = new NLQueryService(
				{
					apiKey: this.settings.openRouterApiKey,
					model: this.settings.aiModel,
				},
				sqlAdapter
			);

			await this.nlQueryService.initialize();
		} catch {
			// NL Query Service initialization is non-critical
		}
	}

	async addCurrentNoteToProject(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const frontmatterService =
			this.flashcardManager.getFrontmatterService();

		const content = await this.app.vault.read(file);
		const currentProjects =
			frontmatterService.extractProjectsFromFrontmatter(content);

		const allProjectsSet = this.frontmatterIndex
			? this.frontmatterIndex.getAllValues("projects")
			: new Set<string>();
		const allProjects = Array.from(allProjectsSet).sort();

		const modal = new AddToProjectModal(this.app, {
			availableProjects: allProjects,
			currentProjects: currentProjects,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		await frontmatterService.setProjectsInFrontmatter(
			file,
			result.projects
		);

		if (result.projects.length > 0) {
			notify().success(`Projects updated: ${result.projects.join(", ")}`);
		} else {
			notify().info("Removed all projects from note");
		}
	}

	async setFsrsPresetForCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const presetNames = this.settings.fsrsPresets.map(p => p.name);
		const currentValues = this.frontmatterIndex.getValues("fsrs_preset", file.path);
		const currentPreset = currentValues.length > 0 ? currentValues[0]! : null;

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

	async createProjectFromNote(file: TFile): Promise<void> {
		const projectName = file.basename;
		const frontmatterService =
			this.flashcardManager.getFrontmatterService();

		if (this.frontmatterIndex) {
			const existingProjects = this.frontmatterIndex.getAllValues("projects");
			const projectExists = Array.from(existingProjects).some(
				(p) => p.toLowerCase() === projectName.toLowerCase()
			);
			if (projectExists) {
				notify().warning(`Project "${projectName}" already exists`);
				return;
			}
		}

		let sourceUid = await frontmatterService.getSourceNoteUid(file);
		if (!sourceUid) {
			sourceUid = frontmatterService.generateUid();
			await frontmatterService.setSourceNoteUid(file, sourceUid);
		}

		await frontmatterService.setProjectsInFrontmatter(file, [projectName]);

		notify().success(`Project "${projectName}" created`);
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
				await this.backupService.pruneBackups(
					this.settings.maxBackups
				);
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
			notify().error("Database not ready. Please wait for plugin to fully load.");
			return;
		}

		const modal = new AnkiImportModal(this.app, this.cardStore, this.fsrsService);
		modal.open();
	}

	async exportAnki(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error("Database not ready. Please wait for plugin to fully load.");
			return;
		}

		const modal = new AnkiExportModal(this.app, this.cardStore, this.fsrsService, this.frontmatterIndex);
		modal.open();
	}

	async exportCsv(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error("Database not ready. Please wait for plugin to fully load.");
			return;
		}

		const modal = new CsvExportModal(this.app, this.cardStore, this.frontmatterIndex);
		modal.open();
	}

	async addFlashcardUidToCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const frontmatterService =
			this.flashcardManager.getFrontmatterService();

		const existingUid = await frontmatterService.getSourceNoteUid(file);
		if (existingUid) {
			notify().info(`Note already has flashcard UID: ${existingUid}`);
			return;
		}

		const newUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(file, newUid);

		notify().success(`Added flashcard UID: ${newUid}`);
	}

	async mergeNotes(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error("Database not ready. Please wait for plugin to fully load.");
			return;
		}

		const frontmatterService = this.flashcardManager.getFrontmatterService();
		const cardRepository = (this.flashcardManager as unknown as { cardRepository: import("./services/flashcard/card-repository.service").CardRepository }).cardRepository;

		if (!cardRepository) {
			notify().error("Card repository not initialized");
			return;
		}

		const mergeService = new MergeNotesService(
			this.app,
			this.cardStore,
			frontmatterService,
			cardRepository
		);

		const modal = new MergeNotesModal(this.app, { mergeService });
		const result = await modal.openAndWait();

		if (result.cancelled) return;

		const mergeResult = await mergeService.mergeNotes({
			sourceNotes: result.selectedNotes,
			newNoteName: result.newNoteName,
		});

		if (mergeResult.success) {
			notify().success(
				`Merged ${result.selectedNotes.length} notes into "${result.newNoteName}" (${mergeResult.cardsMoved} flashcards moved)`
			);

			if (mergeResult.mergedNote) {
				await this.app.workspace.openLinkText(
					mergeResult.mergedNote.path,
					"",
					true
				);
			}
		} else {
			notify().error(`Merge failed: ${mergeResult.errors.join(", ")}`);
		}
	}

	async mergeSelectedNotes(files: TFile[]): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error("Database not ready. Please wait for plugin to fully load.");
			return;
		}

		if (files.length < 2) {
			notify().error("Select at least 2 notes to merge");
			return;
		}

		const frontmatterService = this.flashcardManager.getFrontmatterService();
		const cardRepository = (this.flashcardManager as unknown as { cardRepository: import("./services/flashcard/card-repository.service").CardRepository }).cardRepository;

		if (!cardRepository) {
			notify().error("Card repository not initialized");
			return;
		}

		const mergeService = new MergeNotesService(
			this.app,
			this.cardStore,
			frontmatterService,
			cardRepository
		);

		// Count total cards for selected files
		let totalCards = 0;
		for (const file of files) {
			totalCards += mergeService.getCardCountForNote(file);
		}

		// Show simple modal for name only
		const modal = new MergeNotesNameModal(this.app, {
			files,
			totalCards,
		});
		const result = await modal.openAndWait();

		if (result.cancelled) return;

		const mergeResult = await mergeService.mergeNotes({
			sourceNotes: files,
			newNoteName: result.newNoteName,
		});

		if (mergeResult.success) {
			notify().success(
				`Merged ${files.length} notes into "${result.newNoteName}" (${mergeResult.cardsMoved} flashcards moved)`
			);

			if (mergeResult.mergedNote) {
				await this.app.workspace.openLinkText(
					mergeResult.mergedNote.path,
					"",
					true
				);
			}
		} else {
			notify().error(`Merge failed: ${mergeResult.errors.join(", ")}`);
		}
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
