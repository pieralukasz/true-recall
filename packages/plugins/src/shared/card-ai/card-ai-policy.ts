import type {
	CardAIExecutor,
	CardAIFieldScope,
	CardAIPreset,
	CardAIPresetMode,
} from "@true-recall/core";

export interface ResolvedCardAIPolicy {
	mode: CardAIPresetMode;
	fieldScope: CardAIFieldScope;
	executor: CardAIExecutor;
}

function normalizedPresetText(preset: CardAIPreset): string {
	return `${preset.name} ${preset.prompt}`.toLocaleLowerCase();
}

function inferMode(preset: CardAIPreset): CardAIPresetMode {
	const name = preset.name.trim().toLocaleLowerCase();
	if (/\b(split|atomize|rozbij|rozdziel)\b/.test(name)) return "split";
	if (/\b(reverse|why)\b/.test(name)) return "spawn";
	return "edit";
}

function inferFieldScope(preset: CardAIPreset): CardAIFieldScope {
	const name = preset.name.trim().toLocaleLowerCase();
	if (/\bambiguity\b/.test(name)) return "question";
	if (/\banswer\b/.test(name)) return "empty-answer";
	return "all";
}

function inferExecutor(preset: CardAIPreset): CardAIExecutor {
	const text = normalizedPresetText(preset);
	if (/remove (all )?(backlinks|wikilinks)/.test(text)) {
		return "remove-backlinks";
	}
	if (
		/remove attachments/.test(text) ||
		/collapse file paths? to (their )?basename/.test(text)
	) {
		return "shorten-attachment-paths";
	}
	return "ai";
}

/**
 * Resolves old free-form presets to a safe policy without asking the model to
 * infer whether it may edit or create cards. Once saved in settings, the three
 * explicit fields take precedence over these backwards-compatible defaults.
 */
export function resolveCardAIPolicy(
	preset: CardAIPreset,
): ResolvedCardAIPolicy {
	const executor = preset.executor ?? inferExecutor(preset);
	return {
		mode: executor === "ai" ? (preset.mode ?? inferMode(preset)) : "edit",
		fieldScope: preset.fieldScope ?? inferFieldScope(preset),
		executor,
	};
}
