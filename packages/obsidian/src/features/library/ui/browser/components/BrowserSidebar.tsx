import { useSignal } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { Clickable, SearchInput } from "@true-recall/obsidian/components";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";

import type { FilterState } from "../types";

interface BrowserSidebarProps {
	facetCounts: {
		states: Record<string, number>;
		cardTypes: Record<string, number>;
		createdVia: Record<string, number>;
		sourceNotes: { uid: string; name: string; count: number }[];
	};
	activeFilter: FilterState;
	onFilterChange: (partial: Partial<FilterState>) => void;
	orphanedCount: number;
	onRemoveOrphanedCards: () => void;
}

const STATE_ITEMS: {
	key: string;
	label: string;
	dotCls: string;
}[] = [
	{ key: "new", label: "New", dotCls: FSRS_COLORS.new.textCls },
	{
		key: "learning",
		label: "Learning",
		dotCls: FSRS_COLORS.learning.textCls,
	},
	{ key: "review", label: "Review", dotCls: FSRS_COLORS.review.textCls },
	{
		key: "relearning",
		label: "Relearning",
		dotCls: FSRS_COLORS.relearning.textCls,
	},
	{
		key: "suspended",
		label: "Suspended",
		dotCls: FSRS_COLORS.suspended.textCls,
	},
	{ key: "buried", label: "Buried", dotCls: "ep:text-obs-muted" },
];

const TYPE_LABELS: Record<string, string> = {
	basic: "Basic",
	cloze: "Cloze",
	reversed: "Reversed",
	"image-occlusion": "Image Occ.",
};

const VIA_LABELS: Record<string, string> = {
	manual: "Manual",
	ai: "AI",
	anki_import: "Anki Import",
};

export function BrowserSidebar({
	facetCounts,
	activeFilter,
	onFilterChange,
	orphanedCount,
	onRemoveOrphanedCards,
}: BrowserSidebarProps) {
	return (
		<div class="ep:w-[200px] ep:shrink-0 ep:border-r ep:border-obs-border ep:overflow-y-auto ep:text-sm">
			<SidebarSection title="Card States" defaultOpen>
				{STATE_ITEMS.map((item) => {
					const count = facetCounts.states[item.key] ?? 0;
					if (count === 0) return null;
					const active = activeFilter.states.includes(
						item.key as FilterState["states"][number],
					);
					return (
						<SidebarRow
							key={item.key}
							label={item.label}
							count={count}
							active={active}
							dotCls={item.dotCls}
							onClick={() => {
								const states = active
									? activeFilter.states.filter((s) => s !== item.key)
									: [
											...activeFilter.states,
											item.key as FilterState["states"][number],
										];
								onFilterChange({ states });
							}}
						/>
					);
				})}
			</SidebarSection>

			<SourceNotesSection
				sourceNotes={facetCounts.sourceNotes}
				activeFilter={activeFilter}
				onFilterChange={onFilterChange}
				orphanedCount={orphanedCount}
				onRemoveOrphanedCards={onRemoveOrphanedCards}
			/>

			<SidebarSection title="Card Type">
				{Object.entries(facetCounts.cardTypes).map(([type, count]) => {
					const active = activeFilter.cardTypes.includes(
						type as FilterState["cardTypes"][number],
					);
					return (
						<SidebarRow
							key={type}
							label={TYPE_LABELS[type] ?? type}
							count={count}
							active={active}
							onClick={() => {
								const cardTypes = active
									? activeFilter.cardTypes.filter((t) => t !== type)
									: [
											...activeFilter.cardTypes,
											type as FilterState["cardTypes"][number],
										];
								onFilterChange({ cardTypes });
							}}
						/>
					);
				})}
			</SidebarSection>

			<SidebarSection title="Created Via">
				{Object.entries(facetCounts.createdVia).map(([via, count]) => {
					const active = activeFilter.createdVia.includes(via);
					return (
						<SidebarRow
							key={via}
							label={VIA_LABELS[via] ?? via}
							count={count}
							active={active}
							onClick={() => {
								const createdVia = active
									? activeFilter.createdVia.filter((v) => v !== via)
									: [...activeFilter.createdVia, via];
								onFilterChange({ createdVia });
							}}
						/>
					);
				})}
			</SidebarSection>

			{/* Clear all sidebar filters */}
			{hasAnyFilter(activeFilter) && (
				<div class="ep:px-3 ep:py-2 ep:border-t ep:border-obs-border">
					<Clickable
						class="ep:text-[11px] ep:text-obs-interactive ep:underline"
						onClick={() =>
							onFilterChange({
								states: [],
								sourceUids: [],
								cardTypes: [],
								createdVia: [],
							})
						}
					>
						Clear all filters
					</Clickable>
				</div>
			)}
		</div>
	);
}

function hasAnyFilter(f: FilterState): boolean {
	return (
		f.states.length > 0 ||
		f.sourceUids.length > 0 ||
		f.cardTypes.length > 0 ||
		f.createdVia.length > 0
	);
}

const PAGE_SIZE = 50;

