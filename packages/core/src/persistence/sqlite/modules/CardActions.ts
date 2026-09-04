import type { CardSchedulingMeta, FSRSCardData } from "../../../types";
import type { NoteEditSource } from "../../../types/note.types";
import type { SqliteDatabase } from "../SqliteDatabase";
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
	private readonly queries: CardQueryActions;
	private readonly writes: CardWriteActions;
	private readonly bulk: CardBulkActions;

	constructor(db: SqliteDatabase) {
		this.queries = new CardQueryActions(db);
		this.writes = new CardWriteActions(db);
		this.bulk = new CardBulkActions(db);
	}

	// ── Scheduling-only reads ────────────────────────────────

	getAllSchedulingMeta(): CardSchedulingMeta[] {
		return this.queries.getAllSchedulingMeta();
	}

	getSchedulingMetaById(cardId: string): CardSchedulingMeta | null {
		return this.queries.getSchedulingMetaById(cardId);
	}

	// ── Full card reads ──────────────────────────────────────

	get(cardId: string): FSRSCardData | undefined {
		return this.queries.get(cardId);
	}

	getAll(): FSRSCardData[] {
		return this.queries.getAll();
	}

	getByIds(cardIds: string[]): FSRSCardData[] {
		return this.queries.getByIds(cardIds);
	}

	getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
		return this.queries.getCardsBySourceUid(sourceUid);
	}

	getBySourceUid(sourceUid: string): FSRSCardData[] {
		return this.queries.getBySourceUid(sourceUid);
	}

	getCardsWithContent(): FSRSCardData[] {
		return this.queries.getCardsWithContent();
	}

	getAllIncludingDeleted(): FSRSCardData[] {
		return this.queries.getAllIncludingDeleted();
	}

	getModifiedSince(
		timestamp: number,
	): (FSRSCardData & { updatedAt?: number; deletedAt?: number | null })[] {
		return this.queries.getModifiedSince(timestamp);
	}

	getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[] {
		return this.queries.getDueCardsByDateRange(startDate, endDate);
	}

	getDueCountsByDateRange(
		startDate: string,
		endDate: string,
		excludeCardId?: string,
	): { day: string; count: number }[] {
		return this.queries.getDueCountsByDateRange(
			startDate,
			endDate,
			excludeCardId,
		);
	}

	browserQuery(
		where: string,
		params: (string | number)[],
		orderBy: string,
		limit: number,
		offset: number,
	): FSRSCardData[] {
		return this.queries.browserQuery(where, params, orderBy, limit, offset);
	}

	browserQueryIds(where: string, params: (string | number)[]): string[] {
		return this.queries.browserQueryIds(where, params);
	}

	browserCount(where: string, params: (string | number)[]): number {
		return this.queries.browserCount(where, params);
	}

	// ── Sibling / relationship queries ────────────────────────

	getCardByReverseOf(originalCardId: string): FSRSCardData | undefined {
		return this.queries.getCardByReverseOf(originalCardId);
	}

	getCardsByNoteId(noteId: string): FSRSCardData[] {
		return this.queries.getCardsByNoteId(noteId);
	}

	getNoteInfoForCardIds(
		cardIds: string[],
	): Array<{ noteId: string; noteTypeId: string }> {
		return this.queries.getNoteInfoForCardIds(cardIds);
	}

	findClozeCard(
		sourceUid: string,
		clozeTemplate: string,
		clozeIndex: number,
	): string | undefined {
		return this.queries.findClozeCard(sourceUid, clozeTemplate, clozeIndex);
	}

	getIOChildren(parentId: string): FSRSCardData[] {
		return this.queries.getIOChildren(parentId);
	}

	getClozeSiblings(sourceUid: string, clozeTemplate: string): FSRSCardData[] {
		return this.queries.getClozeSiblings(sourceUid, clozeTemplate);
	}

	// ── Lookup methods ────────────────────────────────────────

	getCardIdByQuestion(question: string): string | undefined {
		return this.queries.getCardIdByQuestion(question);
	}

	getCardInfoByQuestion(
		question: string,
		excludeCardId?: string,
	): { id: string; sourceUid?: string } | undefined {
		return this.queries.getCardInfoByQuestion(question, excludeCardId);
	}

	getCardIdByQuestionAndClozeIndex(
		question: string,
		clozeIndex: number,
	): string | undefined {
		return this.queries.getCardIdByQuestionAndClozeIndex(question, clozeIndex);
	}

	// ── Content checks ────────────────────────────────────────

	hasCardContent(cardId: string): boolean {
		return this.queries.hasCardContent(cardId);
	}

	hasAnyCardContent(): boolean {
		return this.queries.hasAnyCardContent();
	}

	getCardsWithContentCount(): number {
		return this.queries.getCardsWithContentCount();
	}

	// ── FSRS-only methods ────────────────────────────────────

	has(cardId: string): boolean {
		return this.queries.has(cardId);
	}

	keys(): string[] {
		return this.queries.keys();
	}

	size(): number {
		return this.queries.size();
	}

	// ── Write methods ────────────────────────────────────────

	set(cardId: string, data: FSRSCardData): void {
		this.writes.set(cardId, data);
	}

	updateCardContent(
		cardId: string,
		question: string,
		answer: string,
		editSource: NoteEditSource = "manual",
	): void {
		this.writes.updateCardContent(cardId, question, answer, editSource);
	}

	updateClozeCardContent(
		cardId: string,
		question: string,
		answer: string,
		clozeTemplate: string,
		editSource: NoteEditSource = "manual",
	): void {
		this.writes.updateClozeCardContent(
			cardId,
			question,
			answer,
			clozeTemplate,
			editSource,
		);
	}

	upsertFromRemote(
		data: FSRSCardData & { updatedAt?: number; deletedAt?: number | null },
		preferRemoteOnEqual = false,
	): boolean {
		return this.writes.upsertFromRemote(data, preferRemoteOnEqual);
	}

	softDelete(cardId: string): void {
		this.writes.softDelete(cardId);
	}

	updateCardSourceUid(cardId: string, sourceUid: string): void {
		this.writes.updateCardSourceUid(cardId, sourceUid);
	}

	softDeleteWithCascade(cardId: string): void {
		this.writes.softDeleteWithCascade(cardId);
	}

	restoreWithCascade(cardId: string): void {
		this.writes.restoreWithCascade(cardId);
	}

	updateCardDue(cardId: string, newDue: string): void {
		this.writes.updateCardDue(cardId, newDue);
	}

	updateCardScheduling(
		cardId: string,
		data: { due: string; scheduledDays: number },
	): void {
		this.writes.updateCardScheduling(cardId, data);
	}

	// ── Sync ──────────────────────────────────────────────────

	applyReplayedScheduling(cardId: string, data: FSRSCardData): void {
		this.writes.applyReplayedScheduling(cardId, data);
	}

	getActiveDedupRows(): {
		id: string;
		createdAt: number | null;
		templateOrd: number;
		sourceUid: string;
		fieldsJson: string;
	}[] {
		return this.queries.getActiveDedupRows();
	}

	getSyncMetadata(key: string): string | null {
		return this.writes.getSyncMetadata(key);
	}

	setSyncMetadata(key: string, value: string): void {
		this.writes.setSyncMetadata(key, value);
	}

	/**
	 * Write only when the stored value differs. Every `run` marks the store
	 * dirty, and on mobile a dirty store means a full export and rewrite of
	 * the database file 400 ms later. Startup must not pay that for a label
	 * that has not changed.
	 */
	setSyncMetadataIfChanged(key: string, value: string): boolean {
		if (this.writes.getSyncMetadata(key) === value) return false;
		this.writes.setSyncMetadata(key, value);
		return true;
	}

	deleteAllForSync(): void {
		this.writes.deleteAllForSync();
	}

	// ── Bulk operations ───────────────────────────────────────

	bulkSuspend(cardIds: string[]): number {
		return this.bulk.bulkSuspend(cardIds);
	}

	bulkUnsuspend(cardIds: string[]): number {
		return this.bulk.bulkUnsuspend(cardIds);
	}

	bulkBury(cardIds: string[], untilDate: string): number {
		return this.bulk.bulkBury(cardIds, untilDate);
	}

	bulkUnbury(cardIds: string[]): number {
		return this.bulk.bulkUnbury(cardIds);
	}

	bulkSoftDelete(cardIds: string[]): number {
		return this.bulk.bulkSoftDelete(cardIds);
	}

	bulkForget(cardIds: string[]): number {
		return this.bulk.bulkForget(cardIds);
	}

	bulkReschedule(cardIds: string[], dueDate: string): number {
		return this.bulk.bulkReschedule(cardIds, dueDate);
	}

	softDeleteIOFamily(parentId: string): string[] {
		return this.bulk.softDeleteIOFamily(parentId, (id) =>
			this.queries.getIOChildren(id),
		);
	}
}
