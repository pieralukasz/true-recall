import { Plugin, type TFile } from "obsidian";

import type { TrueRecallApp } from "@true-recall/core/app";
import type { DeletionHandlerService } from "@true-recall/core/flashcard/lifecycle/deletion-handler.service";
import type { DeviceDiscoveryService } from "@true-recall/core/integration/device/device-discovery.service";
import type { DeviceIdService } from "@true-recall/core/integration/device/device-id.service";
import { getDeviceDbPath } from "@true-recall/core/persistence/sqlite/db-location";
import { DB_FOLDER } from "@true-recall/core/persistence/sqlite/sqlite.types";
import type { TrueRecallSettings } from "@true-recall/core/types";
import type { SessionConfig } from "@true-recall/core/types/session-config.types";

import type { CommandService } from "@true-recall/obsidian/commands";
import type { DataLayer } from "@true-recall/obsidian/data";
import type { AIWorkspaceMode } from "@true-recall/obsidian/features/assistant/ui/ai-workspace-modes";
import type { NoteStatusCache } from "@true-recall/obsidian/features/core/cache/note-status-cache.service";
import { ReviewSessionController } from "@true-recall/obsidian/features/study/services/ReviewSessionController";
import type { SessionFilters } from "@true-recall/obsidian/features/study/ui/review/review.types";
import type { CustomStudyModalScope } from "@true-recall/obsidian/modals/study/CustomStudyModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ProjectManagementService } from "@true-recall/obsidian/services/project-management.service";
import type { AppStore } from "@true-recall/obsidian/store";
import { drainAssistantEditorRequests } from "@true-recall/obsidian/views/modal-window/assistant-editor-registry";
import { drainCardTypesEditorRequests } from "@true-recall/obsidian/views/modal-window/card-types-editor-registry";
import { drainNoteTypeManagerRequests } from "@true-recall/obsidian/views/modal-window/note-type-manager-registry";

import type { ObsidianAdapters } from "./context";
import type { CloudSyncManager } from "./features/integration/cloud/cloud-sync-manager";
import type { LocalApiServer } from "./plugin/api/LocalApiServer";
import type { BackupRecoveryManager } from "./plugin/BackupRecoveryManager";
import type { CrossDeviceSyncCoordinator } from "./plugin/CrossDeviceSyncCoordinator";
import { ImportExportCoordinator } from "./plugin/runtime/ImportExportCoordinator";
import { NoteActions } from "./plugin/runtime/NoteActions";
import { PluginRuntime } from "./plugin/runtime/PluginRuntime";
import { StudySessionLauncher } from "./plugin/runtime/StudySessionLauncher";
import { TemporaryStudyDeckService } from "./plugin/runtime/TemporaryStudyDeckService";
import { ViewNavigator } from "./plugin/runtime/ViewNavigator";
import { applyTabBarClass, HIDE_TAB_BAR_CLASS } from "./plugin/tab-bar";
import type {
	IOEditorMode,
	IOEditorResult,
} from "@true-recall/plugins/image-occlusion";
import type { StatusBarWidget } from "@true-recall/plugins/status-bar-widget/StatusBarWidget";

export default class TrueRecallPlugin extends Plugin {
	private runtime = new PluginRuntime(this, () => this._unloaded);
	private studyLauncher = new StudySessionLauncher(this);
	private temporaryStudy = new TemporaryStudyDeckService(this);
	private navigator = new ViewNavigator(this);
	private importExport = new ImportExportCoordinator(this);
	private noteActions = new NoteActions(this);

	coreApp!: TrueRecallApp;

	// Backward-compat getters — all existing code reads plugin.settings, plugin.cardStore, etc.
	// Obsidian 1.13 declares `settings?: unknown` as a plain property on Plugin;
	// we intentionally shadow it with an accessor that delegates to coreApp.
	// @ts-expect-error TS2611 accessor-over-property override is deliberate
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
	/** Folder holding this device's database; decided at startup by sync mode. */
	dbFolder: string = DB_FOLDER;
	syncCoordinator: CrossDeviceSyncCoordinator | null = null;
	cloudSyncManager: CloudSyncManager | null = null;
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

	/** Single source of truth for the device database path. */
	getDeviceDbPath(deviceId?: string): string {
		const id = deviceId ?? this.deviceIdService?.getDeviceId();
		if (!id) throw new Error("Device id is not initialized");
		return getDeviceDbPath(id, this.dbFolder);
	}

	async onload(): Promise<void> {
		await this.runtime.load();
	}

	teardownSharedVaultSync(): void {
		this.runtime.stopSharedVaultSync();
	}

	onunload(): void {
		this._unloaded = true;
		document.body.classList.remove(HIDE_TAB_BAR_CLASS);
		this.pluginLoader?.deactivateAll();
		this.runtime.stopSharedVaultSync();
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
		await this.saveSettings({ hideTabBar: !this.settings.hideTabBar });
		this.applyTabBarVisibility();
	}

