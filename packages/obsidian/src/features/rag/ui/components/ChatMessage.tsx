import { MarkdownRenderer, Component as ObsidianComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

import type { ChatTurn } from "@true-recall/core/rag/chat/rag-query.service";
import type { SearchResult } from "@true-recall/core/rag/retrieval/rag-search.service";
import type { GroupedSource } from "@true-recall/core/rag/retrieval/rag-source-grouper";
import { groupSources } from "@true-recall/core/rag/retrieval/rag-source-grouper";
import { stripBrTags } from "@true-recall/core/utils";

import { Clickable } from "@true-recall/obsidian/components";
import { useApp, useIcon } from "@true-recall/obsidian/preact";

import type { SourceNavigationHandlers } from "../types";
import { SourcePanel } from "./SourcePanel";

const CITE_RE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
const FLASHCARD_UID_RE = /\[flashcard_uid:\s*([a-f0-9]+)\]/gi;

/** Ensure lines starting with bold text or list markers become separate paragraphs */
function ensureBlockSeparation(text: string): string {
	return (
		text
			// single \n before **bold → paragraph break
			.replace(/([^\n])\n(\*\*)/g, "$1\n\n$2")
			// single \n before list marker (- or 1.) → paragraph break
			.replace(/([^\n])\n([-*] |\d+\. )/g, "$1\n\n$2")
	);
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

function injectFlashcardUidLinks(
	el: HTMLElement,
	navigation: SourceNavigationHandlers,
) {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];
	for (;;) {
		const node = walker.nextNode() as Text | null;
		if (!node) break;
		if (FLASHCARD_UID_RE.test(node.textContent ?? "")) {
			textNodes.push(node);
		}
		FLASHCARD_UID_RE.lastIndex = 0;
	}

	for (const textNode of textNodes) {
		const text = textNode.textContent ?? "";
		const frag = document.createDocumentFragment();
		let lastIdx = 0;

		for (const match of text.matchAll(FLASHCARD_UID_RE)) {
			const idx = match.index;
			if (idx > lastIdx) {
				frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
			}

			const uid = match[1] ?? "";
			const span = document.createElement("span");
			span.textContent = uid;
			span.className =
				"ep:text-obs-accent ep:font-mono ep:text-[11px] ep:cursor-pointer ep:hover:underline";
			span.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				navigation.onNavigateToUid(uid);
			});
			frag.appendChild(span);

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
		const processed = ensureBlockSeparation(stripBrTags(content));
		void MarkdownRenderer.render(app, processed, el, "", comp);

		if (navigation) {
			if (sources) {
				injectCitationHandlers(el, sources, navigation);
			}
			injectFlashcardUidLinks(el, navigation);
		}

		const onInternalLink = (e: MouseEvent) => {
			const target = (e.target as HTMLElement).closest("a.internal-link");
			if (!target) return;
			e.preventDefault();
			e.stopPropagation();
			const href = target.getAttribute("data-href");
			if (href) void app.workspace.openLinkText(href, "", false);
		};
		el.addEventListener("click", onInternalLink, true);

		if (isStreaming) {
			const cursor = document.createElement("span");
			cursor.className = "ep-streaming-cursor";
			el.appendChild(cursor);
		}

		return () => {
			el.removeEventListener("click", onInternalLink, true);
			comp.unload();
		};
	}, [app, content, sources, navigation, isStreaming]);

	return (
		<div
			ref={ref}
			class="ep-chat-markdown ep:text-sm ep:leading-relaxed ep:select-text"
		/>
	);
}

function SourcePill({
	group,
	navigation,
}: {
	group: GroupedSource;
	navigation?: SourceNavigationHandlers;
}) {
	const iconRef = useIcon(group.sourceType === "note" ? "file-text" : "brain");
	const label =
		group.sourceType === "note"
			? group.displayName
			: group.displayName || "Flashcard";
	const count = group.chunks.length > 1 ? ` (${group.chunks.length})` : "";

	return (
		<Clickable
			class="ep:inline-flex ep:items-center ep:gap-1 ep:text-[11px] ep:pl-1.5 ep:pr-2 ep:py-0.5 ep:rounded-md ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:max-w-[200px]"
			onClick={() => {
				if (!navigation) return;
				if (group.sourceType === "note") {
					navigation.onNavigateToNote(group.sourceId, group.headings[0] ?? "");
				} else {
					navigation.onNavigateToCard(group.sourceId);
				}
			}}
		>
			<span
				ref={iconRef}
				class="ep:shrink-0 ep:flex ep:items-center [&_svg]:ep:w-3 [&_svg]:ep:h-3"
			/>
			<span class="ep:truncate">
				{label}
				{count}
			</span>
		</Clickable>
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
				<div class="ep:flex ep:flex-wrap ep:gap-1.5 ep:px-1">
					{grouped.slice(0, 5).map((g) => (
						<SourcePill key={g.sourceId} group={g} navigation={navigation} />
					))}
				</div>
			)}

			{grouped && navigation && turn.sources && (
				<SourcePanel sources={turn.sources} navigation={navigation} />
			)}
		</div>
	);
}
