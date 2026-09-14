import type { TFile } from "obsidian";

import type {
	AssistantManifest,
	AssistantProgressEvent,
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";
import { ChunkedGenerationService } from "@true-recall/core/ai/generation/chunked-generation.service";
import { DraftGenerationService } from "@true-recall/core/ai/generation/draft-generation.service";
import { resolveGenerationTarget } from "@true-recall/core/ai/generation/preset-resolver";
import type { StreamingFlashcardManager } from "@true-recall/core/ai/generation/streaming-generation.service";
import type { ExistingCardContext } from "@true-recall/core/ai/prompts/existing-cards-block";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import { ObsidianHttpClient } from "../../adapters/ObsidianHttpClient";
import { BatchCreateCommand } from "../../commands/commands/card-create.cmd";
import { collectGenerationContext } from "../../plugin/collect-generation-context";
import { fetchExistingCardsForFile } from "../../plugin/existing-cards-fetcher";
import type { ObsidianAssistantHost } from "./assistant-host";
import { resolveAssistantSourceFile } from "./assistant-source";
export class GenerationWorkflow {
	constructor(
		private plugin: TrueRecallPlugin,
		private host: ObsidianAssistantHost,
		private manager: () => StreamingFlashcardManager,
		private confirmGeneration: NonNullable<
			Parameters<ChunkedGenerationService["generateFromNote"]>[4]
		>,
	) {}

	async run(
		task: AssistantTask,
		presetId: string,
		onProgress: (event: AssistantProgressEvent) => void,
	): Promise<AssistantManifest> {
		const { preset, noteType } = resolveGenerationTarget(
			this.plugin.settings,
			{
				getNoteTypeById: (id) =>
					this.plugin.cardStore?.noteTypes.getById(id) ?? null,
			},
			presetId,
		);
		const text =
			task.context.source?.text ?? task.context.selectedText?.trim() ?? "";
		if (!text) throw new Error("Card generation requires selected source text");

		onProgress({ kind: "iteration", index: 0 });
		const sourceFile = resolveAssistantSourceFile(this.plugin, task.context);
		const existingCards = sourceFile
			? await fetchExistingCardsForFile(this.plugin, sourceFile)
			: [];
		const contextText = sourceFile
			? await collectGenerationContext(this.plugin, preset, sourceFile)
			: undefined;

		// Card-writing generation runs on the streaming engine so the note panel
		// fills in live and long notes get chunked. The draft engine below is for
		// proposals the user reviews in the inbox — and for the degenerate case of
		// a generation with no resolvable source note, which the engine cannot
		// anchor cards to.
		if (task.context.applyGeneratedCardsImmediately && sourceFile) {
			return this.runStreamingGeneration(preset.id, sourceFile, text, {
				existingCards,
				contextText,
				preserveImageEmbeds: !!task.context.selectedText?.trim(),
			});
		}

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

	/**
	 * Runs the shared streaming engine, which persists each card the moment it
	 * finishes parsing. The manifest it returns is a record of what already
	 * landed, not a set of pending proposals.
	 */
	private async runStreamingGeneration(
		presetId: string,
		sourceFile: TFile,
		text: string,
		options: {
			existingCards: ExistingCardContext[];
			contextText: string | undefined;
			preserveImageEmbeds: boolean;
		},
	): Promise<AssistantManifest> {
		const service = new ChunkedGenerationService(
			() => this.plugin.settings,
			this.manager(),
			new ObsidianHttpClient(),
		);

		const result = await service.generateFromNote(
			text,
			sourceFile,
			presetId,
			options,
			this.confirmGeneration,
		);

		const proposals: AssistantProposal[] = [];
		for (const cardId of result.createdCardIds) {
			const stored = this.host.getCardFields(cardId);
			if (!stored) continue;
			proposals.push({
				id: crypto.randomUUID(),
				status: "applied",
				type: "create_card",
				noteTypeId: stored.noteTypeId,
				fields: stored.fields,
				sourcePath: sourceFile.path,
				generationPresetId: result.preset.id,
			});
		}

		if (result.createdCardIds.length > 0) {
			await this.plugin.commandService?.execute(
				new BatchCreateCommand(result.createdCardIds),
			);
		}

		return {
			proposals,
			citations: [],
			directGeneration: {
				created: result.created,
				duplicates: result.duplicates,
				failedChunks: result.failedChunks,
				totalChunks: result.totalChunks,
				errors: result.errors,
				sourceName: sourceFile.basename,
			},
		};
	}
}
