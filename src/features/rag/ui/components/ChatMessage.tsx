import type { ChatTurn } from "@features/rag/services/rag-query.service";
import type { SearchResult } from "@features/rag/services/rag-search.service";
import { Clickable } from "@shared/ui/components";
import { useApp } from "@shared/ui/preact";
import { stripBrTags } from "@shared/utils";
import { MarkdownRenderer, Component as ObsidianComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
import { groupSources } from "../helpers/group-sources";
import type { SourceNavigationHandlers } from "../types";
import { SourcePanel } from "./SourcePanel";

const CITE_RE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** Ensure lines starting with bold text become separate paragraphs */
function ensureBoldParagraphs(text: string): string {
	return text.replace(/([^\n])\n(\*\*)/g, "$1\n\n$2");
}

function injectCitationHandlers(
	el: HTMLElement,
	sources: SearchResult[],
	navigation: SourceNavigationHandlers,
) {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];
	for (;;) {
		const node = walker.nextNode() as Text | null;
		if (!node) break;
		if (CITE_RE.test(node.textContent ?? "")) {
			textNodes.push(node);
		}
		CITE_RE.lastIndex = 0;
	}

	for (const textNode of textNodes) {
		const text = textNode.textContent ?? "";
		const frag = document.createDocumentFragment();
		let lastIdx = 0;

		for (const match of text.matchAll(CITE_RE)) {
			const idx = match.index;
			if (idx > lastIdx) {
				frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
			}

			const nums = (match[1] ?? "")
				.split(",")
				.map((s) => Number.parseInt(s.trim(), 10))
				.filter((n) => !Number.isNaN(n));

			frag.appendChild(document.createTextNode("["));
			for (let i = 0; i < nums.length; i++) {
				if (i > 0) frag.appendChild(document.createTextNode(", "));
				const num = nums[i] ?? 0;
				const source =
					num > 0 && num <= sources.length ? sources[num - 1] : null;
				if (source) {
					const span = document.createElement("span");
					span.textContent = String(num);
					span.className =
						"ep:text-obs-accent ep:font-semibold ep:cursor-pointer ep:hover:underline";
					span.addEventListener("click", (e) => {
						e.preventDefault();
						e.stopPropagation();
						if (source.sourceType === "note") {
							navigation.onNavigateToNote(
								source.sourceId,
								source.headingBreadcrumb,
							);
						} else {
							navigation.onNavigateToCard(source.sourceId);
						}
					});
					frag.appendChild(span);
				} else {
					frag.appendChild(document.createTextNode(String(num)));
				}
			}
			frag.appendChild(document.createTextNode("]"));

			lastIdx = idx + match[0].length;
		}

		if (lastIdx < text.length) {
			frag.appendChild(document.createTextNode(text.slice(lastIdx)));
		}

		textNode.parentNode?.replaceChild(frag, textNode);
	}
}

interface AssistantMessageProps {
	content: string;
	sources?: SearchResult[];
	navigation?: SourceNavigationHandlers;
	isStreaming?: boolean;
}

function AssistantMessage({
	content,
	sources,
	navigation,
	isStreaming,
}: AssistantMessageProps) {
	const app = useApp();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.empty();

		const comp = new ObsidianComponent();
		const processed = ensureBoldParagraphs(stripBrTags(content));
		void MarkdownRenderer.render(app, processed, el, "", comp);

		if (sources && navigation) {
			injectCitationHandlers(el, sources, navigation);
		}

		if (isStreaming) {
			const cursor = document.createElement("span");
			cursor.className = "ep-streaming-cursor";
			el.appendChild(cursor);
		}

		return () => comp.unload();
	}, [app, content, sources, navigation, isStreaming]);

	return (
		<div
			ref={ref}
			class="ep:text-sm ep:select-text [&_p]:ep:my-2 [&_ul]:ep:my-1 [&_ul]:ep:pl-6 [&_ul]:ep:list-disc [&_ol]:ep:my-1 [&_ol]:ep:pl-6 [&_ol]:ep:list-decimal [&_li]:ep:my-1 [&_li>ul]:ep:mt-1 [&_li>ol]:ep:mt-1 [&_code]:ep:text-xs [&_pre]:ep:my-2 [&_pre]:ep:text-xs [&_p:first-child]:ep:mt-0 [&_p:last-child]:ep:mb-0 [&_h1]:ep:mt-3 [&_h1]:ep:mb-1 [&_h1]:ep:font-semibold [&_h2]:ep:mt-3 [&_h2]:ep:mb-1 [&_h2]:ep:font-semibold [&_h3]:ep:mt-3 [&_h3]:ep:mb-1 [&_h3]:ep:font-semibold [&_blockquote]:ep:pl-3 [&_blockquote]:ep:border-l-2 [&_blockquote]:ep:border-obs-border [&_blockquote]:ep:my-2 [&_blockquote]:ep:text-obs-muted"
		/>
	);
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
			class={`ep:flex ep:flex-col ep:gap-1.5 ${isUser ? "ep:items-end" : "ep:items-start"}`}
		>
			{isUser ? (
				<div class="ep:max-w-[85%] ep:rounded-2xl ep:rounded-br-sm ep:px-4 ep:py-3 ep:text-sm ep:whitespace-pre-wrap ep:select-text ep:bg-obs-interactive/20 ep:text-obs-normal">
					{turn.content}
				</div>
			) : (
				<div class="ep:w-full ep:px-1">
					<AssistantMessage
						content={turn.content}
						sources={turn.sources}
						navigation={navigation}
						isStreaming={isStreaming}
					/>
				</div>
			)}

			{grouped && (
				<div class="ep:flex ep:flex-wrap ep:gap-1.5 ep:max-w-[90%]">
					{grouped.slice(0, 5).map((g) => {
						const label =
							g.sourceType === "note"
								? g.displayName
								: g.displayName || "Flashcard";
						const count = g.chunks.length > 1 ? ` (${g.chunks.length})` : "";
						return (
							<Clickable
								key={g.sourceId}
								class="ep:text-[11px] ep:px-2 ep:py-1 ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:max-w-[200px] ep:truncate"
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
