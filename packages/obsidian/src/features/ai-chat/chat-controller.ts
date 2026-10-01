import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import type TrueRecallPlugin from "../../main";
import {
	type ChatContext,
	chatTitle,
	noteContext,
} from "./engine/chat-context";
import { TrueRecallChatTransport } from "./engine/chat-transport";
import {
	countPending,
	type ProposalDecision,
	type ProposalDecisions,
	type ProposalDraft,
	type ProposalDrafts,
} from "./engine/proposals";

export interface ChatSession {
	id: string;
	title: string;
	context: ChatContext;
	decisions: ProposalDecisions;
	drafts: ProposalDrafts;
	/** Forces web search (fact checks). */
	factCheck: boolean;
	createdAt: number;
	chat: Chat<UIMessage>;
}

export interface StartChatOptions {
	context: ChatContext;
	/** Sent right away as the user's first message. */
	message?: string;
	factCheck?: boolean;
	/** Reveal the chat view (default true). Under-card runs pass false. */
	reveal?: boolean;
}

function newId(): string {
	return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBusy(status: Chat<UIMessage>["status"]): boolean {
	return status === "submitted" || status === "streaming";
}

function firstUserText(messages: readonly UIMessage[]): string {
	const first = messages.find((m) => m.role === "user");
	const part = first?.parts.find((p) => p.type === "text");
	return part && "text" in part ? part.text : "";
}

/**
 * Owns the AI chat conversations: the live `Chat` objects (so a stream keeps
 * running while the user switches chats or closes the view), their context
 * and decisions, and saving them to the `ai_chats` table. UI-free, so the
 * review view and the selection menu can start chats too.
 */
export class AiChatController {
	private sessions = new Map<string, ChatSession>();
	private listeners = new Set<() => void>();
	private version = 0;
	currentId: string;
	/** Chat view shows the history list instead of the thread. */
	showHistory = false;

	constructor(
		private plugin: TrueRecallPlugin,
		private revealView: () => Promise<void>,
	) {
		this.currentId = this.createSession({
			context: this.activeNoteContext(),
		}).id;
	}

	// ─── subscription (useSyncExternalStore) ───────────────────────────

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getVersion = (): number => this.version;

	private changed(): void {
		this.version++;
		for (const listener of this.listeners) listener();
	}

	// ─── sessions ──────────────────────────────────────────────────────

	get current(): ChatSession {
		return this.get(this.currentId) ?? this.newChat();
	}

	get(id: string): ChatSession | undefined {
		const live = this.sessions.get(id);
		if (live) return live;
		const saved = this.plugin.cardStore?.aiChats.get(id);
		if (!saved) return undefined;
		return this.createSession({
			id: saved.id,
			title: saved.title,
			context: saved.context,
			decisions: saved.decisions as ProposalDecisions,
			drafts: saved.drafts as ProposalDrafts | undefined,
			factCheck: (saved.context as { factCheck?: boolean }).factCheck === true,
			createdAt: saved.createdAt,
			messages: saved.messages as UIMessage[],
		});
	}

	private createSession(init: {
		id?: string;
		title?: string;
		context: ChatContext;
		decisions?: ProposalDecisions;
		drafts?: ProposalDrafts;
		factCheck?: boolean;
		createdAt?: number;
		messages?: UIMessage[];
	}): ChatSession {
		const id = init.id ?? newId();
		const session: ChatSession = {
			id,
			title: init.title ?? "",
			context: init.context,
			decisions: init.decisions ?? {},
			drafts: init.drafts ?? {},
			factCheck: init.factCheck ?? false,
			createdAt: init.createdAt ?? Date.now(),
			chat: new Chat<UIMessage>({
				id,
				messages: init.messages ?? [],
				transport: new TrueRecallChatTransport(this.plugin, () => ({
					context: session.context,
					decisions: session.decisions,
					factCheck: session.factCheck,
				})),
				onFinish: () => {
					this.save(id);
					this.changed();
				},
				onError: () => this.changed(),
			}),
		};
		this.sessions.set(id, session);
		return session;
	}

	activeNoteContext(): ChatContext {
		const note = noteContext(this.plugin.app.workspace.getActiveFile());
		return note ? { note } : {};
	}

	/** Opens an empty chat about the active note (reuses the current one if empty). */
	newChat(): ChatSession {
		const current = this.sessions.get(this.currentId);
		if (current && current.chat.messages.length === 0) {
			current.context = this.activeNoteContext();
			this.showHistory = false;
			this.changed();
			return current;
		}
		const session = this.createSession({ context: this.activeNoteContext() });
		this.currentId = session.id;
		this.showHistory = false;
		this.changed();
		return session;
	}

	open(id: string): void {
		if (!this.get(id)) return;
		this.currentId = id;
		this.showHistory = false;
		this.changed();
	}

	toggleHistory(show = !this.showHistory): void {
		this.showHistory = show;
		this.changed();
	}

	/** Starts a chat from another surface (selection, review, note panel). */
	async start(options: StartChatOptions): Promise<ChatSession> {
		const session = this.createSession({
			context: options.context,
			factCheck: options.factCheck,
		});
		if (options.reveal !== false) {
			this.currentId = session.id;
			this.showHistory = false;
			this.changed();
			await this.revealView();
		}
		if (options.message) void this.send(session.id, options.message);
		return session;
	}

	/** Review runs (Polish, fact check, a question) whose result shows under the card. */
	private cardRuns = new Map<string, string>();

	async startForCard(
		cardId: string,
		options: Omit<StartChatOptions, "reveal">,
	): Promise<ChatSession> {
		const previous = this.cardRuns.get(cardId);
		const running = previous ? this.sessions.get(previous) : undefined;
		if (running && isBusy(running.chat.status)) void running.chat.stop();
		const session = await this.start({ ...options, reveal: false });
		this.cardRuns.set(cardId, session.id);
		this.changed();
		return session;
	}

	sessionForCard(cardId: string): ChatSession | undefined {
		const id = this.cardRuns.get(cardId);
		return id ? this.sessions.get(id) : undefined;
	}

	dismissCardRun(cardId: string): void {
		this.cardRuns.delete(cardId);
		this.changed();
	}

	/** "Continue in chat": the under-card run becomes the open conversation. */
	async continueInChat(id: string): Promise<void> {
		this.open(id);
		await this.revealView();
	}

	async send(
		id: string,
		text: string,
		options?: { factCheck?: boolean },
	): Promise<void> {
		const session = this.get(id);
		if (!session) return;
		if (options?.factCheck) session.factCheck = true;
		if (!session.title) session.title = chatTitle(text, session.context);
		this.changed();
		await session.chat.sendMessage({ text });
	}

	setContext(id: string, context: ChatContext): void {
		const session = this.get(id);
		if (!session) return;
		session.context = context;
		this.save(id);
		this.changed();
	}

	/** While a chat has no messages, it follows the note the user opens. */
	followActiveNote(): void {
		const session = this.sessions.get(this.currentId);
		if (!session || session.chat.messages.length > 0) return;
		const note = this.activeNoteContext().note;
		if (session.context.note?.path === note?.path) return;
		session.context = { ...session.context, note };
		if (!note) delete session.context.note;
		this.changed();
	}

	decide(id: string, callId: string, decision: ProposalDecision): void {
		const session = this.get(id);
		if (!session) return;
		session.decisions = { ...session.decisions, [callId]: decision };
		this.save(id);
		this.changed();
	}

	updateDraft(id: string, callId: string, patch: Partial<ProposalDraft>): void {
		const session = this.get(id);
		if (!session) return;
		session.drafts = {
			...session.drafts,
			[callId]: { ...session.drafts[callId], ...patch },
		};
		this.save(id);
		this.changed();
	}

	/** "Undo": the proposal is open again (and back in "Waiting for you"). */
	undecide(id: string, callId: string): void {
		const session = this.get(id);
		if (!session) return;
		const { [callId]: _removed, ...rest } = session.decisions;
		session.decisions = rest;
		this.save(id);
		this.changed();
	}

	// ─── persistence ───────────────────────────────────────────────────

	/** Saves a chat that has messages. Empty chats never reach the history. */
	save(id: string): void {
		const session = this.sessions.get(id);
		const store = this.plugin.cardStore;
		if (!session || !store) return;
		const messages = session.chat.messages;
		if (messages.length === 0) return;
		if (!session.title) {
			session.title = chatTitle(firstUserText(messages), session.context);
		}
		store.aiChats.save({
			id,
			title: session.title,
			context: {
				...session.context,
				factCheck: session.factCheck || undefined,
			},
			messages,
			decisions: session.decisions,
			drafts: session.drafts,
			pendingCount: countPending(messages, session.decisions),
			createdAt: session.createdAt,
			updatedAt: Date.now(),
		});
	}

	list() {
		return this.plugin.cardStore?.aiChats.list() ?? [];
	}

	pendingTotal(): number {
		return this.plugin.cardStore?.aiChats.pendingTotal() ?? 0;
	}

	/** Chats with undecided proposals about this note (the note panel strip). */
	pendingForNote(path: string): { count: number; chatId: string | null } {
		let count = 0;
		let chatId: string | null = null;
		for (const chat of this.list()) {
			const note = (chat.context as ChatContext).note;
			if (chat.pendingCount > 0 && note?.path === path) {
				count += chat.pendingCount;
				chatId ??= chat.id;
			}
		}
		return { count, chatId };
	}

	delete(id: string): void {
		void this.sessions.get(id)?.chat.stop();
		this.sessions.delete(id);
		this.plugin.cardStore?.aiChats.delete(id);
		if (this.currentId === id) {
			this.currentId = this.createSession({
				context: this.activeNoteContext(),
			}).id;
		}
		this.changed();
	}

	dispose(): void {
		for (const session of this.sessions.values()) {
			void session.chat.stop();
			this.save(session.id);
		}
		this.listeners.clear();
	}
}
