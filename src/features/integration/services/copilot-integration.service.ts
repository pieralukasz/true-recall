/**
 * Service for integrating with Obsidian Copilot plugin.
 *
 * This service probes Copilot's API at runtime since the API is not documented.
 * The use of 'any' types is intentional for discovering available methods on
 * an external plugin without type definitions.
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { App, TFile } from "obsidian";

// Extend App type for plugin and command access
interface AppWithPlugins extends App {
	plugins?: {
		plugins?: Record<string, unknown>;
	};
	commands?: {
		listCommands?: () => { id: string; name: string }[];
		executeCommandById?: (id: string) => Promise<void>;
	};
}

export class CopilotIntegrationService {
	private appWithPlugins: AppWithPlugins;

	constructor(app: App) {
		this.appWithPlugins = app as AppWithPlugins;
	}

	/**
	 * Get the Copilot plugin instance if installed.
	 */
	getCopilotPlugin(): Record<string, unknown> | null {
		const plugins = this.appWithPlugins.plugins?.plugins;
		return (plugins?.copilot as Record<string, unknown>) ?? null;
	}

	/**
	 * Check if Copilot plugin is installed and enabled.
	 */
	isAvailable(): boolean {
		return this.getCopilotPlugin() !== null;
	}

	/**
	 * Debug: Inspect available properties and methods on Copilot plugin.
	 * Useful for discovering the API structure.
	 *
	 * Usage in Obsidian DevTools console:
	 * ```
	 * const plugin = app.plugins.plugins["true-recall"];
	 * new plugin.CopilotIntegrationService(app).inspectCopilotApi();
	 * ```
	 */
	inspectCopilotApi(): Record<string, string> {
		const copilot = this.getCopilotPlugin();
		if (!copilot) return {};

		const result: Record<string, string> = {};
		for (const key of Object.keys(copilot)) {
			result[key] = typeof (copilot as any)[key];
		}
		return result;
	}

	/**
	 * List all Copilot-related commands registered in Obsidian.
	 */
	listCopilotCommands(): { id: string; name: string }[] {
		const commands = this.appWithPlugins.commands?.listCommands?.() ?? [];
		return commands
			.filter(
				(c) =>
					c.id.includes("copilot") || c.name.toLowerCase().includes("copilot"),
			)
			.map((c) => ({ id: c.id, name: c.name }));
	}

	/**
	 * Try to add a note to Copilot's context.
	 * Probes multiple possible API patterns since Copilot's API is not documented.
	 *
	 * @param file The file to add to context
	 * @returns true if successfully added, false if no usable API was found
	 */
	async addNoteToContext(file: TFile): Promise<boolean> {
		const copilot = this.getCopilotPlugin();
		if (!copilot) {
			return false;
		}

		const plugin = copilot as any;

		// Attempt 1: Check for direct addToContext method
		if (typeof plugin.addToContext === "function") {
			await plugin.addToContext(file);
			return true;
		}

		// Attempt 2: Check for context manager with addNote
		if (plugin.contextManager?.addNote) {
			await plugin.contextManager.addNote(file);
			return true;
		}

		// Attempt 3: Check for context manager with add
		if (plugin.contextManager?.add) {
			await plugin.contextManager.add(file);
			return true;
		}

		// Attempt 4: Check for chat state manager
		if (plugin.chatStateManager?.addContext) {
			await plugin.chatStateManager.addContext(file);
			return true;
		}

		// Attempt 5: Check for chat manager
		if (plugin.chatManager?.addContext) {
			await plugin.chatManager.addContext(file);
			return true;
		}

		// Attempt 6: Try executing a command if registered
		const commands = this.listCopilotCommands();
		const addContextCmd = commands.find(
			(c) =>
				c.id.includes("add-context") ||
				c.id.includes("add-note") ||
				c.id.includes("context-add"),
		);

		if (addContextCmd) {
			await this.appWithPlugins.commands?.executeCommandById?.(
				addContextCmd.id,
			);
			return true;
		}

		return false;
	}
}
