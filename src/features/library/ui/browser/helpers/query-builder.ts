import { State } from "ts-fsrs";
import type { FilterState, PropFilter, SortConfig, StateFilterValue } from "../types";

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
	r: "stability", // retrievability computed from stability; approximate filter
	ivl: "scheduled_days",
	reps: "reps",
	lapses: "lapses",
};

const ALLOWED_SORT_COLUMNS = new Set([
	"question",
	"answer",
	"state",
	"due",
	"stability",
	"difficulty",
	"reps",
	"lapses",
	"scheduled_days",
	"created_at",
	"last_review",
	"card_type",
	"source_uid",
	"created_via",
]);

export function buildBrowserQuery(
	filter: FilterState,
	sort: SortConfig,
	limit: number,
	offset: number,
): SqlQuery {
	const conditions: string[] = ["deleted_at IS NULL", "question IS NOT NULL"];
	const params: (string | number)[] = [];

	// State filters
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

	// Build state condition with OR logic for suspended/buried
	const stateConditions: string[] = [];

	if (stateNumbers.length > 0) {
		const placeholders = stateNumbers.map(() => "?").join(",");
		stateConditions.push(`(state IN (${placeholders}) AND suspended = 0)`);
		params.push(...stateNumbers);
	}

	if (wantSuspended) {
		stateConditions.push("suspended = 1");
	}

	if (wantBuried) {
		stateConditions.push("(buried_until IS NOT NULL AND buried_until > datetime('now'))");
	}

	if (stateConditions.length > 0) {
		conditions.push(`(${stateConditions.join(" OR ")})`);
	}

	// Negated states
	for (const s of filter.negatedStates) {
		const mapped = STATE_MAP[s];
		if (mapped === "suspended") {
			conditions.push("suspended = 0");
		} else if (mapped === "buried") {
			conditions.push("(buried_until IS NULL OR buried_until <= datetime('now'))");
		} else {
			conditions.push("state != ?");
			params.push(mapped);
		}
	}

	// Text search (LIKE for Phase 1)
	if (filter.textSearch) {
		conditions.push("(question LIKE ? OR answer LIKE ?)");
		const pattern = `%${filter.textSearch}%`;
		params.push(pattern, pattern);
	}

	// Source UIDs (note names resolved to UIDs by the service layer)
	if (filter.sourceUids.length > 0) {
		const placeholders = filter.sourceUids.map(() => "?").join(",");
		conditions.push(`source_uid IN (${placeholders})`);
		params.push(...filter.sourceUids);
	}

	// Card types
	if (filter.cardTypes.length > 0) {
		const placeholders = filter.cardTypes.map(() => "?").join(",");
		conditions.push(`card_type IN (${placeholders})`);
		params.push(...filter.cardTypes);
	}

	// Created via
	if (filter.createdVia.length > 0) {
		const placeholders = filter.createdVia.map(() => "?").join(",");
		conditions.push(`created_via IN (${placeholders})`);
		params.push(...filter.createdVia);
	}

	// Property filters
	for (const pf of filter.propFilters) {
		const column = PROP_TO_COLUMN[pf.property];
		if (!column) continue;
		conditions.push(`${column} ${pf.operator} ?`);
		params.push(pf.value);
	}

	// Date filters
	if (filter.addedDaysAgo != null) {
		const cutoff = Date.now() - filter.addedDaysAgo * 86_400_000;
		conditions.push("created_at >= ?");
		params.push(cutoff);
	}

	if (filter.reviewedDaysAgo != null) {
		const cutoff = new Date(
			Date.now() - filter.reviewedDaysAgo * 86_400_000,
		).toISOString();
		conditions.push("last_review >= ?");
		params.push(cutoff);
	}

	// Sort - whitelist to prevent SQL injection
	const sortColumn = ALLOWED_SORT_COLUMNS.has(sort.column)
		? sort.column
		: "due";
	const sortDir = sort.direction === "desc" ? "DESC" : "ASC";

	return {
		where: conditions.join(" AND "),
		params,
		orderBy: `${sortColumn} ${sortDir}`,
		limit,
		offset,
	};
}