function SourceNotesSection({
	sourceNotes,
	activeFilter,
	onFilterChange,
	orphanedCount,
	onRemoveOrphanedCards,
}: {
	sourceNotes: { uid: string; name: string; count: number }[];
	activeFilter: FilterState;
	onFilterChange: (partial: Partial<FilterState>) => void;
	orphanedCount: number;
	onRemoveOrphanedCards: () => void;
}) {
	const open = useSignal(true);
	const searchQuery = useSignal("");
	const visibleCount = useSignal(PAGE_SIZE);

	const filteredNotes = useMemo(() => {
		const query = searchQuery.value.toLowerCase().trim();
		if (!query) return sourceNotes;
		return sourceNotes.filter((note) =>
			note.name.toLowerCase().includes(query),
		);
	}, [sourceNotes, searchQuery.value]);

	const visibleNotes = filteredNotes.slice(0, visibleCount.value);
	const hasMore = visibleNotes.length < filteredNotes.length;
	const remainingCount = filteredNotes.length - visibleCount.value;
	const selectedCount = activeFilter.sourceUids.length;

	const handleSearchChange = (value: string) => {
		searchQuery.value = value;
		visibleCount.value = PAGE_SIZE;
	};

	const handleShowMore = () => {
		visibleCount.value += PAGE_SIZE;
	};

	return (
		<div class="ep:border-b ep:border-obs-border/50">
			<Clickable
				class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 hover:ep:bg-obs-modifier-hover ep:w-full"
				onClick={() => {
					open.value = !open.value;
				}}
			>
				<span class="ep:text-[11px] ep:font-medium ep:uppercase ep:tracking-wider ep:text-obs-muted">
					{selectedCount > 0
						? `Source Notes (${selectedCount} selected)`
						: "Source Notes"}
				</span>
				<span class="ep:text-[10px] ep:text-obs-muted">
					{open.value ? "\u25BE" : "\u25B8"}
				</span>
			</Clickable>
			{open.value && (
				<div class="ep:pb-1.5">
					{/* Search input */}
					<div class="ep:px-2 ep:pb-1.5 ep:pt-1">
						<SearchInput
							size="sm"
							placeholder="Search notes..."
							ariaLabel="Search source notes"
							value={searchQuery.value}
							onChange={handleSearchChange}
						/>
					</div>

					{orphanedCount > 0 && (
						<div class="ep:px-2 ep:pb-1.5">
							<Clickable
								class="ep:w-full ep:px-2 ep:py-1 ep:text-[11px] ep:rounded ep:border ep:border-obs-error/30 ep:text-obs-error hover:ep:bg-obs-error/10"
								onClick={onRemoveOrphanedCards}
							>
								Remove orphaned cards ({orphanedCount})
							</Clickable>
						</div>
					)}

					{/* Notes list */}
					{visibleNotes.length === 0 ? (
						<div class="ep:px-3 ep:py-2 ep:text-[11px] ep:text-obs-muted ep:text-center">
							{searchQuery.value.trim()
								? `No results for "${searchQuery.value.trim()}"`
								: "No notes"}
						</div>
					) : (
						<>
							{visibleNotes.map((note) => {
								const active = activeFilter.sourceUids.includes(note.uid);
								return (
									<SidebarRow
										key={note.uid}
										label={note.name}
										count={note.count}
										active={active}
										onClick={() => {
											const sourceUids = active
												? activeFilter.sourceUids.filter((u) => u !== note.uid)
												: [...activeFilter.sourceUids, note.uid];
											onFilterChange({ sourceUids });
										}}
									/>
								);
							})}

							{/* Show more button */}
							{hasMore && (
								<Clickable
									class="ep:w-full ep:px-3 ep:py-1.5 ep:text-[11px] ep:text-obs-interactive ep:text-center hover:ep:bg-obs-modifier-hover"
									onClick={handleShowMore}
								>
									Show more ({remainingCount})
								</Clickable>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

function SidebarSection({
	title,
	defaultOpen = false,
	children,
}: {
	title: string;
	defaultOpen?: boolean;
	children: preact.ComponentChildren;
}) {
	const open = useSignal(defaultOpen);

	return (
		<div class="ep:border-b ep:border-obs-border/50">
			<Clickable
				class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 hover:ep:bg-obs-modifier-hover ep:w-full"
				onClick={() => {
					open.value = !open.value;
				}}
			>
				<span class="ep:text-[11px] ep:font-medium ep:uppercase ep:tracking-wider ep:text-obs-muted">
					{title}
				</span>
				<span class="ep:text-[10px] ep:text-obs-muted">
					{open.value ? "\u25BE" : "\u25B8"}
				</span>
			</Clickable>
			{open.value && <div class="ep:pb-1.5">{children}</div>}
		</div>
	);
}

function SidebarRow({
	label,
	count,
	active,
	dotCls,
	onClick,
}: {
	label: string;
	count: number;
	active: boolean;
	dotCls?: string;
	onClick: () => void;
}) {
	return (
		<Clickable
			class={`ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1 ep:cursor-pointer hover:ep:bg-obs-modifier-hover ep:w-full ${
				active ? "ep:bg-obs-interactive/10" : ""
			}`}
			onClick={onClick}
		>
			{dotCls && <span class={`ep:text-[8px] ${dotCls}`}>{"\u25CF"}</span>}
			<span
				class={`ep:flex-1 ep:truncate ep:text-[12px] ${active ? "ep:text-obs-normal ep:font-medium" : "ep:text-obs-muted"}`}
			>
				{label}
			</span>
			<span class="ep:text-[11px] ep:text-obs-faint ep:tabular-nums">
				{count}
			</span>
		</Clickable>
	);
}
