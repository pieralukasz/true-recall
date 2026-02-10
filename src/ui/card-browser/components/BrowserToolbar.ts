import { setIcon } from "obsidian";
import { BaseComponent } from "../../component.base";
import { createSearchInput, SearchInput } from "../../components";
import type { BrowserStateFilter } from "../../../state/store";

const STATE_FILTERS: { value: BrowserStateFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "new", label: "New" },
	{ value: "learning", label: "Learning" },
	{ value: "review", label: "Review" },
	{ value: "relearning", label: "Relearn" },
	{ value: "suspended", label: "Suspended" },
	{ value: "buried", label: "Buried" },
];

export interface BrowserToolbarProps {
	searchQuery: string;
	stateFilter: BrowserStateFilter;
	totalCount: number;
	filteredCount: number;
	onSearchChange: (query: string) => void;
	onStateFilterChange: (filter: BrowserStateFilter) => void;
	onRefresh: () => void;
}

export class BrowserToolbar extends BaseComponent {
	private props: BrowserToolbarProps;
	private searchInput: SearchInput | null = null;

	constructor(container: HTMLElement, props: BrowserToolbarProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}
		this.searchInput = null;

		this.element = this.container.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:border-b ep:border-obs-border",
		});

		// Row 1: Search + refresh
		const searchRow = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		const searchContainer = searchRow.createDiv({ cls: "ep:flex-1" });
		this.searchInput = createSearchInput(searchContainer, {
			value: this.props.searchQuery,
			placeholder: "Search cards\u2026",
			onChange: this.props.onSearchChange,
		});

		const refreshBtn = searchRow.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refreshBtn, "refresh-cw");
		this.events.addEventListener(refreshBtn, "click", () => this.props.onRefresh());

		// Row 2: Filter pills + count
		const filterRow = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:gap-2 ep:flex-wrap",
		});

		const pills = filterRow.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1 ep:flex-wrap",
		});

		for (const filter of STATE_FILTERS) {
			const isActive = this.props.stateFilter === filter.value;
			const pill = pills.createEl("button", {
				text: filter.label,
				cls: `ep:px-2 ep:py-0.5 ep:rounded-full ep:text-ui-smaller ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors ${isActive
					? "ep:bg-obs-interactive ep:text-obs-on-accent"
					: "ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal"
				}`,
			});
			this.events.addEventListener(pill, "click", () =>
				this.props.onStateFilterChange(filter.value)
			);
		}

		const count = filterRow.createSpan({
			text: this.props.filteredCount === this.props.totalCount
				? `${this.props.totalCount} cards`
				: `${this.props.filteredCount} of ${this.props.totalCount} cards`,
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:whitespace-nowrap",
		});
		count.setAttribute("aria-live", "polite");
	}

	updateProps(props: Partial<BrowserToolbarProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

export function createBrowserToolbar(
	container: HTMLElement,
	props: BrowserToolbarProps
): BrowserToolbar {
	const toolbar = new BrowserToolbar(container, props);
	toolbar.render();
	return toolbar;
}
