import { setIcon } from "obsidian";
import type { SelectionMode } from "../../../state/store";

const ROW_HEIGHT = 36;
const BUFFER_SIZE = 10;

export interface ColumnDef<T> {
	key: string;
	label: string;
	width: string;
	render: (item: T, cell: HTMLElement) => void;
	sortable?: boolean;
	align?: "left" | "right";
}

export interface VirtualTableProps<T> {
	items: T[];
	columns: ColumnDef<T>[];
	getItemId: (item: T) => string;
	selectedIds: Set<string>;
	selectionMode: SelectionMode;
	activeItemId: string | null;
	sortColumn: string | null;
	sortDirection: "asc" | "desc";
	onRowClick: (item: T) => void;
	onRowSelect: (itemId: string) => void;
	onSortChange: (column: string) => void;
	onSelectAll: () => void;
}

export class VirtualTable<T> {
	private container: HTMLElement;
	private props: VirtualTableProps<T>;
	private outerEl: HTMLElement | null = null;
	private headerEl: HTMLElement | null = null;
	private scrollContainer: HTMLElement | null = null;
	private contentContainer: HTMLElement | null = null;
	private visibleRows: Map<number, HTMLElement> = new Map();
	private scrollTop = 0;
	private containerHeight = 0;
	private resizeObserver: ResizeObserver | null = null;
	private gridTemplate = "";

	constructor(container: HTMLElement, props: VirtualTableProps<T>) {
		this.container = container;
		this.props = props;
		this.gridTemplate = this.buildGridTemplate();
	}

	private buildGridTemplate(): string {
		const checkboxCol = "32px";
		const cols = this.props.columns.map((c) => c.width);
		return [checkboxCol, ...cols].join(" ");
	}

	render(): void {
		this.destroy();

		this.outerEl = this.container.createDiv({
			cls: "ep:flex ep:flex-col ep:flex-1 ep:min-h-0 ep:overflow-x-auto",
		});

		this.renderHeader();
		this.renderBody();
	}

	private renderHeader(): void {
		if (!this.outerEl) return;

		this.headerEl = this.outerEl.createDiv({
			cls: "ep:shrink-0 ep:border-b ep:border-obs-border ep:bg-obs-secondary",
		});

		const row = this.headerEl.createDiv({
			cls: "ep:grid ep:items-center ep:min-w-max",
			attr: { style: `grid-template-columns: ${this.gridTemplate}; height: ${ROW_HEIGHT}px` },
		});

		// Select-all checkbox
		const checkCell = row.createDiv({ cls: "ep:flex ep:items-center ep:justify-center" });
		if (this.props.selectionMode === "selecting") {
			const checkbox = checkCell.createEl("input", {
				type: "checkbox",
				cls: "ep:cursor-pointer",
			});
			const allSelected =
				this.props.items.length > 0 &&
				this.props.items.every((item) =>
					this.props.selectedIds.has(this.props.getItemId(item))
				);
			checkbox.checked = allSelected;
			checkbox.addEventListener("click", (e) => {
				e.stopPropagation();
				this.props.onSelectAll();
			});
		}

		for (const col of this.props.columns) {
			const cell = row.createDiv({
				cls: `ep:flex ep:items-center ep:gap-1 ep:px-2 ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide ep:select-none ${col.align === "right" ? "ep:justify-end" : ""} ${col.sortable ? "ep:cursor-pointer ep:hover:text-obs-normal" : ""}`,
			});

			cell.createSpan({ text: col.label });

			if (col.sortable && this.props.sortColumn === col.key) {
				const iconEl = cell.createSpan({ cls: "ep:flex ep:items-center ep:w-3 ep:h-3" });
				setIcon(iconEl, this.props.sortDirection === "asc" ? "arrow-up" : "arrow-down");
			}

			if (col.sortable) {
				cell.addEventListener("click", () => this.props.onSortChange(col.key));
			}
		}
	}

	private renderBody(): void {
		if (!this.outerEl) return;

		this.scrollContainer = this.outerEl.createDiv({
			cls: "ep:flex-1 ep:min-h-0 ep:overflow-y-auto ep:overflow-x-hidden",
		});

		const totalHeight = this.props.items.length * ROW_HEIGHT;
		this.contentContainer = this.scrollContainer.createDiv({
			cls: "ep:relative ep:min-w-max",
			attr: { style: `height: ${totalHeight}px` },
		});

		this.scrollContainer.addEventListener("scroll", this.onScroll);

		this.resizeObserver = new ResizeObserver(() => {
			this.containerHeight = this.scrollContainer?.clientHeight ?? 0;
			this.renderVisibleRows();
		});
		this.resizeObserver.observe(this.scrollContainer);

		this.containerHeight = this.scrollContainer.clientHeight;
		this.renderVisibleRows();
	}

