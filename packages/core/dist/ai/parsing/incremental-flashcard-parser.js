/**
 * Non-streaming JSON parser: parse full AI response text into ParsedBlocks.
 * Handles markdown code fences and extracts the JSON array.
 */
export function parseBlockResponse(text, getNoteType) {
    let json = text.trim();
    json = json.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const start = json.indexOf("[");
    const end = json.lastIndexOf("]");
    if (start === -1 || end <= start)
        return [];
    let parsed;
    try {
        parsed = JSON.parse(json.slice(start, end + 1));
    }
    catch (_a) {
        return [];
    }
    if (!Array.isArray(parsed))
        return [];
    return parsed
        .map((item) => parseCardObject(item, getNoteType))
        .filter((b) => b !== null);
}
function parseCardObject(item, getNoteType) {
    if (typeof item !== "object" || item === null)
        return null;
    const obj = item;
    const slug = typeof obj.type === "string" ? obj.type : null;
    if (!slug)
        return null;
    const noteType = getNoteType(slug);
    if (!noteType)
        return null;
    const fields = {};
    let hasContent = false;
    for (const fieldName of noteType.fields) {
        const value = typeof obj[fieldName] === "string" ? obj[fieldName] : "";
        fields[fieldName] = value;
        if (value.trim())
            hasContent = true;
    }
    if (!hasContent)
        return null;
    const sourceText = typeof obj.source === "string" ? obj.source.trim() : undefined;
    return {
        noteTypeId: noteType.id,
        noteTypeSlug: slug,
        fields,
        sourceText: sourceText || undefined,
    };
}
/**
 * Streaming JSON array parser.
 *
 * Extracts complete JSON objects from a streamed JSON array by tracking
 * brace depth and string state. Emits card_complete events as each
 * object is fully received, and partial_update events for in-progress objects.
 */
export class IncrementalFlashcardParser {
    constructor(getNoteType) {
        this.getNoteType = getNoteType;
        this.objectBuffer = "";
        this.state = "idle";
        this.depth = 0;
        this.inString = false;
        this.escaped = false;
    }
    feed(chunk) {
        const events = [];
        for (const char of chunk) {
            if (this.state === "idle") {
                if (char === "{") {
                    this.state = "in_object";
                    this.depth = 1;
                    this.inString = false;
                    this.escaped = false;
                    this.objectBuffer = "{";
                }
                continue;
            }
            this.objectBuffer += char;
            if (this.escaped) {
                this.escaped = false;
                continue;
            }
            if (this.inString) {
                if (char === "\\")
                    this.escaped = true;
                else if (char === '"')
                    this.inString = false;
                continue;
            }
            if (char === '"')
                this.inString = true;
            else if (char === "{")
                this.depth++;
            else if (char === "}") {
                this.depth--;
                if (this.depth === 0) {
                    const block = this.tryParseObject(this.objectBuffer);
                    if (block) {
                        events.push({ type: "card_complete", block });
                    }
                    this.state = "idle";
                    this.objectBuffer = "";
                }
            }
        }
        if (this.state === "in_object" && this.objectBuffer.length > 0) {
            const partial = this.extractPartial();
            if (partial)
                events.push(partial);
        }
        return events;
    }
    finish() {
        if (this.state !== "in_object" || !this.objectBuffer.length)
            return [];
        const buf = this.objectBuffer;
        this.state = "idle";
        this.objectBuffer = "";
        // Try closing strategies: just "}", then "\"}", then "\"}"
        for (const suffix of ["}", '"}', '"}']) {
            const block = this.tryParseObject(buf + suffix);
            if (block)
                return [{ type: "card_complete", block }];
        }
        return [];
    }
    tryParseObject(text) {
        try {
            const obj = JSON.parse(text);
            return parseCardObject(obj, this.getNoteType);
        }
        catch (_a) {
            return null;
        }
    }
    extractPartial() {
        const buf = this.objectBuffer;
        const typeMatch = buf.match(/"type"\s*:\s*"([^"]+)"/);
        if (!(typeMatch === null || typeMatch === void 0 ? void 0 : typeMatch[1]))
            return null;
        const noteType = this.getNoteType(typeMatch[1]);
        if (!noteType)
            return null;
        const firstField = noteType.fields[0];
        const secondField = noteType.fields[1];
        const extract = (field) => {
            var _a;
            if (!field)
                return undefined;
            const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(`"${escaped}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"?`);
            const m = buf.match(re);
            return ((_a = m === null || m === void 0 ? void 0 : m[1]) === null || _a === void 0 ? void 0 : _a.trim()) || undefined;
        };
        const partialQuestion = extract(firstField);
        const partialAnswer = extract(secondField);
        if (!partialQuestion && !partialAnswer)
            return null;
        return { type: "partial_update", partialQuestion, partialAnswer };
    }
}
