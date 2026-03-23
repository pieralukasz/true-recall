import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import type { FSRSHelperService } from "@features/metrics/services/fsrs-tools";
import type { UndoService } from "@shared/services/undo.service";
import type { App } from "obsidian";

export interface FsrsPluginHost {
	fsrsHelper: FSRSHelperService | null;
	undoService: UndoService | null;
	cardStore: SqliteStoreService;
	app: App;
}
