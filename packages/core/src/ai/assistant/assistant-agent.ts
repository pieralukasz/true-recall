import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatMessage,
	ToolCall,
} from "../clients/openrouter-client";
import { getTextContent } from "../clients/openrouter-client";
import { buildAssistantSystemPrompt } from "./assistant-prompts";
import { ASSISTANT_TOOLS, type AssistantToolHost } from "./assistant-tools";
import type {
	AssistantContext,
	AssistantManifest,
	AssistantProgressEvent,
	AssistantProposal,
	Citation,
	ProposalTarget,
} from "./assistant.types";

export interface AssistantChatClient {
	chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}

export interface AssistantAgentOptions {
	maxIterations?: number;
	webSearch?: boolean;
	userInstructions?: string;
	onProgress?: (event: AssistantProgressEvent) => void;
}

let proposalCounter = 0;
function nextProposalId(): string {
	proposalCounter += 1;
	return `proposal-${Date.now()}-${proposalCounter}`;
}

function renderContext(context: AssistantContext): string {
	const parts: string[] = [];
	if (context.selectedText) parts.push(`SELECTED TEXT:\n${context.selectedText}`);
	if (context.card) {
		parts.push(
			`CURRENT CARD (cardId: ${context.card.cardId}):\nQ: ${context.card.question}\nA: ${context.card.answer || "(empty)"}`,
		);
	}
	if (context.activeNotePath) parts.push(`ACTIVE NOTE: ${context.activeNotePath}`);
	return parts.join("\n\n");
}

export class AssistantAgent {
	constructor(
		private client: AssistantChatClient,
		private options: AssistantAgentOptions = {},
	) {}

	async run(
		instruction: string,
		context: AssistantContext,
		host: AssistantToolHost,
	): Promise<AssistantManifest> {
		const manifest: AssistantManifest = { proposals: [], citations: [] };
		const maxIterations = this.options.maxIterations ?? 10;

		const messages: ChatMessage[] = [
			{
				role: "system",
				content: buildAssistantSystemPrompt({
					userInstructions: this.options.userInstructions ?? "",
					noteTypes: host.listNoteTypes(),
					webSearchEnabled: this.options.webSearch === true,
				}),
			},
			{
				role: "user",
				content:
					`${renderContext(context)}\n\nINSTRUCTION:\n${instruction}`.trim(),
			},
		];

		for (let iteration = 0; iteration < maxIterations; iteration++) {
			this.options.onProgress?.({ kind: "iteration", index: iteration });

			const response = await this.client.chat({
				messages,
				tools: ASSISTANT_TOOLS,
				tool_choice: "auto",
				...(this.options.webSearch ? { plugins: [{ id: "web" }] } : {}),
			});

			const message = response.choices[0]?.message;
			if (!message) break;
			this.collectCitations(message, manifest);

			const toolCalls = message.tool_calls;
			if (!toolCalls?.length) {
				manifest.finalText = getTextContent(message) || undefined;
				break;
			}

			messages.push({
				role: "assistant",
				content: message.content,
				tool_calls: toolCalls,
			});

			for (const call of toolCalls) {
				this.options.onProgress?.({ kind: "tool", name: call.function.name });
				const result = await this.executeTool(call, context, host, manifest);
				messages.push({ role: "tool", content: result, tool_call_id: call.id });
			}
		}

		this.options.onProgress?.({ kind: "done" });
		return manifest;
	}

	private collectCitations(
		message: ChatMessage,
		manifest: AssistantManifest,
	): void {
		for (const annotation of message.annotations ?? []) {
			const url = annotation.url_citation?.url;
			if (!url) continue;
			if (manifest.citations.some((c) => c.url === url)) continue;
			const citation: Citation = { url };
			if (annotation.url_citation?.title) {
				citation.title = annotation.url_citation.title;
			}
			manifest.citations.push(citation);
		}
	}

	private async executeTool(
		call: ToolCall,
		context: AssistantContext,
		host: AssistantToolHost,
		manifest: AssistantManifest,
	): Promise<string> {
		let args: Record<string, unknown>;
		try {
			args = JSON.parse(call.function.arguments || "{}") as Record<
				string,
				unknown
			>;
		} catch {
			return `Invalid JSON arguments for ${call.function.name}. Fix the arguments and retry.`;
		}

		const record = (proposal: AssistantProposal): string => {
			manifest.proposals.push(proposal);
			return `Recorded proposal ${proposal.id} (${proposal.type}).`;
		};

		switch (call.function.name) {
			case "create_cards": {
				const noteTypeId = String(args.noteTypeId ?? "");
				const known = host
					.listNoteTypes()
					.some((nt) => nt.id === noteTypeId);
				if (!known) {
					return `Note type "${noteTypeId}" not found. Use one of the listed note type ids.`;
				}
				const cards = Array.isArray(args.cards)
					? (args.cards as Record<string, string>[])
					: [];
				if (cards.length === 0) return "No cards given.";
				for (const fields of cards) {
					manifest.proposals.push({
						id: nextProposalId(),
						status: "proposed",
						type: "create_card",
						noteTypeId,
						fields,
					});
				}
				return `Recorded ${cards.length} card proposal(s).`;
			}
			case "update_card": {
				const cardId = String(args.cardId ?? "");
				const current = host.getCardFields(cardId);
				if (!current) return `Card "${cardId}" not found.`;
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "update_card",
					cardId,
					noteId: current.noteId,
					fields: (args.fields ?? {}) as Record<string, string>,
					previousFields: current.fields,
				});
			}
			case "append_to_note":
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "append_to_note",
					path: String(args.path ?? ""),
					markdown: String(args.markdown ?? ""),
				});
			case "create_note":
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "create_note",
					title: String(args.title ?? "Untitled"),
					markdown: String(args.markdown ?? ""),
				});
			case "insert_diagram": {
				const format = args.format === "svg" ? "svg" : "mermaid";
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "insert_diagram",
					target: args.target as ProposalTarget,
					format,
					code: String(args.code ?? ""),
				});
			}
			case "search_images": {
				const query = String(args.query ?? "");
				const count = typeof args.count === "number" ? args.count : 6;
				const candidates = await host.searchImages(query, count);
				if (candidates.length === 0) return `No images found for "${query}".`;
				record({
					id: nextProposalId(),
					status: "proposed",
					type: "attach_images",
					target: args.target as ProposalTarget,
					candidates,
				});
				return `Found ${candidates.length} candidates: ${candidates
					.map((c) => c.title ?? c.url)
					.join("; ")}. The user will pick which to attach.`;
			}
			case "read_note": {
				const content = await host.readNote(String(args.path ?? ""));
				return content ?? "Note not found.";
			}
			case "get_related_cards": {
				const sourceUid = context.card?.sourceUid;
				if (!sourceUid) return "No source note linked to the current card.";
				const related = host.getRelatedCards(sourceUid);
				return related.length === 0
					? "No related cards."
					: JSON.stringify(related);
			}
			default:
				return `Unknown tool: ${call.function.name}`;
		}
	}
}
