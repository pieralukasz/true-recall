import { Plugin, type TFile } from "obsidian";

import { TrueRecallApp } from "@true-recall/core/app";
import {
	VIEW_TYPE_ASSISTANT_EDITOR,
	VIEW_TYPE_ASSISTANT_INBOX,
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_CARD_TYPES_EDITOR,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_NOTE_TYPE_MANAGER,
	VIEW_TYPE_QUICK_NOTE_EDITOR,
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
import type {
	CardSchedulingMeta,
	SessionResult,
	TemporaryCustomStudyDeck,
	TrueRecallSettings,
} from "@true-recall/core/types";
import type { SessionConfig } from "@true-recall/core/types/session-config.types";

import { ObsidianNoteResolver } from "@true-recall/obsidian/adapters/ObsidianNoteResolver";
import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import type { CommandService } from "@true-recall/obsidian/commands";
import type { DataLayer } from "@true-recall/obsidian/data";
import { G } from "@true-recall/obsidian/data";
import { Q } from "@true-recall/obsidian/data/queries";
import type { NoteStatusCache } from "@true-recall/obsidian/features/core/cache/note-status-cache.service";
import { ReviewSessionController } from "@true-recall/obsidian/features/study/services/ReviewSessionController";
import {
	filtersToViewState,
	normalizeSessionFilters,
	type SessionFilters,
} from "@true-recall/obsidian/features/study/ui/review/review.types";
import { NoteTypeSuggestModal } from "@true-recall/obsidian/modals/core/card-types-editor/NoteTypeSuggestModal";
import { ImportStudioModal } from "@true-recall/obsidian/modals/core/import-studio/ImportStudioModal";
import { CsvExportModal } from "@true-recall/obsidian/modals/integration/CsvExportModal";
import { PresetInspectorModal } from "@true-recall/obsidian/modals/shared";
import {
	CustomStudyModal,
	type CustomStudyModalScope,
} from "@true-recall/obsidian/modals/study/CustomStudyModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ProjectManagementService } from "@true-recall/obsidian/services/project-management.service";
import { TrueRecallSettingTab } from "@true-recall/obsidian/settings";
import type { AppStore } from "@true-recall/obsidian/store";
import {
	isDesktop,
	isMobile,
	isViewAllowedOnCurrentPlatform,
} from "@true-recall/obsidian/utils/platform";
import { AssistantInboxView } from "@true-recall/obsidian/views/assistant/AssistantInboxView";
import { CardBrowserView } from "@true-recall/obsidian/views/browser/CardBrowserView";
import { DashboardView } from "@true-recall/obsidian/views/dashboard/DashboardView";
import { AssistantEditorView } from "@true-recall/obsidian/views/modal-window/AssistantEditorView";
import { drainAssistantEditorRequests } from "@true-recall/obsidian/views/modal-window/assistant-editor-registry";
import { CardTypesEditorView } from "@true-recall/obsidian/views/modal-window/CardTypesEditorView";
import { drainCardTypesEditorRequests } from "@true-recall/obsidian/views/modal-window/card-types-editor-registry";
import { NoteTypeManagerView } from "@true-recall/obsidian/views/modal-window/NoteTypeManagerView";
import { drainNoteTypeManagerRequests } from "@true-recall/obsidian/views/modal-window/note-type-manager-registry";
import { openCardTypesEditor as openCardTypesEditorPopout } from "@true-recall/obsidian/views/modal-window/open-card-types-editor";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";
import { QuickNoteEditorView } from "@true-recall/obsidian/views/modal-window/QuickNoteEditorView";
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
import { applyTabBarClass, HIDE_TAB_BAR_CLASS } from "./plugin/tab-bar";
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
	get generationPresetService() {
		return this.coreApp.generationPresetService;
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
	dataLayer: DataLayer | null = null;
	assistantService:
		| import("./services/assistant/assistant.service").AssistantService
		| null = null;
	pluginLoader: import("./plugin/plugin-loader").PluginLoader | null = null;
	_disposeWireDataLayer: (() => void) | null = null;
	adapters!: ObsidianAdapters;
	private _unloaded = false;
	private sessionService = new SessionService();
	private _reviewController: ReviewSessionController | null = null;

	get reviewController(): ReviewSessionController {
		if (!this._reviewController) {
			this._reviewController = new ReviewSessionController(this, () => {
				if (!this.store) {
					throw new Error("Store not ready");
				}
				return this.store.getState().review;
			});
		}
		return this._reviewController;
	}
	EmbeddableEditor:
		| import("@true-recall/obsidian/editor/shared/embedded-editor").EmbeddableEditorClass
		| null = null;

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

		registerIfAllowed(
			VIEW_TYPE_QUICK_NOTE_EDITOR,
			(leaf) => new QuickNoteEditorView(leaf, this),
		);

		registerIfAllowed(
			VIEW_TYPE_ASSISTANT_EDITOR,
			(leaf) => new AssistantEditorView(leaf, this),
		);

		registerIfAllowed(
			VIEW_TYPE_NOTE_TYPE_MANAGER,
			(leaf) => new NoteTypeManagerView(leaf, this),
		);

		registerIfAllowed(
			VIEW_TYPE_CARD_TYPES_EDITOR,
			(leaf) => new CardTypesEditorView(leaf, this),
		);

		registerIfAllowed(
			VIEW_TYPE_ASSISTANT_INBOX,
			(leaf) => new AssistantInboxView(leaf, this),
		);

		registerCommands(this);
		this.addSettingTab(new TrueRecallSettingTab(this.app, this));
		registerEventHandlers(this);
		this.applyTabBarVisibility();

		const { CommandService: CmdService } = await import(
			"@true-recall/obsidian/commands"
		);
		this.commandService = new CmdService({
			flashcardManager: this.flashcardManager,
			cardStore: this.cardStore,
			sessionPersistence: this.sessionPersistence,
		});

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
		document.body.classList.remove(HIDE_TAB_BAR_CLASS);
		this.pluginLoader?.deactivateAll();
		this.deviceLock?.stopHeartbeat();
		void this.deviceLock?.clearLock();
		this.localApi?.stop();
		this.commandService?.clear();
		this.statusBarWidget?.dispose();
		this.noteStatusCache?.dispose();
		this.dataLayer?.dispose();
		this._disposeWireDataLayer?.();
		// Fire pending onClose callbacks for popout views so callers aren't
		// left hanging when the plugin reloads with windows still open.
		drainCardTypesEditorRequests();
		drainNoteTypeManagerRequests();
		drainAssistantEditorRequests();
		void this.coreApp?.shutdown().catch((e) => {
			console.error(
				"[True Recall] Shutdown failed — data may not be saved:",
				e,
			);
		});
	}

	/** Reflect the `hideTabBar` setting onto the document body class. */
	applyTabBarVisibility(): void {
		applyTabBarClass(document.body, this.settings.hideTabBar);
	}

	/** Flip the tab-bar visibility, persist it, and apply immediately. */
	async toggleTabBar(): Promise<void> {
		this.settings.hideTabBar = !this.settings.hideTabBar;
		this.applyTabBarVisibility();
		await this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		await this.coreApp.updateSettings(this.settings);
		this.noteStatusCache?.bumpVersion();
		// Apply plugin enable/disable toggles (and tier unlocks) without restart
		this.pluginLoader?.sync();
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
			{
				allCards,
				archivedSourceUids,
				settings: this.settings,
				sessionPersistence: this.sessionPersistence,
				presetService: this.presetService,
				noteResolver: new ObsidianNoteResolver(this.app),
				hierarchyService: this.hierarchyService,
				fsrsService: this.fsrsService,
			},
			{
				ignoreDailyLimitsForNoteStudy:
					this.settings.ignoreDailyLimitsForNoteStudy,
				dayStartHour: this.settings.dayStartHour,
			},
		);

		if (!result.valid) {
			if (result.message) notify().info(result.message);
			return;
		}

		await this.openReviewViewWithFilters(result.filters);
	}

	private getCustomStudySessionConfig(
		result: SessionResult,
	): Extract<SessionConfig, { mode: "custom" }> {
		return {
			mode: "custom",
			projectPath: result.projectPath,
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
			customStudy: result.customStudy,
			temporaryDeckId: "custom-study-session",
		};
	}

	private resolveLegacyCustomStudyProjectPath(
		deck: TemporaryCustomStudyDeck,
	): string | undefined {
		if (deck.projectPath) return deck.projectPath;
		if (!deck.scopeLabel || (deck.sourceNoteFilters?.length ?? 0) <= 1) {
			return undefined;
		}

		const file = this.app.metadataCache.getFirstLinkpathDest(
			deck.scopeLabel,
			"",
		);
		if (!file) return undefined;
		const isProject =
			this.hierarchyService.isExplicitProject(file.path) ||
			this.hierarchyService.getDescendantPaths(file.path).length > 0;
		return isProject ? file.path : undefined;
	}

	private getSessionValidationDeps() {
		return {
			allCards: this.flashcardManager.getAllFSRSCards(),
			archivedSourceUids: this.hierarchyService.getArchivedSourceUids(),
			settings: this.settings,
			sessionPersistence: this.sessionPersistence,
			presetService: this.presetService,
			noteResolver: new ObsidianNoteResolver(this.app),
			hierarchyService: this.hierarchyService,
			fsrsService: this.fsrsService,
		};
	}

	private async materializeTemporaryCustomStudyDeck(
		result: SessionResult,
		options: { scopeLabel?: string; preserveCreatedAt?: number } = {},
	): Promise<void> {
		if (!result.customStudy) return;
		if (!this.isStoreReady()) {
			notify().error(
				"Database not ready. Please wait for plugin to fully load.",
			);
			return;
		}

		const validation = this.sessionService.validate(
			this.getCustomStudySessionConfig(result),
			this.getSessionValidationDeps(),
			{
				ignoreDailyLimitsForNoteStudy:
					this.settings.ignoreDailyLimitsForNoteStudy,
				dayStartHour: this.settings.dayStartHour,
			},
		);
		const now = Date.now();
		const { queue } = this.reviewController.buildSession(validation.filters);
		const deck: TemporaryCustomStudyDeck = {
			id: "custom-study-session",
			name: "Custom Study Session",
			customStudy: result.customStudy,
			cardIds: queue.map((card) => card.id),
			sourceNoteFilters: result.sourceNoteFilters,
			projectPath: result.projectPath,
			scopeLabel: options.scopeLabel,
			createdAt: options.preserveCreatedAt ?? now,
			rebuiltAt: now,
		};

		this.settings = {
			...this.settings,
			temporaryCustomStudyDeck: deck,
		};
		await this.saveSettings();
		await this.openDashboard();

		if (deck.cardIds.length === 0) {
			notify().info("Custom Study Session created, but no cards matched.");
		} else {
			notify().success(
				`Custom Study Session created with ${deck.cardIds.length} card${deck.cardIds.length === 1 ? "" : "s"}.`,
			);
		}
	}

	async startTemporaryCustomStudyDeck(): Promise<void> {
		const deck = this.settings.temporaryCustomStudyDeck;
		if (!deck) return;
		if (deck.cardIds.length === 0) {
			notify().info("This Custom Study Session is empty. Rebuild it first.");
			return;
		}

		await this.startReview({
			mode: "custom",
			projectPath: deck.projectPath,
			sourceNoteFilters: deck.sourceNoteFilters,
			customStudy: deck.customStudy,
			materializedCardIds: [...deck.cardIds],
			temporaryDeckId: deck.id,
		});
	}

	async rebuildTemporaryCustomStudyDeck(): Promise<void> {
		const deck = this.settings.temporaryCustomStudyDeck;
		if (!deck) return;
		const projectPath = this.resolveLegacyCustomStudyProjectPath(deck);

		await this.materializeTemporaryCustomStudyDeck(
			{
				cancelled: false,
				sessionType: "custom-study",
				ignoreDailyLimits: true,
				sourceNoteFilters: projectPath ? undefined : deck.sourceNoteFilters,
				projectPath,
				customStudy: deck.customStudy,
			},
			{
				scopeLabel: deck.scopeLabel,
				preserveCreatedAt: deck.createdAt,
			},
		);
	}

	async emptyTemporaryCustomStudyDeck(): Promise<void> {
		const deck = this.settings.temporaryCustomStudyDeck;
		if (!deck || deck.cardIds.length === 0) return;

		this.settings = {
			...this.settings,
			temporaryCustomStudyDeck: {
				...deck,
				cardIds: [],
			},
		};
		await this.saveSettings();
		notify().success("Custom Study Session emptied.");
	}

	async deleteTemporaryCustomStudyDeck(): Promise<void> {
		if (!this.settings.temporaryCustomStudyDeck) return;
		const { temporaryCustomStudyDeck: _, ...settings } = this.settings;
		this.settings = settings;
		await this.saveSettings();
		notify().success("Custom Study Session deleted.");
	}

	removeCardsFromTemporaryDeck(
		deckId: string | undefined,
		cardIds: readonly string[],
	): void {
		const deck = this.settings.temporaryCustomStudyDeck;
		if (!deckId || !deck || deck.id !== deckId) return;
		const removedIds = new Set(cardIds);
		if (!deck.cardIds.some((id) => removedIds.has(id))) return;

		this.settings = {
			...this.settings,
			temporaryCustomStudyDeck: {
				...deck,
				cardIds: deck.cardIds.filter((id) => !removedIds.has(id)),
			},
		};
		void this.saveSettings();
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

	async openAssistantInbox(focusThreadId?: string): Promise<void> {
		const existingLeaf = getView(this.app, VIEW_TYPE_ASSISTANT_INBOX);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);
		} else {
			await activateView(this.app, VIEW_TYPE_ASSISTANT_INBOX, {
				useMainArea: true,
			});
		}
		if (focusThreadId) {
			// Give a freshly-mounted inbox one tick to register its listener.
			window.setTimeout(() => {
				window.dispatchEvent(
					new CustomEvent("true-recall:assistant-focus-thread", {
						detail: { threadId: focusThreadId },
					}),
				);
			}, 50);
		}
	}

	openCardTypesEditor(noteTypeId?: string): void {
		if (noteTypeId) {
			openCardTypesEditorPopout(this, noteTypeId);
			return;
		}
		new NoteTypeSuggestModal(this.app, this).open();
	}

	openImportStudio(options?: { defaultNoteTypeId?: string }): void {
		new ImportStudioModal(this.app, this, options).open();
	}

	openQuickNoteEditor(defaultNoteTypeId?: string): void {
		void openQuickNoteEditor(this, {
			mode: "add",
			defaultNoteTypeId,
		});
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
		const scopedNoteNames = scope?.sourceNoteFilters
			? new Set(scope.sourceNoteFilters)
			: null;
		const scopedProjectSourceUids = scope?.projectPath
			? this.hierarchyService.getSourceUidsForProject(scope.projectPath)
			: null;
		const allMeta = this.dataLayer?.get<Map<string, CardSchedulingMeta>>(
			Q.ALL_META,
		);
		const availableTags = [
			...new Set(
				[...(allMeta?.values() ?? [])]
					.filter(
						(card) =>
							(!scopedNoteNames ||
								scopedNoteNames.has(card.sourceNoteName ?? "")) &&
							(!scopedProjectSourceUids ||
								scopedProjectSourceUids.has(card.sourceUid ?? "")),
					)
					.flatMap((card) => card.tags ?? []),
			),
		].sort((a, b) => a.localeCompare(b));
		const modal = new CustomStudyModal(
			this.app,
			{
				title: scope?.scopeLabel
					? `Custom study — ${scope.scopeLabel}`
					: "Custom study",
				width: "480px",
			},
			{ ...scope, availableTags },
		);
		const result = await modal.openAndWait();
		if (result.cancelled || !result.sessionResult) return;

		await this.materializeTemporaryCustomStudyDeck(result.sessionResult, {
			scopeLabel: scope?.scopeLabel,
		});
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

			this.dataLayer?.invalidateGroups([G.CARDS, G.DASHBOARD, G.REVIEW]);
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
