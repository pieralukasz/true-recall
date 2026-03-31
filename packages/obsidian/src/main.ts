import { effect } from "@preact/signals";
import {
	DEFAULT_SETTINGS,
	ENABLE_RAG,
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_KNOWLEDGE_CHAT,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@true-recall/core/constants";
import type { CardMutation as CoreCardMutation } from "@true-recall/core/events";
import { onCardChange as onCoreCardChange } from "@true-recall/core/events";
import { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import { DeletionHandlerService } from "@true-recall/core/flashcard/lifecycle/deletion-handler.service";
import { DeviceDiscoveryService } from "@true-recall/core/integration/device/device-discovery.service";
import { DeviceIdService } from "@true-recall/core/integration/device/device-id.service";
import { FSRSHelperService } from "@true-recall/core/metrics/fsrs-tools";
import { BackgroundBackupManager } from "@true-recall/core/persistence/backup/background-backup.service";
import { BackupService } from "@true-recall/core/persistence/backup/backup.service";
import { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import {
	DB_FOLDER,
	getDeviceDbFilename,
	SAFETY_FLUSH_INTERVAL_MS,
} from "@true-recall/core/persistence/sqlite/sqlite.types";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";
import { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import { NoteTypeService } from "@true-recall/core/services/notes/note-type.service";
import { PresetService } from "@true-recall/core/services/notes/preset.service";
import { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";
import { SessionService } from "@true-recall/core/services/review/session.service";
import type { TrueRecallSettings } from "@true-recall/core/types";
import { extractFSRSSettings } from "@true-recall/core/types";
import type { SessionConfig } from "@true-recall/core/types/session-config.types";
import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import type { CommandService } from "@true-recall/obsidian/commands";
import {
	DataLayer,
	G,
	registerQueries as registerDataLayerQueries,
	setDataLayer,
} from "@true-recall/obsidian/data";
import { createSelectionToolbarExtension } from "@true-recall/obsidian/editor/ai/SelectionToolbarPlugin";
import {
	createLinkStatusPostProcessor,
	createLinkStatusViewPlugin,
} from "@true-recall/obsidian/editor/study";
import type { StatusBarWidget } from "@true-recall/obsidian/editor/study/widgets/StatusBarWidget";
import {
	createNoteStatusCache,
	type NoteStatusCache,
} from "@true-recall/obsidian/features/core/cache/note-status-cache.service";
import { IOEditorModal } from "@true-recall/obsidian/features/image-occlusion/IOEditorModal";
import type {
	IOEditorMode,
	IOEditorResult,
} from "@true-recall/obsidian/features/image-occlusion/types";
import { UidGuardianService } from "@true-recall/obsidian/features/study/services/flashcard/uid-guardian.service";
import {
	filtersToViewState,
	normalizeSessionFilters,
	type SessionFilters,
} from "@true-recall/obsidian/features/study/ui/review/review.types";
import { CardTypesEditorModal } from "@true-recall/obsidian/modals/core/card-types-editor/CardTypesEditorModal";
import { NoteTypeSuggestModal } from "@true-recall/obsidian/modals/core/card-types-editor/NoteTypeSuggestModal";
import { ImportStudioModal } from "@true-recall/obsidian/modals/core/import-studio/ImportStudioModal";
import { AnkiExportModal } from "@true-recall/obsidian/modals/integration/AnkiExportModal";
import { AnkiImportModal } from "@true-recall/obsidian/modals/integration/AnkiImportModal";
import { CsvExportModal } from "@true-recall/obsidian/modals/integration/CsvExportModal";
import {
	DeviceSelectionModal,
	type DeviceSelectionResult,
} from "@true-recall/obsidian/modals/integration/DeviceSelectionModal";
import { PresetInspectorModal } from "@true-recall/obsidian/modals/shared";
import {
	CustomStudyModal,
	type CustomStudyModalScope,
} from "@true-recall/obsidian/modals/study/CustomStudyModal";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { setLastMutation } from "@true-recall/obsidian/services/signals";
import { TrueRecallSettingTab } from "@true-recall/obsidian/settings";
import { type AppStore, createAppStore } from "@true-recall/obsidian/store";
import { isDesktop } from "@true-recall/obsidian/utils/platform";
import { CardBrowserView } from "@true-recall/obsidian/views/browser/CardBrowserView";
import { KnowledgeChatView } from "@true-recall/obsidian/views/chat/KnowledgeChatView";
import { DashboardView } from "@true-recall/obsidian/views/dashboard/DashboardView";
import { FlashcardPanelView } from "@true-recall/obsidian/views/panel/FlashcardPanelView";
import { ReviewView } from "@true-recall/obsidian/views/review/ReviewView";
import { SimulatorView } from "@true-recall/obsidian/views/simulator/SimulatorView";
import { StatsView } from "@true-recall/obsidian/views/stats/StatsView";
import { normalizePath, Plugin, TFile } from "obsidian";
import { createObsidianAdapters, type ObsidianAdapters } from "./context";
import type { LocalApiServer } from "./plugin/api/LocalApiServer";
import { BackupRecoveryManager } from "./plugin/BackupRecoveryManager";
import { registerCommands } from "./plugin/PluginCommands";
import {
	registerDeletionHandler,
	registerEventHandlers,
} from "./plugin/PluginEventHandlers";
import {
	editSelectionAsFlashcard,
	generateFlashcardsFromSelection,
	hasApiKey,
	quickAddFlashcardFromSelection,
} from "./plugin/SelectionActions";
import {
	activateReviewView,
	activateView,
	getView,
} from "./plugin/ViewActivator";

function mapCoreMutationToGroups(mutation: CoreCardMutation): string[] {
	switch (mutation.type) {
		case "reviewed":
			return [G.CARDS, G.DASHBOARD, G.STATS, G.PANEL];
		case "added":
			return [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.STATS];
		case "removed":
			return [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.STATS];
		case "updated":
			return [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL];
		case "bulk":
			return [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.REVIEW, G.STATS];
		default:
			return [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.REVIEW, G.STATS];
	}
}

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
	commandService: CommandService | null = null;
	fsrsHelper: FSRSHelperService | null = null;
	presetService!: PresetService;
	noteTypeService!: NoteTypeService;
	hierarchyService!: HierarchyService;
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
	private _disposeCoreCardBridge: (() => void) | null = null;
	private adapters!: ObsidianAdapters;
	private _unloaded = false;
	private sessionService = new SessionService();
	EmbeddableEditor:
		| import("@true-recall/obsidian/editor/shared/embedded-editor").EmbeddableEditorClass
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
		const t0 = performance.now();
		await this.loadSettings();
		const tSettings = performance.now();

		this.adapters = createObsidianAdapters(this.app);

		this.frontmatterIndex = new FrontmatterIndexService(
			this.adapters.metadataIndex,
		);
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
			this.dataLayer?.invalidateGroups(["cards", "dashboard", "review"]);
		});
		this.frontmatterIndex.onFieldChange("include", () => {
			this.hierarchyService.invalidateGraph();
			this.dataLayer?.invalidateGroups(["cards", "dashboard", "review"]);
		});
		this.frontmatterIndex.onFieldChange("archive", () =>
			this.dataLayer?.invalidateGroups(["cards"]),
		);
		this.frontmatterIndex.onFieldChange("fsrs_preset", () =>
			this.dataLayer?.invalidateGroups(["cards"]),
		);
		// Register Obsidian events that feed the platform-agnostic frontmatter index
		this.registerEvent(
			this.app.metadataCache.on("changed", (file, _data, cache) => {
				this.frontmatterIndex.handleMetadataChanged(
					file.path,
					cache?.frontmatter,
				);
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.frontmatterIndex.handleFileDeleted(file.path);
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.frontmatterIndex.handleFileRenamed(file.path, oldPath);
			}),
		);

		const resolveLink = (name: string) => {
			const file = this.app.metadataCache.getFirstLinkpathDest(name, "");
			return file?.path ?? null;
		};
		this.hierarchyService = new HierarchyService(
			this.frontmatterIndex,
			this.adapters.fileSystem,
			resolveLink,
		);

		// Build index after metadataCache is fully loaded.
		// Must be AFTER hierarchy service init so DataLayer can populate archivedSourceUids.
		// onLayoutReady fires synchronously if layout is already ready.
		this.app.workspace.onLayoutReady(() => {
			this.frontmatterIndex.rebuildIndex();
			this.hierarchyService.invalidateGraph();
			this.checkForWhatsNew().catch(() => {});
		});

		this.flashcardManager = new FlashcardManager(
			this.adapters.fileSystem,
			this.adapters.frontmatter,
			this.settings,
			this.adapters.metadataIndex,
			this.frontmatterIndex,
		);
		// Use O(1) indexed lookups for sourceUid → notePath instead of O(n) vault scan
		this.flashcardManager
			.getSourceNoteService()
			.setFrontmatterIndex(this.frontmatterIndex);

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

		const tSetup = performance.now();

		try {
			await this.initializeDeviceAndStore();
		} catch (error) {
			console.error(
				"[True Recall] Critical: Device/store initialization failed:",
				error,
			);
			notify().error("Failed to initialize database. Please restart Obsidian.");
		}

		const tStore = performance.now();

		this.registerView(
			VIEW_TYPE_FLASHCARD_PANEL,
			(leaf) => new FlashcardPanelView(leaf, this),
		);

		this.registerView(VIEW_TYPE_REVIEW, (leaf) => new ReviewView(leaf, this));

		this.registerView(
			VIEW_TYPE_SIMULATOR,
			(leaf) => new SimulatorView(leaf, this),
		);

		this.registerView(
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

		this.registerView(
			VIEW_TYPE_CARD_BROWSER,
			(leaf) => new CardBrowserView(leaf, this),
		);

		this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

		if (ENABLE_RAG) {
			this.registerView(
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

			if (this.settings.ragEnabled && this.settings.proKey) {
				const { RagEmbeddingServiceImpl } = await import(
					"@true-recall/core/rag/retrieval/rag-embedding.service"
				);
				const { RagIndexerService } = await import(
					"@true-recall/obsidian/features/rag/services/rag-indexer.service"
				);
				const { RagSearchService } = await import(
					"@true-recall/core/rag/retrieval/rag-search.service"
				);
				const embedder = new RagEmbeddingServiceImpl(
					new ObsidianHttpClient(),
					this.settings.proKey,
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
			`[True Recall Startup] settings: ${(tSettings - t0).toFixed(1)}ms` +
				` | setup: ${(tSetup - tSettings).toFixed(1)}ms` +
				` | store: ${(tStore - tSetup).toFixed(1)}ms` +
				` | views+commands: ${(tTotal - tStore).toFixed(1)}ms` +
				` | total: ${(tTotal - t0).toFixed(1)}ms`,
		);
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

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.hierarchyService.invalidateGraph();
					this.dataLayer?.invalidateGroups(["cards", "dashboard", "review"]);
				}
			}),
		);

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
		this._unloaded = true;
		this.localApi?.stop();
		this.commandService?.clear();
		this.backgroundBackupManager?.stop();
		this.statusBarWidget?.dispose();
		this.noteStatusCache?.dispose();
		this.dataLayer?.dispose();
		this._disposeCoreCardBridge?.();

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
		this.deviceDiscovery = new DeviceDiscoveryService(
			new ObsidianPersistence(this.app),
			deviceId,
		);
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
			"@true-recall/obsidian/services/release-notes.service"
		);
		const release = await fetchLatestRelease();
		if (!release) return;

		if (release.version !== currentVersion) {
			this.settings.lastSeenVersion = currentVersion;
			await this.saveSettings();
			return;
		}

		const { WhatsNewModal } = await import(
			"@true-recall/obsidian/modals/shared/WhatsNewModal"
		);
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
		databases: import("@true-recall/core/integration/device/device-discovery.service").DeviceDatabaseInfo[],
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
			const s0 = performance.now();

			this.backupRecovery = new BackupRecoveryManager(
				this.app,
				() => this.backupService,
				() => this.backgroundBackupManager,
				() => this.cardStore,
			);

			this.cardStore = new SqliteStoreService(
				this.adapters.persistence,
				deviceId,
			);

			try {
				await this.cardStore.load();
			} catch (loadError) {
				console.warn(
					"[True Recall] Database load failed, attempting auto-recovery from backup...",
				);
				const recovered =
					await this.backupRecovery.tryAutoRecoverFromBackup(deviceId);
				if (recovered) {
					this.cardStore = new SqliteStoreService(
						this.adapters.persistence,
						deviceId,
					);
					await this.cardStore.load();
				} else {
					throw loadError;
				}
			}

			const sDbLoad = performance.now();

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

			// DataLayer: unified reactive data layer (SQL → signals → UI)
			const dl = new DataLayer();
			this.dataLayer = dl;
			setDataLayer(dl);
			registerDataLayerQueries(dl, {
				cardQuery: this.flashcardManager.getCardQueryService(),
				hierarchy: this.hierarchyService,
				getSettings: () => this.settings,
			});

			// Bridge: core mutations → DataLayer invalidation + lastMutation signal
			this._disposeCoreCardBridge = onCoreCardChange((mutation) => {
				setLastMutation(mutation as Parameters<typeof setLastMutation>[0]);
				const groups = mapCoreMutationToGroups(mutation);
				dl.invalidateGroups(groups);
			});

			const sCards = performance.now();

			this.sessionPersistence = new SessionPersistenceService(
				this.adapters.persistence,
				this.cardStore,
				this.dayBoundaryService,
			);
			this.flashcardManager.setSessionPersistence(this.sessionPersistence);

			// Fire-and-forget: migration is idempotent, non-critical for startup
			this.sessionPersistence.migrateStatsJsonToSql().catch((e) => {
				console.error("[True Recall] Stats migration failed:", e);
			});

			this.backupService = new BackupService(
				this.adapters.persistence,
				this.cardStore,
			);
			this.backgroundBackupManager = new BackgroundBackupManager(
				this.backupService,
				this.settings,
				{
					onCardsChanged: (cb) => {
						const allMetaSig = dl.signal("allMeta");
						return effect(() => {
							void allMetaSig?.value;
							cb();
						});
					},
					onMutation: (cb) => onCoreCardChange((m) => cb(m.type)),
				},
			);

			if (
				this.settings.periodicBackupEnabled ||
				this.settings.activityTriggeredBackup
			) {
				this.backgroundBackupManager.start();
			}

			// Fire-and-forget: backup has no downstream dependencies
			if (this.settings.autoBackupOnLoad) {
				this.backupRecovery.runAutoBackup().catch((e) => {
					console.warn("[True Recall] Auto-backup failed:", e);
				});
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

			const sEnd = performance.now();
			console.debug(
				`[True Recall Startup]   db.load: ${(sDbLoad - s0).toFixed(1)}ms` +
					` | dataLayer: ${(sCards - sDbLoad).toFixed(1)}ms` +
					` | services: ${(sEnd - sCards).toFixed(1)}ms`,
			);
		} catch (error) {
			console.error("[True Recall] Failed to initialize SQLite store:", error);
			notify().error("Failed to load flashcard data. Please restart Obsidian.");
		}
	}

	private initializeStore(): void {
		this.store = createAppStore({
			getSettings: () => this.settings,
		});
	}

	private initializeLinkStatusIndicators(): void {
		if (!this.cardStore || !this.frontmatterIndex) return;

		this.noteStatusCache = createNoteStatusCache();

		this.app.workspace.onLayoutReady(async () => {
			this.initializeStatusBar();

			// Resolve the embeddable editor prototype for live-preview editing
			try {
				const { createEmbeddableEditorClass } = await import(
					"@true-recall/obsidian/editor/shared/embedded-editor"
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
			this.startReview({ mode: "notes", noteNames, dueOnly }).catch((error) => {
				notify().error("Failed to start review session", error);
			});
		};

		const viewPlugin = createLinkStatusViewPlugin(
			this.app,
			this.noteStatusCache,
			this.frontmatterIndex,
			() => this.settings.showLinkStatusIndicators,
			() => this.settings.showDonutsInReview,
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
			() => this.settings.showDonutsInPanel,
			onReviewNote,
			onReviewNotes,
		);
		this.registerMarkdownPostProcessor(postProcessor);
	}

	private initializeStatusBar(): void {
		void import(
			"@true-recall/obsidian/editor/study/widgets/StatusBarWidget"
		).then(({ StatusBarWidget }) => {
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
		});
	}

	private initializeDashboardCodeblocks(): void {
		import("@true-recall/obsidian/editor/study/widgets/DashboardCodeblock")
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
				let sourceUid = await frontmatterService.getSourceNoteUid(
					activeFile.path,
				);
				if (!sourceUid) {
					sourceUid = frontmatterService.generateUid();
					await frontmatterService.setSourceNoteUid(activeFile.path, sourceUid);
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
		const extension = createSelectionToolbarExtension({
			onGenerate: (text) => generateFlashcardsFromSelection(this, text),
			onEdit: (text) => editSelectionAsFlashcard(this, text),
			onQuickAdd: (text) => quickAddFlashcardFromSelection(this, text),
			onImageOcclusion: (imagePath) => this.handleImageOcclusion(imagePath),
			hasApiKey: () => hasApiKey(this),
			isEnabled: () => this.settings.selectionToolbarEnabled,
		});

		this.registerEditorExtension([extension]);

		// Image click toolbar (Quick+ and IO on image click)
		void import("@true-recall/obsidian/editor/ai/ImageToolbarPlugin").then(
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
								file.path,
								file.basename,
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
		void import(
			"@true-recall/obsidian/editor/study/SourceHighlightPlugin"
		).then(({ createSourceHighlightExtension }) => {
			this.registerEditorExtension(
				createSourceHighlightExtension(
					() => this.app.workspace.getActiveFile()?.path,
				),
			);
		});
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
