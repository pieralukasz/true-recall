/**
 * Tool Context Factory
 * Creates ToolContext from plugin instance
 */
import { TFile } from "obsidian";
import type { ToolContext } from "../types";
import type TrueRecallPlugin from "../../main";
import { getEventBus } from "../../services/core/event-bus.service";

/**
 * Create a ToolContext from the plugin instance
 * Provides all services and utilities needed for tool execution
 */
export function createToolContext(plugin: TrueRecallPlugin): ToolContext {
	return {
		// Core services
		flashcardManager: plugin.flashcardManager,
		fsrsService: plugin.fsrsService,
		openRouterService: plugin.openRouterService,
		dayBoundaryService: plugin.dayBoundaryService,

		// Persistence
		cardStore: plugin.cardStore,

		// Obsidian API
		app: plugin.app,

		// Settings (read-only snapshot)
		settings: { ...plugin.settings },

		// Event bus
		eventBus: getEventBus(),

		// Utility functions
		getActiveFile: () => plugin.app.workspace.getActiveFile(),
		resolveFile: (path: string) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			return file instanceof TFile ? file : null;
		},
	};
}
