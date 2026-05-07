// Persisted data shapes for card-AI presets and settings. The runtime
// pipeline (service, runner, prompts, target/presenter interfaces) lives in
// `@true-recall/plugins/shared/card-ai`. Only the types that the settings
// schema needs to type the persisted bucket live here.

export type CardFields = Record<string, string>;

export interface CardAIPreset {
	id: string;
	name: string;
	prompt: string;
	autoApply: boolean;
	builtin: boolean;
	requiresPro?: boolean;
	includeSourceNote?: boolean;
	includeRelatedCards?: boolean;
	autoApplyNewCards?: boolean;
}

export interface CardAIUserSettings {
	userPresets: CardAIPreset[];
	customPromptAutoApply: boolean;
}
