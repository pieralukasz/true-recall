import type {
	AssistantContext,
	AssistantManifest,
	AssistantTask,
	AssistantThread,
	AssistantThreadState,
} from "@true-recall/core/ai/assistant";

import type { AssistantRepository } from "./assistant-repository";
export class AssistantThreadService {
	constructor(
		private repository: AssistantRepository,
		private pump: () => void,
	) {}

	enqueue(params: {
		instruction: string;
		presetId?: string;
		context: AssistantContext;
		/** Shown as the thread title instead of the raw instruction. */
		displayMessage?: string;
	}): string {
		return this.startThread({ ...params, state: "inbox" }).taskId;
	}

	startThread(params: {
		instruction: string;
		presetId?: string;
		context: AssistantContext;
		state?: AssistantThreadState;
		displayMessage?: string;
	}): { threadId: string; taskId: string } {
		const threadId = crypto.randomUUID();
		const taskId = crypto.randomUUID();
		const createdAt = Date.now();
		const context: AssistantContext = {
			...params.context,
			...(params.presetId
				? {
						workflowId: params.presetId,
						workflowInstruction: params.instruction,
					}
				: {}),
		};
		this.repository.threadActions().insert({
			id: threadId,
			title: this.threadTitle(params.displayMessage ?? params.instruction),
			context,
			state: params.state ?? "active",
			message: {
				id: crypto.randomUUID(),
				role: "user",
				content: params.displayMessage ?? params.instruction,
				createdAt,
			},
			activeTaskId: taskId,
			createdAt,
		});
		this.repository.actions().insert({
			id: taskId,
			threadId,
			instruction: params.instruction,
			presetId: params.presetId,
			context,
			createdAt,
		});
		this.repository.invalidate();
		this.pump();
		return { threadId, taskId };
	}

	continueThread(threadId: string, instruction: string): string | null {
		const thread = this.repository.threadActions().getById(threadId);
		const trimmed = instruction.trim();
		if (!thread || thread.activeTaskId || !trimmed) return null;
		const taskId = crypto.randomUUID();
		const createdAt = Date.now();
		const context: AssistantContext = {
			...thread.context,
			conversation: thread.messages.slice(-8).map(({ role, content }) => ({
				role,
				content,
			})),
		};
		if (thread.manifest) {
			context.draftWorkspace = {
				revision: thread.revision,
				manifest: thread.manifest,
			};
		}
		this.repository.actions().insert({
			id: taskId,
			threadId,
			instruction: trimmed,
			presetId: thread.context.workflowId,
			context,
			createdAt,
		});
		const begun = this.repository.threadActions().beginTurn({
			id: threadId,
			taskId,
			message: {
				id: crypto.randomUUID(),
				role: "user",
				content: trimmed,
				createdAt,
			},
			updatedAt: createdAt,
		});
		if (!begun) {
			this.repository.actions().deleteById(taskId);
			return null;
		}
		this.repository.invalidate();
		this.pump();
		return taskId;
	}

	retryWithFeedback(task: AssistantTask, feedback: string): string {
		const instruction =
			feedback.trim() === ""
				? task.instruction
				: `${task.instruction}\n\nUSER FEEDBACK ON THE PREVIOUS ATTEMPT:\n${feedback.trim()}`;
		// Keep the curated thread title (e.g. "Fact check: ...") on the retry
		// instead of exposing the instruction plus feedback blob.
		const displayMessage = task.threadId
			? this.repository.threadActions().getById(task.threadId)?.title
			: undefined;
		return this.enqueue({
			instruction,
			presetId: task.presetId,
			context: task.context,
			displayMessage,
		});
	}

	cancel(taskId: string): void {
		const task = this.repository.actions().getById(taskId);
		this.repository.actions().cancel(taskId, Date.now());
		if (task?.threadId) {
			this.repository.threadActions().failTurn({
				id: task.threadId,
				taskId,
				message: this.repository.assistantMessage("Cancelled", Date.now()),
				updatedAt: Date.now(),
			});
		}
		this.repository.invalidate();
	}

	delete(taskId: string): void {
		this.repository.actions().deleteById(taskId);
		// A thread still pointing at the deleted task would stay busy forever.
		this.repository.threadActions().clearStaleActiveTasks(Date.now());
		this.repository.invalidate();
	}

	updateManifest(taskId: string, manifest: AssistantManifest): void {
		this.repository.actions().updateManifest(taskId, manifest);
		const task = this.repository.actions().getById(taskId);
		if (task?.threadId) {
			this.repository.threadActions().updateManifest(task.threadId, manifest);
		}
		this.repository.invalidate();
	}

	updateThreadManifest(threadId: string, manifest: AssistantManifest): void {
		this.repository.threadActions().updateManifest(threadId, manifest);
		this.repository.invalidate();
	}

	getThread(threadId: string): AssistantThread | null {
		return this.repository.threadActions().getById(threadId);
	}

	deferThread(threadId: string): void {
		this.repository.threadActions().setState(threadId, "inbox", Date.now());
		this.repository.invalidate();
	}

	archiveThread(threadId: string): void {
		this.repository.threadActions().setState(threadId, "archived", Date.now());
		this.repository.invalidate();
	}

	deleteThread(threadId: string): void {
		const activeTaskId = this.repository
			.threadActions()
			.getById(threadId)?.activeTaskId;
		if (activeTaskId)
			this.repository.actions().cancel(activeTaskId, Date.now());
		this.repository.threadActions().deleteById(threadId);
		this.repository.invalidate();
	}

	undoThread(threadId: string): void {
		this.repository.threadActions().undoLastTurn(threadId, Date.now());
		this.repository.invalidate();
	}

	getTask(taskId: string): AssistantTask | null {
		return this.repository.actions().getById(taskId);
	}

	private threadTitle(instruction: string): string {
		const compact = instruction.replace(/\s+/g, " ").trim();
		return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
	}
}
