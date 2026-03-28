import type { ChatMessage } from "@features/ai/services/openrouter-client";
import { StreamingOpenRouterClient } from "@features/ai/services/streaming-openrouter-client";
import { LITELLM_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import type { RagSearchService, SearchResult } from "./rag-search.service";

const SYSTEM_PROMPT = `You are an assistant that answers questions based on the user's personal notes and flashcards.
Cite sources using [Source: filename > heading] for notes or [Card: question preview] for flashcards.
For flashcard results, mention mastery level when relevant (stable, learning, struggling).
If the provided context doesn't contain enough information, say so clearly — do not make things up.
Be concise and direct.`;

const CONTEXT_TOKEN_BUDGET = 4000;

export interface ChatTurn {
	role: "user" | "assistant";
	content: string;
	sources?: SearchResult[];
	timestamp: number;
}

export class RagQueryService {
	constructor(
		private search: RagSearchService,
		private settings: () => TrueRecallSettings,
	) {}

	async *queryStream(
		question: string,
		history: ChatTurn[],
	): AsyncGenerator<string> {
		const searchResults = await this.search.search(question);
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

	async query(
		question: string,
		history: ChatTurn[],
	): Promise<{ answer: string; sources: SearchResult[] }> {
		const searchResults = await this.search.search(question);
		let answer = "";

		for await (const chunk of this.queryStream(question, history)) {
			answer += chunk;
		}

		return { answer, sources: searchResults.results };
	}

	getLastSearchResults(question: string): Promise<SearchResult[]> {
		return this.search.search(question).then((r) => r.results);
	}

	private packContext(results: SearchResult[]): string {
		const parts: string[] = [];
		let tokens = 0;

		for (const r of results) {
			if (tokens + r.tokenCount > CONTEXT_TOKEN_BUDGET) break;

			let header = "";
			if (r.sourceType === "note") {
				header = `[Note: ${r.sourceId}${r.headingBreadcrumb ? ` > ${r.headingBreadcrumb}` : ""}]`;
			} else {
				const stateLabel =
					r.fsrs?.state === 0
						? "new"
						: r.fsrs?.state === 1
							? "learning"
							: r.fsrs?.state === 2
								? "review"
								: r.fsrs?.state === 3
									? "relearning"
									: "unknown";
				header = `[Flashcard (${stateLabel}, stability: ${r.fsrs?.stability?.toFixed(1) ?? "?"}d)]`;
			}

			parts.push(`${header}\n${r.content}`);
			tokens += r.tokenCount;
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
