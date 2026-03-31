/**
 * Cloze Parser Service
 * Pure functions for parsing Anki-style cloze deletion syntax: {{c1::text}} and {{c1::text::hint}}
 */
export interface ClozeCard {
    clozeIndex: number;
    question: string;
    answer: string;
}
export declare function hasClozeContent(text: string): boolean;
export declare function extractClozeIndices(template: string): number[];
/**
 * Render the question side of a cloze card.
 * Target index clozes become [...] or [hint], other clozes are revealed.
 */
export declare function renderClozeQuestion(template: string, targetIndex: number): string;
/**
 * Render the answer side of a cloze card.
 * Target index clozes are shown bold, other clozes are revealed normally.
 */
export declare function renderClozeAnswer(template: string, targetIndex: number): string;
/**
 * Parse a cloze template into individual cards, one per unique cN index.
 */
export declare function parseClozeTemplate(template: string): ClozeCard[];
