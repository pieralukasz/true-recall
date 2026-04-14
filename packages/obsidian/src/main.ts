import { Plugin, type TFile } from "obsidian";

import { TrueRecallApp } from "@true-recall/core/app";
import {
	ENABLE_RAG,
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_KNOWLEDGE_CHAT,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@true-recall/core/constants";
import type { DeletionHandlerService } from "@true-recall/core/flashcard/lifecycle/deletion-handler.service";
import type { DeviceDiscoveryService } from "@true-recall/core/integration/device/device-discovery.service";
import type { DeviceIdService } from "@true-recall/core/integration/device/device-id.service";
import { DeviceLockService } from "@true-recall/core/integration/device/device-lock.service";
import { DeviceSyncService } from "@true-recall/core/integration/device/device-sync.service";
import { SessionService } from "@true-recall/core/services/review/session.service";
import type { TrueRecallSettings } from "@true-recall/core/types";
import type { SessionConfig } from "@true-recall/core/types/session-config.types";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import type { CommandService } from "@true-recall/obsidian/commands";
import type { DataLayer } from "@true-recall/obsidian/data";
import { G } from "@true-recall/obsidian/data";
import type { NoteStatusCache } from "@true-recall/obsidian/features/core/cache/note-status-cache.service";
import {
	filtersToViewState,
	normalizeSessionFilters,
	type SessionFilters,
} from "@true-recall/obsidian/features/study/ui/review/review.types";
import { CardTypesEditorModal } from "@true-recall/obsidian/modals/core/card-types-editor/CardTypesEditorModal";
import { NoteTypeSuggestModal } from "@true-recall/obsidian/modals/core/card-types-editor/NoteTypeSuggestModal";
import { ImportStudioModal } from "@true-recall/obsidian/modals/core/import-studio/ImportStudioModal";
import { CsvExportModal } from "@true-recall/obsidian/modals/integration/CsvExportModal";
import { PresetInspectorModal } from "@true-recall/obsidian/modals/shared";
import {
	CustomStudyModal,
	type CustomStudyModalScope,
} from "@true-recall/obsidian/modals/study/CustomStudyModal";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ProjectManagementService } from "@true-recall/obsidian/services/project-management.service";
import { TrueRecallSettingTab } from "@true-recall/obsidian/settings";
import type { AppStore } from "@true-recall/obsidian/store";
import {
	isDesktop,
	isMobile,
	isViewAllowedOnCurrentPlatform,
} from "@true-recall/obsidian/utils/platform";
import { CardBrowserView } from "@true-recall/obsidian/views/browser/CardBrowserView";
import { KnowledgeChatView } from "@true-recall/obsidian/views/chat/KnowledgeChatView";
import { DashboardView } from "@true-recall/obsidian/views/dashboard/DashboardView";
import { FlashcardPanelView } from "@true-recall/obsidian/views/panel/FlashcardPanelView";
import { ReviewView } from "@true-recall/obsidian/views/review/ReviewView";
import { SimulatorView } from "@true-recall/obsidian/views/simulator/SimulatorView";
import { StatsView } from "@true-recall/obsidian/views/stats/StatsView";

import { createObsidianAdapters, type ObsidianAdapters } from "./context";
import type { LocalApiServer } from "./plugin/api/LocalApiServer";
import type { BackupRecoveryManager } from "./plugin/BackupRecoveryManager";
import { registerCommands } from "./plugin/PluginCommands";
import { registerEventHandlers } from "./plugin/PluginEventHandlers";
import {
	checkForWhatsNew,
	initializeDeviceAndStore,
} from "./plugin/PluginInitializers";
import {
	activateReviewView,
	activateView,
	getView,
} from "./plugin/ViewActivator";
import { AnkiExportModal } from "@true-recall/plugins/anki-import-export/AnkiExportModal";
import { AnkiImportModal } from "@true-recall/plugins/anki-import-export/AnkiImportModal";
import {
	IOEditorModal,
	type IOEditorMode,
	type IOEditorResult,
} from "@true-recall/plugins/image-occlusion";
import type { StatusBarWidget } from "@true-recall/plugins/status-bar-widget/StatusBarWidget";

export default class TrueRecallPlugin extends Plugin {
	coreApp!: TrueRecallApp;

