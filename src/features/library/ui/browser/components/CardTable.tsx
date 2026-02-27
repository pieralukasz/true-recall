import { useSignal } from "@preact/signals";
import { Clickable } from "@shared/ui/components";
import type { RefObject } from "preact";
import { useCallback, useMemo, useRef } from "preact/hooks";
import { ALL_COLUMNS, type ColumnDef } from "../helpers/column-defs";
import type { BrowserCard, SortConfig } from "../types";
import { CardRow } from "./CardRow";

const ROW_HEIGHT = 36;
const OVERSCAN = 5;

interface CardTableProps {
	cards: BrowserCard[];
	sort: SortConfig;
	onSort: (column: string) => void;
	selectedIds: Set<string>;
	onSelect: (
		cardId: string,
		event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
	) => void;
	onPreview: (card: BrowserCard) => void;
	previewCardId: string | null;
	visibleColumns: string[];
	scrollContainerRef: RefObject<HTMLDivElement>;
}

export function CardTable({
	cards,
	sort,
	onSort,
	selectedIds,
	onSelect,
	onPreview,
	previewCardId,
	visibleColumns,
}: CardTableProps) {
	const scrollTop = useSignal(0);
	const containerRef = useRef<HTMLDivElement>(null);

	const columns = useMemo(
		() =>
			ALL_COLUMNS.filter((col) => visibleColumns.includes(col.key)),
		[visibleColumns],
	);

	const gridTemplate = useMemo(
		() => columns.map((c) => c.width).join(" "),
		[columns],
	);

	const totalHeight = cards.length * ROW_HEIGHT;

	const virtualItems = useMemo(() => {
		const containerHeight = containerRef.current?.clientHeight ?? 600;
		const start = Math.floor(Math.max(0, scrollTop.value) / ROW_HEIGHT);
		const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);
		const from = Math.max(0, start - OVERSCAN);
		const to = Math.min(cards.length, start + visibleCount + OVERSCAN);

		const result: { card: BrowserCard; index: number; top: number }[] = [];
		for (let i = from; i < to; i++) {
			const card = cards[i];
			if (card) result.push({ card, index: i, top: i * ROW_HEIGHT });
		}
		return result;
	}, [cards, scrollTop.value]);

	const handleScroll = useCallback((e: Event) => {
		scrollTop.value = (e.currentTarget as HTMLDivElement).scrollTop;
	}, []);

	if (cards.length === 0) {
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full ep:text-obs-muted ep:text-sm">
				No cards match your filters
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			{/* Header */}
			<div
				class="ep:grid ep:items-center ep:px-3 ep:h-8 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:shrink-0 ep:text-[11px] ep:font-medium ep:text-obs-muted ep:uppercase ep:tracking-wider"
				style={{ gridTemplateColumns: gridTemplate }}
			>
				{columns.map((col) => (
					<TableHeader
						key={col.key}
						column={col}
						sort={sort}
						onSort={onSort}
					/>
				))}
			</div>

			{/* Virtual scroll body */}
			<div
				ref={containerRef}
				class="ep:flex-1 ep:overflow-y-auto ep:relative"
				onScroll={handleScroll}
			>
				<div
					style={{ height: `${totalHeight}px`, position: "relative" }}
				>
					{virtualItems.map(({ card, top }) => (
						<CardRow
							key={card.id}
							card={card}
							columns={columns}
							gridTemplate={gridTemplate}
							top={top}
							selected={selectedIds.has(card.id)}
							previewing={previewCardId === card.id}
							onSelect={onSelect}
							onPreview={onPreview}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function TableHeader({
	column,
	sort,
	onSort,
}: {
	column: ColumnDef;
	sort: SortConfig;
	onSort: (column: string) => void;
}) {
	const isActive = sort.column === column.sqlColumn;

	if (!column.sortable) {
		return (
			<div
				class="ep:px-1.5 ep:truncate"
				style={{ textAlign: column.align }}
			>
				{column.label}
			</div>
		);
	}

	return (
		<Clickable
			class={`ep:px-1.5 ep:truncate ep:flex ep:items-center ep:gap-0.5 ep:cursor-pointer hover:ep:text-obs-normal ${
				isActive ? "ep:text-obs-normal" : ""
			}`}
			style={{
				justifyContent:
					column.align === "right" ? "flex-end" : "flex-start",
			}}
			onClick={() => onSort(column.sqlColumn)}
		>
			{column.label}
			{isActive && (
				<span class="ep:text-[9px]">
					{sort.direction === "asc" ? "\u25B2" : "\u25BC"}
				</span>
			)}
		</Clickable>
	);
}
