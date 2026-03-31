import { renderTemplate } from "@true-recall/core/services/cards/template-engine";
import { stripHtmlFromTemplate } from "./anki-note-type-mapper";
const FIELD_SEPARATOR = "\x1f";
const HTML_ENTITIES = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
};
const HTML_ENTITY_REGEX = new RegExp(Object.keys(HTML_ENTITIES).join("|"), "gi");
export class AnkiConverterService {
    convert(data) {
        var _a;
        const results = [];
        const noteMap = new Map(data.notes.map((n) => [n.id, n]));
        for (const card of data.cards) {
            const note = noteMap.get(card.nid);
            if (!note)
                continue;
            const model = data.models.get(note.mid);
            if (!model)
                continue;
            const deck = data.decks.get(card.did);
            const deckName = deck ? deck.name.replace(/::/g, "/") : "Default";
            const tags = note.tags.trim().split(/\s+/).filter(Boolean);
            const rawFields = note.flds.split(FIELD_SEPARATOR);
            // Build named field values from model's field definitions
            const fieldValues = {};
            for (const fieldDef of model.flds) {
                const rawValue = (_a = rawFields[fieldDef.ord]) !== null && _a !== void 0 ? _a : "";
                fieldValues[fieldDef.name] = this.htmlToMarkdown(rawValue);
            }
            const converted = this.convertCard(card, note, model, rawFields, fieldValues, deckName, tags);
            if (converted)
                results.push(converted);
        }
        this.linkReversedCards(results);
        return results;
    }
    convertCard(card, note, model, rawFields, fieldValues, deckName, tags) {
        var _a;
        const tmpl = (_a = model.tmpls[card.ord]) !== null && _a !== void 0 ? _a : model.tmpls[0];
        const allContent = rawFields.join("");
        if (model.type === 1) {
            return this.convertClozeCard(card, note, model, tmpl, fieldValues, allContent, deckName, tags);
        }
        const isReversed = model.type === 0 && model.tmpls.length > 1 && card.ord === 1;
        if (isReversed) {
            return this.convertReversedCard(card, note, model, tmpl, fieldValues, allContent, deckName, tags);
        }
        return this.convertBasicCard(card, note, model, tmpl, fieldValues, allContent, deckName, tags);
    }
    convertBasicCard(card, note, model, tmpl, fieldValues, allContent, deckName, tags) {
        const { question, answer } = this.renderAnkiTemplate(tmpl, fieldValues);
        return {
            ankiCardId: card.id,
            ankiNoteId: note.id,
            ankiModelId: model.id,
            question,
            answer,
            cardType: "basic",
            tags,
            deckName,
            mediaFiles: this.extractMediaFiles(allContent),
            fieldValues,
            templateOrd: card.ord,
        };
    }
    convertClozeCard(card, note, model, tmpl, fieldValues, allContent, deckName, tags) {
        var _a, _b;
        // card.ord is 0-based, cloze numbers are 1-based
        const clozeIndex = card.ord + 1;
        const { question, answer } = this.renderAnkiTemplate(tmpl, fieldValues, clozeIndex);
        // clozeTemplate stores the raw cloze field for editing
        const clozeFieldName = this.findClozeFieldName((_a = tmpl === null || tmpl === void 0 ? void 0 : tmpl.qfmt) !== null && _a !== void 0 ? _a : "");
        const clozeTemplate = (_b = fieldValues[clozeFieldName]) !== null && _b !== void 0 ? _b : question;
        return {
            ankiCardId: card.id,
            ankiNoteId: note.id,
            ankiModelId: model.id,
            question,
            answer,
            cardType: "cloze",
            clozeTemplate,
            clozeIndex,
            tags,
            deckName,
            mediaFiles: this.extractMediaFiles(allContent),
            fieldValues,
            templateOrd: card.ord,
        };
    }
    convertReversedCard(card, note, model, tmpl, fieldValues, allContent, deckName, tags) {
        const { question, answer } = this.renderAnkiTemplate(tmpl, fieldValues);
        return {
            ankiCardId: card.id,
            ankiNoteId: note.id,
            ankiModelId: model.id,
            question,
            answer,
            cardType: "reversed",
            tags,
            deckName,
            mediaFiles: this.extractMediaFiles(allContent),
            fieldValues,
            templateOrd: card.ord,
        };
    }
    renderAnkiTemplate(tmpl, fieldValues, clozeIndex) {
        var _a, _b, _c;
        if (!tmpl) {
            // Fallback: use first two fields directly
            const values = Object.values(fieldValues);
            return {
                question: (_a = values[0]) !== null && _a !== void 0 ? _a : "",
                answer: (_c = (_b = values[1]) !== null && _b !== void 0 ? _b : values[0]) !== null && _c !== void 0 ? _c : "",
            };
        }
        const qfmt = stripHtmlFromTemplate(tmpl.qfmt);
        const afmt = stripHtmlFromTemplate(tmpl.afmt);
        const question = renderTemplate(qfmt, {
            fields: fieldValues,
            clozeIndex,
        });
        const answer = renderTemplate(afmt, {
            fields: fieldValues,
            frontSide: "",
            clozeIndex,
        });
        return { question, answer };
    }
    findClozeFieldName(qfmt) {
        var _a;
        const match = /\{\{\s*cloze:([\w][\w ]*?)\s*\}\}/.exec(qfmt);
        return (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : "Text";
    }
    /**
     * After all cards are converted, link each reversed card (ord=1) back to
     * the basic card (ord=0) from the same note via reverseOfAnkiCardId.
     */
    linkReversedCards(cards) {
        const basicByNote = new Map();
        for (const card of cards) {
            if (card.cardType === "basic") {
                basicByNote.set(card.ankiNoteId, card.ankiCardId);
            }
        }
        for (const card of cards) {
            if (card.cardType === "reversed") {
                const basicId = basicByNote.get(card.ankiNoteId);
                if (basicId !== undefined) {
                    card.reverseOfAnkiCardId = basicId;
                }
            }
        }
    }
    htmlToMarkdown(html) {
        let text = html;
        // Line breaks
        text = text.replace(/<br\s*\/?>/gi, "\n");
        // Pre-formatted blocks (before other tag stripping)
        text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_match, content) => {
            const inner = this.stripTags(content);
            return `\n\`\`\`\n${inner}\n\`\`\`\n`;
        });
        // Inline code
        text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_match, content) => {
            const inner = this.stripTags(content);
            return `\`${inner}\``;
        });
        // Bold
        text = text.replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, "**$1**");
        // Italic
        text = text.replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, "*$1*");
        // Images → Obsidian embeds
        text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, "![[$1]]");
        // Anki sound references → Obsidian embeds
        text = text.replace(/\[sound:([^\]]+)\]/g, "![[$1]]");
        // Strip remaining block-level tags, preserving content with newlines
        text = text.replace(/<\/(?:div|p)>/gi, "\n");
        text = text.replace(/<(?:div|p|span)[^>]*>/gi, "");
        // Underline tags are kept (Obsidian renders them natively)
        // Strip any remaining unknown HTML tags, preserving content
        text = text.replace(/<\/?(?!u\b)[a-z][a-z0-9]*[^>]*>/gi, "");
        // Decode HTML entities
        text = text.replace(HTML_ENTITY_REGEX, (entity) => {
            var _a;
            return (_a = HTML_ENTITIES[entity.toLowerCase()]) !== null && _a !== void 0 ? _a : entity;
        });
        // Collapse excessive blank lines (3+ newlines → 2)
        text = text.replace(/\n{3,}/g, "\n\n");
        return text.trim();
    }
    stripTags(html) {
        return html.replace(/<[^>]+>/g, "");
    }
    extractMediaFiles(content) {
        const files = new Set();
        // <img src="filename">
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        for (let match = imgRegex.exec(content); match !== null; match = imgRegex.exec(content)) {
            if (match[1])
                files.add(match[1]);
        }
        // [sound:filename.mp3]
        const soundRegex = /\[sound:([^\]]+)\]/g;
        for (let match = soundRegex.exec(content); match !== null; match = soundRegex.exec(content)) {
            if (match[1])
                files.add(match[1]);
        }
        return [...files];
    }
}
