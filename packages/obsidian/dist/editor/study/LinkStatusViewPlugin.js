import { __awaiter } from "tslib";
import { Decoration, ViewPlugin, WidgetType, } from "@codemirror/view";
import { aggregateInfos, createLinkStatusElement, createLinkTextCountElement, infoEqual, } from "./LinkStatusWidget";
class LinkStatusWidget extends WidgetType {
    constructor(info, onPlay, variant = "link", sourceUid, getTooltipStats) {
        super();
        this.info = info;
        this.onPlay = onPlay;
        this.variant = variant;
        this.sourceUid = sourceUid;
        this.getTooltipStats = getTooltipStats;
    }
    toDOM() {
        return createLinkStatusElement({
            info: this.info,
            onPlay: this.onPlay,
            variant: this.variant,
            sourceUid: this.sourceUid,
            getTooltipStats: this
                .getTooltipStats,
        });
    }
    eq(other) {
        return (infoEqual(this.info, other.info) &&
            this.variant === other.variant &&
            this.sourceUid === other.sourceUid);
    }
}
class LinkTextCountWidget extends WidgetType {
    constructor(info, onPlay, variant = "link", sourceUid, getTooltipStats) {
        super();
        this.info = info;
        this.onPlay = onPlay;
        this.variant = variant;
        this.sourceUid = sourceUid;
        this.getTooltipStats = getTooltipStats;
    }
    toDOM() {
        return createLinkTextCountElement({
            info: this.info,
            onPlay: this.onPlay,
            variant: this.variant,
            sourceUid: this.sourceUid,
            getTooltipStats: this
                .getTooltipStats,
        });
    }
    eq(other) {
        return (infoEqual(this.info, other.info) &&
            this.variant === other.variant &&
            this.sourceUid === other.sourceUid);
    }
}
// Matches [[link]], [[link|alias]], [[link#heading]], [[link#heading|alias]]
const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;
const HEADING_RE = /^(#{1,6})\s/;
function createTooltipStatsFetcher(store, sourceUid) {
    // async needed: callers (attachTooltipListeners) await the result
    return () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const cards = store.getCardsBySourceUid(sourceUid);
        if (cards.length === 0)
            return null;
        let totalDifficulty = 0;
        let totalLapses = 0;
        let reviewCount = 0;
        let lastReviewed = null;
        let correctReviews = 0;
        let totalReviews = 0;
        for (const card of cards) {
            totalDifficulty += card.difficulty;
            totalLapses += card.lapses;
            if (card.lastReview) {
                reviewCount++;
                if (!lastReviewed || card.lastReview > lastReviewed) {
                    lastReviewed = card.lastReview;
                }
            }
            totalReviews += card.reps;
            correctReviews += Math.max(0, card.reps - card.lapses);
        }
        // 7-day forecast
        const futureDue = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateStr = (_a = date.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
            let count = 0;
            for (const card of cards) {
                if (card.suspended)
                    continue;
                const cardDate = new Date(card.due).toISOString().split("T")[0];
                if (cardDate === dateStr)
                    count++;
            }
            futureDue.push(count);
        }
        return {
            retentionRate: totalReviews > 0 ? correctReviews / totalReviews : null,
            avgDifficulty: cards.length > 0 ? totalDifficulty / cards.length : 0,
            avgLapses: cards.length > 0 ? totalLapses / cards.length : 0,
            lastReviewed,
            reviewCount,
            futureDue,
        };
    });
}
export function createLinkStatusViewPlugin(app, noteStatusCache, frontmatterIndex, getEnabled, getEnabledInReview, onReviewNote, onReviewNotes, cardStore) {
    return ViewPlugin.fromClass(class {
        constructor(view) {
            this.lastCacheVersion = -1;
            this.decorations = this.buildDecorations(view);
        }
        update(update) {
            const currentVersion = noteStatusCache.getVersion();
            if (update.docChanged ||
                update.viewportChanged ||
                currentVersion !== this.lastCacheVersion) {
                this.decorations = this.buildDecorations(update.view);
            }
        }
        buildDecorations(view) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            if (!getEnabled() || !noteStatusCache.hasData()) {
                this.lastCacheVersion = noteStatusCache.getVersion();
                return Decoration.none;
            }
            if (!getEnabledInReview() &&
                view.dom.closest('[data-type="true-recall-review"]')) {
                this.lastCacheVersion = noteStatusCache.getVersion();
                return Decoration.none;
            }
            const sourcePath = (_b = (_a = app.workspace.getActiveFile()) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "";
            const resolveLink = (linkText) => {
                const file = app.metadataCache.getFirstLinkpathDest(linkText, sourcePath);
                if (!file)
                    return null;
                const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
                if (uids.length === 0)
                    return null;
                const uid = uids[0];
                if (!uid)
                    return null;
                const info = noteStatusCache.get(uid);
                if (!info)
                    return null;
                return { noteName: file.basename, info, sourceUid: uid };
            };
            // Two-pass approach: first collect all decorations, then add in order.
            // RangeSetBuilder requires positions in ascending order.
            const decorations = [];
            for (const { from, to } of view.visibleRanges) {
                const text = view.state.doc.sliceString(from, to);
                // Pass 1: per-link donuts
                WIKI_LINK_RE.lastIndex = 0;
                for (let match = WIKI_LINK_RE.exec(text); match !== null; match = WIKI_LINK_RE.exec(text)) {
                    const linkText = match[1];
                    if (!linkText)
                        continue;
                    const absoluteStart = from + match.index;
                    const file = app.metadataCache.getFirstLinkpathDest(linkText, sourcePath);
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
                    const tooltipFetcher = cardStore
                        ? createTooltipStatsFetcher(cardStore, uid)
                        : undefined;
                    decorations.push({
                        pos: absoluteStart,
                        decoration: Decoration.widget({
                            widget: new LinkStatusWidget(info, () => onReviewNote(targetFile), "link", uid, tooltipFetcher),
                            side: -1,
                        }),
                    });
                    decorations.push({
                        pos: absoluteStart + ((_d = (_c = match[0]) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0),
                        decoration: Decoration.widget({
                            widget: new LinkTextCountWidget(info, () => onReviewNote(targetFile), "link", uid, tooltipFetcher),
                            side: 1,
                        }),
                    });
                }
                // Pass 2: heading summaries
                const lines = text.split("\n");
                let charPos = from;
                const headings = [];
                const lineStartPositions = [];
                for (const line of lines) {
                    const headingMatch = HEADING_RE.exec(line);
                    if (headingMatch) {
                        headings.push({
                            level: (_f = (_e = headingMatch[1]) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0,
                            lineEndPos: charPos + line.length,
                        });
                        lineStartPositions.push(charPos);
                    }
                    charPos += line.length + 1;
                }
                const doc = view.state.doc;
                for (let i = 0; i < headings.length; i++) {
                    const heading = headings[i];
                    if (!heading)
                        continue;
                    // Find section end from the full document so folded content is included
                    const nextLineNum = doc.lineAt(heading.lineEndPos).number + 1;
                    let sectionEnd = doc.length;
                    for (let ln = nextLineNum; ln <= doc.lines; ln++) {
                        const m = HEADING_RE.exec(doc.line(ln).text);
                        if (m && ((_h = (_g = m[1]) === null || _g === void 0 ? void 0 : _g.length) !== null && _h !== void 0 ? _h : 0) <= heading.level) {
                            sectionEnd = doc.line(ln).from;
                            break;
                        }
                    }
                    const sectionText = view.state.doc.sliceString(heading.lineEndPos, sectionEnd);
                    WIKI_LINK_RE.lastIndex = 0;
                    const sectionLinks = [];
                    const seen = new Set();
                    for (let linkMatch = WIKI_LINK_RE.exec(sectionText); linkMatch !== null; linkMatch = WIKI_LINK_RE.exec(sectionText)) {
                        const linkText = linkMatch[1];
                        if (!linkText)
                            continue;
                        const resolved = resolveLink(linkText);
                        if (!resolved || seen.has(resolved.noteName))
                            continue;
                        seen.add(resolved.noteName);
                        sectionLinks.push(resolved);
                    }
                    if (sectionLinks.length < 2)
                        continue;
                    const aggregated = aggregateInfos(sectionLinks.map((l) => l.info));
                    const noteNames = sectionLinks.map((l) => l.noteName);
                    const reviewSection = () => onReviewNotes(noteNames, false);
                    const lineStartPos = lineStartPositions[i];
                    if (lineStartPos === undefined)
                        continue;
                    decorations.push({
                        pos: lineStartPos,
                        decoration: Decoration.widget({
                            widget: new LinkStatusWidget(aggregated, reviewSection, `h${heading.level}`),
                            side: -1,
                        }),
                    });
                    decorations.push({
                        pos: heading.lineEndPos,
                        decoration: Decoration.widget({
                            widget: new LinkTextCountWidget(aggregated, reviewSection, `h${heading.level}`),
                            side: 1,
                        }),
                    });
                }
            }
            this.lastCacheVersion = noteStatusCache.getVersion();
            return Decoration.set(decorations.map(({ pos, decoration }) => decoration.range(pos)), true);
        }
    }, {
        decorations: (v) => v.decorations,
    });
}
