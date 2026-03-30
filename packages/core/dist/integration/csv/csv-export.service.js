const STATE_LABELS = ["New", "Learning", "Review", "Relearning"];
export class CsvExportService {
    constructor(store, sourceUidResolver) {
        this.store = store;
        this.sourceUidResolver = sourceUidResolver;
    }
    export(options) {
        var _a, _b, _c, _d;
        const allCards = this.store.getAll();
        const sourceUidToInfo = this.sourceUidResolver.resolveSourceUids();
        const cards = this.filterAndEnrich(allCards, sourceUidToInfo, options.sourceUids);
        if (cards.length === 0) {
            throw new Error("No cards to export");
        }
        const sep = options.separator;
        const rows = [];
        // Header
        const headers = ["Question", "Answer", "Source Note"];
        if (options.includeScheduling) {
            headers.push("State", "Due", "Interval", "Lapses");
        }
        rows.push(headers.map((h) => this.escapeField(h, sep)).join(sep));
        // Data rows
        for (const card of cards) {
            const fields = [
                (_a = card.question) !== null && _a !== void 0 ? _a : "",
                (_b = card.answer) !== null && _b !== void 0 ? _b : "",
                (_c = card.sourceNoteName) !== null && _c !== void 0 ? _c : "",
            ];
            if (options.includeScheduling) {
                fields.push((_d = STATE_LABELS[card.state]) !== null && _d !== void 0 ? _d : String(card.state), card.due ? new Date(card.due).toISOString().slice(0, 10) : "", String(card.scheduledDays), String(card.lapses));
            }
            rows.push(fields.map((f) => this.escapeField(f, sep)).join(sep));
        }
        const ext = sep === "\t" ? "tsv" : "csv";
        const date = new Date().toISOString().slice(0, 10);
        const filename = `true-recall-export-${date}.${ext}`;
        return { content: rows.join("\n"), filename };
    }
    escapeField(value, separator) {
        // Replace newlines with spaces for CSV compatibility
        const cleaned = value.replace(/\r?\n/g, " ").replace(/\r/g, " ");
        // Quote if contains separator, quotes, or leading/trailing whitespace
        if (cleaned.includes(separator) ||
            cleaned.includes('"') ||
            cleaned !== cleaned.trim()) {
            return `"${cleaned.replace(/"/g, '""')}"`;
        }
        return cleaned;
    }
    filterAndEnrich(allCards, sourceUidToInfo, sourceUidFilter) {
        const enriched = allCards.map((card) => {
            if (card.sourceUid) {
                const info = sourceUidToInfo.get(card.sourceUid);
                if (info) {
                    return Object.assign(Object.assign({}, card), { sourceNoteName: info.name });
                }
            }
            return card;
        });
        if (sourceUidFilter && sourceUidFilter.length > 0) {
            const uidSet = new Set(sourceUidFilter);
            return enriched.filter((card) => card.sourceUid && uidSet.has(card.sourceUid));
        }
        return enriched;
    }
}
