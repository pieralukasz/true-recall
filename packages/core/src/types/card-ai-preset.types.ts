// Persisted data shapes for card-AI presets and settings. The runtime
// pipeline (service, runner, prompts, target/presenter interfaces) lives in
// `@true-recall/plugins/shared/card-ai`. Only the types that the settings
// schema needs to type the persisted bucket live here.

export type CardFields = Record<string, string>;

export type CardAIPresetMode = "edit" | "split" | "spawn";

export type CardAIFieldScope = "all" | "question" | "answer" | "empty-answer";

export type CardAIExecutor =
	| "ai"
	| "remove-backlinks"
	| "shorten-attachment-paths";

export interface CardAIPreset {
	id: string;
	name: string;
	prompt: string;
	autoApply: boolean;
	builtin: boolean;
	/** Disabled presets stay editable in settings but are hidden from run surfaces. */
	disabled?: boolean;
	requiresPro?: boolean;
	includeSourceNote?: boolean;
	includeRelatedCards?: boolean;
	autoApplyNewCards?: boolean;
	/** Explicit result cardinality. Older presets are resolved conservatively by name. */
	mode?: CardAIPresetMode;
	/** Fields the model may change on the current card. */
	fieldScope?: CardAIFieldScope;
	/** Mechanical transforms bypass the LLM entirely. */
	executor?: CardAIExecutor;
}

export interface CardAIUserSettings {
	userPresets: CardAIPreset[];
	customPromptAutoApply: boolean;
}
