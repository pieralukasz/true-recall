/**
 * Facade for flashcard operations - delegates to specialized services:
 * CardRepository (CRUD), CardQueryService (reads), FrontmatterService,
 * SourceNoteService
 *
 * Platform-agnostic version: uses IFileSystem, IFrontmatter, IMetadataIndex
 * instead of Obsidian's App.
 */
import { __awaiter } from "tslib";
import { FLASHCARD_CONFIG } from "../constants";
import { generateCardsForNote, } from "../services/cards/card-generation.service";
import { deriveCardType, renderTemplate, } from "../services/cards/template-engine";
import { NoteReviewService } from "../services/note-review/note-review.service";
import { createDefaultFSRSData } from "../types";
import { BUILTIN_IMAGE_OCCLUSION_ID, BUILTIN_NOTE_REVIEW_ID, } from "../types/note.types";
import { normalizeIOImagePath, serializeIODefinition, } from "../utils/io-definition";
import { CardQueryService } from "./data/card-query.service";
import { CardRepository, } from "./data/card-repository.service";
import { FrontmatterService } from "./source/frontmatter.service";
import { SourceNoteService } from "./source/source-note.service";
export class FlashcardManager {
    constructor(fileSystem, frontmatter, _settings, metadataIndex, frontmatterIndex) {
        this.store = null;
        this.sessionPersistence = null;
        this.bus = null;
        this.busWarnLogged = false;
        // Specialized services (initialized after setStore)
        this.cardRepository = null;
        this.cardQueryService = null;
        this._noteReview = null;
        this.frontmatterService = new FrontmatterService(fileSystem, frontmatter);
        this.sourceNoteService = new SourceNoteService(fileSystem, frontmatter, metadataIndex);
        void frontmatterIndex;
    }
    setEventBus(bus) {
        var _a;
        this.bus = bus;
        (_a = this.cardRepository) === null || _a === void 0 ? void 0 : _a.setEventBus(bus);
    }
    setStore(store) {
        this.store = store;
        this.cardRepository = new CardRepository(store);
        if (this.bus)
            this.cardRepository.setEventBus(this.bus);
        this.cardQueryService = new CardQueryService(store, this.sourceNoteService);
        this._noteReview = new NoteReviewService(store);
    }
    setSessionPersistence(sessionPersistence) {
        this.sessionPersistence = sessionPersistence;
    }
    hasStore() {
        var _a, _b;
        return (_b = (_a = this.store) === null || _a === void 0 ? void 0 : _a.isReady()) !== null && _b !== void 0 ? _b : false;
    }
    getCardQueryService() {
        if (!this.cardQueryService) {
            throw new Error("Store not initialized.");
        }
        return this.cardQueryService;
    }
    /** Returns true if card was saved, false if skipped (already exists) */
    setStoreData(cardId, fsrsData) {
        if (!this.cardRepository) {
            throw new Error("Store not initialized");
        }
        return this.cardRepository.setIfNotExists(cardId, fsrsData);
    }
    updateSettings(_settings) {
        // Settings consumed by sub-services, not directly by FlashcardManager
    }
    getNoteTypeBySlug(slug) {
        var _a, _b;
        return (_b = (_a = this.store) === null || _a === void 0 ? void 0 : _a.noteTypes.getBySlug(slug)) !== null && _b !== void 0 ? _b : null;
    }
    getNoteTypeById(id) {
        var _a, _b;
        return (_b = (_a = this.store) === null || _a === void 0 ? void 0 : _a.noteTypes.getById(id)) !== null && _b !== void 0 ? _b : null;
    }
    getFrontmatterService() {
        return this.frontmatterService;
    }
    getSourceNoteService() {
        return this.sourceNoteService;
    }
    getEventBus() {
        return this.bus;
    }
    emitEvent(event, payload) {
        if (!this.bus) {
            if (!this.busWarnLogged) {
                console.warn("[FlashcardManager] Event bus not wired — events will not propagate to UI");
                this.busWarnLogged = true;
            }
            return;
        }
        this.bus.emit(event, payload);
    }
    scanVault() {
        if (!this.store) {
            throw new Error("Store not initialized");
        }
        const cards = this.getAllFSRSCards();
        return {
            totalCards: cards.length,
            newCardsProcessed: 0,
            filesProcessed: 0,
        };
    }
    getFlashcardInfo(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const sourceUid = yield this.frontmatterService.getSourceNoteUid(filePath);
            if (!sourceUid) {
                return this.createEmptyFlashcardInfo();
            }
            const cards = this.getFlashcardsBySourceUid(sourceUid);
            return {
                exists: cards.length > 0,
                cardCount: cards.length,
                questions: cards.map((c) => c.question),
                flashcards: cards.map((c) => ({
                    id: c.id,
                    question: c.question,
                    answer: c.answer,
                    cardType: c.cardType,
                    clozeTemplate: c.clozeTemplate,
                    clozeIndex: c.clozeIndex,
                    reverseOfBatchId: c.reverseOf,
                    sourceText: c.sourceText,
                    alwaysTypeIn: c.alwaysTypeIn,
                    noteId: c.noteId,
                })),
                lastModified: this.getLatestCardTimestamp(cards),
                sourceUid,
            };
        });
    }
    getLatestCardTimestamp(cards) {
        if (cards.length === 0)
            return null;
        const timestamps = cards
            .map((c) => c.fsrs.createdAt)
            .filter((t) => t !== undefined);
        if (timestamps.length === 0)
            return null;
        return Math.max(...timestamps);
    }
    createEmptyFlashcardInfo() {
        return {
            exists: false,
            cardCount: 0,
            questions: [],
            flashcards: [],
            lastModified: null,
            sourceUid: undefined,
        };
    }
    extractSourceContent(filePath, fileSystem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield fileSystem.read(filePath);
            }
            catch (error) {
                console.error(`[FlashcardManager] Failed to read file ${filePath}:`, error);
                return null;
            }
        });
    }
    saveFlashcardsToSql(filePath, fileBasename, flashcards, createdVia, sourceText) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.cardRepository) {
                throw new Error("Card store not initialized");
            }
            // Ensure source note has flashcard_uid
            let sourceUid = yield this.frontmatterService.getSourceNoteUid(filePath);
            if (!sourceUid) {
                sourceUid = this.frontmatterService.generateUid();
                yield this.frontmatterService.setSourceNoteUid(filePath, sourceUid);
            }
            return this.cardRepository.createBatch(flashcards, sourceUid, fileBasename, createdVia, sourceText);
        });
    }
    addSingleFlashcard(question, answer, sourceUid) {
        return this.addSingleFlashcardToSql(question, answer, sourceUid);
    }
    addSingleFlashcardToSql(question, answer, sourceUid) {
        if (!this.cardRepository) {
            throw new Error("Card store not initialized");
        }
        return this.cardRepository.create(question, answer, sourceUid);
    }
    removeFlashcard(cardId) {
        return this.removeFlashcardById(cardId);
    }
    removeFlashcardById(cardId) {
        const result = this.removeFlashcardByIdWithDetails(cardId);
        return result.ok;
    }
    removeFlashcardByIdWithDetails(cardId) {
        var _a;
        if (!this.cardRepository) {
            return {
                ok: false,
                affectedIds: [],
                affectedCount: 0,
                deletedCardsData: [],
            };
        }
        const { removedIds, cardsData } = this.cardRepository.deleteWithCascade(cardId);
        if (removedIds.length > 0) {
            (_a = this.sessionPersistence) === null || _a === void 0 ? void 0 : _a.removeReviewedCards(removedIds);
            return {
                ok: true,
                affectedIds: removedIds,
                affectedCount: removedIds.length,
                deletedCardsData: cardsData,
            };
        }
        return {
            ok: false,
            affectedIds: [],
            affectedCount: 0,
            deletedCardsData: [],
        };
    }
    removeFlashcardsByIds(cardIds) {
        const result = this.removeFlashcardsByIdsWithDetails(cardIds);
        return result.affectedCount;
    }
    removeFlashcardsByIdsWithDetails(cardIds) {
        var _a;
        if (!this.cardRepository) {
            return {
                ok: false,
                affectedIds: [],
                affectedCount: 0,
                deletedCardsData: [],
            };
        }
        const { removedIds, cardsData } = this.cardRepository.deleteBatchWithCascade(cardIds);
        if (removedIds.length > 0) {
            (_a = this.sessionPersistence) === null || _a === void 0 ? void 0 : _a.removeReviewedCards(removedIds);
        }
        return {
            ok: removedIds.length > 0,
            affectedIds: removedIds,
            affectedCount: removedIds.length,
            deletedCardsData: cardsData,
        };
    }
    removeFlashcardFromSql(cardId) {
        void this.removeFlashcardById(cardId);
    }
    getAllFSRSCards() {
        if (!this.cardQueryService) {
            throw new Error("Store not initialized.");
        }
        return this.cardQueryService.getAll();
    }
    getCardsByIds(cardIds) {
        if (!this.cardQueryService) {
            throw new Error("Store not initialized.");
        }
        return this.cardQueryService.getByIds(cardIds);
    }
    updateCardFSRS(cardId, newFSRSData, reviewLogEntry, options) {
        if (!this.cardRepository) {
            throw new Error("Store not initialized");
        }
        return this.cardRepository.updateFSRS(cardId, newFSRSData, reviewLogEntry, options);
    }
    updateCardContent(cardId, newQuestion, newAnswer) {
        if (!this.cardRepository) {
            throw new Error("Store not initialized");
        }
        this.cardRepository.updateContent(cardId, newQuestion, newAnswer);
    }
    updateClozeTemplate(sourceUid, oldTemplate, newTemplate, sourceNoteName) {
        if (!this.cardRepository) {
            throw new Error("Store not initialized");
        }
        this.cardRepository.updateClozeTemplate(sourceUid, oldTemplate, newTemplate, sourceNoteName);
    }
    getFlashcardsBySourceUid(sourceUid) {
        if (!this.cardQueryService) {
            return [];
        }
        return this.cardQueryService.getBySourceUid(sourceUid);
    }
    assignCardToSourceNote(cardId, targetNotePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.cardRepository) {
                throw new Error("Store not initialized");
            }
            if (!this.cardRepository.has(cardId)) {
                return false;
            }
            let targetSourceUid = yield this.frontmatterService.getSourceNoteUid(targetNotePath);
            if (!targetSourceUid) {
                targetSourceUid = this.frontmatterService.generateUid();
                yield this.frontmatterService.setSourceNoteUid(targetNotePath, targetSourceUid);
            }
            // Update card's source UID (CardRepository calls notifyCardChange)
            return this.cardRepository.updateSourceUid(cardId, targetSourceUid);
        });
    }
    assignCardsToSourceNote(cardIds, targetNotePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let successCount = 0;
            for (const cardId of cardIds) {
                const success = yield this.assignCardToSourceNote(cardId, targetNotePath);
                if (success) {
                    successCount++;
                }
            }
            return successCount;
        });
    }
    moveCard(cardId, targetNotePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.assignCardToSourceNote(cardId, targetNotePath);
        });
    }
    // ---- Note-based creation (v26) ----
    /**
     * Create a Note + generate its cards via the note type's templates.
     * This is the v26 replacement for legacy card creation methods.
     */
    createNote(params) {
        var _a;
        if (!this.store) {
            throw new Error("Store not initialized");
        }
        const noteType = this.store.noteTypes.getById(params.noteTypeId);
        if (!noteType) {
            throw new Error(`Note type "${params.noteTypeId}" not found`);
        }
        const note = {
            id: crypto.randomUUID(),
            noteTypeId: params.noteTypeId,
            fields: params.fields,
            tags: params.alwaysTypeIn ? [FLASHCARD_CONFIG.alwaysTypeInTag] : [],
            sourceUid: params.sourceUid,
            sourceText: params.sourceText,
            createdVia: (_a = params.createdVia) !== null && _a !== void 0 ? _a : "manual",
        };
        this.store.notes.create(note);
        const generated = generateCardsForNote(note, noteType);
        const cards = [];
        for (const gen of generated) {
            const fsrsData = this.createCardFromGenerated(gen, note, noteType, params.createdAt);
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
    createImageOcclusionNote(params) {
        var _a;
        const imagePath = normalizeIOImagePath(params.imagePath);
        if (!imagePath) {
            throw new Error("Image path is required");
        }
        return this.createNote({
            noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
            fields: {
                Image: imagePath,
                Regions: serializeIODefinition(params.definition),
            },
            sourceUid: params.sourceUid,
            sourceText: params.sourceText,
            createdVia: (_a = params.createdVia) !== null && _a !== void 0 ? _a : "manual",
        });
    }
    updateImageOcclusionNote(noteId, params) {
        const imagePath = normalizeIOImagePath(params.imagePath);
        if (!imagePath) {
            throw new Error("Image path is required");
        }
        return this.updateNoteFields(noteId, {
            Image: imagePath,
            Regions: serializeIODefinition(params.definition),
        });
    }
    /**
     * Create multiple Notes from parsed cards in bulk.
     * Returns all created cards for notification.
     */
    createNoteBatch(parsedCards) {
        var _a;
        if (!this.store) {
            throw new Error("Store not initialized");
        }
        const notes = [];
        const cards = [];
        for (const params of parsedCards) {
            const noteType = this.store.noteTypes.getById(params.noteTypeId);
            if (!noteType)
                continue;
            const note = {
                id: crypto.randomUUID(),
                noteTypeId: params.noteTypeId,
                fields: params.fields,
                tags: params.alwaysTypeIn ? [FLASHCARD_CONFIG.alwaysTypeInTag] : [],
                sourceUid: params.sourceUid,
                sourceText: params.sourceText,
                createdVia: (_a = params.createdVia) !== null && _a !== void 0 ? _a : "manual",
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
    // ---- Note-level review ----
    get noteReview() {
        if (!this._noteReview)
            throw new Error("Store not initialized");
        return this._noteReview;
    }
    enableNoteReview(sourceUid) {
        if (!this.store) {
            throw new Error("Store not initialized");
        }
        const existing = this.noteReview.findNote(sourceUid);
        if (existing) {
            const cards = this.store.cards.getCardsByNoteId(existing.id);
            return { note: existing, cards };
        }
        return this.createNote({
            noteTypeId: BUILTIN_NOTE_REVIEW_ID,
            fields: { Content: "" },
            sourceUid,
            createdVia: "manual",
        });
    }
    disableNoteReview(sourceUid) {
        if (!this.store) {
            throw new Error("Store not initialized");
        }
        const existing = this.noteReview.findNote(sourceUid);
        if (!existing)
            return false;
        const cards = this.store.cards.getCardsByNoteId(existing.id);
        if (cards.length > 0) {
            this.removeFlashcardsByIds(cards.map((c) => c.id));
        }
        this.store.notes.delete(existing.id);
        return true;
    }
    hasNoteReview(sourceUid) {
        return this.noteReview.has(sourceUid);
    }
    /**
     * Update a Note's fields and recompute Q/A for all its cards.
     * Returns the IDs of cards that were updated.
     */
    updateNoteFields(noteId, fields) {
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
        this.store.notes.update(noteId, { fields });
        if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
            return this.reconcileImageOcclusionCards(note, noteType, fields);
        }
        const updatedNote = Object.assign(Object.assign({}, note), { fields });
        const existingCards = this.store.cards.getCardsByNoteId(noteId);
        const existingOrds = existingCards.map((c) => { var _a; return (_a = c.templateOrd) !== null && _a !== void 0 ? _a : 0; });
        const newGenerated = generateCardsForNote(updatedNote, noteType, existingOrds);
        const updatedCardIds = existingCards.map((c) => c.id);
        for (const gen of newGenerated) {
            const fsrsData = this.createCardFromGenerated(gen, updatedNote, noteType);
            updatedCardIds.push(fsrsData.id);
        }
        if (updatedCardIds.length > 0) {
            this.emitEvent("cards:bulk", {
                cardIds: updatedCardIds,
            });
        }
        return { updatedCardIds };
    }
    changeNoteType(noteId, newNoteTypeId, fieldMapping) {
        var _a, _b;
        if (!this.store)
            throw new Error("Store not initialized");
        const note = this.store.notes.getById(noteId);
        if (!note)
            throw new Error(`Note "${noteId}" not found`);
        const newNoteType = this.store.noteTypes.getById(newNoteTypeId);
        if (!newNoteType)
            throw new Error(`Note type "${newNoteTypeId}" not found`);
        if (note.noteTypeId === newNoteTypeId) {
            return { keptCardIds: [], createdCardIds: [], deletedCardIds: [] };
        }
        // Remap fields: fieldMapping is newFieldName -> oldFieldName
        const newFields = {};
        for (const field of newNoteType.fields) {
            const oldFieldName = fieldMapping[field];
            newFields[field] = oldFieldName ? ((_a = note.fields[oldFieldName]) !== null && _a !== void 0 ? _a : "") : "";
        }
        this.store.notes.update(noteId, {
            noteTypeId: newNoteTypeId,
            fields: newFields,
        });
        // Reconcile cards
        const updatedNote = Object.assign(Object.assign({}, note), { noteTypeId: newNoteTypeId, fields: newFields });
        const existingCards = this.store.cards.getCardsByNoteId(noteId);
        const existingOrds = new Set(existingCards.map((c) => { var _a; return (_a = c.templateOrd) !== null && _a !== void 0 ? _a : 0; }));
        const desiredGenerated = generateCardsForNote(updatedNote, newNoteType);
        const desiredOrds = new Set(desiredGenerated.map((g) => g.templateOrd));
        // Keep cards whose templateOrd still exists
        const keptCardIds = existingCards
            .filter((c) => { var _a; return desiredOrds.has((_a = c.templateOrd) !== null && _a !== void 0 ? _a : 0); })
            .map((c) => c.id);
        const deletedCardIds = existingCards
            .filter((c) => { var _a; return !desiredOrds.has((_a = c.templateOrd) !== null && _a !== void 0 ? _a : 0); })
            .map((c) => c.id);
        if (deletedCardIds.length > 0) {
            this.store.cards.bulkSoftDelete(deletedCardIds);
            (_b = this.sessionPersistence) === null || _b === void 0 ? void 0 : _b.removeReviewedCards(deletedCardIds);
        }
        const createdCardIds = [];
        for (const gen of desiredGenerated) {
            if (existingOrds.has(gen.templateOrd))
                continue;
            const card = this.createCardFromGenerated(gen, updatedNote, newNoteType);
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
    reconcileImageOcclusionCards(note, noteType, fields) {
        var _a, _b, _c, _d;
        const updatedNote = Object.assign(Object.assign({}, note), { fields });
        const existingCards = (_b = (_a = this.store) === null || _a === void 0 ? void 0 : _a.cards.getCardsByNoteId(note.id)) !== null && _b !== void 0 ? _b : [];
        const existingOrds = new Set(existingCards.map((card) => { var _a; return (_a = card.templateOrd) !== null && _a !== void 0 ? _a : 0; }));
        const desiredGenerated = generateCardsForNote(updatedNote, noteType);
        const desiredOrds = new Set(desiredGenerated.map((card) => card.templateOrd));
        // Keep existing cards whose ord still exists in new definition.
        const keptCards = existingCards.filter((card) => { var _a; return desiredOrds.has((_a = card.templateOrd) !== null && _a !== void 0 ? _a : 0); });
        const removedCardIds = existingCards
            .filter((card) => { var _a; return !desiredOrds.has((_a = card.templateOrd) !== null && _a !== void 0 ? _a : 0); })
            .map((card) => card.id);
        const createdCards = [];
        for (const gen of desiredGenerated) {
            if (existingOrds.has(gen.templateOrd))
                continue;
            createdCards.push(this.createCardFromGenerated(gen, updatedNote, noteType));
        }
        if (removedCardIds.length > 0) {
            (_c = this.store) === null || _c === void 0 ? void 0 : _c.cards.bulkSoftDelete(removedCardIds);
            (_d = this.sessionPersistence) === null || _d === void 0 ? void 0 : _d.removeReviewedCards(removedCardIds);
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
    createCardFromGenerated(gen, note, noteType, createdAt) {
        var _a, _b;
        const template = (_a = noteType.templates.find((t) => t.ordinal === gen.templateOrd)) !== null && _a !== void 0 ? _a : noteType.templates[0];
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
        const fsrsData = Object.assign(Object.assign(Object.assign({}, defaultData), { question,
            answer, sourceUid: gen.sourceUid, noteId: gen.noteId, templateOrd: gen.templateOrd, noteTypeId: note.noteTypeId, cardType: deriveCardType(noteType, gen.templateOrd), createdVia: note.createdVia, sourceText: note.sourceText, alwaysTypeIn: note.tags.includes(FLASHCARD_CONFIG.alwaysTypeInTag) }), (createdAt != null && { createdAt }));
        (_b = this.store) === null || _b === void 0 ? void 0 : _b.set(gen.id, fsrsData);
        return fsrsData;
    }
}
