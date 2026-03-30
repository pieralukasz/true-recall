import type { PresetService } from "../../services/preset.service";
import type { CardSchedulingMeta } from "../../types";

export function buildSourceUidToPresetMap(
	presetService: PresetService,
	allCards: CardSchedulingMeta[],
): Map<string, string> {
	const map = new Map<string, string>();
	const seenUids = new Set<string>();

	for (const card of allCards) {
		if (!card.sourceUid || seenUids.has(card.sourceUid)) continue;
		seenUids.add(card.sourceUid);

		const preset = presetService.resolvePresetForCard(card);
		map.set(card.sourceUid, preset.name);
	}

	return map;
}

export function getSourceUidsForPreset(
	presetName: string,
	sourceUidToPreset: Map<string, string>,
): Set<string> {
	const uids = new Set<string>();
	for (const [uid, name] of sourceUidToPreset) {
		if (name === presetName) uids.add(uid);
	}
	return uids;
}
