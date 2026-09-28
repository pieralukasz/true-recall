/** @jsxImportSource react */
import {
	AssistantRuntimeProvider,
	ComposerPrimitive,
	MessagePrimitive,
	type TextMessagePartComponent,
	ThreadPrimitive,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import {
	DirectChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useEffect, useMemo, useState } from "react";

import type TrueRecallPlugin from "../../../main";
import { createChatAgent } from "../chat-agent";
import { ObsidianMarkdown, PluginContext, usePlugin } from "./obsidian";
import { ProposeCardEditUI, ProposeCardsUI } from "./proposals";

const Text: TextMessagePartComponent = ({ text }) => (
	<ObsidianMarkdown markdown={text} />
);

const partComponents = {
	Text,
	tools: {
		by_name: {
			propose_cards: ProposeCardsUI,
			propose_card_edit: ProposeCardEditUI,
		},
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
		</MessagePrimitive.Root>
	);
}

function noteTitle(plugin: TrueRecallPlugin): string | null {
	const f = plugin.app.workspace.getActiveFile();
	return f && f.extension === "md" ? f.basename : null;
}

function useActiveNoteTitle(): string | null {
	const plugin = usePlugin();
	const [title, setTitle] = useState(() => noteTitle(plugin));
	useEffect(() => {
		const ref = plugin.app.workspace.on("file-open", () =>
			setTitle(noteTitle(plugin)),
		);
		return () => plugin.app.workspace.offref(ref);
	}, [plugin]);
	return title;
}

const SUGGESTIONS = [
	{ label: "Zrób fiszki z tej notatki", prompt: "Zrób fiszki z tej notatki" },
	{
		label: "Popraw pierwszą kartę",
		prompt: "Popraw pierwszą kartę z tej notatki",
	},
];

function Thread() {
	const note = useActiveNoteTitle();
	return (
		<ThreadPrimitive.Root className="tr-ai-chat">
			<div className="tr-ai-chat__header">
				<span className="tr-ai-chat__badge">PRO</span>
				<span className="tr-ai-chat__demo">demo, bez modelu</span>
			</div>
			<ThreadPrimitive.Viewport className="tr-ai-chat__viewport">
				<ThreadPrimitive.Empty>
					<div className="tr-ai-chat__empty">
						<div className="tr-ai-chat__empty-title">W czym pomóc?</div>
						<div className="tr-ai-chat__suggestions">
							{SUGGESTIONS.map((s) => (
								<ThreadPrimitive.Suggestion
									key={s.label}
									prompt={s.prompt}
									send
									asChild
								>
									<button type="button" className="tr-ai-chat__suggestion">
										{s.label}
									</button>
								</ThreadPrimitive.Suggestion>
							))}
						</div>
					</div>
				</ThreadPrimitive.Empty>
				<ThreadPrimitive.Messages
					components={{ UserMessage, AssistantMessage }}
				/>
			</ThreadPrimitive.Viewport>
			<ComposerPrimitive.Root className="tr-ai-chat__composer">
				{note ? (
					<span className="tr-ai-chat__chip tr-ai-chat__context">
						📄 {note}
					</span>
				) : null}
				<div className="tr-ai-chat__input-row">
					<ComposerPrimitive.Input
						className="tr-ai-chat__input"
						placeholder="Napisz wiadomość…"
						rows={1}
					/>
					<ComposerPrimitive.Send
						className="tr-ai-chat__send mod-cta"
						aria-label="Wyślij"
					>
						↑
					</ComposerPrimitive.Send>
				</div>
			</ComposerPrimitive.Root>
		</ThreadPrimitive.Root>
	);
}

function Runtime() {
	const plugin = usePlugin();
	const transport = useMemo(
		() => new DirectChatTransport({ agent: createChatAgent(plugin) }),
		[plugin],
	);
	const runtime = useChatRuntime({
		transport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
	});
	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<Thread />
		</AssistantRuntimeProvider>
	);
}

export function ChatApp({ plugin }: { plugin: TrueRecallPlugin }) {
	return (
		<PluginContext.Provider value={plugin}>
			<Runtime />
		</PluginContext.Provider>
	);
}
