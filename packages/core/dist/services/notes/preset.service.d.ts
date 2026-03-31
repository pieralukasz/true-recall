import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { CardSchedulingMeta } from "../../types/fsrs";
import type { FSRSPreset, FSRSSettings, TrueRecallSettings } from "../../types/settings.types";
import type { FrontmatterIndexService } from "./frontmatter-index.service";
import type { HierarchyService } from "./hierarchy.service";
export interface PresetResolutionContext {
    projectPath?: string;
}
export type PresetSource = "note" | "parent" | "default";
export interface PresetResolutionResult {
    preset: FSRSPreset;
    source: PresetSource;
    sourcePath?: string;
}
export interface PresetChainEntry {
    source: PresetSource;
    sourcePath?: string;
    presetName: string | null;
    active: boolean;
}
export declare class PresetService {
    private getSettings;
    private persistSettings;
    private frontmatterIndex;
    private hierarchyService;
    private getCardStore?;
    constructor(getSettings: () => TrueRecallSettings, persistSettings: () => Promise<void>, frontmatterIndex: FrontmatterIndexService, hierarchyService: HierarchyService, getCardStore?: (() => SqliteStoreService | null) | undefined);
    getPresets(): FSRSPreset[];
    getDefaultPreset(): FSRSPreset;
    getPresetById(id: string): FSRSPreset | undefined;
    getPresetByName(name: string): FSRSPreset | undefined;
    createPreset(data: Omit<FSRSPreset, "id" | "createdAt">): Promise<FSRSPreset>;
    updatePreset(id: string, changes: Partial<Omit<FSRSPreset, "id">>): Promise<void>;
    deletePreset(id: string): Promise<void>;
    /**
     * Resolution order (most specific wins):
     * 1. Note's own `fsrs_preset` frontmatter
     * 2. Nearest ancestor with `fsrs_preset` (walks parents chain)
     * 3. Global default preset
     */
    resolvePresetForCard(card: CardSchedulingMeta, context?: PresetResolutionContext): FSRSPreset;
    resolvePresetChain(notePath: string, context?: PresetResolutionContext): {
        chain: PresetChainEntry[];
        effective: PresetResolutionResult;
    };
    private resolveNotePath;
    private resolveForNotePath;
    /**
     * Walks the parent chain (BFS) to find the nearest ancestor with fsrs_preset.
     */
    private resolveParentPreset;
    private lookupPresetName;
    private lookupPreset;
    toFSRSSettings(preset: FSRSPreset): FSRSSettings;
}