	private onScroll = (): void => {
		if (!this.scrollContainer) return;
		this.scrollTop = this.scrollContainer.scrollTop;
		this.renderVisibleRows();
	};

	private renderVisibleRows(): void {
		if (!this.contentContainer) return;

		const { items } = this.props;
		const startIndex = Math.floor(this.scrollTop / ROW_HEIGHT);
		const visibleCount = Math.ceil(this.containerHeight / ROW_HEIGHT);

		const from = Math.max(0, startIndex - BUFFER_SIZE);
		const to = Math.min(items.length, startIndex + visibleCount + BUFFER_SIZE);

		// Remove rows outside visible range
		for (const [index, element] of this.visibleRows) {
			if (index < from || index >= to) {
				element.remove();
				this.visibleRows.delete(index);
			}
		}

		// Add rows in visible range
		for (let i = from; i < to; i++) {
			if (this.visibleRows.has(i)) continue;

			const item = items[i];
			if (!item) continue;

			const rowEl = this.createRow(item, i);
			this.visibleRows.set(i, rowEl);
		}
	}

	private createRow(item: T, index: number): HTMLElement {
		const itemId = this.props.getItemId(item);
		const isSelected = this.props.selectedIds.has(itemId);
		const isActive = this.props.activeItemId === itemId;
		const top = index * ROW_HEIGHT;

		let bgCls = "ep:hover:bg-obs-modifier-hover";
		if (isActive) bgCls = "ep-bg-obs-blue-10";
		else if (isSelected) bgCls = "ep:bg-obs-modifier-hover";

		const row = this.contentContainer!.createDiv({
			cls: `ep:absolute ep:left-0 ep:right-0 ep:grid ep:items-center ep:cursor-pointer ep:border-b ep:border-obs-border/50 ep:transition-colors ${bgCls}`,
			attr: {
				style: `top: ${top}px; height: ${ROW_HEIGHT}px; grid-template-columns: ${this.gridTemplate}`,
			},
		});

		// Checkbox cell
		const checkCell = row.createDiv({ cls: "ep:flex ep:items-center ep:justify-center" });
		if (this.props.selectionMode === "selecting") {
			const checkbox = checkCell.createEl("input", {
				type: "checkbox",
				cls: "ep:cursor-pointer",
			});
			checkbox.checked = isSelected;
			checkbox.addEventListener("click", (e) => {
				e.stopPropagation();
				this.props.onRowSelect(itemId);
			});
		}

		// Data cells
		for (const col of this.props.columns) {
			const cell = row.createDiv({
				cls: `ep:px-2 ep:truncate ep:text-ui-smaller ${col.align === "right" ? "ep:text-right" : ""}`,
			});
			col.render(item, cell);
		}

		row.addEventListener("click", () => {
			if (this.props.selectionMode === "selecting") {
				this.props.onRowSelect(itemId);
			} else {
				this.props.onRowClick(item);
			}
		});

		return row;
	}

	updateProps(props: Partial<VirtualTableProps<T>>): void {
		const itemsChanged = props.items !== undefined && props.items !== this.props.items;
		Object.assign(this.props, props);

		if (itemsChanged) {
			// Full rebuild needed - items array changed
			this.render();
		} else {
			// Just re-render header (sort indicator) and visible rows (selection state)
			this.rebuildHeader();
			this.refreshVisibleRows();
		}
	}

	private rebuildHeader(): void {
		if (this.headerEl) {
			this.headerEl.remove();
			this.headerEl = null;
		}
		this.renderHeader();
		// Move header before scroll container
		if (this.headerEl && this.scrollContainer && this.outerEl) {
			this.outerEl.insertBefore(this.headerEl, this.scrollContainer);
		}
	}

	private refreshVisibleRows(): void {
		// Remove all visible rows and re-render them
		for (const el of this.visibleRows.values()) {
			el.remove();
		}
		this.visibleRows.clear();
		this.renderVisibleRows();
	}

	destroy(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		if (this.scrollContainer) {
			this.scrollContainer.removeEventListener("scroll", this.onScroll);
		}

		for (const el of this.visibleRows.values()) {
			el.remove();
		}
		this.visibleRows.clear();

		if (this.outerEl) {
			this.outerEl.remove();
			this.outerEl = null;
		}
		this.headerEl = null;
		this.scrollContainer = null;
		this.contentContainer = null;
	}
}
