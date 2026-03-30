import { __awaiter } from "tslib";
import { blockToText, } from "@true-recall/core/flashcard/parsing/block-parser.service";
import { resolveSlug } from "@true-recall/core/flashcard/note-types/note-type-slug";
import { notify } from "@true-recall/obsidian/services/notification.service";
export function getSourceNoteNameFromFile(app, currentFile, flashcardInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!currentFile || !flashcardInfo)
            return undefined;
        try {
            const content = yield app.vault.read(currentFile);
            const match = content.match(/source_link:\s*"\[\[(.+?)\]\]"/);
            return match === null || match === void 0 ? void 0 : match[1];
        }
        catch (error) {
            console.error("[panel-helpers] Failed to read source note:", error);
            return undefined;
        }
    });
}
export function showDuplicateNotifications(plugin, duplicates) {
    const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
    for (const dup of duplicates) {
        const sourceInfo = dup.existingSourceUid
            ? sourceNoteService.resolveSourceNote(dup.existingSourceUid)
            : {};
        notify().duplicateFound(dup.flashcard.question, sourceInfo.noteName);
    }
}
export function notifyDuplicateError(plugin, error, question) {
    const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
    const sourceInfo = error.existingSourceUid
        ? sourceNoteService.resolveSourceNote(error.existingSourceUid)
        : {};
    notify().duplicateFound(question, sourceInfo.noteName);
}
export function cardToBlockText(card, plugin) {
    if (!card.noteId) {
        return `Q: ${card.question}\nA: ${card.answer}`;
    }
    const note = plugin.cardStore.notes.getById(card.noteId);
    if (!note) {
        return `Q: ${card.question}\nA: ${card.answer}`;
    }
    const noteType = plugin.cardStore.noteTypes.getById(note.noteTypeId);
    if (!noteType) {
        return `Q: ${card.question}\nA: ${card.answer}`;
    }
    const block = {
        noteTypeId: note.noteTypeId,
        noteTypeSlug: resolveSlug(noteType),
        fields: note.fields,
        sourceText: note.sourceText,
        alwaysTypeIn: card.alwaysTypeIn,
    };
    return blockToText(block, noteType.fields);
}
export function cardsToBlockText(cards, plugin) {
    return cards.map((card) => cardToBlockText(card, plugin)).join("\n\n---\n");
}
