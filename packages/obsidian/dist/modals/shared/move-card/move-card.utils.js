export function noteHasTagPrefix(app, file, tagPrefix) {
    var _a, _b, _c;
    const cache = app.metadataCache.getFileCache(file);
    if (!cache)
        return false;
    const prefixLower = tagPrefix.toLowerCase();
    const frontmatterTags = ((_b = (_a = cache.frontmatter) === null || _a === void 0 ? void 0 : _a.tags) !== null && _b !== void 0 ? _b : []);
    const normalizedTags = Array.isArray(frontmatterTags)
        ? frontmatterTags
        : [frontmatterTags];
    for (const tag of normalizedTags) {
        if (typeof tag !== "string")
            continue;
        const normalizedTag = (tag.startsWith("#") ? tag.slice(1) : tag).toLowerCase();
        if (normalizedTag.startsWith(prefixLower)) {
            return true;
        }
    }
    const inlineTags = (_c = cache.tags) !== null && _c !== void 0 ? _c : [];
    return inlineTags.some((t) => {
        const tagWithoutHash = t.tag.slice(1).toLowerCase();
        return tagWithoutHash.startsWith(prefixLower);
    });
}
export function extractBacklinks(cardQuestion, cardAnswer) {
    const content = `${cardQuestion !== null && cardQuestion !== void 0 ? cardQuestion : ""} ${cardAnswer !== null && cardAnswer !== void 0 ? cardAnswer : ""}`;
    const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const links = [];
    let match = linkRegex.exec(content);
    while (match !== null) {
        if (match[1])
            links.push(match[1]);
        match = linkRegex.exec(content);
    }
    return [...new Set(links)];
}
