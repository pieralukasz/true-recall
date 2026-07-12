import { normalizePath, TFile } from "obsidian";

import { DeletionHandlerService } from "@true-recall/core/flashcard/lifecycle/deletion-handler.service";
import { UidGuardianService } from "@true-recall/core/flashcard/lifecycle/uid-guardian.service";
import { DeviceDiscoveryService } from "@true-recall/core/integration/device/device-discovery.service";
import { DeviceIdService } from "@true-recall/core/integration/device/device-id.service";
import {
	DB_FOLDER,
	getDeviceDbFilename,
	SAFETY_FLUSH_INTERVAL_MS,
} from "@true-recall/core/persistence/sqlite/sqlite.types";

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

import type TrueRecallPlugin from "../main";
import { BackupRecoveryManager } from "./BackupRecoveryManager";
import { DayRolloverWatcher } from "./DayRolloverWatcher";
import { registerDeletionHandler } from "./PluginEventHandlers";
import { PluginLoader } from "./plugin-loader";

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
		plugin.deviceIdService = new DeviceIdService(plugin.settings.deviceId);
		await initializeCardStore(plugin, plugin.deviceIdService.getDeviceId());
	}
}

async function initializeDeviceContext(
	plugin: TrueRecallPlugin,
): Promise<string> {
	plugin.deviceIdService = new DeviceIdService(
		plugin.settings.deviceId,
		(newId) => {
			plugin.settings.deviceId = newId;
			void plugin.saveSettings();
		},
	);
	const deviceId = plugin.deviceIdService.getDeviceId();
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
		const { DeviceSelectionModal } = await import(
			"@true-recall/obsidian/modals/integration/DeviceSelectionModal"
		);
		const modal = new DeviceSelectionModal(plugin.app, {
			databases,
			hasLegacy,
		});
		const result = await modal.openAndWait();
		if (!result.cancelled) {
			await handleDeviceSelection(plugin, result, deviceId);
		}
	}

	return deviceId;
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

		const sDbLoad = performance.now();

		plugin.registerInterval(
			window.setInterval(() => {
				if (plugin.coreApp.cardStore) {
					void plugin.coreApp.cardStore.saveNow();
				}
			}, SAFETY_FLUSH_INTERVAL_MS),
		);

		const dl = new DataLayer();
		plugin.dataLayer = dl;
		setDataLayer(dl);
		registerDataLayerQueries(dl, {
			cardQuery: plugin.flashcardManager.getCardQueryService(),
			hierarchy: plugin.hierarchyService,
			getSettings: () => plugin.settings,
			getAssistantTasks: () => plugin.cardStore?.assistantTasks.list(100) ?? [],
		});

		plugin._disposeWireDataLayer = wireDataLayer(dl, plugin.coreApp.events);

		new DayRolloverWatcher(plugin.dayBoundaryService, dl).register(plugin);

		// Startup race fix: rebuildIndex() runs in an earlier onLayoutReady with
		// silent=true, so no domain events fire and the DataLayer keeps stale
		// enrichment data. Re-execute CARDS loaders once the index is populated.
		plugin.app.workspace.onLayoutReady(() => {
			dl.invalidateGroups([G.CARDS]);
			void migrateArchiveCascade(plugin);
		});

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
	});

	registerDeletionHandler(plugin, plugin.deletionHandler);

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
			await plugin.app.vault.adapter.writeBinary(targetPath, sourceData);
			notify().success(`Imported data from device ${result.sourceDeviceId}`);
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
