import type { PluginContext } from "../types";

export class CardPolishPlugin {
	constructor(private readonly ctx: PluginContext) {}

	activate(): void {
		// UI mounting, hotkey registration, and service wiring are added in later tasks.
		void this.ctx;
	}

	deactivate(): void {
		// Cleanup added in later tasks.
	}
}
