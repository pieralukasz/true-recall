import {
	type ChatMessage,
	OpenRouterClient,
} from "@true-recall/core/ai/clients/openrouter-client";
import { StreamingOpenRouterClient } from "@true-recall/core/ai/clients/streaming-openrouter-client";
import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";
import { LITELLM_URL } from "@true-recall/core/constants";
import type {
	ChatResponseLength,
	TrueRecallSettings,
} from "@true-recall/core/types/settings.types";
import { fileBasename, formatLocalDate } from "@true-recall/core/utils";
import type { IHttpClient } from "@true-recall/core/interfaces/http-client";
import type { ContextItem } from "../context/context.types";
import { RAG_CHAT_TOOLS, type RagToolExecutor } from "@true-recall/core/rag/chat/rag-chat-tools";
import type { RagSearchService, SearchResult } from "@true-recall/core/rag/retrieval/rag-search.service";

function agenticPrompt(): string {
	const today = formatLocalDate(new Date());
	return `You are a friendly, knowledgeable study assistant with access to the user's notes, flashcards, and study data.
Today's date is ${today}.

Behavior:
- Be conversational and engaging — not a data terminal. Add brief insights, encouragement, or suggestions when relevant.
- Always call at least one tool for each new user question. Only skip tools for simple follow-up clarifications about data already visible in the conversation.
- You may call multiple tools if needed.
- Cite sources from search results using numbered references [1], [2] matching the result index numbers.
- When referencing a note by name, use Obsidian wiki-link syntax: [[Note Name]].
- If tools don't return enough info, say so clearly — do not make things up.
- Answer in the same language as the user's question.

Formatting rules (STRICT):
- When listing 2+ items, ALWAYS use markdown list syntax (- or 1.).
- Separate sections with blank lines.
- Use **bold** for key terms at the start of list items.
- Use headings (##, ###) to organize longer answers.
- Keep paragraphs short (2-4 sentences max).`;
}

