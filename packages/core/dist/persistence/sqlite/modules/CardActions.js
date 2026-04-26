import { CardBulkActions } from "./cards/card-bulk-actions";
import { CardQueryActions } from "./cards/card-query-actions";
import { CardWriteActions } from "./cards/card-write-actions";
/**
 * Facade over card persistence operations.
 *
 * Delegates to focused sub-modules:
 * - CardQueryActions  — reads, lookups, content checks
 * - CardWriteActions  — single-card writes, updates, sync
 * - CardBulkActions   — bulk suspend/bury/delete/forget/reschedule
 */
export class CardActions {
    constructor(db) {
        this.queries = new CardQueryActions(db);
        this.writes = new CardWriteActions(db);
        this.bulk = new CardBulkActions(db);
    }
    // ── Scheduling-only reads ────────────────────────────────
    getAllSchedulingMeta() {
        return this.queries.getAllSchedulingMeta();
    }
    getSchedulingMetaById(cardId) {
        return this.queries.getSchedulingMetaById(cardId);
    }
    // ── Full card reads ──────────────────────────────────────
    get(cardId) {
        return this.queries.get(cardId);
    }
    getAll() {
        return this.queries.getAll();
    }
    getByIds(cardIds) {
        return this.queries.getByIds(cardIds);
    }
    getCardsBySourceUid(sourceUid) {
        return this.queries.getCardsBySourceUid(sourceUid);
    }
    getBySourceUid(sourceUid) {
        return this.queries.getBySourceUid(sourceUid);
    }
    getCardsWithContent() {
        return this.queries.getCardsWithContent();
    }
    getAllIncludingDeleted() {
        return this.queries.getAllIncludingDeleted();
    }
    getModifiedSince(timestamp) {
        return this.queries.getModifiedSince(timestamp);
    }
    getDueCardsByDateRange(startDate, endDate) {
        return this.queries.getDueCardsByDateRange(startDate, endDate);
    }
    browserQuery(where, params, orderBy, limit, offset) {
        return this.queries.browserQuery(where, params, orderBy, limit, offset);
    }
    browserCount(where, params) {
        return this.queries.browserCount(where, params);
    }
    // ── Sibling / relationship queries ────────────────────────
    getCardByReverseOf(originalCardId) {
        return this.queries.getCardByReverseOf(originalCardId);
    }
    getCardsByNoteId(noteId) {
        return this.queries.getCardsByNoteId(noteId);
    }
    getNoteInfoForCardIds(cardIds) {
        return this.queries.getNoteInfoForCardIds(cardIds);
    }
    findClozeCard(sourceUid, clozeTemplate, clozeIndex) {
        return this.queries.findClozeCard(sourceUid, clozeTemplate, clozeIndex);
    }
    getIOChildren(parentId) {
        return this.queries.getIOChildren(parentId);
    }
    getClozeSiblings(sourceUid, clozeTemplate) {
        return this.queries.getClozeSiblings(sourceUid, clozeTemplate);
    }
    // ── Lookup methods ────────────────────────────────────────
    getCardIdByQuestion(question) {
        return this.queries.getCardIdByQuestion(question);
    }
    getCardInfoByQuestion(question, excludeCardId) {
        return this.queries.getCardInfoByQuestion(question, excludeCardId);
    }
    getCardIdByQuestionAndClozeIndex(question, clozeIndex) {
        return this.queries.getCardIdByQuestionAndClozeIndex(question, clozeIndex);
    }
    // ── Content checks ────────────────────────────────────────
    hasCardContent(cardId) {
        return this.queries.hasCardContent(cardId);
    }
    hasAnyCardContent() {
        return this.queries.hasAnyCardContent();
    }
    getCardsWithContentCount() {
        return this.queries.getCardsWithContentCount();
    }
    // ── FSRS-only methods ────────────────────────────────────
    has(cardId) {
        return this.queries.has(cardId);
    }
    keys() {
        return this.queries.keys();
    }
    size() {
        return this.queries.size();
    }
    // ── Write methods ────────────────────────────────────────
    set(cardId, data) {
        this.writes.set(cardId, data);
    }
    updateCardContent(cardId, question, answer) {
        this.writes.updateCardContent(cardId, question, answer);
    }
    updateClozeCardContent(cardId, question, answer, clozeTemplate) {
        this.writes.updateClozeCardContent(cardId, question, answer, clozeTemplate);
    }
    upsertFromRemote(data) {
        return this.writes.upsertFromRemote(data);
    }
    softDelete(cardId) {
        this.writes.softDelete(cardId);
    }
    /** @deprecated Use softDelete() instead for sync compatibility */
    delete(cardId) {
        this.writes.delete(cardId);
    }
    updateCardSourceUid(cardId, sourceUid) {
        this.writes.updateCardSourceUid(cardId, sourceUid);
    }
    softDeleteWithCascade(cardId) {
        this.writes.softDeleteWithCascade(cardId);
    }
    updateCardDue(cardId, newDue) {
        this.writes.updateCardDue(cardId, newDue);
    }
    updateCardScheduling(cardId, data) {
        this.writes.updateCardScheduling(cardId, data);
    }
    // ── Sync ──────────────────────────────────────────────────
    getSyncMetadata(key) {
        return this.writes.getSyncMetadata(key);
    }
    setSyncMetadata(key, value) {
        this.writes.setSyncMetadata(key, value);
    }
    deleteAllForSync() {
        this.writes.deleteAllForSync();
    }
    // ── Bulk operations ───────────────────────────────────────
    bulkSuspend(cardIds) {
        return this.bulk.bulkSuspend(cardIds);
    }
    bulkUnsuspend(cardIds) {
        return this.bulk.bulkUnsuspend(cardIds);
    }
    bulkBury(cardIds, untilDate) {
        return this.bulk.bulkBury(cardIds, untilDate);
    }
    bulkUnbury(cardIds) {
        return this.bulk.bulkUnbury(cardIds);
    }
    bulkSoftDelete(cardIds) {
        return this.bulk.bulkSoftDelete(cardIds);
    }
    /** @deprecated Use bulkSoftDelete() instead for sync compatibility */
    bulkDelete(cardIds) {
        return this.bulk.bulkDelete(cardIds);
    }
    /** @deprecated Use bulkForget() instead — it also clears review history */
    bulkReset(cardIds) {
        return this.bulk.bulkReset(cardIds);
    }
    bulkForget(cardIds) {
        return this.bulk.bulkForget(cardIds);
    }
    bulkReschedule(cardIds, dueDate) {
        return this.bulk.bulkReschedule(cardIds, dueDate);
    }
    softDeleteIOFamily(parentId) {
        return this.bulk.softDeleteIOFamily(parentId, (id) => this.queries.getIOChildren(id));
    }
}
