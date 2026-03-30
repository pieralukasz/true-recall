/**
 * Migrates inline `Front :: Back` flashcard lines in notes to the new block format.
 *
 * For each note containing inline flashcards:
 * 1. Detect `Front :: Back` and standalone cloze lines
 * 2. Convert to block format (#type/basic, #type/cloze, etc.)
 * 3. Replace the old lines in the note content
 */
import { __awaiter } from "tslib";
import { blockToText } from "@true-recall/core/flashcard/parsing/block-parser.service";
import { CLOZE_DETECT, INLINE_SEPARATOR_RE, } from "@true-recall/core/flashcard/parsing/parsing-patterns";
import { BUILTIN_BASIC_ID, BUILTIN_CLOZE_ID } from "@true-recall/core/types/note.types";
/**
 * Migrate a single note's content from :: format to block format.
 * Returns the transformed content, or null if no changes were needed.
 */
export function migrateContent(content) {
    var _a, _b, _c, _d;
    const lines = content.split("\n");
    const result = [];
    let changed = false;
    // Skip YAML frontmatter
    let inFrontmatter = false;
    let frontmatterDone = false;
    let lineIndex = 0;
    if (((_a = lines[0]) === null || _a === void 0 ? void 0 : _a.trim()) === "---") {
        inFrontmatter = true;
        result.push(lines[0]);
        lineIndex = 1;
    }
    for (; lineIndex < lines.length; lineIndex++) {
        const line = (_b = lines[lineIndex]) !== null && _b !== void 0 ? _b : "";
        const trimmed = line.trim();
        if (inFrontmatter && !frontmatterDone) {
            result.push(line);
            if (trimmed === "---") {
                frontmatterDone = true;
                inFrontmatter = false;
            }
            continue;
        }
        // Already block format -- skip
        if (trimmed.startsWith("#type/")) {
            result.push(line);
            continue;
        }
        // Try :: separator
        const colonMatch = trimmed.match(INLINE_SEPARATOR_RE);
        if (colonMatch) {
            const front = (_c = colonMatch[1]) === null || _c === void 0 ? void 0 : _c.trim();
            const back = (_d = colonMatch[2]) === null || _d === void 0 ? void 0 : _d.trim();
            if (front && back) {
                const isCloze = CLOZE_DETECT.test(front);
                if (isCloze) {
                    result.push(`${blockToText({
                        noteTypeId: BUILTIN_CLOZE_ID,
                        noteTypeSlug: "cloze",
                        fields: { Text: front, Extra: back },
                    }, ["Text", "Extra"])}\n---`);
                }
                else {
                    result.push(`${blockToText({
                        noteTypeId: BUILTIN_BASIC_ID,
                        noteTypeSlug: "basic",
                        fields: { Front: front, Back: back },
                    }, ["Front", "Back"])}\n---`);
                }
                changed = true;
                continue;
            }
        }
        // Standalone cloze line
        if (CLOZE_DETECT.test(trimmed) && trimmed.length > 0) {
            result.push(`${blockToText({
                noteTypeId: BUILTIN_CLOZE_ID,
                noteTypeSlug: "cloze",
                fields: { Text: trimmed, Extra: "" },
            }, ["Text", "Extra"])}\n---`);
            changed = true;
            continue;
        }
        result.push(line);
    }
    return changed ? result.join("\n") : null;
}
/**
 * Migrate all notes in the vault from :: format to block format.
 */
export function migrateVault(fileSystem) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const mdFiles = yield fileSystem.listMarkdownFiles();
        let migratedFiles = 0;
        let migratedCards = 0;
        const errors = [];
        for (const filePath of mdFiles) {
            try {
                const content = yield fileSystem.read(filePath);
                const migrated = migrateContent(content);
                if (migrated !== null) {
                    // Count how many blocks we created
                    const blockCount = ((_a = migrated.match(/#type\//g)) !== null && _a !== void 0 ? _a : []).length;
                    yield fileSystem.write(filePath, migrated);
                    migratedFiles++;
                    migratedCards += blockCount;
                }
            }
            catch (err) {
                errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return { migratedFiles, migratedCards, errors };
    });
}
