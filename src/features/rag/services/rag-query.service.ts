import type { ChatMessage } from "@features/ai/services/openrouter-client";
import { StreamingOpenRouterClient } from "@features/ai/services/streaming-openrouter-client";
import { LITELLM_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import type { RagSearchService, SearchResult } from "./rag-search.service";

const SYSTEM_PROMPT = `You are a knowledgeable assistant that answers based on the user's notes and flashcards.
Cite sources inline using numbered references like [1], [2] etc. matching the source numbers in the provided context.
If context doesn't contain enough info, say so clearly — do not make things up.
Be concise, use markdown formatting, answer in the same language as the user's question.`;

const CONTEXT_TOKEN_BUDGET = 4000;

export interface ChatTurn {
	role: "user" | "assistant";
	content: string;
	sources?: SearchResult[];
	timestamp: number;
}

export class RagQueryService {
	private lastSearchResults: SearchResult[] = [];

	constructor(
		private search: RagSearchService,
		private settings: () => TrueRecallSettings,
	) {}

	async *queryStream(
		question: string,
		history: ChatTurn[],
	): AsyncGenerator<string> {
		const searchResults = await this.search.search(question);
		this.lastSearchResults = searchResults.results;
		const context = this.packContext(searchResults.results);

		const messages = this.buildMessages(question, history, context);
		const s = this.settings();
		const baseUrl = LITELLM_URL.replace("/chat/completions", "");

		const client = new StreamingOpenRouterClient(
			s.proKey ?? "",
			"auto",
			`${baseUrl}/chat/completions`,
		);

		for await (const chunk of client.chatStream({ messages })) {
			yield chunk.content;
		}
	}

	getLastSearchResults(): SearchResult[] {
		return this.lastSearchResults;
	}

	private packContext(results: SearchResult[]): string {
		const parts: string[] = [];
		let tokens = 0;
		let idx = 1;

		for (const r of results) {
			if (tokens + r.tokenCount > CONTEXT_TOKEN_BUDGET) break;

			let label = "";
			if (r.sourceType === "note") {
				const name = shortName(r.sourceId);
				const heading = r.headingBreadcrumb ? ` > ${r.headingBreadcrumb}` : "";
				label = `${name}${heading}`;
			} else {
				label = "Flashcard";
			}

			parts.push(`[${idx}] (${label})\n${r.content}`);
			tokens += r.tokenCount;
			idx++;
		}

		return parts.join("\n\n---\n\n");
	}

	private buildMessages(
		question: string,
		history: ChatTurn[],
		context: string,
	): ChatMessage[] {
		const messages: ChatMessage[] = [
			{ role: "system", content: SYSTEM_PROMPT },
		];

		for (const turn of history.slice(-6)) {
			messages.push({ role: turn.role, content: turn.content });
		}

		const userMessage = context
			? `Context from my notes and flashcards:\n\n${context}\n\n---\n\nQuestion: ${question}`
			: question;

		messages.push({ role: "user", content: userMessage });
		return messages;
	}
}

function shortName(sourceId: string): string {
	const withoutExt = sourceId.replace(/\.md$/, "");
	const lastSlash = withoutExt.lastIndexOf("/");
	return lastSlash >= 0 ? withoutExt.slice(lastSlash + 1) : withoutExt;
}
