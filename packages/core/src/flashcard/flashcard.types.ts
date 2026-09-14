import type { FlashcardItem, FSRSCardData } from "../types";
import type { IODefinition } from "../types/image-occlusion.types";
import type { Note } from "../types/note.types";

export interface ScanResult {
	totalCards: number;
	newCardsProcessed: number;
	filesProcessed: number;
}

export interface FlashcardInfo {
	exists: boolean;
	cardCount: number;
	questions: string[];
	flashcards: FlashcardItem[];
	lastModified: number | null;
	sourceUid?: string;
}

export interface CreateNoteParams {
	noteTypeId: string;
	fields: Record<string, string>;
	alwaysTypeIn?: boolean;
	sourceUid?: string;
	sourceText?: string;
	userComment?: string;
	createdVia?: string;
	createdAt?: number;
	/** Silently drop cards whose rendered question already exists (AI path). */
	skipDuplicates?: boolean;
}

export interface CreateNoteResult {
	note: Note;
	cards: FSRSCardData[];
}

export interface UpdateNoteFieldsResult {
	updatedCardIds: string[];
}

export interface ChangeNoteTypeResult {
	keptCardIds: string[];
	createdCardIds: string[];
	deletedCardIds: string[];
}

export interface DeleteFlashcardsResult {
	ok: boolean;
	affectedIds: string[];
	affectedCount: number;
	deletedCardsData: FSRSCardData[];
}

export interface CreateImageOcclusionNoteParams {
	imagePath: string;
	definition: IODefinition;
	sourceUid?: string;
	sourceText?: string;
	createdVia?: string;
}

export interface UpdateImageOcclusionNoteParams {
	imagePath: string;
	definition: IODefinition;
}
