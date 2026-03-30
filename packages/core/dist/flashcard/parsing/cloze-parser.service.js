/**
 * Cloze Parser Service
 * Pure functions for parsing Anki-style cloze deletion syntax: {{c1::text}} and {{c1::text::hint}}
 */
const CLOZE_REGEX = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;
export function hasClozeContent(text) {
    // Must reset lastIndex because CLOZE_REGEX has the /g flag,
    // which causes .test() to advance lastIndex between calls
    CLOZE_REGEX.lastIndex = 0;
    return CLOZE_REGEX.test(text);
}
export function extractClozeIndices(template) {
    const indices = new Set();
    const regex = new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags);
    for (let match = regex.exec(template); match !== null; match = regex.exec(template)) {
        const indexStr = match[1];
        if (indexStr) {
            indices.add(parseInt(indexStr, 10));
        }
    }
    return [...indices].sort((a, b) => a - b);
}
/**
 * Render the question side of a cloze card.
 * Target index clozes become [...] or [hint], other clozes are revealed.
 */
export function renderClozeQuestion(template, targetIndex) {
    const regex = new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags);
    return template.replace(regex, (_match, indexStr, text, hint) => {
        const idx = parseInt(indexStr, 10);
        if (idx === targetIndex) {
            return hint ? `[${hint}]` : "[...]";
        }
        return text;
    });
}
/**
 * Render the answer side of a cloze card.
 * Target index clozes are shown bold, other clozes are revealed normally.
 */
export function renderClozeAnswer(template, targetIndex) {
    const regex = new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags);
    return template.replace(regex, (_match, indexStr, text) => {
        const idx = parseInt(indexStr, 10);
        if (idx === targetIndex) {
            return `**${text}**`;
        }
        return text;
    });
}
/**
 * Parse a cloze template into individual cards, one per unique cN index.
 */
export function parseClozeTemplate(template) {
    const indices = extractClozeIndices(template);
    return indices.map((clozeIndex) => ({
        clozeIndex,
        question: renderClozeQuestion(template, clozeIndex),
        answer: renderClozeAnswer(template, clozeIndex),
    }));
}
