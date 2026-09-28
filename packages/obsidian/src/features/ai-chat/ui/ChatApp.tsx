/** @jsxImportSource react */
import { useChat } from "@ai-sdk/react";
import type { EmptyMessagePartComponent } from "@assistant-ui/react";
import {
	ActionBarPrimitive,
	AssistantRuntimeProvider,
	AuiIf,
	ComposerPrimitive,
	MessagePrimitive,
	type ReasoningMessagePartComponent,
	type SourceMessagePartComponent,
	type TextMessagePartComponent,
	ThreadPrimitive,
	type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";

import type TrueRecallPlugin from "../../../main";
import type { AiChatController, ChatSession } from "../chat-controller";
import {
	type ChatContext,
	contextKinds,
	shorten,
	withoutKind,
} from "../engine/chat-context";
import { ChatHistory } from "./ChatHistory";
import {
	ControllerContext,
	Icon,
	ObsidianMarkdown,
	PluginContext,
	SessionContext,
	useController,
	useSession,
} from "./obsidian";
import {
	FactCheckUI,
	ProposeCardEditUI,
	ProposeCardsUI,
	ToolLine,
} from "./proposals";

const Text: TextMessagePartComponent = ({ text }) => (
	<ObsidianMarkdown markdown={text} />
);

const Reasoning: ReasoningMessagePartComponent = ({ text, status }) =>
	text.trim() ? (
		<details className="tr-ai-chat__reasoning">
			<summary>
				{status?.type === "running" ? "Thinking…" : "Thought it through"}
			</summary>
			<div className="tr-ai-chat__reasoning-text">{text}</div>
		</details>
	) : null;

const Source: SourceMessagePartComponent = ({ url, title }) => (
	<a className="tr-ai-chat__source" href={url} target="_blank" rel="noopener">
		<Icon name="globe" />
		{shorten(title || url || "", 40)}
	</a>
);

const Thinking: EmptyMessagePartComponent = ({ status }) =>
	status.type === "running" ? (
		<div className="tr-ai-chat__thinking" aria-live="polite">
			<span />
			<span />
			<span />
		</div>
	) : null;

const ToolFallback: ToolCallMessagePartComponent = ({
	toolName,
	args,
	result,
}) => <ToolLine toolName={toolName} args={args} result={result} />;

const partComponents = {
	Text,
	Reasoning,
	Source,
	Empty: Thinking,
	tools: {
		by_name: {
			propose_cards: ProposeCardsUI as ToolCallMessagePartComponent,
			propose_card_edit: ProposeCardEditUI as ToolCallMessagePartComponent,
			report_fact_check: FactCheckUI as ToolCallMessagePartComponent,
		},
		Fallback: ToolFallback,
	},
};

function UserMessage() {
	return (
		<MessagePrimitive.Root className="tr-ai-chat__msg tr-ai-chat__msg--user">
			<MessagePrimitive.Parts />
		</MessagePrimitive.Root>
	);
}

function AssistantMessage() {
	return (
		<MessagePrimitive.Root className="tr-ai-chat__msg tr-ai-chat__msg--assistant">
			<MessagePrimitive.Parts components={partComponents} />
			<ActionBarPrimitive.Root
				className="tr-ai-chat__actions"
				hideWhenRunning
				autohide="not-last"
			>
				<ActionBarPrimitive.Copy
					className="clickable-icon tr-ai-chat__icon-btn"
					aria-label="Copy"
				>
					<Icon name="copy" />
				</ActionBarPrimitive.Copy>
				<ActionBarPrimitive.Reload
					className="clickable-icon tr-ai-chat__icon-btn"
					aria-label="Answer again"
				>
					<Icon name="refresh-cw" />
				</ActionBarPrimitive.Reload>
			</ActionBarPrimitive.Root>
		</MessagePrimitive.Root>
	);
}

// ─── context and suggestions ───────────────────────────────────────────

const CHIP_ICON = {
	note: "file-text",
	selection: "text-select",
	card: "square-stack",
	preset: "sliders-horizontal",
} as const;

function chipLabel(context: ChatContext, kind: keyof typeof CHIP_ICON): string {
	switch (kind) {
		case "note":
			return context.note?.title ?? "";
		case "selection":
			return `“${shorten(context.selection?.text ?? "", 40)}”`;
		case "card":
			return context.card?.label
				? shorten(context.card.label, 40)
				: "This card";
		case "preset":
			return context.preset?.name ?? "";
	}
}

/** What the chat is about, as chips the user can remove. */
function ContextChips() {
	const controller = useController();
	const session = useSession();
	const kinds = contextKinds(session.context);
	if (kinds.length === 0) return null;
	return (
		<div className="tr-ai-chat__chips">
			{kinds.map((kind) => (
				<span key={kind} className="tr-ai-chat__chip tr-ai-chat__context">
					<Icon name={CHIP_ICON[kind]} />
					<span className="tr-ai-chat__chip-text">
						{chipLabel(session.context, kind)}
					</span>
					<button
						type="button"
						className="tr-ai-chat__chip-x"
						aria-label="Remove from the chat"
						onClick={() =>
							controller.setContext(
								session.id,
								withoutKind(session.context, kind),
							)
						}
					>
						<Icon name="x" />
					</button>
				</span>
			))}
		</div>
	);
}

interface Suggestion {
	icon: string;
	label: string;
	detail: string;
	prompt: string;
}

function suggestionsFor(context: ChatContext): Suggestion[] {
	if (context.card) {
		return [
			{
				icon: "lightbulb",
				label: "Explain this card",
				detail: "In simple words, with an example",
				prompt: "Explain this card to me in simple words.",
			},
			{
				icon: "wand-sparkles",
				label: "Make it clearer",
				detail: "A better version for you to approve",
				prompt: "Improve this card so it is easier to remember.",
			},
			{
				icon: "shield-check",
				label: "Check the facts",
				detail: "Compared with sources on the web",
				prompt: "Check the facts on this card.",
			},
		];
	}
	if (context.selection) {
		return [
			{
				icon: "layers",
				label: "Cards from the selection",
				detail: "You pick which ones to add",
				prompt: "Make flashcards from the selected text.",
			},
			{
				icon: "lightbulb",
				label: "Explain the selection",
				detail: "In simple words, with an example",
				prompt: "Explain the selected text to me.",
			},
		];
	}
	if (context.note) {
		return [
			{
				icon: "layers",
				label: "Cards from this note",
				detail: "You pick which ones to add",
				prompt: "Make flashcards from this note.",
			},
			{
				icon: "search",
				label: "What's missing?",
				detail: "Key ideas in this note with no card yet",
				prompt: "Which important ideas in this note have no card yet?",
			},
			{
				icon: "wand-sparkles",
				label: "Improve my cards",
				detail: "Fixes for the weakest cards from this note",
				prompt:
					"Review the cards from this note and suggest fixes for the weakest ones.",
			},
		];
	}
	return [
		{
			icon: "trending-up",
			label: "How am I doing?",
			detail: "Reviews, retention and what is due",
			prompt: "How is my studying going? Look at my stats.",
		},
		{
			icon: "flame",
			label: "My hardest cards",
			detail: "The ones you forget most, and how to fix them",
			prompt: "Which cards do I forget most, and how could they be better?",
		},
	];
}

function EmptyState() {
	const session = useSession();
	const hasContext = contextKinds(session.context).length > 0;
	return (
		<div className="tr-ai-chat__empty">
			<div className="tr-ai-chat__empty-mark">
				<Icon name="sparkles" />
			</div>
			<div className="tr-ai-chat__empty-title">How can I help?</div>
			<div className="tr-ai-chat__empty-hint">
				Cards, fixes, fact checks and stats. Nothing is saved until you approve
				it.
			</div>
			<div className="tr-ai-chat__suggestions">
				{suggestionsFor(session.context).map((s) => (
					<ThreadPrimitive.Suggestion
						key={s.label}
						prompt={s.prompt}
						send
						asChild
					>
						<button type="button" className="tr-ai-chat__suggestion">
							<span className="tr-ai-chat__suggestion-icon">
								<Icon name={s.icon} />
							</span>
							<span className="tr-ai-chat__suggestion-text">
								<span className="tr-ai-chat__suggestion-label">{s.label}</span>
								<span className="tr-ai-chat__suggestion-detail">
									{s.detail}
								</span>
							</span>
							<Icon
								name="arrow-up-right"
								className="tr-ai-chat__suggestion-go"
							/>
						</button>
					</ThreadPrimitive.Suggestion>
				))}
			</div>
			{hasContext ? null : (
				<div className="tr-ai-chat__empty-tip">
					<Icon name="file-text" />
					Open a note to make cards from it.
				</div>
			)}
		</div>
	);
}

function ErrorBanner({
	error,
	onRetry,
	onDismiss,
}: {
	error: Error;
	onRetry: () => void;
	onDismiss: () => void;
}) {
	return (
		<div className="tr-ai-chat__error" role="alert">
			<Icon name="alert-triangle" />
			<span className="tr-ai-chat__error-text">{error.message}</span>
			<button type="button" onClick={onRetry}>
				Try again
			</button>
			<button
				type="button"
				className="clickable-icon tr-ai-chat__icon-btn"
				aria-label="Dismiss"
				onClick={onDismiss}
			>
				<Icon name="x" />
			</button>
		</div>
	);
}

// ─── thread ────────────────────────────────────────────────────────────

function Thread({
	error,
	onRetry,
	onDismissError,
}: {
	error: Error | undefined;
	onRetry: () => void;
	onDismissError: () => void;
}) {
	return (
		<ThreadPrimitive.Root className="tr-ai-chat__thread">
			<ThreadPrimitive.Viewport className="tr-ai-chat__viewport">
				<AuiIf condition={(s) => s.thread.isEmpty}>
					<EmptyState />
				</AuiIf>
				<ThreadPrimitive.Messages
					components={{ UserMessage, AssistantMessage }}
				/>
				<ThreadPrimitive.ViewportFooter className="tr-ai-chat__viewport-footer">
					<ThreadPrimitive.ScrollToBottom
						className="tr-ai-chat__to-bottom"
						aria-label="Scroll to the latest message"
					>
						<Icon name="arrow-down" />
					</ThreadPrimitive.ScrollToBottom>
				</ThreadPrimitive.ViewportFooter>
			</ThreadPrimitive.Viewport>
			{error ? (
				<ErrorBanner
					error={error}
					onRetry={onRetry}
					onDismiss={onDismissError}
				/>
			) : null}
			<ComposerPrimitive.Root className="tr-ai-chat__composer">
				<ContextChips />
				<div className="tr-ai-chat__input-row">
					<ComposerPrimitive.Input
						className="tr-ai-chat__input"
						placeholder="Ask, or ask for cards…"
						rows={1}
					/>
					<AuiIf condition={(s) => !s.thread.isRunning}>
						<ComposerPrimitive.Send
							className="tr-ai-chat__send mod-cta"
							aria-label="Send"
						>
							<Icon name="arrow-up" />
						</ComposerPrimitive.Send>
					</AuiIf>
					<AuiIf condition={(s) => s.thread.isRunning}>
						<ComposerPrimitive.Cancel
							className="tr-ai-chat__send tr-ai-chat__stop"
							aria-label="Stop"
						>
							<Icon name="square" />
						</ComposerPrimitive.Cancel>
					</AuiIf>
				</div>
			</ComposerPrimitive.Root>
		</ThreadPrimitive.Root>
	);
}

/** Binds one conversation's live `Chat` to assistant-ui. Remounted per chat. */
function SessionRuntime({ session }: { session: ChatSession }) {
	const chat = useChat({ chat: session.chat, throttle: 50 });
	const runtime = useAISDKRuntime(chat);
	return (
		<SessionContext.Provider value={session}>
			<AssistantRuntimeProvider runtime={runtime}>
				<Thread
					error={chat.error}
					onRetry={() => {
						chat.clearError();
						void chat.regenerate();
					}}
					onDismissError={() => chat.clearError()}
				/>
			</AssistantRuntimeProvider>
		</SessionContext.Provider>
	);
}

function Header() {
	const controller = useController();
	const session = controller.current;
	const pending = controller.pendingTotal();
	return (
		<div className="tr-ai-chat__header">
			<span className="tr-ai-chat__title">
				{controller.showHistory ? "Chats" : session.title || "New chat"}
			</span>
			<button
				type="button"
				className={`clickable-icon tr-ai-chat__icon-btn ${controller.showHistory ? "is-active" : ""}`}
				aria-label={
					pending > 0 ? `Chats (${pending} waiting for you)` : "Chats"
				}
				onClick={() => controller.toggleHistory()}
			>
				<Icon name="history" />
				{pending > 0 ? (
					<span className="tr-ai-chat__badge">{pending}</span>
				) : null}
			</button>
			<button
				type="button"
				className="clickable-icon tr-ai-chat__icon-btn"
				aria-label="New chat"
				onClick={() => controller.newChat()}
			>
				<Icon name="square-pen" />
			</button>
		</div>
	);
}

function Shell() {
	const controller = useController();
	const session = controller.current;
	return (
		<div className="tr-ai-chat">
			<Header />
			{controller.showHistory ? (
				<ChatHistory />
			) : (
				<SessionRuntime key={session.id} session={session} />
			)}
		</div>
	);
}

export function ChatApp({
	plugin,
	controller,
}: {
	plugin: TrueRecallPlugin;
	controller: AiChatController;
}) {
	return (
		<PluginContext.Provider value={plugin}>
			<ControllerContext.Provider value={controller}>
				<Shell />
			</ControllerContext.Provider>
		</PluginContext.Provider>
	);
}
