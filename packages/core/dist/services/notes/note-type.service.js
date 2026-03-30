/**
 * NoteType Service
 *
 * Business logic for note type CRUD operations.
 * Handles validation, built-in type management, field/template operations,
 * and cascading updates to notes and cards.
 */
import { slugifyNoteTypeName } from "@true-recall/core/flashcard/note-types/note-type-slug";
export class NoteTypeService {
    constructor(deps) {
        this.deps = deps;
    }
    initialize() {
        this.deps.noteTypeActions.seedBuiltinTypes();
    }
    getById(id) {
        return this.deps.noteTypeActions.getById(id);
    }
    getAll() {
        return this.deps.noteTypeActions.getAll();
    }
    getBySlug(slug) {
        return this.deps.noteTypeActions.getBySlug(slug);
    }
    create(input) {
        var _a, _b, _c;
        const name = input.name.trim();
        if (input.fields.length === 0) {
            throw new Error("Note type must have at least one field");
        }
        if (input.templates.length === 0) {
            throw new Error("Note type must have at least one template");
        }
        const existing = this.deps.noteTypeActions.getAll();
        if (existing.some((nt) => nt.name === name)) {
            throw new Error(`Note type with name "${name}" already exists`);
        }
        // Auto-generate slug if not provided, ensure uniqueness
        let slug = (_a = input.slug) !== null && _a !== void 0 ? _a : slugifyNoteTypeName(name);
        if (this.deps.noteTypeActions.getBySlug(slug)) {
            let counter = 2;
            while (this.deps.noteTypeActions.getBySlug(`${slug}-${counter}`)) {
                counter++;
            }
            slug = `${slug}-${counter}`;
        }
        const now = Date.now();
        const noteType = {
            id: crypto.randomUUID(),
            name,
            type: (_b = input.type) !== null && _b !== void 0 ? _b : 0,
            fields: input.fields,
            templates: input.templates,
            css: (_c = input.css) !== null && _c !== void 0 ? _c : "",
            isBuiltin: false,
            slug,
            createdAt: now,
            updatedAt: now,
        };
        this.deps.noteTypeActions.create(noteType);
        return noteType;
    }
    update(id, updates) {
        const existing = this.deps.noteTypeActions.getById(id);
        if (!existing) {
            throw new Error(`Note type "${id}" not found`);
        }
        if (existing.isBuiltin) {
            throw new Error("Cannot update built-in note types");
        }
        this.deps.noteTypeActions.update(id, updates);
    }
    delete(id) {
        const existing = this.deps.noteTypeActions.getById(id);
        if (!existing) {
            throw new Error(`Note type "${id}" not found`);
        }
        if (existing.isBuiltin) {
            throw new Error("Cannot delete built-in note types");
        }
        const noteCount = this.deps.noteActions.countByNoteType(id);
        if (noteCount > 0) {
            throw new Error(`Cannot delete note type "${existing.name}": ${noteCount} notes are using it`);
        }
        this.deps.noteTypeActions.delete(id);
    }
    addField(noteTypeId, fieldName) {
        const existing = this.deps.noteTypeActions.getById(noteTypeId);
        if (!existing) {
            throw new Error(`Note type "${noteTypeId}" not found`);
        }
        if (existing.isBuiltin) {
            throw new Error("Cannot modify built-in note types");
        }
        const fields = [...existing.fields, fieldName];
        this.deps.noteTypeActions.update(noteTypeId, { fields });
    }
    removeField(noteTypeId, fieldName) {
        const existing = this.deps.noteTypeActions.getById(noteTypeId);
        if (!existing) {
            throw new Error(`Note type "${noteTypeId}" not found`);
        }
        if (existing.isBuiltin) {
            throw new Error("Cannot modify built-in note types");
        }
        if (existing.fields.length <= 1) {
            throw new Error("Cannot remove the last field from a note type");
        }
        const fields = existing.fields.filter((f) => f !== fieldName);
        this.deps.noteTypeActions.update(noteTypeId, { fields });
    }
    renameField(noteTypeId, oldName, newName) {
        const existing = this.deps.noteTypeActions.getById(noteTypeId);
        if (!existing) {
            throw new Error(`Note type "${noteTypeId}" not found`);
        }
        if (existing.isBuiltin) {
            throw new Error("Cannot modify built-in note types");
        }
        const fields = existing.fields.map((f) => (f === oldName ? newName : f));
        // Also update templates that reference the old field name
        const templates = existing.templates.map((t) => (Object.assign(Object.assign({}, t), { qfmt: t.qfmt.replace(new RegExp(`\\{\\{\\s*${escapeRegex(oldName)}\\s*\\}\\}`, "g"), `{{${newName}}}`), afmt: t.afmt.replace(new RegExp(`\\{\\{\\s*${escapeRegex(oldName)}\\s*\\}\\}`, "g"), `{{${newName}}}`) })));
        this.deps.noteTypeActions.update(noteTypeId, { fields, templates });
    }
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
