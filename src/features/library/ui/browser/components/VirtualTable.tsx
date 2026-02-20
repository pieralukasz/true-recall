import type { ColumnDef } from "@features/library/ui/browser/components/browser-columns";
import type { BrowserSortColumn, SelectionMode } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import { useIcon } from "@shared/ui/preact/hooks";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

const ROW_HEIGHT = 36;
const BUFFER_SIZE = 10;

export interface VirtualTableProps {
	data: FSRSFlashcardItem[];
	columns: ColumnDef[];
	selectionMode: SelectionMode;
	selectedIds: Set<string>;
	activeItemId: string | null;
	sortColumn: BrowserSortColumn;
	sortDirection: "asc" | "desc";
	onRowClick: (card: FSRSFlashcardItem) => void;
	onRowSelect: (cardId: string) => void;
	onSortChange: (column: string) => void;
	onSelectAll: () => void;
}

export function VirtualTable({
	data,
	columns,
	selectionMode,
	selectedIds,
	activeItemId,
	sortColumn,
	sortDirection,
	onRowClick,
	onRowSelect,
	onSortChange,
	onSelectAll,
}: VirtualTableProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [containerHeight, setContainerHeight] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		setContainerHeight(el.clientHeight);

		const onScroll = () => setScrollTop(el.scrollTop);
		el.addEventListener("scroll", onScroll);

		const ro = new ResizeObserver(() => {
			setContainerHeight(el.clientHeight);
		});
		ro.observe(el);

		return () => {
			el.removeEventListener("scroll", onScroll);
			ro.disconnect();
		};
	}, []);

	const gridTemplate = useMemo(() => {
		const checkboxCol = "32px";
		const cols = columns.map((c) => c.width);
		return [checkboxCol, ...cols].join(" ");
	}, [columns]);

	const totalHeight = data.length * ROW_HEIGHT;
	const startIndex = Math.max(
		0,
		Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE,
	);
	const endIndex = Math.min(
		data.length,
		Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_SIZE,
	);
	const visibleItems = data.slice(startIndex, endIndex);

	const allSelected = useMemo(
		() => data.length > 0 && data.every((c) => selectedIds.has(c.id)),
		[data, selectedIds],
	);

	const sortDirIcon = useIcon(
		sortDirection === "asc" ? "arrow-up" : "arrow-down",
	);

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0 ep:overflow-x-auto">
			{/* Header */}
			<div class="ep:shrink-0 ep:border-b ep:border-obs-border ep:bg-obs-secondary">
				<div
					class="ep:grid ep:items-center ep:min-w-max"
					style={{
						gridTemplateColumns: gridTemplate,
						height: `${ROW_HEIGHT}px`,
					}}
				>
					<div class="ep:flex ep:items-center ep:justify-center">
						{selectionMode === "selecting" && (
							<input
								type="checkbox"
								class="ep:cursor-pointer"
								checked={allSelected}
								onClick={(e) => {
									e.stopPropagation();
									onSelectAll();
								}}
							/>
						)}
					</div>
					{columns.map((col) =>
						col.sortable ? (
							<button
								type="button"
								key={col.key}
								class={`ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:flex ep:items-center ep:gap-1 ep:px-2 ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide ep:select-none ep:hover:text-obs-normal ${
									col.align === "right" ? "ep:justify-end" : ""
								}`}
								onClick={() => onSortChange(col.key)}
							>
								<span>{col.label}</span>
								{sortColumn === col.key && (
									<span
										class="ep:flex ep:items-center ep:w-3 ep:h-3"
										ref={sortDirIcon}
									/>
								)}
							</button>
						) : (
							<div
								key={col.key}
								class={`ep:flex ep:items-center ep:gap-1 ep:px-2 ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide ep:select-none ${
									col.align === "right" ? "ep:justify-end" : ""
								}`}
							>
								<span>{col.label}</span>
							</div>
						),
					)}
				</div>
			</div>

			{/* Body */}
			<div
				ref={containerRef}
				class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto ep:overflow-x-hidden"
			>
				<div
					class="ep:relative ep:min-w-max"
					style={{ height: `${totalHeight}px` }}
				>
					{visibleItems.map((card, i) => {
						const index = startIndex + i;
						const isSelected = selectedIds.has(card.id);
						const isActive = activeItemId === card.id;
						const top = index * ROW_HEIGHT;

						let bgCls = "ep:hover:bg-obs-modifier-hover";
						if (isActive) bgCls = "ep:bg-obs-blue/10";
						else if (isSelected) bgCls = "ep:bg-obs-modifier-hover";

						return (
							<button
								type="button"
								key={card.id}
								class={`ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:absolute ep:left-0 ep:right-0 ep:grid ep:items-center ep:border-b ep:border-obs-border/50 ep:transition-colors ${bgCls}`}
								style={{
									top: `${top}px`,
									height: `${ROW_HEIGHT}px`,
									gridTemplateColumns: gridTemplate,
								}}
								onClick={() => {
									if (selectionMode === "selecting") {
										onRowSelect(card.id);
									} else {
										onRowClick(card);
									}
								}}
							>
								<div class="ep:flex ep:items-center ep:justify-center">
									{selectionMode === "selecting" && (
										<input
											type="checkbox"
											class="ep:cursor-pointer"
											checked={isSelected}
											onClick={(e) => {
												e.stopPropagation();
												onRowSelect(card.id);
											}}
										/>
									)}
								</div>
								{columns.map((col) => (
									<div
										key={col.key}
										class={`ep:px-2 ep:truncate ep:text-ui-smaller ${
											col.align === "right" ? "ep:text-right" : ""
										}`}
									>
										{col.render(card)}
									</div>
								))}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
