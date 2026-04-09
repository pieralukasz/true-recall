import { State } from "ts-fsrs";

import { MS_PER_DAY } from "@true-recall/core/constants";
import { escapeFts5Query } from "@true-recall/core/persistence/sqlite/modules/NoteActions";
import { sqlPlaceholders } from "@true-recall/core/persistence/sqlite/sql-utils";
import type {
	FilterState,
	PropFilter,
	SortConfig,
	StateFilterValue,
} from "@true-recall/core/types/browser.types";
import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	BUILTIN_NOTE_REVIEW_ID,
} from "@true-recall/core/types/note.types";

export interface SqlQuery {
	where: string;
	params: (string | number)[];
	orderBy: string;
	limit: number;
	offset: number;
}

const STATE_MAP: Record<StateFilterValue, number | "suspended" | "buried"> = {
	new: State.New,
	learning: State.Learning,
	review: State.Review,
	relearning: State.Relearning,
	suspended: "suspended",
	buried: "buried",
};

const PROP_TO_COLUMN: Record<PropFilter["property"], string> = {
	s: "stability",
	d: "difficulty",
	r: "stability",
	ivl: "scheduled_days",
	reps: "reps",
	lapses: "lapses",
};

const SORT_COLUMN: Record<string, string> = {
	question: "n.fields_json",
	answer: "n.fields_json",
	state: "c.state",
	due: "c.due",
	stability: "c.stability",
	difficulty: "c.difficulty",
	reps: "c.reps",
	lapses: "c.lapses",
	scheduled_days: "c.scheduled_days",
	created_at: "c.created_at",
	last_review: "c.last_review",
	card_type: "nt.type",
	source_uid: "c.source_uid",
	created_via: "n.created_via",
};

export interface BuildQueryOptions {
	fts5Available?: boolean;
}

export function buildBrowserQuery(
	filter: FilterState,
	sort: SortConfig,
	limit: number,
	offset: number,
	options?: BuildQueryOptions,
): SqlQuery {
	const params: (string | number)[] = [];

	const conditions: string[] = ["c.deleted_at IS NULL"];

	// ── State filters ────────────────────────────────────────
	const stateNumbers: number[] = [];
	let wantSuspended = false;
	let wantBuried = false;

	for (const s of filter.states) {
		const mapped = STATE_MAP[s];
		if (mapped === "suspended") {
			wantSuspended = true;
		} else if (mapped === "buried") {
			wantBuried = true;
		} else {
			stateNumbers.push(mapped);
		}
	}

	const stateConditions: string[] = [];
	const col = "c.";

	if (stateNumbers.length > 0) {
		stateConditions.push(
			`(${col}state IN (${sqlPlaceholders(stateNumbers.length)}) AND ${col}suspended = 0)`,
		);
		params.push(...stateNumbers);
	}

	if (wantSuspended) {
		stateConditions.push(`${col}suspended = 1`);
	}

	if (wantBuried) {
		stateConditions.push(
			`(${col}buried_until IS NOT NULL AND ${col}buried_until > datetime('now'))`,
		);
	}

	if (stateConditions.length > 0) {
		conditions.push(`(${stateConditions.join(" OR ")})`);
	}

	// ── Negated states ───────────────────────────────────────
	for (const s of filter.negatedStates) {
		const mapped = STATE_MAP[s];
		if (mapped === "suspended") {
			conditions.push(`${col}suspended = 0`);
		} else if (mapped === "buried") {
			conditions.push(
				`(${col}buried_until IS NULL OR ${col}buried_until <= datetime('now'))`,
			);
		} else {
			conditions.push(`${col}state != ?`);
			params.push(mapped);
		}
	}

	// ── Text search ──────────────────────────────────────────
	if (filter.textSearch) {
		if (options?.fts5Available) {
			conditions.push(
				"n.rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)",
			);
			params.push(escapeFts5Query(filter.textSearch));
		} else {
			conditions.push("n.fields_json LIKE ?");
			params.push(`%${filter.textSearch}%`);
		}
	}

	// ── Source UIDs ──────────────────────────────────────────
	if (filter.sourceUids.length > 0) {
		conditions.push(
			`${col}source_uid IN (${sqlPlaceholders(filter.sourceUids.length)})`,
		);
		params.push(...filter.sourceUids);
	}

	// ── Card types ───────────────────────────────────────────
	if (filter.cardTypes.length > 0) {
		const typeConditions: string[] = [];
		for (const ct of filter.cardTypes) {
			switch (ct) {
				case "basic":
					typeConditions.push(
						`(nt.type = 0 AND c.template_ord = 0 AND nt.id != ?)`,
					);
					params.push(BUILTIN_IMAGE_OCCLUSION_ID);
					break;
				case "reversed":
					typeConditions.push(
						`(nt.type = 0 AND c.template_ord > 0 AND nt.id != ?)`,
					);
					params.push(BUILTIN_IMAGE_OCCLUSION_ID);
					break;
				case "cloze":
					typeConditions.push("(nt.type = 1)");
					break;
				case "image-occlusion":
					typeConditions.push("(nt.id = ?)");
					params.push(BUILTIN_IMAGE_OCCLUSION_ID);
					break;
				case "note-review":
					typeConditions.push("(nt.id = ?)");
					params.push(BUILTIN_NOTE_REVIEW_ID);
					break;
			}
		}
		if (typeConditions.length > 0) {
			conditions.push(`(${typeConditions.join(" OR ")})`);
		}
	}

	// ── Created via ──────────────────────────────────────────
	if (filter.createdVia.length > 0) {
		conditions.push(
			`n.created_via IN (${sqlPlaceholders(filter.createdVia.length)})`,
		);
		params.push(...filter.createdVia);
	}

	// ── Property filters ─────────────────────────────────────
	for (const pf of filter.propFilters) {
		const column = PROP_TO_COLUMN[pf.property];
		if (!column) continue;
		conditions.push(`${col}${column} ${pf.operator} ?`);
		params.push(pf.value);
	}

	// ── Date filters ─────────────────────────────────────────
	if (filter.addedDaysAgo != null) {
		const cutoff = Date.now() - filter.addedDaysAgo * MS_PER_DAY;
		conditions.push(`${col}created_at >= ?`);
		params.push(cutoff);
	}

	if (filter.reviewedDaysAgo != null) {
		const cutoff = new Date(
			Date.now() - filter.reviewedDaysAgo * MS_PER_DAY,
		).toISOString();
		conditions.push(`${col}last_review >= ?`);
		params.push(cutoff);
	}

	// ── Sort ─────────────────────────────────────────────────
	const sortColumn = SORT_COLUMN[sort.column] ?? "c.due";
	const sortDir = sort.direction === "desc" ? "DESC" : "ASC";

	return {
		where: conditions.join(" AND "),
		params,
		orderBy: `${sortColumn} ${sortDir}`,
		limit,
		offset,
	};
}