const FALLBACK_PROMPT = `You are a knowledgeable assistant that answers based on the user's notes and flashcards.
Cite sources inline using numbered references like [1], [2] etc. matching the source numbers in the provided context.
When referencing a specific note by name, use Obsidian wiki-link syntax: [[Note Name]]. This creates a clickable backlink.
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

const LENGTH_DIRECTIVES: Record<ChatResponseLength, string> = {
	short: "Keep responses brief — 2-4 sentences, bullet points preferred.",
	medium: "",
	detailed:
		"Provide thorough, detailed explanations with examples when helpful.",
};

const CONTEXT_TOKEN_BUDGET = 4000;

export interface ToolCallRecord {
	id: string;
	name: string;
	arguments: string;
	result: string;
}

export interface ChatTurn {
	role: "user" | "assistant";
	content: string;
	sources?: SearchResult[];
	toolCalls?: ToolCallRecord[];
	timestamp: number;
}

export type ContextResolver = (items: ContextItem[]) => Promise<string>;

export class RagQueryService {
	private lastSearchResults: SearchResult[] = [];
	private lastToolCalls: ToolCallRecord[] = [];

	constructor(
		private search: RagSearchService,
		private settings: () => TrueRecallSettings,
		private httpClient: IHttpClient,
		private frontmatterIndex?: FrontmatterIndexService,
		private toolExecutor?: RagToolExecutor,
		private contextResolver?: ContextResolver,
	) {}

	async *queryStream(
		question: string,
		history: ChatTurn[],
		attachedItems?: ContextItem[],
	): AsyncGenerator<string> {
		let attachedContext = "";
		if (attachedItems?.length && this.contextResolver) {
			attachedContext = await this.contextResolver(attachedItems);
		}

		const s = this.settings();
		const baseUrl = LITELLM_URL.replace("/chat/completions", "");
		const streamUrl = `${baseUrl}/chat/completions`;
		const apiKey = s.proKey ?? "";

		if (this.toolExecutor) {
			yield* this.agenticFlow(
				question,
				history,
				attachedContext,
				apiKey,
				streamUrl,
			);
		} else {
			yield* this.fallbackFlow(
				question,
				history,
				attachedContext,
				apiKey,
				streamUrl,
			);
		}
	}

	getLastSearchResults(): SearchResult[] {
		return this.lastSearchResults;
	}

	getLastToolCalls(): ToolCallRecord[] {
		return this.lastToolCalls;
	}

	private async *agenticFlow(
		question: string,
		history: ChatTurn[],
		attachedContext: string,
		apiKey: string,
		streamUrl: string,
	): AsyncGenerator<string> {
		const messages = this.buildMessages(
			agenticPrompt(),
			question,
			history,
			attachedContext,
		);

		this.lastSearchResults = [];
		this.lastToolCalls = [];

		try {
			const client = new OpenRouterClient(apiKey, "auto", this.httpClient, streamUrl);
			const response = await client.chat({
				messages,
				tools: RAG_CHAT_TOOLS,
				tool_choice: "auto",
			});

			const assistantMsg = response.choices[0]?.message;
			const toolCalls = assistantMsg?.tool_calls;

			if (toolCalls?.length && assistantMsg) {
				messages.push({
					role: "assistant",
					content: assistantMsg.content,
					tool_calls: toolCalls,
				});

				const records: ToolCallRecord[] = [];
				for (const call of toolCalls) {
					const result = await this.toolExecutor?.execute(call);
					if (!result) continue;
					if (result.searchResults) {
						this.lastSearchResults = result.searchResults;
					}
					records.push({
						id: call.id,
						name: call.function.name,
						arguments: call.function.arguments,
						result: result.content,
					});
					messages.push({
						role: "tool",
						content: result.content,
						tool_call_id: call.id,
					});
				}
				this.lastToolCalls = records;
			}
		} catch {
			// Tool calling failed — fall through to stream without tool results.
		}

		const streamClient = new StreamingOpenRouterClient(
			apiKey,
			"auto",
			this.httpClient,
			streamUrl,
		);
		for await (const chunk of streamClient.chatStream({ messages })) {
			yield chunk.content;
		}
	}

	private async *fallbackFlow(
		question: string,
		history: ChatTurn[],
		attachedContext: string,
		apiKey: string,
		streamUrl: string,
	): AsyncGenerator<string> {
		const searchResults = await this.search.search(question);
		const packed = this.packContext(searchResults.results);
		this.lastSearchResults = packed.sourceMap;

		const ragContext = packed.context
			? `Context from my notes and flashcards:\n\n${packed.context}`
			: "";

		const messages = this.buildMessages(
			FALLBACK_PROMPT,
			question,
			history,
			attachedContext,
			ragContext,
		);

		const client = new StreamingOpenRouterClient(apiKey, "auto", this.httpClient, streamUrl);
		for await (const chunk of client.chatStream({ messages })) {
			yield chunk.content;
		}
	}

	packContext(results: SearchResult[]): {
		context: string;
		sourceMap: SearchResult[];
	} {
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
			let key: string;
			let label: string;

			if (r.sourceType === "note") {
				key = r.sourceId;
				label = fileBasename(r.sourceId);
			} else if (r.sourceNoteUid && this.frontmatterIndex) {
				const notePath = this.frontmatterIndex.getFileByValue(
					"flashcard_uid",
					r.sourceNoteUid,
				);
				key = notePath ?? `fc:${r.sourceId}`;
				label = notePath ? fileBasename(notePath) : "Flashcards";
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
			const representative = group.chunks[0];
			if (representative) sourceMap.push(representative);
			idx++;
		}

		return { context: parts.join("\n\n---\n\n"), sourceMap };
	}

	private buildMessages(
		systemPrompt: string,
		question: string,
		history: ChatTurn[],
		attachedContext?: string,
		ragContext?: string,
	): ChatMessage[] {
		const chatConfig = this.settings().ragChatConfig;

		const promptParts = [systemPrompt];
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

		const messages: ChatMessage[] = [
			{ role: "system", content: promptParts.join("\n") },
		];

		for (const turn of history.slice(-6)) {
			if (turn.role === "assistant" && turn.toolCalls?.length) {
				messages.push({
					role: "assistant",
					content: null,
					tool_calls: turn.toolCalls.map((tc) => ({
						id: tc.id,
						type: "function" as const,
						function: { name: tc.name, arguments: tc.arguments },
					})),
				});
				for (const tc of turn.toolCalls) {
					messages.push({
						role: "tool",
						content: tc.result,
						tool_call_id: tc.id,
					});
				}
				messages.push({ role: "assistant", content: turn.content });
			} else {
				messages.push({ role: turn.role, content: turn.content });
			}
		}

		const parts: string[] = [];
		if (attachedContext) {
			parts.push(`Currently viewing:\n\n${attachedContext}`);
		}
		if (ragContext) {
			parts.push(ragContext);
		}

		const userMessage =
			parts.length > 0
				? `${parts.join("\n\n---\n\n")}\n\n---\n\nQuestion: ${question}`
				: question;

		messages.push({ role: "user", content: userMessage });
		return messages;
	}
}