	// Backward-compat getters — all existing code reads plugin.settings, plugin.cardStore, etc.
	get settings(): TrueRecallSettings {
		return this.coreApp.settings;
	}
	set settings(v: TrueRecallSettings) {
		this.coreApp.settings = v;
	}
	get flashcardManager() {
		return this.coreApp.flashcardManager;
	}
	get fsrsService() {
		return this.coreApp.fsrsService;
	}
	get sessionPersistence() {
		const v = this.coreApp.sessionPersistence;
		if (!v)
			throw new Error(
				"Session persistence not initialized. Wait for plugin to fully load.",
			);
		return v;
	}
	get cardStore() {
		const v = this.coreApp.cardStore;
		if (!v)
			throw new Error(
				"Card store not initialized. Wait for plugin to fully load.",
			);
		return v;
	}
	get dayBoundaryService() {
		return this.coreApp.dayBoundary;
	}
	get frontmatterIndex() {
		return this.coreApp.frontmatterIndex;
	}
	get backupService() {
		return this.coreApp.backupService;
	}
	get backgroundBackupManager() {
		return this.coreApp.backgroundBackupManager;
	}
	get fsrsHelper() {
		return this.coreApp.fsrsHelper;
	}
	get presetService() {
		return this.coreApp.presetService;
	}
	get noteTypeService() {
		const v = this.coreApp.noteTypeService;
		if (!v)
			throw new Error(
				"Note type service not initialized. Wait for plugin to fully load.",
			);
		return v;
	}
	get hierarchyService() {
		return this.coreApp.hierarchyService;
	}

	private _projectManagement: ProjectManagementService | null = null;
	get projectManagement(): ProjectManagementService {
		if (!this._projectManagement) {
			this._projectManagement = new ProjectManagementService(
				this.app,
				this.flashcardManager.getFrontmatterService(),
				this.hierarchyService,
				this.frontmatterIndex,
			);
		}
		return this._projectManagement;
	}

	deviceIdService: DeviceIdService | null = null;
	deviceDiscovery: DeviceDiscoveryService | null = null;
	private deviceLock: DeviceLockService | null = null;
	deletionHandler: DeletionHandlerService | null = null;
	commandService: CommandService | null = null;
	store: AppStore | null = null;
	noteStatusCache: NoteStatusCache | null = null;
	statusBarWidget: StatusBarWidget | null = null;
	backupRecovery: BackupRecoveryManager | null = null;
	localApi: LocalApiServer | null = null;
	ragActions:
		| import("@true-recall/core/rag/indexing/rag-chunk-actions").RagChunkActions
		| null = null;
	ragIndexer:
		| import("@true-recall/obsidian/features/rag/services/rag-indexer.service").RagIndexerService
		| null = null;
	ragSearch:
		| import("@true-recall/core/rag/retrieval/rag-search.service").RagSearchService
		| null = null;
	dataLayer: DataLayer | null = null;
	pluginLoader: import("./plugin/plugin-loader").PluginLoader | null = null;
	_disposeWireDataLayer: (() => void) | null = null;
	adapters!: ObsidianAdapters;
	private _unloaded = false;
	private sessionService = new SessionService();
	EmbeddableEditor:
		| import("@true-recall/obsidian/editor/shared/embedded-editor").EmbeddableEditorClass
		| null = null;
	_globalSelectionToolbar: { destroy(): void } | null = null;

	isStoreReady(): boolean {
		return this.coreApp.isReady();
	}

