import type { SqliteDatabase } from "../SqliteDatabase";

export interface ChildCardLink {
	childCardId: string;
	parentCardId: string;
	createdAt: number;
	/** Set when the child graduated; its cards stay until the group completes. */
	graduatedAt: number | null;
}

/** A `card_children` row as stored, the shape device and Cloud Sync carry. */
export interface ChildCardRow {
	child_card_id: string;
	parent_card_id: string;
	created_at: number;
	graduated_at: number | null;
	deleted_at: number | null;
	updated_at: number | null;
}

/**
 * Parent → child relations for "child cards": a suspended card studied through
 * one or more easier stand-ins.
 *
 * A child graduates on its own, but the parent only comes back once every live
 * child of that parent has graduated; the graduated children stay suspended
 * with their review history. Rows are
 * kept after deletion (`deleted_at`) so the history of a group is not lost when
 * a child is removed by hand. Every write stamps `updated_at`, so device and
 * Cloud Sync carry the groups like cards (last write wins).
 */
export class ChildCardActions {
	constructor(private db: SqliteDatabase) {}

	/** Attach `childCardId` to `parentCardId`, replacing any previous parent. */
	link(childCardId: string, parentCardId: string, now = Date.now()): void {
		this.db.run(
			`INSERT INTO card_children (child_card_id, parent_card_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(child_card_id) DO UPDATE SET
			   parent_card_id = excluded.parent_card_id,
			   created_at = excluded.created_at,
			   graduated_at = NULL,
			   deleted_at = NULL,
			   updated_at = excluded.updated_at`,
			[childCardId, parentCardId, now, now],
		);
	}

	/** Stop treating the child as part of a group. */
	unlink(childCardId: string, now = Date.now()): void {
		this.db.run(
			`UPDATE card_children SET deleted_at = ?, updated_at = ?
			 WHERE child_card_id = ? AND deleted_at IS NULL`,
			[now, now, childCardId],
		);
	}

	getParentId(childCardId: string): string | null {
		const row = this.db.get<{ parentCardId: string }>(
			`SELECT parent_card_id AS parentCardId FROM card_children
			 WHERE child_card_id = ? AND deleted_at IS NULL`,
			[childCardId],
		);
		return row?.parentCardId ?? null;
	}

	/**
	 * Children of `parentCardId` that still exist: an unlinked child, or a card
	 * the user deleted, drops out of the group so it cannot block completion.
	 */
	getLiveChildren(parentCardId: string): ChildCardLink[] {
		return this.db.query<ChildCardLink>(
			`SELECT cc.child_card_id AS childCardId,
				        cc.parent_card_id AS parentCardId,
				        cc.created_at AS createdAt,
				        cc.graduated_at AS graduatedAt
				 FROM card_children cc
				 JOIN cards c ON c.id = cc.child_card_id
				 WHERE cc.parent_card_id = ? AND cc.deleted_at IS NULL
				   AND c.deleted_at IS NULL
				 ORDER BY cc.created_at ASC, cc.child_card_id ASC`,
			[parentCardId],
		);
	}

	/**
	 * Parents with an open group, whether or not a child is still alive: a
	 * parent whose children were all deleted must be found to be restored.
	 */
	getParentIds(): string[] {
		return this.db
			.query<{ parentCardId: string }>(
				`SELECT DISTINCT cc.parent_card_id AS parentCardId
				 FROM card_children cc
				 JOIN cards p ON p.id = cc.parent_card_id
				 WHERE cc.deleted_at IS NULL AND p.deleted_at IS NULL`,
			)
			.map((row) => row.parentCardId);
	}

	/** Close the whole group of `parentCardId`. */
	unlinkParent(parentCardId: string, now = Date.now()): void {
		this.db.run(
			`UPDATE card_children SET deleted_at = ?, updated_at = ?
			 WHERE parent_card_id = ? AND deleted_at IS NULL`,
			[now, now, parentCardId],
		);
	}

	markGraduated(childCardId: string, now = Date.now()): void {
		this.db.run(
			`UPDATE card_children SET graduated_at = ?, updated_at = ?
			 WHERE child_card_id = ? AND deleted_at IS NULL AND graduated_at IS NULL`,
			[now, now, childCardId],
		);
	}

	getRawRowsModifiedSince(timestamp: number): ChildCardRow[] {
		return this.db.query<ChildCardRow>(
			`SELECT child_card_id, parent_card_id, created_at, graduated_at, deleted_at, updated_at
			 FROM card_children WHERE updated_at > ?`,
			[timestamp],
		);
	}

	/**
	 * Apply a row from another device when it is newer than the local one
	 * (or equal, with `preferRemoteOnEqual`). Returns whether a row changed.
	 */
	upsertRowFromRemote(row: ChildCardRow, preferRemoteOnEqual = false): boolean {
		this.db.run(
			`INSERT INTO card_children (child_card_id, parent_card_id, created_at, graduated_at, deleted_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(child_card_id) DO UPDATE SET
			   parent_card_id = excluded.parent_card_id,
			   created_at = excluded.created_at,
			   graduated_at = excluded.graduated_at,
			   deleted_at = excluded.deleted_at,
			   updated_at = excluded.updated_at
			 WHERE COALESCE(excluded.updated_at, 0) > COALESCE(card_children.updated_at, 0)
			    OR (? = 1 AND COALESCE(excluded.updated_at, 0) = COALESCE(card_children.updated_at, 0))`,
			[
				row.child_card_id,
				row.parent_card_id,
				row.created_at,
				row.graduated_at ?? null,
				row.deleted_at ?? null,
				row.updated_at ?? null,
				preferRemoteOnEqual ? 1 : 0,
			],
		);
		return this.db.getRowsModified() > 0;
	}
}