	/**
	 * Switch between the due-date queue and R-Mode. Card data is untouched
	 * either way — both modes read the same scheduling state — so this is
	 * reversible at any point.
	 */
	async toggleRMode(): Promise<void> {
		const rMode = {
			...this.settings.rMode,
			enabled: !this.settings.rMode.enabled,
		};
		await this.saveSettings({ rMode });
		notify().info(
			rMode.enabled
				? "R-Mode on — sessions are picked by retrievability"
				: "R-Mode off — back to the due queue",
		);
	}

	async saveSettings(patch?: Partial<TrueRecallSettings>): Promise<void> {
		await this.coreApp.updateSettings(patch ?? this.settings);
		this.noteStatusCache?.bumpVersion();
		// Apply plugin enable/disable toggles (and tier unlocks) without restart
		this.pluginLoader?.sync();
	}

	async activateView(): Promise<void> {
		return this.navigator.activateView();
	}

	async openSimulator(): Promise<void> {
		return this.navigator.openSimulator();
	}

	async startReview(config: SessionConfig): Promise<void> {
		return this.studyLauncher.startReview(config);
	}

	async startTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		return this.temporaryStudy.startTemporaryCustomStudyDeck(deckId);
	}

	async rebuildTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		return this.temporaryStudy.rebuildTemporaryCustomStudyDeck(deckId);
	}

	async emptyTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		return this.temporaryStudy.emptyTemporaryCustomStudyDeck(deckId);
	}

	async deleteTemporaryCustomStudyDeck(deckId: string): Promise<void> {
		return this.temporaryStudy.deleteTemporaryCustomStudyDeck(deckId);
	}

	removeCardsFromTemporaryDeck(
		deckId: string | undefined,
		cardIds: readonly string[],
	): void {
		this.temporaryStudy.removeCardsFromTemporaryDeck(deckId, cardIds);
	}

	async openCardBrowser(opts?: {
		sourceUid?: string;
		orphaned?: boolean;
	}): Promise<void> {
		return this.navigator.openCardBrowser(opts);
	}

	async openDashboard(): Promise<void> {
		return this.navigator.openDashboard();
	}

	async openStats(): Promise<void> {
		return this.navigator.openStats();
	}

	async openAssistantInbox(focusThreadId?: string): Promise<void> {
		return this.navigator.openAssistantInbox(focusThreadId);
	}

	async openAssistantWorkspace(mode?: AIWorkspaceMode): Promise<void> {
		return this.navigator.openAssistantWorkspace(mode);
	}

	openCardTypesEditor(noteTypeId?: string): void {
		this.navigator.openCardTypesEditor(noteTypeId);
	}

	openImportStudio(options?: { defaultNoteTypeId?: string }): void {
		this.navigator.openImportStudio(options);
	}

	openQuickNoteEditor(defaultNoteTypeId?: string): void {
		this.navigator.openQuickNoteEditor(defaultNoteTypeId);
	}

	async openImageOcclusionEditor(
		mode: IOEditorMode = { mode: "add" },
	): Promise<IOEditorResult> {
		return this.navigator.openImageOcclusionEditor(mode);
	}

	async openImageOcclusionEditorForActiveNote(): Promise<IOEditorResult> {
		return this.navigator.openImageOcclusionEditorForActiveNote();
	}

	async openCustomStudyModal(scope?: CustomStudyModalScope): Promise<void> {
		return this.temporaryStudy.openCustomStudyModal(scope);
	}

	async reviewCurrentNote(): Promise<void> {
		return this.studyLauncher.reviewCurrentNote();
	}

	async reviewNoteFlashcards(
		file: TFile,
		rModeTargetCount?: number,
	): Promise<void> {
		return this.studyLauncher.reviewNoteFlashcards(file, rModeTargetCount);
	}

	async reviewTodaysCards(): Promise<void> {
		return this.studyLauncher.reviewTodaysCards();
	}

	async openReviewViewWithFilters(
		rawFilters: SessionFilters,
		session: { sessionKey?: string; sessionLabel?: string } = {},
	): Promise<void> {
		return this.studyLauncher.openReviewViewWithFilters(rawFilters, session);
	}

	async createMasterDashboard(): Promise<void> {
		return this.noteActions.createMasterDashboard();
	}

	async setFsrsPresetForCurrentNote(): Promise<void> {
		return this.noteActions.setFsrsPresetForCurrentNote();
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
		return this.importExport.importAnki();
	}

	exportAnki(): void {
		this.importExport.exportAnki();
	}

	exportCsv(): void {
		this.importExport.exportCsv();
	}

	async toggleNoteReview(file?: TFile): Promise<void> {
		return this.noteActions.toggleNoteReview(file);
	}

	async addFlashcardUidToCurrentNote(): Promise<void> {
		return this.noteActions.addFlashcardUidToCurrentNote();
	}
}
