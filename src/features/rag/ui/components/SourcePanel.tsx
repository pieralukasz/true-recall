import type { SearchResult } from "@features/rag/services/rag-search.service";
import { Clickable } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact";
import { useState } from "preact/hooks";
import { groupSources, stripMarkdown } from "../helpers/group-sources";
import type { GroupedSource, SourceNavigationHandlers } from "../types";

const FSRS_STATE_LABELS: Record<number, string> = {
	0: "new",
	1: "learning",
	2: "review",
	3: "relearning",
};

const INITIAL_VISIBLE = 8;

interface Props {
	sources: SearchResult[];
	navigation: SourceNavigationHandlers;
}

export function SourcePanel({ sources, navigation }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [showAll, setShowAll] = useState(false);
	const grouped = groupSources(sources);
	const chevronRef = useIcon(expanded ? "chevron-down" : "chevron-right");

	const visible = showAll ? grouped : grouped.slice(0, INITIAL_VISIBLE);
	const hasMore = grouped.length > INITIAL_VISIBLE;

	return (
		<div class="ep:w-full">
			<Clickable
				class="ep:flex ep:items-center ep:gap-1 ep:text-[11px] ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors ep:py-0.5"
				onClick={() => setExpanded((v) => !v)}
			>
				<div ref={chevronRef} class="ep:w-3 ep:h-3" />
				<span>Sources ({grouped.length})</span>
			</Clickable>

			{expanded && (
				<div class="ep:mt-0.5 ep:flex ep:flex-col">
					{visible.map((g) => (
						<SourceRow key={g.sourceId} group={g} navigation={navigation} />
					))}
					{hasMore && !showAll && (
						<Clickable
							class="ep:text-[10px] ep:text-obs-muted ep:hover:text-obs-normal ep:pl-6 ep:py-1"
							onClick={() => setShowAll(true)}
						>
							Show {grouped.length - INITIAL_VISIBLE} more...
						</Clickable>
					)}
				</div>
			)}
		</div>
	);
}

interface SourceRowProps {
	group: GroupedSource;
	navigation: SourceNavigationHandlers;
}

function SourceRow({ group, navigation }: SourceRowProps) {
	const iconRef = useIcon(group.sourceType === "note" ? "file-text" : "brain");
	const heading = group.headings[0] ? stripMarkdown(group.headings[0]) : "";
	const snippet = group.chunks[0]?.content
		? stripMarkdown(group.chunks[0].content).slice(0, 80)
		: "";
	const fsrsState =
		group.sourceType === "flashcard" ? group.chunks[0]?.fsrs?.state : undefined;

	return (
		<Clickable
			class="ep:flex ep:items-start ep:gap-1.5 ep:px-2 ep:py-1.5 ep:rounded ep:hover:bg-obs-modifier-hover ep:transition-colors ep:cursor-pointer"
			onClick={() => {
				if (group.sourceType === "note") {
					navigation.onNavigateToNote(group.sourceId, group.headings[0] ?? "");
				} else {
					navigation.onNavigateToCard(group.sourceId);
				}
			}}
		>
			<div
				ref={iconRef}
				class="ep:w-3 ep:h-3 ep:mt-px ep:shrink-0 ep:text-obs-muted"
			/>
			<div class="ep:flex ep:flex-col ep:min-w-0">
				<div class="ep:flex ep:items-center ep:gap-1 ep:min-w-0">
					<span class="ep:text-[11px] ep:font-medium ep:text-obs-normal ep:truncate ep:min-w-0 ep:shrink">
						{group.displayName || "Untitled"}
					</span>
					{heading && (
						<span class="ep:text-[10px] ep:text-obs-faint ep:truncate ep:min-w-0 ep:shrink">
							{heading}
						</span>
					)}
					{fsrsState !== undefined && (
						<span class="ep:text-[9px] ep:px-1 ep:rounded ep:bg-obs-modifier-hover ep:text-obs-muted ep:shrink-0">
							{FSRS_STATE_LABELS[fsrsState] ?? "unknown"}
						</span>
					)}
				</div>
				{snippet && (
					<span class="ep:text-[10px] ep:text-obs-faint ep:line-clamp-1">
						{snippet}
					</span>
				)}
			</div>
		</Clickable>
	);
}
