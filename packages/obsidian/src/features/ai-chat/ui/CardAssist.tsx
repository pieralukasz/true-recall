/** @jsxImportSource react */
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { createRoot } from "react-dom/client";

import type TrueRecallPlugin from "../../../main";
import type { AiChatController, ChatSession } from "../chat-controller";
import {
	ControllerContext,
	Icon,
	ObsidianMarkdown,
	PluginContext,
	SessionContext,
	useController,
} from "./obsidian";
import {
	FactCheckUI,
	ProposeCardEditUI,
	ProposeCardsUI,
	type ToolPartProps,
} from "./proposals";

interface ToolPart {
	type: string;
	toolCallId: string;
	state: string;
	input?: unknown;
	output?: unknown;
}

function toolProps<A, R>(part: ToolPart): ToolPartProps<A, R> {
	return {
		toolCallId: part.toolCallId,
		args: (part.input ?? {}) as A,
		result: part.state === "output-available" ? (part.output as R) : undefined,
		status: {
			type: part.state === "output-available" ? "complete" : "running",
		},
	};
}

/** The latest answer, reduced to what belongs under a card. */
function LastAnswer({ messages }: { messages: UIMessage[] }) {
	const last = [...messages].reverse().find((m) => m.role === "assistant");
	if (!last) return null;
	return (
		<>
			{last.parts.map((part, i) => {
				const key = `${last.id}-${i}`;
				if (part.type === "text") {
					return part.text.trim() ? (
						<ObsidianMarkdown key={key} markdown={part.text} />
					) : null;
				}
				if (part.type === "tool-propose_card_edit") {
					return (
						<ProposeCardEditUI
							key={key}
							compact
							{...toolProps(part as unknown as ToolPart)}
						/>
					);
				}
				if (part.type === "tool-propose_cards") {
					return (
						<ProposeCardsUI
							key={key}
							{...toolProps(part as unknown as ToolPart)}
						/>
					);
				}
				if (part.type === "tool-report_fact_check") {
					return (
						<FactCheckUI
							key={key}
							{...toolProps(part as unknown as ToolPart)}
						/>
					);
				}
				return null;
			})}
		</>
	);
}

function RunPanel({
	session,
	cardId,
}: {
	session: ChatSession;
	cardId: string;
}) {
	const controller = useController();
	const chat = useChat({ chat: session.chat, throttle: 80 });
	const busy = chat.status === "submitted" || chat.status === "streaming";
	const request = session.title || "AI";
	return (
		<SessionContext.Provider value={session}>
			<div className="tr-ai-chat tr-card-assist" aria-live="polite">
				<div className="tr-card-assist__head">
					<Icon name="sparkles" />
					<span className="tr-card-assist__title">{request}</span>
					{busy ? (
						<button
							type="button"
							className="clickable-icon tr-ai-chat__icon-btn"
							aria-label="Stop"
							onClick={() => void chat.stop()}
						>
							<Icon name="square" />
						</button>
					) : null}
					<button
						type="button"
						className="clickable-icon tr-ai-chat__icon-btn"
						aria-label="Close"
						onClick={() => controller.dismissCardRun(cardId)}
					>
						<Icon name="x" />
					</button>
				</div>
				<div className="tr-card-assist__body">
					<LastAnswer messages={chat.messages} />
					{busy ? (
						<div
							className="tr-ai-chat__thinking"
							role="status"
							aria-label="Working"
						>
							<span />
							<span />
							<span />
						</div>
					) : null}
					{chat.error ? (
						<div className="tr-ai-chat__error" role="alert">
							<Icon name="alert-triangle" />
							<span className="tr-ai-chat__error-text">
								{chat.error.message}
							</span>
							<button
								type="button"
								onClick={() => {
									chat.clearError();
									void chat.regenerate();
								}}
							>
								Try again
							</button>
						</div>
					) : null}
				</div>
				{!busy ? (
					<div className="tr-card-assist__foot">
						<button
							type="button"
							className="tr-ai-chat__link-btn"
							onClick={() => void controller.continueInChat(session.id)}
						>
							<Icon name="message-square" />
							Continue in chat
						</button>
					</div>
				) : null}
			</div>
		</SessionContext.Provider>
	);
}

/** Renders the card's current AI run, if any. Nothing otherwise. */
function CardAssist({ cardId }: { cardId: string }) {
	const controller = useController();
	const session = controller.sessionForCard(cardId);
	if (!session) return null;
	return <RunPanel key={session.id} session={session} cardId={cardId} />;
}

/**
 * Mounts the under-card panel (Card Polish, fact check, a question about the
 * card) into the review view. The review is Preact; this stays React.
 */
export function mountCardAssist(
	el: HTMLElement,
	plugin: TrueRecallPlugin,
	controller: AiChatController,
	cardId: string,
): () => void {
	const root = createRoot(el);
	root.render(
		<PluginContext.Provider value={plugin}>
			<ControllerContext.Provider value={controller}>
				<CardAssist cardId={cardId} />
			</ControllerContext.Provider>
		</PluginContext.Provider>,
	);
	return () => root.unmount();
}
