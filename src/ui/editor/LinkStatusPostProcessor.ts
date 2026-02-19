import type { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import type { NoteStatusCacheService, NoteStatusInfo } from "../../services/cache/note-status-cache.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import { createLinkStatusElement, createLinkTextCountElement, aggregateInfos } from "./LinkStatusWidget";

export function createLinkStatusPostProcessor(
	app: App,
	noteStatusCache: NoteStatusCacheService,
	frontmatterIndex: FrontmatterIndexService,
	getEnabled: () => boolean,
	onReviewNote: (file: TFile) => void,
	onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
		if (!getEnabled() || !noteStatusCache.hasData()) return;

		const sourcePath = ctx.sourcePath;

		// Per-link donuts
		const links = Array.from(el.querySelectorAll<HTMLAnchorElement>("a.internal-link"));

		for (const linkEl of links) {
			const href = linkEl.getAttribute("data-href");
			if (!href) continue;

			if (linkEl.previousElementSibling?.classList.contains("ep-donut")) {
				continue;
			}

			const file = app.metadataCache.getFirstLinkpathDest(href, sourcePath);
			if (!file) continue;

			const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
			if (uids.length === 0) continue;

			const info = noteStatusCache.get(uids[0]!);
			if (!info) continue;

			const targetFile = file;
			const statusEl = createLinkStatusElement({
				info,
				onPlay: () => onReviewNote(targetFile),
			});
			linkEl.insertAdjacentElement("beforebegin", statusEl);

			if (!linkEl.nextElementSibling?.classList.contains("ep-link-count")) {
				const textCountEl = createLinkTextCountElement({
					info,
					onPlay: () => onReviewNote(targetFile),
				});
				linkEl.insertAdjacentElement("afterend", textCountEl);
			}
		}

		// Heading summaries
		const headings = Array.from(el.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
		for (const heading of headings) {
			if (heading.querySelector(".ep-heading-summary")) continue;

			const sectionLinks = collectFlashcardLinksAfterHeading(
				heading, app, sourcePath, frontmatterIndex, noteStatusCache,
			);
			if (sectionLinks.length < 2) continue;

			const aggregated = aggregateInfos(sectionLinks.map((l) => l.info));
			const noteNames = sectionLinks.map((l) => l.noteName);
			const reviewSection = () => onReviewNotes(noteNames, true);

			const donutEl = createLinkStatusElement({ info: aggregated, onPlay: reviewSection, small: true });
			heading.prepend(donutEl);

			const summaryEl = document.createElement("span");
			summaryEl.className = "ep-heading-summary ep:inline-flex ep:items-center ep:gap-1 ep:float-right";
			summaryEl.appendChild(createLinkTextCountElement({ info: aggregated, onPlay: reviewSection }));
			heading.appendChild(summaryEl);
		}
	};
}

function collectFlashcardLinksAfterHeading(
	heading: HTMLElement,
	app: App,
	sourcePath: string,
	frontmatterIndex: FrontmatterIndexService,
	noteStatusCache: NoteStatusCacheService,
): { noteName: string; info: NoteStatusInfo }[] {
	const results: { noteName: string; info: NoteStatusInfo }[] = [];
	const headingLevel = parseInt(heading.tagName[1]!, 10);
	const seen = new Set<string>();

	let sibling = heading.nextElementSibling;
	while (sibling) {
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

			results.push({ noteName: resolved.basename, info });
		}

		sibling = sibling.nextElementSibling;
	}

	return results;
}
