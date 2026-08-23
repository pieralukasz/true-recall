import { normalizePath, TFile } from "obsidian";

import { DeletionHandlerService } from "@true-recall/core/flashcard/lifecycle/deletion-handler.service";
import { UidGuardianService } from "@true-recall/core/flashcard/lifecycle/uid-guardian.service";
import { DeviceDiscoveryService } from "@true-recall/core/integration/device/device-discovery.service";
import { DeviceIdService } from "@true-recall/core/integration/device/device-id.service";
import { writeDbFileAtomically } from "@true-recall/core/persistence/sqlite/atomic-db-file";
import { setCurrentDeviceId } from "@true-recall/core/persistence/sqlite/device-context";
import {
	DB_FOLDER,
	getDeviceDbFilename,
	SAFETY_FLUSH_INTERVAL_MS,
} from "@true-recall/core/persistence/sqlite/sqlite.types";

import { ObsidianDeviceIdStorage } from "@true-recall/obsidian/adapters/ObsidianDeviceIdStorage";
import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import { ObsidianUidPrompt } from "@true-recall/obsidian/adapters/ObsidianUidPrompt";
import {
	DataLayer,
	G,
	registerQueries as registerDataLayerQueries,
	setDataLayer,
	wireDataLayer,
} from "@true-recall/obsidian/data";
import { createNoteStatusCache } from "@true-recall/obsidian/features/core/cache/note-status-cache.service";
import type { DeviceSelectionResult } from "@true-recall/obsidian/modals/integration/DeviceSelectionModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { createAppStore } from "@true-recall/obsidian/store";
import { isMobile } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../main";
import { AssistantService } from "../services/assistant/assistant.service";
import { BackupRecoveryManager } from "./BackupRecoveryManager";
import { DayRolloverWatcher } from "./DayRolloverWatcher";
import { PersistenceLifecycleGuard } from "./PersistenceLifecycleGuard";
import { PluginLoader } from "./plugin-loader";
import { isPluginEnabled } from "./plugin-utils";

const AUTO_BACKUP_STARTUP_DELAY_MS = 10_000;

export async function initializeDeviceAndStore(
	plugin: TrueRecallPlugin,
): Promise<void> {
	try {
		const deviceId = await initializeDeviceContext(plugin);
		await initializeCardStore(plugin, deviceId);
	} catch (error) {
		console.error("[True Recall] Failed to initialize device context:", error);
		notify().error(
			"Failed to initialize device context. Using default configuration.",
		);
		plugin.deviceIdService = new DeviceIdService(
			new ObsidianDeviceIdStorage(plugin.app),
		);
		const fallbackDeviceId = plugin.deviceIdService.getDeviceId();
		setCurrentDeviceId(fallbackDeviceId);
		await initializeCardStore(plugin, fallbackDeviceId);
	}
}

async function initializeDeviceContext(
	plugin: TrueRecallPlugin,
): Promise<string> {
	// The device ID must never be adopted from synced settings (data.json):
	// a fresh install inheriting another device's ID would write to the same
	// database file and the two devices would overwrite each other's exports.
	plugin.deviceIdService = new DeviceIdService(
		new ObsidianDeviceIdStorage(plugin.app),
	);
	const deviceId = plugin.deviceIdService.getDeviceId();
	setCurrentDeviceId(deviceId);
	plugin.deviceDiscovery = new DeviceDiscoveryService(
		new ObsidianPersistence(plugin.app),
		deviceId,
	);
	const deviceDbPath = normalizePath(
		`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`,
	);
	const deviceDbExists = await plugin.app.vault.adapter.exists(deviceDbPath);

	if (deviceDbExists) return deviceId;

	const databases = await plugin.deviceDiscovery.discoverDeviceDatabases();
	const hasLegacy = await plugin.deviceDiscovery.hasLegacyDatabase();

	if (hasLegacy && databases.length === 0) {
		await migrateLegacyDatabase(plugin, deviceId);
	} else if (databases.length > 0) {
		// Obsidian withholds the rest of its own startup until onload()
		// resolves, so prompting the user here parks the whole app behind
		// "Plugin is taking long to load" until they answer, and the plugin
		// stays dead for as long as they do not. Discovery itself was just as
		// costly: it read every candidate database in full. Start with an
		// empty database and offer the import once the workspace is
		// interactive; importing requires a restart either way.
		scheduleDeviceImportOffer(plugin, deviceId, hasLegacy);
	}

	return deviceId;
}

