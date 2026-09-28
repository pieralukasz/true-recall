/** @jsxImportSource react */
import type { ChatContext } from "../engine/chat-context";
import { Icon, useController } from "./obsidian";

function ago(ms: number): string {
	const minutes = Math.round((Date.now() - ms) / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} h ago`;
	const days = Math.round(hours / 24);
	if (days < 7) return `${days} d ago`;
	return new Date(ms).toLocaleDateString();
}

function subtitle(context: ChatContext): string | null {
	return context.note?.title ?? context.card?.label ?? null;
}

/**
 * Past chats. "Waiting for you" lists chats with proposals the user has not
 * added or skipped: this replaces the old AI Inbox.
 */
export function ChatHistory() {
	const controller = useController();
	const chats = controller.list();
	const waiting = chats.filter((c) => c.pendingCount > 0);
	const recent = chats.filter((c) => c.pendingCount === 0);

	const row = (chat: (typeof chats)[number]) => {
		const context = chat.context as ChatContext;
		const sub = subtitle(context);
		return (
			<li key={chat.id} className="tr-ai-chat__history-item">
				<button
					type="button"
					className="tr-ai-chat__history-open"
					onClick={() => controller.open(chat.id)}
				>
					<span className="tr-ai-chat__history-title">
						{chat.title || "Untitled chat"}
					</span>
					<span className="tr-ai-chat__history-meta">
						{sub ? (
							<span className="tr-ai-chat__history-sub">{sub}</span>
						) : null}
						<span>{ago(chat.updatedAt)}</span>
					</span>
				</button>
				{chat.pendingCount > 0 ? (
					<span className="tr-ai-chat__badge" title="Proposals waiting">
						{chat.pendingCount}
					</span>
				) : null}
				<button
					type="button"
					className="clickable-icon tr-ai-chat__icon-btn tr-ai-chat__history-delete"
					aria-label="Delete chat"
					onClick={() => controller.delete(chat.id)}
				>
					<Icon name="trash-2" />
				</button>
			</li>
		);
	};

	return (
		<div className="tr-ai-chat__history">
			{chats.length === 0 ? (
				<div className="tr-ai-chat__muted">
					No chats yet. Your conversations will show up here.
				</div>
			) : null}
			{waiting.length > 0 ? (
				<section>
					<div className="tr-ai-chat__history-section">Waiting for you</div>
					<ul>{waiting.map(row)}</ul>
				</section>
			) : null}
			{recent.length > 0 ? (
				<section>
					<div className="tr-ai-chat__history-section">Recent</div>
					<ul>{recent.map(row)}</ul>
				</section>
			) : null}
		</div>
	);
}
