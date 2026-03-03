import type { CardType } from "@shared/types";
import type { State } from "ts-fsrs";

/** Flattened card row optimized for table display */
export interface BrowserCard {
	id: string;
	question: string;
	answer: string;
	state: State;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	scheduledDays: number;
	lastReview: string | null;
	createdAt: number | null;
	suspended: boolean;
	buriedUntil: string | null;
	sourceUid: string | null;
	sourceNoteName: string | null;
	sourceNotePath: string | null;
	cardType: CardType;
	createdVia: string | null;
	presetName: string | null;
	projects: string[];
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
	column: string;
	direction: SortDirection;
}

export type StateFilterValue =
	| "new"
	| "learning"
	| "review"
	| "relearning"
	| "suspended"
	| "buried";

export interface FilterState {
	states: StateFilterValue[];
	textSearch: string;
	sourceUids: string[];
	cardTypes: CardType[];
	createdVia: string[];
	presetNames: string[];
	projects: string[];
	/** Property filters like prop:s>21 */
	propFilters: PropFilter[];
	/** Date filters like added:7 */
	addedDaysAgo: number | null;
	reviewedDaysAgo: number | null;
	/** Negated states (prefixed with -) */
	negatedStates: StateFilterValue[];
	/** When true, show cards from archived notes/projects. Default false. */
	showArchived?: boolean;
}

export interface PropFilter {
	property: "s" | "d" | "r" | "ivl" | "reps" | "lapses";
	operator: ">" | "<" | ">=" | "<=";
	value: number;
}

export interface BrowserQuery {
	filter: FilterState;
	sort: SortConfig;
	limit: number;
	offset: number;
}

export interface BrowserResult {
	cards: BrowserCard[];
	totalCount: number;
}

export interface SidebarSection {
	key: string;
	label: string;
	items: SidebarItem[];
	collapsed: boolean;
}

export interface SidebarItem {
	label: string;
	count: number;
	filterValue: string;
	active: boolean;
}

export const EMPTY_FILTER: FilterState = {
	states: [],
	textSearch: "",
	sourceUids: [],
	cardTypes: [],
	createdVia: [],
	presetNames: [],
	projects: [],
	propFilters: [],
	addedDaysAgo: null,
	reviewedDaysAgo: null,
	negatedStates: [],
};
