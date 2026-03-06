import { FSRS_COLORS, MUTED_STATES } from "@shared/ui/helpers/fsrs-colors";
import { stripMarkdownSyntax } from "@shared/utils";
import { State } from "ts-fsrs";
import type { ColumnDef } from "../helpers/column-defs";
import type { BrowserCard } from "../types";

const STATE_BADGE_CLS: Record<string, string> = {
	[State.New]: FSRS_COLORS.new.badgeCls,
	[State.Learning]: FSRS_COLORS.learning.badgeCls,
	[State.Review]: FSRS_COLORS.review.badgeCls,
	[State.Relearning]: FSRS_COLORS.relearning.badgeCls,
	suspended: FSRS_COLORS.suspended.badgeCls,
	buried: MUTED_STATES.buried.badgeCls,
};

interface CardRowProps {
	card: BrowserCard;
	columns: ColumnDef[];
	gridTemplate: string;
	top: number;
	selected: boolean;
	previewing: boolean;
	onSelect: (
		cardId: string,
		event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
	) => void;
	onPreview: (card: BrowserCard) => void;
}

export function CardRow({
	card,
	columns,
	gridTemplate,
	top,
	selected,
	previewing,
	onSelect,
	onPreview,
}: CardRowProps) {
	const rowCls = [
		"ep:grid ep:items-center ep:px-3 ep:h-9 ep:text-ui-small ep:cursor-pointer ep:border-b ep:border-obs-border/50",
		"hover:ep:bg-obs-modifier-hover ep:transition-colors",
		selected
			? "ep:bg-obs-interactive/10"
			: previewing
				? "ep:bg-obs-modifier-hover/50"
				: "",
	].join(" ");

	return (
		<div
			class={rowCls}
			style={{
				gridTemplateColumns: gridTemplate,
				position: "absolute",
				top: `${top}px`,
				left: 0,
				right: 0,
				height: "36px",
			}}
			onClick={(e) => {
				if (e.ctrlKey || e.metaKey || e.shiftKey) {
					onSelect(card.id, {
						shiftKey: e.shiftKey,
						ctrlKey: e.ctrlKey,
						metaKey: e.metaKey,
					});
				} else {
					onPreview(card);
				}
			}}
			onContextMenu={(e) => {
				e.preventDefault();
				onSelect(card.id, { ctrlKey: true });
			}}
		>
			{columns.map((col) => (
				<CellRenderer key={col.key} column={col} card={card} />
			))}
		</div>
	);
}

function CellRenderer({
	column,
	card,
}: {
	column: ColumnDef;
	card: BrowserCard;
}) {
	const value = column.accessor(card);

	if (column.key === "state") {
		const badgeKey = card.suspended
			? "suspended"
			: card.buriedUntil && new Date(card.buriedUntil) > new Date()
				? "buried"
				: String(card.state);
		const cls = STATE_BADGE_CLS[badgeKey] ?? MUTED_STATES.unknown.badgeCls;

		return (
			<div class="ep:flex ep:justify-center">
				<span
					class={`ep:px-1.5 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ${cls}`}
				>
					{value}
				</span>
			</div>
		);
	}

	if (column.key === "question" || column.key === "answer") {
		return (
			<div class="ep:px-1.5 ep:truncate ep:text-obs-normal" title={value}>
				{stripMarkdownSyntax(value)}
			</div>
		);
	}

	return (
		<div
			class="ep:px-1.5 ep:truncate ep:text-obs-muted"
			style={{ textAlign: column.align }}
		>
			{value}
		</div>
	);
}
