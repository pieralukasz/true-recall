import type { TrueRecallSettings } from "../../types/settings.types";

export type AIWorkflowKind = "agent" | "generate-cards" | "modify-card";

export interface AIWorkflow {
	id: string;
	name: string;
	kind: AIWorkflowKind;
	instruction: string;
	sourcePresetId: string;
}

export interface AIWorkflowContext {
	hasSelection: boolean;
	hasCard: boolean;
	hasDraftCard: boolean;
}

const AGENT_PREFIX = "agent:";
const GENERATION_PREFIX = "generation:";
const CARD_POLISH_PREFIX = "card-polish:";

export function assistantWorkflowId(presetId: string): string {
	return `${AGENT_PREFIX}${presetId}`;
}

export function generationWorkflowId(presetId: string): string {
	return `${GENERATION_PREFIX}${presetId}`;
}

export function cardPolishWorkflowId(presetId: string): string {
	return `${CARD_POLISH_PREFIX}${presetId}`;
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
	const workflows: AIWorkflow[] = (settings.assistantPresets ?? []).map(
		(preset) => ({
			id: assistantWorkflowId(preset.id),
			name: preset.name,
			kind: "agent",
			instruction: preset.instruction,
			sourcePresetId: preset.id,
		}),
	);

	if (context.hasSelection) {
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

	if (context.hasCard || context.hasDraftCard) {
		for (const preset of settings.cardPolish?.userPresets ?? []) {
			workflows.push({
				id: cardPolishWorkflowId(preset.id),
				name: preset.name,
				kind: "modify-card",
				instruction: preset.prompt,
				sourcePresetId: preset.id,
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
