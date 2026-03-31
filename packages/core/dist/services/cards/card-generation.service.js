/**
 * Card Generation Service
 *
 * Given a note and its note type, determines which cards to generate.
 * Handles standard (1 card per template), reversed (2 cards), cloze (1 per index),
 * and image-occlusion (1 per region) note types.
 */
import { getIOGroupOrds, parseIODefinition, } from "../../utils/io-definition";
import { extractClozeIndices } from "@true-recall/core/flashcard/parsing/cloze-parser.service";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "../../types/note.types";
import { fieldIsEmpty, renderTemplate } from "./template-engine";
/**
 * Generate cards for a note based on its note type.
 * Skips template ordinals that already exist (for incremental generation).
 */
export function generateCardsForNote(note, noteType, existingTemplateOrds) {
    const existing = new Set(existingTemplateOrds !== null && existingTemplateOrds !== void 0 ? existingTemplateOrds : []);
    let ords;
    if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
        ords = getImageOcclusionOrds(note);
    }
    else if (noteType.type === 1) {
        ords = getClozeOrds(note, noteType);
    }
    else {
        ords = noteType.templates.map((t) => t.ordinal);
    }
    return ords
        .filter((ord) => !existing.has(ord))
        .map((ord) => ({
        id: crypto.randomUUID(),
        noteId: note.id,
        templateOrd: ord,
        sourceUid: note.sourceUid,
    }));
}
function getClozeOrds(note, noteType) {
    var _a;
    // Find the first cloze field in templates
    for (const tmpl of noteType.templates) {
        const clozeMatch = tmpl.qfmt.match(/\{\{\s*cloze:(\w+)\s*\}\}/);
        if (clozeMatch) {
            const fieldName = clozeMatch[1];
            if (!fieldName)
                continue;
            const fieldValue = (_a = note.fields[fieldName]) !== null && _a !== void 0 ? _a : "";
            const indices = extractClozeIndices(fieldValue);
            // Anki ensure_not_empty: at least 1 card
            if (indices.length === 0)
                return [0];
            return indices;
        }
    }
    // No cloze template found — generate 1 card
    return [0];
}
function getImageOcclusionOrds(note) {
    var _a;
    const regionsStr = (_a = note.fields.Regions) !== null && _a !== void 0 ? _a : "[]";
    const definition = parseIODefinition(regionsStr);
    if (!definition || definition.regions.length === 0) {
        return [0];
    }
    const ords = getIOGroupOrds(definition);
    return ords.length > 0 ? ords : [0];
}
/**
 * Detect which templates would produce empty front-side cards for the given note.
 * Returns info about templates whose rendered qfmt is empty.
 */
export function detectEmptyCards(note, noteType) {
    const empty = [];
    for (const tmpl of noteType.templates) {
        const rendered = renderTemplate(tmpl.qfmt, {
            fields: note.fields,
            clozeIndex: tmpl.ordinal,
        });
        if (fieldIsEmpty(rendered)) {
            empty.push({
                templateOrd: tmpl.ordinal,
                templateName: tmpl.name,
            });
        }
    }
    return empty;
}
