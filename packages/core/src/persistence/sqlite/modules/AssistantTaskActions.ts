import type {
	AssistantContext,
	AssistantManifest,
	AssistantTask,
	AssistantTaskStatus,
} from "../../../ai/assistant/assistant.types";
import type { SqliteDatabase } from "../SqliteDatabase";

interface AssistantTaskRow {
	id: string;
	instruction: string;
	preset_id: string | null;
	context_json: string;
	status: string;
	result_manifest_json: string | null;
	error: string | null;
	created_at: number;
	finished_at: number | null;
}

function mapRow(row: AssistantTaskRow): AssistantTask {
	const task: AssistantTask = {
		id: row.id,
		instruction: row.instruction,
		context: JSON.parse(row.context_json) as AssistantContext,
		status: row.status as AssistantTaskStatus,
		createdAt: row.created_at,
	};
	if (row.preset_id) task.presetId = row.preset_id;
	if (row.result_manifest_json) {
		task.manifest = JSON.parse(row.result_manifest_json) as AssistantManifest;
	}
	if (row.error) task.error = row.error;
	if (row.finished_at !== null) task.finishedAt = row.finished_at;
	return task;
}

const SELECT = `SELECT id, instruction, preset_id, context_json, status,
	result_manifest_json, error, created_at, finished_at FROM assistant_tasks`;

export class AssistantTaskActions {
	constructor(private db: SqliteDatabase) {}

	insert(params: {
		id: string;
		instruction: string;
		presetId?: string;
		context: AssistantContext;
		createdAt: number;
	}): void {
		this.db.run(
			`INSERT INTO assistant_tasks (id, instruction, preset_id, context_json, status, created_at)
			 VALUES (?, ?, ?, ?, 'pending', ?)`,
			[
				params.id,
				params.instruction,
				params.presetId ?? null,
				JSON.stringify(params.context),
				params.createdAt,
			],
		);
	}

	getById(id: string): AssistantTask | null {
		const row = this.db.get<AssistantTaskRow>(`${SELECT} WHERE id = ?`, [id]);
		return row ? mapRow(row) : null;
	}

	list(limit = 100): AssistantTask[] {
		const rows = this.db.query<AssistantTaskRow>(
			`${SELECT} ORDER BY created_at DESC LIMIT ?`,
			[limit],
		);
		return rows.map(mapRow);
	}

	claimNextPending(): AssistantTask | null {
		return this.db.transaction(() => {
			const row = this.db.get<AssistantTaskRow>(
				`${SELECT} WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`,
			);
			if (!row) return null;
			this.db.run(
				`UPDATE assistant_tasks SET status = 'running' WHERE id = ?`,
				[row.id],
			);
			return mapRow({ ...row, status: "running" });
		});
	}

	complete(id: string, manifest: AssistantManifest, finishedAt: number): void {
		this.db.run(
			`UPDATE assistant_tasks SET status = 'done', result_manifest_json = ?, finished_at = ? WHERE id = ?`,
			[JSON.stringify(manifest), finishedAt, id],
		);
	}

	fail(id: string, error: string, finishedAt: number): void {
		this.db.run(
			`UPDATE assistant_tasks SET status = 'failed', error = ?, finished_at = ? WHERE id = ?`,
			[error, finishedAt, id],
		);
	}

	updateManifest(id: string, manifest: AssistantManifest): void {
		this.db.run(
			`UPDATE assistant_tasks SET result_manifest_json = ? WHERE id = ?`,
			[JSON.stringify(manifest), id],
		);
	}

	cancel(id: string, finishedAt: number): void {
		this.db.run(
			`UPDATE assistant_tasks SET status = 'cancelled', finished_at = ? WHERE id = ? AND status IN ('pending','running')`,
			[finishedAt, id],
		);
	}

	/** Startup recovery: tasks interrupted mid-run go back to the queue. */
	resetRunningToPending(): number {
		this.db.run(
			`UPDATE assistant_tasks SET status = 'pending' WHERE status = 'running'`,
		);
		return this.db.raw.getRowsModified();
	}

	deleteById(id: string): void {
		this.db.run(`DELETE FROM assistant_tasks WHERE id = ?`, [id]);
	}
}
