import type { SqliteDatabase } from "../SqliteDatabase";

export interface ChildCardLink {
	childCardId: string;
	parentCardId: string;
	createdAt: number;
	/** Set when the child graduated; its cards stay until the group completes. */
	graduatedAt: number | null;
}

interface ChildCardRow {
	childCardId: string;
	parentCardId: string;
	createdAt: number;
	graduatedAt: number | null;
}

/**
 * Parent → child relations for "child cards": a suspended card studied through
 * one or more easier stand-ins.
 *
 * A child graduates on its own, but the parent only comes back once every live
 * child of that parent has graduated; then the children are deleted. Rows are
 * kept after deletion (`deleted_at`) so the history of a group is not lost when
 * a child is removed by hand.
 */
export class ChildCardActions {
	constructor(private db: SqliteDatabase) {}

	/** Attach `childCardId` to `parentCardId`, replacing any previous parent. */
	link(childCardId: string, parentCardId: string, now = Date.now()): void {
		this.db.run(
			`INSERT INTO card_children (child_card_id, parent_card_id, created_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT(child_card_id) DO UPDATE SET
			   parent_card_id = excluded.parent_card_id,
			   created_at = excluded.created_at,
			   graduated_at = NULL,
			   deleted_at = NULL`,
			[childCardId, parentCardId, now],
		);
	}

	/** Stop treating the child as part of a group. */
	unlink(childCardId: string, now = Date.now()): void {
		this.db.run(
			`UPDATE card_children SET deleted_at = ? WHERE child_card_id = ? AND deleted_at IS NULL`,
			[now, childCardId],
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
		return this.db
			.query<ChildCardRow>(
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
			)
			.map((row) => ({ ...row }));
	}

	/** Parents that still have at least one live child. */
	getParentIds(): string[] {
		return this.db
			.query<{ parentCardId: string }>(
				`SELECT DISTINCT cc.parent_card_id AS parentCardId
				 FROM card_children cc
				 JOIN cards c ON c.id = cc.child_card_id
				 WHERE cc.deleted_at IS NULL AND c.deleted_at IS NULL`,
			)
			.map((row) => row.parentCardId);
	}

	markGraduated(childCardId: string, now = Date.now()): void {
		this.db.run(
			`UPDATE card_children SET graduated_at = ?
			 WHERE child_card_id = ? AND deleted_at IS NULL AND graduated_at IS NULL`,
			[now, childCardId],
		);
	}
}
