import type { ChatTurn } from "@features/rag/services/rag-query.service";
import type { SearchResult } from "@features/rag/services/rag-search.service";
import { Clickable } from "@shared/ui/components";
import type { ComponentChildren } from "preact";
import { groupSources } from "../helpers/group-sources";
import type { SourceNavigationHandlers } from "../types";
import { SourcePanel } from "./SourcePanel";

// Matches [1], [1, 2], [1, 9], [1, 2, 3] etc.
const CITE_GROUP_RE = /\[([\d]+(?:\s*,\s*[\d]+)*)\]/g;

function makeCiteClickable(
	num: number,
	sources: SearchResult[],
	navigation: SourceNavigationHandlers,
	key: string,
): ComponentChildren {
	const source = num > 0 && num <= sources.length ? sources[num - 1] : null;
	if (!source) return String(num);

	return (
		<Clickable
			key={key}
			class="ep:inline ep:text-obs-accent ep:font-semibold ep:cursor-pointer ep:hover:underline"
			onClick={() => {
				if (source.sourceType === "note") {
					navigation.onNavigateToNote(
						source.sourceId,
						source.headingBreadcrumb,
					);
				} else {
					navigation.onNavigateToCard(source.sourceId);
				}
			}}
		>
			{num}
		</Clickable>
	);
}

function renderWithCitations(
	text: string,
	sources: SearchResult[] | undefined,
	navigation: SourceNavigationHandlers | undefined,
): ComponentChildren {
	if (!sources || !navigation) return text;

	const parts: ComponentChildren[] = [];
	let lastIndex = 0;

	for (const match of text.matchAll(CITE_GROUP_RE)) {
		const idx = match.index;
		if (idx > lastIndex) {
			parts.push(text.slice(lastIndex, idx));
		}

		const nums = (match[1] ?? "")
			.split(",")
			.map((s) => Number.parseInt(s.trim(), 10))
			.filter((n) => !Number.isNaN(n));

		parts.push("[");
		for (let i = 0; i < nums.length; i++) {
			if (i > 0) parts.push(", ");
			parts.push(
				makeCiteClickable(nums[i]!, sources, navigation, `cite-${idx}-${i}`),
			);
		}
		parts.push("]");

		lastIndex = idx + match[0].length;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts;
}

interface Props {
	turn: ChatTurn;
	isStreaming?: boolean;
	navigation?: SourceNavigationHandlers;
}

export function ChatMessage({ turn, isStreaming, navigation }: Props) {
	const isUser = turn.role === "user";
	const grouped =
		turn.sources && turn.sources.length > 0 ? groupSources(turn.sources) : null;

	return (
		<div
			class={`ep:flex ep:flex-col ep:gap-1 ${isUser ? "ep:items-end" : "ep:items-start"}`}
		>
			<div
				class={`ep:max-w-[85%] ep:rounded-lg ep:px-3 ep:py-2 ep:text-sm ep:whitespace-pre-wrap ep:select-text ${
					isUser
						? "ep:bg-obs-interactive/15 ep:text-obs-normal"
						: "ep:bg-obs-modifier-hover ep:text-obs-normal"
				} ${isStreaming ? "ep:animate-pulse" : ""}`}
			>
				{isUser
					? turn.content
					: renderWithCitations(turn.content, turn.sources, navigation)}
			</div>

			{grouped && (
				<div class="ep:flex ep:flex-wrap ep:gap-1 ep:max-w-[85%]">
					{grouped.slice(0, 5).map((g) => {
						const label =
							g.sourceType === "note"
								? g.displayName
								: g.displayName || "Flashcard";
						const count = g.chunks.length > 1 ? ` (${g.chunks.length})` : "";
						return (
							<Clickable
								key={g.sourceId}
								class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:max-w-[200px] ep:truncate"
								onClick={() => {
									if (!navigation) return;
									if (g.sourceType === "note") {
										navigation.onNavigateToNote(
											g.sourceId,
											g.headings[0] ?? "",
										);
									} else {
										navigation.onNavigateToCard(g.sourceId);
									}
								}}
							>
								{label}
								{count}
							</Clickable>
						);
					})}
				</div>
			)}

			{grouped && navigation && turn.sources && (
				<SourcePanel sources={turn.sources} navigation={navigation} />
			)}
		</div>
	);
}
