import type {
	AssistantContext,
	AssistantManifest,
	AssistantTask,
	AssistantThread,
	AssistantThreadState,
} from "@true-recall/core/ai/assistant";

import type { AssistantQueueRunner } from "./assistant-queue-runner";
import type { AssistantThreadService } from "./assistant-thread.service";

export type { AssistantProgress } from "./assistant-queue-runner";
export class AssistantService {
	get progress() {
		return this.queue.progress;
	}
	constructor(
		private queue: AssistantQueueRunner,
		private threads: AssistantThreadService,
	) {}
	start(): void {
		this.queue.start();
	}
	enqueue(params: {
		instruction: string;
		presetId?: string;
		context: AssistantContext;
		/** Shown as the thread title instead of the raw instruction. */
		displayMessage?: string;
	}): string {
		return this.threads.enqueue(params);
	}
	startThread(params: {
		instruction: string;
		presetId?: string;
		context: AssistantContext;
		state?: AssistantThreadState;
		displayMessage?: string;
	}): { threadId: string; taskId: string } {
		return this.threads.startThread(params);
	}
	continueThread(threadId: string, instruction: string): string | null {
		return this.threads.continueThread(threadId, instruction);
	}
	retryWithFeedback(task: AssistantTask, feedback: string): string {
		return this.threads.retryWithFeedback(task, feedback);
	}
	cancel(taskId: string): void {
		this.threads.cancel(taskId);
	}
	delete(taskId: string): void {
		this.threads.delete(taskId);
	}
	updateManifest(taskId: string, manifest: AssistantManifest): void {
		this.threads.updateManifest(taskId, manifest);
	}
	updateThreadManifest(threadId: string, manifest: AssistantManifest): void {
		this.threads.updateThreadManifest(threadId, manifest);
	}
	getThread(threadId: string): AssistantThread | null {
		return this.threads.getThread(threadId);
	}
	deferThread(threadId: string): void {
		this.threads.deferThread(threadId);
	}
	archiveThread(threadId: string): void {
		this.threads.archiveThread(threadId);
	}
	deleteThread(threadId: string): void {
		this.threads.deleteThread(threadId);
	}
	undoThread(threadId: string): void {
		this.threads.undoThread(threadId);
	}
	getTask(taskId: string): AssistantTask | null {
		return this.threads.getTask(taskId);
	}
}
