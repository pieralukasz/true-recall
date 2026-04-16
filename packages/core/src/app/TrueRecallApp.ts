import { DEFAULT_SETTINGS } from "../constants";
import { DomainEventBus } from "../events/event-bus";
import { FlashcardManager } from "../flashcard/flashcard.service";
import type { IFileSystem } from "../interfaces/file-system";
import type { IFrontmatter } from "../interfaces/frontmatter";
import type { IHttpClient } from "../interfaces/http-client";
import type { ILinkResolver } from "../interfaces/link-resolver";
import type { IMetadataIndex } from "../interfaces/metadata-index";
import type { INotification } from "../interfaces/notification";
import type { IPersistence } from "../interfaces/persistence";
import type { ISettingsPersistence } from "../interfaces/settings-persistence";
import type { IUidRemovalPrompt } from "../interfaces/uid-removal-prompt";
import type { IVaultEventBridge } from "../interfaces/vault-events";
import { FSRSHelperService } from "../metrics/fsrs-tools";
import { BackgroundBackupManager } from "../persistence/backup/background-backup.service";
import { BackupService } from "../persistence/backup/backup.service";
import { SessionPersistenceService } from "../persistence/session/session-persistence.service";
import { SqliteStoreService } from "../persistence/sqlite";
import { FSRSService } from "../services/fsrs/fsrs.service";
import { FrontmatterIndexService } from "../services/notes/frontmatter-index.service";
import { HierarchyService } from "../services/notes/hierarchy.service";
import { NoteTypeService } from "../services/notes/note-type.service";
import { PresetService } from "../services/notes/preset.service";
import { DayBoundaryService } from "../services/review/day-boundary.service";
import type { TrueRecallSettings } from "../types";
import { extractFSRSSettings } from "../types";
import { migrateSettings } from "./settings-migration";

export interface TrueRecallAppConfig {
	fileSystem: IFileSystem;
	frontmatter: IFrontmatter;
	metadataIndex: IMetadataIndex;
	persistence: IPersistence;
	notification: INotification;
	httpClient: IHttpClient;
	settingsPersistence: ISettingsPersistence;
	linkResolver: ILinkResolver;
	vaultEvents: IVaultEventBridge;
	uidRemovalPrompt?: IUidRemovalPrompt;
}

export class TrueRecallApp {
	readonly events = new DomainEventBus();

	readonly frontmatterIndex: FrontmatterIndexService;
	readonly hierarchyService: HierarchyService;
	readonly flashcardManager: FlashcardManager;
	readonly presetService: PresetService;
	readonly fsrsService: FSRSService;
	readonly dayBoundary: DayBoundaryService;

	cardStore: SqliteStoreService | null = null;
	sessionPersistence: SessionPersistenceService | null = null;
	backupService: BackupService | null = null;
	backgroundBackupManager: BackgroundBackupManager | null = null;
	noteTypeService: NoteTypeService | null = null;
	fsrsHelper: FSRSHelperService | null = null;

	settings!: TrueRecallSettings;

	private readonly config: TrueRecallAppConfig;
	private disposers: (() => void)[] = [];

	constructor(config: TrueRecallAppConfig) {
		this.config = config;

		this.frontmatterIndex = new FrontmatterIndexService(config.metadataIndex);

		this.hierarchyService = new HierarchyService(
			this.frontmatterIndex,
			config.fileSystem,
			(name) => config.linkResolver.resolveLink(name),
		);

		this.settings = DEFAULT_SETTINGS;

		this.flashcardManager = new FlashcardManager(
			config.fileSystem,
			config.frontmatter,
			this.settings,
			config.metadataIndex,
			this.frontmatterIndex,
		);
		this.flashcardManager
			.getSourceNoteService()
			.setFrontmatterIndex(this.frontmatterIndex);

		this.presetService = new PresetService(
			() => this.settings,
			() => this.updateSettings(this.settings),
			this.frontmatterIndex,
			this.hierarchyService,
			() => this.cardStore ?? null,
		);

		this.fsrsService = new FSRSService(extractFSRSSettings(this.settings));
		this.dayBoundary = new DayBoundaryService(this.settings.dayStartHour);
	}

	async initialize(): Promise<void> {
		// 1. Load & migrate settings
		const raw = await this.config.settingsPersistence.load();
		const { settings, needsSave } = migrateSettings(raw);
		this.settings = settings;

		if (needsSave) {
			await this.config.settingsPersistence.save(settings);
		}

		// 2. Update services with real settings + wire event bus
		this.flashcardManager.updateSettings(this.settings);
		this.flashcardManager.setEventBus(this.events);
		this.fsrsService.updateSettings(extractFSRSSettings(this.settings));
		this.dayBoundary.updateDayStartHour(this.settings.dayStartHour);

		// 3. Register frontmatter fields
		this.registerFrontmatterFields();

		// 4. Wire vault events → frontmatter index
		this.wireVaultEvents();

		// 5. Wire frontmatter field changes → domain events
		this.wireFrontmatterFieldChanges();

		// 6. Rebuild index when layout ready
		this.config.vaultEvents.onLayoutReady(() => {
			this.frontmatterIndex.rebuildIndex();
			this.hierarchyService.invalidateGraph();
		});
	}

