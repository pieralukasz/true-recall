import { FLASHCARD_CONFIG } from "../constants";
import type { DomainEventBus } from "../events/event-bus";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import {
	type GeneratedCard,
	generateCardsForNote,
} from "../services/cards/card-generation.service";
import {
	deriveCardType,
	renderTemplate,
} from "../services/cards/template-engine";
import type { FSRSCardData } from "../types";
import { createDefaultFSRSData } from "../types";
import type { Note, NoteType } from "../types/note.types";
import type { CreateNoteParams, CreateNoteResult } from "./flashcard.types";

export class NoteCreationService {
	constructor(
		private getStore: () => SqliteStoreService | null,
		private emitEvent: DomainEventBus["emit"],
	) {}
	private get store() {
		return this.getStore();
	}

	// ---- Note-based creation (v26) ----

	/**
	 * Create a Note + generate its cards via the note type's templates.
	 * This is the v26 replacement for legacy card creation methods.
	 */
	createNote(params: CreateNoteParams): CreateNoteResult {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const noteType = this.store.noteTypes.getById(params.noteTypeId);
		if (!noteType) {
			throw new Error(`Note type "${params.noteTypeId}" not found`);
		}

		const note: Note = {
			id: crypto.randomUUID(),
			noteTypeId: params.noteTypeId,
			fields: params.fields,
			tags: params.alwaysTypeIn ? [FLASHCARD_CONFIG.alwaysTypeInTag] : [],
			sourceUid: params.sourceUid,
			sourceText: params.sourceText,
			userComment: params.userComment?.trim() || undefined,
			createdVia: params.createdVia ?? "manual",
		};

		let generated = generateCardsForNote(note, noteType);

		// AI generation re-runs over the same source note routinely; with
		// skipDuplicates the cards whose rendered question already exists are
		// dropped instead of duplicated (manual paths keep erroring instead).
		if (params.skipDuplicates) {
			const renderQuestionFor = (ord: number): string => {
				const template =
					noteType.type === 1
						? noteType.templates[0]
						: noteType.templates.find((t) => t.ordinal === ord);
				if (!template) return "";
				return renderTemplate(template.qfmt, {
					fields: params.fields,
					clozeIndex: ord,
				});
			};
			generated = generated.filter((gen) => {
				const question = renderQuestionFor(gen.templateOrd);
				return (
					question.length === 0 ||
					!this.store?.cards.getCardIdByQuestion(question)
				);
			});
			if (generated.length === 0) {
				return { note, cards: [] };
			}
		}

		this.store.notes.create(note);

		const cards: FSRSCardData[] = [];

		for (const gen of generated) {
			const fsrsData = this.createCardFromGenerated(
				gen,
				note,
				noteType,
				params.createdAt,
			);
			cards.push(fsrsData);
		}

		if (cards.length > 0) {
			this.emitEvent("cards:bulk", {
				cardIds: cards.map((c) => c.id),
				action: "added",
			});
		}

		return { note, cards };
	}

	/**
	 * Create multiple Notes from parsed cards in bulk.
	 * Returns all created cards for notification.
	 */
	createNoteBatch(parsedCards: CreateNoteParams[]): {
		notes: Note[];
		cards: FSRSCardData[];
	} {
		if (!this.store) {
			throw new Error("Store not initialized");
		}

		const notes: Note[] = [];
		const cards: FSRSCardData[] = [];

		for (const params of parsedCards) {
			const noteType = this.store.noteTypes.getById(params.noteTypeId);
			if (!noteType) continue;

			const note: Note = {
				id: crypto.randomUUID(),
				noteTypeId: params.noteTypeId,
				fields: params.fields,
				tags: params.alwaysTypeIn ? [FLASHCARD_CONFIG.alwaysTypeInTag] : [],
				sourceUid: params.sourceUid,
				sourceText: params.sourceText,
				userComment: params.userComment?.trim() || undefined,
				createdVia: params.createdVia ?? "manual",
			};

			this.store.notes.create(note);
			notes.push(note);

			const generated = generateCardsForNote(note, noteType);
			for (const gen of generated) {
				cards.push(this.createCardFromGenerated(gen, note, noteType));
			}
		}

		if (cards.length > 0) {
			this.emitEvent("cards:bulk", {
				cardIds: cards.map((c) => c.id),
				action: "added",
			});
		}

		return { notes, cards };
	}

	createCardFromGenerated(
		gen: GeneratedCard,
		note: Note,
		noteType: NoteType,
		createdAt?: number,
	): FSRSCardData {
		const template =
			noteType.templates.find((t) => t.ordinal === gen.templateOrd) ??
			noteType.templates[0];
		if (!template)
			throw new Error(`Note type "${noteType.name}" has no templates`);

		const question = renderTemplate(template.qfmt, {
			fields: note.fields,
			clozeIndex: gen.templateOrd,
		});
		const answer = renderTemplate(template.afmt, {
			fields: note.fields,
			frontSide: "",
			clozeIndex: gen.templateOrd,
		});

		const defaultData = createDefaultFSRSData(gen.id);
		const fsrsData: FSRSCardData = {
			...defaultData,
			question,
			answer,
			sourceUid: gen.sourceUid,
			noteId: gen.noteId,
			templateOrd: gen.templateOrd,
			noteTypeId: note.noteTypeId,
			cardType: deriveCardType(noteType, gen.templateOrd),
			createdVia: note.createdVia,
			sourceText: note.sourceText,
			alwaysTypeIn: note.tags.includes(FLASHCARD_CONFIG.alwaysTypeInTag),
			...(createdAt != null && { createdAt }),
		};

		this.store?.set(gen.id, fsrsData);
		return fsrsData;
	}
}
