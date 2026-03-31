import type { TrueRecallSettings } from "../types/settings.types";

/**
 * Platform adapter for loading/saving plugin settings.
 * Obsidian: wraps plugin.loadData() / plugin.saveData()
 * Desktop: wraps JSON file I/O
 */
export interface ISettingsPersistence {
	load(): Promise<Partial<TrueRecallSettings> | null>;
	save(settings: TrueRecallSettings): Promise<void>;
}
