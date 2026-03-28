import type { ChatMessage } from "@features/ai/services/openrouter-client";
import { StreamingOpenRouterClient } from "@features/ai/services/streaming-openrouter-client";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import { LITELLM_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { fileBasename } from "@shared/utils";
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
		private frontmatterIndex?: FrontmatterIndexService,
	) {}

	async *queryStream(
		question: string,
		history: ChatTurn[],
	): AsyncGenerator<string> {
		const searchResults = await this.search.search(question);
		const { context, sourceMap } = this.packContext(searchResults.results);
		// Store one representative result per unique source (for citation click handlers)
		this.lastSearchResults = sourceMap;

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

	private packContext(results: SearchResult[]): {
		context: string;
		sourceMap: SearchResult[];
	} {
		// Group chunks by unique source
		const groups = new Map<
			string,
			{ label: string; chunks: SearchResult[]; totalTokens: number }
		>();

		for (const r of results) {
			// Resolve grouping key: notes by path, flashcards by their source note path
			let key: string;
			let label: string;

			if (r.sourceType === "note") {
				key = r.sourceId;
				label = fileBasename(r.sourceId);
			} else if (r.sourceNoteUid && this.frontmatterIndex) {
				const noteFile = this.frontmatterIndex.getFileByValue(
					"flashcard_uid",
					r.sourceNoteUid,
				);
				key = noteFile?.path ?? `fc:${r.sourceId}`;
				label = noteFile ? fileBasename(noteFile.path) : "Flashcards";
			} else {
				key = `fc:${r.sourceId}`;
				label = "Flashcard";
			}

			const existing = groups.get(key);
			if (existing) {
				existing.chunks.push(r);
				existing.totalTokens += r.tokenCount;
			} else {
				groups.set(key, { label, chunks: [r], totalTokens: r.tokenCount });
			}
		}

		const parts: string[] = [];
		const sourceMap: SearchResult[] = [];
		let tokens = 0;
		let idx = 1;

		for (const [, group] of groups) {
			if (tokens + group.totalTokens > CONTEXT_TOKEN_BUDGET) break;

			const chunkTexts = group.chunks
				.map((c) => {
					const heading = c.headingBreadcrumb
						? `(${c.headingBreadcrumb})\n`
						: "";
					return `${heading}${c.content}`;
				})
				.join("\n\n");

			parts.push(`[${idx}] ${group.label}\n${chunkTexts}`);
			tokens += group.totalTokens;
			// Store the first chunk as representative for navigation
			const representative = group.chunks[0];
			if (representative) sourceMap.push(representative);
			idx++;
		}

		return { context: parts.join("\n\n---\n\n"), sourceMap };
	}

	private buildMessages(
		question: string,
		history: ChatTurn[],
		context: string,
	): ChatMessage[] {
		const messages: ChatMessage[] = [
			{ role: "system", content: SYSTEM_PROMPT },
		];

		// Keep last 6 turns to stay within model context limits while preserving conversational continuity
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
