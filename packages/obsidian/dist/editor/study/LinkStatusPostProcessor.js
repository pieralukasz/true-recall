import { aggregateInfos, createLinkStatusElement, createLinkTextCountElement, } from "./LinkStatusWidget";
export function createLinkStatusPostProcessor(app, noteStatusCache, frontmatterIndex, getEnabled, getEnabledInPanel, onReviewNote, onReviewNotes) {
    return (el, ctx) => {
        var _a, _b, _c;
        if (!getEnabled() || !noteStatusCache.hasData())
            return;
        if (!getEnabledInPanel() &&
            el.closest('[data-type="true-recall-flashcard-panel"]'))
            return;
        const sourcePath = ctx.sourcePath;
        // Per-link donuts
        const links = Array.from(el.querySelectorAll("a.internal-link"));
        for (const linkEl of links) {
            const href = linkEl.getAttribute("data-href");
            if (!href)
                continue;
            if ((_a = linkEl.previousElementSibling) === null || _a === void 0 ? void 0 : _a.classList.contains("ep-donut")) {
                continue;
            }
            const file = app.metadataCache.getFirstLinkpathDest(href, sourcePath);
            if (!file)
                continue;
            const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
            if (uids.length === 0)
                continue;
            const uid = uids[0];
            if (!uid)
                continue;
            const info = noteStatusCache.get(uid);
            if (!info)
                continue;
            const targetFile = file;
            const statusEl = createLinkStatusElement({
                info,
                onPlay: () => onReviewNote(targetFile),
            });
            linkEl.insertAdjacentElement("beforebegin", statusEl);
            if (!((_b = linkEl.nextElementSibling) === null || _b === void 0 ? void 0 : _b.classList.contains("ep-link-count"))) {
                const textCountEl = createLinkTextCountElement({
                    info,
                    onPlay: () => onReviewNote(targetFile),
                    variant: "link",
                });
                linkEl.insertAdjacentElement("afterend", textCountEl);
            }
        }
        // Heading summaries
        const headings = Array.from(el.querySelectorAll("h1, h2, h3, h4, h5, h6"));
        for (const heading of headings) {
            if (heading.querySelector(".ep-heading-summary"))
                continue;
            const sectionLinks = collectFlashcardLinksAfterHeading(heading, app, sourcePath, frontmatterIndex, noteStatusCache);
            if (sectionLinks.length < 2)
                continue;
            const aggregated = aggregateInfos(sectionLinks.map((l) => l.info));
            const noteNames = sectionLinks.map((l) => l.noteName);
            const reviewSection = () => onReviewNotes(noteNames, false);
            const headingLevel = parseInt((_c = heading.tagName[1]) !== null && _c !== void 0 ? _c : "1", 10);
            const donutEl = createLinkStatusElement({
                info: aggregated,
                onPlay: reviewSection,
                variant: `h${headingLevel}`,
            });
            heading.prepend(donutEl);
            const summaryEl = document.createElement("span");
            summaryEl.className =
                "ep-heading-summary ep:inline-flex ep:items-center ep:gap-1 ep:float-right";
            summaryEl.appendChild(createLinkTextCountElement({
                info: aggregated,
                onPlay: reviewSection,
                variant: `h${headingLevel}`,
            }));
            heading.appendChild(summaryEl);
        }
    };
}
function collectFlashcardLinksAfterHeading(heading, app, sourcePath, frontmatterIndex, noteStatusCache) {
    var _a, _b;
    const results = [];
    const headingLevel = parseInt((_a = heading.tagName[1]) !== null && _a !== void 0 ? _a : "0", 10);
    const seen = new Set();
    let sibling = heading.nextElementSibling;
    while (sibling) {
        const tagName = sibling.tagName;
        if (/^H[1-6]$/.test(tagName)) {
            const siblingLevel = parseInt((_b = tagName[1]) !== null && _b !== void 0 ? _b : "0", 10);
            if (siblingLevel <= headingLevel)
                break;
        }
        const anchorLinks = Array.from(sibling.querySelectorAll("a.internal-link"));
        for (const anchor of anchorLinks) {
            const href = anchor.getAttribute("data-href");
            if (!href)
                continue;
            const resolved = app.metadataCache.getFirstLinkpathDest(href, sourcePath);
            if (!resolved)
                continue;
            const uids = frontmatterIndex.getValues("flashcard_uid", resolved.path);
            if (uids.length === 0)
                continue;
            const uid = uids[0];
            if (!uid || seen.has(uid))
                continue;
            seen.add(uid);
            const info = noteStatusCache.get(uid);
            if (!info)
                continue;
            results.push({ noteName: resolved.basename, info });
        }
        sibling = sibling.nextElementSibling;
    }
    return results;
}
