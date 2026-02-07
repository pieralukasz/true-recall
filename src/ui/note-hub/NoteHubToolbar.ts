import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";
import { SearchInput } from "../components";
import type { NoteHubStatusFilter, NoteHubSortBy, NoteHubSortDirection } from "../../state/store/types";

export interface NoteHubToolbarProps {
	searchQuery: string;
	statusFilter: NoteHubStatusFilter;
	sortBy: NoteHubSortBy;
	sortDirection: NoteHubSortDirection;
	onSearchChange: (query: string) => void;
	onStatusFilterChange: (filter: NoteHubStatusFilter) => void;
	onSortByChange: (sortBy: NoteHubSortBy) => void;
	onSortDirectionToggle: () => void;
	onRefresh: () => void;
}

const STATUS_FILTERS: { label: string; value: NoteHubStatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Due", value: "has-due" },
	{ label: "New", value: "has-new" },
	{ label: "Needs Cards", value: "needs-cards" },
	{ label: "Done", value: "no-due" },
];

const SORT_OPTIONS: { label: string; value: NoteHubSortBy }[] = [
	{ label: "Name", value: "name" },
	{ label: "Due Count", value: "due" },
	{ label: "Card Count", value: "cards" },
];

const PILL_BASE = "ep:px-2 ep:py-1 ep:rounded ep:text-ui-smaller ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";
const PILL_ACTIVE = `${PILL_BASE} ep:bg-obs-interactive ep:text-obs-on-accent`;
const PILL_INACTIVE = `${PILL_BASE} ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal`;

export class NoteHubToolbar extends BaseComponent {
	private props: NoteHubToolbarProps;
	private searchInput: SearchInput | null = null;

	constructor(container: HTMLElement, props: NoteHubToolbarProps) {
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
			cls: "ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:shrink-0 ep:flex-wrap",
		});

		this.renderSearch(this.element);
		this.renderStatusFilter(this.element);
		this.renderSortControls(this.element);
		this.renderRefreshButton(this.element);
	}

	private renderSearch(parent: HTMLElement): void {
		const searchContainer = parent.createDiv();
		this.searchInput = new SearchInput(searchContainer, {
			value: this.props.searchQuery,
			placeholder: "Search notes...",
			onChange: this.props.onSearchChange,
			className: "ep:flex-1 ep:min-w-[200px]",
		});
		this.searchInput.render();
	}

	private renderStatusFilter(parent: HTMLElement): void {
		const filterGroup = parent.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1",
		});

		for (const filter of STATUS_FILTERS) {
			const isActive = this.props.statusFilter === filter.value;
			const btn = filterGroup.createEl("button", {
				cls: isActive ? PILL_ACTIVE : PILL_INACTIVE,
				text: filter.label,
			});

			this.events.addEventListener(btn, "click", () => {
				this.props.onStatusFilterChange(filter.value);
			});
		}
	}

	private renderSortControls(parent: HTMLElement): void {
		const sortGroup = parent.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1",
		});

		const select = sortGroup.createEl("select", {
			cls: "ep:bg-obs-primary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded ep:px-2 ep:py-1 ep:text-ui-smaller ep:cursor-pointer",
		});

		for (const option of SORT_OPTIONS) {
			const optEl = select.createEl("option", {
				text: option.label,
				value: option.value,
			});
			if (this.props.sortBy === option.value) {
				optEl.selected = true;
			}
		}

		this.events.addEventListener(select, "change", () => {
			this.props.onSortByChange(select.value as NoteHubSortBy);
		});

		const dirBtn = sortGroup.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": this.props.sortDirection === "asc" ? "Sort ascending" : "Sort descending" },
		});
		setIcon(dirBtn, this.props.sortDirection === "asc" ? "arrow-up" : "arrow-down");

		this.events.addEventListener(dirBtn, "click", () => {
			this.props.onSortDirectionToggle();
		});
	}

	private renderRefreshButton(parent: HTMLElement): void {
		const btn = parent.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(btn, "refresh-cw");

		this.events.addEventListener(btn, "click", () => {
			this.props.onRefresh();
		});
	}

	updateProps(props: Partial<NoteHubToolbarProps>): void {
		const searchChanged = props.searchQuery !== undefined && props.searchQuery !== this.props.searchQuery;
		const otherChanged =
			(props.statusFilter !== undefined && props.statusFilter !== this.props.statusFilter) ||
			(props.sortBy !== undefined && props.sortBy !== this.props.sortBy) ||
			(props.sortDirection !== undefined && props.sortDirection !== this.props.sortDirection);

		this.props = { ...this.props, ...props };

		if (otherChanged) {
			this.render();
			return;
		}

		if (searchChanged && this.searchInput) {
			this.searchInput.updateProps({ value: this.props.searchQuery });
		}
	}

	destroy(): void {
		this.searchInput?.destroy();
		this.searchInput = null;
		super.destroy();
	}
}

export function createNoteHubToolbar(
	container: HTMLElement,
	props: NoteHubToolbarProps
): NoteHubToolbar {
	const component = new NoteHubToolbar(container, props);
	component.render();
	return component;
}
