import { buildRewritePrompt } from "@features/ai/prompts/block-prompt-builder";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { Notice } from "obsidian";
import {
	getBYOKFallbackConfig,
	resolveAIClientConfig,
} from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import {
	AIRequestError,
	getTextContent,
	OpenRouterClient,
} from "./openrouter-client";

export interface RewriteCard {
	id: string;
	question: string;
	answer: string;
	sourceUid?: string;
	createdAt?: number;
}

export interface RewriteResult {
	created: number;
	suspended: number;
}

export class RewriteService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private getNoteType: (slug: string) => NoteType | null,
		private getAllNoteTypes: () => NoteType[],
	) {}

	async rewrite(
		cards: RewriteCard[],
		flashcardManager: FlashcardManager,
		bulkSuspend: (ids: string[]) => number,
	): Promise<RewriteResult> {
		const inputText = cards
			.map(
				(c) =>
					`#existing\nFront: ${c.question}\nBack: ${c.answer ?? ""}\n---`,
			)
			.join("\n\n");

		const noteTypes = this.getAllNoteTypes();
		const systemPrompt = buildRewritePrompt(noteTypes);

		const responseText = await this.callAI(systemPrompt, inputText);
		const blocks = this.parseResponse(responseText);

		if (blocks.length === 0) {
			new Notice("AI returned no cards. Original cards unchanged.");
			return { created: 0, suspended: 0 };
		}

		const cardIds = cards.map((c) => c.id);
		const suspended = bulkSuspend(cardIds);

		// Inherit the earliest created_at from originals for position preservation
		const earliestCreatedAt = cards.reduce(
			(min, c) => (c.createdAt != null && c.createdAt < min ? c.createdAt : min),
			cards[0]?.createdAt ?? Date.now(),
		);

		let created = 0;
		for (const block of blocks) {
			const result = flashcardManager.createNote({
				noteTypeId: block.noteTypeId,
				fields: block.fields,
				alwaysTypeIn: block.alwaysTypeIn,
				sourceUid: cards[0]?.sourceUid,
				sourceText: block.sourceText,
				createdVia: "ai-rewrite",
				createdAt: earliestCreatedAt,
			});
			created += result.cards.length;
		}

		return { created, suspended };
	}

	private async callAI(
		systemPrompt: string,
		userContent: string,
	): Promise<string> {
		const settings = this.getSettings();
		const config = resolveAIClientConfig(settings);

		const client = new OpenRouterClient(
			config.apiKey,
			config.model,
			config.proxyUrl,
			config.userId,
		);

		const request = {
			messages: [
				{ role: "system" as const, content: systemPrompt },
				{ role: "user" as const, content: userContent },
			],
			temperature: 0.7,
		};

		try {
			const response = await client.chat(request);
			return getTextContent(response.choices[0]?.message);
		} catch (error) {
			if (error instanceof AIRequestError && error.isBudgetExceeded) {
				const fallback = getBYOKFallbackConfig(settings);
				if (fallback) {
					new Notice(
						"Subscription budget exceeded. Falling back to your OpenRouter key.",
					);
					const fallbackClient = new OpenRouterClient(
						fallback.apiKey,
						fallback.model,
						fallback.proxyUrl,
						undefined,
					);
					const response = await fallbackClient.chat(request);
					return getTextContent(response.choices[0]?.message);
				}
				new Notice(
					"Budget exceeded. Top up at truerecall.app/dashboard, or add your own OpenRouter API key in settings.",
				);
			}
			throw error;
		}
	}

	private parseResponse(text: string): ParsedBlockResult[] {
		const parser = new IncrementalFlashcardParser(this.getNoteType);
		parser.feed(text);
		return parser
			.finish()
			.filter(
				(e): e is { type: "card_complete"; block: ParsedBlockResult } =>
					e.type === "card_complete" && e.block !== null,
			)
			.map((e) => e.block);
	}
}

type ParsedBlockResult = NonNullable<
	Extract<
		ReturnType<IncrementalFlashcardParser["finish"]>[number],
		{ type: "card_complete" }
	>["block"]
>;
