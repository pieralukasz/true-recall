import type { SqliteDatabase } from "../SqliteDatabase";

/**
 * One conversation of the in-plugin AI chat. Messages are stored as the chat
 * library produced them (opaque JSON); decisions record what the user did with
 * each proposal (added, applied, skipped), keyed by the tool call id.
 */
export interface AiChatRecord {
	id: string;
	title: string;
	context: Record<string, unknown>;
	messages: unknown[];
	decisions: Record<string, unknown>;
	drafts?: Record<string, unknown>;
	/** Proposals still waiting for the user's decision. */
	pendingCount: number;
	createdAt: number;
	updatedAt: number;
}

export type AiChatSummary = Omit<
	AiChatRecord,
	"messages" | "decisions" | "drafts"
>;

interface AiChatRow {
	id: string;
	title: string;
	context_json: string;
	messages_json: string;
	decisions_json: string;
	drafts_json: string;
	pending_count: number;
	created_at: number;
	updated_at: number;
}

function parse<T>(json: string, fallback: T): T {
	try {
		return JSON.parse(json) as T;
	} catch {
		return fallback;
	}
}

type AiChatSummaryRow = Omit<
	AiChatRow,
	"messages_json" | "decisions_json" | "drafts_json"
>;

function toSummary(row: AiChatSummaryRow) {
	return {
		id: row.id,
		title: row.title,
		context: parse<Record<string, unknown>>(row.context_json, {}),
		pendingCount: row.pending_count,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class AiChatActions {
	constructor(private db: SqliteDatabase) {}

	save(chat: AiChatRecord): void {
		this.db.run(
			`INSERT INTO ai_chats (id, title, context_json, messages_json, decisions_json, drafts_json,
				pending_count, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				title = excluded.title,
				context_json = excluded.context_json,
				messages_json = excluded.messages_json,
				decisions_json = excluded.decisions_json,
				drafts_json = excluded.drafts_json,
				pending_count = excluded.pending_count,
				updated_at = excluded.updated_at`,
			[
				chat.id,
				chat.title,
				JSON.stringify(chat.context),
				JSON.stringify(chat.messages),
				JSON.stringify(chat.decisions),
				JSON.stringify(chat.drafts ?? {}),
				chat.pendingCount,
				chat.createdAt,
				chat.updatedAt,
			],
		);
	}

	get(id: string): AiChatRecord | null {
		const row = this.db.get<AiChatRow>(`SELECT * FROM ai_chats WHERE id = ?`, [
			id,
		]);
		if (!row) return null;
		return {
			...toSummary(row),
			messages: parse<unknown[]>(row.messages_json, []),
			decisions: parse<Record<string, unknown>>(row.decisions_json, {}),
			drafts: parse<Record<string, unknown>>(row.drafts_json, {}),
		};
	}

	/** Newest first, without the message bodies. */
	list(limit = -1): AiChatSummary[] {
		return this.db
			.query<AiChatSummaryRow>(
				`SELECT id, title, context_json, pending_count, created_at, updated_at
				 FROM ai_chats ORDER BY updated_at DESC LIMIT ?`,
				[limit],
			)
			.map(toSummary);
	}

	/** Proposals waiting across all chats (the badge on the chat icon). */
	pendingTotal(): number {
		const row = this.db.get<{ n: number | null }>(
			`SELECT SUM(pending_count) AS n FROM ai_chats`,
		);
		return row?.n ?? 0;
	}

	delete(id: string): void {
		this.db.run(`DELETE FROM ai_chats WHERE id = ?`, [id]);
	}
}
