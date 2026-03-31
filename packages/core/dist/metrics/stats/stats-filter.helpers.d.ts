import type { PresetService } from "../../services/notes/preset.service";
import type { CardSchedulingMeta } from "../../types";
export declare function buildSourceUidToPresetMap(presetService: PresetService, allCards: CardSchedulingMeta[]): Map<string, string>;
export declare function getSourceUidsForPreset(presetName: string, sourceUidToPreset: Map<string, string>): Set<string>;
