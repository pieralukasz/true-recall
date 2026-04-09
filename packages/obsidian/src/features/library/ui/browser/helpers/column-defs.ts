import { State } from "ts-fsrs";

import type { BrowserCard } from "../types";

export interface ColumnDef {
	key: string;
	label: string;
	/** SQL column name for ORDER BY */
	sqlColumn: string;
	width: string;
	sortable: boolean;
	defaultVisible: boolean;
	align: "left" | "center" | "right";
	/** Get display value from a card */
	accessor: (card: BrowserCard) => string;
}

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

function formatRelativeDate(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const diffMs = date.getTime() - now.getTime();
	const diffDays = Math.round(diffMs / 86_400_000);

	if (diffDays < -365) return `${Math.round(-diffDays / 365)}y ago`;
	if (diffDays < -30) return `${Math.round(-diffDays / 30)}mo ago`;
	if (diffDays < -1) return `${-diffDays}d ago`;
	if (diffDays < 0) return "yesterday";
	if (diffDays === 0) {
		const diffHours = Math.round(diffMs / 3_600_000);
		if (diffHours < 0) return "overdue";
		if (diffHours === 0) {
			const diffMin = Math.round(diffMs / 60_000);
			if (diffMin <= 0) return "now";
			return `${diffMin}m`;
		}
		return `${diffHours}h`;
	}
	if (diffDays === 1) return "tomorrow";
	if (diffDays < 30) return `${diffDays}d`;
	if (diffDays < 365) return `${Math.round(diffDays / 30)}mo`;
	return `${Math.round(diffDays / 365)}y`;
}

function formatStability(days: number): string {
	if (days === 0) return "0";
	if (days < 1) return `${Math.round(days * 24)}h`;
	if (days < 30) return `${Math.round(days)}d`;
	if (days < 365) return `${(days / 30).toFixed(1)}mo`;
	return `${(days / 365).toFixed(1)}y`;
}

function formatTimestamp(ms: number | null): string {
	if (!ms) return "-";
	return new Date(ms).toLocaleDateString();
}

export const ALL_COLUMNS: ColumnDef[] = [
	{
		key: "question",
		label: "Question",
		sqlColumn: "question",
		width: "1fr",
		sortable: true,
		defaultVisible: true,
		align: "left",
		accessor: (c) => c.question,
	},
	{
		key: "state",
		label: "State",
		sqlColumn: "state",
		width: "80px",
		sortable: true,
		defaultVisible: true,
		align: "center",
		accessor: (c) => {
			if (c.suspended) return "Suspended";
			if (c.buriedUntil && new Date(c.buriedUntil) > new Date())
				return "Buried";
			return STATE_LABELS[c.state] ?? "Unknown";
		},
	},
	{
		key: "due",
		label: "Due",
		sqlColumn: "due",
		width: "80px",
		sortable: true,
		defaultVisible: true,
		align: "right",
		accessor: (c) => formatRelativeDate(c.due),
	},
	{
		key: "stability",
		label: "Stability",
		sqlColumn: "stability",
		width: "80px",
		sortable: true,
		defaultVisible: true,
		align: "right",
		accessor: (c) => formatStability(c.stability),
	},
	{
		key: "sourceNote",
		label: "Note",
		sqlColumn: "source_uid",
		width: "140px",
		sortable: true,
		defaultVisible: true,
		align: "left",
		accessor: (c) => c.sourceNoteName ?? "(orphaned)",
	},
	{
		key: "reps",
		label: "Reps",
		sqlColumn: "reps",
		width: "60px",
		sortable: true,
		defaultVisible: true,
		align: "right",
		accessor: (c) => String(c.reps),
	},
	{
		key: "answer",
		label: "Answer",
		sqlColumn: "answer",
		width: "1fr",
		sortable: true,
		defaultVisible: false,
		align: "left",
		accessor: (c) => c.answer,
	},
	{
		key: "difficulty",
		label: "Difficulty",
		sqlColumn: "difficulty",
		width: "80px",
		sortable: true,
		defaultVisible: false,
		align: "right",
		accessor: (c) => c.difficulty.toFixed(2),
	},
	{
		key: "lapses",
		label: "Lapses",
		sqlColumn: "lapses",
		width: "60px",
		sortable: true,
		defaultVisible: false,
		align: "right",
		accessor: (c) => String(c.lapses),
	},
	{
		key: "interval",
		label: "Interval",
		sqlColumn: "scheduled_days",
		width: "80px",
		sortable: true,
		defaultVisible: false,
		align: "right",
		accessor: (c) => formatStability(c.scheduledDays),
	},
	{
		key: "created",
		label: "Created",
		sqlColumn: "created_at",
		width: "90px",
		sortable: true,
		defaultVisible: false,
		align: "right",
		accessor: (c) => formatTimestamp(c.createdAt),
	},
	{
		key: "lastReview",
		label: "Last Review",
		sqlColumn: "last_review",
		width: "90px",
		sortable: true,
		defaultVisible: false,
		align: "right",
		accessor: (c) =>
			c.lastReview ? formatRelativeDate(c.lastReview) : "never",
	},
	{
		key: "cardType",
		label: "Type",
		sqlColumn: "card_type",
		width: "80px",
		sortable: true,
		defaultVisible: false,
		align: "center",
		accessor: (c) => c.cardType,
	},
	{
		key: "createdVia",
		label: "Created Via",
		sqlColumn: "created_via",
		width: "90px",
		sortable: true,
		defaultVisible: false,
		align: "center",
		accessor: (c) => c.createdVia ?? "manual",
	},
	{
		key: "preset",
		label: "Preset",
		sqlColumn: "",
		width: "100px",
		sortable: false,
		defaultVisible: false,
		align: "left",
		accessor: (c) => c.presetName ?? "Default",
	},
];

export const DEFAULT_VISIBLE_KEYS = ALL_COLUMNS.filter(
	(c) => c.defaultVisible,
).map((c) => c.key);

export function getColumnByKey(key: string): ColumnDef | undefined {
	return ALL_COLUMNS.find((c) => c.key === key);
}
