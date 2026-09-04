import type { SqliteDatabase } from "../SqliteDatabase";

/** Entity types that carry a foreign key to a parent row. */
export type DeferrableEntityType = "note" | "card" | "review_log";

export interface DeferredChange {
	entityType: DeferrableEntityType;
	entityId: string;
	parentId: string;
	updatedAt: number;
	sourceDeviceId: string | null;
	payload: Record<string, unknown>;
}

interface DeferredRow {
	entity_id: string;
	parent_id: string;
	updated_at: number;
	source_device_id: string | null;
	payload: string;
}

const PARENT_TABLE: Record<DeferrableEntityType, string> = {
	note: "note_types",
	card: "notes",
	review_log: "cards",
};

/**
 * Parking lot for cloud rows whose parent has not arrived yet.
 *
 * The server pages changes by revision, and a device pushes its rows sorted by
 * `updatedAt`, so a review log routinely lands pages before the card it
 * belongs to (the card's timestamp moves with every review, the log's does
 * not). Inserting the log first trips `FOREIGN KEY constraint failed` and
 * aborts the whole page. Rows wait here until their parent exists, then get
 * applied through the normal upsert path. The table survives an interrupted
 * sync and the startup integrity sweep, which only knows the entity tables.
 */
export class CloudSyncDeferredActions {
	constructor(private db: SqliteDatabase) {}

	isParentPresent(entityType: DeferrableEntityType, parentId: string): boolean {
		return (
			this.db.get<{ found: number }>(
				`SELECT 1 AS found FROM ${PARENT_TABLE[entityType]} WHERE id = ? LIMIT 1`,
				[parentId],
			) !== null
		);
	}

	/** Park a change; a newer version of the same entity replaces an older one. */
	defer(change: DeferredChange): void {
		this.db.run(
			`INSERT INTO cloud_sync_deferred (entity_type, entity_id, parent_id, updated_at, source_device_id, payload)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(entity_type, entity_id) DO UPDATE SET
				parent_id = excluded.parent_id,
				updated_at = excluded.updated_at,
				source_device_id = excluded.source_device_id,
				payload = excluded.payload
			 WHERE excluded.updated_at >= cloud_sync_deferred.updated_at`,
			[
				change.entityType,
				change.entityId,
				change.parentId,
				change.updatedAt,
				change.sourceDeviceId,
				JSON.stringify(change.payload),
			],
		);
	}

	/** Parked rows of one type whose parent now exists, oldest first. */
	takeReady(entityType: DeferrableEntityType): DeferredChange[] {
		const rows = this.db.query<DeferredRow>(
			`SELECT d.entity_id, d.parent_id, d.updated_at, d.source_device_id, d.payload
			 FROM cloud_sync_deferred d
			 WHERE d.entity_type = ?
			   AND EXISTS (SELECT 1 FROM ${PARENT_TABLE[entityType]} p WHERE p.id = d.parent_id)
			 ORDER BY d.updated_at, d.entity_id`,
			[entityType],
		);
		return rows.map((row) => ({
			entityType,
			entityId: row.entity_id,
			parentId: row.parent_id,
			updatedAt: row.updated_at,
			sourceDeviceId: row.source_device_id,
			payload: JSON.parse(row.payload) as Record<string, unknown>,
		}));
	}

	remove(entityType: DeferrableEntityType, entityId: string): void {
		this.db.run(
			`DELETE FROM cloud_sync_deferred WHERE entity_type = ? AND entity_id = ?`,
			[entityType, entityId],
		);
	}

	count(): number {
		return (
			this.db.get<{ n: number }>(
				`SELECT COUNT(*) AS n FROM cloud_sync_deferred`,
			)?.n ?? 0
		);
	}
}
