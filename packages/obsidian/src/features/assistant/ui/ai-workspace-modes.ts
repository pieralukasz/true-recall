import type { AssistantContext } from "@true-recall/core/ai/assistant";
import type {
	AIWorkflow,
	AIWorkflowKind,
} from "@true-recall/core/ai/workflows/ai-workflow";

export type AIWorkspaceMode = "assistant" | "generator" | "card-polish";

export interface AIWorkspaceModeDefinition {
	id: AIWorkspaceMode;
	label: string;
	title: string;
	description: string;
	icon: string;
	workflowKind: AIWorkflowKind;
}

const AI_WORKSPACE_MODE_MAP: Record<
	AIWorkspaceMode,
	AIWorkspaceModeDefinition
> = {
	assistant: {
		id: "assistant",
		label: "Assistant",
		title: "How can AI help?",
		description:
			"Ask a question, research a topic, or describe a custom change in your own words.",
		icon: "sparkles",
		workflowKind: "agent",
	},
	generator: {
		id: "generator",
		label: "Generator",
		title: "Generate flashcards",
		description:
			"Turn the current note or selection into new cards with a generation preset.",
		icon: "layers",
		workflowKind: "generate-cards",
	},
	"card-polish": {
		id: "card-polish",
		label: "Card Polish",
		title: "Polish this flashcard",
		description:
			"Rewrite, complete, or restructure the current card with a Card Polish preset.",
		icon: "wand",
		workflowKind: "modify-card",
	},
};

export const AI_WORKSPACE_MODES: readonly AIWorkspaceModeDefinition[] = [
	AI_WORKSPACE_MODE_MAP.assistant,
	AI_WORKSPACE_MODE_MAP.generator,
	AI_WORKSPACE_MODE_MAP["card-polish"],
];

export function getAIWorkspaceMode(
	mode: AIWorkspaceMode,
): AIWorkspaceModeDefinition {
	return AI_WORKSPACE_MODE_MAP[mode];
}

export function isAIWorkspaceModeAvailable(
	mode: AIWorkspaceMode,
	context: AssistantContext,
): boolean {
	if (mode === "assistant") return true;
	if (mode === "generator") {
		return !!(context.selectedText?.trim() || context.source?.text?.trim());
	}
	return !!(context.card || context.draftCard);
}

export function workflowMatchesMode(
	workflow: AIWorkflow,
	mode: AIWorkspaceMode,
): boolean {
	return workflow.kind === getAIWorkspaceMode(mode).workflowKind;
}