/**
 * Ask, after layout-ready, whether this new device should be seeded from
 * another device's database. Never awaited by onload (see above). Runs at
 * most once per device: the empty store flushes its own database file during
 * startup, so the next launch takes the `deviceDbExists` shortcut.
 */
function scheduleDeviceImportOffer(
	plugin: TrueRecallPlugin,
	deviceId: string,
	hasLegacy: boolean,
): void {
	plugin.app.workspace.onLayoutReady(() => {
		void (async () => {
			try {
				// Card counts are worth a file read only where the UI can afford
				// it; on mobile the picker shows size and date alone.
				const databases =
					(await plugin.deviceDiscovery?.discoverDeviceDatabases({
						withStats: !isMobile(),
					})) ?? [];
				if (databases.length === 0) return;

				const { DeviceSelectionModal } = await import(
					"@true-recall/obsidian/modals/integration/DeviceSelectionModal"
				);
				const result = await new DeviceSelectionModal(plugin.app, {
					databases,
					hasLegacy,
				}).openAndWait();
				if (result.cancelled || result.action !== "import") return;

				// The empty store loaded during startup must never flush again:
				// its debounced save would overwrite the file just imported.
				plugin.coreApp.cardStore?.haltPersistence();
				await handleDeviceSelection(plugin, result, deviceId);
			} catch (error) {
				console.error("[True Recall] Device import offer failed:", error);
			}
		})();
	});
}

