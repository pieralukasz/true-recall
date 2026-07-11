import type { App, MarkdownPostProcessorContext, TFile } from "obsidian";

import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";

import type { NoteStatusInfo } from "@true-recall/obsidian/data";
import type { NoteStatusCache } from "@true-recall/obsidian/features/core/cache/note-status-cache.service";

import {
	aggregateInfos,
	createLinkStatusElement,
	createLinkTextCountElement,
} from "./LinkStatusWidget";

export function createLinkStatusPostProcessor(
	app: App,
	noteStatusCache: NoteStatusCache,
	frontmatterIndex: FrontmatterIndexService,
	getEnabled: () => boolean,
	getEnabledInPanel: () => boolean,
	onReviewNote: (file: TFile) => void,
	onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
		if (!getEnabled() || !noteStatusCache.hasData()) return;

		if (
			!getEnabledInPanel() &&
			el.closest('[data-type="true-recall-flashcard-panel"]')
		)
			return;

		const sourcePath = ctx.sourcePath;

		// Per-link donuts
		const links = Array.from(
			el.querySelectorAll<HTMLAnchorElement>("a.internal-link"),
		);

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

			const uid = uids[0];
			if (!uid) continue;
			const info = noteStatusCache.get(uid);
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
					variant: "link",
				});
				linkEl.insertAdjacentElement("afterend", textCountEl);
			}
		}

		// Heading summaries
		const headings = Array.from(
			el.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
		);
		for (const heading of headings) {
			if (heading.querySelector(".ep-heading-summary")) continue;

			const sectionLinks = collectFlashcardLinksAfterHeading(
				heading,
				app,
				sourcePath,
				frontmatterIndex,
				noteStatusCache,
			);
			if (sectionLinks.length < 2) continue;

			const aggregated = aggregateInfos(sectionLinks.map((l) => l.info));
			const noteNames = sectionLinks.map((l) => l.noteName);
			const reviewSection = () => onReviewNotes(noteNames, false);
			const headingLevel = parseInt(heading.tagName[1] ?? "1", 10) as
				| 1
				| 2
				| 3
				| 4
				| 5
				| 6;

			const donutEl = createLinkStatusElement({
				info: aggregated,
				onPlay: reviewSection,
				variant: `h${headingLevel}`,
			});
			heading.prepend(donutEl);

			const summaryEl = activeDocument.createElement("span");
			summaryEl.className =
				"ep-heading-summary ep:inline-flex ep:items-center ep:gap-1 ep:float-right";
			summaryEl.appendChild(
				createLinkTextCountElement({
					info: aggregated,
					onPlay: reviewSection,
					variant: `h${headingLevel}`,
				}),
			);
			heading.appendChild(summaryEl);
		}
	};
}

function collectFlashcardLinksAfterHeading(
	heading: HTMLElement,
	app: App,
	sourcePath: string,
	frontmatterIndex: FrontmatterIndexService,
	noteStatusCache: NoteStatusCache,
): { noteName: string; info: NoteStatusInfo }[] {
	const results: { noteName: string; info: NoteStatusInfo }[] = [];
	const headingLevel = parseInt(heading.tagName[1] ?? "0", 10);
	const seen = new Set<string>();

	let sibling = heading.nextElementSibling;
	while (sibling) {
		const tagName = sibling.tagName;
		if (/^H[1-6]$/.test(tagName)) {
			const siblingLevel = parseInt(tagName[1] ?? "0", 10);
			if (siblingLevel <= headingLevel) break;
		}

		const anchorLinks = Array.from(
			sibling.querySelectorAll<HTMLAnchorElement>("a.internal-link"),
		);
		for (const anchor of anchorLinks) {
			const href = anchor.getAttribute("data-href");
			if (!href) continue;

			const resolved = app.metadataCache.getFirstLinkpathDest(href, sourcePath);
			if (!resolved) continue;

			const uids = frontmatterIndex.getValues("flashcard_uid", resolved.path);
			if (uids.length === 0) continue;

			const uid = uids[0];
			if (!uid || seen.has(uid)) continue;
			seen.add(uid);

			const info = noteStatusCache.get(uid);
			if (!info) continue;

			results.push({ noteName: resolved.basename, info });
		}

		sibling = sibling.nextElementSibling;
	}

	return results;
}
