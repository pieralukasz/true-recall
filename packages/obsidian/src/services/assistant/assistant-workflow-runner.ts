import {
	AssistantAgent,
	type AssistantManifest,
	type AssistantProgressEvent,
	type AssistantTask,
} from "@true-recall/core/ai/assistant";
import { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";
import {
	FACT_CHECK_WORKFLOW_ID,
	resolveAIWorkflow,
} from "@true-recall/core/ai/workflows/ai-workflow";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import { createAssistantClient, supportsWebSearch } from "./assistant-client";
import type { ObsidianAssistantHost } from "./assistant-host";
import type { CardPolishWorkflow } from "./card-polish-workflow";
import type { FactCheckWorkflow } from "./fact-check-workflow";
import type { GenerationWorkflow } from "./generation-workflow";
export class AssistantWorkflowRunner {
	constructor(
		private plugin: TrueRecallPlugin,
		private host: ObsidianAssistantHost,
		private generation: GenerationWorkflow,
		private factCheck: FactCheckWorkflow,
		private polish: CardPolishWorkflow,
	) {}

	async run(
		task: AssistantTask,
		onProgress: (event: AssistantProgressEvent) => void,
	): Promise<AssistantManifest> {
		const settings = this.plugin.settings;
		const workflow = resolveAIWorkflow(settings, task.presetId, {
			hasSelection: !!task.context.selectedText?.trim(),
			hasSourceText: !!task.context.source?.text?.trim(),
			hasCard: !!task.context.card,
			hasDraftCard: !!task.context.draftCard,
		});

		if (workflow?.kind === "generate-cards") {
			return this.generation.run(task, workflow.sourcePresetId, onProgress);
		}
		if (workflow?.kind === "modify-card") {
			return this.polish.run(task, workflow.sourcePresetId, onProgress);
		}

		if (workflow?.kind === "fact-check") {
			return this.factCheck.run(task, onProgress);
		}
		if (!workflow && task.presetId === FACT_CHECK_WORKFLOW_ID) {
			// Never let a fact check degrade into a free-form agent run without
			// web search, tools gate and verdict.
			throw new Error("Fact check task lost its card context");
		}

		const config = resolveAIClientConfig(settings, "assistant");
		const webSearch =
			settings.assistantWebSearch && supportsWebSearch(config.providerType);
		const agent = new AssistantAgent(createAssistantClient(config), {
			maxIterations: settings.assistantMaxIterations,
			maxSources: settings.assistantMaxSources,
			webSearch,
			userInstructions: settings.assistantInstructions,
			onProgress,
		});
		return agent.run(task.instruction, task.context, this.host);
	}
}