async function initializeCardStore(
	plugin: TrueRecallPlugin,
	deviceId: string,
): Promise<void> {
	try {
		const s0 = performance.now();

		plugin.backupRecovery = new BackupRecoveryManager(
			plugin.app,
			() => plugin.coreApp.backupService,
			() => plugin.coreApp.backgroundBackupManager,
			() => plugin.coreApp.cardStore ?? undefined,
		);

		try {
			await plugin.coreApp.initializeStore(deviceId);
		} catch (loadError) {
			console.warn(
				"[True Recall] Database load failed, attempting auto-recovery from backup...",
			);
			const recovered =
				await plugin.backupRecovery.tryAutoRecoverFromBackup(deviceId);
			if (recovered) {
				await plugin.coreApp.initializeStore(deviceId);
			} else {
				throw loadError;
			}
		}

		// Store a readable device name in the database itself so other devices
		// can show "iPhone 15" instead of a bare device id when syncing.
		const deviceLabel = plugin.deviceIdService?.getDeviceLabel();
		if (deviceLabel && plugin.coreApp.cardStore) {
			plugin.coreApp.cardStore.cards.setSyncMetadata(
				"device:label",
				deviceLabel,
			);
		}

		const sDbLoad = performance.now();

		plugin.registerInterval(
			window.setInterval(() => {
				if (plugin.coreApp.cardStore) {
					void plugin.coreApp.cardStore.saveNow();
				}
			}, SAFETY_FLUSH_INTERVAL_MS),
		);

		new PersistenceLifecycleGuard(() => plugin.coreApp.cardStore).register(
			plugin,
		);

		const dl = new DataLayer();
		plugin.dataLayer = dl;
		setDataLayer(dl);
		registerDataLayerQueries(dl, {
			cardQuery: plugin.flashcardManager.getCardQueryService(),
			hierarchy: plugin.hierarchyService,
			getSettings: () => plugin.settings,
			getAssistantTasks: () => plugin.cardStore?.assistantTasks.list(100) ?? [],
			getAssistantThreads: () =>
				plugin.cardStore?.assistantThreads.list(undefined, 100) ?? [],
			getAssistantInbox: () =>
				plugin.cardStore?.assistantThreads.list("inbox", 100) ?? [],
		});

		plugin._disposeWireDataLayer = wireDataLayer(dl, plugin.coreApp.events);

		plugin.assistantService = new AssistantService(plugin);
		if (isPluginEnabled(plugin.settings, "ai-assistant")) {
			plugin.assistantService.start();
		}

		new DayRolloverWatcher(plugin.dayBoundaryService, dl).register(plugin);

		// Startup race fix: rebuildIndex() runs in an earlier onLayoutReady with
		// silent=true, so no domain events fire and the DataLayer keeps stale
		// enrichment data. Re-execute CARDS loaders once the index is populated.
		plugin.app.workspace.onLayoutReady(() => {
			dl.invalidateGroups([G.CARDS]);
			void migrateArchiveCascade(plugin);
		});

		// Second startup race: layout-ready is not a metadata-cache-ready signal.
		// On a cold start getFileCache() can still return null for most files at
		// layout-ready, so the rebuild above snapshots an empty index and every
		// card renders as orphaned until individual "changed" events trickle in.
		// Re-run the rebuild once the cache reports the initial scan finished.
		let initialResolveHandled = false;
		plugin.registerEvent(
			plugin.app.metadataCache.on("resolved", () => {
				if (initialResolveHandled) return;
				initialResolveHandled = true;
				plugin.frontmatterIndex?.rebuildIndex();
				plugin.hierarchyService.invalidateGraph();
				dl.invalidateGroups([
					G.CARDS,
					G.BROWSER,
					G.DASHBOARD,
					G.PANEL,
					G.REVIEW,
				]);
			}),
		);

		const sCards = performance.now();

		if (plugin.settings.autoBackupOnLoad) {
			// Defer past layout-ready: the snapshot exports + gzips the whole DB,
			// which would otherwise compete with vault indexing and view restore.
			plugin.app.workspace.onLayoutReady(() => {
				plugin.registerInterval(
					window.setTimeout(() => {
						plugin.backupRecovery?.runAutoBackup().catch((e) => {
							console.warn("[True Recall] Auto-backup failed:", e);
						});
					}, AUTO_BACKUP_STARTUP_DELAY_MS),
				);
			});
		}

		initializeDeletionHandler(plugin);
		initializeAppStore(plugin);
		initializeCoreWidgets(plugin);

		plugin.pluginLoader = new PluginLoader(plugin);
		plugin.pluginLoader.activateAll();

		initializeSourceHighlight(plugin);

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

function initializeDeletionHandler(plugin: TrueRecallPlugin): void {
	if (
		!plugin.coreApp.cardStore ||
		!plugin.frontmatterIndex ||
		!plugin.coreApp.sessionPersistence
	)
		return;

	plugin.deletionHandler = new DeletionHandlerService({
		frontmatterIndex: plugin.frontmatterIndex,
		store: plugin.coreApp.cardStore,
		sessionPersistence: plugin.coreApp.sessionPersistence,
		bus: plugin.coreApp.events,
		notification: notify(),
	});

	// Must run before the frontmatter index drops the deleted file's UID —
	// a plain vault "delete" listener would fire after the core app's index
	// cleanup and orphan the note's cards.
	plugin.coreApp.registerFileDeletionHook((path) =>
		plugin.deletionHandler?.handleFileDeletion(path),
	);

	plugin.registerEvent(
		plugin.app.vault.on("delete", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				plugin.hierarchyService.invalidateGraph();
				plugin.dataLayer?.invalidateGroups([
					G.CARDS,
					G.BROWSER,
					G.DASHBOARD,
					G.PANEL,
					G.REVIEW,
				]);
			}
		}),
	);

	const uidGuardian = new UidGuardianService({
		frontmatterIndex: plugin.frontmatterIndex,
		store: plugin.coreApp.cardStore,
		sessionPersistence: plugin.coreApp.sessionPersistence,
		frontmatterService: plugin.flashcardManager.getFrontmatterService(),
		prompt: new ObsidianUidPrompt(plugin.app),
		notification: plugin.adapters.notification,
		bus: plugin.coreApp.events,
	});
	uidGuardian.register();
}

function initializeAppStore(plugin: TrueRecallPlugin): void {
	plugin.store = createAppStore({
		getSettings: () => plugin.settings,
	});
}

/** Core widget setup that must run before plugin activation. */
function initializeCoreWidgets(plugin: TrueRecallPlugin): void {
	if (!plugin.coreApp.cardStore || !plugin.frontmatterIndex) return;

	plugin.noteStatusCache = createNoteStatusCache();

	plugin.app.workspace.onLayoutReady(async () => {
		try {
			const { createEmbeddableEditorClass } = await import(
				"@true-recall/obsidian/editor/shared/embedded-editor"
			);
			plugin.EmbeddableEditor = createEmbeddableEditorClass(plugin.app);
		} catch (e) {
			console.warn("[TrueRecall] Failed to resolve editor prototype:", e);
		}
	});
}