	async onload(): Promise<void> {
		const t0 = performance.now();

		// 1. Create platform adapters + core app
		try {
			this.adapters = createObsidianAdapters(this.app);
			const { ObsidianSettingsPersistence } = await import(
				"@true-recall/obsidian/adapters/ObsidianSettingsPersistence"
			);
			const { ObsidianLinkResolver } = await import(
				"@true-recall/obsidian/adapters/ObsidianLinkResolver"
			);
			const { ObsidianVaultEventBridge } = await import(
				"@true-recall/obsidian/adapters/ObsidianVaultEventBridge"
			);

			this.coreApp = new TrueRecallApp({
				...this.adapters,
				settingsPersistence: new ObsidianSettingsPersistence(this),
				linkResolver: new ObsidianLinkResolver(this.app),
				vaultEvents: new ObsidianVaultEventBridge(this.app, this),
			});
			await this.coreApp.initialize();
		} catch (error) {
			console.error("[True Recall] Core initialization failed:", error);
			notify().error(
				"True Recall failed to initialize. Try reinstalling the plugin.",
			);
			return;
		}

		// Migrate ragEnabled → pluginStates["knowledge-base"]
		try {
			if (
				this.settings.ragEnabled &&
				this.settings.pluginStates?.["knowledge-base"] === undefined
			) {
				this.settings.pluginStates = {
					...this.settings.pluginStates,
					"knowledge-base": true,
				};
				await this.saveSettings();
			}
		} catch (error) {
			console.warn(
				"[True Recall] ragEnabled migration failed to persist, will retry next load:",
				error,
			);
		}

		// What's New check after layout ready
		this.app.workspace.onLayoutReady(() => {
			checkForWhatsNew(this).catch((e) => {
				console.debug("[True Recall] What's New check failed:", e);
			});
		});

		const tSetup = performance.now();

		// 2. Initialize device context + card store
		try {
			await initializeDeviceAndStore(this);
		} catch (error) {
			console.error(
				"[True Recall] Critical: Device/store initialization failed:",
				error,
			);
			notify().error("Failed to initialize database. Please restart Obsidian.");
			return;
		}

		// 3. Device lock (only when sync is enabled)
		if (this.settings.enableDeviceSync && this.deviceIdService) {
			try {
				const persistence = new ObsidianPersistence(this.app);
				const deviceId = this.deviceIdService.getDeviceId();
				const label = this.deviceIdService.getDisplayName();
				this.deviceLock = new DeviceLockService(
					persistence,
					deviceId,
					isMobile() ? "mobile" : "desktop",
					label,
				);

				const conflicting = await this.deviceLock.isConflicting();
				if (conflicting) {
					notify().warning(
						`True Recall is open on ${conflicting.label} (${conflicting.platform}). Close it first to avoid sync issues.`,
					);
				}
				await this.deviceLock.writeLock();
				this.deviceLock.startHeartbeat();
			} catch (error) {
				console.error("[True Recall] Device lock setup failed:", error);
			}
		}

		// 4. Cross-device sync
		try {
			if (
				this.settings.enableDeviceSync &&
				this.deviceDiscovery &&
				this.cardStore
			) {
				const syncService = new DeviceSyncService(
					this.cardStore,
					this.deviceDiscovery,
					new ObsidianPersistence(this.app),
				);
				const syncResult = await syncService.syncOnStartup();
				if (syncResult.errors.length > 0) {
					notify().warning(
						`Sync completed with ${syncResult.errors.length} error(s). Some changes may not have been applied.`,
					);
				}
				if (syncResult.cardsApplied > 0 || syncResult.reviewLogsApplied > 0) {
					this.dataLayer?.invalidateGroups([
						G.CARDS,
						G.BROWSER,
						G.DASHBOARD,
						G.PANEL,
						G.REVIEW,
						G.STATS,
					]);
					notify().info(
						`Synced ${syncResult.cardsApplied} cards and ${syncResult.reviewLogsApplied} reviews from other devices.`,
					);
				}
			}
		} catch (error) {
			console.error("[True Recall] Device sync failed:", error);
			notify().warning(
				"Cross-device sync failed. Your cards may not be up to date.",
			);
		}

		const tStore = performance.now();

		const registerIfAllowed = (
			viewType: string,
			factory: (
				leaf: import("obsidian").WorkspaceLeaf,
			) => import("obsidian").View,
		) => {
			if (isViewAllowedOnCurrentPlatform(viewType)) {
				this.registerView(viewType, factory);
			}
		};

		registerIfAllowed(
			VIEW_TYPE_FLASHCARD_PANEL,
			(leaf) => new FlashcardPanelView(leaf, this),
		);

		registerIfAllowed(VIEW_TYPE_REVIEW, (leaf) => new ReviewView(leaf, this));

		registerIfAllowed(
			VIEW_TYPE_SIMULATOR,
			(leaf) => new SimulatorView(leaf, this),
		);

		registerIfAllowed(
			VIEW_TYPE_DASHBOARD,
			(leaf) => new DashboardView(leaf, this),
		);

		this.addRibbonIcon(
			"layout-dashboard",
			"True Recall: Open dashboard",
			() => {
				this.openDashboard().catch((error) => {
					notify().error("Failed to open dashboard", error);
				});
			},
		);

		registerIfAllowed(
			VIEW_TYPE_CARD_BROWSER,
			(leaf) => new CardBrowserView(leaf, this),
		);

		registerIfAllowed(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

		if (ENABLE_RAG) {
			registerIfAllowed(
				VIEW_TYPE_KNOWLEDGE_CHAT,
				(leaf) => new KnowledgeChatView(leaf, this),
			);
		}

		registerCommands(this);
		this.addSettingTab(new TrueRecallSettingTab(this.app, this));
		registerEventHandlers(this);

		const { CommandService: CmdService } = await import(
			"@true-recall/obsidian/commands"
		);
		this.commandService = new CmdService({
			flashcardManager: this.flashcardManager,
			cardStore: this.cardStore,
			sessionPersistence: this.sessionPersistence,
		});

		if (ENABLE_RAG && this.cardStore) {
			const { RagChunkActions } = await import(
				"@true-recall/core/rag/indexing/rag-chunk-actions"
			);
			const { RagSchemaManager } = await import(
				"@true-recall/core/rag/indexing/rag-schema"
			);
			const ragSchema = new RagSchemaManager(this.cardStore.getDatabase());
			ragSchema.createTables();
			this.ragActions = new RagChunkActions(this.cardStore.getSqliteDb());

			const embeddingKey =
				this.settings.proKey || this.settings.openRouterApiKey;
			if (this.settings.ragEnabled && embeddingKey) {
				const { RagEmbeddingServiceImpl } = await import(
					"@true-recall/core/rag/retrieval/rag-embedding.service"
				);
				const { LITELLM_EMBEDDINGS_URL, OPENROUTER_EMBEDDINGS_URL } =
					await import("@true-recall/core/constants");
				const { RagIndexerService } = await import(
					"@true-recall/obsidian/features/rag/services/rag-indexer.service"
				);
				const { RagSearchService } = await import(
					"@true-recall/core/rag/retrieval/rag-search.service"
				);
				const isPro = !!this.settings.proKey;
				const embedder = new RagEmbeddingServiceImpl(
					new ObsidianHttpClient(),
					embeddingKey,
					isPro ? LITELLM_EMBEDDINGS_URL : OPENROUTER_EMBEDDINGS_URL,
					isPro ? "embedding" : "baai/bge-m3",
				);
				this.ragSearch = new RagSearchService(this.ragActions, embedder);
				this.ragIndexer = new RagIndexerService(
					this.app,
					this.ragActions,
					embedder,
					() => this.settings,
				);
				this.ragIndexer.setSearchService(this.ragSearch);
				this.ragIndexer.registerVaultEvents(this);
				this.ragIndexer.registerCardSignals(this);
			}
		}

		if (this.settings.enableLocalApi) {
			void import("./plugin/api/LocalApiServer")
				.then(({ LocalApiServer: ApiServer }) => {
					if (this._unloaded) return;
					this.localApi = new ApiServer(this, this.settings.apiPort);
					this.localApi.start();
				})
				.catch((e) => {
					console.error("[True Recall] Failed to start Local API server:", e);
				});
		}

		const tTotal = performance.now();
		console.debug(
			`[True Recall Startup] setup: ${(tSetup - t0).toFixed(1)}ms` +
				` | store: ${(tStore - tSetup).toFixed(1)}ms` +
				` | views+commands: ${(tTotal - tStore).toFixed(1)}ms` +
				` | total: ${(tTotal - t0).toFixed(1)}ms`,
		);
	}

	onunload(): void {
		this._unloaded = true;
		this.pluginLoader?.deactivateAll();
		this.deviceLock?.stopHeartbeat();
		void this.deviceLock?.clearLock();
		this.localApi?.stop();
		this.commandService?.clear();
		this.statusBarWidget?.dispose();
		this.noteStatusCache?.dispose();
		this._globalSelectionToolbar?.destroy();
		this.dataLayer?.dispose();
		this._disposeWireDataLayer?.();
		void this.coreApp?.shutdown().catch((e) => {
			console.error(
				"[True Recall] Shutdown failed — data may not be saved:",
				e,
			);
		});
	}

	async saveSettings(): Promise<void> {
		await this.coreApp.updateSettings(this.settings);
		this.noteStatusCache?.bumpVersion();
	}

	async activateView(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_FLASHCARD_PANEL);
	}

