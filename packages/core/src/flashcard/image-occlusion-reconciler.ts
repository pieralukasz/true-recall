import type { DomainEventBus } from "../events/event-bus";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { generateCardsForNote } from "../services/cards/card-generation.service";
import type { FSRSCardData } from "../types";
import {
	BUILTIN_IMAGE_OCCLUSION_ID,
	type Note,
	type NoteType,
} from "../types/note.types";
import {
	normalizeIOImagePath,
	serializeIODefinition,
} from "../utils/io-definition";
import type {
	CreateImageOcclusionNoteParams,
	CreateNoteResult,
	UpdateImageOcclusionNoteParams,
	UpdateNoteFieldsResult,
} from "./flashcard.types";
import type { NoteCreationService } from "./note-creation.service";

export class ImageOcclusionReconciler {
	constructor(
		private getStore: () => SqliteStoreService | null,
		private creation: NoteCreationService,
		private updateFields: (
			noteId: string,
			fields: Record<string, string>,
		) => UpdateNoteFieldsResult,
		private removeReviewedCards: (ids: string[]) => void,
		private emitEvent: DomainEventBus["emit"],
	) {}
	private get store() {
		return this.getStore();
	}

	createImageOcclusionNote(
		params: CreateImageOcclusionNoteParams,
	): CreateNoteResult {
		const imagePath = normalizeIOImagePath(params.imagePath);
		if (!imagePath) {
			throw new Error("Image path is required");
		}

		return this.creation.createNote({
			noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
			fields: {
				Image: imagePath,
				Regions: serializeIODefinition(params.definition),
			},
			sourceUid: params.sourceUid,
			sourceText: params.sourceText,
			createdVia: params.createdVia ?? "manual",
		});
	}

	updateImageOcclusionNote(
		noteId: string,
		params: UpdateImageOcclusionNoteParams,
	): UpdateNoteFieldsResult {
		const imagePath = normalizeIOImagePath(params.imagePath);
		if (!imagePath) {
			throw new Error("Image path is required");
		}

		return this.updateFields(noteId, {
			Image: imagePath,
			Regions: serializeIODefinition(params.definition),
		});
	}

	reconcileImageOcclusionCards(
		note: Note,
		noteType: NoteType,
		fields: Record<string, string>,
	): UpdateNoteFieldsResult {
		const updatedNote: Note = { ...note, fields };
		const existingCards = this.store?.cards.getCardsByNoteId(note.id) ?? [];
		const existingOrds = new Set(
			existingCards.map((card) => card.templateOrd ?? 0),
		);

		const desiredGenerated = generateCardsForNote(updatedNote, noteType);
		const desiredOrds = new Set(
			desiredGenerated.map((card) => card.templateOrd),
		);

		// Keep existing cards whose ord still exists in new definition.
		const keptCards = existingCards.filter((card) =>
			desiredOrds.has(card.templateOrd ?? 0),
		);

		const removedCardIds = existingCards
			.filter((card) => !desiredOrds.has(card.templateOrd ?? 0))
			.map((card) => card.id);

		const createdCards: FSRSCardData[] = [];
		for (const gen of desiredGenerated) {
			if (existingOrds.has(gen.templateOrd)) continue;
			createdCards.push(
				this.creation.createCardFromGenerated(gen, updatedNote, noteType),
			);
		}

		if (removedCardIds.length > 0) {
			this.store?.cards.bulkSoftDelete(removedCardIds);
			this.removeReviewedCards(removedCardIds);
			this.emitEvent("cards:bulk", {
				cardIds: removedCardIds,
				action: "removed",
			});
		}

		const updatedCardIds = [
			...keptCards.map((card) => card.id),
			...createdCards.map((card) => card.id),
		];

		if (updatedCardIds.length > 0) {
			this.emitEvent("cards:bulk", {
				cardIds: updatedCardIds,
			});
		}

		return { updatedCardIds };
	}
}
