import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { FSRSHelperService } from "@true-recall/core/metrics/fsrs-tools";
import type { UndoService } from "@true-recall/obsidian/services/undo.service";
import type { App } from "obsidian";

export interface FsrsPluginHost {
	fsrsHelper: FSRSHelperService | null;
	undoService: UndoService | null;
	cardStore: SqliteStoreService;
	app: App;
}
