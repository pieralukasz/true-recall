import { computed, signal } from "@preact/signals";
import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import { State } from "ts-fsrs";
// ── Central scheduling index ────────────────────────────────
// Lightweight CardSchedulingMeta (no template rendering).
// After mutations, updateCard/removeCard apply O(1) incremental patches.
const _cards = signal(new Map());
export const cards = _cards;
let queryService = null;
export function initCardStore(qs) {
    queryService = qs;
}
/** Full refresh — used on startup only. */
export function refreshCards(qs) {
    const svc = qs !== null && qs !== void 0 ? qs : queryService;
    if (!svc)
        return;
    try {
        const all = svc.getAllMeta();
        _cards.value = new Map(all.map((c) => [c.id, c]));
    }
    catch (e) {
        console.error("[reactive-card-store] refreshCards failed:", e);
    }
}
/** Incremental update — fetch one card's scheduling meta and patch the Map. */
export function updateCard(cardId) {
    if (!queryService)
        return;
    const meta = queryService.getMetaById(cardId);
    const map = new Map(_cards.value);
    if (meta) {
        map.set(cardId, meta);
    }
    else {
        map.delete(cardId);
    }
    _cards.value = map;
}
/** Incremental removal. */
export function removeCard(cardId) {
    const map = new Map(_cards.value);
    if (map.delete(cardId)) {
        _cards.value = map;
    }
}
/** Batch incremental removal. */
export function removeCards(cardIds) {
    const map = new Map(_cards.value);
    let changed = false;
    for (const id of cardIds) {
        if (map.delete(id))
            changed = true;
    }
    if (changed)
        _cards.value = map;
}
// ── Plugin settings signal ───────────────────────────────────
const _pluginSettings = signal(DEFAULT_SETTINGS);
export const pluginSettings = _pluginSettings;
export function refreshSettings(settings) {
    _pluginSettings.value = Object.assign({}, settings);
}
let metadataService = null;
const _archivedSourceUids = signal(new Set());
export const archivedSourceUids = _archivedSourceUids;
export function initMetadataStore(svc) {
    metadataService = svc;
}
export function refreshMetadata() {
    if (!metadataService)
        return;
    _archivedSourceUids.value = metadataService.getArchivedSourceUids();
}
const _hierarchyVersion = signal(0);
export const hierarchyVersion = _hierarchyVersion;
export function refreshHierarchy() {
    _hierarchyVersion.value++;
}
// ── Derived computeds ───────────────────────────────────────
export const allCardsArray = computed(() => [...cards.value.values()]);
export const globalCounts = computed(() => {
    var _a;
    const now = new Date();
    const archived = _archivedSourceUids.value;
    let newCount = 0;
    let learning = 0;
    let due = 0;
    let total = 0;
    let suspended = 0;
    for (const card of cards.value.values()) {
        if (archived.has((_a = card.sourceUid) !== null && _a !== void 0 ? _a : ""))
            continue;
        total++;
        const fsrs = card.fsrs;
        if (fsrs.suspended) {
            suspended++;
            continue;
        }
        if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
            continue;
        switch (fsrs.state) {
            case State.New:
                newCount++;
                break;
            case State.Learning:
            case State.Relearning:
                learning++;
                break;
            case State.Review:
                if (new Date(fsrs.due) <= now)
                    due++;
                break;
        }
    }
    return { newCount, learning, due, total, suspended };
});
export const cardsBySourceUid = computed(() => {
    const map = new Map();
    for (const card of cards.value.values()) {
        const uid = card.sourceUid;
        if (!uid)
            continue;
        let arr = map.get(uid);
        if (!arr) {
            arr = [];
            map.set(uid, arr);
        }
        arr.push(card);
    }
    return map;
});
export const noteStatusMap = computed(() => {
    const map = new Map();
    const now = new Date();
    for (const card of cards.value.values()) {
        const uid = card.sourceUid;
        if (!uid)
            continue;
        let info = map.get(uid);
        if (!info) {
            info = { new: 0, learning: 0, dueToday: 0, total: 0 };
            map.set(uid, info);
        }
        info.total++;
        const fsrs = card.fsrs;
        if (fsrs.suspended)
            continue;
        if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
            continue;
        switch (fsrs.state) {
            case State.New:
                info.new++;
                break;
            case State.Learning:
            case State.Relearning:
                info.learning++;
                break;
            case State.Review:
                if (new Date(fsrs.due) <= now)
                    info.dueToday++;
                break;
        }
    }
    return map;
});
