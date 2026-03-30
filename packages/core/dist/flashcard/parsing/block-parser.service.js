/**
 * Block Format Parser
 *
 * Parses the unified block format for all card types:
 *
 * #type/<slug>
 * Front: What is X?
 * Back: X is...
 * <!-- source: exact quote -->
 * ---
 *
 * Each block starts with #type/<slug>, contains FieldName: value pairs
 * (field names come from the NoteType), and ends at --- or EOF.
 */
const TYPE_TAG_RE = /^#type\/([a-z0-9-]+)$/;
const SOURCE_COMMENT_RE = /^<!--\s*source:\s*([\s\S]*?)\s*-->$/;
const BLOCK_SEPARATOR_RE = /^---\s*$/;
const ALWAYS_TYPE_IN_TOKEN = "@typein";
/**
 * Parse content containing block-format flashcards.
 * Returns parsed blocks and content with blocks stripped.
 */
export function parseBlocks(content, getNoteType) {
    var _a, _b, _c, _d, _e, _f, _g;
    const lines = content.split(/\r?\n/);
    const blocks = [];
    const nonBlockLines = [];
    // Skip YAML frontmatter
    let startIdx = 0;
    if (((_a = lines[0]) === null || _a === void 0 ? void 0 : _a.trim()) === "---") {
        let fmEnd = -1;
        for (let i = 1; i < lines.length; i++) {
            const line = (_b = lines[i]) !== null && _b !== void 0 ? _b : "";
            if (BLOCK_SEPARATOR_RE.test(line.trim())) {
                fmEnd = i;
                break;
            }
        }
        if (fmEnd > 0) {
            for (let i = 0; i <= fmEnd; i++) {
                nonBlockLines.push((_c = lines[i]) !== null && _c !== void 0 ? _c : "");
            }
            startIdx = fmEnd + 1;
        }
    }
    // Scan line-by-line: #type/<slug> starts a block, --- ends it
    let i = startIdx;
    while (i < lines.length) {
        const currentLine = (_d = lines[i]) !== null && _d !== void 0 ? _d : "";
        const trimmed = currentLine.trim();
        const typeMatch = trimmed.match(TYPE_TAG_RE);
        if (typeMatch) {
            // Potential block start — collect lines until --- or EOF
            const blockLines = [];
            const blockStart = i;
            i++; // skip the #type line
            while (i < lines.length &&
                !BLOCK_SEPARATOR_RE.test(((_e = lines[i]) !== null && _e !== void 0 ? _e : "").trim())) {
                blockLines.push((_f = lines[i]) !== null && _f !== void 0 ? _f : "");
                i++;
            }
            // i now points at --- or past EOF
            const matchedType = typeMatch[1];
            if (!matchedType)
                continue;
            const slug = matchedType;
            const noteType = getNoteType(slug);
            if (noteType) {
                const { fields, sourceText, alwaysTypeIn } = parseFieldValues(blockLines, noteType.fields);
                const hasContent = Object.values(fields).some((v) => v.trim().length > 0);
                if (hasContent) {
                    blocks.push({
                        noteTypeId: noteType.id,
                        noteTypeSlug: slug,
                        fields,
                        sourceText,
                        alwaysTypeIn,
                    });
                    // Skip the --- separator if present
                    if (i < lines.length)
                        i++;
                    continue;
                }
            }
            // Not a valid block — put lines back as non-block content
            for (let j = blockStart; j < i; j++) {
                nonBlockLines.push((_g = lines[j]) !== null && _g !== void 0 ? _g : "");
            }
            // Skip the --- separator if present
            if (i < lines.length)
                i++;
        }
        else if (BLOCK_SEPARATOR_RE.test(currentLine.trim())) {
            // Standalone --- not preceded by a block — preserve it
            nonBlockLines.push(currentLine);
            i++;
        }
        else {
            nonBlockLines.push(currentLine);
            i++;
        }
    }
    return {
        blocks,
        contentWithoutBlocks: nonBlockLines
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim(),
    };
}
/**
 * Parse FieldName: value pairs from lines.
 * Only field names belonging to the given NoteType are recognized as boundaries.
 * Multi-line values accumulate until the next field or end of block.
 */
function parseFieldValues(lines, fieldNames) {
    var _a;
    const fields = {};
    let sourceText;
    let alwaysTypeIn = false;
    for (const name of fieldNames) {
        fields[name] = "";
    }
    // Build a set and regex for field detection
    const fieldSet = new Set(fieldNames);
    let currentField = null;
    const valueLines = [];
    function flushField() {
        if (currentField && fieldSet.has(currentField)) {
            fields[currentField] = valueLines.join("\n").trim();
        }
        valueLines.length = 0;
    }
    for (const line of lines) {
        const trimmed = line.trim();
        const sourceMatch = trimmed.match(SOURCE_COMMENT_RE);
        if (sourceMatch) {
            sourceText = (_a = sourceMatch[1]) === null || _a === void 0 ? void 0 : _a.trim();
            continue;
        }
        if (trimmed === ALWAYS_TYPE_IN_TOKEN) {
            alwaysTypeIn = true;
            continue;
        }
        const fieldMatch = matchFieldStart(trimmed, fieldSet);
        if (fieldMatch) {
            flushField();
            currentField = fieldMatch.fieldName;
            // The rest of the line after "FieldName:" is the start of the value
            valueLines.push(fieldMatch.value);
        }
        else if (currentField) {
            valueLines.push(line);
        }
        // Lines before any field is matched are ignored (e.g., blank lines after #type tag)
    }
    flushField();
    return { fields, sourceText, alwaysTypeIn: alwaysTypeIn || undefined };
}
/**
 * Check if a line starts with a recognized field name followed by `:`.
 * Returns the field name and remaining value, or null.
 */
function matchFieldStart(trimmed, fieldSet) {
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0)
        return null;
    const candidate = trimmed.slice(0, colonIdx);
    if (fieldSet.has(candidate)) {
        return {
            fieldName: candidate,
            value: trimmed.slice(colonIdx + 1).trimStart(),
        };
    }
    return null;
}
// ── Serialization: ParsedBlock → block format text ──────
export function blockToText(block, fieldNames) {
    var _a;
    const lines = [`#type/${block.noteTypeSlug}`];
    for (const name of fieldNames) {
        const value = (_a = block.fields[name]) !== null && _a !== void 0 ? _a : "";
        if (value.includes("\n")) {
            lines.push(`${name}:`);
            lines.push(value);
        }
        else {
            lines.push(`${name}: ${value}`);
        }
    }
    if (block.sourceText) {
        lines.push(`<!-- source: ${block.sourceText} -->`);
    }
    if (block.alwaysTypeIn) {
        lines.push(ALWAYS_TYPE_IN_TOKEN);
    }
    return lines.join("\n");
}
export function blocksToText(blocks, getFieldNames) {
    return blocks
        .map((b) => blockToText(b, getFieldNames(b.noteTypeId)))
        .join("\n---\n");
}
/**
 * Count how many valid blocks exist in content.
 */
export function countBlocks(content, getNoteType) {
    return parseBlocks(content, getNoteType).blocks.length;
}
