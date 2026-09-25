import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import { createDefaultFSRSData } from "../../types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
} from "../../types/note.types";
import { type ContentPlan, planContent } from "./content-sync";
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

	contentRevision(sourceUid: string): string {
		return JSON.stringify(
			this.store.notes
				.getBySourceUid(sourceUid)
				.filter((note) => note.createdVia === "markdown")
				.map((note) => [
					note.id,
					note.noteTypeId,
					note.fields.Front,
					note.fields.Back,
				])
				.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
		);
	}

	async planContent(
		cards: MarkdownCard[],
		sourceUid: string,
		deviceId: string,
	): Promise<{ plans: ContentPlan[]; revision: string }> {
		const revision = this.contentRevision(sourceUid);
		const notes = new Map(
			this.store.notes
				.getBySourceUid(sourceUid)
				.filter((note) => note.createdVia === "markdown")
				.map((note) => [note.id, note]),
		);
		const plans = await Promise.all(
			cards.map((card) =>
				planContent(
					card,
					card.marker ? notes.get(card.marker.id) : undefined,
					deviceId,
				),
			),
		);
		return { plans, revision };
	}

	private cardForOrdinal(noteId: string, ordinal: number) {
		return this.store.cards.getByNoteOrdinalWithSync(noteId, ordinal);
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
					const current = this.cardForOrdinal(marker.id, ordinal);
					const id = current?.id ?? markdownCardId(marker.id, ordinal);
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
			...marker,
			schedules: Array.from({ length: reversed ? 2 : 1 }, (_, ordinal) => {
				const card = this.cardForOrdinal(marker.id, ordinal);
				return card && !card.deletedAt ? ScheduleSchema.parse(card) : null;
			}),
		};
	}
}