function initializeSourceHighlight(plugin: TrueRecallPlugin): void {
	void import("@true-recall/obsidian/editor/study/SourceHighlightPlugin").then(
		({ createSourceHighlightExtension }) => {
			plugin.registerEditorExtension(
				createSourceHighlightExtension(
					() => plugin.app.workspace.getActiveFile()?.path,
				),
			);
		},
	);
}

export async function checkForWhatsNew(
	plugin: TrueRecallPlugin,
): Promise<void> {
	const currentVersion = plugin.manifest.version;
	if (plugin.settings.lastSeenVersion === currentVersion) return;

	if (plugin.settings.lastSeenVersion === undefined) {
		plugin.settings.lastSeenVersion = currentVersion;
		await plugin.saveSettings();
		return;
	}

	const { fetchLatestRelease } = await import(
		"@true-recall/obsidian/services/release-notes.service"
	);
	const release = await fetchLatestRelease();
	if (!release) return;

	if (release.version !== currentVersion) {
		plugin.settings.lastSeenVersion = currentVersion;
		await plugin.saveSettings();
		return;
	}

	const { WhatsNewModal } = await import(
		"@true-recall/obsidian/modals/shared/WhatsNewModal"
	);
	new WhatsNewModal(plugin, release).open();
	plugin.settings.lastSeenVersion = currentVersion;
	await plugin.saveSettings();
}

async function migrateLegacyDatabase(
	plugin: TrueRecallPlugin,
	deviceId: string,
): Promise<void> {
	const legacyPath = normalizePath(`${DB_FOLDER}/true-recall.db`);
	const newPath = normalizePath(
		`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`,
	);
	const backupPath = normalizePath(`${DB_FOLDER}/true-recall.db.migrated`);

	try {
		const data = await plugin.app.vault.adapter.readBinary(legacyPath);
		await plugin.app.vault.adapter.writeBinary(backupPath, data);
		await plugin.app.vault.adapter.rename(legacyPath, newPath);
		notify().success("Database migrated to per-device format.");
	} catch (error) {
		console.error("[True Recall] Legacy migration failed:", error);
		notify().error("Failed to migrate legacy database.");
		throw error;
	}
}

async function handleDeviceSelection(
	plugin: TrueRecallPlugin,
	result: DeviceSelectionResult,
	deviceId: string,
): Promise<void> {
	if (result.action === "import" && result.sourcePath) {
		const targetPath = normalizePath(
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`,
		);

		try {
			const sourceData = await plugin.app.vault.adapter.readBinary(
				result.sourcePath,
			);
			// Atomic swap: an interrupted import must not leave a truncated
			// live database behind.
			await writeDbFileAtomically(
				new ObsidianPersistence(plugin.app),
				targetPath,
				sourceData,
			);
			notify().success(
				`Imported data from device ${result.sourceDeviceId}. Restart Obsidian to load it.`,
			);
		} catch (error) {
			console.error("[True Recall] Database import failed:", error);
			notify().error("Failed to import database.");
			throw error;
		}
	}
}

async function migrateArchiveCascade(plugin: TrueRecallPlugin): Promise<void> {
	if (plugin.settings.archiveCascadeMigrated) return;

	const hierarchy = plugin.coreApp.hierarchyService;
	const frontmatterIndex = plugin.coreApp.frontmatterIndex;

	const archivedProjectPaths = frontmatterIndex
		.getFilesByValue("archive", "true")
		.filter(
			(path) =>
				hierarchy.getChildPaths(path).length > 0 ||
				hierarchy.isExplicitProject(path),
		);

	if (archivedProjectPaths.length > 0) {
		for (const projectPath of archivedProjectPaths) {
			const descendants = hierarchy.getDescendantPaths(projectPath);
			for (const descPath of descendants) {
				if (!hierarchy.isNoteArchived(descPath)) {
					const file = plugin.app.vault.getAbstractFileByPath(descPath);
					if (file instanceof TFile) {
						await plugin.flashcardManager
							.getFrontmatterService()
							.setArchive(file.path, true);
					}
				}
			}
		}
		hierarchy.invalidateGraph();
		// Pair the graph invalidation with a DataLayer refresh (rule: every
		// invalidateGraph needs one) — otherwise archived-derived counts stay
		// stale until the async frontmatter events trickle in.
		plugin.dataLayer?.invalidateGroups([
			G.CARDS,
			G.BROWSER,
			G.DASHBOARD,
			G.PANEL,
			G.REVIEW,
		]);
	}

	plugin.settings.archiveCascadeMigrated = true;
	await plugin.saveSettings();
}
