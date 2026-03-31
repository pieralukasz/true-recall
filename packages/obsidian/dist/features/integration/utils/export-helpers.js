export function resolveNotes(app) {
    const notes = [];
    const files = app.vault.getMarkdownFiles();
    for (const file of files) {
        const cache = app.metadataCache.getFileCache(file);
        if (!(cache === null || cache === void 0 ? void 0 : cache.frontmatter))
            continue;
        const uid = cache.frontmatter.flashcard_uid;
        if (!uid)
            continue;
        notes.push({ uid, name: file.basename });
    }
    return notes.sort((a, b) => a.name.localeCompare(b.name));
}
export function downloadBlob(data, filename, mimeType = "application/octet-stream") {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
