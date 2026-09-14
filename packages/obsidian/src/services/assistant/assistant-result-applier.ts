import type { AssistantTask } from "@true-recall/core/ai/assistant";
import type { AIWorkflow } from "@true-recall/core/ai/workflows/ai-workflow";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { applyPendingProposals } from "@true-recall/obsidian/services/assistant/apply-pending-proposals";

import { AssistantApplyService } from "./assistant-apply.service";
import type { AssistantRepository } from "./assistant-repository";
import { resolveAssistantSourceFile } from "./assistant-source";
export type AssistantNotification =
	| { kind: "success" | "warning" | "error"; args: [message: string] }
	| { kind: "cardsCreated"; args: [count: number, sourceName?: string] }
	| {
			kind: "cardsCreatedWithDuplicates";
			args: [count: number, duplicates: number, sourceName?: string];
	  };

export class AssistantResultApplier {
	constructor(
		private plugin: TrueRecallPlugin,
		private repository: AssistantRepository,
	) {}

	async applyPolishImmediately(
		task: AssistantTask,
		threadId: string,
		workflow: AIWorkflow,
	): Promise<AssistantNotification[]> {
		const notifications: AssistantNotification[] = [];
		const thread = this.repository.threadActions().getById(threadId);
		const manifest = thread?.manifest;
		if (!thread || !manifest || thread.activeTaskId) return notifications;

		const result = await applyPendingProposals(
			task,
			manifest,
			new AssistantApplyService(this.plugin),
			{
				shouldApply: (proposal) =>
					proposal.type === "create_card"
						? workflow.autoApplyNewCards === true
						: workflow.autoApply === true,
			},
		);

		this.repository.actions().updateManifest(task.id, manifest);
		this.repository.threadActions().updateManifest(threadId, manifest);
		this.repository.invalidate();

		if (result.conflictedCount > 0 || result.error) {
			// Anything the auto-apply could not land stays reviewable in the inbox
			// instead of being silently dropped.
			this.repository.threadActions().setState(threadId, "inbox", Date.now());
			notifications.push({
				kind: "warning",
				args: [
					result.error ?? "Card Polish changed a card that moved — review it",
				],
			});
			return notifications;
		}

		const stillPending = manifest.proposals.some(
			(proposal) => proposal.status === "proposed",
		);
		if (!stillPending) {
			this.repository
				.threadActions()
				.setState(threadId, "archived", Date.now());
		}
		notifications.push({
			kind: "success",
			args: [
				stillPending
					? `${result.appliedCount} Card Polish change${result.appliedCount === 1 ? "" : "s"} applied — review the rest`
					: result.appliedCount === 1
						? "Card Polish applied"
						: `Card Polish applied ${result.appliedCount} changes`,
			],
		});
		return notifications;
	}

	async applyGeneratedCardsImmediately(
		task: AssistantTask,
		threadId: string,
	): Promise<AssistantNotification[]> {
		const notifications: AssistantNotification[] = [];
		const thread = this.repository.threadActions().getById(threadId);
		const manifest = thread?.manifest;
		if (!thread || !manifest || thread.activeTaskId) return notifications;

		const apply = new AssistantApplyService(this.plugin);
		let created = 0;
		let duplicates = 0;
		let firstError: string | undefined;
		for (const proposal of manifest.proposals) {
			if (proposal.status !== "proposed") continue;
			const result = await apply.apply(task, proposal, {
				fields:
					proposal.type === "create_card" ||
					proposal.type === "update_card" ||
					proposal.type === "update_draft"
						? proposal.fields
						: undefined,
			});
			if (result.ok) {
				proposal.status = "applied";
				// A create that wrote nothing was skipped as a duplicate; counting it
				// as created is what produced "N flashcards created" over an empty
				// deck on a re-run.
				if (result.createdCount === 0) duplicates += 1;
				else created += 1;
			} else {
				proposal.status = "rejected";
				firstError ??= result.error ?? "Could not add generated flashcard";
			}
		}

		this.repository.actions().updateManifest(task.id, manifest);
		this.repository.threadActions().updateManifest(threadId, manifest);
		this.repository.threadActions().setState(threadId, "archived", Date.now());
		this.repository.invalidate();

		const noteName = resolveAssistantSourceFile(
			this.plugin,
			task.context,
		)?.basename;
		if (duplicates > 0) {
			notifications.push({
				kind: "cardsCreatedWithDuplicates",
				args: [created, duplicates, noteName],
			});
		} else if (created > 0) {
			notifications.push({ kind: "cardsCreated", args: [created, noteName] });
		}
		if (firstError) notifications.push({ kind: "error", args: [firstError] });
		return notifications;
	}

	async applyGeneratedDrafts(
		task: AssistantTask,
		threadId: string,
	): Promise<AssistantNotification[]> {
		const notifications: AssistantNotification[] = [];
		const thread = this.repository.threadActions().getById(threadId);
		const manifest = thread?.manifest;
		if (!thread || !manifest || thread.activeTaskId) return notifications;
		const apply = new AssistantApplyService(this.plugin);
		let created = 0;
		let duplicates = 0;
		for (const proposal of manifest.proposals) {
			if (proposal.status !== "proposed") continue;
			const result = await apply.apply(task, proposal, {
				fields:
					proposal.type === "create_card" ||
					proposal.type === "update_card" ||
					proposal.type === "update_draft"
						? proposal.fields
						: undefined,
			});
			if (!result.ok) {
				notifications.push({
					kind: "error",
					args: [result.error ?? "Could not add generated flashcard drafts"],
				});
				break;
			}
			proposal.status = "applied";
			if (result.createdCount === 0) duplicates += 1;
			else created += 1;
		}
		this.repository.actions().updateManifest(task.id, manifest);
		this.repository.threadActions().updateManifest(threadId, manifest);
		const stillPending = manifest.proposals.some(
			(proposal) => proposal.status === "proposed",
		);
		if (!stillPending) {
			this.repository
				.threadActions()
				.setState(threadId, "archived", Date.now());
		}
		this.repository.invalidate();
		if (duplicates > 0) {
			notifications.push({
				kind: "cardsCreatedWithDuplicates",
				args: [created, duplicates],
			});
		} else if (created > 0) {
			notifications.push({ kind: "cardsCreated", args: [created] });
		}
		return notifications;
	}
}
