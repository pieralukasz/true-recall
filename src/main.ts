import { StreamingGenerationService } from "@features/ai/services/streaming-generation.service";
import { createSelectionToolbarExtension } from "@features/ai/ui/editor/SelectionToolbarPlugin";
import { NoteStatusCacheService } from "@features/core/cache/note-status-cache.service";
import { CardTypesEditorModal } from "@features/core/modals/card-types-editor/CardTypesEditorModal";
import { NoteTypeSuggestModal } from "@features/core/modals/card-types-editor/NoteTypeSuggestModal";
import { ImportStudioModal } from "@features/core/modals/import-studio/ImportStudioModal";
import { BackgroundBackupManager } from "@features/core/persistence/background-backup.service";
import { BackupService } from "@features/core/persistence/backup.service";
import { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import { SqliteStoreService } from "@features/core/persistence/sqlite";
import {
	DB_FOLDER,
	getDeviceDbFilename,
	SAFETY_FLUSH_INTERVAL_MS,
} from "@features/core/persistence/sqlite/sqlite.types";
import { DayBoundaryService } from "@features/core/services/day-boundary.service";
import { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import { FSRSService } from "@features/core/services/fsrs.service";
import { HierarchyService } from "@features/core/services/hierarchy.service";
import { NoteTypeService } from "@features/core/services/note-type.service";
import { PresetService } from "@features/core/services/preset.service";
import { IOEditorModal } from "@features/image-occlusion/IOEditorModal";
import type {
	IOEditorMode,
	IOEditorResult,
} from "@features/image-occlusion/types";
import { AnkiExportModal } from "@features/integration/modals/AnkiExportModal";
import { AnkiImportModal } from "@features/integration/modals/AnkiImportModal";
import { CsvExportModal } from "@features/integration/modals/CsvExportModal";
import {
	DeviceSelectionModal,
	type DeviceSelectionResult,
} from "@features/integration/modals/DeviceSelectionModal";
import { DeviceDiscoveryService } from "@features/integration/services/device-discovery.service";
import { DeviceIdService } from "@features/integration/services/device-id.service";
import { AuthService } from "@features/integration/services/sync/auth.service";
import { FlashcardPanelView } from "@features/library/ui/panel/FlashcardPanelView";
import { FSRSHelperService } from "@features/metrics/services/fsrs-tools";
import { SimulatorView } from "@features/metrics/ui/simulator";
import {
	DEFAULT_SETTINGS,
	type TrueRecallSettings,
	TrueRecallSettingTab,
} from "@features/settings";
import {
	CustomStudyModal,
	type CustomStudyModalScope,
} from "@features/study/modals/CustomStudyModal";
import { QuickNoteEditorModal } from "@features/study/modals/quick-note-editor/QuickNoteEditorModal";
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
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import {
	initCardStore,
	initMetadataStore,
	refreshCards,
	refreshMetadata,
	refreshSettings,
} from "@shared/services/reactive-card-store";
import { UndoService } from "@shared/services/undo.service";
import { type AppStore, createAppStore } from "@shared/store";
import { extractFSRSSettings } from "@shared/types";
import { BUILTIN_BASIC_ID, type NoteType } from "@shared/types/note.types";
import { PresetInspectorModal } from "@shared/ui/modals";
import { isDesktop } from "@shared/utils/platform";
import { normalizePath, Plugin, type TFile } from "obsidian";
import { BackupRecoveryManager } from "./plugin/BackupRecoveryManager";
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
	sessionPersistence!: SessionPersistenceService;
	cardStore!: SqliteStoreService;
	dayBoundaryService!: DayBoundaryService;
	frontmatterIndex!: FrontmatterIndexService;
	backupService: BackupService | null = null;
	backgroundBackupManager: BackgroundBackupManager | null = null;
	deviceIdService: DeviceIdService | null = null;
	deviceDiscovery: DeviceDiscoveryService | null = null;
	deletionHandler: DeletionHandlerService | null = null;
	undoService: UndoService | null = null;
	fsrsHelper: FSRSHelperService | null = null;
	presetService!: PresetService;
	noteTypeService!: NoteTypeService;
	hierarchyService!: HierarchyService;
	authService: AuthService | null = null;
	store: AppStore | null = null;
	noteStatusCache: NoteStatusCacheService | null = null;
	statusBarWidget: StatusBarWidget | null = null;
	backupRecovery: BackupRecoveryManager | null = null;
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

		this.authService = new AuthService();

		this.registerObsidianProtocolHandler("true-recall-auth", (params) => {
			this.handleAuthCallback(params).catch((err) => {
				notify().error(
					err instanceof Error ? err.message : "Auth callback failed",
				);
			});
		});

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
			field: "parents",
			type: "array",
			unique: false,
		});
		this.frontmatterIndex.register({
			field: "include",
			type: "string",
			unique: false,
		});
		this.frontmatterIndex.register({
			field: "archive",
			type: "string",
			unique: false,
		});
		this.frontmatterIndex.onFieldChange("parents", () => {
			this.hierarchyService.invalidateGraph();
			refreshMetadata();
		});
		this.frontmatterIndex.onFieldChange("include", () => {
			this.hierarchyService.invalidateGraph();
			refreshMetadata();
		});
		this.frontmatterIndex.onFieldChange("archive", () => refreshMetadata());
		this.frontmatterIndex.onFieldChange("fsrs_preset", () => refreshMetadata());
		this.frontmatterIndex.registerEvents(this);

		this.hierarchyService = new HierarchyService(
			this.app,
			this.frontmatterIndex,
		);
		initMetadataStore(this.hierarchyService);

		// Build index after metadataCache is fully loaded.
		// Must be AFTER initMetadataStore so refreshMetadata() can populate archivedSourceUids.
		// onLayoutReady fires synchronously if layout is already ready.
		this.app.workspace.onLayoutReady(() => {
			this.frontmatterIndex.rebuildIndex();
			this.hierarchyService.invalidateGraph();
			refreshMetadata();
			refreshCards();
			this.checkForWhatsNew().catch(() => {});
		});

		this.flashcardManager = new FlashcardManager(
			this.app,
			this.settings,
			this.frontmatterIndex,
		);

		this.presetService = new PresetService(
			() => this.settings,
			() => this.saveSettings(),
			this.frontmatterIndex,
			this.hierarchyService,
			() => this.cardStore ?? null,
		);

		const fsrsSettings = extractFSRSSettings(this.settings);
		this.fsrsService = new FSRSService(fsrsSettings);
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

		this.registerView(
			VIEW_TYPE_SIMULATOR,
			(leaf) => new SimulatorView(leaf, this),
		);

		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => {
			const { DashboardView } =
				require("@features/study/ui/dashboard/DashboardView") as {
					DashboardView: typeof import("@features/study/ui/dashboard/DashboardView").DashboardView;
				};
			return new DashboardView(leaf, this);
		});

		this.addRibbonIcon("layout-dashboard", "True Recall - dashboard", () => {
			this.openDashboard().catch((error) => {
				notify().error("Failed to open dashboard", error);
			});
		});

		this.registerView(VIEW_TYPE_CARD_BROWSER, (leaf) => {
			const { CardBrowserView } =
				require("@features/library/ui/browser/CardBrowserView") as {
					CardBrowserView: typeof import("@features/library/ui/browser/CardBrowserView").CardBrowserView;
				};
			return new CardBrowserView(leaf, this);
		});

		this.registerView(VIEW_TYPE_STATS, (leaf) => {
			const { StatsView } = require("@features/metrics/ui/stats") as {
				StatsView: typeof import("@features/metrics/ui/stats").StatsView;
			};
			return new StatsView(leaf, this);
		});

		registerCommands(this);
		this.addSettingTab(new TrueRecallSettingTab(this.app, this));
		registerEventHandlers(this);

		this.undoService = new UndoService(this);
	}

	private initializeDeletionHandler(): void {
		if (!this.cardStore || !this.frontmatterIndex || !this.sessionPersistence)
			return;

		this.deletionHandler = new DeletionHandlerService({
			frontmatterIndex: this.frontmatterIndex,
			store: this.cardStore,
			sessionPersistence: this.sessionPersistence,
		});

		registerDeletionHandler(this, this.deletionHandler);

		const uidGuardian = new UidGuardianService({
			app: this.app,
			frontmatterIndex: this.frontmatterIndex,
			store: this.cardStore,
			sessionPersistence: this.sessionPersistence,
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
			void this.cardStore.saveNow({ bestEffort: true });
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

		// Backfill new preset fields for existing presets
		if (this.settings.fsrsPresets) {
			for (const preset of this.settings.fsrsPresets) {
				preset.leechThreshold ??= 8;
				preset.leechAction ??= "tag-only";
				preset.newCardOrder ??= this.settings.newCardOrder;
				preset.reviewOrder ??= this.settings.reviewOrder;
				preset.newReviewMix ??= this.settings.newReviewMix;
			}
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

		refreshSettings(this.settings);
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
		this.noteStatusCache?.bumpVersion();
		this.hierarchyService.invalidateGraph();

		refreshSettings(this.settings);
	}

	private async handleAuthCallback(
		params: Record<string, string>,
	): Promise<void> {
		const { code, error } = params;

		if (error) {
			notify().error("Authentication failed. Please try again.");
			return;
		}

		if (!code) {
			notify().error("Invalid auth callback — missing code.");
			return;
		}

		if (!this.authService) {
			notify().error("Auth service not available.");
			return;
		}

		const result = await this.authService.exchangeCodeForSession(code);
		if (result.success) {
			notify().success("Signed in successfully!");
		} else {
			notify().error(result.error ?? "Failed to complete sign-in.");
		}
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

	async openCardBrowser(opts?: {
		sourceUid?: string;
		orphaned?: boolean;
	}): Promise<void> {
		const state = opts?.sourceUid
			? { sourceUid: opts.sourceUid }
			: opts?.orphaned
				? { orphaned: true }
				: undefined;

		const existingLeaf = getView(this.app, VIEW_TYPE_CARD_BROWSER);
		if (existingLeaf) {
			if (state) {
				await existingLeaf.setViewState({
					type: VIEW_TYPE_CARD_BROWSER,
					active: true,
					state,
				});
			}
			void this.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.app, VIEW_TYPE_CARD_BROWSER, {
			useMainArea: true,
			state,
		});
	}

	async openDashboard(): Promise<void> {
		const existingLeaf = getView(this.app, VIEW_TYPE_DASHBOARD);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.app, VIEW_TYPE_DASHBOARD, { useMainArea: true });
	}

	async openStats(): Promise<void> {
		const existingLeaf = getView(this.app, VIEW_TYPE_STATS);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.app, VIEW_TYPE_STATS, { useMainArea: true });
	}

	openCardTypesEditor(noteTypeId?: string): void {
		if (noteTypeId) {
			new CardTypesEditorModal(this.app, this, noteTypeId).open();
			return;
		}
		new NoteTypeSuggestModal(this.app, this).open();
	}

	openImportStudio(options?: { defaultNoteTypeId?: string }): void {
		new ImportStudioModal(this.app, this, options).open();
	}

	openQuickNoteEditor(defaultNoteTypeId?: string): void {
		new QuickNoteEditorModal(this.app, this, {
			mode: "add",
			defaultNoteTypeId,
		}).open();
	}

	async openImageOcclusionEditor(
		mode: IOEditorMode = { mode: "add" },
	): Promise<IOEditorResult> {
		if (!isDesktop()) {
			notify().warning("Image occlusion editor is available on desktop only.");
			return { cancelled: true };
		}

		const modal = new IOEditorModal(this.app, this, mode);
		return await modal.openAndWait();
	}

	async openImageOcclusionEditorForActiveNote(): Promise<IOEditorResult> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			return await this.openImageOcclusionEditor({ mode: "add" });
		}

		try {
			const frontmatterService = this.flashcardManager.getFrontmatterService();
			let sourceUid = await frontmatterService.getSourceNoteUid(activeFile);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(activeFile, sourceUid);
			}
			return await this.openImageOcclusionEditor({
				mode: "add",
				sourceUid,
			});
		} catch (error) {
			notify().operationFailed("prepare image occlusion source", error);
			return await this.openImageOcclusionEditor({ mode: "add" });
		}
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
		const sourceUid = await this.flashcardManager
			.getFrontmatterService()
			.getSourceNoteUid(file);
		if (!sourceUid) {
			notify().info(`No flashcards found for "${file.basename}"`);
			return;
		}

		const allCards = this.flashcardManager.getAllFSRSCards();
		const noteCards = allCards.filter((c) => c.sourceUid === sourceUid);

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
			sourceUidFilter: sourceUid,
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
		sourceUidFilter?: string;
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
			sourceUidFilter: filters.sourceUidFilter,
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

	private async checkForWhatsNew(): Promise<void> {
		const currentVersion = this.manifest.version;
		if (this.settings.lastSeenVersion === currentVersion) return;

		// On fresh install there are no release notes to show — just mark version as seen.
		if (this.settings.lastSeenVersion === undefined) {
			this.settings.lastSeenVersion = currentVersion;
			await this.saveSettings();
			return;
		}

		const { fetchLatestRelease } = await import(
			"@shared/services/release-notes.service"
		);
		const release = await fetchLatestRelease();
		if (!release) return;

		if (release.version !== currentVersion) {
			this.settings.lastSeenVersion = currentVersion;
			await this.saveSettings();
			return;
		}

		const { WhatsNewModal } = await import("@shared/ui/modals/WhatsNewModal");
		new WhatsNewModal(this, release).open();
		this.settings.lastSeenVersion = currentVersion;
		await this.saveSettings();
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
			this.backupRecovery = new BackupRecoveryManager(
				this.app,
				() => this.backupService,
				() => this.backgroundBackupManager,
				() => this.cardStore,
			);

			this.cardStore = new SqliteStoreService(this.app, deviceId);

			try {
				await this.cardStore.load();
			} catch (loadError) {
				console.warn(
					"[True Recall] Database load failed, attempting auto-recovery from backup...",
				);
				const recovered =
					await this.backupRecovery.tryAutoRecoverFromBackup(deviceId);
				if (recovered) {
					this.cardStore = new SqliteStoreService(this.app, deviceId);
					await this.cardStore.load();
				} else {
					throw loadError;
				}
			}

			this.flashcardManager.setStore(this.cardStore);

			// Safety persistence: ensure dirty data is flushed regularly,
			// even if user exits before debounce timer fires.
			this.registerInterval(
				window.setInterval(() => {
					if (this.cardStore) {
						void this.cardStore.saveNow();
					}
				}, SAFETY_FLUSH_INTERVAL_MS),
			);

			// Reactive card store: cards signal mirrors SQLite, computeds derive all views
			initCardStore({
				getAll: () => this.flashcardManager.getAllFSRSCards(),
			});
			refreshCards();

			this.sessionPersistence = new SessionPersistenceService(
				this.app,
				this.cardStore,
				this.dayBoundaryService,
			);
			this.flashcardManager.setSessionPersistence(this.sessionPersistence);

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
				await this.backupRecovery.runAutoBackup();
			}

			this.noteTypeService = new NoteTypeService({
				noteTypeActions: this.cardStore.noteTypes,
				noteActions: {
					getByNoteTypeId: (id) => this.cardStore.notes.getByNoteTypeId(id),
					countByNoteType: (id) => this.cardStore.notes.countByNoteType(id),
				},
			});
			this.noteTypeService.initialize();

			this.fsrsHelper = new FSRSHelperService(this.cardStore, this.settings);
			this.initializeDeletionHandler();
			this.initializeStore();
			this.initializeLinkStatusIndicators();
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
			this.initializeStatusBar();

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
		void import("@features/study/ui/editor/widgets/StatusBarWidget").then(
			({ StatusBarWidget }) => {
				const statusBarEl = this.addStatusBarItem();
				this.statusBarWidget = new StatusBarWidget(
					statusBarEl,
					this.flashcardManager,
					() => {
						this.openDashboard().catch(() => {});
					},
					() => this.settings.showStatusBarWidget,
					{
						presetService: this.presetService,
						sessionPersistence: this.sessionPersistence,
					},
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

	private handleImageOcclusion(imagePath: string): void {
		const activeFile = this.app.workspace.getActiveFile();
		const resolved = this.app.metadataCache.getFirstLinkpathDest(
			imagePath,
			activeFile?.path ?? "",
		);
		const resolvedPath = resolved?.path ?? imagePath;

		if (activeFile && activeFile.extension === "md") {
			const frontmatterService = this.flashcardManager.getFrontmatterService();
			void (async () => {
				let sourceUid = await frontmatterService.getSourceNoteUid(activeFile);
				if (!sourceUid) {
					sourceUid = frontmatterService.generateUid();
					await frontmatterService.setSourceNoteUid(activeFile, sourceUid);
				}
				await this.openImageOcclusionEditor({
					mode: "add",
					sourceUid,
					imagePath: resolvedPath,
				});
			})();
		} else {
			void this.openImageOcclusionEditor({
				mode: "add",
				imagePath: resolvedPath,
			});
		}
	}

	private initializeSelectionToolbar(): void {
		const streamingService = new StreamingGenerationService(
			() => this.settings,
			this.flashcardManager,
		);

		const extension = createSelectionToolbarExtension({
			onGenerate: async (text) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					notify().error("No active file");
					return;
				}

				try {
					// Open panel so user can see cards streaming in
					await this.activateView();

					const noteType = this.getBasicNoteType();
					const result = await streamingService.generateStreaming(
						text,
						file,
						noteType,
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
					if (error instanceof DOMException && error.name === "AbortError")
						return;
					const msg = error instanceof Error ? error.message : String(error);
					notify().error(`Flashcard generation failed: ${msg}`);
				}
			},
			onEdit: (text: string) => {
				const modal = new QuickNoteEditorModal(this.app, this, {
					mode: "add",
					initialFields: { Front: text },
				});
				void modal.openAndWait();
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
			onImageOcclusion: (imagePath) => this.handleImageOcclusion(imagePath),
			hasApiKey: () => !!this.settings.openRouterApiKey,
			isEnabled: () => this.settings.selectionToolbarEnabled,
		});

		this.registerEditorExtension([extension]);

		// Image click toolbar (Quick+ and IO on image click)
		void import("@features/ai/ui/editor/ImageToolbarPlugin").then(
			({ createImageToolbarExtension }) => {
				const imageExtension = createImageToolbarExtension({
					onQuickAddImage: async (imagePath) => {
						try {
							const file = this.app.workspace.getActiveFile();
							if (!file) {
								notify().error("No active file");
								return;
							}
							const imageEmbed = `![[${imagePath}]]`;
							await this.flashcardManager.saveFlashcardsToSql(
								file,
								[
									{
										id: crypto.randomUUID(),
										question: imageEmbed,
										answer: "",
									},
								],
								undefined,
								imageEmbed,
							);
							notify().info("Quick-added image flashcard");
						} catch (error) {
							const msg =
								error instanceof Error ? error.message : String(error);
							notify().error(`Quick add failed: ${msg}`);
						}
					},
					onEdit: (imagePath) => {
						const modal = new QuickNoteEditorModal(this.app, this, {
							mode: "add",
							initialFields: {
								Front: `![[${imagePath}]]`,
							},
						});
						void modal.openAndWait();
					},
					onImageOcclusion: (imagePath) => this.handleImageOcclusion(imagePath),
					isEnabled: () => this.settings.selectionToolbarEnabled,
				});
				this.registerEditorExtension([imageExtension]);
			},
		);

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

	private getBasicNoteType(): NoteType | null {
		return this.cardStore?.noteTypes.getById(BUILTIN_BASIC_ID) ?? null;
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

		const modal = new PresetInspectorModal(
			this.app,
			this.presetService,
			file.path,
		);
		const result = await modal.openAndWait();
		if (result.action === "cancel") return;

		const frontmatterService = this.flashcardManager.getFrontmatterService();
		if (result.action === "set" && result.presetName) {
			await frontmatterService.setFsrsPreset(file, result.presetName);
			notify().success(`FSRS preset set to: ${result.presetName}`);
		} else {
			await frontmatterService.setFsrsPreset(file, null);
			notify().info("FSRS preset override removed");
		}
	}

	getStorageDiagnostics() {
		return this.backupRecovery?.getStorageDiagnostics() ?? {
			activeDatabasePath: null,
			saveTimerActive: false,
			flushInProgress: false,
			isDirty: false,
			lastFlushStartedAt: null,
			lastFlushSucceededAt: null,
			lastFlushFailedAt: null,
			lastFlushError: null,
			startupSnapshotPath: null,
			lastAutoRecoveryPath: null,
			lastAutoRecoveryAt: null,
		};
	}

	async createManualBackup(): Promise<void> {
		await this.backupRecovery?.createManualBackup();
	}

	async openRestoreBackupModal(): Promise<void> {
		await this.backupRecovery?.openRestoreBackupModal();
	}

	async importAnki(): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		// Safety backup before import (like Anki does)
		try {
			await this.backupService?.createBackup();
		} catch {
			console.warn("[True Recall] Pre-import backup failed, proceeding anyway");
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

}
