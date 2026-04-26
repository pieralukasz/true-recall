import { __awaiter } from "tslib";
import { AnkiConverterService } from "@true-recall/core/integration/anki/anki-converter.service";
import { AnkiNoteTypeMapper } from "@true-recall/core/integration/anki/anki-note-type-mapper";
import { AnkiSchedulingService } from "@true-recall/core/integration/anki/anki-scheduling.service";
import { generateUUID } from "@true-recall/core/persistence/sqlite/sqlite.types";
import { AnkiMediaService } from "./anki-media.service";
import { ApkgParserService } from "./apkg/apkg-parser.service";
export class AnkiImportService {
    constructor(store, fsrsService, persistence, vault, fileReader, onCardChange) {
        this.store = store;
        this.fsrsService = fsrsService;
        this.persistence = persistence;
        this.vault = vault;
        this.fileReader = fileReader;
        this.onCardChange = onCardChange;
    }
    static parseAndConvert(fileData) {
        return __awaiter(this, void 0, void 0, function* () {
            const parser = new ApkgParserService();
            const apkgData = yield parser.parseApkg(fileData);
            const converter = new AnkiConverterService();
            const convertedCards = converter.convert(apkgData);
            return { apkgData, convertedCards };
        });
    }
    importApkg(fileData, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { apkgData, convertedCards } = yield AnkiImportService.parseAndConvert(fileData);
            return this.importCards(apkgData, convertedCards, options);
        });
    }
    importCards(apkgData, convertedCards, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const result = {
                imported: 0,
                skipped: 0,
                duplicates: 0,
                errors: [],
                noteTypesCreated: 0,
                fieldsDropped: 0,
            };
            if (convertedCards.length === 0) {
                result.errors.push("No cards found in the .apkg file");
                return result;
            }
            const mediaService = new AnkiMediaService(this.persistence, this.fileReader);
            let mediaPathMapping = new Map();
            if (options.importMedia && apkgData.media.size > 0) {
                mediaPathMapping = yield mediaService.importMedia(apkgData.media, apkgData.mediaMap, options.mediaFolder);
            }
            const replaceMediaPaths = mediaService.buildContentReplacer(mediaPathMapping);
            const revlogByCard = new Map();
            for (const entry of apkgData.revlog) {
                const list = (_a = revlogByCard.get(entry.cid)) !== null && _a !== void 0 ? _a : [];
                list.push(entry);
                revlogByCard.set(entry.cid, list);
            }
            const ankiCardMap = new Map();
            for (const card of apkgData.cards) {
                ankiCardMap.set(card.id, card);
            }
            const schedulingService = new AnkiSchedulingService(this.fsrsService);
            const noteTypeMapper = new AnkiNoteTypeMapper(this.store.noteTypes);
            const importedCardIds = [];
            const deckToCardIds = new Map();
            this.store.transaction(() => {
                var _a;
                noteTypeMapper.mapModels(apkgData.models, options.modelMappings);
                const ankiToTrCardId = new Map();
                const ankiNoteToTrNote = new Map();
                for (const converted of convertedCards) {
                    try {
                        const importResult = this.importSingleCard(converted, ankiCardMap, revlogByCard, schedulingService, replaceMediaPaths, options, ankiToTrCardId, noteTypeMapper, ankiNoteToTrNote);
                        if (importResult.status === "imported") {
                            importedCardIds.push(importResult.cardId);
                            result.imported++;
                            result.fieldsDropped += importResult.fieldsDropped;
                            const list = (_a = deckToCardIds.get(converted.deckName)) !== null && _a !== void 0 ? _a : [];
                            list.push(importResult.cardId);
                            deckToCardIds.set(converted.deckName, list);
                        }
                        else if (importResult.status === "duplicate") {
                            result.duplicates++;
                        }
                        else {
                            result.skipped++;
                        }
                    }
                    catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        result.errors.push(`Card ${converted.ankiCardId}: ${msg}`);
                        result.skipped++;
                    }
                }
                if (options.importScheduling) {
                    this.importReviewLogs(convertedCards, revlogByCard, importedCardIds, ankiToTrCardId);
                }
            });
            yield this.store.flush();
            // Inject ancestor deck paths so the full hierarchy is created
            for (const deckPath of [...deckToCardIds.keys()]) {
                const segments = deckPath.split("/");
                for (let i = 1; i < segments.length; i++) {
                    const ancestorPath = segments.slice(0, i).join("/");
                    if (!deckToCardIds.has(ancestorPath)) {
                        deckToCardIds.set(ancestorPath, []);
                    }
                }
            }
            if (deckToCardIds.size > 0) {
                try {
                    yield this.createDeckNotes(deckToCardIds, options.importFolder);
                    yield this.store.flush();
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    result.errors.push(`Failed to create source notes: ${msg}`);
                }
            }
            if (importedCardIds.length > 0) {
                (_b = this.onCardChange) === null || _b === void 0 ? void 0 : _b.call(this, {
                    type: "bulk",
                    cardIds: importedCardIds,
                    action: "added",
                });
            }
            result.noteTypesCreated = noteTypeMapper.noteTypesCreated;
            return result;
        });
    }
    importSingleCard(converted, ankiCardMap, revlogByCard, schedulingService, replaceMediaPaths, options, ankiToTrCardId, noteTypeMapper, ankiNoteToTrNote) {
        var _a, _b, _c, _d;
        const question = replaceMediaPaths(converted.question);
        const answer = replaceMediaPaths(converted.answer);
        if (!question.trim()) {
            return { status: "skipped" };
        }
        const existingId = converted.cardType === "cloze" && converted.clozeIndex !== undefined
            ? this.store.cards.getCardIdByQuestionAndClozeIndex(question, converted.clozeIndex)
            : this.store.cards.getCardIdByQuestion(question);
        if (existingId) {
            ankiToTrCardId.set(converted.ankiCardId, existingId);
            return { status: "duplicate" };
        }
        const cardId = generateUUID();
        ankiToTrCardId.set(converted.ankiCardId, cardId);
        let cardData;
        if (options.importScheduling) {
            const ankiCard = (_a = ankiCardMap.get(converted.ankiCardId)) !== null && _a !== void 0 ? _a : this.buildMinimalAnkiCard(converted);
            const revlogs = (_b = revlogByCard.get(converted.ankiCardId)) !== null && _b !== void 0 ? _b : [];
            cardData = schedulingService.convert(cardId, ankiCard, revlogs);
        }
        else {
            cardData = this.fsrsService.createNewCard(cardId);
        }
        cardData.question = question;
        cardData.answer = answer;
        cardData.cardType = converted.cardType;
        // Apply media path updates to field values
        let fieldValues = {};
        for (const [key, value] of Object.entries(converted.fieldValues)) {
            fieldValues[key] = replaceMediaPaths(value);
        }
        // Apply field remapping if user specified one
        let fieldsDropped = 0;
        const mapping = (_c = options.modelMappings) === null || _c === void 0 ? void 0 : _c.get(converted.ankiModelId);
        if ((mapping === null || mapping === void 0 ? void 0 : mapping.fieldMapping) && mapping.fieldMapping.size > 0) {
            const remap = remapFields(fieldValues, mapping.fieldMapping);
            fieldValues = remap.mapped;
            fieldsDropped = remap.dropped;
        }
        const noteTypeId = noteTypeMapper.getNoteTypeId(converted.ankiModelId);
        let noteId = ankiNoteToTrNote.get(converted.ankiNoteId);
        if (!noteId) {
            noteId = generateUUID();
            ankiNoteToTrNote.set(converted.ankiNoteId, noteId);
            if (noteTypeId) {
                this.store.notes.create({
                    id: noteId,
                    noteTypeId,
                    fields: fieldValues,
                    tags: converted.tags,
                    createdVia: "anki_import",
                });
            }
        }
        if (noteTypeId) {
            cardData.noteTypeId = noteTypeId;
            cardData.noteId = noteId;
            cardData.templateOrd = converted.templateOrd;
            cardData.fields = fieldValues;
        }
        if (converted.cardType === "cloze") {
            const clozeTemplate = replaceMediaPaths((_d = converted.clozeTemplate) !== null && _d !== void 0 ? _d : question);
            cardData.clozeTemplate = clozeTemplate;
            cardData.clozeIndex = converted.clozeIndex;
        }
        if (converted.cardType === "reversed" &&
            converted.reverseOfAnkiCardId !== undefined) {
            const originalTrId = ankiToTrCardId.get(converted.reverseOfAnkiCardId);
            if (originalTrId) {
                cardData.reverseOf = originalTrId;
            }
        }
        cardData.createdVia = "anki_import";
        this.store.set(cardId, cardData);
        return { status: "imported", cardId, fieldsDropped };
    }
    importReviewLogs(convertedCards, revlogByCard, importedCardIds, ankiToTrCardId) {
        var _a;
        const importedSet = new Set(importedCardIds);
        for (const converted of convertedCards) {
            const trCardId = ankiToTrCardId.get(converted.ankiCardId);
            if (!trCardId || !importedSet.has(trCardId))
                continue;
            const revlogs = (_a = revlogByCard.get(converted.ankiCardId)) !== null && _a !== void 0 ? _a : [];
            const sorted = [...revlogs].sort((a, b) => a.id - b.id);
            for (const entry of sorted) {
                this.store.stats.upsertReviewLogFromRemote({
                    id: generateUUID(),
                    cardId: trCardId,
                    reviewedAt: new Date(entry.id).toISOString(),
                    rating: Math.max(1, Math.min(4, entry.ease)),
                    scheduledDays: Math.max(0, entry.ivl),
                    elapsedDays: Math.max(0, entry.lastIvl),
                    state: Math.max(0, Math.min(3, entry.type)),
                    timeSpentMs: Math.max(0, entry.time),
                    updatedAt: Date.now(),
                    deletedAt: null,
                    presetName: null,
                });
            }
        }
    }
    /**
     * Creates one source note per deck.
     * Leaf decks get cards linked; ancestor decks become MOC nodes in the hierarchy.
     */
    createDeckNotes(deckToCardIds, importFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!(yield this.vault.exists(importFolder))) {
                yield this.vault.ensureFolderRecursive(importFolder);
            }
            // Sort by depth so parent folders are created first
            const sortedDecks = [...deckToCardIds.entries()].sort((a, b) => a[0].split("/").length - b[0].split("/").length);
            for (const [deckPath, cardIds] of sortedDecks) {
                const segments = deckPath.split("/");
                const name = (_a = segments[segments.length - 1]) !== null && _a !== void 0 ? _a : "Default";
                const safeName = sanitize(name);
                // Build folder path (parent segments)
                const folderSegments = segments.slice(0, -1).map((s) => sanitize(s));
                const folderPath = folderSegments.length > 0
                    ? `${importFolder}/${folderSegments.join("/")}`
                    : importFolder;
                if (!(yield this.vault.exists(folderPath))) {
                    yield this.vault.ensureFolderRecursive(folderPath);
                }
                const notePath = `${folderPath}/${safeName}.md`;
                // Get or create the note
                const uid = yield this.getOrCreateNote(notePath, name, segments);
                // Link all cards to this deck note
                for (const cardId of cardIds) {
                    this.store.cards.updateCardSourceUid(cardId, uid);
                }
            }
        });
    }
    getOrCreateNote(notePath, title, segments) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (yield this.vault.exists(notePath)) {
                const existingUid = yield this.vault.getFrontmatterUid(notePath);
                if (existingUid)
                    return existingUid;
                const uid = this.generateUid();
                const parentName = segments.length > 1
                    ? sanitize((_a = segments[segments.length - 2]) !== null && _a !== void 0 ? _a : "")
                    : undefined;
                const frontmatter = this.buildFrontmatter(uid, parentName);
                yield this.vault.prependToFile(notePath, `${frontmatter}\n\n`);
                return uid;
            }
            const uid = this.generateUid();
            const parentName = segments.length > 1
                ? sanitize((_b = segments[segments.length - 2]) !== null && _b !== void 0 ? _b : "")
                : undefined;
            const frontmatter = this.buildFrontmatter(uid, parentName);
            yield this.vault.createFile(notePath, `${frontmatter}\n\n# ${title}\n\nImported from Anki.\n`);
            return uid;
        });
    }
    buildFrontmatter(uid, parentName) {
        const lines = ["---", `flashcard_uid: ${uid}`];
        if (parentName) {
            lines.push("parents:", `  - "[[${parentName}]]"`);
        }
        lines.push("---");
        return lines.join("\n");
    }
    generateUid() {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    }
    buildMinimalAnkiCard(converted) {
        return {
            id: converted.ankiCardId,
            nid: converted.ankiNoteId,
            did: 0,
            ord: 0,
            type: 0,
            queue: 0,
            due: 0,
            ivl: 0,
            factor: 0,
            reps: 0,
            lapses: 0,
        };
    }
}
function remapFields(fields, mapping) {
    const mapped = {};
    let dropped = 0;
    for (const [ankiField, value] of Object.entries(fields)) {
        const targetField = mapping.get(ankiField);
        if (targetField) {
            mapped[targetField] = value;
        }
        else {
            dropped++;
        }
    }
    return { mapped, dropped };
}
function sanitize(name) {
    return (name
        .replace(/[\\/:*?"<>|]/g, " - ")
        .replace(/\s+/g, " ")
        .trim() || "Default");
}
