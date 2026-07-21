import { signal } from "@preact/signals";
import { TFile } from "obsidian";

import {
	AssistantAgent,
	type AssistantContext,
	type AssistantManifest,
	type AssistantProgressEvent,
	type AssistantProposal,
	type AssistantTask,
	type AssistantThread,
	type AssistantThreadState,
} from "@true-recall/core/ai/assistant";
import { OpenRouterClient } from "@true-recall/core/ai/clients/openrouter-client";
import { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";
import { DraftGenerationService } from "@true-recall/core/ai/generation/draft-generation.service";
import { resolveAIWorkflow } from "@true-recall/core/ai/workflows/ai-workflow";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { ObsidianHttpClient } from "../../adapters/ObsidianHttpClient";
import { G } from "../../data/queries";
import { collectGenerationContext } from "../../plugin/collect-generation-context";
import { fetchExistingCardsForFile } from "../../plugin/existing-cards-fetcher";
import { AssistantApplyService } from "./assistant-apply.service";
import { ObsidianAssistantHost } from "./assistant-host";
import {
	type CardAIContext,
	CardAIService,
	deepEqualFields,
} from "@true-recall/plugins/shared/card-ai";

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
		this.threadActions().insert({
			id: threadId,
			title: this.threadTitle(params.displayMessage ?? params.instruction),
			context: params.context,
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
		this.actions().insert({
			id: taskId,
			threadId,
			instruction: params.instruction,
			presetId: params.presetId,
			context: params.context,
			createdAt,
		});
		this.invalidate();
		this.pump();
		return { threadId, taskId };
	}

	continueThread(threadId: string, instruction: string): string | null {
		const thread = this.threadActions().getById(threadId);
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
		this.actions().insert({
			id: taskId,
			threadId,
			instruction: trimmed,
			context,
			createdAt,
		});
		const begun = this.threadActions().beginTurn({
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
			this.actions().deleteById(taskId);
			return null;
		}
		this.invalidate();
		this.pump();
		return taskId;
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
		const task = this.actions().getById(taskId);
		this.actions().cancel(taskId, Date.now());
		if (task?.threadId) {
			this.threadActions().failTurn({
				id: task.threadId,
				taskId,
				message: this.assistantMessage("Cancelled", Date.now()),
				updatedAt: Date.now(),
			});
		}
		this.invalidate();
	}

	delete(taskId: string): void {
		this.actions().deleteById(taskId);
		this.invalidate();
	}

	updateManifest(taskId: string, manifest: AssistantManifest): void {
		this.actions().updateManifest(taskId, manifest);
		const task = this.actions().getById(taskId);
		if (task?.threadId) {
			this.threadActions().updateManifest(task.threadId, manifest);
		}
		this.invalidate();
	}

	updateThreadManifest(threadId: string, manifest: AssistantManifest): void {
		this.threadActions().updateManifest(threadId, manifest);
		this.invalidate();
	}

	getThread(threadId: string): AssistantThread | null {
		return this.threadActions().getById(threadId);
	}

	deferThread(threadId: string): void {
		this.threadActions().setState(threadId, "inbox", Date.now());
		this.invalidate();
	}

	archiveThread(threadId: string): void {
		this.threadActions().setState(threadId, "archived", Date.now());
		this.invalidate();
	}

	deleteThread(threadId: string): void {
		const activeTaskId = this.threadActions().getById(threadId)?.activeTaskId;
		if (activeTaskId) this.actions().cancel(activeTaskId, Date.now());
		this.threadActions().deleteById(threadId);
		this.invalidate();
	}

	undoThread(threadId: string): void {
		this.threadActions().undoLastTurn(threadId, Date.now());
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

	private threadActions() {
		const store = this.plugin.cardStore;
		if (!store) throw new Error("Card store not ready");
		return store.assistantThreads;
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
				if (this.actions().getById(task.id)?.status !== "running") continue;
				this.actions().complete(task.id, manifest, Date.now());
				if (task.threadId) {
					const summary =
						manifest.finalText?.trim() ||
						`Updated ${manifest.proposals.filter((proposal) => proposal.status === "proposed").length} draft(s).`;
					this.threadActions().completeTurn({
						id: task.threadId,
						taskId: task.id,
						manifest,
						message: this.assistantMessage(summary, Date.now()),
						updatedAt: Date.now(),
					});
				}
				await this.notifyTaskCompleted(task, manifest);
			} catch (error) {
				if (this.actions().getById(task.id)?.status !== "running") continue;
				this.actions().fail(
					task.id,
					error instanceof Error ? error.message : String(error),
					Date.now(),
				);
				if (task.threadId) {
					const message =
						error instanceof Error ? error.message : String(error);
					this.threadActions().failTurn({
						id: task.threadId,
						taskId: task.id,
						message: this.assistantMessage(`Error: ${message}`, Date.now()),
						updatedAt: Date.now(),
					});
					if (task.context.applyGeneratedCardsImmediately) {
						this.threadActions().setState(
							task.threadId,
							"archived",
							Date.now(),
						);
					}
				}
				notify().error("AI task failed", error);
			} finally {
				this.progress.value = null;
				this.invalidate();
			}
		}
	}

	private async notifyTaskCompleted(
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
			if (pending === 0) {
				this.threadActions().setState(task.threadId, "archived", Date.now());
				notify().warning(
					task.context.applyGeneratedCardsImmediately
						? "AI generation finished without flashcards"
						: "AI generation finished without flashcard drafts",
				);
				return;
			}
			if (task.context.applyGeneratedCardsImmediately) {
				await this.applyGeneratedCardsImmediately(task, task.threadId);
				return;
			}
			this.threadActions().setState(task.threadId, "inbox", Date.now());
			const threadId = task.threadId;
			notify().aiDraftsReady(
				pending,
				() => void this.applyGeneratedDrafts(task, threadId),
				() => void this.openGeneratedDrafts(threadId),
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

	private async applyGeneratedCardsImmediately(
		task: AssistantTask,
		threadId: string,
	): Promise<void> {
		const thread = this.threadActions().getById(threadId);
		const manifest = thread?.manifest;
		if (!thread || !manifest || thread.activeTaskId) return;

		const apply = new AssistantApplyService(this.plugin);
		let applied = 0;
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
				applied += 1;
			} else {
				proposal.status = "rejected";
				firstError ??= result.error ?? "Could not add generated flashcard";
			}
		}

		this.actions().updateManifest(task.id, manifest);
		this.threadActions().updateManifest(threadId, manifest);
		this.threadActions().setState(threadId, "archived", Date.now());
		this.invalidate();

		if (applied > 0) {
			notify().cardsCreated(
				applied,
				this.resolveSourceFile(task.context)?.basename,
			);
		}
		if (firstError) notify().error(firstError);
	}

	private async applyGeneratedDrafts(
		task: AssistantTask,
		threadId: string,
	): Promise<void> {
		const thread = this.threadActions().getById(threadId);
		const manifest = thread?.manifest;
		if (!thread || !manifest || thread.activeTaskId) return;
		const apply = new AssistantApplyService(this.plugin);
		let applied = 0;
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
				notify().error(
					result.error ?? "Could not add generated flashcard drafts",
				);
				break;
			}
			proposal.status = "applied";
			applied += 1;
		}
		this.actions().updateManifest(task.id, manifest);
		this.threadActions().updateManifest(threadId, manifest);
		const stillPending = manifest.proposals.some(
			(proposal) => proposal.status === "proposed",
		);
		if (!stillPending) {
			this.threadActions().setState(threadId, "archived", Date.now());
		}
		this.invalidate();
		if (applied > 0) notify().cardsCreated(applied);
	}

	private async openGeneratedDrafts(threadId: string): Promise<void> {
		const { openAssistantThreadModal } = await import(
			"@true-recall/obsidian/features/assistant/ui/AskAiModal"
		);
		openAssistantThreadModal(this.plugin, threadId);
	}

	private threadTitle(instruction: string): string {
		const compact = instruction.replace(/\s+/g, " ").trim();
		return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
	}

	private assistantMessage(content: string, createdAt: number) {
		return {
			id: crypto.randomUUID(),
			role: "assistant" as const,
			content,
			createdAt,
		};
	}

	private async executeTask(
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
			return this.runGenerationWorkflow(
				task,
				workflow.sourcePresetId,
				onProgress,
			);
		}
		if (workflow?.kind === "modify-card") {
			return this.runCardPolishWorkflow(
				task,
				workflow.sourcePresetId,
				onProgress,
			);
		}

		const config = resolveAIClientConfig(settings, "assistant");
		const webSearch =
			settings.assistantWebSearch &&
			(config.providerType === "openrouter" || config.providerType === "pro");
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
		return agent.run(task.instruction, task.context, this.host);
	}

	private async runGenerationWorkflow(
		task: AssistantTask,
		presetId: string,
		onProgress: (event: AssistantProgressEvent) => void,
	): Promise<AssistantManifest> {
		const preset = this.plugin.settings.generationPresets.find(
			(candidate) => candidate.id === presetId,
		);
		if (!preset) throw new Error(`Generation preset "${presetId}" not found`);
		const noteType = this.plugin.cardStore?.noteTypes.getById(
			preset.noteTypeId,
		);
		if (!noteType) {
			throw new Error(`Note type "${preset.noteTypeId}" no longer exists`);
		}
		const text =
			task.context.source?.text ?? task.context.selectedText?.trim() ?? "";
		if (!text) throw new Error("Card generation requires selected source text");

		onProgress({ kind: "iteration", index: 0 });
		const sourceFile = this.resolveSourceFile(task.context);
		const existingCards = sourceFile
			? await fetchExistingCardsForFile(this.plugin, sourceFile)
			: [];
		const contextText = sourceFile
			? await collectGenerationContext(this.plugin, preset, sourceFile)
			: undefined;
		const generator = new DraftGenerationService(
			() => this.plugin.settings,
			(slug) => this.plugin.flashcardManager.getNoteTypeBySlug(slug),
			new ObsidianHttpClient(),
		);
		const blocks = await generator.generate(text, preset, noteType, {
			existingCards,
			contextText,
		});
		const proposals: AssistantProposal[] = blocks.map((block) => ({
			id: crypto.randomUUID(),
			status: "proposed",
			type: "create_card",
			noteTypeId: block.noteTypeId,
			fields: block.fields,
			sourceUid: task.context.source?.uid,
			sourcePath:
				task.context.source?.path ??
				task.context.activeNotePath ??
				sourceFile?.path,
			sourceText: block.sourceText ?? text,
			generationPresetId: preset.id,
		}));
		onProgress({ kind: "done" });
		return { proposals, citations: [] };
	}

	private async runCardPolishWorkflow(
		task: AssistantTask,
		presetId: string,
		onProgress: (event: AssistantProgressEvent) => void,
	): Promise<AssistantManifest> {
		const preset = this.plugin.settings.cardPolish?.userPresets.find(
			(candidate) => candidate.id === presetId,
		);
		if (!preset) throw new Error(`Card Polish preset "${presetId}" not found`);

		const draft = task.context.draftCard;
		const stored = task.context.card
			? this.host.getCardFields(task.context.card.cardId)
			: null;
		const noteType =
			draft?.noteType ??
			(stored
				? this.host
						.listNoteTypes()
						.find((candidate) => candidate.id === stored.noteTypeId)
				: undefined);
		const original = draft?.fields ?? stored?.fields;
		if (!noteType || !original) {
			throw new Error("Card Polish requires an existing card or open draft");
		}

		onProgress({ kind: "iteration", index: 0 });
		const config = resolveAIClientConfig(this.plugin.settings, "card-polish");
		const service = new CardAIService(
			new OpenRouterClient(
				config.apiKey,
				config.model,
				new ObsidianHttpClient(),
				config.baseUrl,
				undefined,
				"card-polish",
				{ providerType: config.providerType },
			),
		);
		const context = await this.collectPolishContext(task, preset);
		const result = await service.transform({
			fields: original,
			noteType: { name: noteType.name, fields: noteType.fields },
			prompt: preset.prompt,
			operation: draft?.operation ?? "edit",
			context,
		});

		const proposals: AssistantProposal[] = [];
		const [head, ...spawned] = result.cards;
		if (head && !deepEqualFields(head, original)) {
			if (draft) {
				proposals.push({
					id: crypto.randomUUID(),
					status: "proposed",
					type: "update_draft",
					sessionId: draft.sessionId,
					fields: head,
					previousFields: original,
				});
			} else if (task.context.card && stored) {
				proposals.push({
					id: crypto.randomUUID(),
					status: "proposed",
					type: "update_card",
					cardId: task.context.card.cardId,
					noteId: stored.noteId,
					fields: head,
					previousFields: original,
				});
			}
		}
		for (const fields of spawned) {
			proposals.push({
				id: crypto.randomUUID(),
				status: "proposed",
				type: "create_card",
				noteTypeId: noteType.id,
				fields,
				sourceUid:
					draft?.sourceUid ??
					task.context.source?.uid ??
					task.context.card?.sourceUid,
				sourcePath:
					draft?.sourceNotePath ??
					task.context.source?.path ??
					task.context.card?.sourceNotePath,
				sourceText: task.context.source?.text ?? task.context.selectedText,
			});
		}

		onProgress({
			kind: "usage",
			usage: {
				promptTokens: result.usage.promptTokens,
				completionTokens: result.usage.completionTokens,
				totalTokens: result.usage.promptTokens + result.usage.completionTokens,
			},
		});
		onProgress({ kind: "done" });
		return {
			proposals,
			citations: [],
			usage: {
				promptTokens: result.usage.promptTokens,
				completionTokens: result.usage.completionTokens,
				totalTokens: result.usage.promptTokens + result.usage.completionTokens,
			},
		};
	}

	private resolveSourceFile(context: AssistantContext): TFile | null {
		const path =
			context.source?.path ??
			context.card?.sourceNotePath ??
			context.draftCard?.sourceNotePath ??
			context.activeNotePath;
		if (!path) return null;
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file : null;
	}

	private async collectPolishContext(
		task: AssistantTask,
		preset: { includeSourceNote?: boolean; includeRelatedCards?: boolean },
	): Promise<CardAIContext | undefined> {
		if (!preset.includeSourceNote && !preset.includeRelatedCards)
			return undefined;
		const context: CardAIContext = {};
		const sourcePath =
			task.context.draftCard?.sourceNotePath ??
			task.context.card?.sourceNotePath ??
			task.context.source?.path;
		if (preset.includeSourceNote && sourcePath) {
			const content = await this.host.readNote(sourcePath);
			if (content) {
				context.sourceNotePath = sourcePath;
				context.sourceNoteContent = content;
			}
		}
		const sourceUid =
			task.context.draftCard?.sourceUid ??
			task.context.card?.sourceUid ??
			task.context.source?.uid;
		if (preset.includeRelatedCards && sourceUid) {
			context.relatedCards = this.host.getRelatedCards(sourceUid);
		}
		return context;
	}
}
