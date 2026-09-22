import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import { createDefaultFSRSData } from "../../types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
} from "../../types/note.types";
import { type CardMarker, type MarkdownCard, ScheduleSchema } from "./parser";

type MarkdownStore = Pick<
	SqliteStoreService,
	"cards" | "notes" | "transaction"
>;
const REMOVED_TAG = "true-recall/markdown-removed";
export const markdownCardId = (noteId: string, ordinal: number): string =>
	`${noteId}:${ordinal}`;

export class MarkdownCardSyncService {
	constructor(private store: MarkdownStore) {}

	validateOwnership(cards: MarkdownCard[], sourceUid: string): void {
		for (const { marker } of cards) {
			if (!marker)
				throw new Error("Save flashcard IDs to the note before importing.");
			const existing = this.store.notes.getRawRowsByIds([marker.id])[0];
			if (
				existing &&
				(existing.created_via !== "markdown" ||
					existing.source_uid !== sourceUid)
			) {
				throw new Error(
					"This card ID belongs to another note. Remove the copied marker to generate a new ID.",
				);
			}
		}
	}

	sync(
		cards: MarkdownCard[],
		sourceUid: string,
		importScheduling: boolean,
	): string[] {
		this.validateOwnership(cards, sourceUid);
		const changed = new Set<string>();
		this.store.transaction(() => {
			for (const card of cards) {
				const marker = card.marker;
				if (!marker) continue;
				const existing = this.store.notes.getById(marker.id);
				// A deletion made in the card browser must not be undone by a vault scan.
				if (!existing && this.store.notes.hasRow(marker.id)) continue;
				const noteTypeId = card.reversed
					? BUILTIN_BASIC_REVERSED_ID
					: BUILTIN_BASIC_ID;
				const fields = { Front: card.front, Back: card.back };
				const restoring = existing?.tags.includes(REMOVED_TAG) ?? false;
				if (!existing)
					this.store.notes.create({
						id: marker.id,
						noteTypeId,
						fields,
						tags: [],
						sourceUid,
						createdVia: "markdown",
					});
				else if (
					restoring ||
					existing.noteTypeId !== noteTypeId ||
					existing.fields.Front !== card.front ||
					existing.fields.Back !== card.back
				) {
					this.store.notes.update(marker.id, {
						fields,
						noteTypeId,
						tags: existing.tags.filter((tag) => tag !== REMOVED_TAG),
					});
					for (const old of this.store.cards.getCardsByNoteId(marker.id))
						changed.add(old.id);
				}
				for (let ordinal = 0; ordinal < (card.reversed ? 2 : 1); ordinal++) {
					const id = markdownCardId(marker.id, ordinal);
					const current = this.store.cards.getWithSync(id);
					const schedule = importScheduling
						? marker.schedules?.[ordinal]
						: undefined;
					const restoreOrdinal =
						current?.deletedAt &&
						(restoring ||
							(ordinal === 1 && existing?.noteTypeId !== noteTypeId));
					if (current?.deletedAt && !restoreOrdinal) continue;
					if (restoreOrdinal) {
						this.store.cards.upsertFromRemote({
							...current,
							deletedAt: null,
							updatedAt: Math.max(Date.now(), (current.updatedAt ?? 0) + 1),
						});
						changed.add(id);
					} else if (
						!current ||
						(schedule && schedule.updatedAt > (current.updatedAt ?? 0))
					) {
						this.store.cards.upsertFromRemote({
							...createDefaultFSRSData(id),
							...schedule,
							id,
							noteId: marker.id,
							templateOrd: ordinal,
							noteTypeId,
							sourceUid,
							cardType: ordinal === 0 ? "basic" : "reversed",
							updatedAt: schedule?.updatedAt ?? Date.now(),
						});
						changed.add(id);
					}
				}
				for (const old of this.store.cards.getCardsByNoteId(marker.id)) {
					if ((old.templateOrd ?? 0) >= (card.reversed ? 2 : 1)) {
						this.store.cards.softDelete(old.id);
						changed.add(old.id);
					}
				}
			}
			const present = new Set(cards.map((card) => card.marker?.id));
			for (const note of this.store.notes.getBySourceUid(sourceUid)) {
				if (note.createdVia !== "markdown" || present.has(note.id)) continue;
				const removed = this.store.cards.getCardsByNoteId(note.id);
				for (const card of removed) {
					this.store.cards.softDelete(card.id);
					changed.add(card.id);
				}
				if (removed.length && !note.tags.includes(REMOVED_TAG))
					this.store.notes.update(
						note.id,
						{ tags: [...note.tags, REMOVED_TAG] },
						"system",
					);
			}
		});
		return [...changed];
	}

	snapshot(marker: CardMarker, reversed: boolean): CardMarker {
		return {
			v: 1,
			id: marker.id,
			schedules: Array.from({ length: reversed ? 2 : 1 }, (_, ordinal) => {
				const card = this.store.cards.getWithSync(
					markdownCardId(marker.id, ordinal),
				);
				return card && !card.deletedAt ? ScheduleSchema.parse(card) : null;
			}),
		};
	}
}
