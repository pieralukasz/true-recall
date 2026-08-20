import type { TrueRecallSettings } from "../../types/settings.types";

export type AIWorkflowKind = "agent" | "generate-cards" | "modify-card";

export interface AIWorkflow {
	id: string;
	name: string;
	kind: AIWorkflowKind;
	instruction: string;
	sourcePresetId: string;
	/** Card Polish presets may apply their result without a confirmation step.
	 * Surfaced so the user can see, before running, whether a preset previews or
	 * applies. */
	autoApply?: boolean;
	/** New cards have a separate safety gate from edits to the current card. */
	autoApplyNewCards?: boolean;
}

export interface AIWorkflowContext {
	hasSelection: boolean;
	hasSourceText?: boolean;
	hasCard: boolean;
	hasDraftCard: boolean;
	/** Hides a whole preset family whose feature the user turned off. Omit to
	 * list everything — task resolution must stay lenient so a family disabled
	 * mid-flight cannot orphan a queued task. */
	isFamilyEnabled?: (kind: AIWorkflowKind) => boolean;
}

const AGENT_PREFIX = "agent:";
const GENERATION_PREFIX = "generation:";
const CARD_POLISH_PREFIX = "card-polish:";
export const CUSTOM_CARD_POLISH_PRESET_ID = "$custom";

export function assistantWorkflowId(presetId: string): string {
	return `${AGENT_PREFIX}${presetId}`;
}

export function generationWorkflowId(presetId: string): string {
	return `${GENERATION_PREFIX}${presetId}`;
}

export function cardPolishWorkflowId(presetId: string): string {
	return `${CARD_POLISH_PREFIX}${presetId}`;
}

export function customCardPolishWorkflowId(): string {
	return cardPolishWorkflowId(CUSTOM_CARD_POLISH_PRESET_ID);
}

/**
 * Projects the three persisted legacy preset families into one runtime model.
 * No prompt is copied or migrated, so legacy settings remain lossless while all
 * entry points can execute through the same task service.
 */
export function listAIWorkflows(
	settings: TrueRecallSettings,
	context: AIWorkflowContext,
): AIWorkflow[] {
	const isEnabled = (kind: AIWorkflowKind): boolean =>
		context.isFamilyEnabled?.(kind) ?? true;

	const workflows: AIWorkflow[] = isEnabled("agent")
		? (settings.assistantPresets ?? []).map((preset) => ({
				id: assistantWorkflowId(preset.id),
				name: preset.name,
				kind: "agent",
				instruction: preset.instruction,
				sourcePresetId: preset.id,
			}))
		: [];

	if (
		isEnabled("generate-cards") &&
		(context.hasSelection || context.hasSourceText)
	) {
		for (const preset of settings.generationPresets ?? []) {
			workflows.push({
				id: generationWorkflowId(preset.id),
				name: preset.name,
				kind: "generate-cards",
				instruction: preset.prompt,
				sourcePresetId: preset.id,
			});
		}
	}

	if (isEnabled("modify-card") && (context.hasCard || context.hasDraftCard)) {
		for (const preset of settings.cardPolish?.userPresets ?? []) {
			workflows.push({
				id: cardPolishWorkflowId(preset.id),
				name: preset.name,
				kind: "modify-card",
				instruction: preset.prompt,
				sourcePresetId: preset.id,
				autoApply: preset.autoApply,
				autoApplyNewCards: preset.autoApplyNewCards,
			});
		}
	}

	return workflows;
}

export function resolveAIWorkflow(
	settings: TrueRecallSettings,
	workflowId: string | undefined,
	context: AIWorkflowContext,
): AIWorkflow | null {
	if (!workflowId) return null;
	if (
		workflowId === customCardPolishWorkflowId() &&
		(context.hasCard || context.hasDraftCard)
	) {
		return {
			id: workflowId,
			name: "Custom Card Polish",
			kind: "modify-card",
			instruction: "",
			sourcePresetId: CUSTOM_CARD_POLISH_PRESET_ID,
			autoApply: settings.cardPolish?.customPromptAutoApply ?? false,
			autoApplyNewCards: false,
		};
	}
	const exact = listAIWorkflows(settings, context).find(
		(workflow) => workflow.id === workflowId,
	);
	if (exact) return exact;

	// Tasks created before workflow IDs were namespaced stored the raw Assistant
	// preset id. Keep them executable after upgrading.
	const legacyAssistant = (settings.assistantPresets ?? []).find(
		(preset) => preset.id === workflowId,
	);
	return legacyAssistant
		? {
				id: assistantWorkflowId(legacyAssistant.id),
				name: legacyAssistant.name,
				kind: "agent",
				instruction: legacyAssistant.instruction,
				sourcePresetId: legacyAssistant.id,
			}
		: null;
}
