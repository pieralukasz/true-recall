import type { ChatMessage } from "@features/ai/services/openrouter-client";
import { StreamingOpenRouterClient } from "@features/ai/services/streaming-openrouter-client";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import { LITELLM_URL } from "@shared/constants";
import type {
	ChatResponseLength,
	TrueRecallSettings,
} from "@shared/types/settings.types";
import { fileBasename } from "@shared/utils";
import type { ContextItem } from "../ui/context/context.types";
import type { RagSearchService, SearchResult } from "./rag-search.service";
import type { StudyDataGatherer } from "./study-data-gatherer";
import { classifyIntent } from "./study-intent-classifier";

const KNOWLEDGE_PROMPT = `You are a knowledgeable assistant that answers based on the user's notes and flashcards.
Cite sources inline using numbered references like [1], [2] etc. matching the source numbers in the provided context.
If context doesn't contain enough info, say so clearly — do not make things up.
Answer in the same language as the user's question.
Each source includes a modification date. When the user asks about recent or latest content, prioritize sources with newer dates.

Formatting rules (STRICT — always follow):
- When listing 2+ items, ALWAYS use markdown list syntax (- or 1.). NEVER write multiple items as plain paragraphs with just bold text.
  WRONG: "**Item:** description.\\n**Item2:** description."
  RIGHT: "- **Item:** description.\\n- **Item2:** description."
- Separate sections with blank lines.
- Use **bold** for key terms at the start of list items.
- Use headings (##, ###) to organize longer answers.
- Keep paragraphs short (2-4 sentences max).`;

const STUDY_PROMPT = `You are a knowledgeable study assistant with access to the user's notes, flashcards, and study progress data.

When answering knowledge questions:
- Cite sources inline using numbered references like [1], [2] etc.
- If context doesn't contain enough info, say so clearly — do not make things up.
- Each source includes a modification date. When the user asks about recent or latest content, prioritize sources with newer dates.

When answering study progress questions:
- Use the provided Study Progress Data to give accurate, specific answers.
- Include actual numbers and dates from the data.
- Provide brief, actionable insights when appropriate.
- Do not invent statistics not present in the data.

Answer in the same language as the user's question.

Formatting rules (STRICT — always follow):
- When listing 2+ items, ALWAYS use markdown list syntax (- or 1.). NEVER write multiple items as plain paragraphs with just bold text.
  WRONG: "**Item:** description.\\n**Item2:** description."
  RIGHT: "- **Item:** description.\\n- **Item2:** description."
- Separate sections with blank lines.
- Use **bold** for key terms at the start of list items.
- Use headings (##, ###) to organize longer answers.
- Keep paragraphs short (2-4 sentences max).`;

const LENGTH_DIRECTIVES: Record<ChatResponseLength, string> = {
	short: "Keep responses brief — 2-4 sentences, bullet points preferred.",
	medium: "",
	detailed:
		"Provide thorough, detailed explanations with examples when helpful.",
};

const CONTEXT_TOKEN_BUDGET = 4000;

export interface ChatTurn {
	role: "user" | "assistant";
	content: string;
	sources?: SearchResult[];
	timestamp: number;
}

export type ContextResolver = (items: ContextItem[]) => Promise<string>;

export class RagQueryService {
	private lastSearchResults: SearchResult[] = [];

	constructor(
		private search: RagSearchService,
		private settings: () => TrueRecallSettings,
		private frontmatterIndex?: FrontmatterIndexService,
		private studyGatherer?: StudyDataGatherer,
		private contextResolver?: ContextResolver,
	) {}

	async *queryStream(
		question: string,
		history: ChatTurn[],
		attachedItems?: ContextItem[],
	): AsyncGenerator<string> {
		const intent = this.studyGatherer ? classifyIntent(question) : "knowledge";

		let attachedContext = "";
		if (attachedItems?.length && this.contextResolver) {
			attachedContext = await this.contextResolver(attachedItems);
		}

		let ragContext = "";
		let studyContext: string | null = null;

		if (intent !== "stats") {
			const searchResults = await this.search.search(question);
			const packed = this.packContext(searchResults.results);
			ragContext = packed.context;
			this.lastSearchResults = packed.sourceMap;
		} else {
			this.lastSearchResults = [];
		}

		if (intent !== "knowledge" && this.studyGatherer) {
			studyContext = this.studyGatherer.gather(question);
		}

		const messages = this.buildMessages(
			question,
			history,
			ragContext,
			studyContext,
			attachedContext,
		);
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
			{
				label: string;
				chunks: SearchResult[];
				totalTokens: number;
				modifiedAt?: number;
			}
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
				if (r.modifiedAt) {
					existing.modifiedAt = Math.max(
						existing.modifiedAt ?? 0,
						r.modifiedAt,
					);
				}
			} else {
				groups.set(key, {
					label,
					chunks: [r],
					totalTokens: r.tokenCount,
					modifiedAt: r.modifiedAt,
				});
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

			const dateSuffix = group.modifiedAt
				? ` (modified: ${new Date(group.modifiedAt).toISOString().slice(0, 10)})`
				: "";
			parts.push(`[${idx}] ${group.label}${dateSuffix}\n${chunkTexts}`);
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
		ragContext: string,
		studyContext: string | null,
		attachedContext?: string,
	): ChatMessage[] {
		const basePrompt = studyContext ? STUDY_PROMPT : KNOWLEDGE_PROMPT;
		const chatConfig = this.settings().ragChatConfig;

		const promptParts = [basePrompt];
		if (chatConfig?.customInstruction) {
			promptParts.push(
				`\nAdditional instructions:\n${chatConfig.customInstruction}`,
			);
		}
		const lengthDirective =
			LENGTH_DIRECTIVES[chatConfig?.responseLength ?? "medium"];
		if (lengthDirective) {
			promptParts.push(`\n${lengthDirective}`);
		}

		const systemPrompt = promptParts.join("\n");
		const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

		for (const turn of history.slice(-6)) {
			messages.push({ role: turn.role, content: turn.content });
		}

		const parts: string[] = [];
		if (attachedContext) {
			parts.push(`Currently viewing:\n\n${attachedContext}`);
		}
		if (ragContext) {
			parts.push(`Context from my notes and flashcards:\n\n${ragContext}`);
		}
		if (studyContext) {
			parts.push(studyContext);
		}

		const userMessage =
			parts.length > 0
				? `${parts.join("\n\n---\n\n")}\n\n---\n\nQuestion: ${question}`
				: question;

		messages.push({ role: "user", content: userMessage });
		return messages;
	}
}
