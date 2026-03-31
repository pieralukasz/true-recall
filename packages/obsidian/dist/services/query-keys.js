/**
 * Query Keys — typed constants for all registered queries.
 *
 * Each view registers its queries using these keys.
 * The invalidation map uses query GROUPS (see invalidation-map.ts).
 * These keys are for individual query identity within groups.
 */
export const QK = {
    // ── Cards group ─────────────────────────────────────
    /** Map<string, FSRSFlashcardItem> — all enriched cards from SQL */
    ALL_CARDS: "allCards",
    /** GlobalCounts — aggregated counts (new, learning, due, total, suspended) */
    GLOBAL_COUNTS: "globalCounts",
    /** Map<sourceUid, FSRSFlashcardItem[]> — cards grouped by note */
    CARDS_BY_SOURCE_UID: "cardsBySourceUid",
    /** Map<sourceUid, NoteStatusInfo> — per-note status badges */
    NOTE_STATUS: "noteStatus",
    // ── Browser group ───────────────────────────────────
    // Browser queries are parameterized — keys include filter hash
    // so multiple filter states can coexist. Use browserKey() helper.
    // ── Dashboard group ─────────────────────────────────
    DASHBOARD_SNAPSHOT: "dashboardSnapshot",
    // ── Review group ────────────────────────────────────
    REVIEW_QUEUE: "reviewQueue",
    // ── Panel group ─────────────────────────────────────
    // Panel queries are per-sourceUid. Use panelKey() helper.
    // ── Stats group ─────────────────────────────────────
    STATS_SNAPSHOT: "statsSnapshot",
};
/** Build a browser query key from a hash of the filter/sort state */
export function browserKey(filterHash) {
    return `browser:${filterHash}`;
}
/** Build a panel query key from the source UID of the active note */
export function panelKey(sourceUid) {
    return `panel:${sourceUid}`;
}