	async initializeStore(deviceId: string): Promise<void> {
		this.cardStore = new SqliteStoreService(this.config.persistence, deviceId);
		await this.cardStore.load();

		this.flashcardManager.setStore(this.cardStore);

		this.sessionPersistence = new SessionPersistenceService(
			this.config.persistence,
			this.cardStore,
			this.dayBoundary,
		);
		this.flashcardManager.setSessionPersistence(this.sessionPersistence);

		this.sessionPersistence.migrateStatsJsonToSql().catch((e) => {
			console.error("[TrueRecallApp] Stats migration failed:", e);
		});

		this.backupService = new BackupService(
			this.config.persistence,
			this.cardStore,
		);

		this.backgroundBackupManager = new BackgroundBackupManager(
			this.backupService,
			this.settings,
			{
				onCardsChanged: (cb) => {
					return this.events.on("cards:bulk", () => cb());
				},
				onMutation: (cb) => {
					return this.events.onAny(
						[
							"card:added",
							"card:updated",
							"card:removed",
							"card:reviewed",
							"cards:bulk",
						],
						(event) => {
							// Strip "card:" prefix for legacy BackgroundBackupManager compatibility
							const legacyType = event.replace(/^card:/, "");
							cb(legacyType);
						},
					);
				},
			},
		);

		if (
			this.settings.periodicBackupEnabled ||
			this.settings.activityTriggeredBackup
		) {
			this.backgroundBackupManager.start();
		}

		const store = this.cardStore;
		this.noteTypeService = new NoteTypeService({
			noteTypeActions: store.noteTypes,
			noteActions: {
				getByNoteTypeId: (id) => store.notes.getByNoteTypeId(id),
				countByNoteType: (id) => store.notes.countByNoteType(id),
			},
		});
		this.noteTypeService.initialize();

		this.fsrsHelper = new FSRSHelperService(this.cardStore, this.settings);

		this.events.emit("store:ready", {});
	}

	async updateSettings(patch: Partial<TrueRecallSettings>): Promise<void> {
		Object.assign(this.settings, patch);

		try {
			await this.config.settingsPersistence.save(this.settings);
		} catch (e) {
			console.error("[TrueRecallApp] Failed to persist settings:", e);
		}

		this.flashcardManager.updateSettings(this.settings);
		this.fsrsService.updateSettings(extractFSRSSettings(this.settings));
		this.dayBoundary.updateDayStartHour(this.settings.dayStartHour);
		this.fsrsHelper?.updateSettings(this.settings);
		this.backgroundBackupManager?.updateConfig(this.settings);
		this.hierarchyService.invalidateGraph();

		this.events.emit("settings:changed", {});
	}

	async shutdown(): Promise<void> {
		this.backgroundBackupManager?.stop();
		if (this.cardStore) {
			try {
				await this.cardStore.saveNow({ bestEffort: true });
			} catch (e) {
				console.error("[TrueRecallApp] Final data flush failed:", e);
			}
		}
		for (const dispose of this.disposers) {
			try {
				dispose();
			} catch (e) {
				console.error("[TrueRecallApp] Disposer error during shutdown:", e);
			}
		}
		this.disposers = [];
		this.events.emit("store:shutdown", {});
		this.events.dispose();
	}

	isReady(): boolean {
		return this.cardStore !== null;
	}

	private registerFrontmatterFields(): void {
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
		this.frontmatterIndex.register({
			field: "project",
			type: "string",
			unique: false,
		});
	}

	private wireVaultEvents(): void {
		const ve = this.config.vaultEvents;

		this.disposers.push(
			ve.onMetadataChanged((path, frontmatter) => {
				this.frontmatterIndex.handleMetadataChanged(path, frontmatter);
			}),
		);

		this.disposers.push(
			ve.onFileDeleted((path) => {
				this.frontmatterIndex.handleFileDeleted(path);
			}),
		);

		this.disposers.push(
			ve.onFileRenamed((newPath, oldPath) => {
				this.frontmatterIndex.handleFileRenamed(newPath, oldPath);
			}),
		);
	}

	private wireFrontmatterFieldChanges(): void {
		this.frontmatterIndex.onFieldChange("parents", () => {
			this.hierarchyService.invalidateGraph();
			this.events.emit("hierarchy:changed", {});
		});
		this.frontmatterIndex.onFieldChange("include", () => {
			this.hierarchyService.invalidateGraph();
			this.events.emit("hierarchy:changed", {});
		});
		this.frontmatterIndex.onFieldChange("project", () => {
			this.hierarchyService.invalidateGraph();
			this.events.emit("hierarchy:changed", {});
		});
		this.frontmatterIndex.onFieldChange("archive", () => {
			this.hierarchyService.invalidateGraph();
			this.events.emit("hierarchy:changed", {});
		});
		this.frontmatterIndex.onFieldChange("fsrs_preset", () => {
			this.events.emit("settings:changed", {});
		});
		this.frontmatterIndex.onFieldChange("flashcard_uid", () => {
			this.events.emit("hierarchy:changed", {});
		});
	}
}
