import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatMessage,
	ToolCall,
} from "../clients/openrouter-client";
import { getTextContent } from "../clients/openrouter-client";
import type {
	AssistantContext,
	AssistantManifest,
	AssistantProgressEvent,
	AssistantProposal,
	Citation,
	FactCheckEvidence,
	TokenUsage,
} from "./assistant.types";
import { buildAssistantSystemPrompt } from "./assistant-prompts";
import { ASSISTANT_TOOLS, type AssistantToolHost } from "./assistant-tools";
import {
	allowsCorrection,
	buildFactCheckTools,
	FACT_CHECK_CORRECTION_GATE_MESSAGE,
	parseFactCheckReport,
} from "./fact-check-tools";
import {
	readNumber,
	readProposalTarget,
	readString,
	readStringRecord,
	readStringRecordArray,
} from "./tool-args";

/** Default agent loop cap when the caller does not supply one. */
const DEFAULT_MAX_ITERATIONS = 5;
/**
 * Hard cap on the model's output per turn. Tool-call JSON for a batch of cards
 * plus a diagram fits comfortably under this; it only stops runaway prose.
 */
const MAX_OUTPUT_TOKENS = 4096;
/** How many image candidates to fetch when the model does not ask for a count. */
const DEFAULT_IMAGE_CANDIDATES = 6;
/** A fact check with fewer than three sources is a coin toss; the mode raises the floor. */
const FACT_CHECK_MIN_SOURCES = 3;
/**
 * Returned to the model rather than recording a proposal that points nowhere,
 * so it can retry with a target the tool schema actually describes.
 */
const MISSING_TARGET_MESSAGE =
	'Missing or malformed "target". Supply {"kind":"note","path":"..."} or {"kind":"card-field","cardId":"...","noteId":"...","field":"..."}.';

export interface AssistantChatClient {
	chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}

export interface AssistantAgentOptions {
	maxIterations?: number;
	maxSources?: number;
	webSearch?: boolean;
	/**
	 * Fact-check mode: web search forced on, reduced tool list with
	 * report_fact_check, card edits gated behind a negative verdict.
	 */
	factCheck?: boolean;
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
	if (context.selectedText)
		parts.push(`SELECTED TEXT:\n${context.selectedText}`);
	if (context.card) {
		parts.push(
			`CURRENT CARD (cardId: ${context.card.cardId}):\nQ: ${context.card.question}\nA: ${context.card.answer || "(empty)"}`,
		);
	}
	if (context.draftCard) {
		parts.push(
			`CURRENT DRAFT (sessionId: ${context.draftCard.sessionId}, note type: ${context.draftCard.noteType.name}):\n${Object.entries(
				context.draftCard.fields,
			)
				.map(([name, value]) => `${name}: ${value || "(empty)"}`)
				.join("\n")}`,
		);
	}
	if (context.activeNotePath)
		parts.push(`ACTIVE NOTE: ${context.activeNotePath}`);
	if (context.conversation?.length) {
		parts.push(
			`RECENT CONVERSATION:\n${context.conversation
				.map(
					(turn) =>
						`${turn.role === "user" ? "USER" : "ASSISTANT"}: ${turn.content}`,
				)
				.join("\n")}`,
		);
	}
	if (context.draftWorkspace) {
		const drafts = context.draftWorkspace.manifest.proposals
			.filter((proposal) => proposal.status === "proposed")
			.map((proposal, index) => {
				if (
					proposal.type === "create_card" ||
					proposal.type === "update_card" ||
					proposal.type === "update_draft"
				) {
					return `Draft ${index + 1}, id ${proposal.id} (${proposal.type}): ${JSON.stringify(proposal.fields)}`;
				}
				return `Draft ${index + 1}, id ${proposal.id} (${proposal.type})`;
			})
			.join("\n");
		parts.push(
			`CURRENT DRAFT WORKSPACE (revision ${context.draftWorkspace.revision}):\n${drafts || "(no pending drafts)"}`,
		);
	}
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
		const manifest: AssistantManifest = context.draftWorkspace
			? structuredClone(context.draftWorkspace.manifest)
			: { proposals: [], citations: [] };
		const maxIterations = this.options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
		const usage: TokenUsage = {
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
		};
		let sawUsage = false;
		const factCheck = this.options.factCheck === true;
		const requestedSources = Math.max(
			0,
			Math.floor(this.options.maxSources ?? 5),
		);
		const maxSources = factCheck
			? Math.max(requestedSources, FACT_CHECK_MIN_SOURCES)
			: requestedSources;
		const webSearchEnabled =
			factCheck || (this.options.webSearch === true && maxSources > 0);
		const tools = factCheck ? buildFactCheckTools() : ASSISTANT_TOOLS;

