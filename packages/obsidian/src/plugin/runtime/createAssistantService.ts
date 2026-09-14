import { AssistantCompletionPresenter } from "@true-recall/obsidian/features/assistant/ui/AssistantCompletionPresenter";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { AssistantService } from "@true-recall/obsidian/services/assistant/assistant.service";
import { ObsidianAssistantHost } from "@true-recall/obsidian/services/assistant/assistant-host";
import { AssistantQueueRunner } from "@true-recall/obsidian/services/assistant/assistant-queue-runner";
import { AssistantRepository } from "@true-recall/obsidian/services/assistant/assistant-repository";
import { AssistantResultApplier } from "@true-recall/obsidian/services/assistant/assistant-result-applier";
import { AssistantThreadService } from "@true-recall/obsidian/services/assistant/assistant-thread.service";
import { AssistantWorkflowRunner } from "@true-recall/obsidian/services/assistant/assistant-workflow-runner";
import { CardPolishWorkflow } from "@true-recall/obsidian/services/assistant/card-polish-workflow";
import { FactCheckWorkflow } from "@true-recall/obsidian/services/assistant/fact-check-workflow";
import { GenerationWorkflow } from "@true-recall/obsidian/services/assistant/generation-workflow";
import { createStreamingFlashcardAdapter } from "@true-recall/obsidian/services/assistant/streaming-flashcard-adapter";
import { notify } from "@true-recall/obsidian/services/notification.service";
export function createAssistantService(
	plugin: TrueRecallPlugin,
): AssistantService {
	const repository = new AssistantRepository(plugin);
	const host = new ObsidianAssistantHost(plugin);
	const workflows = new AssistantWorkflowRunner(
		plugin,
		host,
		new GenerationWorkflow(
			plugin,
			host,
			() => createStreamingFlashcardAdapter(plugin.flashcardManager),
			(params) => confirm(plugin.app, params),
		),
		new FactCheckWorkflow(plugin, host),
		new CardPolishWorkflow(plugin, host),
	);
	const presenter = new AssistantCompletionPresenter(
		plugin,
		repository,
		new AssistantResultApplier(plugin, repository),
	);
	const queue = new AssistantQueueRunner(
		repository,
		(task, progress) => workflows.run(task, progress),
		(task, manifest) => presenter.notifyTaskCompleted(task, manifest),
		(error) => notify().error("AI task failed", error),
	);
	const threads = new AssistantThreadService(repository, () => queue.pump());

	return new AssistantService(queue, threads);
}
