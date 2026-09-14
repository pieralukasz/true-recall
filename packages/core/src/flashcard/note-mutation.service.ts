import type { DomainEventBus } from "../events/event-bus";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { generateCardsForNote } from "../services/cards/card-generation.service";
import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	type Note,
	type NoteEditSource,
} from "../types/note.types";
import type {
	ChangeNoteTypeResult,
	UpdateNoteFieldsResult,
} from "./flashcard.types";
import type { ImageOcclusionReconciler } from "./image-occlusion-reconciler";
import type { NoteCreationService } from "./note-creation.service";

export class NoteMutationService {
	constructor(
		private getStore: () => SqliteStoreService | null,
		private creation: NoteCreationService,
		private imageOcclusion: ImageOcclusionReconciler,
		private removeReviewedCards: (ids: string[]) => void,
		private emitEvent: DomainEventBus["emit"],
	) {}
	private get store() {
		return this.getStore();
	}

	/**
	 * Update a Note's fields and recompute Q/A for all its cards.
	 * Returns the IDs of cards that were updated.
	 */
	updateNoteFields(
		noteId: string,
		fields: Record<string, string>,
		editSource: NoteEditSource = "manual",
	): UpdateNoteFieldsResult {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const note = this.store.notes.getById(noteId);
		if (!note) {
			throw new Error(`Note "${noteId}" not found`);
		}

		const noteType = this.store.noteTypes.getById(note.noteTypeId);
		if (!noteType) {
			throw new Error(`Note type "${note.noteTypeId}" not found`);
		}

		this.store.notes.update(noteId, { fields }, editSource);

		if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
			return this.imageOcclusion.reconcileImageOcclusionCards(
				note,
				noteType,
				fields,
			);
		}

		const updatedNote: Note = { ...note, fields };

		const existingCards = this.store.cards.getCardsByNoteId(noteId);
		const existingOrds = new Set(existingCards.map((c) => c.templateOrd ?? 0));

		// Reconcile against the full desired card set so editing the fields can
		// remove cards whose template ord no longer exists — e.g. a cloze index
		// that was edited away, or the ord-0 placeholder card once real cloze
		// markers are added. Without this, those orphans linger and render the
		// whole field as a fully-revealed "c0" card.
		const desiredGenerated = generateCardsForNote(updatedNote, noteType);
		const desiredOrds = new Set(desiredGenerated.map((g) => g.templateOrd));

		const deletedCardIds = existingCards
			.filter((c) => !desiredOrds.has(c.templateOrd ?? 0))
			.map((c) => c.id);

		if (deletedCardIds.length > 0) {
			this.store.cards.bulkSoftDelete(deletedCardIds);
			this.removeReviewedCards(deletedCardIds);
			this.emitEvent("cards:bulk", {
				cardIds: deletedCardIds,
				action: "removed",
			});
		}

		const updatedCardIds = existingCards
			.filter((c) => desiredOrds.has(c.templateOrd ?? 0))
			.map((c) => c.id);

		let createdCount = 0;
		for (const gen of desiredGenerated) {
			if (existingOrds.has(gen.templateOrd)) continue;
			const fsrsData = this.creation.createCardFromGenerated(
				gen,
				updatedNote,
				noteType,
			);
			updatedCardIds.push(fsrsData.id);
			createdCount++;
		}

		if (createdCount > 0) {
			this.emitEvent("cards:bulk", {
				cardIds: updatedCardIds,
			});
		} else {
			// Pure field edit: only rendered Q/A changed, scheduling meta is
			// untouched — per-card content-only events let consumers take the
			// narrow invalidation path instead of a full bulk reload.
			for (const cardId of updatedCardIds) {
				this.emitEvent("card:updated", {
					cardId,
					changes: { question: true, answer: true },
				});
			}
		}

		return { updatedCardIds };
	}

	updateNoteComment(noteId: string, userComment: string): string[] {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const note = this.store.notes.getById(noteId);
		if (!note) {
			throw new Error(`Note "${noteId}" not found`);
		}

		const normalizedComment = userComment.trim();
		this.store.notes.update(noteId, { userComment: normalizedComment });
		const cardIds = this.store.cards
			.getCardsByNoteId(noteId)
			.map((card) => card.id);

		for (const cardId of cardIds) {
			this.emitEvent("card:updated", {
				cardId,
				changes: { userComment: true },
			});
		}

		return cardIds;
	}

	changeNoteType(
		noteId: string,
		newNoteTypeId: string,
		fieldMapping: Record<string, string>,
	): ChangeNoteTypeResult {
		if (!this.store) throw new Error("Store not initialized");

		const note = this.store.notes.getById(noteId);
		if (!note) throw new Error(`Note "${noteId}" not found`);

		const newNoteType = this.store.noteTypes.getById(newNoteTypeId);
		if (!newNoteType) throw new Error(`Note type "${newNoteTypeId}" not found`);

		if (note.noteTypeId === newNoteTypeId) {
			return { keptCardIds: [], createdCardIds: [], deletedCardIds: [] };
		}

		// Remap fields: fieldMapping is newFieldName -> oldFieldName
		const newFields: Record<string, string> = {};
		for (const field of newNoteType.fields) {
			const oldFieldName = fieldMapping[field];
			newFields[field] = oldFieldName ? (note.fields[oldFieldName] ?? "") : "";
		}

		this.store.notes.update(noteId, {
			noteTypeId: newNoteTypeId,
			fields: newFields,
		});

		// Reconcile cards
		const updatedNote: Note = {
			...note,
			noteTypeId: newNoteTypeId,
			fields: newFields,
		};
		const existingCards = this.store.cards.getCardsByNoteId(noteId);
		const existingOrds = new Set(existingCards.map((c) => c.templateOrd ?? 0));

		const desiredGenerated = generateCardsForNote(updatedNote, newNoteType);
		const desiredOrds = new Set(desiredGenerated.map((g) => g.templateOrd));

		// Keep cards whose templateOrd still exists
		const keptCardIds = existingCards
			.filter((c) => desiredOrds.has(c.templateOrd ?? 0))
			.map((c) => c.id);

		const deletedCardIds = existingCards
			.filter((c) => !desiredOrds.has(c.templateOrd ?? 0))
			.map((c) => c.id);

		if (deletedCardIds.length > 0) {
			this.store.cards.bulkSoftDelete(deletedCardIds);
			this.removeReviewedCards(deletedCardIds);
		}

		const createdCardIds: string[] = [];
		for (const gen of desiredGenerated) {
			if (existingOrds.has(gen.templateOrd)) continue;
			const card = this.creation.createCardFromGenerated(
				gen,
				updatedNote,
				newNoteType,
			);
			createdCardIds.push(card.id);
		}

		const allAffectedIds = [
			...keptCardIds,
			...createdCardIds,
			...deletedCardIds,
		];
		if (allAffectedIds.length > 0) {
			this.emitEvent("cards:bulk", { cardIds: allAffectedIds });
		}

		return { keptCardIds, createdCardIds, deletedCardIds };
	}
}
