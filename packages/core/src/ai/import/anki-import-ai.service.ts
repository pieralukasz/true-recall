import type { IHttpClient } from "../../interfaces/http-client";
import type { ContentPart } from "../clients/openrouter-client";
import { OpenRouterClient } from "../clients/openrouter-client";
import type { AIClientConfig } from "../config/ai-client-config";
import {
	buildClassifyMessages,
	buildCleanupMessages,
	restoreImageEmbeds,
	stripImageEmbeds,
} from "./anki-import-prompts";

const CLASSIFY_BATCH_SIZE = 100;
const CLEANUP_BATCH_SIZE = 50;

export class AnkiImportAIService {
	private client: OpenRouterClient;

	constructor(config: AIClientConfig, httpClient: IHttpClient) {
		this.client = new OpenRouterClient(
			config.apiKey,
			config.model,
			httpClient,
			config.baseUrl,
		);
	}

	async classifyDecks(
		deckNames: string[],
		cards: { id: number; question: string }[],
		onProgress?: (done: number, total: number) => void,
	): Promise<Map<number, string>> {
		const result = new Map<number, string>();
		const batches = chunk(
			cards.map((c) => ({ id: c.id, q: c.question.slice(0, 200) })),
			CLASSIFY_BATCH_SIZE,
		);

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			if (!batch) continue;

			try {
				const messages = buildClassifyMessages(deckNames, batch);
				const response = await this.client.chat({
					messages,
					temperature: 0.3,
				});

				const text = extractResponseText(response);
				const parsed = parseJsonArray<{ id: number; deck: string }>(text);

				for (const item of parsed) {
					if (typeof item.id === "number" && typeof item.deck === "string") {
						result.set(item.id, item.deck);
					}
				}
			} catch (err) {
				console.error(
					`[True Recall] AI deck classification batch ${i + 1} failed:`,
					err,
				);
			}

			onProgress?.(i + 1, batches.length);
		}

		return result;
	}

	async cleanupContent(
		cards: { id: number; fields: Record<string, string> }[],
		onProgress?: (done: number, total: number) => void,
	): Promise<Map<number, Record<string, string>>> {
		const result = new Map<number, Record<string, string>>();

		// Strip image embeds before sending to AI
		const strippedCards = cards.map((c) => ({
			id: c.id,
			fields: stripImageEmbeds(c.fields),
		}));
		const originalMap = new Map(cards.map((c) => [c.id, c.fields]));

		const batches = chunk(strippedCards, CLEANUP_BATCH_SIZE);

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			if (!batch) continue;

			try {
				const messages = buildCleanupMessages(batch);
				const response = await this.client.chat({
					messages,
					temperature: 0,
				});

				const text = extractResponseText(response);
				const parsed = parseJsonArray<{
					id: number;
					fields: Record<string, string>;
				}>(text);

				for (const item of parsed) {
					if (typeof item.id !== "number" || !item.fields) continue;
					const original = originalMap.get(item.id);
					if (!original) continue;

					// Restore image embeds that were stripped before AI call
					result.set(item.id, restoreImageEmbeds(original, item.fields));
				}
			} catch (err) {
				console.error(
					`[True Recall] AI content cleanup batch ${i + 1} failed:`,
					err,
				);
			}

			onProgress?.(i + 1, batches.length);
		}

		return result;
	}
}

function extractResponseText(response: {
	choices: Array<{ message: { content: string | ContentPart[] | null } }>;
}): string {
	const content = response.choices[0]?.message?.content;
	if (typeof content === "string") return content;
	return "";
}

function parseJsonArray<T>(text: string): T[] {
	// Strip markdown code fences if present
	let cleaned = text.trim();
	if (cleaned.startsWith("```")) {
		cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
	}

	// Find array boundaries
	const start = cleaned.indexOf("[");
	const end = cleaned.lastIndexOf("]");
	if (start === -1 || end === -1 || end <= start) return [];

	try {
		return JSON.parse(cleaned.slice(start, end + 1));
	} catch {
		return [];
	}
}

function chunk<T>(array: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		result.push(array.slice(i, i + size));
	}
	return result;
}

export function shouldClassifyDecks(
	convertedCards: { deckName: string }[],
	deckCount: number,
): boolean {
	if (deckCount < 3) return false;

	// Count cards per deck
	const counts = new Map<string, number>();
	for (const card of convertedCards) {
		counts.set(card.deckName, (counts.get(card.deckName) ?? 0) + 1);
	}

	// Check if >50% of cards are in a single deck
	const maxCount = Math.max(...counts.values());
	return maxCount > convertedCards.length * 0.5;
}
