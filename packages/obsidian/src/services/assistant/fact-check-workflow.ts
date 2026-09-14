import {
	AssistantAgent,
	type AssistantManifest,
	type AssistantProgressEvent,
	type AssistantTask,
} from "@true-recall/core/ai/assistant";
import { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import { createAssistantClient, supportsWebSearch } from "./assistant-client";
import type { ObsidianAssistantHost } from "./assistant-host";
export class FactCheckWorkflow {
	constructor(
		private plugin: TrueRecallPlugin,
		private host: ObsidianAssistantHost,
	) {}

	/**
	 * Fact check is meaningless without web search, so unlike the free-form
	 * agent it fails loudly on providers that cannot search. The entry points
	 * hide the action on such providers; this guards tasks queued earlier.
	 */
	async run(
		task: AssistantTask,
		onProgress: (event: AssistantProgressEvent) => void,
	): Promise<AssistantManifest> {
		const settings = this.plugin.settings;
		const config = resolveAIClientConfig(settings, "assistant");
		if (!supportsWebSearch(config.providerType)) {
			throw new Error(
				"Fact check requires web search (OpenRouter or Pro provider)",
			);
		}
		const agent = new AssistantAgent(createAssistantClient(config), {
			factCheck: true,
			maxIterations: settings.assistantMaxIterations,
			maxSources: settings.assistantMaxSources,
			userInstructions: settings.assistantInstructions,
			onProgress,
		});
		return agent.run(task.instruction, task.context, this.host);
	}
}
