import type { CardSchedulingMeta } from "../../types";
import type { PresetService } from "../notes/preset.service";
import {
	type RModeCardOptions,
	resolveRModeCeiling,
} from "./retrievability-queue";

export interface RModeCardOptionsResolverDeps {
	presetService: Pick<PresetService, "resolvePresetForCard" | "toFSRSSettings">;
	ceilingOffset: number;
	/** Scopes preset resolution to a project when the caller has one. */
	projectPath?: string;
}

/**
 * Per-card R-Mode bands derived from the card's effective preset.
 *
 * Preset resolution walks the frontmatter chain, so the result is cached per
 * source note: every card of a note shares the same preset.
 */
export function createRModeCardOptionsResolver(
	deps: RModeCardOptionsResolverDeps,
): (card: CardSchedulingMeta) => RModeCardOptions {
	const { presetService, ceilingOffset, projectPath } = deps;
	const presetCache = new Map<string, RModeCardOptions>();

	return (card) => {
		const key = card.sourceUid ?? card.id;
		const cached = presetCache.get(key);
		if (cached) return cached;

		const preset = presetService.resolvePresetForCard(card, { projectPath });
		const options: RModeCardOptions = {
			comfortFloor: preset.requestRetention,
			ceiling: resolveRModeCeiling(preset.requestRetention, ceilingOffset),
			presetSettings: presetService.toFSRSSettings(preset),
		};
		presetCache.set(key, options);
		return options;
	};
}
