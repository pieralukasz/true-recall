import { useCallback, useState } from "preact/hooks";
import type { SessionResult } from "@shared/types/events.types";
import type { ReviewOrder } from "@shared/types/settings.types";
import type { CustomStudyModalResult } from "@features/study/modals/custom-study/types";

export interface CustomStudyConfig {
	stateFilter: "all" | "new" | "learning" | "due";
	difficultyMin: number;
	difficultyMax: number;
	lapsesMin: number;
	reviewOrder: ReviewOrder;
	cardLimit: number;
	studyAheadDays: number;
	crammingMode: boolean;
}

const DEFAULT_CONFIG: CustomStudyConfig = {
	stateFilter: "all",
	difficultyMin: 1,
	difficultyMax: 10,
	lapsesMin: 0,
	reviewOrder: "due-date",
	cardLimit: 0,
	studyAheadDays: 0,
	crammingMode: false,
};

export function useCustomStudyConfig() {
	const [config, setConfig] = useState<CustomStudyConfig>({
		...DEFAULT_CONFIG,
	});

	const updateConfig = useCallback(
		<K extends keyof CustomStudyConfig>(
			key: K,
			value: CustomStudyConfig[K],
		) => {
			setConfig((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	const buildResult = useCallback(
		(presetName?: string): CustomStudyModalResult => {
			const hasDifficultyFilter =
				config.difficultyMin > 1 || config.difficultyMax < 10;
			const hasLapsesFilter = config.lapsesMin > 0;

			const sessionResult: SessionResult = {
				cancelled: false,
				sessionType: "custom-study",
				ignoreDailyLimits: true,
				bypassScheduling: true,
				reviewOrder: config.reviewOrder,
				stateFilter:
					config.stateFilter === "all" ? undefined : config.stateFilter,
				difficultyRange: hasDifficultyFilter
					? { min: config.difficultyMin, max: config.difficultyMax }
					: undefined,
				lapsesRange: hasLapsesFilter
					? { min: config.lapsesMin, max: Infinity }
					: undefined,
				cardLimit: config.cardLimit > 0 ? config.cardLimit : undefined,
				studyAheadDays:
					config.studyAheadDays > 0 ? config.studyAheadDays : undefined,
				crammingMode: config.crammingMode || undefined,
			};

			const result: CustomStudyModalResult = {
				cancelled: false,
				sessionResult,
			};

			if (presetName) {
				result.saveAsPreset = true;
				result.presetName = presetName;
			}

			return result;
		},
		[config],
	);

	return { config, updateConfig, buildResult };
}
