import { useCallback, useState } from "preact/hooks";

import type {
	CustomStudyCardState,
	CustomStudyRequest,
} from "@true-recall/core/types/review-session.types";

import type { CustomStudyModalResult } from "@true-recall/obsidian/modals/study/custom-study/types";

export type CustomStudyMode = CustomStudyRequest["kind"];

export interface CustomStudyConfig {
	mode: CustomStudyMode;
	amount: number;
	days: number;
	cardState: CustomStudyCardState;
	cardLimit: number;
	includeTags: string;
	excludeTags: string;
}

const DEFAULT_CONFIG: CustomStudyConfig = {
	mode: "increase-new",
	amount: 1,
	days: 1,
	cardState: "new",
	cardLimit: 100,
	includeTags: "",
	excludeTags: "",
};

function parseTags(value: string): string[] {
	return [
		...new Set(
			value
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	];
}

function buildRequest(config: CustomStudyConfig): CustomStudyRequest {
	switch (config.mode) {
		case "increase-new":
		case "increase-review":
			return { kind: config.mode, amount: config.amount };
		case "forgotten":
		case "review-ahead":
		case "preview-new":
			return { kind: config.mode, days: config.days };
		case "actual-learning":
			return { kind: "actual-learning" };
		case "state-or-tag":
			return {
				kind: "state-or-tag",
				cardState: config.cardState,
				cardLimit: config.cardLimit,
				tagsToInclude: parseTags(config.includeTags),
				tagsToExclude: parseTags(config.excludeTags),
			};
	}
}

export function useCustomStudyConfig() {
	const [config, setConfig] = useState<CustomStudyConfig>(() => ({
		...DEFAULT_CONFIG,
	}));

	const updateConfig = useCallback(
		<K extends keyof CustomStudyConfig>(
			key: K,
			value: CustomStudyConfig[K],
		) => {
			setConfig((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const buildResult = useCallback((): CustomStudyModalResult => {
		return {
			cancelled: false,
			sessionResult: {
				cancelled: false,
				sessionType: "custom-study",
				ignoreDailyLimits: true,
				customStudy: buildRequest(config),
			},
		};
	}, [config]);

	return { config, updateConfig, buildResult };
}