	async openSimulator(): Promise<void> {
		await activateView(this.app, VIEW_TYPE_SIMULATOR, { useMainArea: true });
	}

	async startReview(config: SessionConfig): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const allCards = this.flashcardManager.getAllFSRSCards();
		const archivedSourceUids = this.hierarchyService.getArchivedSourceUids();

		const result = this.sessionService.validate(
			config,
			allCards,
			archivedSourceUids,
			{
				ignoreDailyLimitsForNoteStudy:
					this.settings.ignoreDailyLimitsForNoteStudy,
			},
		);

		if (!result.valid) {
			if (result.message) notify().info(result.message);
			return;
		}

		await this.openReviewViewWithFilters(result.filters);
	}

	private async handleSessionResult(
		result: import("@true-recall/core/types/events.types").SessionResult,
	): Promise<void> {
		if (result.cancelled) return;

		if (result.useDefaultDeck) {
			await this.startReview({ mode: "all_due" });
			return;
		}

		await this.startReview({
			mode: "custom",
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

	async openKnowledgeChat(): Promise<void> {
		const existingLeaf = getView(this.app, VIEW_TYPE_KNOWLEDGE_CHAT);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.app, VIEW_TYPE_KNOWLEDGE_CHAT, {
			useMainArea: false,
		});
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
			let sourceUid = await frontmatterService.getSourceNoteUid(
				activeFile.path,
			);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(activeFile.path, sourceUid);
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
			const preset: import("@true-recall/core/types/settings.types").SessionPreset =
				{
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
			.getSourceNoteUid(file.path);
		if (!sourceUid) {
			notify().info(`No flashcards found for "${file.basename}"`);
			return;
		}
		await this.startReview({ mode: "note", sourceUid });
	}

	async reviewTodaysCards(): Promise<void> {
		await this.startReview({ mode: "created_today" });
	}

	async openReviewViewWithFilters(rawFilters: SessionFilters): Promise<void> {
		const filters = normalizeSessionFilters(rawFilters);
		const state = filtersToViewState(filters);

		await activateReviewView(
			this.app,
			VIEW_TYPE_REVIEW,
			this.settings.reviewMode,
			state,
		);
	}

	// Init methods extracted to plugin/PluginInitializers.ts
	// handleImageOcclusion extracted to plugin/PluginInitializers.ts

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
			await frontmatterService.setFsrsPreset(file.path, result.presetName);
			notify().success(`FSRS preset set to: ${result.presetName}`);
		} else {
			await frontmatterService.setFsrsPreset(file.path, null);
			notify().info("FSRS preset override removed");
		}
	}

	getStorageDiagnostics() {
		return (
			this.backupRecovery?.getStorageDiagnostics() ?? {
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
			}
		);
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
			() => this.settings,
		);
		modal.open();
	}

	exportAnki(): void {
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

	exportCsv(): void {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const modal = new CsvExportModal(this.app, this.cardStore);
		modal.open();
	}

	async toggleNoteReview(file?: TFile): Promise<void> {
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const target = file ?? this.app.workspace.getActiveFile();
		if (!target || target.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		try {
			const frontmatterService = this.flashcardManager.getFrontmatterService();
			let sourceUid = await frontmatterService.getSourceNoteUid(target.path);

			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(target.path, sourceUid);
			}

			const hasReview = this.flashcardManager.hasNoteReview(sourceUid);
			if (hasReview) {
				this.flashcardManager.disableNoteReview(sourceUid);
				notify().success("Note review disabled");
			} else {
				this.flashcardManager.enableNoteReview(sourceUid);
				notify().success("Note review enabled");
			}

			this.dataLayer?.invalidateGroups(["cards", "dashboard", "review"]);
		} catch (error) {
			notify().operationFailed("toggle note review", error);
		}
	}

	async addFlashcardUidToCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			notify().noActiveFile();
			return;
		}

		const frontmatterService = this.flashcardManager.getFrontmatterService();

		const existingUid = await frontmatterService.getSourceNoteUid(file.path);
		if (existingUid) {
			notify().info(`Note already has flashcard UID: ${existingUid}`);
			return;
		}

		const newUid = frontmatterService.generateUid();
		await frontmatterService.setSourceNoteUid(file.path, newUid);

		notify().success(`Added flashcard UID: ${newUid}`);
	}
}
