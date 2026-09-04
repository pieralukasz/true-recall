import type { Plugin } from "obsidian";

import type { ISettingsPersistence } from "@true-recall/core";
import type {
	PersistedTrueRecallSettings,
	TrueRecallSettings,
} from "@true-recall/core/types";

export class ObsidianSettingsPersistence implements ISettingsPersistence {
	constructor(private plugin: Plugin) {}

	async load(): Promise<PersistedTrueRecallSettings | null> {
		return (await this.plugin.loadData()) as PersistedTrueRecallSettings | null;
	}

	async save(settings: TrueRecallSettings): Promise<void> {
		await this.plugin.saveData(settings);
	}
}
