import { signal } from "@preact/signals";

import {
	AssistantAgent,
	type AssistantContext,
	type AssistantManifest,
	type AssistantProgressEvent,
	type AssistantTask,
} from "@true-recall/core/ai/assistant";
import { OpenRouterClient } from "@true-recall/core/ai/clients/openrouter-client";
import { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { ObsidianHttpClient } from "../../adapters/ObsidianHttpClient";
import { G } from "../../data/queries";
import { ObsidianAssistantHost } from "./assistant-host";

export interface AssistantProgress {
	taskId: string;
	lines: string[];
}

export class AssistantService {
	/** Live progress of the currently running task (inbox view subscribes). */
	readonly progress = signal<AssistantProgress | null>(null);

	private processing = false;
	private started = false;
	private host: ObsidianAssistantHost;

	constructor(private plugin: TrueRecallPlugin) {
		this.host = new ObsidianAssistantHost(plugin);
	}

	/** Idempotent: safe to call from both plugin init and feature activation. */
	start(): void {
		if (this.started) return;
		this.started = true;
		const reset = this.actions().resetRunningToPending();
		if (reset > 0) this.invalidate();
		this.pump();
	}

	enqueue(params: {
		instruction: string;
		presetId?: string;
		context: AssistantContext;
	}): string {
		const id = crypto.randomUUID();
		this.actions().insert({
			id,
			instruction: params.instruction,
			presetId: params.presetId,
			context: params.context,
			createdAt: Date.now(),
		});
		this.invalidate();
		notify().info("AI task queued");
		this.pump();
		return id;
	}

	retryWithFeedback(task: AssistantTask, feedback: string): string {
		const instruction =
			feedback.trim() === ""
				? task.instruction
				: `${task.instruction}\n\nUSER FEEDBACK ON THE PREVIOUS ATTEMPT:\n${feedback.trim()}`;
		return this.enqueue({
			instruction,
			presetId: task.presetId,
			context: task.context,
		});
	}

	cancel(taskId: string): void {
		this.actions().cancel(taskId, Date.now());
		this.invalidate();
	}

	delete(taskId: string): void {
		this.actions().deleteById(taskId);
		this.invalidate();
	}

	updateManifest(taskId: string, manifest: AssistantManifest): void {
		this.actions().updateManifest(taskId, manifest);
		this.invalidate();
	}

	getTask(taskId: string): AssistantTask | null {
		return this.actions().getById(taskId);
	}

	private actions() {
		const store = this.plugin.cardStore;
		if (!store) throw new Error("Card store not ready");
		return store.assistantTasks;
	}

	private invalidate(): void {
		this.plugin.dataLayer?.invalidateGroups([G.ASSISTANT]);
	}

	private pump(): void {
		if (this.processing) return;
		this.processing = true;
		void this.drainQueue().finally(() => {
			this.processing = false;
		});
	}

	private async drainQueue(): Promise<void> {
		for (;;) {
			const task = this.actions().claimNextPending();
			if (!task) return;
			this.invalidate();

			const lines: string[] = [];
			const onProgress = (event: AssistantProgressEvent) => {
				if (event.kind === "iteration") {
					lines.push(`Thinking (round ${event.index + 1})…`);
				}
				if (event.kind === "tool") lines.push(`Using tool: ${event.name}`);
				this.progress.value = { taskId: task.id, lines: [...lines] };
			};

			try {
				const settings = this.plugin.settings;
				const config = resolveAIClientConfig(settings, "assistant");
				const webSearch =
					settings.assistantWebSearch &&
					(config.providerType === "openrouter" ||
						config.providerType === "pro");
				const client = new OpenRouterClient(
					config.apiKey,
					config.model,
					new ObsidianHttpClient(),
					config.baseUrl,
					undefined,
					"assistant",
					{ providerType: config.providerType },
				);
				const agent = new AssistantAgent(client, {
					maxIterations: settings.assistantMaxIterations,
					maxSources: settings.assistantMaxSources,
					webSearch,
					userInstructions: settings.assistantInstructions,
					onProgress,
				});
				const manifest = await agent.run(
					task.instruction,
					task.context,
					this.host,
				);
				this.actions().complete(task.id, manifest, Date.now());
				const n = manifest.proposals.length;
				notify().success(
					n > 0
						? `AI task ready: ${n} proposal${n === 1 ? "" : "s"}`
						: "AI task finished (no proposals)",
				);
			} catch (error) {
				this.actions().fail(
					task.id,
					error instanceof Error ? error.message : String(error),
					Date.now(),
				);
				notify().error("AI task failed", error);
			} finally {
				this.progress.value = null;
				this.invalidate();
			}
		}
	}
}
