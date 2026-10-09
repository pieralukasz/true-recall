import {
	type ChatTransport,
	convertToModelMessages,
	hasToolCall,
	isStepCount,
	ToolLoopAgent,
	toUIMessageStream,
	type UIMessage,
	type UIMessageChunk,
	validateUIMessages,
} from "ai";

import { formatLocalDate } from "@true-recall/core/utils";

import type TrueRecallPlugin from "../../../main";
import { isDesktop } from "../../../utils/platform";
import type { ChatContext } from "./chat-context";
import { createChatFetch } from "./chat-fetch";
import {
	CHAT_PROVIDER_NAME,
	createChatModel,
	supportsWebSearch,
} from "./chat-model";
import { buildChatInstructions } from "./chat-prompt";
import {
	type CardSnapshots,
	createChatTools,
	readCardSnapshot,
	readNoteText,
} from "./chat-tools";
import { describeDecisions, type ProposalDecisions } from "./proposals";

const NOTE_EXCERPT_CHARS = 6_000;
const MAX_STEPS = 12;
const MAX_OUTPUT_TOKENS = 4_096;
const FACT_CHECK_MIN_SOURCES = 5;

/** What the transport reads on every send: the chat's live state. */
export interface ChatSessionState {
	context: ChatContext;
	decisions: ProposalDecisions;
	/** Force web search for this chat (fact checks). */
	factCheck?: boolean;
}

/**
 * What the first answer of a review run must do: a Card Polish preset must
 * propose (an edit, or new cards for Split/Reverse-style presets), a fact
 * check must report a verdict. Later turns and plain chats are free.
 */
export function firstTurnTools(
	session: ChatSessionState,
	messages: readonly UIMessage[],
): ("propose_card_edit" | "propose_cards" | "report_fact_check")[] | null {
	if (!session.context.card) return null;
	if (messages.filter((m) => m.role === "user").length !== 1) return null;
	if (session.factCheck) return ["report_fact_check"];
	if (session.context.preset) return ["propose_card_edit", "propose_cards"];
	return null;
}

/** What this chat is for, sent to the Pro proxy as `metadata.chat_task`. */
export function chatTask(
	session: Pick<ChatSessionState, "context" | "factCheck">,
): "card-polish" | "fact-check" | "chat" {
	if (session.context.card && session.factCheck) return "fact-check";
	if (session.context.card && session.context.preset) return "card-polish";
	return "chat";
}

/** Turns a provider error into one sentence the user can act on. */
export function describeChatError(error: unknown): string {
	const text = error instanceof Error ? error.message : String(error);
	if (/401|unauthori[sz]ed|invalid api key|no auth/i.test(text))
		return "The AI provider rejected the key. Check it in Settings → AI.";
	if (/402|insufficient|credits|budget/i.test(text))
		return "The AI budget or credits ran out. Check your plan or provider balance.";
	if (/429|rate limit/i.test(text))
		return "Too many requests right now. Wait a moment and try again.";
	if (/not configured/i.test(text))
		return "AI is not set up yet. Add a provider in Settings → AI.";
	if (/failed to fetch|network|ECONN|ENOTFOUND|timed? ?out/i.test(text))
		return "Could not reach the AI provider. Check your connection and try again.";
	return text.length > 240 ? `${text.slice(0, 237)}…` : text;
}

async function buildInstructions(
	plugin: TrueRecallPlugin,
	session: ChatSessionState,
	webSearch: boolean,
	snapshots: CardSnapshots,
): Promise<string> {
	const { context } = session;
	const card = context.card
		? readCardSnapshot(plugin, context.card.id, snapshots)
		: null;
	const noteExcerpt = context.note
		? ((await readNoteText(plugin, context.note.path, NOTE_EXCERPT_CHARS)) ??
			undefined)
		: undefined;
	return buildChatInstructions({
		context,
		noteExcerpt,
		card:
			card && context.card
				? { id: context.card.id, noteType: card.noteType, fields: card.fields }
				: undefined,
		noteTypes: (plugin.cardStore?.noteTypes.getAll() ?? []).map((nt) => ({
			id: nt.id,
			name: nt.name,
			fields: [...nt.fields],
		})),
		webSearch,
		userInstructions: plugin.settings.assistantInstructions ?? "",
		decisions: describeDecisions(session.decisions),
		today: formatLocalDate(new Date()),
	});
}

/**
 * Runs the agent in-process (no server): the same job as the SDK's
 * DirectChatTransport, plus a fresh model, prompt and context on every send,
 * so settings changes and the chat's context apply without a reload.
 */
export class TrueRecallChatTransport implements ChatTransport<UIMessage> {
	constructor(
		private plugin: TrueRecallPlugin,
		private getSession: () => ChatSessionState,
	) {}

	async sendMessages(
		options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0],
	): Promise<ReadableStream<UIMessageChunk>> {
		try {
			return await this.run(options);
		} catch (error) {
			if (options.abortSignal?.aborted) throw error;
			throw new Error(describeChatError(error));
		}
	}

	private async run({
		messages,
		abortSignal,
	}: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<
		ReadableStream<UIMessageChunk>
	> {
		const plugin = this.plugin;
		const session = this.getSession();
		const snapshots: CardSnapshots = new Map();
		const tools = createChatTools(plugin, snapshots, () => session.context);
		const { model, config } = createChatModel(
			plugin.settings,
			createChatFetch({ streaming: isDesktop() }),
		);
		const webSearch =
			supportsWebSearch(config.providerType) &&
			(session.factCheck || plugin.settings.assistantWebSearch);
		if (session.factCheck && !webSearch) {
			throw new Error(
				"Fact checking needs web search. Choose OpenRouter or Pro in Settings → AI.",
			);
		}
		const maxSources = session.factCheck
			? Math.max(
					plugin.settings.assistantMaxSources ?? 5,
					FACT_CHECK_MIN_SOURCES,
				)
			: (plugin.settings.assistantMaxSources ?? 5);

		const firstTools = firstTurnTools(session, messages);
		const agent = new ToolLoopAgent({
			model,
			tools,
			// Card Polish and fact checks from review start with their tool, so
			// the result is a proposal or a verdict, not advice in prose.
			prepareStep: ({ stepNumber }) =>
				firstTools && stepNumber === 0
					? { toolChoice: "required", activeTools: firstTools }
					: undefined,
			instructions: await buildInstructions(
				plugin,
				session,
				webSearch,
				snapshots,
			),
			temperature: config.temperature,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			// A proposal ends the turn: the user decides before the model goes on.
			stopWhen: [
				isStepCount(MAX_STEPS),
				hasToolCall("propose_cards"),
				hasToolCall("generate_cards"),
				hasToolCall("propose_card_edit"),
			],
			providerOptions: {
				[CHAT_PROVIDER_NAME]: {
					// Lets the Pro proxy pick a model per task (Card Polish runs on a
					// cheaper model than open chat). Only Pro: OpenAI-style APIs may
					// reject an unknown metadata field.
					...(config.providerType === "pro"
						? { metadata: { chat_task: chatTask(session) } }
						: {}),
					...(webSearch && maxSources > 0
						? { plugins: [{ id: "web", max_results: maxSources }] }
						: {}),
				},
			},
		});

		const validated = await validateUIMessages({ messages, tools });
		const result = await agent.stream({
			prompt: await convertToModelMessages(validated, {
				tools,
				ignoreIncompleteToolCalls: true,
			}),
			abortSignal,
		});
		return toUIMessageStream({
			stream: result.stream,
			tools,
			originalMessages: validated,
			onError: describeChatError,
		});
	}

	reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
		return Promise.resolve(null);
	}
}
