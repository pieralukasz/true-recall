import type { SearchResult } from "../../services/rag-search.service";
import { fileBasename } from "@true-recall/core/utils";
import type { GroupedSource } from "../types";

export function groupSources(sources: SearchResult[]): GroupedSource[] {
	const groups = new Map<string, GroupedSource>();

	for (const s of sources) {
		const existing = groups.get(s.sourceId);
		if (existing) {
			existing.chunks.push(s);
			if (
				s.headingBreadcrumb &&
				!existing.headings.includes(s.headingBreadcrumb)
			) {
				existing.headings.push(s.headingBreadcrumb);
			}
			if (s.score > existing.bestScore) {
				existing.bestScore = s.score;
			}
		} else {
			groups.set(s.sourceId, {
				sourceId: s.sourceId,
				sourceType: s.sourceType,
				displayName: makeDisplayName(s),
				headings: s.headingBreadcrumb ? [s.headingBreadcrumb] : [],
				chunks: [s],
				bestScore: s.score,
			});
		}
	}

	return Array.from(groups.values()).sort((a, b) => b.bestScore - a.bestScore);
}

function makeDisplayName(s: SearchResult): string {
	if (s.sourceType === "note") {
		return fileBasename(s.sourceId);
	}
	const qMatch = s.content.match(/^Q:\s*([^\n]+)/);
	const raw = qMatch?.[1]?.trim() || s.content.slice(0, 50);
	return stripMarkdown(raw).slice(0, 50);
}

export function stripMarkdown(text: string): string {
	return (
		text
			.replace(/^#{1,6}\s+/gm, "")
			.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
			.replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
			.replace(/`([^`]+)`/g, "$1")
			// Images before links — otherwise the link regex matches [alt](url) leaving "!"
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			.replace(/~~([^~]+)~~/g, "$1")
			.replace(/==([^=]+)==/g, "$1")
			.trim()
	);
}
