import type { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import type { NoteStatusCacheService, NoteStatusInfo } from "../../services/cache/note-status-cache.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import type { AggregatedStats } from "./summary-helpers";
import { createSummaryBannerElement, createSectionSummaryElement } from "./SummaryWidget";

export function createSummaryPostProcessor(
	app: App,
	noteStatusCache: NoteStatusCacheService,
	frontmatterIndex: FrontmatterIndexService,
	getBannerEnabled: () => boolean,
	getSectionEnabled: () => boolean,
	onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
		try {
			processElement(el, ctx);
		} catch (e) {
			console.error("[True Recall] SummaryPostProcessor error:", e);
		}
	};

	function processElement(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		if (!noteStatusCache.hasData()) return;

		const sourcePath = ctx.sourcePath;
		const bannerEnabled = getBannerEnabled();
		const sectionEnabled = getSectionEnabled();

		if (!bannerEnabled && !sectionEnabled) return;

		// Top banner: only in the first section of the document
		if (bannerEnabled) {
			const sectionInfo = ctx.getSectionInfo(el);
			if (sectionInfo && sectionInfo.lineStart === 0) {
				if (!el.querySelector(".true-recall-summary-banner")) {
					const global = getGlobalStatsFromCache(app, sourcePath, frontmatterIndex, noteStatusCache);
					if (global) {
						const bannerEl = createSummaryBannerElement({
							stats: global,
							onReviewAll: () => onReviewNotes(global.noteNames, false),
							onReviewDue: () => onReviewNotes(global.noteNames, true),
						});
						el.prepend(bannerEl);
					}
				}
			}
		}

		// Per-heading section summaries
		if (sectionEnabled) {
			const headings = Array.from(el.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
			for (const heading of headings) {
				if (heading.nextElementSibling?.classList.contains("true-recall-section-summary")) {
					continue;
				}

				const sectionLinks = collectFlashcardLinksAfterHeading(
					heading,
					app,
					sourcePath,
					frontmatterIndex,
					noteStatusCache,
				);
				if (sectionLinks.length < 2) continue;

				const stats = aggregateNoteLinks(sectionLinks);
				const summaryEl = createSectionSummaryElement({
					stats,
					onReview: () => onReviewNotes(stats.noteNames, false),
				});
				heading.insertAdjacentElement("afterend", summaryEl);
			}
		}
	};
}

function getGlobalStatsFromCache(
	app: App,
	sourcePath: string,
	frontmatterIndex: FrontmatterIndexService,
	noteStatusCache: NoteStatusCacheService,
): AggregatedStats | null {
	const file = app.vault.getAbstractFileByPath(sourcePath);
	if (!file) return null;

	const cache = app.metadataCache.getFileCache(file as TFile);
	if (!cache?.links) return null;

	const links: { noteName: string; status: NoteStatusInfo }[] = [];
	const seen = new Set<string>();

	for (const link of cache.links) {
		const resolved = app.metadataCache.getFirstLinkpathDest(link.link, sourcePath);
		if (!resolved) continue;

		const uids = frontmatterIndex.getValues("flashcard_uid", resolved.path);
		if (uids.length === 0) continue;

		const uid = uids[0]!;
		if (seen.has(uid)) continue;
		seen.add(uid);

		const info = noteStatusCache.get(uid);
		if (!info) continue;

		links.push({ noteName: resolved.basename, status: info });
	}

	if (links.length < 2) return null;
	return aggregateNoteLinks(links);
}

function collectFlashcardLinksAfterHeading(
	heading: HTMLElement,
	app: App,
	sourcePath: string,
	frontmatterIndex: FrontmatterIndexService,
	noteStatusCache: NoteStatusCacheService,
): { noteName: string; status: NoteStatusInfo }[] {
	const links: { noteName: string; status: NoteStatusInfo }[] = [];
	const headingLevel = parseInt(heading.tagName[1]!, 10);
	const seen = new Set<string>();

	let sibling = heading.nextElementSibling;
	while (sibling) {
		// Stop at next heading of same or higher level
		const tagName = sibling.tagName;
		if (/^H[1-6]$/.test(tagName)) {
			const siblingLevel = parseInt(tagName[1]!, 10);
			if (siblingLevel <= headingLevel) break;
		}

		const anchorLinks = Array.from(sibling.querySelectorAll<HTMLAnchorElement>("a.internal-link"));
		for (const anchor of anchorLinks) {
			const href = anchor.getAttribute("data-href");
			if (!href) continue;

			const resolved = app.metadataCache.getFirstLinkpathDest(href, sourcePath);
			if (!resolved) continue;

			const uids = frontmatterIndex.getValues("flashcard_uid", resolved.path);
			if (uids.length === 0) continue;

			const uid = uids[0]!;
			if (seen.has(uid)) continue;
			seen.add(uid);

			const info = noteStatusCache.get(uid);
			if (!info) continue;

			links.push({ noteName: resolved.basename, status: info });
		}

		sibling = sibling.nextElementSibling;
	}

	return links;
}

function aggregateNoteLinks(
	links: { noteName: string; status: NoteStatusInfo }[],
): AggregatedStats {
	let newCount = 0;
	let learning = 0;
	let dueToday = 0;
	let total = 0;
	const noteNames: string[] = [];

	for (const link of links) {
		newCount += link.status.new;
		learning += link.status.learning;
		dueToday += link.status.dueToday;
		total += link.status.total;
		noteNames.push(link.noteName);
	}

	return { new: newCount, learning, dueToday, total, noteNames };
}
