import type { FSRSHelperService } from "@true-recall/core/metrics/fsrs-tools";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { CommandService } from "@true-recall/obsidian/commands";
import type { App } from "obsidian";

export interface FsrsPluginHost {
	fsrsHelper: FSRSHelperService | null;
	commandService: CommandService | null;
	cardStore: SqliteStoreService;
	app: App;
}
