const HIGHLIGHT_PATTERN = /==([^=]+)==/g;
export function extractHighlights(content) {
    return Array.from(content.matchAll(HIGHLIGHT_PATTERN))
        .map((match) => { var _a; return (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim(); })
        .filter((s) => s !== undefined && s.length > 0);
}
