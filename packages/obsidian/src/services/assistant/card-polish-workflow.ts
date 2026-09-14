import type { CardAIPreset } from "@true-recall/core";
import type {
	AssistantManifest,
	AssistantProgressEvent,
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";
import { OpenRouterClient } from "@true-recall/core/ai/clients/openrouter-client";
import { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";
import { CUSTOM_CARD_POLISH_PRESET_ID } from "@true-recall/core/ai/workflows/ai-workflow";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import { ObsidianHttpClient } from "../../adapters/ObsidianHttpClient";
import type { ObsidianAssistantHost } from "./assistant-host";
import {
	type CardAIContext,
	CardAIService,
	deepEqualFields,
	resolveCardAIPolicy,
	runLocalCardTransform,
} from "@true-recall/plugins/shared/card-ai";

export class CardPolishWorkflow {
	constructor(
		private plugin: TrueRecallPlugin,
		private host: ObsidianAssistantHost,
	) {}

	async run(
		task: AssistantTask,
		presetId: string,
		onProgress: (event: AssistantProgressEvent) => void,
	): Promise<AssistantManifest> {
		const preset: CardAIPreset | undefined =
			presetId === CUSTOM_CARD_POLISH_PRESET_ID
				? {
						id: CUSTOM_CARD_POLISH_PRESET_ID,
						name: "Custom Card Polish",
						prompt: task.context.workflowInstruction ?? task.instruction,
						autoApply:
							this.plugin.settings.cardPolish?.customPromptAutoApply ?? false,
						builtin: false,
						mode: "edit",
						fieldScope: "all",
						executor: "ai",
					}
				: this.plugin.settings.cardPolish?.userPresets.find(
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
		const policy = resolveCardAIPolicy(preset);
		const previousEdit = task.context.draftWorkspace?.manifest.proposals.find(
			(proposal) =>
				proposal.status === "proposed" &&
				((draft &&
					proposal.type === "update_draft" &&
					proposal.sessionId === draft.sessionId) ||
					(task.context.card &&
						proposal.type === "update_card" &&
						proposal.cardId === task.context.card.cardId)),
		);
		// Follow-up instructions refine the currently visible edit instead of
		// starting over from the stored card. Split/spawn workflows intentionally
		// keep the original source as their stable input and regenerate the set.
		const workingFields =
			policy.mode === "edit" &&
			previousEdit &&
			(previousEdit.type === "update_card" ||
				previousEdit.type === "update_draft")
				? previousEdit.fields
				: original;
		const answerField = noteType.fields[1] ?? noteType.fields[0];
		if (
			policy.fieldScope === "empty-answer" &&
			answerField &&
			(workingFields[answerField] ?? "").trim() !== ""
		) {
			onProgress({ kind: "done" });
			return { proposals: [], citations: [] };
		}

		const basePrompt = task.context.workflowInstruction ?? preset.prompt;
		const prompt = task.context.draftWorkspace
			? `${basePrompt}\n\nAdditional instruction: ${task.instruction.trim()}`
			: basePrompt;
		const result =
			policy.executor === "ai"
				? await this.runAICardPolish({
						fields: workingFields,
						noteType,
						prompt,
						operation: draft?.operation ?? "edit",
						policy,
						context: await this.collectPolishContext(
							task,
							preset,
							workingFields,
						),
					})
				: {
						cards: [
							runLocalCardTransform(
								policy.executor,
								workingFields,
								policy.fieldScope,
							),
						],
						rawResponse: "",
						usage: { promptTokens: 0, completionTokens: 0 },
					};

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

	private async runAICardPolish(input: {
		fields: Record<string, string>;
		noteType: { name: string; fields: readonly string[] };
		prompt: string;
		operation: "edit" | "create";
		policy: ReturnType<typeof resolveCardAIPolicy>;
		context?: CardAIContext;
	}) {
		const config = resolveAIClientConfig(this.plugin.settings, "card-polish");
		return new CardAIService(
			new OpenRouterClient(
				config.apiKey,
				config.model,
				new ObsidianHttpClient(),
				config.baseUrl,
				undefined,
				"card-polish",
				{ providerType: config.providerType },
			),
		).transform({
			fields: input.fields,
			noteType: input.noteType,
			prompt: input.prompt,
			operation: input.operation,
			mode: input.policy.mode,
			fieldScope: input.policy.fieldScope,
			context: input.context,
			temperature: Math.min(
				config.temperature,
				input.policy.mode === "edit" ? 0.2 : 0.4,
			),
		});
	}

	private async collectPolishContext(
		task: AssistantTask,
		preset: { includeSourceNote?: boolean; includeRelatedCards?: boolean },
		currentFields: Record<string, string>,
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
			context.relatedCards = context.relatedCards
				.filter((card) => !deepEqualFields(card.fields, currentFields))
				.slice(0, 5);
		}
		return context;
	}
}
