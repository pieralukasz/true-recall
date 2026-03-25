import { buildRewritePrompt } from "@features/ai/prompts/block-prompt-builder";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { Notice } from "obsidian";
import { resolveAIClientConfig } from "./ai-client-config";
import { parseBlockResponse } from "./incremental-flashcard-parser";
import { getTextContent, OpenRouterClient } from "./openrouter-client";
import { addStreamedCard, clearRecentCards } from "./streaming-state";

export interface RewriteCard {
	id: string;
	question: string;
	answer: string;
	sourceUid?: string;
	createdAt?: number;
	noteTypeId: string;
}

export interface RewriteResult {
	created: number;
	suspended: number;
}

export class RewriteService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private getNoteTypeBySlug: (slug: string) => NoteType | null,
		private getNoteTypeById: (id: string) => NoteType | null | undefined,
	) {}

	async rewrite(
		cards: RewriteCard[],
		flashcardManager: FlashcardManager,
		bulkSuspend: (ids: string[]) => number,
	): Promise<RewriteResult> {
		const firstCard = cards[0];
		if (!firstCard) return { created: 0, suspended: 0 };

		const noteType = this.getNoteTypeById(firstCard.noteTypeId);
		if (!noteType) {
			new Notice("Note type not found. Cannot rewrite.");
			return { created: 0, suspended: 0 };
		}

		// Build input using the note type's actual field names
		const inputText = cards
			.map((c) => {
				const fieldLines = noteType.fields.map((fieldName, i) => {
					const value = i === 0 ? c.question : i === 1 ? (c.answer ?? "") : "";
					return `${fieldName}: ${value}`;
				});
				return `#existing\n${fieldLines.join("\n")}\n---`;
			})
			.join("\n\n");

		const systemPrompt = buildRewritePrompt(noteType);

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
			(min, c) =>
				c.createdAt != null && c.createdAt < min ? c.createdAt : min,
			firstCard.createdAt ?? Date.now(),
		);

		let created = 0;
		for (const block of blocks) {
			const result = flashcardManager.createNote({
				noteTypeId: noteType.id,
				fields: block.fields,
				alwaysTypeIn: block.alwaysTypeIn,
				sourceUid: firstCard.sourceUid,
				sourceText: block.sourceText,
				createdVia: "ai-rewrite",
				createdAt: earliestCreatedAt,
			});
			for (const card of result.cards) {
				addStreamedCard({
					id: card.id,
					question: card.question ?? "",
					answer: card.answer ?? "",
					cardType: card.cardType,
					clozeTemplate: card.clozeTemplate,
					clozeIndex: card.clozeIndex,
					sourceText: card.sourceText,
				});
			}
			created += result.cards.length;
		}

		setTimeout(() => clearRecentCards(), 1000);

		return { created, suspended };
	}

	private async callAI(
		systemPrompt: string,
		userContent: string,
	): Promise<string> {
		const settings = this.getSettings();
		const config = resolveAIClientConfig(settings);

		const client = new OpenRouterClient(config.apiKey, config.model, config.baseUrl);

		const response = await client.chat({
			messages: [
				{ role: "system" as const, content: systemPrompt },
				{ role: "user" as const, content: userContent },
			],
			temperature: 0.7,
		});
		return getTextContent(response.choices[0]?.message);
	}

	private parseResponse(text: string) {
		return parseBlockResponse(text, this.getNoteTypeBySlug);
	}
}
