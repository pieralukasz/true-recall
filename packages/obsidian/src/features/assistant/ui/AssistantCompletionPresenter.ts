import {
	type AssistantManifest,
	type AssistantTask,
	type DirectGenerationSummary,
	describeFactCheckVerdict,
} from "@true-recall/core/ai/assistant";
import { resolveAIWorkflow } from "@true-recall/core/ai/workflows/ai-workflow";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import type { AssistantRepository } from "@true-recall/obsidian/services/assistant/assistant-repository";
import type {
	AssistantNotification,
	AssistantResultApplier,
} from "@true-recall/obsidian/services/assistant/assistant-result-applier";
import { notify } from "@true-recall/obsidian/services/notification.service";
export class AssistantCompletionPresenter {
	constructor(
		private plugin: TrueRecallPlugin,
		private repository: AssistantRepository,
		private applier: AssistantResultApplier,
	) {}

	async notifyTaskCompleted(
		task: AssistantTask,
		manifest: AssistantManifest,
	): Promise<void> {
		const workflow = resolveAIWorkflow(this.plugin.settings, task.presetId, {
			hasSelection: !!task.context.selectedText?.trim(),
			hasSourceText: !!task.context.source?.text?.trim(),
			hasCard: !!task.context.card,
			hasDraftCard: !!task.context.draftCard,
		});
		const pending = manifest.proposals.filter(
			(proposal) => proposal.status === "proposed",
		).length;
		if (workflow?.kind === "generate-cards" && task.threadId) {
			// The streaming engine already wrote its cards, so there is nothing to
			// apply and `pending` is legitimately zero.
			if (manifest.directGeneration) {
				this.reportDirectGeneration(manifest.directGeneration, task.threadId);
				return;
			}
			if (pending === 0) {
				this.repository
					.threadActions()
					.setState(task.threadId, "archived", Date.now());
				notify().warning(
					task.context.applyGeneratedCardsImmediately
						? "AI generation finished without flashcards"
						: "AI generation finished without flashcard drafts",
				);
				return;
			}
			if (task.context.applyGeneratedCardsImmediately) {
				this.present(
					await this.applier.applyGeneratedCardsImmediately(
						task,
						task.threadId,
					),
				);
				return;
			}
			this.repository
				.threadActions()
				.setState(task.threadId, "inbox", Date.now());
			const threadId = task.threadId;
			notify().aiDraftsReady(
				pending,
				() =>
					void this.applier
						.applyGeneratedDrafts(task, threadId)
						.then((events) => this.present(events)),
				() => void this.openGeneratedDrafts(threadId),
			);
			return;
		}
		// A preset marked auto-apply is a shortcut the user configured: run it and
		// land the change, no confirmation step. The thread still records what
		// happened, so the inbox remains the single history of AI edits.
		if (workflow?.kind === "modify-card" && task.threadId) {
			if (pending === 0) {
				this.repository
					.threadActions()
					.setState(task.threadId, "archived", Date.now());
				notify().info("Card Polish made no changes");
				return;
			}
			if (workflow.autoApply || workflow.autoApplyNewCards) {
				this.present(
					await this.applier.applyPolishImmediately(
						task,
						task.threadId,
						workflow,
					),
				);
				return;
			}
		}

		if (manifest.factCheck) {
			notify().success(
				`Fact check: ${describeFactCheckVerdict(manifest.factCheck)}`,
			);
			return;
		}

		const n = manifest.proposals.length;
		notify().success(
			n > 0
				? `AI task ready: ${n} proposal${n === 1 ? "" : "s"}`
				: "AI task finished (no proposals)",
		);
	}

	/**
	 * Reports what the streaming engine actually persisted. Duplicates are
	 * counted separately by the engine, so a run that produced only duplicates
	 * says so instead of claiming cards were created.
	 */
	private reportDirectGeneration(
		summary: DirectGenerationSummary,
		threadId: string,
	): void {
		this.repository.threadActions().setState(threadId, "archived", Date.now());

		if (summary.created === 0 && summary.duplicates === 0) {
			notify().warning("AI generation finished without flashcards");
		} else if (summary.duplicates > 0) {
			notify().cardsCreatedWithDuplicates(
				summary.created,
				summary.duplicates,
				summary.sourceName,
			);
		} else {
			notify().cardsCreated(summary.created, summary.sourceName);
		}

		if (summary.failedChunks > 0) {
			notify().warning(
				`${summary.failedChunks} of ${summary.totalChunks} sections failed: ${summary.errors.join("; ")}`,
			);
		}
	}

	private async openGeneratedDrafts(threadId: string): Promise<void> {
		const { openAssistantThreadModal } = await import(
			"@true-recall/obsidian/features/assistant/ui/AskAiModal"
		);
		openAssistantThreadModal(this.plugin, threadId);
	}
	private present(events: AssistantNotification[]): void {
		for (const event of events) {
			switch (event.kind) {
				case "success":
					notify().success(...event.args);
					break;
				case "warning":
					notify().warning(...event.args);
					break;
				case "error":
					notify().error(...event.args);
					break;
				case "cardsCreated":
					notify().cardsCreated(...event.args);
					break;
				case "cardsCreatedWithDuplicates":
					notify().cardsCreatedWithDuplicates(...event.args);
					break;
			}
		}
	}
}
