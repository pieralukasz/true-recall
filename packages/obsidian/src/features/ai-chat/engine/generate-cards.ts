import { TFile } from "obsidian";

import { StreamingOpenRouterClient } from "@true-recall/core/ai/clients/streaming-openrouter-client";
import { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";
import { resolveGenerationTarget } from "@true-recall/core/ai/generation/preset-resolver";
import { IncrementalFlashcardParser } from "@true-recall/core/ai/parsing/incremental-flashcard-parser";
import { chunkMarkdown } from "@true-recall/core/ai/parsing/markdown-chunker";
import { buildGenerationPrompt } from "@true-recall/core/ai/prompts/generation-request";
import type { ParsedBlock } from "@true-recall/core/flashcard/parsing/block-parser.service";

import { ObsidianHttpClient } from "../../../adapters/ObsidianHttpClient";
import type TrueRecallPlugin from "../../../main";
import { collectGenerationContext } from "../../../plugin/collect-generation-context";
import { fetchExistingCardsForFile } from "../../../plugin/existing-cards-fetcher";
import type { ChatContext } from "./chat-context";
import type { ProposedCard } from "./proposals";

/**
 * The Pro proxy runs generation in two passes (write, then review) and sends
 * this character as its keep-alive once the review pass starts. Card parsers
 * ignore text outside JSON objects, so other clients never see it.
 */
export const REVIEW_STAGE_MARKER = "\u200b";

export type GenerateCardsStage = "reading" | "writing" | "reviewing" | "done";

export interface GenerateCardsInput {
	/** Note to generate from; the chat's note when omitted. */
	notePath?: string | null;
	/** Generate from the whole note even when the chat holds a selection. */
	wholeNote?: boolean;
}

export interface GenerateCardsOutput {
	stage: GenerateCardsStage;
	/** Cards so far (streaming providers) or all of them (stage "done"). */
	cards: ProposedCard[];
	notePath?: string;
	presetName?: string;
	/** True on the Pro tier, whose server adds the review pass. */
	reviewed?: boolean;
	startedAt: number;
	error?: string;
}

function toProposedCard(
	block: ParsedBlock,
	fields: readonly string[],
): ProposedCard | null {
	const [first = "Front", second = "Back"] = fields;
	const question = (block.fields[first] ?? "").trim();
	if (!question) return null;
	return {
		question,
		answer: (block.fields[second] ?? "").trim(),
		...(block.sourceText ? { source: block.sourceText } : {}),
	};
}

/**
 * Runs the user's generation preset (the same request the panel's generator
 * sends) and reports progress. Each yield is a preliminary tool result the
 * chat renders live; the last one is the final result with every card.
 */
export async function* runGenerateCards(
	plugin: TrueRecallPlugin,
	context: ChatContext,
	input: GenerateCardsInput,
	abortSignal?: AbortSignal,
): AsyncGenerator<GenerateCardsOutput> {
	const startedAt = Date.now();
	const notePath =
		input.notePath ??
		context.note?.path ??
		context.selection?.notePath ??
		undefined;
	const base = { notePath, startedAt };
	yield { ...base, stage: "reading", cards: [] };

	const file = notePath
		? plugin.app.vault.getAbstractFileByPath(notePath)
		: null;
	if (!(file instanceof TFile)) {
		yield {
			...base,
			stage: "done",
			cards: [],
			error: "Open a note first: there is no note to make cards from.",
		};
		return;
	}

	const settings = plugin.settings;
	const presetId = context.preset?.id ?? settings.defaultGenerationPresetId;
	let target: ReturnType<typeof resolveGenerationTarget>;
	try {
		target = resolveGenerationTarget(
			settings,
			plugin.flashcardManager,
			presetId,
		);
	} catch (error) {
		yield {
			...base,
			stage: "done",
			cards: [],
			error: error instanceof Error ? error.message : String(error),
		};
		return;
	}
	const { preset, noteType } = target;

	const selection = input.wholeNote
		? undefined
		: context.selection?.text?.trim();
	const raw = selection || (await plugin.app.vault.cachedRead(file));
	const { chunks } = chunkMarkdown(raw, { preserveImageEmbeds: !!selection });
	if (chunks.length === 0 || !chunks.some((c) => c.content.trim())) {
		yield {
			...base,
			stage: "done",
			cards: [],
			presetName: preset.name,
			error: "The note is empty.",
		};
		return;
	}

	const [existingCards, contextText] = await Promise.all([
		fetchExistingCardsForFile(plugin, file),
		collectGenerationContext(plugin, preset, file),
	]);
	const aiConfig = resolveAIClientConfig(settings, "generation");
	const client = new StreamingOpenRouterClient(
		aiConfig.apiKey,
		aiConfig.model,
		new ObsidianHttpClient(),
		aiConfig.baseUrl,
		undefined,
		{ providerType: aiConfig.providerType },
	);
	const getNoteType = (slug: string) =>
		plugin.flashcardManager.getNoteTypeBySlug(slug);
	const reviewed = aiConfig.hasProTier;
	const meta = { ...base, presetName: preset.name, reviewed };

	const cards: ProposedCard[] = [];
	let stage: GenerateCardsStage = "writing";
	yield { ...meta, stage, cards: [] };

	for (const chunk of chunks) {
		if (!chunk.content.trim()) continue;
		const { systemPrompt, userContent, metadata } = buildGenerationPrompt({
			preset,
			noteType,
			text: chunk.content,
			existingCards,
			contextText,
			hasProTier: aiConfig.hasProTier,
			chunk:
				chunks.length > 1
					? {
							headingBreadcrumb: chunk.headingBreadcrumb,
							sourceName: file.basename,
						}
					: undefined,
		});
		const parser = new IncrementalFlashcardParser(getNoteType);
		const take = (events: ReturnType<IncrementalFlashcardParser["feed"]>) => {
			let added = false;
			for (const event of events) {
				if (event.type !== "card_complete" || !event.block) continue;
				const card = toProposedCard(event.block, noteType.fields);
				if (card) {
					cards.push(card);
					added = true;
				}
			}
			return added;
		};
		stage = "writing";
		const stream = client.chatStream(
			{
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userContent },
				],
				...(aiConfig.hasProTier ? {} : { temperature: aiConfig.temperature }),
				metadata,
			},
			abortSignal,
		);
		for await (const part of stream) {
			if (part.content.includes(REVIEW_STAGE_MARKER) && stage !== "reviewing") {
				stage = "reviewing";
				yield { ...meta, stage, cards: [...cards] };
				continue;
			}
			if (take(parser.feed(part.content))) {
				yield { ...meta, stage, cards: [...cards] };
			}
		}
		take(parser.finish());
	}

	yield { ...meta, stage: "done", cards };
}
