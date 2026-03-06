import { useSignal } from "@preact/signals";
import { Clickable } from "@shared/ui/components";
import { SearchCombobox } from "@shared/ui/components/SearchCombobox";
import type { SuggestionProvider } from "@shared/ui/helpers/search-suggestions.types";
import { useRef } from "preact/hooks";
import { ALL_COLUMNS } from "../helpers/column-defs";
import { formatBrowserTotalCount } from "../helpers/infinite-scroll";
import type { SortConfig, StateFilterValue } from "../types";

const STATE_CHIPS: { value: StateFilterValue; label: string; cls: string }[] = [
	{ value: "new", label: "New", cls: "ep:bg-obs-green/15 ep:text-obs-green" },
	{
		value: "learning",
		label: "Learning",
		cls: "ep:bg-obs-orange/15 ep:text-obs-orange",
	},
	{
		value: "review",
		label: "Review",
		cls: "ep:bg-obs-blue/15 ep:text-obs-blue",
	},
	{
		value: "relearning",
		label: "Relearning",
		cls: "ep:bg-obs-orange/15 ep:text-obs-orange",
	},
	{
		value: "suspended",
		label: "Suspended",
		cls: "ep:bg-obs-red/15 ep:text-obs-error",
	},
	{
		value: "buried",
		label: "Buried",
		cls: "ep:bg-obs-modifier-hover ep:text-obs-muted",
	},
];

interface BrowserToolbarProps {
	searchText: string;
	onSearchChange: (value: string) => void;
	stateFilters: StateFilterValue[];
	onToggleStateFilter: (state: StateFilterValue) => void;
	onRemoveStateFilter: (state: StateFilterValue) => void;
	sort: SortConfig;
	totalCount: number;
	showArchived: boolean;
	onToggleShowArchived: () => void;
	sidebarVisible: boolean;
	onToggleSidebar: () => void;
	visibleColumns: string[];
	onToggleColumn: (key: string) => void;
	getSuggestions: SuggestionProvider;
}

export function BrowserToolbar({
	searchText,
	onSearchChange,
	stateFilters,
	onToggleStateFilter,
	sort,
	totalCount,
	showArchived,
	onToggleShowArchived,
	sidebarVisible,
	onToggleSidebar,
	visibleColumns,
	onToggleColumn,
	getSuggestions,
}: BrowserToolbarProps) {
	const showColumnMenu = useSignal(false);
	const columnBtnRef = useRef<HTMLDivElement>(null);

	return (
		<div class="ep:shrink-0 ep:border-b ep:border-obs-border ep:px-3 ep:py-2 ep:flex ep:flex-col ep:gap-2">
			{/* Row 1: Search + actions */}
			<div class="ep:flex ep:items-center ep:gap-2">
				<Clickable
					class="ep:p-1.5 ep:rounded ep:text-obs-muted hover:ep:text-obs-normal hover:ep:bg-obs-modifier-hover"
					onClick={onToggleSidebar}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						{sidebarVisible ? (
							<>
								<rect x="3" y="3" width="18" height="18" rx="2" />
								<line x1="9" y1="3" x2="9" y2="21" />
							</>
						) : (
							<>
								<rect x="3" y="3" width="18" height="18" rx="2" />
								<line x1="9" y1="3" x2="9" y2="21" />
							</>
						)}
					</svg>
				</Clickable>

				<SearchCombobox
					value={searchText}
					placeholder='Search cards... (try "is:new", "prop:lapses>3")'
					ariaLabel="Search cards"
					onChange={onSearchChange}
					getSuggestions={getSuggestions}
					class="ep:flex-1"
				/>

				<div class="ep:relative" ref={columnBtnRef}>
					<Clickable
						class="ep:p-1.5 ep:rounded ep:text-obs-muted hover:ep:text-obs-normal hover:ep:bg-obs-modifier-hover"
						onClick={() => {
							showColumnMenu.value = !showColumnMenu.value;
						}}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<rect x="3" y="3" width="7" height="7" rx="1" />
							<rect x="14" y="3" width="7" height="7" rx="1" />
							<rect x="3" y="14" width="7" height="7" rx="1" />
							<rect x="14" y="14" width="7" height="7" rx="1" />
						</svg>
					</Clickable>

					{showColumnMenu.value && (
						<div class="ep:absolute ep:right-0 ep:top-full ep:mt-1 ep:z-50 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:py-1 ep:min-w-[180px]">
							{ALL_COLUMNS.map((col) => (
								<Clickable
									key={col.key}
									class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1.5 ep:text-ui-small hover:ep:bg-obs-modifier-hover ep:w-full"
									onClick={() => onToggleColumn(col.key)}
								>
									<span
										class={`ep:w-4 ep:h-4 ep:border ep:rounded ep:flex ep:items-center ep:justify-center ep:text-[10px] ${
											visibleColumns.includes(col.key)
												? "ep:bg-obs-interactive ep:border-obs-interactive ep:text-white"
												: "ep:border-obs-border"
										}`}
									>
										{visibleColumns.includes(col.key) && "\u2713"}
									</span>
									<span class="ep:text-obs-normal">{col.label}</span>
								</Clickable>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Row 2: State filter chips + count */}
			<div class="ep:flex ep:items-center ep:gap-1.5 ep:flex-wrap">
				{STATE_CHIPS.map((chip) => {
					const active = stateFilters.includes(chip.value);
					return (
						<Clickable
							key={chip.value}
							class={`ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[11px] ep:font-medium ep:transition-opacity ${
								active
									? chip.cls
									: "ep:bg-obs-modifier-hover ep:text-obs-muted ep:opacity-60 hover:ep:opacity-100"
							}`}
							onClick={() => onToggleStateFilter(chip.value)}
						>
							{chip.label}
						</Clickable>
					);
				})}

				<Clickable
					class={`ep:ml-auto ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[11px] ep:font-medium ep:transition-opacity ${
						showArchived
							? "ep:bg-obs-interactive/15 ep:text-obs-interactive"
							: "ep:bg-obs-modifier-hover ep:text-obs-muted ep:opacity-70 hover:ep:opacity-100"
					}`}
					onClick={onToggleShowArchived}
				>
					Show archived
				</Clickable>

				<span class="ep:text-[11px] ep:text-obs-muted">
					{formatBrowserTotalCount(totalCount)}
				</span>
			</div>
		</div>
	);
}
