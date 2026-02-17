import type { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import type { NoteStatusCacheService } from "../../services/cache/note-status-cache.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import { createLinkStatusElement } from "./LinkStatusWidget";

export function createLinkStatusPostProcessor(
	app: App,
	noteStatusCache: NoteStatusCacheService,
	frontmatterIndex: FrontmatterIndexService,
	getEnabled: () => boolean,
	onReviewNote: (file: TFile) => void,
) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
		if (!getEnabled() || !noteStatusCache.hasData()) return;

		const sourcePath = ctx.sourcePath;
		const links = Array.from(el.querySelectorAll<HTMLAnchorElement>("a.internal-link"));

		for (const linkEl of links) {
			const href = linkEl.getAttribute("data-href");
			if (!href) continue;

			if (
				linkEl.previousElementSibling?.classList.contains(
					"true-recall-link-status",
				)
			) {
				continue;
			}

			const file = app.metadataCache.getFirstLinkpathDest(
				href,
				sourcePath,
			);
			if (!file) continue;

			const uids = frontmatterIndex.getValues(
				"flashcard_uid",
				file.path,
			);
			if (uids.length === 0) continue;

			const info = noteStatusCache.get(uids[0]!);
			if (!info) continue;

			const targetFile = file;
			const statusEl = createLinkStatusElement({
				info,
				onPlay: () => onReviewNote(targetFile),
			});
			linkEl.insertAdjacentElement("beforebegin", statusEl);
		}
	};
}
