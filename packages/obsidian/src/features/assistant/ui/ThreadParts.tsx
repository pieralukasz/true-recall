import { useState } from "preact/hooks";

import type {
	AssistantThread,
	AssistantThreadMessage,
} from "@true-recall/core/ai/assistant";

import {
	ActionButton,
	MarkdownContent,
} from "@true-recall/obsidian/components";

import { AiComposer } from "./AiComposer";

const VISIBLE_MESSAGES = 6;

export function ThreadMessages({
	messages,
	notePath,
}: {
	messages: readonly AssistantThreadMessage[];
	notePath?: string;
}) {
	const [showAll, setShowAll] = useState(false);
	const visible = showAll ? messages : messages.slice(-VISIBLE_MESSAGES);

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5">
			{messages.length > VISIBLE_MESSAGES && !showAll ? (
				<ActionButton
					label={`Show earlier (${messages.length - VISIBLE_MESSAGES})`}
					variant="ghost"
					size="sm"
					onClick={() => setShowAll(true)}
				/>
			) : null}
			{visible.map((turn) => (
				<div
					key={turn.id}
					class="ep:grid ep:grid-cols-[28px_minmax(0,1fr)] ep:gap-2 ep:text-ui-smaller"
				>
					<span class="ep:text-obs-muted ep:font-semibold">
						{turn.role === "user" ? "You" : "AI"}
					</span>
					{turn.role === "user" ? (
						// User turns stay verbatim so typed `*` or `$` are not
						// reinterpreted as markup.
						<p class="ep:m-0 ep:whitespace-pre-wrap ep:text-obs-normal">
							{turn.content}
						</p>
					) : (
						<MarkdownContent
							markdown={turn.content}
							filePath={notePath}
							class="tr-assistant-thread-markdown ep:text-obs-muted"
						/>
					)}
				</div>
			))}
		</div>
	);
}

export function ThreadProgress({
	thread,
	lines,
}: {
	thread: AssistantThread;
	lines: readonly string[] | null;
}) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-1 ep:pt-2 ep:border-t ep:border-obs-border">
			{lines && lines.length > 0 ? (
				lines.slice(-3).map((line, index) => (
					<div
						key={`${thread.id}-${index}`}
						class="ep:text-ui-smaller ep:text-obs-muted ep:leading-snug"
					>
						{line}
					</div>
				))
			) : (
				<div class="ep:text-ui-smaller ep:text-obs-muted">Waiting for AI…</div>
			)}
		</div>
	);
}

export function ThreadComposer({
	busy,
	onSend,
	onStop,
	onDismiss,
}: {
	busy: boolean;
	/** Returns true when the message was accepted and the input can clear. */
	onSend: (message: string) => boolean;
	onStop: () => void;
	onDismiss?: () => void;
}) {
	const [message, setMessage] = useState("");
	const send = () => {
		if (!message.trim() || busy) return;
		if (onSend(message)) setMessage("");
	};

	return (
		<AiComposer
			variant="workspace"
			value={message}
			onChange={setMessage}
			placeholder="Tell AI what to change or add…"
			submitLabel="Send"
			hint={
				<span>
					<kbd>Enter</kbd> send <span aria-hidden="true">·</span>{" "}
					<kbd>Shift Enter</kbd> new line
				</span>
			}
			busy={busy}
			onStop={onStop}
			onSubmit={send}
			onDismiss={onDismiss}
		/>
	);
}