		const messages: ChatMessage[] = [
			{
				role: "system",
				content: buildAssistantSystemPrompt({
					userInstructions: this.options.userInstructions ?? "",
					noteTypes: host.listNoteTypes(),
					webSearchEnabled,
					factCheck,
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
				max_tokens: MAX_OUTPUT_TOKENS,
				cache_control: { type: "ephemeral" },
				tools,
				tool_choice: "auto",
				...(webSearchEnabled
					? { plugins: [{ id: "web", max_results: maxSources }] }
					: {}),
			});

			if (response.usage) {
				sawUsage = true;
				usage.promptTokens += response.usage.prompt_tokens ?? 0;
				usage.completionTokens += response.usage.completion_tokens ?? 0;
				usage.totalTokens += response.usage.total_tokens ?? 0;
				this.options.onProgress?.({ kind: "usage", usage: { ...usage } });
			}

			const message = response.choices[0]?.message;
			if (!message) break;
			this.collectCitations(message, manifest, maxSources);

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
				const result = await this.executeTool(
					call,
					context,
					host,
					manifest,
					maxSources,
				);
				messages.push({ role: "tool", content: result, tool_call_id: call.id });
			}
		}

		if (factCheck && !manifest.factCheck) {
			manifest.factCheck = {
				verdict: "unverifiable",
				confidence: "low",
				summary: manifest.finalText ?? "Model returned no verdict",
				evidence: [],
			};
		}

