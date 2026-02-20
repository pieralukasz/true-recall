import {
	formatDueDate,
	formatIntervalDays,
	truncateText,
} from "@features/library/ui/browser/helpers/browser-helpers";
import type { FSRSFlashcardItem } from "@shared/types";
import { StateBadge } from "@shared/ui/components";

export interface ColumnDef {
	key: string;
	label: string;
	width: string;
	sortable?: boolean;
	align?: "left" | "right";
	render: (card: FSRSFlashcardItem) => preact.ComponentChildren;
}

export const COLUMNS: ColumnDef[] = [
	{
		key: "question",
		label: "Question",
		width: "minmax(150px, 2fr)",
		sortable: true,
		render: (card) => truncateText(card.question, 80),
	},
	{
		key: "answer",
		label: "Answer",
		width: "minmax(120px, 1.5fr)",
		sortable: true,
		render: (card) => truncateText(card.answer, 60),
	},
	{
		key: "state",
		label: "State",
		width: "85px",
		sortable: true,
		render: (card) => (
			<StateBadge
				state={card.fsrs.state}
				suspended={card.fsrs.suspended}
				buriedUntil={card.fsrs.buriedUntil}
				size="sm"
			/>
		),
	},
	{
		key: "due",
		label: "Due",
		width: "90px",
		sortable: true,
		render: (card) => formatDueDate(card.fsrs.due),
	},
	{
		key: "interval",
		label: "Interval",
		width: "70px",
		sortable: true,
		align: "right",
		render: (card) => formatIntervalDays(card.fsrs.scheduledDays),
	},
	{
		key: "lapses",
		label: "Lapses",
		width: "60px",
		sortable: true,
		align: "right",
		render: (card) => String(card.fsrs.lapses),
	},
	{
		key: "stability",
		label: "Stab.",
		width: "65px",
		sortable: true,
		align: "right",
		render: (card) =>
			card.fsrs.stability > 0 ? card.fsrs.stability.toFixed(1) : "-",
	},
	{
		key: "difficulty",
		label: "Diff.",
		width: "60px",
		sortable: true,
		align: "right",
		render: (card) => card.fsrs.difficulty.toFixed(1),
	},
	{
		key: "source",
		label: "Source",
		width: "minmax(100px, 1fr)",
		sortable: true,
		render: (card) => (
			<span class="ep:truncate">{card.sourceNoteName ?? "-"}</span>
		),
	},
];
