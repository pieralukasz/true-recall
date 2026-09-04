import {
	type AIWorkflow,
	listAIWorkflows,
} from "@true-recall/core/ai/workflows/ai-workflow";
import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	type AssistantContextCard,
	assistantContextFromCard,
} from "@true-recall/obsidian/features/assistant/ui/ai-context-source";
import { isWorkflowFamilyEnabled } from "@true-recall/obsidian/features/assistant/ui/workflow-family-gate";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

/** Card editing is a workflow family inside the shared AI Workspace. */
export function isCardPolishAvailable(settings: TrueRecallSettings): boolean {
	return isWorkflowFamilyEnabled(settings, "modify-card");
}

/** Projects the polish presets through the same workflow model the review
 * surface lists, so both render identical rows. */
export function listCardPolishWorkflows(
	settings: TrueRecallSettings,
): AIWorkflow[] {
	return listAIWorkflows(settings, {
		hasSelection: false,
		hasCard: true,
		hasDraftCard: false,
		isFamilyEnabled: (kind) => isWorkflowFamilyEnabled(settings, kind),
	}).filter((workflow) => workflow.kind === "modify-card");
}

/** Mirrors the AI workspace badge so every surface describes a preset's
 * apply behavior with the same words. */
export function describePolishRunMode(
	workflow: Pick<AIWorkflow, "autoApply" | "autoApplyNewCards">,
): string {
	if (workflow.autoApply && workflow.autoApplyNewCards) return "Apply all";
	if (workflow.autoApply) return "Apply edit";
	if (workflow.autoApplyNewCards) return "Apply new";
	return "Preview";
}

/** Queues a polish thread for one card. State "inbox" keeps the panel free of
 * thread chrome — PanelAiStrip surfaces the pending draft for the note. */
export function startCardPolish(
	plugin: TrueRecallPlugin,
	workflow: AIWorkflow,
	card: AssistantContextCard,
): void {
	plugin.assistantService?.startThread({
		instruction: workflow.instruction,
		presetId: workflow.id,
		context: assistantContextFromCard(card),
		state: "inbox",
		displayMessage: workflow.name,
	});
}
