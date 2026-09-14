import { signal } from "@preact/signals";

import {
	type AssistantManifest,
	type AssistantProgressEvent,
	type AssistantTask,
	describeFactCheckVerdict,
} from "@true-recall/core/ai/assistant";
import { describeErrorForUser } from "@true-recall/core/errors";

import type { AssistantRepository } from "./assistant-repository";
export interface AssistantProgress {
	taskId: string;
	lines: string[];
}

export class AssistantQueueRunner {
	readonly progress = signal<AssistantProgress | null>(null);
	private processing = false;
	private started = false;
	constructor(
		private repository: AssistantRepository,
		private executeTask: (
			task: AssistantTask,
			onProgress: (event: AssistantProgressEvent) => void,
		) => Promise<AssistantManifest>,
		private notifyTaskCompleted: (
			task: AssistantTask,
			manifest: AssistantManifest,
		) => Promise<void>,
		private reportFailure: (error: unknown) => void,
	) {}

	/** Idempotent: safe to call from both plugin init and feature activation. */
	start(): void {
		if (this.started) return;
		this.started = true;
		const reset = this.repository.actions().resetRunningToPending();
		const swept = this.repository.threadActions().deleteOrphanedTasks();
		const unstuck = this.repository
			.threadActions()
			.clearStaleActiveTasks(Date.now());
		if (reset > 0 || swept > 0 || unstuck > 0) this.repository.invalidate();
		this.pump();
	}

	pump(): void {
		if (this.processing) return;
		this.processing = true;
		void this.drainQueue().finally(() => {
			this.processing = false;
		});
	}

	private async drainQueue(): Promise<void> {
		for (;;) {
			const task = this.repository.actions().claimNextPending();
			if (!task) return;
			this.repository.invalidate();

			const lines: string[] = [];
			// Live token counter is kept as a single trailing line, updated in
			// place each iteration rather than appended, so it does not spam.
			let usageLine: string | null = null;
			const render = () => {
				this.progress.value = {
					taskId: task.id,
					lines: usageLine ? [...lines, usageLine] : [...lines],
				};
			};
			const onProgress = (event: AssistantProgressEvent) => {
				if (event.kind === "iteration") {
					lines.push(`Thinking (round ${event.index + 1})…`);
				}
				if (event.kind === "tool") lines.push(`Using tool: ${event.name}`);
				if (event.kind === "usage") {
					usageLine = `~${event.usage.totalTokens.toLocaleString()} tokens used`;
				}
				render();
			};

			try {
				const manifest = await this.executeTask(task, onProgress);
				if (this.repository.actions().getById(task.id)?.status !== "running")
					continue;
				this.repository.actions().complete(task.id, manifest, Date.now());
				if (task.threadId) {
					const summary =
						manifest.finalText?.trim() ||
						(manifest.factCheck
							? describeFactCheckVerdict(manifest.factCheck)
							: `Updated ${manifest.proposals.filter((proposal) => proposal.status === "proposed").length} draft(s).`);
					this.repository.threadActions().completeTurn({
						id: task.threadId,
						taskId: task.id,
						manifest,
						message: this.repository.assistantMessage(summary, Date.now()),
						updatedAt: Date.now(),
					});
				}
				await this.notifyTaskCompleted(task, manifest);
			} catch (error) {
				if (this.repository.actions().getById(task.id)?.status !== "running")
					continue;
				// Declining the large-note prompt or hitting stop mid-stream aborts
				// the run; that is a user decision, not a failure to report.
				if (error instanceof DOMException && error.name === "AbortError") {
					this.repository.actions().cancel(task.id, Date.now());
					if (task.threadId) {
						this.repository.threadActions().failTurn({
							id: task.threadId,
							taskId: task.id,
							message: this.repository.assistantMessage(
								"Cancelled",
								Date.now(),
							),
							updatedAt: Date.now(),
						});
						this.repository
							.threadActions()
							.setState(task.threadId, "archived", Date.now());
					}
					continue;
				}
				const userMessage = describeErrorForUser(error);
				this.repository.actions().fail(task.id, userMessage, Date.now());
				if (task.threadId) {
					this.repository.threadActions().failTurn({
						id: task.threadId,
						taskId: task.id,
						message: this.repository.assistantMessage(
							`Error: ${userMessage}`,
							Date.now(),
						),
						updatedAt: Date.now(),
					});
					if (task.context.applyGeneratedCardsImmediately) {
						this.repository
							.threadActions()
							.setState(task.threadId, "archived", Date.now());
					}
				}
				this.reportFailure(error);
			} finally {
				this.progress.value = null;
				this.repository.invalidate();
			}
		}
	}
}