		if (sawUsage) manifest.usage = usage;
		this.options.onProgress?.({ kind: "done" });
		return manifest;
	}

	private collectCitations(
		message: ChatMessage,
		manifest: AssistantManifest,
		maxSources: number,
	): void {
		if (maxSources <= 0) return;
		for (const annotation of message.annotations ?? []) {
			if (manifest.citations.length >= maxSources) return;
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

	private addEvidenceCitations(
		evidence: FactCheckEvidence[],
		manifest: AssistantManifest,
		maxSources: number,
	): void {
		for (const item of evidence) {
			if (manifest.citations.length >= maxSources) return;
			if (manifest.citations.some((c) => c.url === item.url)) continue;
			const citation: Citation = { url: item.url };
			if (item.title) citation.title = item.title;
			manifest.citations.push(citation);
		}
	}

	private async executeTool(
		call: ToolCall,
		context: AssistantContext,
		host: AssistantToolHost,
		manifest: AssistantManifest,
		maxSources: number,
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
				const noteTypeId = readString(args, "noteTypeId");
				const noteType = host
					.listNoteTypes()
					.find((candidate) => candidate.id === noteTypeId);
				if (!noteType) {
					return `Note type "${noteTypeId}" not found. Use one of the listed note type ids.`;
				}
				const cards = readStringRecordArray(args.cards);
				if (cards.length === 0) return "No cards given.";
				for (const rawFields of cards) {
					const fields = Object.fromEntries(
						noteType.fields.map((name) => [name, rawFields[name] ?? ""]),
					);
					manifest.proposals.push({
						id: nextProposalId(),
						status: "proposed",
						type: "create_card",
						noteTypeId,
						fields,
						sourceUid: context.source?.uid ?? context.card?.sourceUid,
						sourcePath:
							context.source?.path ??
							context.card?.sourceNotePath ??
							context.activeNotePath,
						sourceText: context.source?.text ?? context.selectedText,
					});
				}
				return `Recorded ${cards.length} card proposal(s).`;
			}
			case "report_fact_check": {
				if (!this.options.factCheck) {
					return `Unknown tool: ${call.function.name}`;
				}
				const parsed = parseFactCheckReport(args);
				if (!parsed.ok) return parsed.error;
				manifest.factCheck = parsed.result;
				this.addEvidenceCitations(parsed.result.evidence, manifest, maxSources);
				return `Recorded verdict ${parsed.result.verdict} (${parsed.result.confidence}).`;
			}
			case "update_card": {
				if (
					this.options.factCheck &&
					!allowsCorrection(manifest.factCheck?.verdict)
				) {
					return FACT_CHECK_CORRECTION_GATE_MESSAGE;
				}
				const cardId = readString(args, "cardId");
				const current = host.getCardFields(cardId);
				if (!current) return `Card "${cardId}" not found.`;
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "update_card",
					cardId,
					noteId: current.noteId,
					fields: readStringRecord(args.fields),
					previousFields: current.fields,
				});
			}
			case "update_draft": {
				const draft = context.draftCard;
				if (!draft) return "No draft card is active in this task.";
				const requested = readStringRecord(args.fields);
				const fields = Object.fromEntries(
					Object.entries(requested).filter(([name]) =>
						draft.noteType.fields.includes(name),
					),
				);
				if (Object.keys(fields).length === 0) {
					return "No valid draft fields were provided.";
				}
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "update_draft",
					sessionId: draft.sessionId,
					fields,
					previousFields: draft.fields,
				});
			}
			case "update_proposal": {
				const proposalId = readString(args, "proposalId");
				const proposal = manifest.proposals.find(
					(candidate) => candidate.id === proposalId,
				);
				if (!proposal || proposal.status !== "proposed") {
					return `Draft proposal "${proposalId}" not found.`;
				}
				if (
					proposal.type !== "create_card" &&
					proposal.type !== "update_card" &&
					proposal.type !== "update_draft"
				) {
					return `Proposal "${proposalId}" is not an editable card draft.`;
				}
				const requested = readStringRecord(args.fields);
				const fields = Object.fromEntries(
					Object.entries(requested).filter(([name]) => name in proposal.fields),
				);
				if (Object.keys(fields).length === 0) {
					return `No valid fields supplied for proposal "${proposalId}".`;
				}
				proposal.fields = { ...proposal.fields, ...fields };
				return `Updated draft proposal ${proposalId}.`;
			}
			case "remove_proposal": {
				const proposalId = readString(args, "proposalId");
				const index = manifest.proposals.findIndex(
					(candidate) =>
						candidate.id === proposalId && candidate.status === "proposed",
				);
				if (index < 0) return `Draft proposal "${proposalId}" not found.`;
				manifest.proposals.splice(index, 1);
				return `Removed draft proposal ${proposalId}.`;
			}
			case "append_to_note":
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "append_to_note",
					path: readString(args, "path"),
					markdown: readString(args, "markdown"),
				});
			case "create_note":
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "create_note",
					title: readString(args, "title", "Untitled"),
					markdown: readString(args, "markdown"),
				});
			case "insert_diagram": {
				const target = readProposalTarget(args.target);
				if (!target) return MISSING_TARGET_MESSAGE;
				const format = args.format === "svg" ? "svg" : "mermaid";
				return record({
					id: nextProposalId(),
					status: "proposed",
					type: "insert_diagram",
					target,
					format,
					code: readString(args, "code"),
				});
			}
			case "search_images": {
				const target = readProposalTarget(args.target);
				if (!target) return MISSING_TARGET_MESSAGE;
				const query = readString(args, "query");
				const count = readNumber(args, "count", DEFAULT_IMAGE_CANDIDATES);
				const candidates = await host.searchImages(query, count);
				if (candidates.length === 0) return `No images found for "${query}".`;
				record({
					id: nextProposalId(),
					status: "proposed",
					type: "attach_images",
					target,
					candidates,
				});
				return `Found ${candidates.length} candidates: ${candidates
					.map((c) => c.title ?? c.url)
					.join("; ")}. The user will pick which to attach.`;
			}
			case "read_note": {
				const content = await host.readNote(readString(args, "path"));
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
