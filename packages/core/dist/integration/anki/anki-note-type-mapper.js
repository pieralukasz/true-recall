import { slugifyNoteTypeName } from "@true-recall/core/flashcard/note-types/note-type-slug";
import { BUILTIN_BASIC_ID, BUILTIN_BASIC_REVERSED_ID, BUILTIN_CLOZE_ID, } from "@true-recall/core/types/note.types";
export class AnkiNoteTypeMapper {
    constructor(noteTypeStore) {
        this.noteTypeStore = noteTypeStore;
        this.modelToNoteType = new Map();
        this.created = 0;
    }
    get noteTypesCreated() {
        return this.created;
    }
    suggestMappings(models, cardCountByModel) {
        var _a, _b;
        const suggestions = [];
        for (const [modelId, model] of models) {
            const fields = [...model.flds]
                .sort((a, b) => a.ord - b.ord)
                .map((f) => f.name);
            const builtinId = this.matchBuiltin(model);
            let suggestedId = null;
            let suggestedName = null;
            if (builtinId) {
                suggestedId = builtinId;
                const nt = this.noteTypeStore.getAll().find((t) => t.id === builtinId);
                suggestedName = (_a = nt === null || nt === void 0 ? void 0 : nt.name) !== null && _a !== void 0 ? _a : builtinId;
            }
            else {
                const existing = this.findExistingMatch(model);
                if (existing) {
                    suggestedId = existing.id;
                    suggestedName = existing.name;
                }
            }
            suggestions.push({
                ankiModelId: modelId,
                ankiModelName: model.name,
                ankiFields: fields,
                ankiType: model.type === 1 ? 1 : 0,
                cardCount: (_b = cardCountByModel === null || cardCountByModel === void 0 ? void 0 : cardCountByModel.get(modelId)) !== null && _b !== void 0 ? _b : 0,
                suggestedNoteTypeId: suggestedId,
                suggestedNoteTypeName: suggestedName,
            });
        }
        return suggestions;
    }
    mapModels(models, overrides) {
        for (const [modelId, model] of models) {
            const override = overrides === null || overrides === void 0 ? void 0 : overrides.get(modelId);
            if (override && override.noteTypeId !== "auto") {
                this.modelToNoteType.set(modelId, override.noteTypeId);
                continue;
            }
            const noteTypeId = this.resolveNoteType(model);
            this.modelToNoteType.set(modelId, noteTypeId);
        }
    }
    getNoteTypeId(ankiModelId) {
        return this.modelToNoteType.get(ankiModelId);
    }
    findExistingMatch(model) {
        const modelFields = [...model.flds]
            .sort((a, b) => a.ord - b.ord)
            .map((f) => f.name);
        return this.noteTypeStore
            .getAll()
            .find((nt) => nt.name === model.name &&
            !nt.isBuiltin &&
            nt.fields.length === modelFields.length &&
            nt.fields.every((f, i) => f === modelFields[i]));
    }
    resolveNoteType(model) {
        const builtinId = this.matchBuiltin(model);
        if (builtinId)
            return builtinId;
        const existing = this.findExistingMatch(model);
        if (existing)
            return existing.id;
        return this.createFromAnkiModel(model);
    }
    matchBuiltin(model) {
        const fieldNames = [...model.flds]
            .sort((a, b) => a.ord - b.ord)
            .map((f) => f.name);
        if (model.type === 0 &&
            fieldNames.length === 2 &&
            fieldNames[0] === "Front" &&
            fieldNames[1] === "Back" &&
            model.tmpls.length === 1) {
            return BUILTIN_BASIC_ID;
        }
        if (model.type === 0 &&
            fieldNames.length === 2 &&
            fieldNames[0] === "Front" &&
            fieldNames[1] === "Back" &&
            model.tmpls.length === 2) {
            return BUILTIN_BASIC_REVERSED_ID;
        }
        if (model.type === 1 &&
            fieldNames.length === 2 &&
            fieldNames[0] === "Text" &&
            fieldNames[1] === "Extra") {
            return BUILTIN_CLOZE_ID;
        }
        return null;
    }
    createFromAnkiModel(model) {
        var _a;
        const fields = [...model.flds]
            .sort((a, b) => a.ord - b.ord)
            .map((f) => f.name);
        const templates = [...model.tmpls]
            .sort((a, b) => a.ord - b.ord)
            .map((t) => ({
            name: t.name,
            ordinal: t.ord,
            qfmt: stripHtmlFromTemplate(t.qfmt),
            afmt: stripHtmlFromTemplate(t.afmt),
        }));
        // If all templates have empty qfmt (v18 parsing fallback), generate simple ones
        if (templates.every((t) => !t.qfmt)) {
            for (const t of templates) {
                t.qfmt = fields[0] ? `{{${fields[0]}}}` : "";
                t.afmt = fields[1] ? `{{${fields[1]}}}` : "";
            }
        }
        let name = model.name;
        const allTypes = this.noteTypeStore.getAll();
        if (allTypes.some((nt) => nt.name === name)) {
            let counter = 2;
            while (allTypes.some((nt) => nt.name === `${name} (${counter})`)) {
                counter++;
            }
            name = `${name} (${counter})`;
        }
        let slug = slugifyNoteTypeName(name);
        if (this.noteTypeStore.getBySlug(slug)) {
            let counter = 2;
            while (this.noteTypeStore.getBySlug(`${slug}-${counter}`)) {
                counter++;
            }
            slug = `${slug}-${counter}`;
        }
        const now = Date.now();
        const noteType = {
            id: crypto.randomUUID(),
            name,
            type: model.type === 1 ? 1 : 0,
            fields,
            templates,
            css: (_a = model.css) !== null && _a !== void 0 ? _a : "",
            isBuiltin: false,
            slug,
            createdAt: now,
            updatedAt: now,
        };
        this.noteTypeStore.create(noteType);
        this.created++;
        return noteType.id;
    }
}
/**
 * Strip HTML wrapper tags from Anki templates while preserving
 * {{FieldName}}, {{cloze:FieldName}}, {{FrontSide}}, {{#Field}}...{{/Field}} references.
 */
export function stripHtmlFromTemplate(template) {
    if (!template)
        return template;
    let result = template;
    // Remove Anki's answer divider
    result = result.replace(/<hr\s+id=["']?answer["']?\s*\/?>/gi, "");
    // Replace <br> with newlines
    result = result.replace(/<br\s*\/?>/gi, "\n");
    // Strip HTML tags but preserve {{ }} template syntax
    result = result.replace(/<[^>]+>/g, "");
    // Decode common HTML entities
    result = result
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&nbsp;/gi, " ")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'");
    // Strip Anki field modifiers: {{edit:Field}} → {{Field}}
    result = result.replace(/\{\{\s*edit:([\w][\w ]*?)\s*\}\}/g, "{{$1}}");
    // Collapse excessive blank lines
    result = result.replace(/\n{3,}/g, "\n\n");
    return result.trim();
}
