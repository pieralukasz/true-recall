import type {
	AssistantContext,
	AssistantManifest,
	AssistantThread,
	AssistantThreadMessage,
	AssistantThreadRevision,
	AssistantThreadState,
} from "../../../ai/assistant/assistant.types";
import type { SqliteDatabase } from "../SqliteDatabase";

interface AssistantThreadRow {
	id: string;
	title: string;
	context_json: string;
	state: string;
	messages_json: string;
	manifest_json: string | null;
	revisions_json: string;
	revision: number;
	active_task_id: string | null;
	created_at: number;
	updated_at: number;
}

const SELECT = `SELECT id, title, context_json, state, messages_json,
	manifest_json, revisions_json, revision, active_task_id, created_at, updated_at
	FROM assistant_threads`;

function mapRow(row: AssistantThreadRow): AssistantThread {
	const thread: AssistantThread = {
		id: row.id,
		title: row.title,
		context: JSON.parse(row.context_json) as AssistantContext,
		state: row.state as AssistantThreadState,
		messages: JSON.parse(row.messages_json) as AssistantThreadMessage[],
		revisions: JSON.parse(row.revisions_json) as AssistantThreadRevision[],
		revision: row.revision,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
	if (row.manifest_json) {
		thread.manifest = JSON.parse(row.manifest_json) as AssistantManifest;
	}
	if (row.active_task_id) thread.activeTaskId = row.active_task_id;
	return thread;
}

export class AssistantThreadActions {
	constructor(private db: SqliteDatabase) {}

	insert(params: {
		id: string;
		title: string;
		context: AssistantContext;
		state: AssistantThreadState;
		message: AssistantThreadMessage;
		activeTaskId: string;
		createdAt: number;
	}): void {
		this.db.run(
			`INSERT INTO assistant_threads
			 (id, title, context_json, state, messages_json, revisions_json, revision,
			  active_task_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, '[]', 0, ?, ?, ?)`,
			[
				params.id,
				params.title,
				JSON.stringify(params.context),
				params.state,
				JSON.stringify([params.message]),
				params.activeTaskId,
				params.createdAt,
				params.createdAt,
			],
		);
	}

	getById(id: string): AssistantThread | null {
		const row = this.db.get<AssistantThreadRow>(`${SELECT} WHERE id = ?`, [id]);
		return row ? mapRow(row) : null;
	}

	list(state?: AssistantThreadState, limit = 100): AssistantThread[] {
		const rows = state
			? this.db.query<AssistantThreadRow>(
					`${SELECT} WHERE state = ? ORDER BY updated_at DESC LIMIT ?`,
					[state, limit],
				)
			: this.db.query<AssistantThreadRow>(
					`${SELECT} ORDER BY updated_at DESC LIMIT ?`,
					[limit],
				);
		return rows.map(mapRow);
	}

	beginTurn(params: {
		id: string;
		taskId: string;
		message: AssistantThreadMessage;
		updatedAt: number;
	}): AssistantThread | null {
		const thread = this.getById(params.id);
		if (!thread || thread.activeTaskId) return null;
		const revisions = [...thread.revisions];
		if (thread.manifest) {
			revisions.push({
				revision: thread.revision,
				manifest: structuredClone(thread.manifest),
				messagesLength: thread.messages.length,
			});
		}
		this.db.run(
			`UPDATE assistant_threads
			 SET messages_json = ?, revisions_json = ?, active_task_id = ?,
			     updated_at = ? WHERE id = ?`,
			[
				JSON.stringify([...thread.messages, params.message]),
				JSON.stringify(revisions.slice(-20)),
				params.taskId,
				params.updatedAt,
				params.id,
			],
		);
		return this.getById(params.id);
	}

	completeTurn(params: {
		id: string;
		taskId: string;
		manifest: AssistantManifest;
		message?: AssistantThreadMessage;
		updatedAt: number;
	}): void {
		const thread = this.getById(params.id);
		if (!thread || thread.activeTaskId !== params.taskId) return;
		const messages = params.message
			? [...thread.messages, params.message]
			: thread.messages;
		this.db.run(
			`UPDATE assistant_threads
			 SET messages_json = ?, manifest_json = ?, revision = ?,
			     active_task_id = NULL, updated_at = ? WHERE id = ?`,
			[
				JSON.stringify(messages),
				JSON.stringify(params.manifest),
				thread.revision + 1,
				params.updatedAt,
				params.id,
			],
		);
	}

	failTurn(params: {
		id: string;
		taskId: string;
		message: AssistantThreadMessage;
		updatedAt: number;
	}): void {
		const thread = this.getById(params.id);
		if (!thread || thread.activeTaskId !== params.taskId) return;
		this.db.run(
			`UPDATE assistant_threads
			 SET messages_json = ?, active_task_id = NULL, updated_at = ? WHERE id = ?`,
			[
				JSON.stringify([...thread.messages, params.message]),
				params.updatedAt,
				params.id,
			],
		);
	}

	updateManifest(
		id: string,
		manifest: AssistantManifest,
		updatedAt: number,
	): void {
		this.db.run(
			`UPDATE assistant_threads SET manifest_json = ?, updated_at = ? WHERE id = ?`,
			[JSON.stringify(manifest), updatedAt, id],
		);
	}

	setState(id: string, state: AssistantThreadState, updatedAt: number): void {
		this.db.run(
			`UPDATE assistant_threads SET state = ?, updated_at = ? WHERE id = ?`,
			[state, updatedAt, id],
		);
	}

	undoLastTurn(id: string, updatedAt: number): AssistantThread | null {
		const thread = this.getById(id);
		const previous = thread?.revisions.at(-1);
		if (!thread || !previous || thread.activeTaskId) return null;
		this.db.run(
			`UPDATE assistant_threads
			 SET manifest_json = ?, messages_json = ?, revisions_json = ?, revision = ?,
			     updated_at = ? WHERE id = ?`,
			[
				JSON.stringify(previous.manifest),
				JSON.stringify(thread.messages.slice(0, previous.messagesLength)),
				JSON.stringify(thread.revisions.slice(0, -1)),
				previous.revision,
				updatedAt,
				id,
			],
		);
		return this.getById(id);
	}

	deleteById(id: string): void {
		this.db.transaction(() => {
			this.db.run(`DELETE FROM assistant_tasks WHERE thread_id = ?`, [id]);
			this.db.run(`DELETE FROM assistant_threads WHERE id = ?`, [id]);
		});
	}
}
