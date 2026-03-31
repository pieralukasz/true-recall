/**
 * Template Engine — Anki-compatible template rendering.
 *
 * Supported syntax:
 * - {{FieldName}} — field value substitution
 * - {{FrontSide}} — stripped (True Recall shows Q/A separately)
 * - {{cloze:FieldName}} — cloze deletion rendering
 * - {{#FieldName}}...{{/FieldName}} — conditional (non-empty field)
 * - {{^FieldName}}...{{/FieldName}} — inverse conditional (empty field)
 */
import type { CardType } from "../../types";
import { type NoteType } from "../../types/note.types";
export interface TemplateContext {
    fields: Record<string, string>;
    /** Set to any string (even "") to signal answer-side rendering (affects cloze display) */
    frontSide?: string;
    /** Active cloze index (only for cloze note types) */
    clozeIndex?: number;
}
/**
 * Render an Anki-style template with the given context.
 *
 * Processing order matters to prevent re-evaluation of injected content:
 * 1. Strip HTML comments (don't process handlebars inside them)
 * 2. Replace {{FrontSide}}
 * 3. Replace {{cloze:FieldName}}
 * 4. Process conditionals ({{#Field}}, {{^Field}}) — must happen before
 *    field substitution so we can check emptiness of original field values
 * 5. Replace {{FieldName}} — values injected here are NOT re-processed
 */
export declare function renderTemplate(template: string, context: TemplateContext): string;
/**
 * Check if a field value is "empty" in Anki's sense.
 * Empty = blank, whitespace-only, or contains only empty HTML tags (<br>, <div>, etc.)
 */
export declare function fieldIsEmpty(value: string): boolean;
/**
 * Derive CardType from note type metadata and template ordinal.
 */
export declare function deriveCardType(noteType: Pick<NoteType, "id" | "type">, templateOrd: number): CardType;
