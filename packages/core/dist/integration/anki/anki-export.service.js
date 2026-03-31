import { __awaiter } from "tslib";
import { ApkgBuilderService } from "./apkg/apkg-builder.service";
export class AnkiExportService {
    constructor(store, _fsrsService, sourceUidResolver, mediaReader) {
        this.store = store;
        this.sourceUidResolver = sourceUidResolver;
        this.mediaReader = mediaReader;
    }
    exportApkg(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const allCards = this.store.getAll();
            const mode = (_a = options.exportMode) !== null && _a !== void 0 ? _a : "all";
            const cards = this.resolveAndFilter(allCards, mode, options);
            if (cards.length === 0) {
                throw new Error("No cards to export");
            }
            const reviewLogs = options.includeScheduling
                ? this.getReviewLogsForCards(cards)
                : [];
            const media = options.includeMedia
                ? yield this.collectMedia(cards)
                : new Map();
            const deckMap = this.buildDeckMap(cards);
            const collectionCreatedAt = this.getCollectionCreatedAt(cards);
            const builder = new ApkgBuilderService();
            const data = yield builder.build({
                cards,
                reviewLogs,
                deckMap,
                collectionCreatedAt,
                includeScheduling: options.includeScheduling,
                media,
            });
            const date = new Date().toISOString().slice(0, 10);
            const filename = `true-recall-export-${date}.apkg`;
            return { data, filename };
        });
    }
    resolveAndFilter(allCards, mode, options) {
        var _a;
        const sourceUidMap = this.sourceUidResolver.resolveSourceUids();
        const enriched = allCards.map((card) => {
            var _a;
            const info = card.sourceUid
                ? sourceUidMap.get(card.sourceUid)
                : undefined;
            const sourceNoteName = (_a = info === null || info === void 0 ? void 0 : info.name) !== null && _a !== void 0 ? _a : card.sourceNoteName;
            return Object.assign(Object.assign({}, card), { sourceNoteName });
        });
        if (mode === "notes" && ((_a = options.sourceUids) === null || _a === void 0 ? void 0 : _a.length)) {
            const uidSet = new Set(options.sourceUids);
            return enriched.filter((card) => card.sourceUid && uidSet.has(card.sourceUid));
        }
        return enriched;
    }
    buildDeckMap(cards) {
        var _a;
        const deckMap = new Map();
        deckMap.set("Default", { id: 1, name: "Default" });
        for (const card of cards) {
            const key = (_a = card.sourceNoteName) !== null && _a !== void 0 ? _a : "Default";
            if (key === "Default" || deckMap.has(key))
                continue;
            const id = deckIdFromName(key);
            deckMap.set(key, { id, name: key });
        }
        return deckMap;
    }
    getReviewLogsForCards(cards) {
        const allLogs = this.store.stats.getModifiedReviewLogSince(0);
        const cardIdSet = new Set(cards.map((c) => c.id));
        return allLogs.filter((log) => cardIdSet.has(log.cardId));
    }
    collectMedia(cards) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const media = new Map();
            if (!this.mediaReader)
                return media;
            const filenames = new Set();
            const mediaRegex = /!\[\[([^\]]+)\]\]/g;
            for (const card of cards) {
                const content = ((_a = card.question) !== null && _a !== void 0 ? _a : "") + ((_b = card.answer) !== null && _b !== void 0 ? _b : "");
                for (let match = mediaRegex.exec(content); match !== null; match = mediaRegex.exec(content)) {
                    if (match[1])
                        filenames.add(match[1]);
                }
            }
            for (const filename of filenames) {
                try {
                    const data = yield this.mediaReader.readBinaryByName(filename);
                    if (data) {
                        media.set(filename, data);
                    }
                }
                catch (_c) {
                    console.error(`[True Recall] Could not read media file: ${filename}`);
                }
            }
            return media;
        });
    }
    getCollectionCreatedAt(cards) {
        let earliest = Date.now();
        for (const card of cards) {
            if (card.createdAt && card.createdAt < earliest) {
                earliest = card.createdAt;
            }
        }
        return Math.floor(earliest / 1000);
    }
}
function deckIdFromName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash) + 2000000000;
}
