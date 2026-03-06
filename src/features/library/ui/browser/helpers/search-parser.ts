import {
	EMPTY_FILTER,
	type FilterState,
	type PropFilter,
	type StateFilterValue,
} from "../types";

const VALID_STATES: StateFilterValue[] = [
	"new",
	"learning",
	"review",
	"relearning",
	"suspended",
	"buried",
];

const PROP_ALIASES: Record<string, PropFilter["property"]> = {
	s: "s",
	stability: "s",
	d: "d",
	difficulty: "d",
	r: "r",
	retrievability: "r",
	ivl: "ivl",
	interval: "ivl",
	reps: "reps",
	lapses: "lapses",
};

const VALID_OPERATORS = [">=", "<=", ">", "<"] as const;

/**
 * Parse a search query string into a structured FilterState.
 *
 * Supported tokens:
 * - is:new, is:learning, is:review, is:relearning, is:suspended, is:buried
 * - is:due, is:overdue (maps to state filters)
 * - -is:suspended (negation)
 * - prop:s>21, prop:d<0.5, prop:reps>=10
 * - note:"Biology", project:"Med School", preset:"Hard Mode"
 * - type:cloze, type:basic, type:reversed, type:image-occlusion
 * - via:ai, via:manual, via:anki_import
 * - added:7, reviewed:30
 * - "exact phrase" or plain text
 */
export function parseSearchQuery(input: string): FilterState {
	const filter: FilterState = {
		...EMPTY_FILTER,
		states: [],
		negatedStates: [],
		propFilters: [],
		sourceUids: [],
		cardTypes: [],
		createdVia: [],
		presetNames: [],
		projects: [],
	};
	if (!input.trim()) return filter;

	const tokens = tokenize(input);
	const textParts: string[] = [];

	for (const token of tokens) {
		const negated = token.startsWith("-");
		const raw = negated ? token.slice(1) : token;

		if (raw.startsWith("is:")) {
			const value = raw.slice(3).toLowerCase();
			if (value === "due" || value === "overdue") {
				// Special pseudo-states handled as prop filters
				if (value === "overdue") {
					filter.propFilters.push({
						property: "ivl",
						operator: ">",
						value: -1,
					});
				}
				if (!negated) {
					filter.states.push("review");
				} else {
					filter.negatedStates.push("review");
				}
			} else if (VALID_STATES.includes(value as StateFilterValue)) {
				if (negated) {
					filter.negatedStates.push(value as StateFilterValue);
				} else {
					filter.states.push(value as StateFilterValue);
				}
			}
		} else if (raw.startsWith("prop:")) {
			const propFilter = parsePropFilter(raw.slice(5));
			if (propFilter) filter.propFilters.push(propFilter);
		} else if (raw.startsWith("note:")) {
			const val = unquote(raw.slice(5));
			if (val) filter.sourceUids.push(val);
		} else if (raw.startsWith("project:")) {
			const val = unquote(raw.slice(8));
			if (val) filter.projects.push(val);
		} else if (raw.startsWith("preset:")) {
			const val = unquote(raw.slice(7));
			if (val) filter.presetNames.push(val);
		} else if (raw.startsWith("type:")) {
			const val = raw.slice(5).toLowerCase();
			if (["basic", "cloze", "reversed", "image-occlusion"].includes(val)) {
				filter.cardTypes.push(val as FilterState["cardTypes"][number]);
			}
		} else if (raw.startsWith("via:")) {
			const val = raw.slice(4).toLowerCase();
			if (["ai", "manual", "anki_import"].includes(val)) {
				filter.createdVia.push(val);
			}
		} else if (raw.startsWith("added:")) {
			const days = parseInt(raw.slice(6), 10);
			if (!Number.isNaN(days) && days > 0) filter.addedDaysAgo = days;
		} else if (raw.startsWith("reviewed:")) {
			const days = parseInt(raw.slice(9), 10);
			if (!Number.isNaN(days) && days > 0) filter.reviewedDaysAgo = days;
		} else {
			textParts.push(unquote(token));
		}
	}

	filter.textSearch = textParts.join(" ").trim();
	return filter;
}

function parsePropFilter(raw: string): PropFilter | null {
	for (const op of VALID_OPERATORS) {
		const idx = raw.indexOf(op);
		if (idx === -1) continue;

		const propName = raw.slice(0, idx);
		const valueStr = raw.slice(idx + op.length);
		const property = PROP_ALIASES[propName];
		const value = parseFloat(valueStr);

		if (property && !Number.isNaN(value)) {
			return { property, operator: op, value };
		}
		break;
	}
	return null;
}

/**
 * Split input into tokens, respecting quoted strings.
 * "hello world" is:new → ["hello world", "is:new"]
 */
function tokenize(input: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let inQuotes = false;
	let quoteChar = "";

	for (let i = 0; i < input.length; i++) {
		const ch = input[i]!;

		if (inQuotes) {
			if (ch === quoteChar) {
				inQuotes = false;
				tokens.push(current);
				current = "";
			} else {
				current += ch;
			}
		} else if (ch === '"' || ch === "'") {
			if (current) {
				// Handle cases like note:"Biology" - keep prefix attached
				inQuotes = true;
				quoteChar = ch;
			} else {
				inQuotes = true;
				quoteChar = ch;
			}
		} else if (ch === " " || ch === "\t") {
			if (current) {
				tokens.push(current);
				current = "";
			}
		} else {
			current += ch;
		}
	}

	if (current) tokens.push(current);
	return tokens;
}

function unquote(s: string): string {
	if (
		(s.startsWith('"') && s.endsWith('"')) ||
		(s.startsWith("'") && s.endsWith("'"))
	) {
		return s.slice(1, -1);
	}
	return s;
}
