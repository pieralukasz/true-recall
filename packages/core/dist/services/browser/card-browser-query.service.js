import { sqlPlaceholders } from "@true-recall/core/persistence/sqlite/sql-utils";
import { fileBasename } from "@true-recall/core/utils";
import { buildBrowserQuery } from "@true-recall/core/services/browser/browser-query-builder";
export class CardBrowserQueryService {
    constructor(cardStore, frontmatterIndex, hierarchyService) {
        this.cardStore = cardStore;
        this.frontmatterIndex = frontmatterIndex;
        this.hierarchyService = hierarchyService;
    }
    query(filter, sort, limit, offset) {
        // Resolve note: filters from note names to source UIDs
        const resolvedFilter = this.resolveNoteFilters(filter);
        // Don't pass orphaned UIDs via sourceUids — we build the clause manually
        const fts5Available = this.cardStore.notes.isFts5Available();
        const sqlQuery = buildBrowserQuery(resolvedFilter, sort, limit, offset, {
            fts5Available,
        });
        if (resolvedFilter.orphanedOnly) {
            const orphanedUids = this.getOrphanedSourceUids();
            const conditions = ["c.source_uid IS NULL"];
            if (orphanedUids.length > 0) {
                conditions.push(`c.source_uid IN (${sqlPlaceholders(orphanedUids.length)})`);
                sqlQuery.params.push(...orphanedUids);
            }
            sqlQuery.where += ` AND (${conditions.join(" OR ")})`;
        }
        const archivedUids = this.getArchivedSourceUids(!!resolvedFilter.showArchived);
        const sqlWithArchiveFilter = this.applyArchivedFilter(sqlQuery.where, sqlQuery.params, archivedUids);
        const rawCards = this.cardStore.cards.browserQuery(sqlWithArchiveFilter.where, sqlWithArchiveFilter.params, sqlQuery.orderBy, sqlQuery.limit, sqlQuery.offset);
        const totalCount = this.cardStore.cards.browserCount(sqlWithArchiveFilter.where, sqlWithArchiveFilter.params);
        const cards = rawCards.map((card) => this.toBrowserCard(card));
        return { cards, totalCount };
    }
    /** Get sidebar facet counts (states, types, sources, etc.) */
    getFacetCounts(showArchived = false) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const allCards = this.cardStore.cards.getAll();
        const archivedUids = this.getArchivedSourceUids(showArchived);
        const states = {};
        const cardTypes = {};
        const createdVia = {};
        const sourceMap = new Map();
        const now = new Date();
        for (const card of allCards) {
            if (archivedUids.has((_a = card.sourceUid) !== null && _a !== void 0 ? _a : ""))
                continue;
            // State counts (including virtual states)
            if (card.suspended) {
                states.suspended = ((_b = states.suspended) !== null && _b !== void 0 ? _b : 0) + 1;
            }
            else if (card.buriedUntil && new Date(card.buriedUntil) > now) {
                states.buried = ((_c = states.buried) !== null && _c !== void 0 ? _c : 0) + 1;
            }
            else {
                const stateKey = ["new", "learning", "review", "relearning"][card.state];
                if (stateKey)
                    states[stateKey] = ((_d = states[stateKey]) !== null && _d !== void 0 ? _d : 0) + 1;
            }
            // Card type counts
            const ct = (_e = card.cardType) !== null && _e !== void 0 ? _e : "basic";
            cardTypes[ct] = ((_f = cardTypes[ct]) !== null && _f !== void 0 ? _f : 0) + 1;
            // Created via counts
            const cv = (_g = card.createdVia) !== null && _g !== void 0 ? _g : "manual";
            createdVia[cv] = ((_h = createdVia[cv]) !== null && _h !== void 0 ? _h : 0) + 1;
            // Source note counts
            if (card.sourceUid) {
                sourceMap.set(card.sourceUid, ((_j = sourceMap.get(card.sourceUid)) !== null && _j !== void 0 ? _j : 0) + 1);
            }
        }
        const sourceNotes = Array.from(sourceMap.entries())
            .map(([uid, count]) => {
            const filePath = this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
            return {
                uid,
                name: filePath ? fileBasename(filePath) : "(orphaned)",
                count,
            };
        })
            .sort((a, b) => a.name.localeCompare(b.name));
        return { states, cardTypes, createdVia, sourceNotes };
    }
    /** Card IDs with no linked source note (null sourceUid or unresolved) */
    getOrphanedCardIds() {
        const allCards = this.cardStore.cards.getAll();
        const orphanedIds = [];
        for (const card of allCards) {
            if (!card.sourceUid) {
                orphanedIds.push(card.id);
                continue;
            }
            const file = this.frontmatterIndex.getFileByValue("flashcard_uid", card.sourceUid);
            if (!file)
                orphanedIds.push(card.id);
        }
        return orphanedIds;
    }
    /** Unique source UIDs that no longer resolve to a vault note */
    getOrphanedSourceUids() {
        const allCards = this.cardStore.cards.getAll();
        const orphanedUids = new Set();
        for (const card of allCards) {
            if (!card.sourceUid)
                continue;
            if (orphanedUids.has(card.sourceUid))
                continue;
            const file = this.frontmatterIndex.getFileByValue("flashcard_uid", card.sourceUid);
            if (!file)
                orphanedUids.add(card.sourceUid);
        }
        return [...orphanedUids];
    }
    getArchivedSourceUids(showArchived) {
        if (showArchived || !this.hierarchyService)
            return new Set();
        return this.hierarchyService.getArchivedSourceUids();
    }
    applyArchivedFilter(where, params, archivedUids) {
        if (archivedUids.size === 0) {
            return { where, params };
        }
        const ids = [...archivedUids];
        return {
            where: `(${where}) AND (c.source_uid IS NULL OR c.source_uid NOT IN (${sqlPlaceholders(ids.length)}))`,
            params: [...params, ...ids],
        };
    }
    resolveNoteFilters(filter) {
        if (filter.sourceUids.length === 0)
            return filter;
        // sourceUids may contain note names (from "note:Biology")
        // Build a basename→uid lookup from all known flashcard_uid values
        const allUids = this.frontmatterIndex.getAllValues("flashcard_uid");
        const basenameToUid = new Map();
        for (const uid of allUids) {
            const filePath = this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
            if (filePath) {
                basenameToUid.set(fileBasename(filePath).toLowerCase(), uid);
            }
        }
        const resolvedUids = [];
        for (const nameOrUid of filter.sourceUids) {
            const matchedUid = basenameToUid.get(nameOrUid.toLowerCase());
            if (matchedUid) {
                resolvedUids.push(matchedUid);
            }
            else {
                // Not a note name — assume it's already a UID
                resolvedUids.push(nameOrUid);
            }
        }
        return Object.assign(Object.assign({}, filter), { sourceUids: resolvedUids });
    }
    toBrowserCard(card) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const file = card.sourceUid
            ? this.frontmatterIndex.getFileByValue("flashcard_uid", card.sourceUid)
            : null;
        let presetName = null;
        if (file) {
            const vals = this.frontmatterIndex.getValues("fsrs_preset", file);
            if (vals.length > 0 && vals[0])
                presetName = vals[0];
        }
        let projects = [];
        if (file) {
            const vals = this.frontmatterIndex.getValues("parents", file);
            projects = vals.filter(Boolean);
        }
        return {
            id: card.id,
            question: (_a = card.question) !== null && _a !== void 0 ? _a : "",
            answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
            state: card.state,
            due: card.due,
            stability: card.stability,
            difficulty: card.difficulty,
            reps: card.reps,
            lapses: card.lapses,
            scheduledDays: card.scheduledDays,
            lastReview: card.lastReview,
            createdAt: (_c = card.createdAt) !== null && _c !== void 0 ? _c : null,
            suspended: (_d = card.suspended) !== null && _d !== void 0 ? _d : false,
            buriedUntil: (_e = card.buriedUntil) !== null && _e !== void 0 ? _e : null,
            sourceUid: (_f = card.sourceUid) !== null && _f !== void 0 ? _f : null,
            sourceNoteName: (_h = (_g = file === null || file === void 0 ? void 0 : file.split("/").pop()) === null || _g === void 0 ? void 0 : _g.replace(/\.md$/, "")) !== null && _h !== void 0 ? _h : null,
            sourceNotePath: file !== null && file !== void 0 ? file : null,
            cardType: (_j = card.cardType) !== null && _j !== void 0 ? _j : "basic",
            createdVia: (_k = card.createdVia) !== null && _k !== void 0 ? _k : null,
            presetName,
            projects,
            ioImagePath: card.ioImagePath,
            ioRegionsJson: card.ioRegionsJson,
            templateOrd: card.templateOrd,
        };
    }
}
