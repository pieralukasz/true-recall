import { useEffect, useMemo, useState } from "preact/hooks";
import { State } from "ts-fsrs";

import {
	createRModeCardOptionsResolver,
	type RetrievabilitySummary,
	resolveRModeCeiling,
	summarizeRetrievability,
} from "@true-recall/core/services";

import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { usePlugin } from "@true-recall/obsidian/preact";

export interface RModeBands {
	ceiling: number;
	comfortFloor: number;
	urgentBelow: number;
}

/**
 * Retrievability breakdown for the cards of the note currently in the panel.
 *
 * Recomputed from the panel's card list rather than cached, because R moves
 * continuously — a stale snapshot would show a pool that no longer exists.
 */
export function useRModeSummary(): {
	summary: RetrievabilitySummary;
	bands: RModeBands;
} {
	const plugin = usePlugin();
	const { cardsWithFsrs, currentFile } = usePanelStore();
	const currentFilePath = currentFile?.path;

	const { rMode } = plugin.settings;

	const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
	useEffect(() => {
		const timer = window.setInterval(
			() => setMinute(Math.floor(Date.now() / 60_000)),
			60_000,
		);
		return () => window.clearInterval(timer);
	}, []);

	return useMemo(() => {
		const effectivePreset = currentFilePath
			? plugin.presetService.resolvePresetChain(currentFilePath).effective
					.preset
			: plugin.presetService.getDefaultPreset();
		const bands: RModeBands = {
			ceiling: resolveRModeCeiling(
				effectivePreset.requestRetention,
				rMode.ceilingOffset,
			),
			comfortFloor: effectivePreset.requestRetention,
			urgentBelow: rMode.urgentBelow,
		};

		const reviewCards = cardsWithFsrs.filter(
			(card) => card.fsrs.state === State.Review,
		);

		return {
			summary: summarizeRetrievability(
				reviewCards,
				plugin.fsrsService,
				{
					...bands,
					resolveCardOptions: createRModeCardOptionsResolver({
						presetService: plugin.presetService,
						ceilingOffset: rMode.ceilingOffset,
					}),
				},
				new Date(minute * 60_000),
			),
			bands,
		};
	}, [
		cardsWithFsrs,
		plugin.fsrsService,
		plugin.presetService,
		currentFilePath,
		rMode.ceilingOffset,
		rMode.urgentBelow,
		minute,
	]);
}
