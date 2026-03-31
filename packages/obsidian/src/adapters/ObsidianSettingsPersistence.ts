import type { ISettingsPersistence } from "@true-recall/core";
import type { TrueRecallSettings } from "@true-recall/core/types";
import type { Plugin } from "obsidian";

export class ObsidianSettingsPersistence implements ISettingsPersistence {
	constructor(private plugin: Plugin) {}

	async load(): Promise<Partial<TrueRecallSettings> | null> {
		return (await this.plugin.loadData()) as Partial<TrueRecallSettings> | null;
	}

	async save(settings: TrueRecallSettings): Promise<void> {
		await this.plugin.saveData(settings);
	}
}
